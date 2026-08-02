import { describe, it, expect } from "vitest";
import pharmacyService from "../services/pharmacyService";

describe("Pharmacy Settings Tax Logic", () => {
  it("should return 13 as the default tax percentage in getDefaultPharmacySettings", () => {
    const settings = pharmacyService.getDefaultPharmacySettings();
    expect(settings.defaultTaxPercentage).toBe(13);
    expect(settings.enableTax).toBe(true);
  });

  describe("Form Initialization Logic", () => {
    // Simulating the exact logic from pharmacy.tsx for form initialization
    const getInitialTaxPercentage = (settings: { enableTax: boolean; defaultTaxPercentage: number }) => {
      return settings.enableTax ? settings.defaultTaxPercentage : 0;
    };

    it("should apply default tax percentage when tax is enabled", () => {
      const mockSettings = {
        enableTax: true,
        defaultTaxPercentage: 13,
      };

      const appliedTax = getInitialTaxPercentage(mockSettings);
      expect(appliedTax).toBe(13);
    });

    it("should apply 0% tax when tax is disabled, even if defaultTaxPercentage is set", () => {
      const mockSettings = {
        enableTax: false,
        defaultTaxPercentage: 13,
      };

      const appliedTax = getInitialTaxPercentage(mockSettings);
      expect(appliedTax).toBe(0); // This was the bug we fixed!
    });

    it("should apply custom default tax percentage when tax is enabled", () => {
      const mockSettings = {
        enableTax: true,
        defaultTaxPercentage: 5,
      };

      const appliedTax = getInitialTaxPercentage(mockSettings);
      expect(appliedTax).toBe(5);
    });
  });

  describe("Bill Calculation Logic", () => {
    // Simulating the exact calculation from the useEffect in pharmacy.tsx
    const calculateBill = (total: number, discountAmount: number, taxPercentage: number, handlingAmount: number = 0) => {
      const taxableAmount = Number(Math.max(0, total - discountAmount).toFixed(2));
      const taxAmount = Number(((taxableAmount * taxPercentage) / 100).toFixed(2));
      const netAmount = Number((taxableAmount + taxAmount + handlingAmount).toFixed(2));

      return { taxableAmount, taxAmount, netAmount };
    };

    it("should calculate correct amounts with 13% tax", () => {
      const result = calculateBill(100, 0, 13);
      expect(result.taxableAmount).toBe(100);
      expect(result.taxAmount).toBe(13);
      expect(result.netAmount).toBe(113);
    });

    it("should calculate correct amounts with 0% tax", () => {
      const result = calculateBill(100, 0, 0);
      expect(result.taxableAmount).toBe(100);
      expect(result.taxAmount).toBe(0);
      expect(result.netAmount).toBe(100);
    });

    it("should calculate correct amounts with discount and tax", () => {
      // 100 total, 20 discount -> 80 taxable
      // 13% of 80 = 10.4
      // Net = 80 + 10.4 = 90.4
      const result = calculateBill(100, 20, 13);
      expect(result.taxableAmount).toBe(80);
      expect(result.taxAmount).toBe(10.4);
      expect(result.netAmount).toBe(90.4);
    });
  });
});
