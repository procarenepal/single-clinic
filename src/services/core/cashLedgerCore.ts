/**
 * Reconciles what the clinic actually collected on a given day.
 *
 * Daily figures used to be derived purely from invoice payment history.
 * That was right when every payment landed on an invoice the moment it was
 * taken — but front office now collects cash into the patient's wallet at
 * check-in and only applies it to an invoice at checkout. The consequences
 * were that cash taken on Monday for a visit that checked out on Tuesday
 * was reported on Tuesday, and cash taken for a visit that never checked
 * out (no-show, patient left) was never reported at all.
 *
 * The rule this module encodes:
 *
 *   Cash is recognised when it physically arrives — i.e. at the deposit.
 *   An invoice payment funded FROM the wallet is an internal transfer of
 *   money already recognised, not a second collection.
 *
 * So: collected = wallet deposits + invoice payments not funded by wallet.
 * Counting both sides would double every front-office visit.
 */

export const WALLET_METHOD = "wallet";

export interface WalletDepositEvent {
  amount: number;
  /** How the money physically arrived: cash, card, mobile banking… */
  paymentMethod?: string | null;
  patientId?: string;
}

export interface InvoicePaymentEvent {
  amount: number;
  /** "wallet" means funded from an existing deposit, not newly collected. */
  method?: string | null;
  invoiceId?: string;
}

export interface CashCollectionSummary {
  /** Money that physically arrived today and went into a wallet. */
  depositsCollected: number;
  /** Money that physically arrived today directly against an invoice. */
  directInvoicePayments: number;
  /**
   * Invoice payments funded from wallet balance. Deliberately excluded
   * from the total — it is already counted as a deposit, on whichever day
   * it was actually taken. Surfaced so the two sides can be reconciled.
   */
  walletApplied: number;
  /** What the drawer should actually be up by today. */
  totalCollected: number;
  /** Breakdown of totalCollected by how the money arrived. */
  byMethod: Record<string, number>;
}

const addTo = (bucket: Record<string, number>, key: string, amount: number) => {
  bucket[key] = (bucket[key] || 0) + amount;
};

export function summariseCashCollections(input: {
  walletDeposits?: WalletDepositEvent[];
  invoicePayments?: InvoicePaymentEvent[];
}): CashCollectionSummary {
  const byMethod: Record<string, number> = {};
  let depositsCollected = 0;
  let directInvoicePayments = 0;
  let walletApplied = 0;

  for (const deposit of input.walletDeposits || []) {
    const amount = deposit.amount || 0;

    if (amount <= 0) continue;

    depositsCollected += amount;
    addTo(byMethod, (deposit.paymentMethod || "unknown").toLowerCase(), amount);
  }

  for (const payment of input.invoicePayments || []) {
    const amount = payment.amount || 0;

    if (amount <= 0) continue;

    const method = (payment.method || "unknown").toLowerCase();

    if (method === WALLET_METHOD) {
      walletApplied += amount;
      continue;
    }

    directInvoicePayments += amount;
    addTo(byMethod, method, amount);
  }

  return {
    depositsCollected,
    directInvoicePayments,
    walletApplied,
    totalCollected: depositsCollected + directInvoicePayments,
    byMethod,
  };
}

export interface RevenueByKind {
  clinical: number;
  pathology: number;
  pharmacy: number;
}

/**
 * Splits one invoice's revenue across clinical / pathology / pharmacy by
 * what was actually sold on it.
 *
 * Revenue used to be categorised by which collection an invoice came from.
 * That worked while each module raised its own bill, but the billing
 * counter now puts a consultation, lab tests and medicines on ONE invoice
 * under one IRD number — and that invoice lives in the appointment
 * collection, so every medicine and lab test sold through it was reported
 * as clinical revenue while Pharmacy and Pathology showed zero.
 *
 * The invoice total (not the raw line sum) is allocated in proportion to
 * each kind's share, so invoice-level tax and discount land in the right
 * buckets instead of being dropped or double counted.
 */
