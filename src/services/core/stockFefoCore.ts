/**
 * The batch-selection half of dispensing medicine: which batches a quantity
 * comes out of, in what order, at what price.
 *
 * Why it lives here rather than inside pharmacyService's transaction: stock
 * movement is the one irreversible thing this application does, and this logic
 * carries several decisions that are easy to get subtly wrong and impossible
 * to spot by reading a call site — expiry handling, FEFO ordering, scheme vs
 * regular stock, per-batch price overrides. Anything that dispenses medicine
 * has to make exactly the same decisions, so there must be exactly one copy.
 *
 * Deliberately free of Firestore: it takes batch data that the caller has
 * already read (inside its own transaction, where consistency is guaranteed)
 * and returns a plan. The caller performs the writes. That keeps the hard part
 * unit-testable without mocking a transaction.
 */

/** A medicineStock document, as far as batch selection is concerned. */
export interface StockBatchData {
  currentStock?: number;
  schemeStock?: number;
  salePrice?: number;
  schemePrice?: number;
  batchNumber?: string;
  /** Firestore Timestamp, Date, or date string — all three occur in practice. */
  expiryDate?: any;
  createdAt?: any;
}

export interface StockBatch {
  /** The medicineStock document id, so the caller knows what to write to. */
  id: string;
  /**
   * Mutable working copy of the batch's fields. planDeduction writes the
   * post-deduction stock back here, which is what lets two cart lines for the
   * same medicine draw from the same batch without overselling it.
   */
  data: StockBatchData;
}

export interface StockDeductionRequest {
  medicineName: string;
  quantity: number;
  stockType?: "regular" | "scheme";
  /** Unit price to charge when a batch has no price of its own. */
  fallbackPrice: number;
}

export interface BatchAllocation {
  stockDocId: string;
  batchNumber: string;
  qty: number;
  /** The batch's own price where it has one, else the request's fallback. */
  price: number;
  expiryDate: any | null;
  /** Stock in the relevant pool before and after this allocation. */
  previousStock: number;
  newStock: number;
  /** Both pools after this allocation, since a write updates the whole doc. */
  newRegularStock: number;
  newSchemeStock: number;
  isSchemeStock: boolean;
}

export interface StockDeductionPlan {
  allocations: BatchAllocation[];
  /** Sum of price x qty across allocations, before any discount. */
  totalAmount: number;
}

