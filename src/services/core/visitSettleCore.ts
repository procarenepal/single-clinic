/**
 * What settling a visit does, planned before anything is written.
 *
 * Settle is the one moment a visit turns into an IRD invoice and money
 * moves against it. The old handler built the invoice, then zeroed the
 * visit's deposit record, THEN applied the wallet payment — so if the
 * wallet had been spent at the pharmacy in between, the invoice stood
 * unpaid, the visit's own record of the deposit was gone, and the board
 * said nothing was due. This module fixes the order and makes it a
 * test-enforced rule: the deposit record is never touched before the money
 * is applied.
 *
 * It also decides, from the lines alone, whether an invoice is filed at
 * all: a visit with nothing chargeable closes with no invoice instead of
 * the old fabricated NPR 500 "General Consultation".
 *
 * Pure: takes the visit, the patient's live wallet balance, the deposit
 * ledger rows and the clinic pricing; returns figures and an ordered list
 * of steps for the service to execute.
 */

import { calculateTaxBreakdown } from "@/utils/taxEngine";

import type { VisitPricingContext } from "./visitBillingCore";
import { legacyLineOrigin } from "./legacyVisitAdapters";

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPSILON = 0.005;

export interface SettleLine {
  id?: string;
  appointmentTypeId?: string;
  appointmentTypeName?: string;
  price: number;
  quantity?: number;
  amount?: number;
  isTaxable?: boolean;
  taxRate?: number;
  discountType?: "flat" | "percent";
  discountValue?: number;
  calculateCommission?: boolean;
  origin?: string;
  patientPackageId?: string;
  doctorId?: string;
  [key: string]: unknown;
}

export interface SettleVisitInput {
  id: string;
  appointmentTypeId?: string | null;
  pendingVisitItems?: SettleLine[];
  pendingVisitDiscountType?: "flat" | "percent" | null;
  pendingVisitDiscountValue?: number | null;
  depositedAmount?: number | null;
  depositTxnIds?: string[] | null;
  invoiceRevision?: number | null;
  patientPackageId?: string | null;
}

export interface DepositRow {
  id: string;
  amount: number;
  paymentMethod?: string | null;
}

export interface SettlePlanInput {
  visit: SettleVisitInput;
  /** The patient's wallet balance as read right now. */
  walletBalance: number;
  /** Ledger rows behind depositTxnIds, in order. Empty for legacy visits. */
  depositRows?: DepositRow[];
  /**
   * Wallet credit beyond this visit's own deposit that the user agreed to
   * apply (0 when not offered or declined).
   */
  standingCreditToApply?: number;
  pricing: VisitPricingContext;
  /** How the residual (if any) is being paid. */
  residualMethod?: string;
  residualReference?: string;
}

export type SettleStepKind =
  | "create-invoice"
  | "link-appointment"
  | "apply-deposit"
  | "apply-standing-credit"
  | "collect-residual"
  | "record-zero-payment"
  | "consume-session"
  | "close-appointment"
  | "close-unbilled";

export interface SettleStep {
  kind: SettleStepKind;
  amount?: number;
  method?: string;
  reference?: string;
}

export interface SettleTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  exemptAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface FundingMethod {
  method: string;
  amount: number;
}

export interface SettlePlan {
  /** Lines that go on the invoice (every pending line, free ones included). */
  lines: SettleLine[];
  totals: SettleTotals;
  depositHeld: number;
  depositToApply: number;
  standingCreditToApply: number;
  dueNow: number;
  /** Held deposit the invoice does not need; stays as wallet credit. */
  excessToWallet: number;
  /** Deposit the visit recorded but the wallet no longer holds. */
  depositShortfall: number;
  filesInvoice: boolean;
  /** A zero-total session visit that still files to drive commission. */
  zeroPayment: boolean;
  paymentMethodForInvoice: string;
  fundingMethods: FundingMethod[];
  idempotencyDiscriminator: string;
  steps: SettleStep[];
}

/** The key the backend matches a retry on. Revision 0 is byte-identical to the key in use today. */
export function settleIdempotencyKey(
  visitId: string,
  revision?: number | null,
): string {
  const rev = revision || 0;

  return rev === 0 ? `visit:${visitId}` : `visit:${visitId}:${rev}`;
}

