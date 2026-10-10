/**
 * Pure decision logic for a front-office visit's billing, extracted out of
 * front-office-desk.tsx so it can actually be tested.
 *
 * Everything here is deliberately free of React, Firestore and clock/locale
 * surprises: callers pass data in and get a decision back. The component is
 * then a thin shell that fetches, calls these, and writes.
 *
 * Why this module exists: the visit billing logic lived inside a 6,000-line
 * component, so the only "tests" covering it re-implemented it inline and
 * therefore passed no matter what the real code did.
 */

import { calculateTaxBreakdown } from "@/utils/taxEngine";

import { isLineCollectableAtCheckIn } from "./legacyVisitAdapters";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface VisitBillingItem {
  price: number;
  amount: number;
  quantity?: number;
  appointmentTypeName?: string;
  discountType?: "flat" | "percent";
  discountValue?: number;
  isTaxable?: boolean;
  taxRate?: number;
  [key: string]: unknown;
}

/**
 * Tax/discount settings for a visit, so "what does this visit owe" can be
 * answered the same way the invoice will actually be calculated.
 */
export interface VisitPricingContext {
  discountType?: "flat" | "percent";
  discountValue?: number;
  /** Clinic default tax %, applied where an item doesn't override it. */
  taxPercentage?: number;
  /** The clinic-wide tax master switch. */
  isTaxEnabled?: boolean;
}

/**
 * What this visit will actually be invoiced — the same figure checkout
 * produces, including tax and any visit discount.
 *
 * This exists because the deposit taken at check-in was computed from raw
 * line amounts (pre-tax) while the invoice at checkout is tax-inclusive, so
 * the front desk collected the base price and left exactly the tax
 * outstanding on EVERY visit. That shortfall then kept every invoice at
 * "partial" forever, which in turn meant commission and the patient
 * follow-up — both triggered only on reaching fully-paid — never fired.
 */
export function computeVisitPayableTotal(
  items: VisitBillingItem[] | undefined,
  pricing: VisitPricingContext = {},
): number {
  if (!items || items.length === 0) return 0;

  const chargeable = items.filter((item) => item.price > 0);

  if (chargeable.length === 0) return 0;

  const taxPercentage = pricing.isTaxEnabled ? pricing.taxPercentage || 0 : 0;

  const result = calculateTaxBreakdown({
    items: chargeable.map((item) => ({
      itemName: item.appointmentTypeName || "Service",
      quantity: item.quantity ?? 1,
      price: item.price,
      discountType: item.discountType,
      discountValue: item.discountValue,
      isTaxable: item.isTaxable === true,
      taxRate: item.taxRate,
    })),
    discountType: pricing.discountType || "percent",
    discountValue: pricing.discountValue || 0,
    defaultTaxPercentage: taxPercentage,
    // Mirrors appointmentBillingService: a category-taxable item is taxed
    // even when the invoice-level toggle is off.
    isTaxEnabled:
      taxPercentage > 0 || chargeable.some((i) => i.isTaxable === true),
  });

  return result.totalAmount;
}

export interface VisitReferral {
  type: "referral-partner" | "doctor" | "expert" | "staff";
  id: string;
  name: string;
  commissionPercentage: number;
  commissionAmount: number;
  [key: string]: unknown;
}

/**
 * What a visit currently owes, counting only chargeable lines.
 *
 * Package-session lines are commission-only: they carry price 0 and a
 * nonzero `amount` (the per-session value used as the commission base), so
 * they must never add to what the patient owes.
 */
export function computeVisitOwed(
  items: VisitBillingItem[] | undefined,
): number {
  if (!items || items.length === 0) return 0;

  return items.reduce(
    (sum, item) => sum + (item.price > 0 ? item.amount || 0 : 0),
    0,
  );
}

export type VisitGateScope = "checkin" | "all";

export interface VisitPaymentGate {
  owed: number;
  deposited: number;
  /** Standing wallet credit the caller allowed to count toward what is owed. */
  standingCredit: number;
  scope: VisitGateScope;
  /** True when money is still owed for this visit before it may proceed. */
  isDue: boolean;
  /** How much to collect to close the gap; never negative. */
  dueAmount: number;
}