/** Milliseconds for a Firestore Timestamp, Date or date string. */
export function toMillis(value: any, fallback: number): number {
  if (value == null) return fallback;
  if (typeof value?.toDate === "function") return value.toDate().getTime();

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * The batches a sale may draw from, in the order it should draw from them.
 *
 * Expired batches are excluded outright. A batch with no expiry date is
 * treated as non-expired — refusing to sell stock merely because nobody
 * recorded an expiry would block real sales — but it sorts last, so dated
 * stock is always consumed first. Equal expiries fall back to oldest-created
 * first, so the ordering is total and a sale is reproducible.
 */
export function selectDispensableBatches(
  batches: StockBatch[],
  now: Date = new Date(),
): StockBatch[] {
  const nowMs = now.getTime();

  return batches
    .filter((b) => {
      if (b.data.expiryDate == null) return true;

      return toMillis(b.data.expiryDate, Infinity) >= nowMs;
    })
    .slice()
    .sort((a, b) => {
      const expA = toMillis(a.data.expiryDate, Infinity);
      const expB = toMillis(b.data.expiryDate, Infinity);

      if (expA !== expB) return expA - expB;

      return toMillis(a.data.createdAt, 0) - toMillis(b.data.createdAt, 0);
    });
}

/**
 * Work out where `request.quantity` comes from, consuming the earliest-expiring
 * batches first.
 *
 * Throws, rather than dispensing a partial quantity, when non-expired stock
 * cannot cover the request — a half-filled prescription that still charges and
 * still files with IRD is worse than a refused sale. The message states what
 * was available so staff can act on it.
 *
 * Mutates the stock values on the batches it is given (see StockBatch.data),
 * so calling it repeatedly with the same batch array correctly accounts for
 * stock the earlier calls already took.
 */
export function planStockDeduction(
  request: StockDeductionRequest,
  batches: StockBatch[],
  now: Date = new Date(),
): StockDeductionPlan {
  const isScheme = (request.stockType || "regular") === "scheme";
  const dispensable = selectDispensableBatches(batches, now);

  const allocations: BatchAllocation[] = [];
  let remaining = request.quantity;
  let totalAmount = 0;

  for (const batch of dispensable) {
    if (remaining <= 0) break;

    const data = batch.data;
    const available = isScheme
      ? (data.schemeStock ?? 0)
      : (data.currentStock ?? 0);

    if (available <= 0) continue;

    const qty = Math.min(remaining, available);

    const newRegularStock = isScheme
      ? (data.currentStock ?? 0)
      : (data.currentStock ?? 0) - qty;
    const newSchemeStock = isScheme
      ? (data.schemeStock ?? 0) - qty
      : (data.schemeStock ?? 0);

    // A batch bought in at a different price sells at that price; the cart's
    // unit price is only a fallback for batches with none recorded.
    const price = isScheme
      ? (data.schemePrice ?? data.salePrice ?? request.fallbackPrice)
      : (data.salePrice ?? request.fallbackPrice);

    allocations.push({
      stockDocId: batch.id,
      batchNumber: data.batchNumber || "DEFAULT",
      qty,
      price,
      expiryDate: data.expiryDate ?? null,
      previousStock: available,
      newStock: isScheme ? newSchemeStock : newRegularStock,
      newRegularStock,
      newSchemeStock,
      isSchemeStock: isScheme,
    });

    totalAmount += price * qty;

    // Reflect the deduction on the caller's working copy so a later line for
    // the same medicine sees the reduced figure.
    if (isScheme) {
      data.schemeStock = newSchemeStock;
    } else {
      data.currentStock = newRegularStock;
    }

    remaining -= qty;
  }

  if (remaining > 0) {
    const dispensed = request.quantity - remaining;

    throw new Error(
      `Insufficient non-expired stock for "${request.medicineName}". ` +
        `Requested: ${request.quantity}, Available: ${dispensed}.`,
    );
  }

  return { allocations, totalAmount };
}

/* ------------------------------------------------------------------ *
 * Putting stock back
 * ------------------------------------------------------------------ */

/** One batch a sale drew from, as recorded on the sold line. */
export interface RecordedAllocation {
  stockDocId: string;
  quantity: number;
  isSchemeStock?: boolean;
}

export interface RestoreAllocation {
  stockDocId: string;
  quantity: number;
  isSchemeStock: boolean;
}

/**
 * Where a returned quantity goes back to.
 *
 * Stock is returned to the exact batches the sale took it from, in the order
 * it took them, because batches are not interchangeable: they have their own
 * expiry dates and their own cost and sale prices. Crediting a different batch
 * would leave the shelf numerically correct but materially wrong — it can
 * resurrect quantity against an expiry that has already passed, and it
 * misstates the value of what is on hand.
 *
 * A quantity smaller than the sale (a partial return) is filled from the
 * earliest recorded allocation onward. Anything left over after every recorded
 * allocation is exhausted — which should not happen once the caller has
 * refused to over-return, but is cheap to survive — goes onto the last batch
 * rather than being silently dropped, so the total on hand still reconciles.
 *
 * Returns an empty array when the line has no recorded allocations (a sale
 * made before they were persisted). The caller decides what to do about that;
 * it must not be read as "nothing to restore".
 */
export function planStockRestoration(
  quantity: number,
  allocations: RecordedAllocation[] | undefined,
): RestoreAllocation[] {
  if (!allocations || allocations.length === 0) return [];

  const plan: RestoreAllocation[] = [];
  let remaining = quantity;

  for (const alloc of allocations) {
    if (remaining <= 0) break;

    const take = Math.min(remaining, alloc.quantity);

    if (take > 0) {
      plan.push({
        stockDocId: alloc.stockDocId,
        quantity: take,
        isSchemeStock: Boolean(alloc.isSchemeStock),
      });
      remaining -= take;
    }
  }

  if (remaining > 0 && plan.length > 0) {
    plan[plan.length - 1].quantity += remaining;
  }

  return plan;
}
