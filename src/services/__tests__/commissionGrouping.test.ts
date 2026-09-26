/**
 * commissionGrouping.test.ts
 *
 * Tests the actual production commission-generation functions that consume
 * this session's category-driven `item.commission`/`item.calculateCommission`
 * fields:
 *   - doctorCommissionService.createCommission
 *   - expertCommissionService.createCommissionsFromBilling
 *
 * These are the functions that turn an invoice's per-item commission data
 * into real, payable commission records — as distinct from
 * expertCommissionService.createCommission, which is a flat-rate,
 * single-clinician referral-bonus path already covered by
 * commissionFixes.test.ts. Neither of the two per-item functions tested here
 * had any coverage before this file, despite being the functions this whole
 * session's category-priority commission work (Appointment Type Settings'
 * "Default Commission %", multi-clinician procedure splits, etc.) actually
 * flows through.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { doctorCommissionService } from "../doctorCommissionService";
import { expertCommissionService } from "../expertCommissionService";

// ─── Firebase mocks ─────────────────────────────────────────────────────────
const addDocMock = vi.fn().mockResolvedValue({ id: "comm_id_1" });
const updateDocMock = vi.fn().mockResolvedValue(undefined);
const getDocsMock = vi.fn().mockResolvedValue({ docs: [], empty: true });

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");

  return {
    ...actual,
    collection: vi.fn(),
    addDoc: (...args: any[]) => addDocMock(...args),
    updateDoc: (...args: any[]) => updateDocMock(...args),
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
  return { id, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  addDocMock.mockResolvedValue({ id: "comm_id_1" });
  updateDocMock.mockResolvedValue(undefined);
  getDocsMock.mockResolvedValue({ docs: [], empty: true });
});

// A minimal, realistic invoice: subtotal/discount fields mirror what
// appointmentBillingService actually persists (see the taxableAmount/
// exemptAmount persistence fixes earlier this session).
function baseBilling(items: any[], overrides: Record<string, any> = {}) {
  return {
    id: "bill_1",
    clinicId: "clinic_1",
    branchId: "branch_1",
    invoiceNumber: "INV-100",
    invoiceDate: new Date(),
    doctorId: "fallback_doc",
    doctorName: "Fallback Doctor",
    patientId: "pat_1",
    patientName: "Test Patient",
    items,
    subtotal: items.reduce((s, i) => s + i.amount, 0),
    itemDiscountAmount: 0,
    mainDiscountAmount: 0,
    totalAmount: items.reduce((s, i) => s + i.amount, 0),
    ...overrides,
  };
}

describe("doctorCommissionService.createCommission — per-item, category-driven commission", () => {
  it("uses each item's own commission % (category override) instead of one blended rate", async () => {
    // Doctor Consultation: category configured non-commission-bearing (0%
    // via explicit commission field). Skin Test-style procedure: category
    // configured at 15% (item.commission), which must win over the doctor's
    // own blanket default (10%, the function's second argument).
    const billing = baseBilling([
      {
        doctorId: "doc_1",
        doctorName: "Dr. A",
        appointmentTypeName: "Doctor Consultation",
        amount: 700,
        commission: 0,
      },
      {
        doctorId: "doc_1",
        doctorName: "Dr. A",
        appointmentTypeName: "Skin Test",
        amount: 300,
        commission: 15,
      },
    ]);

    await doctorCommissionService.createCommission(
      billing as any,
      10, // doctor's own blanket default — must be overridden per item
      "system",
    );

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const saved = addDocMock.mock.calls[0][1];

    // 700 * 0% + 300 * 15% = 45
    expect(saved.commissionAmount).toBeCloseTo(45);
    expect(saved.doctorId).toBe("doc_1");
  });

  it("falls back to the clinician's blanket default when an item has no commission field", async () => {
    const billing = baseBilling([
      {
        doctorId: "doc_1",
        doctorName: "Dr. A",
        appointmentTypeName: "Follow-up",
        amount: 500,
        // no `commission` field at all — unconfigured category
      },
    ]);

    await doctorCommissionService.createCommission(billing as any, 12, "system");

    const saved = addDocMock.mock.calls[0][1];

    // 500 * 12% = 60
    expect(saved.commissionAmount).toBeCloseTo(60);
  });

  it("excludes an item entirely when its category disabled commission (calculateCommission: false)", async () => {
    const billing = baseBilling([
      {
        doctorId: "doc_1",
        doctorName: "Dr. A",
        appointmentTypeName: "Registration Fee",
        amount: 100,
        commission: 20, // even if a rate is set, calculateCommission:false wins
        calculateCommission: false,
      },
      {
        doctorId: "doc_1",
        doctorName: "Dr. A",
        appointmentTypeName: "Consultation",
        amount: 700,
        commission: 10,
      },
    ]);

    await doctorCommissionService.createCommission(billing as any, 10, "system");

    const saved = addDocMock.mock.calls[0][1];

    // Registration Fee (100 @ 20%) excluded entirely — not just zeroed, but
    // dropped from groupSubtotal too, per the source's explicit skip.
    expect(saved.commissionAmount).toBeCloseTo(70); // 700 * 10%
    expect(saved.totalInvoiceAmount).toBeCloseTo(700); // groupSubtotal excludes the disabled item
    expect(saved.serviceNames).toEqual(["Consultation"]);
  });

  it("prorates the invoice-level discount across items before computing each item's commission", async () => {
    const billing = baseBilling(
      [
        {
          doctorId: "doc_1",
          doctorName: "Dr. A",
          appointmentTypeName: "Procedure",
          amount: 900, // already net of item-level discount
          commission: 10,
        },
      ],
      {
        subtotal: 1000,
        itemDiscountAmount: 100, // 1000 -> 900 (matches item.amount)
        mainDiscountAmount: 90, // extra 10% invoice-level discount on top
      },
    );

    await doctorCommissionService.createCommission(billing as any, 10, "system");

    const saved = addDocMock.mock.calls[0][1];

    // validTotal = 1000 - 100 = 900; discountRatio = (900 - 90) / 900 = 0.9
    // effectiveItemAmount = 900 * 0.9 = 810; commission = 810 * 10% = 81
    expect(saved.commissionAmount).toBeCloseTo(81);
  });

  it("splits a multi-clinician invoice into one commission record per doctor, from only their own items", async () => {
    const billing = baseBilling([
      {
        doctorId: "doc_1",
        doctorName: "Dr. A",
        appointmentTypeName: "Consultation",
        amount: 700,
        commission: 10,
      },
      {
        doctorId: "doc_2",
        doctorName: "Dr. B",
        appointmentTypeName: "Second Opinion",
        amount: 500,
        commission: 20,
      },
    ]);

    const ids = await doctorCommissionService.createCommission(
      billing as any,
      10,
      "system",
    );

    expect(ids).toHaveLength(2);
    expect(addDocMock).toHaveBeenCalledTimes(2);

    const savedByDoctor = Object.fromEntries(
      addDocMock.mock.calls.map((call) => [call[1].doctorId, call[1]]),
    );

    expect(savedByDoctor["doc_1"].commissionAmount).toBeCloseTo(70); // 700*10%
    expect(savedByDoctor["doc_2"].commissionAmount).toBeCloseTo(100); // 500*20%
  });

  it("skips creating a duplicate commission for a doctor who already has one on this billing", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [fakeDocSnap("existing", { billingId: "bill_1", doctorId: "doc_1" })],
      empty: false,
    });

    const billing = baseBilling([
      {
        doctorId: "doc_1",
        doctorName: "Dr. A",
        appointmentTypeName: "Consultation",
        amount: 700,
        commission: 10,
      },
    ]);

    const ids = await doctorCommissionService.createCommission(billing as any, 10, "system");

    expect(ids).toEqual([]);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it("produces zero commission (and no record) when every item is disabled or zero-rate", async () => {
    const billing = baseBilling([
      {
        doctorId: "doc_1",
        doctorName: "Dr. A",
        appointmentTypeName: "Doctor Consultation",
        amount: 700,
        commission: 0,
      },
    ]);

    const ids = await doctorCommissionService.createCommission(billing as any, 10, "system");

    expect(ids).toEqual([]);
    expect(addDocMock).not.toHaveBeenCalled();
  });
});

describe("expertCommissionService.createCommissionsFromBilling — per-item, category-driven commission", () => {
  it("uses each item's own commission % (category override) instead of the passed default", async () => {
    const billing = baseBilling([
      {
        doctorId: "exp_1",
        doctorName: "Expert A",
        appointmentTypeName: "Skin Test",
        amount: 300,
        commission: 15,
      },
      {
        doctorId: "exp_1",
        doctorName: "Expert A",
        appointmentTypeName: "Consultation Add-on",
        amount: 200,
        // no commission field -> falls back to the passed default (5)
      },
    ]);

    await expertCommissionService.createCommissionsFromBilling(
      billing as any,
      5,
      "system",
    );

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const saved = addDocMock.mock.calls[0][1];

    // 300 * 15% + 200 * 5% = 45 + 10 = 55
    expect(saved.commissionAmount).toBeCloseTo(55);
    expect(saved.expertId).toBe("exp_1");
  });

  it("excludes an item entirely when its category disabled commission", async () => {
    const billing = baseBilling([
      {
        doctorId: "exp_1",
        doctorName: "Expert A",
        appointmentTypeName: "Basic Registration",
        amount: 100,
        commission: 25,
        calculateCommission: false,
      },
      {
        doctorId: "exp_1",
        doctorName: "Expert A",
        appointmentTypeName: "Procedure",
        amount: 400,
        commission: 10,
      },
    ]);

    await expertCommissionService.createCommissionsFromBilling(billing as any, 10, "system");

    const saved = addDocMock.mock.calls[0][1];

    expect(saved.commissionAmount).toBeCloseTo(40); // 400 * 10% only
  });

  it("splits a multi-expert invoice into one commission record per expert", async () => {
    const billing = baseBilling([
      {
        doctorId: "exp_1",
        doctorName: "Expert A",
        appointmentTypeName: "Procedure — Expert A's share",
        amount: 250,
        commission: 10,
      },
      {
        doctorId: "exp_2",
        doctorName: "Expert B",
        appointmentTypeName: "Procedure — Expert B's share",
        amount: 250,
        commission: 10,
      },
    ]);

    const ids = await expertCommissionService.createCommissionsFromBilling(
      billing as any,
      10,
      "system",
    );

    expect(ids).toHaveLength(2);

    const savedByExpert = Object.fromEntries(
      addDocMock.mock.calls.map((call) => [call[1].expertId, call[1]]),
    );

    // Each expert earns commission on their own split share only (25 each),
    // matching the multi-clinician procedure-fee split added this session.
    expect(savedByExpert["exp_1"].commissionAmount).toBeCloseTo(25);
    expect(savedByExpert["exp_2"].commissionAmount).toBeCloseTo(25);
  });

  it("stores this expert's own eligible base as totalInvoiceAmount, not the whole invoice's tax-inclusive total", async () => {
    // Two experts on one invoice, plus tax — expert A's own eligible base
    // (their items' amount, discount-prorated) must not be reported as the
    // whole invoice's total (which includes expert B's items and VAT), or
    // the effective-% shown in commission reports comes out nonsensically
    // low, exactly the bug doctorCommissionService.createCommission already
    // fixed for doctors (see its "Use the post-discount eligible business
    // subtotal instead of global billing.totalAmount" comment).
    const billing = baseBilling(
      [
        {
          doctorId: "exp_1",
          doctorName: "Expert A",
          appointmentTypeName: "Skin Test",
          amount: 300,
          commission: 10,
        },
        {
          doctorId: "exp_2",
          doctorName: "Expert B",
          appointmentTypeName: "Botox",
          amount: 2000,
          commission: 10,
        },
      ],
      {
        subtotal: 2300,
        totalAmount: 2599, // 2300 + 13% VAT — a much bigger, unrelated number
      },
    );

    await expertCommissionService.createCommissionsFromBilling(billing as any, 10, "system");

    const savedByExpert = Object.fromEntries(
      addDocMock.mock.calls.map((call) => [call[1].expertId, call[1]]),
    );

    // Expert A's own eligible base is 300, not the whole invoice's 2599.
    expect(savedByExpert["exp_1"].totalInvoiceAmount).toBeCloseTo(300);
    expect(savedByExpert["exp_1"].totalInvoiceAmount).not.toBeCloseTo(2599);
  });

  it("skips creating a duplicate commission for an expert who already has one on this billing", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [fakeDocSnap("existing", { billingId: "bill_1", expertId: "exp_1" })],
      empty: false,
    });

    const billing = baseBilling([
      {
        doctorId: "exp_1",
        doctorName: "Expert A",
        appointmentTypeName: "Procedure",
        amount: 300,
        commission: 15,
      },
    ]);

    const ids = await expertCommissionService.createCommissionsFromBilling(
      billing as any,
      10,
      "system",
    );

    expect(ids).toEqual([]);
    expect(addDocMock).not.toHaveBeenCalled();
  });
});
