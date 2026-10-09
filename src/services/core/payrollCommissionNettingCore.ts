/**
 * How a staff member's pending commission rows are netted into a salary
 * payout.
 *
 * Rows can be positive (commission the clinic owes) or negative clawbacks
 * (commission paid out on an invoice that was later reversed, owed back —
 * see commissionClawbackCore). The payout includes the NET: positives add
 * to the salary, clawbacks are deducted from it.
 *
 * A deduction can never exceed what is being paid out: salary is the only
 * thing it can be taken from. When the clawbacks exceed the positives plus
 * the whole payout, the payout goes to zero, the clawbacks are recovered
 * only as far as the money actually withheld, and the rest stays pending
 * for the next payroll or a cash recovery. Without this cap a large
 * clawback produced a negative "paid" salary bill and stamped every
 * clawback recovered although only part of it had been withheld.
 *
 * Pure. The caller applies `settlements` through payCommission (which
 * accepts a signed amount for a clawback) and records `netIncluded` on
 * the salary bill.
 */

export interface PendingCommissionRow {
  id: string;
  commissionAmount: number;
  paidAmount?: number | null;
  status: string;
}

export interface CommissionSettlement {
  id: string;
  /** Signed: positive pays commission out, negative recovers a clawback. */
  amount: number;
}

export interface SalaryNettingPlan {
  /** Sum of every pending row's remainder (what the counter should say). */
  netBalance: number;
  /** What this payout actually includes: positive adds, negative deducts. */
  netIncluded: number;
  /** Owed back that could not be withheld from this payout. */
  carriedForward: number;
  settlements: CommissionSettlement[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPSILON = 0.005;

/**
 * @param rows        the staff member's commission rows (any status; only
 *                    pending rows with a non-zero remainder take part)
 * @param grossPayout salary plus incentives and bonuses minus tax and other
 *                    deductions — the most that can be withheld
 */
export function planSalaryCommissionNetting(
  rows: readonly PendingCommissionRow[],
  grossPayout: number,
): SalaryNettingPlan {
  const live = rows
    .map((r) => ({
      id: r.id,
      remaining: round2(
        (Number(r.commissionAmount) || 0) - (Number(r.paidAmount) || 0),
      ),
      status: r.status,
    }))
    .filter((r) => r.status === "pending" && Math.abs(r.remaining) >= EPSILON);

  const positives = live.filter((r) => r.remaining > 0);
  const clawbacks = live.filter((r) => r.remaining < 0);
  const owed = round2(positives.reduce((s, r) => s + r.remaining, 0));
  const owedBack = round2(clawbacks.reduce((s, r) => s - r.remaining, 0));
  const netBalance = round2(owed - owedBack);
  const cap = Math.max(0, round2(Number(grossPayout) || 0));

  // Every positive row is paid in full — that money is what the clawbacks
  // are netted against first.
  const settlements: CommissionSettlement[] = positives.map((r) => ({
    id: r.id,
    amount: r.remaining,
  }));

  // Clawbacks are recovered from the positives, then from the payout
  // itself, but never past what the payout can bear.
  let recoverable = round2(Math.min(owedBack, owed + cap));
  let recovered = 0;

  for (const r of clawbacks) {
    if (recoverable < EPSILON) break;
    const take = round2(Math.min(-r.remaining, recoverable));

    settlements.push({ id: r.id, amount: -take });
    recoverable = round2(recoverable - take);
    recovered = round2(recovered + take);
  }

  return {
    netBalance,
    netIncluded: round2(owed - recovered),
    carriedForward: round2(owedBack - recovered),
    settlements,
  };
}
