/**
 * The impure half of the charge core: find the clinician, put a line on the
 * visit, take the money the check-in scope says is due.
 *
 * Every front-office screen and the prescription page call these three
 * functions; none of them builds a line of its own any more. The old desk
 * had four line builders (check-in, routing, the booked-type fallback at
 * Complete Consultation, the Settle fallback) plus two on the prescription
 * page, each with its own price precedence, its own NPR 700/500 fallback
 * and its own dedupe key. Now: resolveVisitLine decides, mergeVisitLines
 * dedupes inside a transaction, and the deposit is claimed before any money
 * moves.
 */

import type {
  Appointment,
  AppointmentBillingItem,
  AppointmentType,
  Doctor,
  Expert,
  TreatmentPackage,
} from "@/types/models";
import {
  arrayUnion,
  doc,
  increment,
  runTransaction,
  Timestamp,
  type Transaction,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  getVisitPaymentGate,
  type VisitPricingContext,
} from "./core/visitBillingCore";
import { appointmentService } from "./appointmentService";
import { doctorService } from "./doctorService";
import { expertService } from "./expertService";
import { patientPackageService } from "./patientPackageService";
import { PATIENTS_COLLECTION, walletService } from "./walletService";
import {
  asCommissionOnlyLine,
  buildPackageSessionLine,
  refusalMessage,
  resolveVisitLine,
  withLinePrice,
  type ChargeClinician,
  type ChargeRefused,
  type ChargeableType,
  type VisitLine,
  type VisitLineOrigin,
} from "./core/visitChargeCore";
import { findBookedLine } from "./core/legacyVisitAdapters";

export interface VisitLineContext {
  clinicId: string;
  userId: string;
  pricing: VisitPricingContext;
  now?: Date;
}

export type EnsureLineResult =
  | { ok: true; line: VisitLine; added: boolean }
  | ChargeRefused;

export const doctorAsClinician = (d: Doctor): ChargeClinician => ({
  id: d.id,
  name: d.name,
  kind: "doctor",
  consultationCharge: d.consultationCharge,
  defaultCommission: d.defaultCommission,
});

export const expertAsClinician = (e: Expert): ChargeClinician => ({
  id: e.id,
  name: e.name,
  kind: "expert",
  defaultCommission: e.defaultCommission,
});

/**
 * The clinician behind an id: the loaded lists first, then a fetch (a
 * clinician who went inactive mid-visit is still the one who performed).
 * `kind` narrows the search when the caller knows it; without it a doctor
 * id is tried before an expert id.
 */
export async function findClinician(
  id: string | null | undefined,
  kind: "doctor" | "expert" | undefined,
  lists: { doctors: Doctor[]; experts: Expert[] },
): Promise<ChargeClinician | null> {
  if (!id || id === "unassigned") return null;

  if (kind !== "expert") {
    const d = lists.doctors.find((x) => x.id === id);

    if (d) return doctorAsClinician(d);
  }
  if (kind !== "doctor") {
    const e = lists.experts.find((x) => x.id === id);

    if (e) return expertAsClinician(e);
  }
  if (kind !== "expert") {
    const d = await doctorService.getDoctorById(id).catch(() => null);

    if (d) return doctorAsClinician(d);
  }
  if (kind !== "doctor") {
    const e = await expertService.getExpertById(id).catch(() => null);

    if (e) return expertAsClinician(e);
  }

  return null;
}

/**
 * Put one catalogue service on the visit for one performer, or say why it
 * cannot be. `price` is only for a share of a split procedure; `commissionOnlyBase`
 * is for a service shared by several clinicians at check-in — the patient
 * pays nothing on this particular line (another clinician's line carries
 * the real charge), but this clinician still earns their own commission on
 * the full catalogue price. The catalogue price is the default and the
 * only other source.
 */
