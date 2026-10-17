/**
 * What checking a scheduled patient in means for money, decided once.
 *
 * The desk used to decide this per screen: check-in collected the doctor's
 * charge whatever was booked, routing asked again, and a PRP booking
 * collected the consultation fee. Here the booked service goes through the
 * charge core's preview, standing wallet credit is honoured, and a legacy
 * invoice from the old booking page means nothing is appended and nothing
 * is taken. Pure: facts in, a plan out.
 */

import {
  previewLineCharge,
  refusalMessage,
  type ChargeClinician,
  type ChargeableType,
  type LineChargePreview,
} from "./visitChargeCore";
import type { VisitPricingContext } from "./visitBillingCore";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CheckInFacts {
  status?: string | null;
  billingId?: string | null;
  consultationBillingId?: string | null;
  /** Set when the appointment is a sibling whose fee lives on the main visit. */
  billedOnAppointmentId?: string | null;
  patientPackageId?: string | null;
  appointmentTypeId?: string | null;
  depositedAmount?: number | null;
  /** The share of depositedAmount taken from standing credit, not cash. */
  depositFromCredit?: number | null;
}

export type CheckInPlan =
  /** An invoice from the old booking page already covers this visit. */
  | { kind: "invoiced"; invoiceNumber?: string }
  /** A package session: the commission line is recorded, nothing is taken. */
  | { kind: "session" }
  /** A sibling appointment: its fee is on the patient's main visit. */
  | { kind: "elsewhere" }
  /** Collect at check-in: the booked service's tax-inclusive total. */
  | {
      kind: "collect";
      preview: LineChargePreview;
      /** The line's total less what this visit already deposited. */
      due: number;
      standingCredit: number;
      /**
       * The slice of `due` standing credit actually pays, min(standingCredit,
       * due). This must be DEDUCTED from the wallet and earmarked onto the
       * visit the same way cash is — never merely "not asked for" — or the
       * same credit silently covers every other open visit too, forever.
       */
      creditApplied: number;
      /** What the desk takes as cash/card now: due - creditApplied. */
      collectNow: number;
    }
  /** Free, or collected at Settle: one click, nothing to take now. */
  | { kind: "free"; preview?: LineChargePreview }
  /** The charge core refuses the line; the patient is checked in without it. */
  | { kind: "refused"; reason: string };

/**
 * Wallet money not earmarked for any open visit: the balance less every
 * open visit's CASH-held deposit (this one's included — the gate subtracts
 * that separately). Never below zero.
 *
 * Only the cash/card share of a deposit still sits inside walletBalance —
 * it was added there at check-in and merely earmarked. The credit share
 * already LEFT walletBalance when it was claimed (deductFunds), so
 * subtracting it again here would double-count it and understate how
 * much standing credit remains for the patient's other open visits.
 */
export function standingWalletCredit(
  walletBalance: number | null | undefined,
  openVisits: Array<{ depositedAmount?: number | null; depositFromCredit?: number | null }>,
): number {
  const earmarked = openVisits.reduce((sum, v) => {
    const deposited = Math.max(0, v.depositedAmount || 0);
    const fromCredit = Math.min(deposited, Math.max(0, v.depositFromCredit || 0));
    return sum + (deposited - fromCredit);
  }, 0);

  return round2(Math.max(0, (walletBalance || 0) - earmarked));
}

export function planCheckIn(
  facts: CheckInFacts,
  type: ChargeableType | null | undefined,
  clinician: ChargeClinician | null | undefined,
  pricing: Pick<VisitPricingContext, "taxPercentage" | "isTaxEnabled">,
  opts: { standingCredit?: number; invoiceNumber?: string } = {},
): CheckInPlan {
  if (facts.billedOnAppointmentId) return { kind: "elsewhere" };
  if (facts.billingId || facts.consultationBillingId) {
    return { kind: "invoiced", invoiceNumber: opts.invoiceNumber };
  }
  if (facts.patientPackageId || facts.appointmentTypeId === "package-session") {
    return { kind: "session" };
  }
  if (!type) {
    return {
      kind: "refused",
      reason:
        "This visit's service is not in the catalogue; correct the appointment's service before checking in.",
    };
  }
  if (!clinician) {
    return {
      kind: "refused",
      reason:
        "No clinician is on this visit, so its service cannot be priced; assign one before checking in.",
    };
  }
  const preview = previewLineCharge(type, clinician, pricing);

  if (preview.ok === false) {
    return { kind: "refused", reason: refusalMessage(preview) };
  }
  if (preview.isFree || !preview.collectAtCheckIn) {
    return { kind: "free", preview };
  }
  const due = round2(
    Math.max(0, preview.total - Math.max(0, facts.depositedAmount || 0)),
  );

  if (due <= 0) return { kind: "free", preview };
  const standingCredit = round2(Math.max(0, opts.standingCredit || 0));
  const creditApplied = round2(Math.min(standingCredit, due));
  const collectNow = round2(Math.max(0, due - creditApplied));

  return {
    kind: "collect",
    preview,
    due,
    standingCredit,
    creditApplied,
    collectNow,
  };
}

