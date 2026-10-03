/**
 * stockFefoCore.test.ts
 *
 * Stock movement is the only irreversible thing this application does, and the
 * batch-selection rules it depends on were previously buried inside
 * pharmacyService.createMedicinePurchase's transaction where nothing could
 * exercise them. These tests pin the behaviour that was extracted, so the
 * engine can be reused by the billing counter without re-deriving it.
 */

import { describe, it, expect } from "vitest";

import {
  StockBatch,
  planStockDeduction,
  selectDispensableBatches,
  toMillis,
} from "../core/stockFefoCore";

const NOW = new Date("2026-06-01T00:00:00Z");

const day = (iso: string) => new Date(iso);

function batch(id: string, over: Partial<StockBatch["data"]> = {}): StockBatch {
  return {
    id,
    data: {
      currentStock: 10,
      schemeStock: 0,
      batchNumber: id.toUpperCase(),
      ...over,
    },
  };
}

describe("toMillis", () => {
  it("reads Firestore Timestamps, Dates and date strings alike", () => {
    const ms = day("2026-01-02T00:00:00Z").getTime();

    expect(toMillis({ toDate: () => day("2026-01-02T00:00:00Z") }, 0)).toBe(ms);
    expect(toMillis(day("2026-01-02T00:00:00Z"), 0)).toBe(ms);
    expect(toMillis("2026-01-02T00:00:00Z", 0)).toBe(ms);
  });

  it("falls back for null and unparseable values", () => {
    expect(toMillis(null, 123)).toBe(123);
    expect(toMillis(undefined, 123)).toBe(123);
    expect(toMillis("not a date", 123)).toBe(123);
  });
});

describe("selectDispensableBatches", () => {
  it("drops expired batches", () => {
    const out = selectDispensableBatches(
      [
        batch("expired", { expiryDate: day("2026-05-31T00:00:00Z") }),
        batch("fresh", { expiryDate: day("2026-07-01T00:00:00Z") }),
      ],
      NOW,
    );

    expect(out.map((b) => b.id)).toEqual(["fresh"]);
  });

  it("consumes the earliest expiry first", () => {
    const out = selectDispensableBatches(
      [
        batch("late", { expiryDate: day("2027-01-01T00:00:00Z") }),
        batch("soon", { expiryDate: day("2026-07-01T00:00:00Z") }),
        batch("mid", { expiryDate: day("2026-09-01T00:00:00Z") }),
      ],
      NOW,
    );

    expect(out.map((b) => b.id)).toEqual(["soon", "mid", "late"]);
  });

  it("keeps undated stock usable but takes it last", () => {
    // Refusing to sell stock because nobody recorded an expiry would block
    // real sales; consuming it before dated stock would waste the dated stock.
    const out = selectDispensableBatches(
      [
        batch("undated", { expiryDate: undefined }),
        batch("dated", { expiryDate: day("2026-07-01T00:00:00Z") }),
      ],
      NOW,
    );

    expect(out.map((b) => b.id)).toEqual(["dated", "undated"]);
  });

  it("breaks an expiry tie by oldest created first", () => {
    const exp = day("2026-07-01T00:00:00Z");
    const out = selectDispensableBatches(
      [
        batch("newer", {
          expiryDate: exp,
          createdAt: day("2026-03-01T00:00:00Z"),
        }),
        batch("older", {
          expiryDate: exp,
          createdAt: day("2026-01-01T00:00:00Z"),
        }),
      ],
      NOW,
    );

    expect(out.map((b) => b.id)).toEqual(["older", "newer"]);
  });

  it("does not reorder the caller's array", () => {
    const input = [
      batch("late", { expiryDate: day("2027-01-01T00:00:00Z") }),
      batch("soon", { expiryDate: day("2026-07-01T00:00:00Z") }),
    ];

    selectDispensableBatches(input, NOW);

    expect(input.map((b) => b.id)).toEqual(["late", "soon"]);
  });
});

