/**
 * The visit lifecycle, in one place.
 *
 * A visit's stage used to be inferred ad hoc from six fields — `status`, a
 * magic substring inside free-text `notes`, `doctorConsultationCompleted`,
 * `checkoutCompleted`, `billingId` and the payment-status mirrors — spread
 * across a 6,000-line component. Nothing defined the lifecycle, so every
 * change to one field desynchronised another: a visit could be marked done
 * while money was still owed, or get stuck in "billing" forever and
 * re-file a duplicate invoice.
 *
 * Two rules this module exists to enforce:
 *
 *  1. Stage is DERIVED, never stored. A stored "checkoutCompleted" flag let
 *     the billing path force a visit to "done" without passing the clinical
 *     or balance checks that the checkout path enforces. Deriving it means
 *     no single write can bypass a gate.
 *  2. There is exactly one definition of "may this visit close", used by
 *     every caller, so the desk and the billing screen cannot disagree.
 */

import { getVisitPaymentGate, type VisitBillingItem } from "./visitBillingCore";

export type VisitStage =
  | "scheduled"
  | "lobby"
  | "triage-done"
  | "doctor"
  | "expert"
  | "billing"
  | "pharmacy"
  | "completed"
  | "cancelled"
  | "no-show";

/** Legacy marker: triage state used to live inside free-text notes. */
export const LEGACY_TRIAGE_MARKER = "[Triage Vitals Recorded]";
/** Legacy marker: checkout completion likewise. */
export const LEGACY_CHECKOUT_MARKER = "[Checkout Completed]";

export interface VisitLifecycleInput {
  status?: string | null;
  notes?: string | null;
  /** Structured replacement for the notes marker. */
  triageCompletedAt?: unknown;
  doctorConsultationCompleted?: boolean;
  doctorId?: string | null;
  assignedExpertId?: string | null;
  billingId?: string | null;
  billingStatus?: string | null;
  paymentStatus?: string | null;
  /** Set only by the checkout path, only after canCompleteCheckout passes. */
  checkoutCompleted?: boolean;
  pendingVisitItems?: VisitBillingItem[];
  depositedAmount?: number;
  recommendedProcedure?: unknown;
}

export interface VisitInvoiceState {
  status?: string | null;
  paymentStatus?: string | null;
  balanceAmount?: number | null;
}

export interface VisitLifecycleContext {
  /** The invoice this visit filed, if one has been filed and found. */
  invoice?: VisitInvoiceState | null;
  hasPendingPrescription?: boolean;
}

const hasClinician = (id?: string | null) => Boolean(id && id !== "unassigned");

/**
 * Whether triage vitals have been recorded.
 *
 * Reads the structured field first and falls back to the legacy notes
 * marker so visits recorded before the field existed still resolve. The
 * marker is a poor source of truth — it lives in a user-editable free-text
 * field that other flows append to, so it can be erased by an unrelated
 * notes edit or typed in by hand to fake clinical documentation — which is
 * why new writes should set `triageCompletedAt` instead.
 */
export function isTriageComplete(visit: VisitLifecycleInput): boolean {
  if (visit.triageCompletedAt) return true;

  return Boolean(visit.notes?.includes(LEGACY_TRIAGE_MARKER));
}

/**
 * True when this visit still owes money on a filed invoice.
 *
 * A cancelled invoice is explicitly NOT outstanding — it has been voided,
 * so it neither holds the visit open nor counts as having been billed.
 */
export function hasOutstandingInvoice(
  invoice?: VisitInvoiceState | null,
): boolean {
  if (!invoice) return false;
  if (invoice.status === "cancelled") return false;
  if (invoice.paymentStatus === "paid") return false;

  return (invoice.balanceAmount ?? 0) > 0;
}

/**
 * Whether a filed invoice still stands for this visit. A cancelled one does
 * not, which is what makes a voided visit billable again instead of being
 * stranded as "already billed" with its charges already cleared.
 */
export function hasLiveInvoice(
  visit: VisitLifecycleInput,
  invoice?: VisitInvoiceState | null,
): boolean {
  if (!visit.billingId) return false;
  // billingId points somewhere but the invoice couldn't be loaded — treat
  // it as live rather than inviting a second filing on missing data.
  if (!invoice) return true;

  return invoice.status !== "cancelled";
}

/**
 * The single projection of a visit onto the operational board.
 */
