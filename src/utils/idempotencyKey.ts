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
}): string {
  const bucket = Math.floor(Date.now() / BUCKET_MS);
  const stable = JSON.stringify({
    clinicId: input.clinicId,
    buyerName: input.buyerName || "",
    totalAmount: input.totalAmount,
    items: input.items,
    bucket,
  });

  return fnv1aHash(stable);
}