export function splitRevenueByLineKind(
  items: Array<{ amount?: number; lineKind?: string | null }> | undefined,
  totalAmount: number,
): RevenueByKind {
  const empty: RevenueByKind = { clinical: 0, pathology: 0, pharmacy: 0 };

  if (!items || items.length === 0) {
    return { ...empty, clinical: totalAmount };
  }

  const base: RevenueByKind = { ...empty };

  for (const item of items) {
    const amount = item.amount || 0;

    // Lines written before lineKind existed are all services.
    if (item.lineKind === "lab") base.pathology += amount;
    else if (item.lineKind === "medicine") base.pharmacy += amount;
    else base.clinical += amount;
  }

  const lineTotal = base.clinical + base.pathology + base.pharmacy;

  if (lineTotal <= 0) {
    return { ...empty, clinical: totalAmount };
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const clinical = round2((base.clinical / lineTotal) * totalAmount);
  const pathology = round2((base.pathology / lineTotal) * totalAmount);

  return {
    clinical,
    pathology,
    // Absorbs any rounding remainder so the three always sum to the
    // invoice total exactly.
    pharmacy: round2(totalAmount - clinical - pathology),
  };
}

/**
 * Scales one of an invoice's money figures — amount paid, balance due — into
 * a single revenue kind.
 *
 * A payment lands on the invoice as a whole, not on individual lines, so
 * there is no record of which part of a mixed bill a given rupee settled.
 * Attributing it in the same proportion as that kind's share of the invoice
 * is the only defensible split, and it keeps each card's "Collected" figure
 * consistent with the revenue figure printed above it.
 */
export function shareOfInvoiceForKind(
  totalAmount: number,
  kindAmount: number,
  amount: number,
): number {
  if (totalAmount <= 0 || amount <= 0 || kindAmount <= 0) return 0;

  return (amount * kindAmount) / totalAmount;
}

/**
 * How much of an invoice's collected money came out of the patient's
 * wallet — i.e. how much a cancellation must put back there.
 *
 * The invoice's top-level `paymentMethod` is overwritten by every payment
 * with that payment's method, so after a mixed payment it names only the
 * LAST one. The front-office model produces mixed payments as its normal
 * shape — NPR 500 from the wallet deposit, NPR 65 cash for the tax — and
 * the old refund logic keyed on that single field and refunded the whole
 * paidAmount. Wallet-then-cash ended as "cash": cancel refunded nothing
 * and the patient lost the deposit. Cash-then-wallet ended as "wallet":
 * cancel pushed 565 into the wallet, turning 65 of cash into store credit.
 *
 * paymentHistory records each payment with its own method; summing the
 * wallet-funded entries is the only correct answer. The legacy fallback
 * exists for invoices written before paymentHistory was kept, and is
 * capped at paidAmount so a doubled history line can never refund more
 * than was ever collected.
 */
export function walletRefundableAmount(invoice: {
  paidAmount?: number | null;
  paymentMethod?: string | null;
  paymentHistory?: Array<{ amount?: number | null; method?: string | null }> | null;
}): number {
  const paid = Math.max(0, invoice.paidAmount || 0);

  if (paid <= 0) return 0;

  const history = invoice.paymentHistory || [];

  if (history.length === 0) {
    // Pre-history invoice: the single method is all we know.
    return (invoice.paymentMethod || "").toLowerCase() === WALLET_METHOD
      ? paid
      : 0;
  }

  let fromWallet = 0;

  for (const event of history) {
    const amount = event.amount || 0;

    if (amount <= 0) continue;
    if ((event.method || "").toLowerCase() === WALLET_METHOD) fromWallet += amount;
  }

  return Math.min(fromWallet, paid);
}

/**
 * Money sitting in wallets that has not yet been turned into an invoice.
 *
 * This is the clinic's real exposure from the deposit model: cash taken for
 * visits that never completed. It had no representation anywhere — a
 * no-show after a deposit left money visible only on that one patient's
 * wallet tab.
 */
export function computeUnappliedDeposits(
  walletBalancesByPatient: Array<{ patientId: string; walletBalance?: number }>,
): { totalHeld: number; patientsHolding: number } {
  let totalHeld = 0;
  let patientsHolding = 0;

  for (const patient of walletBalancesByPatient) {
    const balance = patient.walletBalance || 0;

    if (balance > 0) {
      totalHeld += balance;
      patientsHolding += 1;
    }
  }

  return { totalHeld, patientsHolding };
}
