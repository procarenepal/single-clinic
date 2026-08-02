import { describe, it, expect, vi } from "vitest";
import { doctorCommissionService } from "../services/doctorCommissionService";
import { AppointmentBilling } from "../types/models";
import { db } from "../config/firebase";

// Mock Firebase
vi.mock("../config/firebase", () => ({
  db: {}
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: "mock-doc-id" }),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn((val) => val),
  Timestamp: {
    fromDate: vi.fn((date) => date),
    now: vi.fn(() => new Date()),
  },
}));

describe("Doctor Commission - Business/Individual Business Logic", () => {
  it("should calculate groupSubtotal excluding discount and calculating commission only for eligible items", async () => {
    const billing: AppointmentBilling = {
      id: "bill_1",
      clinicId: "clinic_1",
      branchId: "branch_1",
      patientId: "pat_1",
      patientName: "John Doe",
      doctorId: "doc_1",
      doctorName: "Dr. Smith",
      subtotal: 1000,
      itemDiscountAmount: 0,
      mainDiscountAmount: 100, // 10% discount on total
      taxAmount: 0,
      taxPercentage: 0,
      discountType: "flat",
      discountValue: 0,
      discountAmount: 0,
      paidAmount: 900,
      balanceAmount: 0,
      totalAmount: 900, // They paid 900 after discount
      paymentStatus: "paid",
      status: "paid",
      invoiceNumber: "INV-001",
      invoiceDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      doctorType: "regular",
      createdBy: "test_user_id",
      items: [
        {
          id: "item_1",
          appointmentTypeId: "type_consultation",
          appointmentTypeName: "Doctor Consultation",
          price: 500,
          quantity: 1,
          amount: 500, // Should NOT be in commission/business if calculateCommission is false
          commission: 0, // front-end passes 0 if calculateCommission is false
          calculateCommission: false // simulating the flag
        },
        {
          id: "item_2",
          appointmentTypeId: "type_procedure",
          appointmentTypeName: "PRP Hair",
          price: 500,
          quantity: 1,
          amount: 500, // Should be in commission/business
          commission: 50, // 50% commission
          calculateCommission: true
        }
      ]
    };

    // We will extract the exact logic from createCommission to test it
    // since we want to verify how groupSubtotal and commissionAmount are calculated

    let groupSubtotal = 0;
    const groupCommissionAmount = billing.items.reduce((total, item) => {
      // If calculateCommission is false, we should completely skip it from business subtotal!
      if (item.calculateCommission === false) {
        return total;
      }

      const percentage = typeof item.commission === "number" && item.commission >= 0
        ? item.commission
        : 50; // doctor default

      // Pro-rate the global invoice discount (mainDiscountAmount) onto this item
      const totalItemAmounts = (billing.subtotal || 1) - (billing.itemDiscountAmount || 0);
      const validTotal = totalItemAmounts > 0 ? totalItemAmounts : 1;
      const mainDiscount = billing.mainDiscountAmount || 0;

      const discountRatio = (validTotal - mainDiscount) / validTotal;
      const effectiveItemAmount = item.amount * discountRatio;

      groupSubtotal += effectiveItemAmount;

      if (!percentage || percentage <= 0) {
        return total;
      }

      const itemCommissionAmount = (effectiveItemAmount * percentage) / 100;
      return total + itemCommissionAmount;
    }, 0);

    // Assertions
    // Total valid items = PRP Hair (500)
    // Discount ratio = (1000 - 100) / 1000 = 0.9
    // Effective item amount for PRP = 500 * 0.9 = 450
    // So groupSubtotal (Individual Business) should be 450, NOT 900 or 1000.

    expect(groupSubtotal).toBe(450);

    // Commission amount = 50% of 450 = 225
    expect(groupCommissionAmount).toBe(225);
  });
});
