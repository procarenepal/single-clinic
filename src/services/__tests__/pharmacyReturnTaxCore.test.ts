import { describe, it, expect } from "vitest";

import { computeReturnTaxSplit } from "../core/pharmacyReturnTaxCore";

// A mixed cart: one 13%-VAT medicine and one VAT-exempt one, NPR 1000 each.
const originalItems = [
  { id: "line-vat", taxRate: 13, hsCode: "3004.90" },
  { id: "line-exempt", taxRate: 0 },
];

describe("computeReturnTaxSplit", () => {
  it("reverses no VAT when only the exempt medicine comes back", () => {
    const split = computeReturnTaxSplit({
      originalItems,
      purchaseTaxPercentage: 13,
      returnItems: [
        { purchaseItemId: "line-exempt", quantity: 1, amount: -1000 },
      ],
    });

    expect(split.taxAmount).toBe(0);
    expect(split.taxableAmount).toBe(0);
    expect(split.exemptAmount).toBe(1000);
  });

  it("reverses the full 13% when only the taxable medicine comes back", () => {
    const split = computeReturnTaxSplit({
      originalItems,
      purchaseTaxPercentage: 13,
      returnItems: [{ purchaseItemId: "line-vat", quantity: 1, amount: -1000 }],
    });

    expect(split.taxableAmount).toBe(884.96);
    expect(split.taxAmount).toBe(115.04);
    expect(split.exemptAmount).toBe(0);
    expect(split.lines[0].hsCode).toBe("3004.90");
  });

  it("splits a mixed return line by line, not by a blended ratio", () => {
    const split = computeReturnTaxSplit({
      originalItems,
      purchaseTaxPercentage: 13,
      returnItems: [
        { purchaseItemId: "line-vat", quantity: 1, amount: -1000 },
        { purchaseItemId: "line-exempt", quantity: 1, amount: -1000 },
      ],
    });

    expect(split.taxableAmount).toBe(884.96);
    expect(split.taxAmount).toBe(115.04);
    expect(split.exemptAmount).toBe(1000);
    expect(split.lines.map((l) => l.taxRate)).toEqual([13, 0]);
  });

  it("falls back to the purchase-level rate for lines that never stored one", () => {
    const split = computeReturnTaxSplit({
      originalItems: [{ id: "legacy" }],
      purchaseTaxPercentage: 13,
      returnItems: [{ purchaseItemId: "legacy", quantity: 2, amount: -226 }],
    });

    expect(split.taxableAmount).toBe(200);
    expect(split.taxAmount).toBe(26);
    expect(split.lines[0].hsCode).toBeUndefined();
  });
});
