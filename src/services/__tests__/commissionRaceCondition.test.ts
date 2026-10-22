/**
 * commissionRaceCondition.test.ts
 *
 * Regression coverage for the double-payout race condition fixed across
 * every commission-creation path this session (clinicianCommissionService,
 * referralCommissionService, staffCommissionService,
 * doctorCommissionService.createPathologyCommissions): a query-then-addDoc
 * duplicate check is two separate network round trips, so two concurrent
 * calls for the same invoice+clinician could both see "nothing yet" and
 * both write a payout. The fix is a deterministic doc id
 * (commissionDocId/registrationAnchorId) checked inside a transaction, so a
 * second attempt is forced to see what the first just wrote.
 *
 * These tests simulate "called twice for the same thing" directly (the
 * second call's transaction.get sees the first call's write) rather than
 * actually racing two promises — the real race-proofing comes from
 * Firestore's own optimistic concurrency control on the transaction, which
 * isn't present in this mock; what's being verified here is that the
 * application code now asks the right question (by deterministic id) before
 * writing, for every commission-creation path, including the two
 * (referral/staff/doctor/expert registration-time commissions) that had NO
 * duplicate guard at all before this fix.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { referralCommissionService } from "../referralCommissionService";
import { staffCommissionService } from "../staffCommissionService";
import { doctorCommissionService } from "../doctorCommissionService";
import { expertCommissionService } from "../expertCommissionService";

// ─── Firebase mocks: an in-memory store keyed by deterministic doc id, so
// "called twice" is simulated by actually writing into the same fake
// Firestore and letting the second transaction.get see it — not just
// asserting mock.calls counts. ──────────────────────────────────────────────
const store = new Map<string, any>();

const docMock = vi.fn((...args: any[]) => {
  // doc(db, collectionName, docId) — the store key must include the
  // collection name, not just the id: doctorCommissions and
  // expertCommissions can legitimately share the same deterministic id
  // (same patient+clinicianId) without colliding, since they're different
  // collections in real Firestore.
  const key = args.slice(1).join("/");

  return { __id: key };
});

const runTransactionMock = vi.fn(async (_db: any, updateFn: any) => {
  const transaction = {
    get: async (ref: any) => {
      const existing = store.get(ref.__id);

      return { exists: () => existing !== undefined, data: () => existing };
    },
    set: (ref: any, data: any) => {
      store.set(ref.__id, data);
    },
    update: () => {
      // Entity balance updates aren't under test here.
    },
  };

  return updateFn(transaction);
});

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");

  return {
    ...actual,
    collection: vi.fn(),
    doc: (...args: any[]) => docMock(...args),
    addDoc: vi.fn().mockResolvedValue({ id: "unused" }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    getDoc: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ docs: [], empty: true }),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    runTransaction: (db: any, updateFn: any) => runTransactionMock(db, updateFn),
    increment: (n: number) => ({ __increment: n }),
    Timestamp: {
      fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000) }),
      now: () => ({ seconds: Math.floor(Date.now() / 1000) }),
    },
  };
});

vi.mock("@/config/firebase", () => ({ db: {}, auth: { currentUser: null } }));
vi.mock("../../config/firebase", () => ({ db: {}, auth: { currentUser: null } }));
vi.mock("../config/firebase", () => ({ db: {}, auth: { currentUser: null } }));

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
});

describe("referralCommissionService — double-payout guard", () => {
  const partner = { id: "partner_1", name: "Partner A", defaultCommission: 10 } as any;

  it("createReferralCommission: a second call for the same billing+partner creates nothing new", async () => {
    const billing = {
      id: "bill_1",
      clinicId: "clinic_1",
      branchId: "branch_1",
      invoiceNumber: "INV-1",
      invoiceDate: new Date(),
      patientId: "pat_1",
      patientName: "Patient",
      totalAmount: 1000,
      items: [],
    };

    const first = await referralCommissionService.createReferralCommission(
      billing as any,
      partner,
      100,
      "system",
    );
    const second = await referralCommissionService.createReferralCommission(
      billing as any,
      partner,
      100,
      "system",
    );

    expect(first).not.toBeNull();
    expect(second).toBeNull(); // the retry/duplicate is a no-op, not a second payout
    expect(store.size).toBe(1);
  });

  it("createRegistrationCommission: previously had ZERO duplicate guard — now a second call for the same patient+partner is a no-op", async () => {
    const callOnce = () =>
      referralCommissionService.createRegistrationCommission(
        partner,
        "clinic_1",
        "patient_1",
        "Patient",
        "Consultation",
        1000,
        100,
        "system",
      );

    const first = await callOnce();
    const second = await callOnce();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(store.size).toBe(1);
  });

  it("a DIFFERENT patient's registration commission for the same partner is a separate record, not deduped away", async () => {
    await referralCommissionService.createRegistrationCommission(
      partner, "clinic_1", "patient_1", "Patient 1", "Consultation", 1000, 100, "system",
    );
    await referralCommissionService.createRegistrationCommission(
      partner, "clinic_1", "patient_2", "Patient 2", "Consultation", 1000, 100, "system",
    );

    expect(store.size).toBe(2);
  });
});

describe("staffCommissionService.createRegistrationCommission — double-payout guard", () => {
  it("with no billingId (true registration-time path): a second call for the same patient+staff is now a no-op — previously unguarded entirely", async () => {
    const callOnce = () =>
      staffCommissionService.createRegistrationCommission(
        "staff_1", "Staff A", "clinic_1", "patient_1", "Patient", "Consultation",
        1000, 100, 10, "system",
        // no billingId — the true "before any invoice exists" path
      );

    const first = await callOnce();
    const second = await callOnce();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(store.size).toBe(1);
  });

  it("with a real billingId: a second call for the same invoice+staff is a no-op", async () => {
    const callOnce = () =>
      staffCommissionService.createRegistrationCommission(
        "staff_1", "Staff A", "clinic_1", "patient_1", "Patient", "Referral",
        1000, 100, 10, "system", "real_invoice_1",
      );

    const first = await callOnce();
    const second = await callOnce();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(store.size).toBe(1);
  });
});

describe("doctorCommissionService / expertCommissionService.createRegistrationCommission — double-payout guard", () => {
  it("doctor registration commission: a second call for the same patient+doctor is now a no-op — previously unguarded entirely", async () => {
    const callOnce = () =>
      doctorCommissionService.createRegistrationCommission(
        "doc_1", "Dr. A", "clinic_1", "patient_1", "Patient", "Consultation",
        1000, 100, 10, "system",
      );

    const first = await callOnce();
    const second = await callOnce();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(store.size).toBe(1);
  });

  it("expert registration commission: a second call for the same patient+expert is now a no-op", async () => {
    const callOnce = () =>
      expertCommissionService.createRegistrationCommission(
        "exp_1", "Expert A", "clinic_1", "patient_1", "Patient", "Consultation",
        1000, 100, 10, "system",
      );

    const first = await callOnce();
    const second = await callOnce();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(store.size).toBe(1);
  });

  it("a doctor AND an expert registration commission for the same patient don't collide with each other (different collections)", async () => {
    const doctorId = await doctorCommissionService.createRegistrationCommission(
      "clinician_1", "Clinician", "clinic_1", "patient_1", "Patient", "Consultation",
      1000, 100, 10, "system",
    );
    const expertId = await expertCommissionService.createRegistrationCommission(
      "clinician_1", "Clinician", "clinic_1", "patient_1", "Patient", "Consultation",
      1000, 100, 10, "system",
    );

    expect(doctorId).not.toBeNull();
    expect(expertId).not.toBeNull();
    expect(store.size).toBe(2); // doctorCommissions and expertCommissions are separate collections
  });
});

describe("doctorCommissionService.createPathologyCommissions — double-payout guard", () => {
  it("a second call for the same billing+referring-doctor creates nothing new", async () => {
    const billing = {
      id: "path_bill_1",
      clinicId: "clinic_1",
      branchId: "branch_1",
      invoiceNumber: "PATH-1",
      invoiceDate: new Date(),
      patientName: "Patient",
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

    const first = await doctorCommissionService.createPathologyCommissions(
      billing as any,
      "system",
    );
    const second = await doctorCommissionService.createPathologyCommissions(
      billing as any,
      "system",
    );

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0); // retry creates nothing
    expect(store.size).toBe(1);
  });
});
