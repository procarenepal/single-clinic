/**
 * Applies one payment to an invoice — the arithmetic and the state
 * transition, and nothing else.
 *
 * This exists because both billing services computed the new paid amount
 * from the invoice they had read BEFORE opening a transaction, then wrote
 * that pre-computed value inside the transaction. The transaction re-read
 * the document, but only to check "already fully paid" — the amounts it
 * wrote were stale. Two concurrent partial payments (200 and 200 on a 565
 * invoice) both passed that check and the second silently overwrote the
 * first: exactly the lost update the transaction was there to prevent. A
 * refuter found it; it was true of appointment and pathology alike.
 *
 * The fix is structural: compute from the snapshot the transaction itself
 * read. Pulling the computation into a pure function makes that the only
 * way to call it, and makes the arithmetic testable without Firestore.
 *
 * Rounding to 2 decimals throughout matches the app's IRD monetary
 * convention (see taxEngine.ts). Without it, floating-point drift from
 * earlier arithmetic (e.g. 497.00000000000006) can leave a fully-paid
 * invoice stuck at "partial" while the displayed numbers look identical.
 */

export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface PayableInvoice {
  totalAmount: number;
  paidAmount?: number | null;
  balanceAmount?: number | null;
  discountAmount?: number | null;
  /** Appointment invoices split the discount; pathology ones don't carry this. */
  mainDiscountAmount?: number | null;
  paymentStatus?: PaymentStatus | string | null;
  paymentHistory?: PaymentEventLike[] | null;
}

export interface PaymentEventLike {
  id: string;
  amount: number;
  method: string;
  date: Date;
  recordedBy: string;
  reference?: string;
  notes?: string;
}

export interface PaymentInput {
  amount: number;
  method: string;
  /** Checkout-time discount applied together with this payment. */
  discountAmount?: number;
  reference?: string;
  notes?: string;
  recordedBy: string;
  eventId: string;
  now: Date;
  /**
   * Appointment invoices keep the checkout discount in its own field
   * (mainDiscountAmount) alongside the total; pathology invoices have no
   * such field. Explicit rather than inferred from the record, because a
   * raw Firestore document can simply lack the field and look identical
   * to one that never has it.
   */
  trackMainDiscount?: boolean;
}

export interface AppliedPayment {
  /**
   * Fields to write — only the ones a payment legitimately changes.
   * totalAmount / discountAmount / mainDiscountAmount are present only when
   * a checkout discount was applied: rewriting an unchanged total with a
   * re-rounded value would register as a change on a filed invoice, whose
   * amounts the security rules (correctly) refuse to let a client touch —
   * and a legacy total carrying float drift would then make the invoice
   * impossible to collect on.
   */
  updateData: {
    totalAmount?: number;
    discountAmount?: number;
    mainDiscountAmount?: number;
    paidAmount: number;
    balanceAmount: number;
    paymentStatus: PaymentStatus;
    paymentMethod: string;
    paymentDate: Date;
    paymentHistory: PaymentEventLike[];
    paymentReference?: string;
    paymentNotes?: string;
  };
  event: PaymentEventLike;
  previousStatus: PaymentStatus;
  /** True only on the unpaid/partial → paid edge — what commissions and follow-ups key on. */
  becamePaid: boolean;
}

export class AlreadyPaidError extends Error {
  constructor() {
    super("This invoice is already fully paid.");
    this.name = "AlreadyPaidError";
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const asStatus = (s: unknown): PaymentStatus =>
  s === "paid" || s === "partial" ? s : "unpaid";

/**
 * Pure. Throws AlreadyPaidError when a positive payment is applied to an
 * invoice already at "paid" — the caller's transaction turns that into a
 * clean refusal for the loser of a concurrent race.
 */
export function applyPayment(
  current: PayableInvoice,
  input: PaymentInput,
): AppliedPayment {
  const previousStatus = asStatus(current.paymentStatus);

  if (previousStatus === "paid" && input.amount > 0) {
    throw new AlreadyPaidError();
  }

  const discount = input.discountAmount || 0;
  const totalAmount = round2(Math.max(0, (current.totalAmount || 0) - discount));
  const discountAmount = round2((current.discountAmount || 0) + discount);
  const paidAmount = round2((current.paidAmount || 0) + input.amount);
  const balanceAmount = round2(Math.max(0, totalAmount - paidAmount));

  let paymentStatus: PaymentStatus = "unpaid";

  if (paidAmount >= totalAmount) paymentStatus = "paid";
  else if (paidAmount > 0) paymentStatus = "partial";

  const event: PaymentEventLike = {
    id: input.eventId,
    amount: input.amount,
    method: input.method,
    date: input.now,
    recordedBy: input.recordedBy,
  };

  const reference = input.reference?.trim();
  const notes = input.notes?.trim();

  if (reference) event.reference = reference;
  if (notes) event.notes = notes;

  const updateData: AppliedPayment["updateData"] = {
    paidAmount,
    balanceAmount,
    paymentStatus,
    paymentMethod: input.method,
    paymentDate: input.now,
    paymentHistory: [...(current.paymentHistory || []), event],
  };

  // Only a checkout discount changes the invoice's amounts; a plain payment
  // leaves them exactly as stored. See the note on AppliedPayment.updateData.
  if (discount > 0) {
    updateData.totalAmount = totalAmount;
    updateData.discountAmount = discountAmount;

    if (input.trackMainDiscount) {
      updateData.mainDiscountAmount = round2((current.mainDiscountAmount || 0) + discount);
    }
  }

  if (reference) updateData.paymentReference = reference;
  if (notes) updateData.paymentNotes = notes;

  return {
    updateData,
    event,
    previousStatus,
    becamePaid: paymentStatus === "paid" && previousStatus !== "paid",
  };
}