function isSessionLine(
  line: SettleLine,
  appointmentTypeId?: string | null,
): boolean {
  return legacyLineOrigin(line, appointmentTypeId) === "session";
}

/**
 * Whether these lines produce an IRD invoice: anything chargeable, or a
 * commission-bearing session line (the zero-total invoice that drives
 * commission today — see the owner's question on prepaid sessions).
 */
export function filesInvoiceFor(
  lines: SettleLine[] | undefined,
  appointmentTypeId?: string | null,
): boolean {
  if (!lines || lines.length === 0) return false;

  return lines.some(
    (l) =>
      (l.price || 0) > EPSILON ||
      (isSessionLine(l, appointmentTypeId) && l.calculateCommission !== false),
  );
}

export function computeSettleTotals(
  lines: SettleLine[],
  visit: Pick<
    SettleVisitInput,
    "pendingVisitDiscountType" | "pendingVisitDiscountValue"
  >,
  pricing: VisitPricingContext,
): SettleTotals {
  const chargeable = lines.filter((l) => (l.price || 0) > EPSILON);

  if (chargeable.length === 0) {
    return {
      subtotal: 0,
      discountAmount: 0,
      taxableAmount: 0,
      exemptAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
    };
  }

  const taxPercentage = pricing.isTaxEnabled ? pricing.taxPercentage || 0 : 0;
  const calc = calculateTaxBreakdown({
    items: chargeable.map((l) => ({
      itemName: l.appointmentTypeName || "Service",
      quantity: l.quantity ?? 1,
      price: l.price,
      discountType: l.discountType,
      discountValue: l.discountValue,
      isTaxable: l.isTaxable === true,
      taxRate: l.taxRate,
    })),
    discountType: visit.pendingVisitDiscountType || "flat",
    discountValue: visit.pendingVisitDiscountValue || 0,
    defaultTaxPercentage: taxPercentage,
    isTaxEnabled:
      taxPercentage > 0 || chargeable.some((l) => l.isTaxable === true),
  });

  return {
    subtotal: calc.subtotal,
    discountAmount: calc.totalDiscountAmount,
    taxableAmount: calc.taxableAmount,
    exemptAmount: calc.exemptAmount,
    taxAmount: calc.taxAmount,
    totalAmount: calc.totalAmount,
  };
}

/**
 * How the invoice was funded, row by row, and the single method to file
 * when every rupee came the same way. The literal "wallet" is never a
 * filed method: a deposit was paid by cash/card/eSewa and that is what the
 * IRD "Method of Payment" must say.
 */
export function deriveFundingMethods(
  depositRows: DepositRow[] | undefined,
  depositToApply: number,
  standingCreditToApply: number,
  residual: { amount: number; method?: string },
): { fundingMethods: FundingMethod[]; paymentMethodForInvoice: string } {
  const funding: FundingMethod[] = [];
  let remaining = depositToApply;

  for (const row of depositRows || []) {
    if (remaining < EPSILON) break;
    const take = round2(Math.min(row.amount || 0, remaining));

    if (take < EPSILON) continue;
    funding.push({ method: row.paymentMethod || "wallet", amount: take });
    remaining = round2(remaining - take);
  }
  if (remaining >= EPSILON) {
    // Legacy visit with no ledger rows recorded, or rows that no longer
    // add up: the wallet is all we can truthfully say.
    funding.push({ method: "wallet", amount: remaining });
  }
  if (standingCreditToApply >= EPSILON) {
    funding.push({ method: "wallet", amount: round2(standingCreditToApply) });
  }
  if (residual.amount >= EPSILON) {
    funding.push({
      method: residual.method || "cash",
      amount: round2(residual.amount),
    });
  }

  // Merge same-method rows so "cash 500 + cash 300" files as cash 800.
  const merged: FundingMethod[] = [];

  for (const f of funding) {
    const same = merged.find((m) => m.method === f.method);

    if (same) same.amount = round2(same.amount + f.amount);
    else merged.push({ ...f });
  }

  const methods = new Set(merged.map((m) => m.method));
  const paymentMethodForInvoice =
    merged.length === 0
      ? residual.method || "cash"
      : methods.size === 1
        ? merged[0].method
        : "mixed";

  return { fundingMethods: merged, paymentMethodForInvoice };
}

