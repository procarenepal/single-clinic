/**
 * How a list of commission records adds up, now that a list can contain
 * clawbacks (see commissionClawbackCore).
 *
 * A clawback is a NEGATIVE pending commission naming a paid-out commission
 * whose invoice was reversed. It is a receivable — money the clinician owes
 * the clinic — not negative earnings. The original record is "cancelled"
 * and already excluded from every "earned" sum, so counting the clawback
 * there too would subtract the reversal twice; "earned" must therefore
 * skip clawbacks. What is OUTSTANDING, on the other hand, must include
 * them: that is exactly where the debt nets against other pending
 * commissions, and it is what the entity's totalCommissionBalance counter
 * tracks.
 *
 * These are the invariants the running counters keep, expressed over the
 * records themselves:
 *   totalCommissionEarned  == earned
 *   totalCommissionBalance == outstanding
 */

export interface CommissionLike {
  commissionAmount: number;
  paidAmount?: number | null;
  status: string;
  clawbackOf?: string;
}

export interface CommissionSummary {
  /** Commission genuinely earned: live, non-clawback amounts. */
  earned: number;
  /** Paid out on those earned commissions (clawback recoveries excluded). */
  paidOut: number;
  /** Still owed by the clinic, net of what is owed back. May be negative. */
  outstanding: number;
  /** Owed back by the clinician and not yet recovered (0 or positive). */
  owedBack: number;
  /** Live, non-clawback records — "how many invoices earned commission". */
  count: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function isClawback(c: Pick<CommissionLike, "clawbackOf">): boolean {
  return Boolean(c.clawbackOf);
}

/** What this record contributes to "earned": nothing if it is a clawback. */
export function earnedAmount(
  c: Pick<CommissionLike, "commissionAmount" | "clawbackOf">,
): number {
  return isClawback(c) ? 0 : Number(c.commissionAmount) || 0;
}

/** What this record contributes to "paid out": nothing if it is a clawback. */
export function paidOutAmount(
  c: Pick<CommissionLike, "paidAmount" | "clawbackOf">,
): number {
  return isClawback(c) ? 0 : Number(c.paidAmount) || 0;
}

/** Still outstanding on this record, in either direction. */
export function outstandingAmount(
  c: Pick<CommissionLike, "commissionAmount" | "paidAmount">,
): number {
  return (Number(c.commissionAmount) || 0) - (Number(c.paidAmount) || 0);
}

export function summarizeCommissions(
  records: readonly CommissionLike[],
): CommissionSummary {
  let earned = 0;
  let paidOut = 0;
  let outstanding = 0;
  let owedBack = 0;
  let count = 0;

  for (const c of records) {
    if (c.status === "cancelled") continue;

    const remaining = outstandingAmount(c);

    outstanding += remaining;

    if (isClawback(c)) {
      owedBack += -remaining;
    } else {
      earned += earnedAmount(c);
      paidOut += paidOutAmount(c);
      count += 1;
    }
  }

  return {
    earned: round2(earned),
    paidOut: round2(paidOut),
    outstanding: round2(outstanding),
    owedBack: round2(Math.max(0, owedBack)),
    count,
  };
}