/**
 * The single definition of "has this visit been paid for so far" — used by
 * every queue gate so the front desk, the doctor's queue and the billing
 * counter cannot disagree about whether a patient may proceed.
 *
 * Pricing is REQUIRED: a caller that omitted it used to get the pre-tax
 * line total, so the queue admitted a patient the desk still showed as
 * owing the VAT. Scope says which lines count: "checkin" is only the lines
 * collected before the clinician (what gates admission to a cabin), "all"
 * is everything on the visit (what gates closing it).
 */
export function getVisitPaymentGate(
  visit: {
    appointmentTypeId?: string | null;
    pendingVisitItems?: VisitBillingItem[];
    depositedAmount?: number;
    pendingVisitDiscountType?: "flat" | "percent" | null;
    pendingVisitDiscountValue?: number | null;
  },
  pricing: VisitPricingContext,
  scope: VisitGateScope = "all",
  opts: { standingCredit?: number } = {},
): VisitPaymentGate {
  const all = visit.pendingVisitItems || [];
  const inScope =
    scope === "all"
      ? all
      : all.filter((item) =>
          isLineCollectableAtCheckIn(item as never, visit.appointmentTypeId),
        );
  const owed = round2(
    computeVisitPayableTotal(inScope, {
      ...pricing,
      discountType: visit.pendingVisitDiscountType || "flat",
      discountValue: visit.pendingVisitDiscountValue || 0,
    }),
  );
  const deposited = round2(visit.depositedAmount || 0);
  const standingCredit = round2(Math.max(0, opts.standingCredit || 0));
  const dueAmount = round2(Math.max(0, owed - deposited - standingCredit));

  return {
    owed,
    deposited,
    standingCredit,
    scope,
    isDue: dueAmount >= 0.005,
    dueAmount,
  };
}

/**
 * Combines referral commissions accrued mid-visit (e.g. the doctor who
 * recommended a procedure) with those resolved at checkout from the
 * patient's standing referrers.
 *
 * The two are computed on OVERLAPPING bases: a mid-visit entry is computed
 * on the procedure fee, while a checkout entry is computed on the whole
 * invoice — which already includes that same procedure fee. So when the
 * same person appears in both, summing them pays that person twice for one
 * procedure. This keeps the larger single entitlement instead of stacking
 * them, and never mutates either input array.
 *
 * If the business genuinely wants a recommender's bonus to stack on top of
 * a standing referral cut, that is a deliberate pricing decision and the
 * two should be computed on disjoint bases rather than summed here.
 */
export function mergeVisitReferrals(
  accruedDuringVisit: VisitReferral[] | undefined,
  resolvedAtCheckout: VisitReferral[] | undefined,
): VisitReferral[] {
  const merged: VisitReferral[] = (accruedDuringVisit || []).map((r) => ({
    ...r,
  }));

  for (const incoming of resolvedAtCheckout || []) {
    const existing = merged.find(
      (r) => r.id === incoming.id && r.type === incoming.type,
    );

    if (!existing) {
      merged.push({ ...incoming });
      continue;
    }

    if (incoming.commissionAmount > existing.commissionAmount) {
      existing.commissionAmount = incoming.commissionAmount;
      existing.commissionPercentage = incoming.commissionPercentage;
    }
  }

  return merged;
}

/**
 * Today's date as YYYY-MM-DD in the LOCAL timezone.
 *
 * `new Date().toISOString().split("T")[0]` returns the UTC date, which in
 * Nepal (UTC+5:45) is yesterday's date between 00:00 and 05:44 local — so a
 * patient checked in during that window was dated to the previous day and
 * never appeared on the current day's board.
 */
export function todayLocalDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * The invoice-level discount to apply at checkout, carried forward from
 * wherever staff entered it during the visit. An unset value must mean "no
 * discount", never "undefined" flowing into the totals maths. The default
 * type is "flat", the same default createBilling applies when the type is
 * missing, so a visit and its invoice never disagree.
 */
export function resolveVisitDiscount(visit: {
  pendingVisitDiscountType?: "flat" | "percent" | null;
  pendingVisitDiscountValue?: number | null;
}): { discountType: "flat" | "percent"; discountValue: number } {
  return {
    discountType: visit.pendingVisitDiscountType || "flat",
    discountValue: visit.pendingVisitDiscountValue || 0,
  };
}
