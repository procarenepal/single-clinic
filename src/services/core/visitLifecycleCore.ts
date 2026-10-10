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

import {
  getVisitPaymentGate,
  type VisitBillingItem,
  type VisitPricingContext,
} from "./visitBillingCore";

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
  pendingVisitDiscountType?: "flat" | "percent" | null;
  pendingVisitDiscountValue?: number | null;
  recommendedProcedure?: unknown;
  appointmentTypeId?: string | null;
  /** Invoices this visit filed and later voided by a reissue. */
  voidedInvoiceIds?: string[] | null;
  recommendedItems?: VisitRecommendedItemLike[] | null;
  invoiceRevision?: number | null;
  cabinName?: string | null;
  patientPackageId?: string | null;
  checkedInAt?: unknown;
}

/** The subset of a typed recommendation the lifecycle reads. */
export interface VisitRecommendedItemLike {
  doToday?: boolean;
  status?: string;
  performedBy?: { kind?: string } | null;
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
  /**
   * Clinic tax settings. Supply them wherever available so "still to be
   * collected" is judged tax-inclusive, the way the desk collects it.
   */
  pricing?: VisitPricingContext;
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
/** A billingId that a reissue has already voided is never live. */
export function isVoidedInvoice(visit: VisitLifecycleInput): boolean {
  return Boolean(
    visit.billingId && visit.voidedInvoiceIds?.includes(visit.billingId),
  );
}

export function hasLiveInvoice(
  visit: VisitLifecycleInput,
  invoice?: VisitInvoiceState | null,
): boolean {
  if (!visit.billingId) return false;
  if (isVoidedInvoice(visit)) return false;
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
    if (
      visit.billingId &&
      !isVoidedInvoice(visit) &&
      context.invoice?.status === "cancelled"
    ) {
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

  const gate = getVisitPaymentGate(visit, context.pricing || {}, "all");

  if (gate.isDue) {
    return {
      allowed: false,
      reason: `NPR ${gate.dueAmount.toFixed(2)} is still to be collected for this visit.`,
    };
  }

  // Charges accumulated during the visit become an invoice only at
  // "Settle Billing Invoice", which clears this list. While it is
  // non-empty the money has been taken as a deposit but nothing has been
  // filed — closing the visit now would leave the patient charged with no
  // invoice, no IRD filing and no commission, and nothing left on the
  // board to say so. Judged after the deposit gate so staff are told to
  // collect first when that is what is actually missing.
  if ((visit.pendingVisitItems?.length ?? 0) > 0) {
    return {
      allowed: false,
      reason:
        "This visit's charges have not been invoiced yet — settle the billing invoice first.",
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

/**
 * Where a visit at the billing desk actually is:
 *   - "to-settle": nothing filed yet (or the filing was voided) — the
 *     settle sheet files from the pending lines;
 *   - "filed-unpaid": an invoice stands and still carries a balance —
 *     the desk collects against it;
 *   - "reissue": an invoice stands but the visit has changed under it
 *     (new pending lines, or the invoice was cancelled without a reissue)
 *     — the only honest move is a credit note and a new filing.
 */
export type BillingSubState = "to-settle" | "filed-unpaid" | "reissue";

export function deriveBillingSubState(
  visit: VisitLifecycleInput,
  context: VisitLifecycleContext = {},
): BillingSubState {
  const pending = visit.pendingVisitItems?.length ?? 0;

  if (
    visit.billingId &&
    !isVoidedInvoice(visit) &&
    context.invoice?.status === "cancelled"
  ) {
    return "reissue";
  }
  if (!hasLiveInvoice(visit, context.invoice)) return "to-settle";
  if (pending > 0) return "reissue";
  if (hasOutstandingInvoice(context.invoice)) return "filed-unpaid";

  return "to-settle";
}

export interface ConsultationOutcome {
  status: "in-progress" | "completed";
  doctorConsultationCompleted: true;
  /** True when the visit now moves to the expert's cabin. */
  routeToExpert: boolean;
}

/**
 * What finishing the doctor's step does next. An expert on the visit gets
 * the patient when the doctor recorded work for them today — or when the
 * doctor recorded nothing at all, since a booked expert step (consultation
 * plus a skin test, say) must still happen. Otherwise the visit completes
 * and goes to the settle desk.
 */
export function nextStageAfterConsultation(
  visit: Pick<VisitLifecycleInput, "assignedExpertId" | "recommendedItems">,
): ConsultationOutcome {
  const hasExpert = hasClinician(visit.assignedExpertId);
  const items = visit.recommendedItems;
  const recordedNothing = !items || items.length === 0;
  const expertWorkToday = (items || []).some(
    (i) =>
      i.doToday !== false &&
      (i.status === undefined || i.status === "recommended") &&
      i.performedBy?.kind === "expert",
  );
  const routeToExpert = hasExpert && (expertWorkToday || recordedNothing);

  return {
    status: routeToExpert ? "in-progress" : "completed",
    doctorConsultationCompleted: true,
    routeToExpert,
  };
}

export type ReverseVisitKind =
  | "no-show"
  | "cancel"
  | "send-back"
  | "undo-check-in"
  | "reinstate";

export interface ReverseVisitPlan {
  allowed: boolean;
  /** Present when not allowed; safe to show to staff verbatim. */
  reason?: string;
  /** Fields to write on the appointment. */
  patch: Record<string, unknown>;
  /** A package session ticket this visit held must be released. */
  releasesSession: boolean;
  /** Money already in the wallet that stays there as credit (never clawed). */
  walletCreditRetained: number;
  /** A line to append to the visit's notes. */
  note?: string;
}

/**
 * The one definition of every way a visit goes backwards, so Undo
 * Check-In, Send Back, No-Show, Cancel and Reinstate — from the desk and
 * from the Appointments page — produce identical state. None of them ever
 * touches a filed invoice or the wallet ledger.
 */
export function reverseVisitPlan(
  kind: ReverseVisitKind,
  visit: VisitLifecycleInput,
  input: { reason?: string; by: string; now: Date },
  context: VisitLifecycleContext = {},
): ReverseVisitPlan {
  const status = visit.status?.toLowerCase();
  const deposit = Math.max(0, visit.depositedAmount || 0);
  const none: ReverseVisitPlan = {
    allowed: false,
    patch: {},
    releasesSession: false,
    walletCreditRetained: 0,
  };
  const stamp = (label: string) =>
    `[${label} by ${input.by} at ${input.now.toISOString()}${input.reason ? `: ${input.reason}` : ""}]`;

  switch (kind) {
    case "no-show":
      if (status !== "scheduled") {
        return {
          ...none,
          reason:
            "Only a scheduled visit can be marked no-show. Cancel the visit instead.",
        };
      }

      return {
        allowed: true,
        patch: { status: "no-show" },
        releasesSession: false,
        walletCreditRetained: 0,
        note: stamp("No-show"),
      };

    case "cancel":
      if (hasLiveInvoice(visit, context.invoice)) {
        return {
          ...none,
          reason:
            "This visit's invoice has been filed. Reverse it from the invoice (credit note), not here.",
        };
      }
      if (status === "cancelled") {
        return { ...none, reason: "This visit is already cancelled." };
      }

      return {
        allowed: true,
        patch: {
          status: "cancelled",
          cancelReason: input.reason || "",
          cabinName: null,
          pendingVisitItems: [],
          pendingVisitReferrals: [],
          pendingVisitDiscountType: null,
          pendingVisitDiscountValue: 0,
          recommendedItems: [],
          recommendedProcedure: null,
          depositedAmount: 0,
          depositTxnIds: [],
        },
        releasesSession: Boolean(visit.patientPackageId),
        walletCreditRetained: deposit,
        note: stamp("Cancelled"),
      };

    case "send-back":
      if (
        status !== "in-progress" &&
        !(status === "confirmed" && isTriageComplete(visit))
      ) {
        return {
          ...none,
          reason:
            "Only a patient in a cabin, or triaged and waiting, can be sent back.",
        };
      }

      return {
        allowed: true,
        patch: { status: "confirmed", cabinName: null },
        releasesSession: false,
        walletCreditRetained: 0,
        note: stamp("Sent back to waiting"),
      };

    case "undo-check-in":
      if (status !== "confirmed") {
        return {
          ...none,
          reason: "Only a waiting patient can have check-in undone.",
        };
      }
      if (deposit >= 0.005) {
        return {
          ...none,
          reason:
            "A deposit was collected for this visit. Use Cancel Visit instead, which keeps the money as wallet credit.",
        };
      }

      return {
        allowed: true,
        patch: {
          status: "scheduled",
          checkedInAt: null,
          cabinName: null,
          pendingVisitItems: [],
          pendingVisitReferrals: [],
        },
        releasesSession: Boolean(visit.patientPackageId),
        walletCreditRetained: 0,
        note: stamp("Check-in undone"),
      };

    case "reinstate":
      if (status !== "no-show" && status !== "cancelled") {
        return {
          ...none,
          reason: "Only a no-show or cancelled visit can be reinstated.",
        };
      }

      return {
        allowed: true,
        patch: { status: "scheduled", cancelReason: null, checkedInAt: null },
        releasesSession: false,
        walletCreditRetained: 0,
        note: stamp("Reinstated"),
      };
  }

  return none;
}

export interface RerouteTarget {
  doctorId?: string | null;
  doctorName?: string | null;
  assignedExpertId?: string | null;
  expertName?: string | null;
  cabinName?: string | null;
}

export interface RerouteVisitPlan {
  allowed: boolean;
  reason?: string;
  patch: Record<string, unknown>;
  note?: string;
  /** Names of lines whose attribution stays with the previous clinician. */
  keptAttribution: string[];
}

/**
 * Change who sees the patient and/or where. Lines already on the visit
 * keep their performer (the fee was earned by whoever it was attributed
 * to); new lines go to the new clinician. Never after filing.
 */
export function rerouteVisitPlan(
  visit: VisitLifecycleInput,
  target: RerouteTarget,
  input: { by: string; now: Date },
  context: VisitLifecycleContext = {},
): RerouteVisitPlan {
  if (hasLiveInvoice(visit, context.invoice)) {
    return {
      allowed: false,
      reason: "This visit has been invoiced; it cannot be rerouted.",
      patch: {},
      keptAttribution: [],
    };
  }
  const status = visit.status?.toLowerCase();

  if (status !== "confirmed" && status !== "in-progress") {
    return {
      allowed: false,
      reason: "Only a waiting or in-cabin patient can be rerouted.",
      patch: {},
      keptAttribution: [],
    };
  }
  const patch: Record<string, unknown> = {};

  if (target.doctorId !== undefined)
    patch.doctorId = target.doctorId || "unassigned";
  if (target.assignedExpertId !== undefined)
    patch.assignedExpertId = target.assignedExpertId || "unassigned";
  if (target.cabinName !== undefined)
    patch.cabinName = target.cabinName || null;

  const keptAttribution = (visit.pendingVisitItems || [])
    .filter((line) => {
      const owner = (line as { doctorId?: string }).doctorId;

      return (
        Boolean(owner) &&
        owner !== target.doctorId &&
        owner !== target.assignedExpertId
      );
    })
    .map((line) => String(line.appointmentTypeName || "service"));
  const to =
    [target.doctorName, target.expertName].filter(Boolean).join(" / ") ||
    "cabin";
  const where = target.cabinName ? ` · ${target.cabinName}` : "";

  return {
    allowed: true,
    patch,
    note: `[Rerouted to ${to}${where} by ${input.by} at ${input.now.toISOString()}]`,
    keptAttribution,
  };
}
