/**
 * How a catalogue service becomes a line on a visit — the ONE path for
 * price, VAT, commission and "collect this at check-in".
 *
 * The front office used to resolve these four facts in four places with
 * four different answers: Quick Intake's row preview, createConsultationBill,
 * the Settle fallback and the doctor's page each had their own price
 * precedence (row override vs doctor charge vs catalogue vs a hardcoded
 * NPR 700 or 500), their own idea of whether a type "is the consultation"
 * (a substring test on the type's NAME), and their own dedupe key. A type
 * priced 0 was silently billed at 500 and filed with IRD.
 *
 * Rules, stated once:
 *   - price 0 is FREE: the line is recorded, nothing is collected.
 *   - price undefined, or a doctor-priced type whose doctor has no
 *     consultation charge, is REFUSED with a reason naming the setting to
 *     fix. Nothing the catalogue did not price is ever filed.
 *   - VAT, commission and collect-at-check-in come only from the type's
 *     own flags. No name is ever inspected.
 *
 * Pure: no React, no Firestore, no clock.
 */

import {
  computeVisitPayableTotal,
  type VisitBillingItem,
  type VisitPricingContext,
} from "./visitBillingCore";

export type PricedBy = "catalogue" | "doctor";
export type PerformerKind = "doctor" | "expert";
export type TypePerformerKind = PerformerKind | "either";
export type VisitLineOrigin = "booked" | "procedure" | "session" | "manual";

/** The catalogue fields a line is derived from (a subset of AppointmentType). */
export interface ChargeableType {
  id: string;
  name: string;
  price?: number | null;
  billAtFrontDesk?: boolean;
  calculateCommission?: boolean;
  defaultCommission?: number | null;
  isTaxable?: boolean;
  taxRate?: number | null;
  /** Tax classification code, copied onto every line billed for this type.
   * Per VAT Rules 2053 r.17, only mandatory for imported goods — not
   * applicable to the services this core mostly prices. */
  hsCode?: string | null;
  /** Absent on legacy types → "catalogue". */
  pricedBy?: PricedBy | null;
  /** Absent on legacy types → "either". */
  performerKind?: TypePerformerKind | null;
  categoryId?: string;
}

/** The clinician who performs (and earns commission on) the line. */
export interface ChargeClinician {
  id: string;
  name: string;
  kind: PerformerKind;
  consultationCharge?: number | null;
  defaultCommission?: number | null;
}

/** A pending visit line, in the shape pendingVisitItems stores. */
export interface VisitLine extends VisitBillingItem {
  id: string;
  appointmentTypeId: string;
  appointmentTypeName: string;
  price: number;
  quantity: number;
  amount: number;
  commission: number;
  calculateCommission: boolean;
  isTaxable: boolean;
  taxRate?: number;
  hsCode?: string;
  doctorId: string;
  doctorName: string;
  performerKind: PerformerKind;
  origin: VisitLineOrigin;
  collectAtCheckIn: boolean;
  patientPackageId?: string;
  recommendedBy?: string;
  addedBy: string;
  addedAt: Date;
  categoryId?: string;
}

export interface ChargeRefused {
  ok: false;
  /** Safe to show to staff verbatim. */
  reason: string;
  /** Where an admin fixes it. */
  fixPath: string;
}

export type ChargeResolution = { ok: true; line: VisitLine } | ChargeRefused;