export async function ensureVisitLine(input: {
  appointment: Pick<Appointment, "id">;
  type: ChargeableType;
  clinician: ChargeClinician;
  origin: VisitLineOrigin;
  ctx: VisitLineContext;
  recommendedBy?: string;
  price?: number;
  commissionOnlyBase?: number;
}): Promise<EnsureLineResult> {
  const resolved = resolveVisitLine(input.type, input.clinician, {
    origin: input.origin,
    addedBy: input.ctx.userId,
    now: input.ctx.now || new Date(),
    recommendedBy: input.recommendedBy,
  });

  if (resolved.ok === false) return resolved;

  const line =
    typeof input.commissionOnlyBase === "number"
      ? asCommissionOnlyLine(resolved.line, input.commissionOnlyBase)
      : typeof input.price === "number"
        ? withLinePrice(resolved.line, input.price)
        : resolved.line;
  const { added } = await appointmentService.appendPendingVisitLines(
    input.appointment.id,
    [line as AppointmentBillingItem],
  );

  return { ok: true, line, added: added.length > 0 };
}

/**
 * The commission-only line for a package session: price 0 (prepaid at
 * sale), commission on the per-session value fixed at sale. Legacy patient
 * packages without that value get the whole-rupee figure the wallet has
 * been deducting.
 */
export async function ensureSessionLine(input: {
  appointment: Pick<Appointment, "id">;
  patientPackageId: string;
  /** The clinic's packages, to find the one the patient package was sold from. */
  packages: TreatmentPackage[];
  performer: ChargeClinician;
  ctx: VisitLineContext;
}): Promise<EnsureLineResult> {
  const pp = await patientPackageService.getPatientPackageById(
    input.patientPackageId,
  );

  if (!pp) {
    return {
      ok: false,
      reason: "The package session could not be found on this patient.",
      fixPath: "Patients › Packages",
    };
  }
  const pkg = input.packages.find((p) => p.id === pp.packageId);
  const sessions = pp.totalSessions || pkg?.totalSessions || 0;
  // Legacy patient packages (sold before the per-session value was stored)
  // use the WHOLE-rupee figure consumeSession has been deducting, so the
  // commission base and the wallet agree. New sales store a 2 dp value.
  const credit = pkg?.walletCreditAmount ?? pkg?.price ?? 0;
  const value =
    typeof pp.perSessionValue === "number"
      ? pp.perSessionValue
      : sessions > 0
        ? Math.round(credit / sessions)
        : 0;
  const line = buildPackageSessionLine(
    {
      id: pkg?.id || pp.packageId,
      name: pp.packageName || pkg?.name || "Package session",
      calculateCommission: pkg?.calculateCommission,
      defaultCommission: pkg?.defaultCommission,
    },
    { id: pp.id, perSessionValue: value },
    input.performer,
    { addedBy: input.ctx.userId, now: input.ctx.now || new Date() },
  );
  const { added } = await appointmentService.appendPendingVisitLines(
    input.appointment.id,
    [line as AppointmentBillingItem],
  );

  return { ok: true, line, added: added.length > 0 };
}

/**
 * Collect what the check-in scope still says is due. Standing wallet credit
 * is spent FIRST — deducted from the wallet and earmarked onto this visit
 * by the same depositedAmount counter cash uses — then any remaining amount
 * is taken as cash/card. Earmarking the credit matters: without an actual
 * wallet deduction, "covered by credit" was never recorded anywhere, so the
 * same balance could cover every other open visit too, forever, and no
 * real money was ever collected for any of them.
 *
 * Each step is ONE transaction over the visit, the patient's wallet and
 * the ledger row: what the visit still owes is re-read inside it (so two
 * desks cannot both take it — the loser sees 0 due), and the row, the
 * balance and the visit's depositedAmount commit together or not at all.
 * This used to be a claim on the visit in one transaction and the wallet
 * move in another, with a best-effort "release the claim" if the second
 * failed; when that release itself failed — on the same bad connection —
 * the visit showed money collected that never was, and nothing ever
 * reconciled it. The two steps stay separate transactions because the
 * patients rule validates a balance move against exactly one ledger row.
 */
