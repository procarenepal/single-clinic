import { describe, it, expect } from "vitest";

import {
  billingLineRate,
  creditNotesAsReturns,
  vatOn,
} from "../core/billingCounterPharmacyCore";

const item = {
  id: "line-1",
  appointmentTypeId: "med-1",
  appointmentTypeName: "Cetirizine 10mg",
  amount: 100,
};

const creditNote = (over: Partial<Parameters<typeof creditNotesAsReturns>[0]["creditNotes"][number]> = {}) => ({
  id: "cn-1",
  clinicId: "default",
  invoiceDate: new Date("2026-10-15T00:00:00Z"),
  createdBy: "staff",
  creditNoteReason: "Patient returned unused strip",
  items: [{ id: "line-1", quantity: 2, amount: -100 }],
  ...over,
});

describe("billingLineRate", () => {
  it("charges nothing unless the line is explicitly taxable", () => {
    expect(billingLineRate({ taxPercentage: 13 }, {})).toBe(0);
    expect(billingLineRate({ taxPercentage: 13 }, { isTaxable: false, taxRate: 13 })).toBe(0);
  });

  it("uses the line's own rate, else the invoice's", () => {
    expect(billingLineRate({ taxPercentage: 13 }, { isTaxable: true, taxRate: 5 })).toBe(5);
    expect(billingLineRate({ taxPercentage: 13 }, { isTaxable: true })).toBe(13);
  });
});

describe("vatOn", () => {
  it("adds VAT on top of a tax-exclusive amount, to the paisa", () => {
    expect(vatOn(36, 13)).toBe(4.68);
    expect(vatOn(86.4, 13)).toBe(11.23);
    expect(vatOn(100, 0)).toBe(0);
  });
});

describe("creditNotesAsReturns", () => {
  it("folds a full reversal into a return for the whole line, VAT included", () => {
    const { returns, totalReturnedAmount } = creditNotesAsReturns({
      invoice: { id: "inv-1" },
      item,
      rate: 13,
      creditNotes: [creditNote()],
    });

    expect(returns).toHaveLength(1);
    expect(returns[0].totalAmount).toBe(-113);
    expect(returns[0].purchaseId).toBe("inv-1");
    expect(returns[0].items[0].quantity).toBe(2);
    expect(returns[0].items[0].purchaseItemId).toBe("line-1");
    expect(totalReturnedAmount).toBe(113);
  });

  it("derives the units of a partial credit note from its share of the amount", () => {
    const { returns } = creditNotesAsReturns({
      invoice: { id: "inv-1" },
      item,
      rate: 13,
      creditNotes: [creditNote({ items: [{ id: "line-1", quantity: 2, amount: -50 }] })],
    });

    expect(returns[0].totalAmount).toBe(-56.5);
    expect(returns[0].items[0].quantity).toBe(1);
  });

  it("ignores credit notes that do not touch this line", () => {
    const { returns, totalReturnedAmount } = creditNotesAsReturns({
      invoice: { id: "inv-1" },
      item,
      rate: 13,
      creditNotes: [creditNote({ items: [{ id: "other-line", quantity: 1, amount: -40 }] })],
    });

    expect(returns).toEqual([]);
    expect(totalReturnedAmount).toBe(0);
  });

  it("reverses no VAT on an exempt line", () => {
    const { returns } = creditNotesAsReturns({
      invoice: { id: "inv-1" },
      item,
      rate: 0,
      creditNotes: [creditNote()],
    });

    expect(returns[0].totalAmount).toBe(-100);
  });
});