export interface ResolveLineInput {
  origin: VisitLineOrigin;
  addedBy: string;
  now: Date;
  /** Pre-generated id for the line; callers that persist supply one. */
  id?: string;
  quantity?: number;
  recommendedBy?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const isMoney = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

export const APPOINTMENT_TYPES_SETTINGS = "Settings › Appointment Types";
export const DOCTOR_EDIT_SETTINGS =
  "Doctors › Edit › Doctor consultation charge";

/** Which kinds of clinician may perform a type. */
export function typePerformerKind(
  type: Pick<ChargeableType, "performerKind">,
): TypePerformerKind {
  return type.performerKind || "either";
}

/** The refusal when this clinician's kind may not perform the type. */
export function performerRefusal(
  type: Pick<ChargeableType, "name" | "performerKind">,
  clinician: Pick<ChargeClinician, "name" | "kind"> | null | undefined,
): ChargeRefused | null {
  const allowed = typePerformerKind(type);

  if (!clinician || allowed === "either" || allowed === clinician.kind) {
    return null;
  }

  return {
    ok: false,
    reason: `"${type.name}" is performed by ${allowed === "doctor" ? "a doctor" : "an expert"}, not ${clinician.name}.`,
    fixPath: APPOINTMENT_TYPES_SETTINGS,
  };
}

/**
 * The price a type bills at for a given clinician, or a refusal.
 * Exposed on its own so previews and the intake picker can show it.
 */
export function resolveTypePrice(
  type: ChargeableType,
  clinician: ChargeClinician | null | undefined,
): { ok: true; price: number } | ChargeRefused {
  const pricedBy: PricedBy = type.pricedBy || "catalogue";

  if (pricedBy === "doctor") {
    if (!clinician || clinician.kind !== "doctor") {
      return {
        ok: false,
        reason: `"${type.name}" is priced by the doctor's consultation charge, but no doctor is on this visit.`,
        fixPath: APPOINTMENT_TYPES_SETTINGS,
      };
    }
    if (!isMoney(clinician.consultationCharge)) {
      return {
        ok: false,
        reason: `${clinician.name} has no consultation charge set, so "${type.name}" cannot be priced.`,
        fixPath: DOCTOR_EDIT_SETTINGS,
      };
    }

    return { ok: true, price: round2(clinician.consultationCharge) };
  }

  if (!isMoney(type.price)) {
    return {
      ok: false,
      reason: `"${type.name}" has no price in the catalogue.`,
      fixPath: APPOINTMENT_TYPES_SETTINGS,
    };
  }

  return { ok: true, price: round2(type.price) };
}

/**
 * Commission % for a line: the type's own rate when it earns commission and
 * names one, else the clinician's default. 0 when the type is excluded.
 * Same precedence as appointmentBillingService.resolveItemFieldsFromAppointmentType.
 */
export function resolveLineCommission(
  type: Pick<ChargeableType, "calculateCommission" | "defaultCommission">,
  clinician: Pick<ChargeClinician, "defaultCommission"> | null | undefined,
): { calculateCommission: boolean; commission: number } {
  const calculateCommission = type.calculateCommission !== false;

  if (!calculateCommission) return { calculateCommission, commission: 0 };

  const rate =
    typeof type.defaultCommission === "number"
      ? type.defaultCommission
      : clinician?.defaultCommission || 0;

  return { calculateCommission, commission: round2(rate) };
}

/** Collect at check-in = the type says so AND there is something to collect. */
export function isCollectableAtCheckIn(
  type: Pick<ChargeableType, "billAtFrontDesk">,
  price: number,
): boolean {
  return type.billAtFrontDesk === true && price > 0;
}

/**
 * Build the line, or say why it cannot be built. The ONLY place a visit line
 * is derived from a catalogue type.
 */
export function resolveVisitLine(
  type: ChargeableType,
  clinician: ChargeClinician,
  input: ResolveLineInput,
): ChargeResolution {
  const refused = performerRefusal(type, clinician);

  if (refused) return refused;

  const priced = resolveTypePrice(type, clinician);

  if (priced.ok === false) return priced;

  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  const { calculateCommission, commission } = resolveLineCommission(
    type,
    clinician,
  );
  const line: VisitLine = {
    id: input.id || `${input.origin}-${type.id}-${clinician.id}`,
    appointmentTypeId: type.id,
    appointmentTypeName: type.name,
    price: priced.price,
    quantity,
    amount: round2(priced.price * quantity),
    commission,
    calculateCommission,
    isTaxable: type.isTaxable === true,
    ...(typeof type.taxRate === "number" ? { taxRate: type.taxRate } : {}),
    ...(type.hsCode ? { hsCode: type.hsCode } : {}),
    doctorId: clinician.id,
    doctorName: clinician.name,
    performerKind: clinician.kind,
    origin: input.origin,
    collectAtCheckIn: isCollectableAtCheckIn(type, priced.price),
    ...(input.recommendedBy ? { recommendedBy: input.recommendedBy } : {}),
    ...(type.categoryId ? { categoryId: type.categoryId } : {}),
    addedBy: input.addedBy,
    addedAt: input.now,
  };

  return { ok: true, line };
}

/**
 * The identity of a line for dedupe: the same service, from the same
 * moment of the visit, for the same performer. Replaces three different
 * keys (appointmentTypeId alone, doctorId+typeId, and name matching).
 */
export function visitLineKey(line: {
  origin?: string | null;
  appointmentTypeId?: string | null;
  doctorId?: string | null;
}): string {
  return `${line.origin || "booked"}:${line.appointmentTypeId || ""}:${line.doctorId || ""}`;
}

/** One per-session value, computed once at sale and stored on the PatientPackage. */
export function perSessionValue(
  walletCreditAmount: number,
  totalSessions: number,
): number {
  if (!(totalSessions > 0)) return 0;

  return round2((walletCreditAmount || 0) / totalSessions);
}

export interface SessionPackage {
  id: string;
  name: string;
  calculateCommission?: boolean;
  defaultCommission?: number | null;
}

/**
 * The commission-only line a package session puts on a visit: price 0 (the
 * patient prepaid), amount = the per-session value as the commission base.
 * Never collectable, never taxed (revenue was filed at sale).
 */
export function buildPackageSessionLine(
  pkg: SessionPackage,
  patientPackage: { id: string; perSessionValue: number },
  performer: ChargeClinician,
  input: Omit<ResolveLineInput, "origin">,
): VisitLine {
  const { calculateCommission, commission } = resolveLineCommission(
    pkg,
    performer,
  );

  return {
    id: input.id || `session-${patientPackage.id}-${performer.id}`,
    appointmentTypeId: pkg.id,
    appointmentTypeName: pkg.name,
    price: 0,
    quantity: 1,
    amount: round2(patientPackage.perSessionValue || 0),
    commission,
    calculateCommission,
    isTaxable: false,
    doctorId: performer.id,
    doctorName: performer.name,
    performerKind: performer.kind,
    origin: "session",
    collectAtCheckIn: false,
    patientPackageId: patientPackage.id,
    addedBy: input.addedBy,
    addedAt: input.now,
  };
}

/** The same line charging a different price: a share of a split procedure. */
export function withLinePrice(line: VisitLine, price: number): VisitLine {
  const p = round2(Math.max(0, price));

  return { ...line, price: p, amount: round2(p * line.quantity) };
}

/**
 * n shares of an amount that sum EXACTLY to it at two decimals; the odd
 * paisa land on the first shares. Two experts performing one procedure must
 * still invoice what the catalogue priced, not 2 × round(price / 2).
 */
export function splitAmount(total: number, shares: number): number[] {
  const count = Math.max(1, Math.floor(shares || 1));
  const paisa = Math.round((total || 0) * 100);
  const base = Math.floor(paisa / count);
  const extra = paisa - base * count;

  return Array.from(
    { length: count },
    (_, i) => (base + (i < extra ? 1 : 0)) / 100,
  );
}

export interface LineChargePreview {
  ok: true;
  price: number;
  vat: number;
  /** What the patient pays for this line, VAT included. */
  total: number;
  isTaxable: boolean;
  collectAtCheckIn: boolean;
  isFree: boolean;
}

/**
 * What a service will cost on a visit, for the read-only fee line the desk
 * shows BEFORE anything is written: the same price, VAT and
 * collect-at-check-in answers resolveVisitLine gives, or its refusal. The
 * clinician may still be blank while a row is being filled in; a
 * doctor-priced type then reports the refusal the desk would hit.
 */
export function previewLineCharge(
  type: ChargeableType,
  clinician: ChargeClinician | null | undefined,
  pricing: Pick<VisitPricingContext, "taxPercentage" | "isTaxEnabled">,
): LineChargePreview | ChargeRefused {
  const refused = performerRefusal(type, clinician);

  if (refused) return refused;

  const priced = resolveTypePrice(type, clinician);

  if (priced.ok === false) return priced;

  const probe: VisitLine = {
    id: "preview",
    appointmentTypeId: type.id,
    appointmentTypeName: type.name,
    price: priced.price,
    quantity: 1,
    amount: priced.price,
    commission: 0,
    calculateCommission: false,
    isTaxable: type.isTaxable === true,
    ...(typeof type.taxRate === "number" ? { taxRate: type.taxRate } : {}),
    doctorId: clinician?.id || "",
    doctorName: clinician?.name || "",
    performerKind: clinician?.kind || "doctor",
    origin: "booked",
    collectAtCheckIn: isCollectableAtCheckIn(type, priced.price),
    addedBy: "",
    addedAt: new Date(0),
  };
  const total = round2(
    computeVisitPayableTotal([probe], {
      taxPercentage: pricing.taxPercentage,
      isTaxEnabled: pricing.isTaxEnabled,
    }),
  );

  return {
    ok: true,
    price: priced.price,
    vat: round2(total - priced.price),
    total,
    isTaxable: type.isTaxable === true,
    collectAtCheckIn: probe.collectAtCheckIn,
    isFree: priced.price === 0,
  };
}

/** One sentence for a toast or an inline notice. */
export function refusalMessage(r: ChargeRefused): string {
  return `${r.reason} Fix it under ${r.fixPath}.`;
}
