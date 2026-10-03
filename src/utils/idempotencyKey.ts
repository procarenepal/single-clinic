/**
 * Deterministic idempotency key for the Java billing backend's
 * POST /api/billing/create. Built from the invoice's own content (not a
 * fresh random value) so that a genuine network-drop retry — the browser
 * calling createBilling again with the same form data after the first
 * attempt's response was lost — reuses the same key and the backend
 * returns the already-created invoice instead of minting a duplicate.
 *
 * Bucketing the timestamp (rather than omitting it) still lets a
 * deliberately identical invoice (same patient, same items, same amount)
 * be created again later — e.g. the same walk-in patient buying the same
 * item again tomorrow — since enough time has passed for a new bucket.
 *
 * Within one bucket, though, content alone cannot tell two genuinely
 * distinct-but-identical sales apart: a pharmacy selling the same medicine
 * to two walk-in customers minutes apart produced the same key, and the
 * second sale silently resolved to the first one's invoice — stock gone,
 * nothing filed. Where the caller already holds a reserved invoice number
 * (pharmacy reserves one per sale), that number IS the sale's identity, so
 * it is used instead of the time bucket: a retry of the same sale reuses
 * the same number and stays idempotent, while a different sale cannot
 * collide no matter how identical its contents.
 */
const BUCKET_MS = 10 * 60 * 1000; // 10 minutes — covers a realistic manual retry delay

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

export function computeIdempotencyKey(input: {
  clinicId: string;
  buyerName?: string;
  totalAmount: number;
  items: unknown;
  /** A already-reserved invoice number, when the caller has one. */
  preAssignedInvoiceNumber?: string;
  /**
   * Any other stable identifier unique to this one filing — used where no
   * number is reserved up front (a queued pharmacy return mints its credit
   * note number only at filing time, so its queue entry id is its identity).
   */
  uniqueKey?: string;
}): string {
  const discriminator = input.uniqueKey || input.preAssignedInvoiceNumber;
  const stable = JSON.stringify({
    clinicId: input.clinicId,
    buyerName: input.buyerName || "",
    totalAmount: input.totalAmount,
    items: input.items,
    // Exactly one discriminator: this filing's own identity when it has
    // one, otherwise the time bucket.
    identity: discriminator || null,
    bucket: discriminator ? null : Math.floor(Date.now() / BUCKET_MS),
  });

  return fnv1aHash(stable);
}
