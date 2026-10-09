/**
 * What to write when a commission that has ALREADY BEEN PAID OUT is
 * reversed — because the invoice it was earned on was cancelled or
 * credit-noted.
 *
 * Reversal used to flip the commission to "cancelled" and reduce the
 * clinician's earned total, and stop there. The money had left the
 * clinic; nothing recorded that it was owed back. The cancelled record
 * still showed its paidAmount, so a careful reader could infer it, but no
 * report summed it as a receivable and the next payout did not net it.
 * The clinic simply lost it.
 *
 * A clawback is a NEW commission record in the same collection, for the
 * negative of what was paid, status "pending", naming the original. The
 * next payout run nets it against the clinician's other pending
 * commissions; the clinician's balance shows the amount owed back until
 * then; the commission list shows an entry that says why. The original
 * record is left as it is — "cancelled, paidAmount X" — so the trail of
 * what happened stays intact. Settling a clawback (cash returned, or
 * netted against a payout) goes through the ordinary pay path; see
 * commissionPaymentCore.
 *
 * Pure: takes the original's raw document data and returns the document
 * to write, or null when nothing was paid and so nothing is owed.
 */

/** Fields that describe the ORIGINAL's own lifecycle, never copied onto a clawback. */
export const CLAWBACK_EXCLUDED_FIELDS = new Set([
  "id",
  "status",
  "commissionAmount",
  "paidAmount",
  "paymentMethod",
  "paymentReference",
  "paymentNotes",
  "paidDate",
  "paidBy",
  "createdAt",
  "updatedAt",
  "createdBy",
  "clawbackOf",
  "clawbackReason",
]);

export interface ClawbackRecord extends Record<string, unknown> {
  commissionAmount: number;
  status: "pending";
  clawbackOf: string;
  clawbackReason: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Half a paisa: below this, two money amounts are the same amount. */
const EPSILON = 0.005;

/**
 * @param original   the paid-out commission's raw document data
 * @param originalId its document id
 * @param actor      who is reversing it (stored as createdBy)
 * @param now        timestamp for the new record
 * @param reason     human-readable reason stored on the clawback
 * @param owedBack   how much of the paid-out amount is owed back; defaults
 *                   to all of it (a full reversal). A partial reversal
 *                   passes just the reversed share.
 */
export function buildClawbackRecord(
  original: object,
  originalId: string,
  actor: string,
  now: Date,
  reason: string = "Invoice reversed after this commission was paid out",
  owedBack?: number,
): ClawbackRecord | null {
  const source = original as Record<string, unknown>;
  const paid = round2(
    owedBack !== undefined ? owedBack : Number(source.paidAmount) || 0,
  );

  if (paid < EPSILON) return null;

  const identity: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!CLAWBACK_EXCLUDED_FIELDS.has(key) && value !== undefined) {
      identity[key] = value;
    }
  }

  return {
    ...identity,
    commissionAmount: -paid,
    status: "pending",
    clawbackOf: originalId,
    clawbackReason: reason,
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
  };
}

/**
 * How the clinician's running counters move when a commission is
 * cancelled. `earned` always drops by the whole commission. `balance` —
 * what the clinic still owes the clinician — drops by the whole amount
 * too: the unpaid part is simply no longer owed, and the paid part is now
 * owed BACK, which the clawback record carries. The old code dropped
 * balance only by the unpaid part, so a paid-then-cancelled commission
 * left the balance as if the clinician were still square.
 */
export function cancellationCounterDeltas(original: {
  commissionAmount?: number | null;
  paidAmount?: number | null;
}): { earned: number; balance: number } {
  const amount = round2(Number(original.commissionAmount) || 0);

  return { earned: -amount, balance: -amount };
}

export interface PartialReversalPlan {
  /** Comes off the record's unpaid part: no longer owed. */
  actualReduction: number;
  /** The reversed share that had already been paid out: owed back. */
  overpaid: number;
  /** The record after the reversal. */
  newCommissionAmount: number;
  newPaidAmount: number;
  newStatus: "pending" | "paid" | "cancelled";
  earnedDelta: number;
  balanceDelta: number;
}

/**
 * A partial reversal (a credit note for part of an invoice, a package
 * refund for unused sessions) takes `reduceBy` off a commission.
 *
 * The record's commissionAmount drops by the WHOLE reversed amount — that
 * is what the clinician has now earned on this invoice. The unpaid part
 * absorbs as much of the reversal as it can; whatever is left of
 * `reduceBy` had already been paid out, and that paid share MOVES off the
 * record's paidAmount onto a clawback (buildClawbackRecord with
 * `owedBack` = overpaid). So after the reversal the record reads
 * "earned X, paid X" for the part of the invoice that still stands, and
 * the clawback reads "paid out on the reversed part, owed back".
 *
 * Why move paidAmount rather than leave it: if the record kept the full
 * paidAmount, a later FULL cancel of the same invoice would see it again
 * and claw it back a second time, and every records-based "earned" sum
 * would disagree with the entity's counter by the reversed share. With
 * the move, paidAmount <= commissionAmount stays true, a later full
 * cancel claws back exactly what is still on the record, and
 *   totalCommissionEarned  == sum of live, non-clawback commissionAmount
 *   totalCommissionBalance == sum of live (commissionAmount - paidAmount)
 * hold on every path. The money trail is intact: the record's paidAmount
 * plus the magnitudes of the clawbacks naming it is what was paid out.
 *
 * Counters move by the whole reversed amount: the unpaid part is no longer
 * owed, the paid part is now owed back.
 *
 * Returns null when there is nothing to do.
 */
export function partialReversalPlan(
  original: {
    commissionAmount?: number | null;
    paidAmount?: number | null;
    status?: string;
  },
  reduceBy: number,
): PartialReversalPlan | null {
  const amount = round2(Number(original.commissionAmount) || 0);
  const paid = round2(Number(original.paidAmount) || 0);
  const requested = round2(Number(reduceBy) || 0);

  if (requested < EPSILON || amount < EPSILON) return null;
  if (original.status === "cancelled") return null;

  const reversed = Math.min(requested, amount);
  const outstanding = Math.max(0, round2(amount - paid));
  const actualReduction = round2(Math.min(reversed, outstanding));
  const overpaid = round2(reversed - actualReduction);
  const newCommissionAmount = round2(amount - reversed);
  const newPaidAmount = round2(Math.max(0, paid - overpaid));

  let newStatus: PartialReversalPlan["newStatus"];

  if (newCommissionAmount < EPSILON) {
    // Everything reversed (only reachable through rounding): nothing is
    // earned or owed on this record any more.
    newStatus = "cancelled";
  } else if (
    newPaidAmount >= EPSILON &&
    newPaidAmount + EPSILON >= newCommissionAmount
  ) {
    newStatus = "paid";
  } else {
    newStatus = "pending";
  }

  return {
    actualReduction,
    overpaid,
    newCommissionAmount,
    newPaidAmount,
    newStatus,
    earnedDelta: -reversed,
    balanceDelta: -reversed,
  };
}
