/**
 * commissionFixes.test.ts
 *
 * Regression tests for the commission-audit fixes:
 * 1. getCommissionsByBillingId (plural) exists on all 4 commission services
 *    and returns EVERY matching doc, not just the first.
 * 2. expertCommissionService/staffCommissionService now have
 *    updateCommissionStatus and correctly reverse balances on cancel.
 * 3. expertCommissionService.createCommission now computes on the
 *    discount-adjusted subtotal, not the raw tax-inclusive totalAmount.
 * 4. doctorCommissionService.createPathologyCommissions now has a
 *    duplicate-creation guard (mirrors referralCommissionService's).
 * 5. Pathology's referring-doctor calculatedAmount formula (extracted,
 *    since it lives in a React component) uses the discount-adjusted base,
 *    not raw pre-discount subtotal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { doctorCommissionService } from "../doctorCommissionService";
import { expertCommissionService } from "../expertCommissionService";
import { staffCommissionService } from "../staffCommissionService";
import { referralCommissionService } from "../referralCommissionService";

// ─── Firebase mocks ─────────────────────────────────────────────────────────
const addDocMock = vi.fn().mockResolvedValue({ id: "comm_id_1" });
const updateDocMock = vi.fn().mockResolvedValue(undefined);
const getDocMock = vi.fn();
const getDocsMock = vi.fn().mockResolvedValue({ docs: [], empty: true });

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");

  return {
    ...actual,
    collection: vi.fn(),
    addDoc: (...args: any[]) => addDocMock(...args),
    updateDoc: (...args: any[]) => updateDocMock(...args),
    getDoc: (...args: any[]) => getDocMock(...args),
    getDocs: (...args: any[]) => getDocsMock(...args),
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
vi.mock("../../config/firebase", () => ({ db: {} }));
vi.mock("../config/firebase", () => ({ db: {} }));

function fakeDocSnap(id: string, data: Record<string, any>) {
  return {
    id,
    data: () => data,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  addDocMock.mockResolvedValue({ id: "comm_id_1" });
  updateDocMock.mockResolvedValue(undefined);
  getDocsMock.mockResolvedValue({ docs: [], empty: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. getCommissionsByBillingId — plural fetch on all 4 services
// ═══════════════════════════════════════════════════════════════════════════
describe("getCommissionsByBillingId — returns every matching doc, not just the first", () => {
  it("doctorCommissionService returns multiple commission docs for one billing", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        fakeDocSnap("c1", { billingId: "bill_1", doctorId: "doc_1", commissionAmount: 100, status: "pending" }),
        fakeDocSnap("c2", { billingId: "bill_1", doctorId: "doc_2", commissionAmount: 200, status: "pending" }),
      ],
      empty: false,
    });

    const results = await doctorCommissionService.getCommissionsByBillingId("bill_1");

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(["c1", "c2"]);
  });

  it("expertCommissionService returns multiple commission docs for one billing", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        fakeDocSnap("e1", { billingId: "bill_1", expertId: "exp_1", commissionAmount: 50, status: "pending" }),
        fakeDocSnap("e2", { billingId: "bill_1", expertId: "exp_2", commissionAmount: 75, status: "pending" }),
      ],
      empty: false,
    });

    const results = await expertCommissionService.getCommissionsByBillingId("bill_1");

    expect(results).toHaveLength(2);
  });

  it("referralCommissionService returns multiple commission docs for one billing", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        fakeDocSnap("r1", { billingId: "bill_1", partnerId: "p1", commissionAmount: 30, status: "pending" }),
        fakeDocSnap("r2", { billingId: "bill_1", partnerId: "p2", commissionAmount: 40, status: "pending" }),
      ],
      empty: false,
    });

    const results = await referralCommissionService.getCommissionsByBillingId("bill_1");

    expect(results).toHaveLength(2);
  });

  it("staffCommissionService returns multiple commission docs for one billing", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        fakeDocSnap("s1", { billingId: "bill_1", staffId: "st1", commissionAmount: 10, status: "pending" }),
      ],
      empty: false,
    });

    const results = await staffCommissionService.getCommissionsByBillingId("bill_1");

    expect(results).toHaveLength(1);
  });

  it("returns an empty array (not null/throw) when no commissions exist", async () => {
    getDocsMock.mockResolvedValueOnce({ docs: [], empty: true });

    const results = await doctorCommissionService.getCommissionsByBillingId("bill_none");

    expect(results).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. updateCommissionStatus — now exists on expert/staff, reverses balances
// ═══════════════════════════════════════════════════════════════════════════
describe("updateCommissionStatus — newly added to expert/staff services", () => {
  it("expertCommissionService reverts expert balance when cancelling a pending commission", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        expertId: "exp_1",
        commissionAmount: 500,
        paidAmount: 0,
        status: "pending",
      }),
    });

    await expertCommissionService.updateCommissionStatus("comm_1", "cancelled");

    expect(updateDocMock).toHaveBeenCalledTimes(2);
    const balanceRevert = updateDocMock.mock.calls[0][1];

    expect(balanceRevert.totalCommissionEarned).toEqual({ __increment: -500 });
    expect(balanceRevert.totalCommissionBalance).toEqual({ __increment: -500 });
  });

  it("expertCommissionService does NOT double-revert an already-cancelled commission", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        expertId: "exp_1",
        commissionAmount: 500,
        paidAmount: 0,
        status: "cancelled",
      }),
    });

    await expertCommissionService.updateCommissionStatus("comm_1", "cancelled");

    expect(updateDocMock).toHaveBeenCalledTimes(1);
  });

  it("staffCommissionService reverts staff balance when cancelling a pending commission", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        staffId: "staff_1",
        commissionAmount: 300,
        paidAmount: 100,
        status: "pending",
      }),
    });

    await staffCommissionService.updateCommissionStatus("comm_1", "cancelled");

    expect(updateDocMock).toHaveBeenCalledTimes(2);
    const balanceRevert = updateDocMock.mock.calls[0][1];

    expect(balanceRevert.totalCommissionEarned).toEqual({ __increment: -300 });
    // remaining balance = commissionAmount - paidAmount = 300 - 100 = 200
    expect(balanceRevert.totalCommissionBalance).toEqual({ __increment: -200 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. expertCommissionService.createCommission — fixed base calculation
// ═══════════════════════════════════════════════════════════════════════════
describe("expertCommissionService.createCommission — discount-adjusted base (bug fix)", () => {
  it("computes commission on the discounted subtotal, NOT the tax-inclusive total", async () => {
    addDocMock.mockResolvedValueOnce({ id: "comm_expert_1" });

    const billing = {
      id: "bill_1",
      clinicId: "clinic_1",
      branchId: "branch_1",
      invoiceNumber: "INV-001",
      invoiceDate: new Date(),
      patientId: "pat_1",
      patientName: "Test Patient",
      // item.amount already reflects itemDiscountAmount applied (1000 - 100),
      // matching how real AppointmentBillingItem.amount is populated
      // elsewhere in the codebase.
      items: [{ appointmentTypeName: "Laser", amount: 900 }],
      subtotal: 1000,
      itemDiscountAmount: 100, // item-level discount
      mainDiscountAmount: 50, // invoice-level discount
      taxAmount: 130, // 13% VAT on the discounted 850
      totalAmount: 980, // 850 + 130 tax — the WRONG (old) base
    };

    await expertCommissionService.createCommission(
      "exp_1",
      "Expert A",
      billing as any,
      10, // 10% referral-bonus commission
      "system",
    );

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const saved = addDocMock.mock.calls[0][1];

    // Correct base: subtotal(1000) - itemDiscount(100) - mainDiscount(50) = 850
    // Commission: 850 * 10% = 85 (NOT 980 * 10% = 98, the pre-fix bug)
    expect(saved.commissionAmount).toBeCloseTo(85);
    expect(saved.commissionAmount).not.toBeCloseTo(98);
  });

  it("never goes negative when discounts exceed the subtotal", async () => {
    addDocMock.mockResolvedValueOnce({ id: "comm_expert_2" });

    const billing = {
      id: "bill_2",
      clinicId: "clinic_1",
      branchId: "branch_1",
      invoiceNumber: "INV-002",
      invoiceDate: new Date(),
      patientId: "pat_1",
      patientName: "Test Patient",
      items: [{ appointmentTypeName: "Laser", amount: 20 }], // 100 - 80 itemDiscount
      subtotal: 100,
      itemDiscountAmount: 80,
      mainDiscountAmount: 50, // discounts (130) exceed subtotal (100)
      totalAmount: 0,
    };

    await expertCommissionService.createCommission(
      "exp_1",
      "Expert A",
      billing as any,
      10,
      "system",
    );

    const saved = addDocMock.mock.calls[0][1];

    expect(saved.commissionAmount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. doctorCommissionService.createPathologyCommissions — dedup guard
// ═══════════════════════════════════════════════════════════════════════════
describe("doctorCommissionService.createPathologyCommissions — duplicate-creation guard (bug fix)", () => {
  const billing = {
    id: "path_bill_1",
    clinicId: "clinic_1",
    branchId: "branch_1",
    invoiceNumber: "PATH-001",
    invoiceDate: new Date(),
    patientName: "Test Patient",
    totalAmount: 1000,
    items: [{ testName: "CBC" }],
    referringDoctors: [
      {
        doctorId: "doc_1",
        doctorName: "Dr. Referrer",
        commissionType: "percent",
        commissionValue: 10,
        calculatedAmount: 100,
      },
    ],
  };

  it("creates a commission when none exists yet for this billing+doctor", async () => {
    getDocsMock.mockResolvedValueOnce({ docs: [], empty: true }); // dedup check: none found
    addDocMock.mockResolvedValueOnce({ id: "comm_new" });

    const ids = await doctorCommissionService.createPathologyCommissions(
      billing as any,
      "system",
    );

    expect(ids).toEqual(["comm_new"]);
    expect(addDocMock).toHaveBeenCalledTimes(1);
  });

  it("skips creating a duplicate when a commission already exists for this billing+doctor", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [fakeDocSnap("existing", { billingId: "path_bill_1", doctorId: "doc_1" })],
      empty: false,
    }); // dedup check: already exists

    const ids = await doctorCommissionService.createPathologyCommissions(
      billing as any,
      "system",
    );

    expect(ids).toEqual([]);
    expect(addDocMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Pathology referring-doctor calculatedAmount — discount-adjusted base
//    (pure formula extracted from PathologyBillingTab.tsx's
//    updateReferringDoctor/addReferringDoctor, mirroring the fix applied)
// ═══════════════════════════════════════════════════════════════════════════
function calcReferringDoctorAmount(
  subtotal: number,
  totalDiscount: number,
  commissionType: "percent" | "flat",
  commissionValue: number,
): number {
  const afterDiscount = subtotal - totalDiscount;

  return commissionType === "percent"
    ? (afterDiscount * commissionValue) / 100
    : commissionValue;
}

describe("Pathology referring-doctor commission base (bug fix)", () => {
  it("computes commission on the discount-adjusted subtotal, not raw subtotal", () => {
    // subtotal=1000, discount=200 → afterDiscount=800; 10% of 800 = 80
    const result = calcReferringDoctorAmount(1000, 200, "percent", 10);

    expect(result).toBeCloseTo(80);
    expect(result).not.toBeCloseTo(100); // the pre-fix bug (10% of raw 1000)
  });

  it("matches raw subtotal math when there is no discount", () => {
    const result = calcReferringDoctorAmount(1000, 0, "percent", 10);

    expect(result).toBeCloseTo(100);
  });

  it("flat commission type ignores subtotal/discount entirely", () => {
    const result = calcReferringDoctorAmount(1000, 500, "flat", 250);

    expect(result).toBe(250);
  });
});
