import { InvoiceResponseDto } from "../api/billingApi";

/**
 * Shared lock/compliance-guard logic for appointment and pathology billing.
 * Both domains independently implement the same IRD compliance rule
 * ("once an invoice is finalized/IRD-synced, financial fields are frozen and
 * everything else is append-only/allowlisted") — this was the exact logic
 * that needed the same bugfix applied twice, separately, in both files
 * (the clause-ट "any data" guard extension). Centralizing it here means a
 * future fix only needs to happen once.
 *
 * Deliberately NOT extended to pharmacy — pharmacy has no draft/finalized
 * status concept (sync state alone gates its lock), and is a different,
 * correct design (see the billing-unification plan).
 */

export interface LockableRecord {
  irdSynced?: boolean;
  status?: string;
}

/**
 * Whether a billing record is IRD-locked. `extraLockedStatuses` lets each
 * domain preserve its own exact locking rule — e.g. pathology additionally
 * locks on `status === "paid"`, which appointment billing does not.
 */
export function isRecordLocked(
  record: LockableRecord,
  extraLockedStatuses: string[] = [],
): boolean {
  return Boolean(
    record.irdSynced ||
      record.status === "finalized" ||
      (record.status !== undefined && extraLockedStatuses.includes(record.status)),
  );
}

export interface FinancialGuardConfig {
  /** Numeric field names whose change counts as "altering financials". */
  financialKeys: string[];
  /** Field names always permitted to change post-finalization (system-driven bookkeeping). */
  allowlist: string[];
  /** Exact error message when a financial field changes on a locked record. */
  financialErrorMessage: string;
  /** Exact error message when `notes` is rewritten (not appended to) on a locked record. */
  notesErrorMessage: string;
  /** Exact error message when any other non-allowlisted field changes on a locked record. */
  dataErrorMessage: string;
}

/**
 * The full clause-ट compliance guard: throws if a locked record's financial
 * fields, items, notes (non-append), or any other non-allowlisted field is
 * being changed. No-op (and returns false) if the record isn't locked.
 * Returns whether financial fields were altered, in case the caller wants
 * that information when the record ISN'T locked (e.g. for logging).
 */
export function assertFinancialFieldsUnlocked(
  existing: Record<string, any>,
  billingData: Record<string, any>,
  locked: boolean,
  config: FinancialGuardConfig,
): boolean {
  const simpleValuesChanged = config.financialKeys.some((k) => {
    if (k in billingData) {
      return (billingData[k] || 0) !== (existing[k] || 0);
    }
    return false;
  });

  const itemsChanged =
    "items" in billingData &&
    JSON.stringify(billingData.items) !== JSON.stringify(existing.items);

  const isAlteringFinancials = simpleValuesChanged || itemsChanged;

  if (!locked) {
    return isAlteringFinancials;
  }

  if (isAlteringFinancials) {
    throw new Error(config.financialErrorMessage);
  }

  for (const key of Object.keys(billingData)) {
    if (config.financialKeys.includes(key) || key === "items") continue;
    if (config.allowlist.includes(key)) continue;

    if (key === "notes") {
      const oldNotes = existing.notes || "";
      const newNotes = billingData.notes || "";

      if (newNotes === oldNotes || newNotes.startsWith(oldNotes)) continue;

      throw new Error(config.notesErrorMessage);
    }

    const oldVal = existing[key];
    const newVal = billingData[key];
    const changed =
      typeof newVal === "object" && newVal !== null
        ? JSON.stringify(newVal) !== JSON.stringify(oldVal)
        : newVal !== oldVal;

    if (changed) {
      throw new Error(config.dataErrorMessage);
    }
  }

  return isAlteringFinancials;
}

/* ------------------------------------------------------------------ *
 * Create-time sequencing: Java/IRD ledger first, Firestore copy second
 * ------------------------------------------------------------------ */

/**
 * Guard against submitting an invoice while offline. The Java backend is the
 * authoritative ledger — a create attempted with no connection should fail
 * fast with a clear message rather than surfacing a raw network error.
 */
export function assertOnline(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error(
      "You appear to be offline. Please check your internet connection and try again.",
    );
  }
}

/**
 * A credit note always carries the "CN" prefix so it's distinguishable from
 * a normal sale; otherwise the clinic's configured prefix is used (undefined
 * lets the Java backend apply its own default).
 */
export function resolveInvoicePrefix(
  isCreditNote: boolean,
  configuredPrefix?: string | null,
): string | undefined {
  return isCreditNote ? "CN" : configuredPrefix || undefined;
}

/**
 * The Java/IRD sync fields every domain persists verbatim onto its Firestore
 * copy of an invoice, derived from the backend's authoritative response.
 */
export function javaResultSyncFields(javaResult: InvoiceResponseDto) {
  return {
    javaInvoiceId: javaResult.id,
    irdSynced: Boolean(javaResult.irdSynced),
    irdSyncDate: javaResult.irdSyncDate ? new Date(javaResult.irdSyncDate) : null,
    cbmsResponseCode: javaResult.cbmsResponseCode || null,
  };
}

/**
 * The invoice-creation ordering every domain must follow: call the Java
 * backend FIRST and BLOCKING (it is the authoritative ledger and IRD sync
 * point), verify it returned a real invoice number, and only then write the
 * local Firestore copy.
 *
 * A Java failure propagates untouched — we never create a Firestore invoice
 * with no backing ledger entry. A Firestore failure AFTER the ledger entry
 * exists is rewritten into a resubmit-safe message instead: the invoice is
 * already filed, and the shared idempotencyKey means retrying returns that
 * same invoice rather than creating a duplicate.
 */
