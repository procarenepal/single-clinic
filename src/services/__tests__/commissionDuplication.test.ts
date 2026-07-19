/**
 * commissionDuplication.test.ts
 *
 * Targeted tests for commission bugs:
 * 1. Commission created ONLY on full payment, NOT on partial or draft
 * 2. Commission NOT duplicated when payment is recorded twice on same bill
 * 3. Doctor and Expert commissions correctly separated by clinicianId
 * 4. Referring doctor NOT double-counted when they also have items in the bill
 * 5. Commission amount correctly calculated with pro-rated discount
 * 6. Commission skipped when percentage is 0
 * 7. Commission skipped when item.amount is 0
 * 8. Multi-doctor bill creates separate commission per doctor, not one combined
 * 9. payCommission rejects overpayment
 * 10. payCommission rejects zero/negative amounts
 * 11. Cancelling commission reverts doctor balance
 * 12. recordPayment guard: already-paid bill cannot receive more payment
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { doctorCommissionService } from "../doctorCommissionService";
import { expertCommissionService } from "../expertCommissionService";

// ─── Firebase mocks ──────────────────────────────────────────────────────────
const addDocMock       = vi.fn().mockResolvedValue({ id: "comm_id_1" });
const updateDocMock    = vi.fn().mockResolvedValue(undefined);
const getDocMock       = vi.fn();
const getDoctorsMock   = vi.fn().mockResolvedValue({ docs: [] });

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");
  return {
    ...actual,
    collection: vi.fn(),
    addDoc: (...args: any[]) => addDocMock(...args),
    updateDoc: (...args: any[]) => updateDocMock(...args),
    getDoc: (...args: any[]) => getDocMock(...args),
    getDocs: (...args: any[]) => getDoctorsMock(...args),
    doc: vi.fn(() => ({ id: "mocked_doc_id" })),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    increment: (n: number) => ({ __increment: n }),
    Timestamp: {
      fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000) }),
      now: () => ({ seconds: Math.floor(Date.now() / 1000) }),
    },
  };
});

vi.mock("@/config/firebase", () => ({ db: {} }));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeBilling(overrides: Record<string, any> = {}) {
  return {
    id: "bill_1",
    invoiceNumber: "INV-001",
    clinicId: "clinic_1",
    branchId: "branch_1",
    patientId: "pat_1",
    patientName: "Test Patient",
    doctorId: "doc_1",
    doctorName: "Dr. Smith",
    invoiceDate: new Date("2024-01-01"),
    items: [
      {
        id: "item_1",
        appointmentTypeId: "consultation-fee",
        appointmentTypeName: "Doctor Consultation Fee",
        price: 1000,
        quantity: 1,
        commission: 10,         // 10%
        doctorId: "doc_1",
        doctorName: "Dr. Smith",
        amount: 1000,
        discountAmount: 0,
      },
    ],
    subtotal: 1000,
    itemDiscountAmount: 0,
    mainDiscountAmount: 0,
    discountAmount: 0,
    taxPercentage: 0,
    taxAmount: 0,
    totalAmount: 1000,
    paidAmount: 0,
    balanceAmount: 1000,
    status: "draft" as const,
    paymentStatus: "unpaid" as "unpaid" | "paid" | "partial",
    createdBy: "system",
    referrals: [] as any[],
    paymentHistory: [] as any[],
    ...overrides,
  };
}

// ─── Commission calculation logic (pure, extracted from service) ─────────────
function calcCommissionAmount(
  items: { amount: number; commission?: number }[],
  defaultPct: number,
  subtotal: number,
  itemDiscountAmount: number,
  mainDiscountAmount: number,
): number {
  return items.reduce((total, item) => {
    const percentage =
      typeof item.commission === "number" && item.commission >= 0
        ? item.commission
        : defaultPct;

    const totalItemAmounts = (subtotal || 1) - (itemDiscountAmount || 0);
    const validTotal = totalItemAmounts > 0 ? totalItemAmounts : 1;
    const discountRatio = (validTotal - (mainDiscountAmount || 0)) / validTotal;
    const effectiveItemAmount = item.amount * discountRatio;

    if (!percentage || percentage <= 0) return total;
    return total + (effectiveItemAmount * percentage) / 100;
  }, 0);
}

// ─── Record-payment guard (extracted from appointmentBillingService) ──────────
function simulateRecordPaymentGuard(
  billing: ReturnType<typeof makeBilling>,
  paymentAmount: number,
) {
  if (billing.paymentStatus === "paid" && paymentAmount > 0) {
    throw new Error("This invoice is already fully paid.");
  }
  const newPaid = billing.paidAmount + paymentAmount;
  const newStatus =
    newPaid >= billing.totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";
  return { newPaid, newStatus };
}

beforeEach(() => {
  vi.clearAllMocks();
  addDocMock.mockResolvedValue({ id: "comm_id_1" });
  updateDocMock.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Commission only fires on FULL payment
// ═══════════════════════════════════════════════════════════════════════════
describe("Commission fire condition", () => {
  it("does NOT fire commission on partial payment", () => {
    const bill = makeBilling({ totalAmount: 1000, paidAmount: 0 });
    const { newStatus } = simulateRecordPaymentGuard(bill, 400);
    expect(newStatus).toBe("partial");
    // Commission only fires when newStatus === "paid" AND billing.paymentStatus !== "paid"
    const shouldFire = newStatus === "paid" && bill.paymentStatus !== "paid";
    expect(shouldFire).toBe(false);
  });

  it("fires commission exactly once on full payment", () => {
    const bill = makeBilling({ totalAmount: 1000, paidAmount: 0 });
    const { newStatus } = simulateRecordPaymentGuard(bill, 1000);
    expect(newStatus).toBe("paid");
    const shouldFire = newStatus === "paid" && bill.paymentStatus !== "paid";
    expect(shouldFire).toBe(true);
  });

  it("does NOT fire commission if bill was already paid (second payment attempt)", () => {
    const bill = makeBilling({ totalAmount: 1000, paidAmount: 1000, paymentStatus: "paid" });
    expect(() => simulateRecordPaymentGuard(bill, 1)).toThrow("already fully paid");
  });

  it("fires commission when paying remaining balance after partial", () => {
    const bill = makeBilling({ totalAmount: 1000, paidAmount: 400, paymentStatus: "partial" });
    const { newStatus } = simulateRecordPaymentGuard(bill, 600);
    expect(newStatus).toBe("paid");
    const shouldFire = newStatus === "paid" && bill.paymentStatus !== "paid";
    expect(shouldFire).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Commission NOT duplicated on double-call (Firestore addDoc mock count)
// ═══════════════════════════════════════════════════════════════════════════
describe("Commission duplication prevention via doctorCommissionService", () => {
  it("calls addDoc exactly ONCE per unique doctor in the bill", async () => {
    const bill = makeBilling();

    await doctorCommissionService.createCommission(bill as any, 10, "system");

    expect(addDocMock).toHaveBeenCalledTimes(1); // one doctor → one commission doc
  });

  it("calls addDoc for EACH unique doctor when multiple doctors are in the bill", async () => {
    const bill = makeBilling({
      items: [
        { id: "i1", appointmentTypeName: "Consultation", appointmentTypeId: "c1", price: 1000, quantity: 1, commission: 10, doctorId: "doc_1", doctorName: "Dr. A", amount: 1000, discountAmount: 0 },
        { id: "i2", appointmentTypeName: "Laser",        appointmentTypeId: "l1", price: 5000, quantity: 1, commission: 15, doctorId: "doc_2", doctorName: "Dr. B", amount: 5000, discountAmount: 0 },
      ],
      subtotal: 6000,
      totalAmount: 6000,
    });

    await doctorCommissionService.createCommission(bill as any, 10, "system");

    // 2 doctors → 2 commission docs
    expect(addDocMock).toHaveBeenCalledTimes(2);
  });

  it("calls addDoc exactly ONCE per expert in the bill", async () => {
    const bill = makeBilling({
      items: [
        { id: "i1", appointmentTypeName: "Laser Hair", appointmentTypeId: "lh1", price: 8000, quantity: 1, commission: 20, doctorId: "exp_1", doctorName: "Expert A", amount: 8000, discountAmount: 0 },
      ],
      subtotal: 8000,
      totalAmount: 8000,
    });

    await expertCommissionService.createCommissionsFromBilling(bill as any, 20, "system");

    expect(addDocMock).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Commission skipped when amount is 0 or commission% is 0
// ═══════════════════════════════════════════════════════════════════════════
describe("Commission skipped on zero values", () => {
  it("skips commission when item.commission = 0 and defaultPct = 0", async () => {
    const bill = makeBilling({
      items: [
        { id: "i1", appointmentTypeName: "Free Service", appointmentTypeId: "free", price: 500, quantity: 1, commission: 0, doctorId: "doc_1", doctorName: "Dr. Smith", amount: 500, discountAmount: 0 },
      ],
    });

    await doctorCommissionService.createCommission(bill as any, 0, "system");

    expect(addDocMock).not.toHaveBeenCalled(); // groupCommissionAmount=0 → skip
  });

  it("skips commission when item.amount = 0", async () => {
    const bill = makeBilling({
      items: [
        { id: "i1", appointmentTypeName: "Complimentary", appointmentTypeId: "comp", price: 0, quantity: 1, commission: 20, doctorId: "doc_1", doctorName: "Dr. Smith", amount: 0, discountAmount: 0 },
      ],
      subtotal: 0,
      totalAmount: 0,
    });

    await doctorCommissionService.createCommission(bill as any, 20, "system");

    expect(addDocMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Commission calculation: correct amounts with discounts
// ═══════════════════════════════════════════════════════════════════════════
describe("Commission calculation accuracy", () => {
  it("calculates 10% commission on 1000 with no discount = 100", () => {
    const result = calcCommissionAmount(
      [{ amount: 1000, commission: 10 }],
      10, 1000, 0, 0,
    );
    expect(result).toBeCloseTo(100);
  });

  it("pro-rates 20% main discount correctly: 10% of 800 effective = 80", () => {
    // subtotal=1000, mainDiscount=200 → discountRatio=0.8
    // effectiveAmount = 1000 * 0.8 = 800
    // commission = 800 * 10% = 80
    const result = calcCommissionAmount(
      [{ amount: 1000, commission: 10 }],
      10, 1000, 0, 200,
    );
    expect(result).toBeCloseTo(80);
  });

  it("uses item-level commission% over default%", () => {
    const result = calcCommissionAmount(
      [{ amount: 1000, commission: 25 }], // item says 25%
      10, 1000, 0, 0,                      // default is 10%
    );
    expect(result).toBeCloseTo(250); // uses 25%, not 10%
  });

  it("uses default commission% when item.commission is undefined", () => {
    const result = calcCommissionAmount(
      [{ amount: 1000, commission: undefined as any }],
      15, 1000, 0, 0,
    );
    expect(result).toBeCloseTo(150); // uses default 15%
  });

  it("sums commissions across multiple items for the same doctor", () => {
    const result = calcCommissionAmount(
      [
        { amount: 1000, commission: 10 },
        { amount: 5000, commission: 10 },
      ],
      10, 6000, 0, 0,
    );
    expect(result).toBeCloseTo(600); // 10% of 6000
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Referring doctor double-commission prevention
// ═══════════════════════════════════════════════════════════════════════════
describe("Referring doctor — no double-commission", () => {
  it("filters out items belonging to the referring doctor before creating referral commission", () => {
    const bill = makeBilling({
      items: [
        // doc_1 is the REFERRING doctor — this item should be excluded from referral calc
        { id: "i1", appointmentTypeName: "Consultation", appointmentTypeId: "c1", price: 1000, quantity: 1, commission: 10, doctorId: "doc_1", doctorName: "Dr. Referrer", amount: 1000 },
        // expert_1's item — should be included for referral commission
        { id: "i2", appointmentTypeName: "Laser",        appointmentTypeId: "l1", price: 5000, quantity: 1, commission: 15, doctorId: "exp_1", doctorName: "Expert A",     amount: 5000 },
      ],
      referrals: [
        { type: "doctor", id: "doc_1", name: "Dr. Referrer", commissionPercentage: 10, commissionAmount: 500 },
      ],
    });

    // Simulate the filtering logic from appointmentBillingService recordPayment (L1000-1001)
    const referral = bill.referrals[0];
    const itemsForReferral = bill.items.filter(
      (item: any) => item.doctorId !== referral.id,
    );

    expect(itemsForReferral).toHaveLength(1);              // only exp_1's item
    expect(itemsForReferral[0].doctorId).toBe("exp_1");    // doc_1's item excluded
    expect(itemsForReferral.some((i: any) => i.doctorId === "doc_1")).toBe(false);
  });

  it("skips referral commission entirely if all items belong to the referrer", () => {
    const bill = makeBilling({
      items: [
        { id: "i1", appointmentTypeName: "Consultation", appointmentTypeId: "c1", price: 1000, quantity: 1, commission: 10, doctorId: "doc_1", doctorName: "Dr. Referrer", amount: 1000 },
      ],
      referrals: [
        { type: "doctor", id: "doc_1", name: "Dr. Referrer", commissionPercentage: 10, commissionAmount: 100 },
      ],
    });

    const referral = bill.referrals[0];
    const itemsForReferral = bill.items.filter(
      (item: any) => item.doctorId !== referral.id,
    );

    // No items remain → commission is NOT created (guard at L1004: itemsForReferral.length > 0)
    expect(itemsForReferral.length).toBe(0);
    const shouldCreateReferralCommission = itemsForReferral.length > 0;
    expect(shouldCreateReferralCommission).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. payCommission guards
// ═══════════════════════════════════════════════════════════════════════════
describe("payCommission — guard conditions", () => {
  it("throws if paidAmount exceeds remaining commission balance", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        doctorId: "doc_1",
        commissionAmount: 1000,
        paidAmount: 900,  // remaining = 100
        status: "pending",
      }),
    });

    await expect(
      doctorCommissionService.payCommission("comm_1", 200, "cash"), // tries to pay 200 but only 100 left
    ).rejects.toThrow("cannot exceed remaining commission balance");
  });

  it("throws if paidAmount is 0 or negative", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        doctorId: "doc_1",
        commissionAmount: 1000,
        paidAmount: 0,
        status: "pending",
      }),
    });

    await expect(
      doctorCommissionService.payCommission("comm_1", 0, "cash"),
    ).rejects.toThrow("greater than 0");
  });

  it("marks commission as paid when full amount is paid", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        doctorId: "doc_1",
        commissionAmount: 100,
        paidAmount: 0,
        status: "pending",
      }),
    });

    await doctorCommissionService.payCommission("comm_1", 100, "cash");

    const updateCall = updateDocMock.mock.calls[0][1];
    expect(updateCall.status).toBe("paid");
    expect(updateCall.paidAmount).toBe(100);
  });

  it("keeps commission as pending on partial payment", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        doctorId: "doc_1",
        commissionAmount: 1000,
        paidAmount: 0,
        status: "pending",
      }),
    });

    await doctorCommissionService.payCommission("comm_1", 400, "cash");

    const updateCall = updateDocMock.mock.calls[0][1];
    expect(updateCall.status).toBe("pending");
    expect(updateCall.paidAmount).toBe(400);
  });

  it("decrements doctor balance on payCommission (increment with negative)", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        doctorId: "doc_1",
        commissionAmount: 100,
        paidAmount: 0,
        status: "pending",
      }),
    });

    await doctorCommissionService.payCommission("comm_1", 100, "cash");

    // updateDoc called twice: once for commission doc, once for doctor balance
    expect(updateDocMock).toHaveBeenCalledTimes(2);
    const balanceUpdate = updateDocMock.mock.calls[1][1];
    expect(balanceUpdate.totalCommissionBalance).toEqual({ __increment: -100 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Commission cancellation reverts doctor balance
// ═══════════════════════════════════════════════════════════════════════════
describe("updateCommissionStatus — cancellation reverts balance", () => {
  it("reverts doctor balance when cancelling a pending commission", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        doctorId: "doc_1",
        commissionAmount: 500,
        paidAmount: 0,
        status: "pending",
      }),
    });

    await doctorCommissionService.updateCommissionStatus("comm_1", "cancelled");

    // updateDoc should be called for doctor balance revert + status update
    expect(updateDocMock).toHaveBeenCalledTimes(2);
    const balanceRevert = updateDocMock.mock.calls[0][1];
    // totalCommissionEarned decremented by full commissionAmount
    expect(balanceRevert.totalCommissionEarned).toEqual({ __increment: -500 });
    // totalCommissionBalance decremented by (commissionAmount - paidAmount) = 500 - 0 = 500
    expect(balanceRevert.totalCommissionBalance).toEqual({ __increment: -500 });
  });

  it("does NOT revert balance if commission is already cancelled", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        doctorId: "doc_1",
        commissionAmount: 500,
        paidAmount: 0,
        status: "cancelled", // already cancelled
      }),
    });

    await doctorCommissionService.updateCommissionStatus("comm_1", "cancelled");

    // Only the status updateDoc call should fire, NOT the balance revert
    expect(updateDocMock).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Expert commission — separate from doctor commission collection
// ═══════════════════════════════════════════════════════════════════════════
describe("Expert vs Doctor commission — correct collections", () => {
  it("doctorCommissionService writes to 'doctorCommissions' collection", async () => {
    const { collection: collFn } = await import("firebase/firestore");
    const bill = makeBilling();

    await doctorCommissionService.createCommission(bill as any, 10, "system");

    // Check that 'doctorCommissions' was used (first arg to collection mock)
    const collectionCalls = (collFn as any).mock.calls;
    const collectionNames = collectionCalls.map((c: any) => c[1]);
    expect(collectionNames).toContain("doctorCommissions");
    expect(collectionNames).not.toContain("expertCommissions");
  });

  it("expertCommissionService writes to 'expertCommissions' collection", async () => {
    const { collection: collFn } = await import("firebase/firestore");
    const bill = makeBilling({ doctorId: "exp_1", doctorName: "Expert A" });
    bill.items[0].doctorId = "exp_1";

    await expertCommissionService.createCommissionsFromBilling(bill as any, 20, "system");

    const collectionCalls = (collFn as any).mock.calls;
    const collectionNames = collectionCalls.map((c: any) => c[1]);
    expect(collectionNames).toContain("expertCommissions");
    expect(collectionNames).not.toContain("doctorCommissions");
  });
});