/**
 * Plan a settle. The returned `steps` MUST be executed in order; the
 * deposit record (`depositedAmount`, `depositTxnIds`) is only cleared by
 * the final step, after every payment has landed.
 */
export function buildSettlePlan(input: SettlePlanInput): SettlePlan {
  const { visit, pricing } = input;
  const lines = visit.pendingVisitItems || [];
  const totals = computeSettleTotals(lines, visit, pricing);
  const total = totals.totalAmount;
  const depositHeld = round2(Math.max(0, visit.depositedAmount || 0));
  const walletBalance = round2(Math.max(0, input.walletBalance || 0));

  // Never deduct more than the wallet actually holds, nor more than the
  // invoice needs. A wallet spent elsewhere since check-in shows up as a
  // larger "due now", never as a failed transaction at the counter.
  const depositToApply = round2(Math.min(depositHeld, walletBalance, total));
  const depositShortfall = round2(
    Math.max(0, Math.min(depositHeld, total) - depositToApply),
  );
  const creditAvailable = round2(Math.max(0, walletBalance - depositToApply));
  const standingCreditToApply = round2(
    Math.min(
      Math.max(0, input.standingCreditToApply || 0),
      creditAvailable,
      Math.max(0, total - depositToApply),
    ),
  );
  const dueNow = round2(
    Math.max(0, total - depositToApply - standingCreditToApply),
  );
  const excessToWallet = round2(
    Math.max(0, Math.min(depositHeld, walletBalance) - total),
  );
  const filesInvoice = filesInvoiceFor(lines, visit.appointmentTypeId);
  const zeroPayment = filesInvoice && total < EPSILON;
  const { fundingMethods, paymentMethodForInvoice } = deriveFundingMethods(
    input.depositRows,
    depositToApply,
    standingCreditToApply,
    { amount: dueNow, method: input.residualMethod },
  );
  const idempotencyDiscriminator = settleIdempotencyKey(
    visit.id,
    visit.invoiceRevision,
  );

  const steps: SettleStep[] = [];

  if (filesInvoice) {
    steps.push({ kind: "create-invoice" });
    steps.push({ kind: "link-appointment" });
    if (depositToApply >= EPSILON) {
      steps.push({
        kind: "apply-deposit",
        amount: depositToApply,
        method: "wallet",
      });
    }
    if (standingCreditToApply >= EPSILON) {
      steps.push({
        kind: "apply-standing-credit",
        amount: standingCreditToApply,
        method: "wallet",
      });
    }
    if (dueNow >= EPSILON) {
      steps.push({
        kind: "collect-residual",
        amount: dueNow,
        method: input.residualMethod || "cash",
        ...(input.residualReference
          ? { reference: input.residualReference }
          : {}),
      });
    }
    if (zeroPayment) {
      steps.push({ kind: "record-zero-payment", amount: 0, method: "package" });
    }
  } else {
    steps.push({ kind: "close-unbilled" });
  }
  if (visit.patientPackageId) {
    steps.push({ kind: "consume-session" });
  }
  steps.push({ kind: "close-appointment" });

  return {
    lines,
    totals,
    depositHeld,
    depositToApply,
    standingCreditToApply,
    dueNow,
    excessToWallet,
    depositShortfall,
    filesInvoice,
    zeroPayment,
    paymentMethodForInvoice,
    fundingMethods,
    idempotencyDiscriminator,
    steps,
  };
}

/**
 * The label the TO SETTLE row shows, derived from the plan so the button
 * states the effect and the amount before anyone clicks it.
 */
export function settlePrimaryLabel(plan: SettlePlan): string {
  if (!plan.filesInvoice) return "Close Visit · nothing due";
  if (plan.zeroPayment) return "File session & Close";
  if (plan.dueNow < EPSILON) return "Settle · paid by deposit";

  return `Settle · NPR ${plan.dueNow.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due`;
}