export function deriveVisitStage(
  visit: VisitLifecycleInput,
  context: VisitLifecycleContext = {},
): VisitStage {
  const status = visit.status?.toLowerCase();

  if (status === "no-show") return "no-show";
  if (status === "cancelled") return "cancelled";
  if (status === "scheduled") return "scheduled";

  if (status === "confirmed") {
    return isTriageComplete(visit) ? "triage-done" : "lobby";
  }

  if (status === "in-progress") {
    const withDoctor = hasClinician(visit.doctorId);
    const withExpert = hasClinician(visit.assignedExpertId);

    if (withDoctor && withExpert) {
      return visit.doctorConsultationCompleted ? "expert" : "doctor";
    }

    return withDoctor ? "doctor" : "expert";
  }

  if (status === "completed") {
    const settled = context.hasPendingPrescription ? "pharmacy" : "completed";

    // A recommendation still awaiting a bill/decline keeps the visit at the
    // billing desk regardless of anything else.
    if (visit.recommendedProcedure) return "billing";

    // A voided invoice re-opens the visit even if it was previously closed
    // out: its charges were cleared at checkout, so leaving it "done" means
    // services were delivered, the invoice was cancelled, and there is no
    // way left to bill for them.
    if (visit.billingId && context.invoice?.status === "cancelled") {
      return "billing";
    }

    // Billed, but money is still owed — the visit must not disappear from
    // the board while the patient still owes. Checked BEFORE the explicit
    // closure flag below, because that flag is exactly what used to hide
    // this case.
    if (hasOutstandingInvoice(context.invoice)) return "billing";

    // Staff explicitly closed this visit. That is a real fact and is
    // honoured — but only the checkout path may record it, and only after
    // canCompleteCheckout() passes. The legacy mirrors are kept so visits
    // recorded before this module still resolve.
    const explicitlyClosed =
      visit.checkoutCompleted === true ||
      visit.notes?.includes(LEGACY_CHECKOUT_MARKER) ||
      visit.billingStatus === "paid" ||
      visit.paymentStatus === "paid";

    if (explicitlyClosed) return settled;

    // Nothing filed yet (or charges still pending) — still needs billing.
    if (!hasLiveInvoice(visit, context.invoice)) return "billing";

    return settled;
  }

  return "completed";
}

export interface CheckoutEligibility {
  allowed: boolean;
  /** Present when not allowed; safe to show to staff verbatim. */
  reason?: string;
}

/**
 * The one definition of "may this visit be closed out".
 *
 * Previously these conditions lived inside a single handler, so a different
 * code path that set the completion flag directly skipped them entirely.
 */
export function canCompleteCheckout(
  visit: VisitLifecycleInput,
  context: VisitLifecycleContext = {},
): CheckoutEligibility {
  if (hasClinician(visit.doctorId) && !isTriageComplete(visit)) {
    return {
      allowed: false,
      reason: "Patient triage vitals have not been recorded.",
    };
  }

  if (visit.recommendedProcedure) {
    return {
      allowed: false,
      reason:
        "A recommended procedure is still awaiting a decision — finalise or decline it first.",
    };
  }

  const gate = getVisitPaymentGate(visit);

  if (gate.isDue) {
    return {
      allowed: false,
      reason: `NPR ${gate.dueAmount.toFixed(2)} is still to be collected for this visit.`,
    };
  }

  if (hasOutstandingInvoice(context.invoice)) {
    return {
      allowed: false,
      reason: "This visit's invoice still has an outstanding balance.",
    };
  }

  return { allowed: true };
}

export interface VisitQueueCandidacy {
  doctor: boolean;
  expert: boolean;
}

/**
 * Which clinician queues a patient who has finished triage but not yet been
 * routed should appear in.
 *
 * "Save Vitals Only" on the triage modal means exactly one thing: vitals are
 * recorded and NO routing decision has been made. The board used to make
 * that decision anyway, off a single incidental field — a patient with a
 * doctorId went to the doctor queue, everyone else to the expert queue. Two
 * consequences, both bad:
 *
 *   - A patient booked with a doctor AND an expert never appeared in the
 *     expert queue at all, even though the triage modal offers "Send to
 *     Expert" as an equal choice. Staff looking there would not find them.
 *   - A patient with neither assigned landed in the expert queue by
 *     accident, because the rule was the negation of "has a doctor" rather
 *     than anything about experts.
 *
 * An unrouted patient is a candidate for whichever clinicians the visit
 * actually names, and for both when it names none — because then the desk
 * genuinely has to choose. This mirrors the triage modal's own two buttons.
 *
 * Note this is candidacy, not location: once routed, the stage is "doctor"
 * or "expert" and the patient appears in exactly one queue. The "In Doctor
 * Cabin" / "In Expert Cabin" stat cards count only those routed stages, so
 * they are unaffected by a patient being a candidate for both.
 */
export function visitQueueCandidates(
  visit: Pick<VisitLifecycleInput, "doctorId" | "assignedExpertId">,
): VisitQueueCandidacy {
  const assigned = (id: string | null | undefined) =>
    Boolean(id && id !== "unassigned");

  const hasDoctor = assigned(visit.doctorId);
  const hasExpert = assigned(visit.assignedExpertId);

  if (!hasDoctor && !hasExpert) return { doctor: true, expert: true };

  return { doctor: hasDoctor, expert: hasExpert };
}
