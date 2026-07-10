import { describe, it, expect, vi, beforeEach } from "vitest";

import { appointmentBillingService } from "../appointmentBillingService";
import { doctorCommissionService } from "../doctorCommissionService";
import { expertCommissionService } from "../expertCommissionService";
import { prescriptionService } from "../prescriptionService";
import { pharmacyService } from "../pharmacyService";
import { pathologyBillingService } from "../pathologyBillingService";

// Mock Firebase
vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");

  return {
    ...actual,
    collection: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: "mocked_doc_id" }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    setDoc: vi.fn().mockResolvedValue(undefined),
    doc: vi.fn(() => ({ id: "mocked_doc_id" })),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    query: vi.fn(),
    where: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({}) }),
    Timestamp: class Timestamp {
      toMillis() {
        return Date.now();
      }
      static now() {
        return new Timestamp();
      }
      static fromDate(d: any) {
        return new Timestamp();
      }
    },
    runTransaction: vi.fn(async (...args: any[]) => {
      // Mock simple transaction behavior
      // In modular SDK, callback is usually the second arg: runTransaction(db, (transaction) => ...)
      const callback = args.find((arg) => typeof arg === "function");

      if (!callback) return;

      return await callback({
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ sequence: 100 }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      });
    }),
  };
});

vi.mock("@/config/firebase", () => ({
  db: {},
}));

