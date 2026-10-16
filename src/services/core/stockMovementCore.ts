export interface StockMovementLike {
  type?: string;
  quantity?: number;
  previousStock?: number;
  newStock?: number;
}

const INBOUND = new Set(["purchase", "returned"]);
const OUTBOUND = new Set(["sale", "deduction", "expired", "damaged"]);

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

/**
 * Signed units one stock transaction moved: positive into stock, negative
 * out of it. Every writer records the pool's level before and after, and
 * that difference is the movement regardless of how the writer spelled its
 * type or signed its quantity (a sale stores a positive quantity, a manual
 * deduction a negative one, a set-to adjustment the new level itself).
 * Rows from before those fields existed fall back to the type.
 */
export function signedStockMovement(t: StockMovementLike): number {
  if (isFiniteNumber(t.previousStock) && isFiniteNumber(t.newStock)) {
    return t.newStock - t.previousStock;
  }

  const quantity = t.quantity || 0;

  if (INBOUND.has(t.type || "")) return Math.abs(quantity);
  if (OUTBOUND.has(t.type || "")) return -Math.abs(quantity);

  return quantity;
}

/**
 * Total stock as it stood at the end of a day: today's live total, less
 * everything logged after that day. Anchoring to the live figure and
 * reading every movement type means a return or an adjustment can never
 * drift this away from the Inventory tab, and nothing is cached that a
 * later mistake could poison.
 */
export function stockTotalAtEndOfDay(
  liveTotal: number,
  movementsAfter: StockMovementLike[],
): number {
  const movedSince = movementsAfter.reduce(
    (sum, t) => sum + signedStockMovement(t),
    0,
  );

  return Math.max(0, liveTotal - movedSince);
}