describe("planStockDeduction", () => {
  const req = (quantity: number, over = {}) => ({
    medicineName: "Paracetamol 500mg",
    quantity,
    fallbackPrice: 10,
    ...over,
  });

  it("takes everything from one batch when it can", () => {
    const batches = [batch("a", { currentStock: 10, salePrice: 12 })];
    const plan = planStockDeduction(req(4), batches, NOW);

    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0]).toMatchObject({
      stockDocId: "a",
      qty: 4,
      price: 12,
      previousStock: 10,
      newStock: 6,
      isSchemeStock: false,
    });
    expect(plan.totalAmount).toBe(48);
    expect(batches[0].data.currentStock).toBe(6);
  });

  it("splits across batches in expiry order, pricing each at its own rate", () => {
    const batches = [
      batch("late", {
        currentStock: 10,
        salePrice: 20,
        expiryDate: day("2027-01-01T00:00:00Z"),
      }),
      batch("soon", {
        currentStock: 3,
        salePrice: 15,
        expiryDate: day("2026-07-01T00:00:00Z"),
      }),
    ];
    const plan = planStockDeduction(req(5), batches, NOW);

    expect(plan.allocations.map((a) => [a.stockDocId, a.qty, a.price])).toEqual(
      [
        ["soon", 3, 15],
        ["late", 2, 20],
      ],
    );
    // 3 x 15 from the expiring batch, 2 x 20 from the later one
    expect(plan.totalAmount).toBe(85);
  });

  it("falls back to the cart price only when a batch has none", () => {
    const batches = [batch("a", { currentStock: 5, salePrice: undefined })];
    const plan = planStockDeduction(req(2, { fallbackPrice: 7 }), batches, NOW);

    expect(plan.allocations[0].price).toBe(7);
    expect(plan.totalAmount).toBe(14);
  });

  it("refuses the sale rather than dispensing a partial quantity", () => {
    const batches = [batch("a", { currentStock: 2 })];

    expect(() => planStockDeduction(req(5), batches, NOW)).toThrow(
      /Insufficient non-expired stock for "Paracetamol 500mg"\. Requested: 5, Available: 2\./,
    );
  });

  it("counts expired stock as unavailable when reporting a shortfall", () => {
    const batches = [
      batch("expired", {
        currentStock: 50,
        expiryDate: day("2026-01-01T00:00:00Z"),
      }),
      batch("fresh", {
        currentStock: 1,
        expiryDate: day("2026-12-01T00:00:00Z"),
      }),
    ];

    expect(() => planStockDeduction(req(3), batches, NOW)).toThrow(
      /Requested: 3, Available: 1\./,
    );
  });

  it("draws scheme quantities from the scheme pool and leaves regular stock alone", () => {
    const batches = [
      batch("a", {
        currentStock: 10,
        schemeStock: 4,
        salePrice: 20,
        schemePrice: 5,
      }),
    ];
    const plan = planStockDeduction(
      req(3, { stockType: "scheme" }),
      batches,
      NOW,
    );

    expect(plan.allocations[0]).toMatchObject({
      qty: 3,
      price: 5,
      isSchemeStock: true,
      previousStock: 4,
      newStock: 1,
      newRegularStock: 10,
      newSchemeStock: 1,
    });
    expect(batches[0].data.currentStock).toBe(10);
    expect(batches[0].data.schemeStock).toBe(1);
  });

  it("skips batches with nothing left in the relevant pool", () => {
    const batches = [
      batch("empty", {
        currentStock: 0,
        expiryDate: day("2026-07-01T00:00:00Z"),
      }),
      batch("stocked", {
        currentStock: 5,
        expiryDate: day("2026-08-01T00:00:00Z"),
      }),
    ];
    const plan = planStockDeduction(req(2), batches, NOW);

    expect(plan.allocations.map((a) => a.stockDocId)).toEqual(["stocked"]);
  });

  it("accounts for stock an earlier line of the same cart already took", () => {
    // Two cart lines for one medicine must not both see the opening balance,
    // or a sale of 6 + 6 would pass against 10 units of stock.
    const batches = [batch("a", { currentStock: 10, salePrice: 10 })];

    planStockDeduction(req(6), batches, NOW);

    expect(batches[0].data.currentStock).toBe(4);
    expect(() => planStockDeduction(req(6), batches, NOW)).toThrow(
      /Requested: 6, Available: 4\./,
    );
  });
});