/** One sentence for the sheet's fee line. */
export function describeCheckInPlan(plan: CheckInPlan): string {
  const money = (n: number) =>
    `NPR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  switch (plan.kind) {
    case "invoiced":
      return `Already invoiced at booking${plan.invoiceNumber ? ` · ${plan.invoiceNumber}` : ""}. Nothing to collect.`;
    case "session":
      return "Package session — prepaid, nothing to collect.";
    case "elsewhere":
      return "This clinician's fee is on the patient's main visit. Nothing to collect here.";
    case "free":
      return plan.preview && !plan.preview.isFree
        ? `${money(plan.preview.total)} is collected at Settle. Nothing to collect now.`
        : "Free — nothing to collect.";
    case "refused":
      return plan.reason;
    case "collect": {
      const p = plan.preview;
      const base =
        p.vat > 0 ? `${money(p.price)} + VAT ${money(p.vat)}` : money(p.price);

      if (plan.collectNow <= 0) {
        return `Wallet credit ${money(plan.creditApplied)} covers this fee (${base}). Collect ${money(0)}.`;
      }
      if (plan.creditApplied > 0) {
        return `Collect ${money(plan.collectNow)} (${base}, less wallet credit ${money(plan.creditApplied)}).`;
      }

      return `Collect ${money(plan.collectNow)} (${base}).`;
    }
  }
}

/**
 * When the wait clock starts: the moment the patient arrived, else the
 * booked start, never the record's creation (a pre-booked row showed 1,440
 * minutes on arrival).
 */
export function visitWaitStart(visit: {
  checkedInAt?: unknown;
  appointmentDate?: unknown;
  startTime?: string | null;
}): Date | null {
  const toDate = (v: unknown): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === "string") {
      const d = new Date(v);

      return isNaN(d.getTime()) ? null : d;
    }
    const anyV = v as { seconds?: number; toDate?: () => Date };

    if (typeof anyV.toDate === "function") return anyV.toDate();
    if (typeof anyV.seconds === "number") return new Date(anyV.seconds * 1000);

    return null;
  };
  const checkedIn = toDate(visit.checkedInAt);

  if (checkedIn) return checkedIn;
  const day = toDate(visit.appointmentDate);

  if (!day) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(visit.startTime || "");

  if (!m) return day;
  const at = new Date(day);

  at.setHours(Number(m[1]), Number(m[2]), 0, 0);

  return at;
}

export function waitMinutes(
  visit: Parameters<typeof visitWaitStart>[0],
  now: Date,
): number | null {
  const start = visitWaitStart(visit);

  if (!start) return null;

  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
}

/**
 * The same "collect" plan for a visit already in the lobby, from what the
 * gate says: lines in the check-in scope (tax-inclusive) less what was
 * deposited, less standing credit.
 */
export function planCollectDue(input: {
  /** Tax-inclusive total of the collect-at-check-in lines. */
  owed: number;
  /** Their pre-tax amount, for the breakdown. */
  base: number;
  deposited: number;
  standingCredit?: number;
}): CheckInPlan {
  const owed = round2(Math.max(0, input.owed));
  const due = round2(Math.max(0, owed - Math.max(0, input.deposited || 0)));

  if (due <= 0) return { kind: "free" };
  const standingCredit = round2(Math.max(0, input.standingCredit || 0));
  const creditApplied = round2(Math.min(standingCredit, due));
  const price = round2(Math.max(0, input.base));

  return {
    kind: "collect",
    preview: {
      ok: true,
      price,
      vat: round2(Math.max(0, owed - price)),
      total: owed,
      isTaxable: owed > price,
      collectAtCheckIn: true,
      isFree: false,
    },
    due,
    standingCredit,
    creditApplied,
    collectNow: round2(Math.max(0, due - creditApplied)),
  };
}
