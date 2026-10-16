import { describe, it, expect } from "vitest";

import {
  signedStockMovement,
  stockTotalAtEndOfDay,
} from "../core/stockMovementCore";

describe("signedStockMovement", () => {
  it("reads the movement from the recorded before/after levels", () => {
    expect(signedStockMovement({ type: "sale", quantity: 10, previousStock: 50, newStock: 40 })).toBe(-10);
    expect(signedStockMovement({ type: "returned", quantity: 5, previousStock: 40, newStock: 45 })).toBe(5);
    expect(signedStockMovement({ type: "purchase", quantity: 100, previousStock: 45, newStock: 145 })).toBe(100);
    // A manual deduction stores a negative quantity; a set-to adjustment stores the new level.
    expect(signedStockMovement({ type: "deduction", quantity: -3, previousStock: 145, newStock: 142 })).toBe(-3);
    expect(signedStockMovement({ type: "adjustment", quantity: 130, previousStock: 142, newStock: 130 })).toBe(-12);
  });

  it("falls back to the type for rows that never stored levels", () => {
    expect(signedStockMovement({ type: "sale", quantity: 3 })).toBe(-3);
    expect(signedStockMovement({ type: "returned", quantity: 3 })).toBe(3);
    expect(signedStockMovement({ type: "purchase", quantity: 3 })).toBe(3);
    expect(signedStockMovement({ type: "adjustment", quantity: -2 })).toBe(-2);
    expect(signedStockMovement({ type: "damaged", quantity: 4 })).toBe(-4);
  });
});

describe("stockTotalAtEndOfDay", () => {
  it("walks the live total back past everything logged after the day", () => {
    const after = [
      { type: "sale", quantity: 10, previousStock: 100, newStock: 90 },
      { type: "purchase", quantity: 20, previousStock: 90, newStock: 110 },
      { type: "returned", quantity: 2, previousStock: 110, newStock: 112 },
    ];

    // Live is 112; net movement since the day was +12, so the day ended at 100.
    expect(stockTotalAtEndOfDay(112, after)).toBe(100);
  });

  it("is the live total when nothing moved since", () => {
    expect(stockTotalAtEndOfDay(57, [])).toBe(57);
  });

  it("never reports negative stock", () => {
    expect(stockTotalAtEndOfDay(5, [{ type: "purchase", quantity: 20, previousStock: 0, newStock: 20 }])).toBe(0);
  });
});
