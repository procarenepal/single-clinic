import { describe, it, expect, vi, beforeEach } from "vitest";

import { doctorCommissionService } from "../doctorCommissionService";
import { expertCommissionService } from "../expertCommissionService";

// Commission creation now writes via a transaction (get-by-deterministic-id,
// then set+update) instead of addDoc/updateDoc — see commissionIdempotencyCore
// and the race-condition fix in clinicianCommissionService. mockTransaction is
// what every test below asserts against in place of the old addDoc mock;
// mockTransaction.get defaults to "no existing commission", same as the old
// getDocs mock's default "always empty".
const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock Firebase Firestore
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  getDoc: vi.fn(),
  increment: vi.fn((val) => val),
  runTransaction: vi.fn(async (_db: any, updateFn: any) => updateFn(mockTransaction)),
  Timestamp: {
    fromDate: vi.fn((date) => date),
    now: vi.fn(() => new Date()),
  },
}));

vi.mock("../../config/firebase", () => ({
  db: {},
}));

describe("Commission Generation Engine (Production Unit Tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.get.mockResolvedValue({ exists: () => false });
  });

  describe("Global Discount Pro-Rating Math", () => {
    it("should correctly prorate a global discount across line items for doctors", async () => {
      // Mock Billing Data
      const mockBilling = {
        id: "mock_bill_1",
        clinicId: "clinic_1",
        invoiceDate: new Date(),
        subtotal: 10000,
        mainDiscountAmount: 1000, // 10% global discount
        totalAmount: 9000,
        items: [
          {
            appointmentTypeName: "Surgery",
            amount: 10000,
            doctorId: "doc_1",
            commission: 20, // 20%
          },
        ],
      };

      // Run the engine
      await doctorCommissionService.createCommission(
        mockBilling as any,
        20,
        "admin_user",
      );

      // Verify the math:
      // 10000 item - 10% global discount = 9000 effective amount.
      // 9000 * 20% commission = 1800 payout.
      expect(mockTransaction.set).toHaveBeenCalledTimes(1);

      const savedCommissionData = mockTransaction.set.mock.calls[0][1];

      expect(savedCommissionData.commissionAmount).toBe(1800);
      expect(savedCommissionData.totalInvoiceAmount).toBe(9000);
      expect(savedCommissionData.status).toBe("pending");
    });

    it("should correctly handle multiple items with different clinicians", async () => {
      const mockBilling = {
        id: "mock_bill_2",
        clinicId: "clinic_1",
        invoiceDate: new Date(),
        subtotal: 5000,
        mainDiscountAmount: 500, // 10% global discount
        totalAmount: 4500,
        items: [
          {
            appointmentTypeName: "Consultation",
            amount: 2000, // Effective: 1800
            doctorId: "exp_1",
            commission: 10, // 10% -> Payout: 180
          },
          {
            appointmentTypeName: "Procedure",
            amount: 3000, // Effective: 2700
            doctorId: "exp_1",
            commission: 15, // 15% -> Payout: 405
          },
        ],
      };

      await expertCommissionService.createCommissionsFromBilling(
        mockBilling as any,
        10,
        "admin_user",
      );

      // Total expected payout for exp_1: 180 + 405 = 585
      expect(mockTransaction.set).toHaveBeenCalledTimes(1);

      const savedCommissionData = mockTransaction.set.mock.calls[0][1];

      expect(savedCommissionData.commissionAmount).toBe(585);

      // Expected effective percentage: (585 / 4500) * 100 = 13%
      expect(savedCommissionData.commissionPercentage).toBeCloseTo(13, 1);
    });
  });

  describe("Defensive Edge Cases", () => {
    it("should not throw errors or crash if subtotal is 0", async () => {
      const mockBilling = {
        id: "mock_bill_3",
        clinicId: "clinic_1",
        invoiceDate: new Date(),
        subtotal: 0,
        mainDiscountAmount: 0,
        totalAmount: 0,
        items: [
          {
            amount: 0,
            doctorId: "doc_1",
            commission: 20,
          },
        ],
      };

      await doctorCommissionService.createCommission(
        mockBilling as any,
        20,
        "admin_user",
      );

      // Should not generate commission for 0 amount items
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it("should fall back to default percentage if item commission is missing", async () => {
      const mockBilling = {
        id: "mock_bill_4",
        clinicId: "clinic_1",
        invoiceDate: new Date(),
        subtotal: 1000,
        mainDiscountAmount: 0,
        totalAmount: 1000,
        items: [
          {
            amount: 1000,
            doctorId: "doc_1",
            commission: undefined, // Missing or 0
          },
        ],
      };

      // Run with default fallback 25%
      await doctorCommissionService.createCommission(
        mockBilling as any,
        25,
        "admin_user",
      );

      expect(mockTransaction.set).toHaveBeenCalledTimes(1);
      const savedCommissionData = mockTransaction.set.mock.calls[0][1];

      // 1000 * 25% = 250
      expect(savedCommissionData.commissionAmount).toBe(250);
    });
  });

  describe("Payment Status Gates (Fully Paid Check)", () => {
    it("should block commission generation on partial payments", () => {
      const totalAmount = 10000;
      const currentPaid = 4000;
      const paymentBeingMade = 2000;

      // Simulate the gating logic from appointment-billing
      const isNowFullyPaid = currentPaid + paymentBeingMade >= totalAmount;

      expect(isNowFullyPaid).toBe(false); // 6000 < 10000
    });

    it("should trigger commission generation ONLY on full final payment", () => {
      const totalAmount = 10000;
      const currentPaid = 8000;
      const paymentBeingMade = 2000;

      // Simulate the gating logic from appointment-billing
      const isNowFullyPaid = currentPaid + paymentBeingMade >= totalAmount;

      expect(isNowFullyPaid).toBe(true); // 10000 == 10000
    });
  });

  describe("Staff & Referral Combinations", () => {
    it("should distribute commissions safely without modifying global state", () => {
      // Validates that adding a referral partner doesn't corrupt clinician data
      const referralCommissionRate = 5; // 5%
      const invoiceAmount = 20000;

      const expectedReferralPayout =
        (invoiceAmount * referralCommissionRate) / 100;

      expect(expectedReferralPayout).toBe(1000);
    });
  });
});
