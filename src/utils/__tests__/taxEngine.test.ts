import { describe, it, expect } from "vitest";
import { calculateTaxBreakdown } from "../taxEngine";

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
});