export interface DepositCapture {
  method: string;
  reference?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function collectCheckInDue(
  visit: { id: string; patientId: string },
  ctx: VisitLineContext,
  /** Null when nothing is to be taken as cash/card right now. */
  capture: DepositCapture | null,
  opts: { standingCredit?: number } = {},
): Promise<{ collected: number; creditApplied: number; txnId: string | null }> {
  const standingCredit = Math.max(0, opts.standingCredit || 0);
  const appointmentRef = doc(db, "appointments", visit.id);
  const patientRef = doc(db, PATIENTS_COLLECTION, visit.patientId);
  const now = ctx.now ?? new Date();

  // Firestore wants every read in a transaction before any write.
  const readBoth = async (transaction: Transaction) => {
    const [apptSnap, patientSnap] = await Promise.all([
      transaction.get(appointmentRef),
      transaction.get(patientRef),
    ]);

    if (!apptSnap.exists()) throw new Error("Appointment not found");
    if (!patientSnap.exists()) throw new Error("Patient not found");

    return { apptSnap, patientSnap };
  };

  // A failed step leaves nothing half-applied, so the marker only tells the
  // desk "the last attempt took nothing — try again" (CheckInSheet).
  const markFailed = () =>
    appointmentService
      .markCheckInDepositFailed(visit.id, true)
      .catch((markErr) =>
        console.error("Failed to mark the deposit as failed:", markErr),
      );

  let creditApplied = 0;
  let creditTxnId: string | null = null;

  if (standingCredit > 0) {
    try {
      const credit = await runTransaction(db, async (transaction) => {
        const { apptSnap, patientSnap } = await readBoth(transaction);
        // Against the visit's TRUE remaining due (no credit netted in this
        // gate read), capped at the credit on offer and at what the wallet
        // actually holds right now — the desk's balance may be stale.
        const gate = getVisitPaymentGate(
          apptSnap.data() as never,
          ctx.pricing,
          "checkin",
          {},
        );
        const balance = Math.max(
          0,
          Number(patientSnap.data()?.walletBalance) || 0,
        );
        let claim = round2(Math.min(gate.dueAmount, standingCredit));

        if (claim > balance + 0.005) claim = Math.floor(balance * 100) / 100;
        if (claim <= 0) return { claim: 0, txnId: null as string | null };

        const txnId = walletService.deductFundsInTransaction(
          transaction,
          patientSnap,
          {
            patientId: visit.patientId,
            clinicId: ctx.clinicId,
            amount: claim,
            referenceId: visit.id,
            referenceType: "appointment",
            notes: `Visit deposit — covered by wallet credit (appointment ${visit.id})`,
            createdBy: ctx.userId,
            now,
          },
        );

        // This share has LEFT the wallet: checkout applies it without
        // deducting again and a no-show returns it — the cash step below,
        // by contrast, pays INTO the wallet.
        transaction.update(appointmentRef, {
          depositedAmount: round2(gate.deposited + claim),
          depositFromCredit: increment(claim),
          depositTxnIds: arrayUnion(txnId),
          checkInDepositFailedAt: null,
          updatedAt: Timestamp.now(),
        });

        return { claim, txnId };
      });

      creditApplied = credit.claim;
      creditTxnId = credit.txnId;
    } catch (err) {
      await markFailed();
      throw err;
    }
  }

  if (!capture) return { collected: 0, creditApplied, txnId: creditTxnId };

  try {
    const cash = await runTransaction(db, async (transaction) => {
      const { apptSnap, patientSnap } = await readBoth(transaction);
      // The credit step already earmarked its share onto depositedAmount,
      // so this gate read asks for exactly what remains in cash.
      const gate = getVisitPaymentGate(
        apptSnap.data() as never,
        ctx.pricing,
        "checkin",
        {},
      );
      const claim = round2(gate.dueAmount);

      if (claim <= 0) return { claim: 0, txnId: null as string | null };

      const txnId = walletService.addFundsInTransaction(
        transaction,
        patientSnap,
        {
          patientId: visit.patientId,
          clinicId: ctx.clinicId,
          amount: claim,
          paymentMethod: capture.method || "cash",
          notes: `Visit deposit — collected at check-in (appointment ${visit.id})`,
          createdBy: ctx.userId,
          referenceId: visit.id,
          referenceType: "appointment",
          paymentReference: capture.reference,
          now,
        },
      );

      transaction.update(appointmentRef, {
        depositedAmount: round2(gate.deposited + claim),
        depositTxnIds: arrayUnion(txnId),
        checkInDepositFailedAt: null,
        updatedAt: Timestamp.now(),
      });

      return { claim, txnId };
    });

    if (cash.claim <= 0) return { collected: 0, creditApplied, txnId: null };

    return { collected: cash.claim, creditApplied, txnId: cash.txnId };
  } catch (err) {
    await markFailed();
    throw err;
  }
}

export interface BookedRow {
  clinicianId: string;
  clinicianType?: "doctor" | "expert";
  appointmentTypeId?: string;
  /** For a package session: the PatientPackage consumed. */
  patientPackageId?: string;
}

export interface CatalogueLists {
  doctors: Doctor[];
  experts: Expert[];
  appointmentTypes: AppointmentType[];
  packages: TreatmentPackage[];
}

/**
 * Put each row's booked service on the visit through the charge core.
 * Refusals are returned, never thrown: the visit proceeds either way and
 * the desk is told exactly which line it would not invent. A sibling
 * appointment (an extra clinician at Quick Intake) gets nothing: its fee
 * lives on the patient's main visit.
 */
export async function appendBookedLines(input: {
  appointment: { id: string; billedOnAppointmentId?: string | null };
  rows: BookedRow[];
  lists: CatalogueLists;
  ctx: VisitLineContext;
}): Promise<string[]> {
  if (input.appointment.billedOnAppointmentId) return [];
  const refusals: string[] = [];
  let liveLines: AppointmentBillingItem[] | null = null;
  let liveApptTypeId: string | null | undefined = null;

  // Package/session rows are handled per-row, each against its own
  // ticket — a session is never shared between clinicians. Ordinary
  // booked-type rows are grouped by appointmentTypeId FIRST: two
  // clinician rows picking the SAME service in one Quick Intake
  // submission (a joint consultation, or simply the same type picked
  // twice by mistake) must be billed to the patient ONCE, not once per
  // clinician — a per-row loop with no grouping billed it in full to
  // each. Each assigned clinician still earns their own commission on
  // the FULL price, not a divided share: commission is what the clinic
  // pays out, separate from what the patient owes, so one clinician's
  // cut does not shrink because another was also assigned the same
  // service (see asCommissionOnlyLine).
  const sessionRows: BookedRow[] = [];
  const rowsByType = new Map<string, BookedRow[]>();

  for (const row of input.rows) {
    if (!row.clinicianId || row.clinicianId === "unassigned") continue;
    const typeId = row.appointmentTypeId || "";

    if (row.patientPackageId || typeId.startsWith("consume_pkg_")) {
      sessionRows.push(row);
      continue;
    }
    if (!typeId || typeId === "default" || typeId.startsWith("pkg_")) continue;
    if (!rowsByType.has(typeId)) rowsByType.set(typeId, []);
    rowsByType.get(typeId)!.push(row);
  }

  for (const row of sessionRows) {
    const clinician = await findClinician(row.clinicianId, row.clinicianType, {
      doctors: input.lists.doctors,
      experts: input.lists.experts,
    });

    if (!clinician) {
      refusals.push("The selected clinician could not be found.");
      continue;
    }
    const typeId = row.appointmentTypeId || "";
    const result = await ensureSessionLine({
      appointment: { id: input.appointment.id },
      patientPackageId:
        row.patientPackageId || typeId.replace("consume_pkg_", ""),
      packages: input.lists.packages,
      performer: clinician,
      ctx: input.ctx,
    });

    if (result.ok === false) refusals.push(refusalMessage(result));
  }

  for (const [typeId, rows] of rowsByType) {
    const type = input.lists.appointmentTypes.find((t) => t.id === typeId);

    if (!type) {
      refusals.push(
        `Service "${typeId}" is not in the catalogue; edit the appointment's service first.`,
      );
      continue;
    }

    // Resolve every row's clinician, de-duplicated — two rows naming the
    // SAME clinician for the SAME type collapse to one (nothing to
    // split there).
    const clinicians: ChargeClinician[] = [];
    const seenClinicianIds = new Set<string>();

    for (const row of rows) {
      const clinician = await findClinician(row.clinicianId, row.clinicianType, {
        doctors: input.lists.doctors,
        experts: input.lists.experts,
      });

      if (!clinician) {
        refusals.push("The selected clinician could not be found.");
        continue;
      }
      if (seenClinicianIds.has(clinician.id)) continue;
      seenClinicianIds.add(clinician.id);
      clinicians.push(clinician);
    }
    if (clinicians.length === 0) continue;

    if (liveLines === null) {
      const live = await appointmentService.getAppointmentById(
        input.appointment.id,
      );

      liveLines = ((live as any)?.pendingVisitItems || []) as AppointmentBillingItem[];
      liveApptTypeId = live?.appointmentTypeId ?? null;
    }
    // A visit that was sent back/undone after its booked fee was already
    // collected, then re-checked-in or re-routed to a DIFFERENT
    // clinician, must not be charged for the same service twice —
    // mergeVisitLines keys a booked line by (type, doctor), so without
    // this check it would see a new doctor as a genuinely new line and
    // add a second charge for the same consultation. findBookedLine's
    // "whoever performs it" rule is what every other screen already
    // uses to decide a service is already on the visit; re-attributing
    // the existing line (rather than skipping it bare) is what keeps
    // the invoice and commission with whoever is actually seeing the
    // patient. This path handles only the first clinician of the group —
    // a type colliding with BOTH a pre-existing line AND a new multi-
    // clinician split in the same batch is not something this covers.
    const existing = findBookedLine(liveLines, type.id, liveApptTypeId);

    if (existing) {
      const clinician = clinicians[0];

      if (
        existing.doctorId !== clinician.id ||
        existing.performerKind !== clinician.kind
      ) {
        await appointmentService
          .reattributeVisitLine(input.appointment.id, existing.id, {
            id: clinician.id,
            name: clinician.name,
            kind: clinician.kind,
          })
          .catch((err) =>
            console.error(
              "Failed to re-attribute the visit's existing booked line at check-in:",
              err,
            ),
          );
        existing.doctorId = clinician.id;
        existing.doctorName = clinician.name;
        existing.performerKind = clinician.kind;
      }
      continue;
    }

    // Genuinely new. The FIRST clinician's line is the real charge, at the
    // full catalogue price — the patient pays this service once, no
    // matter how many clinicians this batch assigned to it. Every OTHER
    // clinician assigned the same type gets a commission-only line
    // instead: price 0 (nothing added to the invoice), but their own
    // commission computed on the FULL price, not a divided share —
    // commission is what the clinic pays each clinician for their part,
    // not patient revenue that has to sum to one total, so there is no
    // reason one clinician's cut should shrink because another clinician
    // also gets one. The single-clinician case (by far the common one) is
    // just the first line, same as before this grouping existed at all.
    const primary = await ensureVisitLine({
      appointment: { id: input.appointment.id },
      type,
      clinician: clinicians[0],
      origin: "booked",
      ctx: input.ctx,
    });

    if (primary.ok === false) {
      refusals.push(refusalMessage(primary));
      continue;
    }
    if (primary.added) liveLines.push(primary.line as AppointmentBillingItem);

    for (let i = 1; i < clinicians.length; i++) {
      const result = await ensureVisitLine({
        appointment: { id: input.appointment.id },
        type,
        clinician: clinicians[i],
        origin: "booked",
        ctx: input.ctx,
        commissionOnlyBase: primary.line.amount,
      });

      if (result.ok === false) refusals.push(refusalMessage(result));
      else if (result.added) liveLines.push(result.line as AppointmentBillingItem);
    }
  }

  return refusals;
}

export interface CheckInOutcome {
  /** False when another desk had already checked the visit in. */
  transitioned: boolean;
  refusals: string[];
  collected: number;
  creditApplied: number;
  txnId: string | null;
  /** The fee is on the visit but the wallet write failed; "Retry fee" shows. */
  depositFailed: boolean;
  /** The booked line itself could not be written after check-in committed. */
  lineAppendFailed: boolean;
}

/**
 * Check a scheduled visit in: the arrival time, the booked line, the
 * deposit — in that order. The arrival time is already durable once this
 * function is called (checkInAppointment is a separate, independent
 * transaction below), so a failure in either later step must never surface
 * as "check-in failed" — the patient IS checked in; what failed is
 * reported distinctly so staff can retry exactly that step, never the
 * whole visit. A visit already invoiced by the old booking page gets no
 * line and no money.
 */
export async function checkInVisit(input: {
  appointment: {
    id: string;
    patientId: string;
    billedOnAppointmentId?: string | null;
    billingId?: string | null;
    consultationBillingId?: string | null;
  };
  rows: BookedRow[];
  lists: CatalogueLists;
  ctx: VisitLineContext;
  /** Null when nothing is to be taken as cash/card right now. */
  capture: DepositCapture | null;
  standingCredit?: number;
}): Promise<CheckInOutcome> {
  const { transitioned } = await appointmentService.checkInAppointment(
    input.appointment.id,
    input.ctx.now || new Date(),
  );
  const invoiced = Boolean(
    input.appointment.billingId || input.appointment.consultationBillingId,
  );
  let refusals: string[] = [];
  let lineAppendFailed = false;

  if (!invoiced) {
    try {
      refusals = await appendBookedLines({
        appointment: input.appointment,
        rows: input.rows,
        lists: input.lists,
        ctx: input.ctx,
      });
    } catch (err) {
      // checkInAppointment already committed above — this failure must not
      // read back to the desk as "check-in failed" when it plainly did not.
      console.error("Error appending the booked line at check-in:", err);
      lineAppendFailed = true;
      refusals = [
        "The visit's service could not be added — add it from the queue before sending the patient in.",
      ];
    }
  }

  if (invoiced) {
    return {
      transitioned,
      refusals,
      collected: 0,
      creditApplied: 0,
      txnId: null,
      depositFailed: false,
      lineAppendFailed,
    };
  }
  try {
    // Standing credit must still be earmarked even when there is nothing to
    // collect as cash (capture null) — collectCheckInDue handles that split
    // internally, and self-corrects to 0 against live state when the line
    // above never actually landed.
    const { collected, creditApplied, txnId } = await collectCheckInDue(
      { id: input.appointment.id, patientId: input.appointment.patientId },
      input.ctx,
      input.capture,
      { standingCredit: input.standingCredit },
    );

    return {
      transitioned,
      refusals,
      collected,
      creditApplied,
      txnId,
      depositFailed: false,
      lineAppendFailed,
    };
  } catch (err) {
    console.error("Check-in deposit failed:", err);

    return {
      transitioned,
      refusals,
      collected: 0,
      creditApplied: 0,
      txnId: null,
      depositFailed: true,
      lineAppendFailed,
    };
  }
}