export async function runBlockingJavaSyncThenFirestoreWrite<R>(
  createInvoice: () => Promise<InvoiceResponseDto>,
  writeToFirestore: (javaResult: InvoiceResponseDto) => Promise<R>,
  domainLabel: string,
): Promise<R> {
  const javaResult = await createInvoice();

  if (!javaResult?.invoiceNumber) {
    throw new Error(
      "Java backend did not return an invoice number — invoice was not created.",
    );
  }

  try {
    return await writeToFirestore(javaResult);
  } catch (error) {
    console.error(`Error creating ${domainLabel} billing:`, error);
    throw new Error(
      `Invoice ${javaResult.invoiceNumber} was recorded but could not be saved locally. Please try again — this will not create a duplicate.`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Credit notes
 * ------------------------------------------------------------------ */

/** The minimal shape a billing record must have to be credit-notable. */
export interface CreditNotableBilling {
  id: string;
  invoiceNumber: string;
  items: Array<Record<string, any>>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  [key: string]: any;
}

export interface CreditNoteSkeletonOptions {
  reason: string;
  createdBy: string;
  /**
   * Portion of the original invoice to reverse. Omit (or pass 1) for a full
   * reversal, which negates the stored amounts exactly. A ratio below 1
   * scales every amount and rounds to 2dp — this app's IRD monetary
   * convention (see taxEngine.ts), since an arbitrary ratio (e.g. 2/7 unused
   * sessions) otherwise produces floating-point artifacts on a document
   * that gets filed with the tax authority.
   */
  ratio?: number;
  /**
   * Domain-specific numeric fields to negate/scale alongside the shared set
   * — e.g. appointment billing's itemDiscountAmount/mainDiscountAmount,
   * which pathology billing doesn't have.
   */
  extraNegatedFields?: string[];
}

/**
 * Build the credit-note (sales return) document for an invoice: every amount
 * negated (or scaled, for a partial reversal), linked back to the original,
 * sync status reset so it files with IRD as its own /api/billreturn document,
 * and payment history cleared.
 *
 * Returns a plain data object — the caller passes it to its own
 * `createBilling`, which is what actually submits it to Java/IRD and assigns
 * the real invoice number.
 */
export function buildCreditNoteSkeleton<T extends CreditNotableBilling>(
  original: T,
  options: CreditNoteSkeletonOptions,
): Omit<T, "id" | "createdAt" | "updatedAt"> {
  const { reason, createdBy, ratio, extraNegatedFields = [] } = options;

  // `ratio` present at all means the partial path, which always re-rounds —
  // keeping this keyed on presence rather than on `ratio < 1` means a
  // caller passing exactly 1.0 still gets the partial path's rounding
  // semantics, identical to the standalone implementation this replaced.
  const isPartial = ratio !== undefined;
  const scale = ratio ?? 1;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // A full reversal negates the stored (already 2dp) amounts exactly; a
  // partial one scales and re-rounds.
  const reverse = (n: number) =>
    isPartial ? round2(-Math.abs((n || 0) * scale)) : -Math.abs(n || 0);

  const reversedItems = original.items.map((item) => ({
    ...item,
    price: reverse(item.price || 0),
    amount: reverse(item.amount),
  }));

  // Strip id/createdAt/updatedAt before spreading — `...original` alone
  // would otherwise carry the ORIGINAL invoice's Firestore doc-id into this
  // new document as a plain field, which then silently overrides the credit
  // note's own doc-id everywhere it's read back.
  const {
    id: _originalId,
    createdAt: _originalCreatedAt,
    updatedAt: _originalUpdatedAt,
    ...originalWithoutId
  } = original;

  const reversedTotalAmount = reverse(original.totalAmount);
  const pct = Math.round(scale * 100);

  const extras: Record<string, number> = {};

  for (const field of extraNegatedFields) {
    extras[field] = reverse(original[field] || 0);
  }

  return {
    ...originalWithoutId,
    invoiceNumber: "", // resolved by the Java backend; overwritten in createBilling
    invoiceDate: new Date(),
    items: reversedItems,

    // Reverse amounts
    subtotal: reverse(original.subtotal),
    discountAmount: reverse(original.discountAmount),
    taxAmount: reverse(original.taxAmount),
    totalAmount: reversedTotalAmount,
    ...extras,

    // Mark as paid since it's a refund
    status: "finalized",
    paymentStatus: "paid",
    paidAmount: reversedTotalAmount,
    balanceAmount: 0,

    // Credit note links
    isCreditNote: true,
    linkedInvoiceId: original.id,
    linkedInvoiceNumber: original.invoiceNumber,
    creditNoteReason: reason,
    notes: isPartial
      ? `Partial Credit Note (${pct}%) for Invoice ${original.invoiceNumber}. Reason: ${reason}`
      : `Credit Note for Invoice ${original.invoiceNumber}. Reason: ${reason}`,

    // Reset sync status — the credit note files with IRD as its own document
    irdSynced: false,
    irdSyncDate: undefined,
    cbmsResponseCode: undefined,

    createdBy,
    finalizedBy: createdBy,
    finalizedAt: new Date(),

    // Remove old payment history
    paymentHistory: [],
  } as unknown as Omit<T, "id" | "createdAt" | "updatedAt">;
}