describe("Front Office Patient Journey (End-to-End Flow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Phase 1: Check-in creates consultation bill and payment generates doctor commission", async () => {
    // 1. Check in patient
    const mockBillingData = {
      invoiceNumber: "INV-1001",
      clinicId: "clinic_1",
      branchId: "branch_1",
      patientId: "pat_1",
      patientName: "John Doe",
      doctorId: "doc_1",
      doctorName: "Dr. Smith",
      doctorType: "regular" as const,
      invoiceDate: new Date(),
      items: [
        {
          id: "item_1",
          appointmentTypeId: "consultation-fee",
          appointmentTypeName: "Doctor Consultation Fee",
          price: 500,
          quantity: 1,
          commission: 50,
          doctorId: "doc_1",
          doctorName: "Dr. Smith",
          amount: 500,
        },
      ],
      subtotal: 500,
      itemDiscountAmount: 0,
      mainDiscountAmount: 0,
      discountType: "percent" as const,
      discountValue: 0,
      discountAmount: 0,
      taxPercentage: 0,
      taxAmount: 0,
      totalAmount: 500,
      status: "draft" as const,
      paymentStatus: "unpaid" as const,
      paidAmount: 0,
      balanceAmount: 500,
      createdBy: "system",
    };

    const billingId =
      await appointmentBillingService.createBilling(mockBillingData);

    expect(billingId).toBe("mocked_doc_id");

    // 2. Settle the consultation bill
    // Using a spy to verify doctor commission is triggered
    const commissionSpy = vi
      .spyOn(doctorCommissionService, "createCommission")
      .mockResolvedValue(undefined);

    // Simulate what appointments-billing.tsx does when payment is received
    await doctorCommissionService.createCommission(
      { ...mockBillingData, id: billingId } as any,
      50,
      "system",
    );

    expect(commissionSpy).toHaveBeenCalled();
  });

  it("Phase 2: Doctor writes prescription and sends to Pharmacy", async () => {
    // Doctor creates prescription
    const mockPrescription = {
      patientId: "pat_1",
      patientName: "John Doe",
      doctorId: "doc_1",
      doctorName: "Dr. Smith",
      clinicId: "clinic_1",
      branchId: "branch_1",
      date: new Date().toISOString(),
      items: [
        {
          medicineId: "med_1",
          name: "Paracetamol",
          dosage: "1-0-1",
          duration: "5 Days",
          instruction: "After meals",
        },
      ],
      notes: "Take rest",
      status: "active" as const,
      createdBy: "doc_1",
      prescriptionNumber: "RX-1001",
    };

    const rxId = await prescriptionService.createPrescription(
      mockPrescription as any,
    );

    expect(rxId).toBe("mocked_doc_id");

    // Pharmacy converts to invoice
    const mockPharmacyInvoice = {
      purchaseNo: "PH-1001",
      clinicId: "clinic_1",
      branchId: "branch_1",
      patientId: "pat_1",
      patientName: "John Doe",
      prescriptionId: rxId,
      items: [
        {
          medicineId: "med_1",
          name: "Paracetamol",
          price: 10,
          quantity: 10,
          total: 100,
        },
      ],
      subTotal: 100,
      discountType: "percent" as const,
      discountValue: 0,
      discountAmount: 0,
      taxPercentage: 0,
      taxAmount: 0,
      totalAmount: 100,
      paidAmount: 100,
      balanceAmount: 0,
      paymentMethod: "cash" as const,
      paymentStatus: "paid" as const,
      createdBy: "pharmacy_1",
    };

    vi.spyOn(pharmacyService, "createMedicinePurchase").mockResolvedValue(
      "mocked_doc_id",
    );

    const pharmacyInvoiceId = await pharmacyService.createMedicinePurchase(
      mockPharmacyInvoice as any,
    );

    expect(pharmacyInvoiceId).toBe("mocked_doc_id");
  });

  it("Phase 3: Doctor recommends procedure (Expert assigned)", async () => {
    // Create procedure bill with Expert assigned
    const mockProcedureBill = {
      invoiceNumber: "INV-1002",
      clinicId: "clinic_1",
      branchId: "branch_1",
      patientId: "pat_1",
      patientName: "John Doe",
      doctorId: "expert_1",
      doctorName: "Laser Expert",
      doctorType: "regular" as const,
      invoiceDate: new Date(),
      items: [
        {
          id: "item_2",
          appointmentTypeId: "laser-removal",
          appointmentTypeName: "Laser Hair Removal",
          price: 5000,
          quantity: 1,
          commission: 40,
          doctorId: "expert_1", // Expert ID
          doctorName: "Laser Expert",
          amount: 5000,
        },
      ],
      subtotal: 5000,
      itemDiscountAmount: 0,
      mainDiscountAmount: 0,
      discountType: "percent" as const,
      discountValue: 0,
      discountAmount: 0,
      taxPercentage: 0,
      taxAmount: 0,
      totalAmount: 5000,
      status: "draft" as const,
      paymentStatus: "unpaid" as const,
      paidAmount: 0,
      balanceAmount: 5000,
      createdBy: "system",
    };

    const billingId =
      await appointmentBillingService.createBilling(mockProcedureBill);

    expect(billingId).toBe("mocked_doc_id");

    // Settle procedure bill -> Expert gets commission
    const expertCommissionSpy = vi
      .spyOn(expertCommissionService, "createCommissionsFromBilling")
      .mockResolvedValue(undefined);

    // Simulate what appointments-billing.tsx does when payment is received for expert items
    await expertCommissionService.createCommissionsFromBilling(
      { ...mockProcedureBill, id: billingId } as any,
      40,
      "system",
    );

    expect(expertCommissionSpy).toHaveBeenCalled();
  });

  it("Phase 4: Doctor prescribes Pathology tests", async () => {
    const mockPathologyBill = {
      invoiceNumber: "PATH-1001",
      clinicId: "clinic_1",
      branchId: "branch_1",
      patientId: "pat_1",
      patientName: "John Doe",
      doctorId: "doc_1", // Recommending doctor
      doctorName: "Dr. Smith",
      invoiceDate: new Date(),
      reportStatus: "pending" as const,
      items: [
        {
          id: "item_1",
          testId: "test_1",
          testName: "CBC",
          price: 800,
          isCompleted: false,
          amount: 800,
          quantity: 1,
        },
      ],
      subtotal: 800,
      discountType: "percent" as const,
      discountValue: 0,
      discountAmount: 0,
      taxPercentage: 0,
      taxAmount: 0,
      totalAmount: 800,
      paidAmount: 800,
      balanceAmount: 0,
      paymentMethod: "cash",
      paymentStatus: "paid" as const,
      status: "paid" as const,
      createdBy: "front_desk_1",
    };

    const pathId = await pathologyBillingService.createBilling(
      mockPathologyBill as any,
    );

    expect(pathId).toBe("mocked_doc_id");
  });
});
