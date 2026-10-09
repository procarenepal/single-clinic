/**
 * What changes when money moves against a commission record.
 *
 * Ordinary commission: the clinic owes the clinician `commissionAmount`,
 * and each payment adds to `paidAmount` until it is covered.
 *
 * Clawback (see commissionClawbackCore): `commissionAmount` is NEGATIVE —
 * the clinician owes the clinic. "Paying" it is a recovery: cash handed
 * back, or netted against the clinician's next payout. The recovered
 * amount is tracked in the same `paidAmount` field with the same sign as
 * the commission, so `commissionAmount - paidAmount` is the remaining
 * obligation in both directions, and every sum that already nets
 * `paidAmount` across a clinician's records nets recoveries too.
 *
 * Callers pass the amount with either sign; it is normalised to the
 * record's own direction. A UI that collects "amount to settle" as a
 * positive number and a payroll run that passes
 * `commissionAmount - paidAmount` straight through both work.
 *
 * The clinician's `totalCommissionBalance` counter moves by
 * `balanceDelta`: down when the clinic pays out, up when it recovers.
 *
 * Pure. Throws on an amount that is zero or exceeds what is outstanding.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Half a paisa: below this, two money amounts are the same amount. */
const EPSILON = 0.005;

export interface CommissionPaymentInput {
  commissionAmount: number;
  paidAmount?: number | null;
}

export interface AppliedCommissionPayment {
  /** New cumulative paid (or recovered) amount, signed like the commission. */
  paidAmount: number;
  status: "paid" | "pending";
  /** Change to the clinician's totalCommissionBalance counter. */
  balanceDelta: number;
  /** The amount actually applied, signed like the commission. */
  applied: number;
  /** True when this record is a clawback (negative commission). */
  isClawback: boolean;
}

export function remainingCommission(current: CommissionPaymentInput): number {
  return round2(
    (Number(current.commissionAmount) || 0) - (Number(current.paidAmount) || 0),
  );
}

export function applyCommissionPayment(
  current: CommissionPaymentInput,
  requested: number,
): AppliedCommissionPayment {
  const amount = round2(Number(current.commissionAmount) || 0);
  const paid = round2(Number(current.paidAmount) || 0);
  const magnitude = round2(Math.abs(Number(requested) || 0));

  if (magnitude < EPSILON) {
    throw new Error("Payment amount must be greater than 0");
  }

  const isClawback = amount < 0;

  if (!isClawback && requested < 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  const remaining = round2(amount - paid);

  if (magnitude > Math.abs(remaining) + EPSILON) {
    throw new Error(
      "Payment amount cannot exceed remaining commission balance.",
    );
  }

  const applied = isClawback ? -magnitude : magnitude;
  const newPaid = round2(paid + applied);
  const settled = Math.abs(newPaid) + EPSILON >= Math.abs(amount);

  return {
    paidAmount: newPaid,
    status: settled ? "paid" : "pending",
    balanceDelta: -applied,
    applied,
    isClawback,
  };
}
