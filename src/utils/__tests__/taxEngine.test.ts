import { describe, it, expect } from "vitest";
import {
  calculateTaxBreakdown,
  calculateTaxInclusiveBreakdown,
  calculateInclusiveUnitBreakdown,
} from "../taxEngine";

describe("taxEngine", () => {
  it("should calculate 0 VAT and 100% exempt sales for basic medical consultation (tax-exempt)", () => {
    const result = calculateTaxBreakdown({
      items: [
        { itemName: "OPD Consultation Fee", quantity: 1, price: 1000, isTaxable: false },
        { itemName: "Registration Fee", quantity: 1, price: 200, isTaxable: false },
      ],
      isTaxEnabled: true,
      defaultTaxPercentage: 13,
    });

    expect(result.subtotal).toBe(1200);
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.exemptAmount).toBe(1200);
    expect(result.totalAmount).toBe(1200);
  });

  it("should calculate 13% VAT accurately for taxable procedure items", () => {
    const result = calculateTaxBreakdown({
      items: [
        { itemName: "Dental Scaling Package", quantity: 1, price: 2000, isTaxable: true },
      ],
      isTaxEnabled: true,
      defaultTaxPercentage: 13,
    });

    expect(result.subtotal).toBe(2000);
    expect(result.taxableAmount).toBe(2000);
    expect(result.taxAmount).toBe(260); // 13% of 2000
    expect(result.exemptAmount).toBe(0);
    expect(result.totalAmount).toBe(2260);
  });

  it("should allocate main invoice discount pro-rata across mixed taxable & exempt items", () => {
    const result = calculateTaxBreakdown({
      items: [
        { itemName: "Consultation Fee (Exempt)", quantity: 1, price: 1000, isTaxable: false }, // 50% of subtotal
        { itemName: "Dental Kit (Taxable 13%)", quantity: 1, price: 1000, isTaxable: true },    // 50% of subtotal
      ],
      discountType: "flat",
      discountValue: 200, // 200 discount -> 100 to exempt, 100 to taxable
      isTaxEnabled: true,
      defaultTaxPercentage: 13,
    });

    expect(result.subtotal).toBe(2000);
    expect(result.mainDiscountAmount).toBe(200);
    expect(result.exemptAmount).toBe(900); // 1000 - 100
    expect(result.taxableAmount).toBe(900); // 1000 - 100
    expect(result.taxAmount).toBe(117);    // 13% of 900
    expect(result.totalAmount).toBe(1917);  // 900 + 900 + 117
  });

  it("sums VAT per item at each item's OWN tax rate, not one blended invoice-wide rate", () => {
    const result = calculateTaxBreakdown({
      items: [
        { itemName: "Standard Service (13%)", quantity: 1, price: 1000, isTaxable: true, taxRate: 13 },
        { itemName: "Reduced-Rate Item (5%)", quantity: 1, price: 1000, isTaxable: true, taxRate: 5 },
      ],
      isTaxEnabled: true,
      defaultTaxPercentage: 13, // must NOT be applied to the 5% item
    });

    expect(result.taxableAmount).toBe(2000);
    expect(result.taxAmount).toBe(180); // 13% of 1000 + 5% of 1000 = 130 + 50
    expect(result.totalAmount).toBe(2180);
  });
});

describe("taxEngine — calculateTaxInclusiveBreakdown (pharmacy MRP-inclusive pricing)", () => {
  // Golden/parity case: the exact real purchase scenario used to find and
  // fix the "exempt item's amount counted as taxable" bug this session
  // (Amlodipine 10mg x12 @ NPR8 MRP, 13% VAT; Paracetamol 500mg x10 @ NPR5
  // MRP, 0%/exempt). Pins the shared engine's output to what was manually
  // verified correct then, so a future change to this function can't
  // silently reintroduce that bug.
  it("backs VAT out of a tax-inclusive price and keeps an exempt item's amount out of the taxable base", () => {
    const result = calculateTaxInclusiveBreakdown({
      items: [
        { itemName: "Amlodipine 10mg", quantity: 12, price: 8, isTaxable: true, taxRate: 13 },
        { itemName: "Paracetamol 500mg", quantity: 10, price: 5, isTaxable: false, taxRate: 0 },
      ],
      isTaxEnabled: true,
    });

    expect(result.subtotal).toBe(146); // 96 + 50, gross MRP totals
    expect(result.exemptAmount).toBe(50); // Paracetamol's full amount — NOT folded into taxable
    expect(result.taxableAmount).toBe(84.96); // 96 / 1.13
    expect(result.taxAmount).toBe(11.04); // 96 - 84.96
    // Inclusive mode: total reconstructs to the same gross the items
    // already summed to (tax was never added on top, just split out).
    expect(result.totalAmount).toBe(146);
  });

  it("does not double-tax: total never exceeds the sum of tax-inclusive gross amounts", () => {
    const result = calculateTaxInclusiveBreakdown({
      items: [{ itemName: "Taxable medicine", quantity: 1, price: 113, isTaxable: true, taxRate: 13 }],
      isTaxEnabled: true,
    });

    expect(result.totalAmount).toBe(113); // NOT 113 + 13% = 127.69
    expect(result.taxableAmount).toBe(100);
    expect(result.taxAmount).toBe(13);
  });

  it("allocates a main invoice discount pro-rata before backing out VAT, same as exclusive mode", () => {
    const result = calculateTaxInclusiveBreakdown({
      items: [
        { itemName: "Taxable item", quantity: 1, price: 1130, isTaxable: true, taxRate: 13 }, // 50% share
        { itemName: "Exempt item", quantity: 1, price: 1130, isTaxable: false }, // 50% share
      ],
      discountType: "flat",
      discountValue: 226, // 113 to each item
      isTaxEnabled: true,
    });

    // Taxable item: 1130 - 113 = 1017 gross-after-discount, inclusive of 13% VAT
    expect(result.exemptAmount).toBe(1017); // 1130 - 113
    expect(result.taxableAmount).toBe(900); // 1017 / 1.13
    expect(result.taxAmount).toBe(117); // 1017 - 900
  });
});

describe("taxEngine — calculateInclusiveUnitBreakdown (single-line live preview helper)", () => {
  it("matches calculateTaxInclusiveBreakdown's per-item math for a taxable line", () => {
    // Same Amlodipine line as the golden test above (96 gross, 13%)
    const { taxableAmount, taxAmount } = calculateInclusiveUnitBreakdown(96, 13);

    expect(taxableAmount).toBe(84.96);
    expect(taxAmount).toBe(11.04);
  });

  it("returns zero taxable/tax for a 0%-rate (exempt) line, never the gross amount", () => {
    const { taxableAmount, taxAmount } = calculateInclusiveUnitBreakdown(50, 0);

    expect(taxableAmount).toBe(0);
    expect(taxAmount).toBe(0);
  });
});
