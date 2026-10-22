/**
 * paymentIdempotency.test.ts
 *
 * Regression coverage for recordPayment's missing idempotency guard, found
 * alongside the commission double-payout race this session
 * (commissionRaceCondition.test.ts): eventId was a fresh crypto.randomUUID()
 * on every call, so nothing could tell a retried call apart from a genuinely
 * new payment — a retry re-applied the payment, double-counting paidAmount
 * and (for a wallet payment) deducting the patient's balance a second time.
 *
 * Two independent guards close this, both exercised below:
 *  1. A caller-supplied idempotencyKey, used as the paymentHistory event's
 *     id and checked against the invoice's own paymentHistory inside the
 *     same transaction that applies the payment — a retry whose key is
 *     already recorded is a safe no-op. This covers a retry arriving after
 *     the first attempt already finished (e.g. a dropped response).
 *  2. An in-flight de-dupe keyed by the call's own arguments — two
 *     near-simultaneous calls for the exact same payment (a double-click,
 *     or two tabs) collapse into one actual attempt, with no caller changes
 *     required. This is tested with real overlapping promises, not just a
 *     call-count assertion, since the point is that only one transaction
 *     actually runs while both callers still resolve.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appointmentBillingService } from "../appointmentBillingService";
import { pathologyBillingService } from "../pathologyBillingService";

const store = new Map<string, any>();

const docMock = vi.fn((...args: any[]) => ({ __id: args.slice(1).join("/") }));

function snapshotFor(refId: string) {
  const existing = store.get(refId);

  return {
    exists: () => existing !== undefined,
    data: () => existing,
    id: refId.split("/").pop(),
  };
}

// A real, deferred-resolving transaction mock: each call to runTransaction
// only starts its updateFn once invoked, and two concurrent calls run
// against the SAME store, so a genuine race (both read before either
// writes) would be visible here rather than assumed away.
const runTransactionMock = vi.fn(async (_db: any, updateFn: any) => {
  const transaction = {
    get: async (ref: any) => snapshotFor(ref.__id),
    update: (ref: any, data: any) => {
      const existing = store.get(ref.__id) || {};

      store.set(ref.__id, { ...existing, ...data });
    },
    set: (ref: any, data: any) => {
      store.set(ref.__id, data);
    },
  };

  return updateFn(transaction);
});

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>(
    "firebase/firestore",
  );

  return {
    ...actual,
    collection: vi.fn(),
    doc: (...args: any[]) => docMock(...args),
    getDoc: vi.fn(async (ref: any) => snapshotFor(ref.__id)),
    getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    setDoc: vi.fn(),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
    runTransaction: (db: any, fn: any) => runTransactionMock(db, fn),
    Timestamp: {
      fromDate: (d: Date) => ({ toDate: () => d }),
      now: () => ({ toDate: () => new Date() }),
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

function seedAppointmentBilling(id: string, overrides: any = {}) {
  store.set(`appointmentBilling/${id}`, {
    clinicId: "clinic_1",
    branchId: "branch_1",
    patientId: "pat_1",
    patientName: "Patient",
    invoiceNumber: "INV-1",
    totalAmount: 1000,
    paidAmount: 0,
    balanceAmount: 1000,
    discountAmount: 0,
    paymentStatus: "unpaid",
    paymentHistory: [],
    items: [],
    ...overrides,
  });
}

function seedPathologyBilling(id: string, overrides: any = {}) {
  store.set(`pathologyBilling/${id}`, {
    clinicId: "clinic_1",
    patientId: "pat_1",
    patientName: "Patient",
    invoiceNumber: "PATH-1",
    totalAmount: 1000,
    paidAmount: 0,
    balanceAmount: 1000,
    discountAmount: 0,
    paymentStatus: "unpaid",
    paymentHistory: [],
    items: [],
    referringDoctors: [],
    ...overrides,
  });
}

describe("appointmentBillingService.recordPayment — idempotencyKey guard", () => {
  it("a retried call with the same idempotencyKey is a safe no-op, not a second charge", async () => {
    seedAppointmentBilling("bill_1");

    await appointmentBillingService.recordPayment(
      "bill_1",
      300,
      "cash",
      undefined,
      undefined,
      0,
      { idempotencyKey: "attempt-1" },
    );
    await appointmentBillingService.recordPayment(
      "bill_1",
      300,
      "cash",
      undefined,
      undefined,
      0,
      { idempotencyKey: "attempt-1" },
    );

    const stored = store.get("appointmentBilling/bill_1");

    expect(stored.paidAmount).toBe(300);
    expect(stored.paymentHistory).toHaveLength(1);
  });

  it("two DIFFERENT idempotencyKeys are two real, separate payments — the guard doesn't over-block legitimate repeat payments", async () => {
    seedAppointmentBilling("bill_2");

    await appointmentBillingService.recordPayment(
      "bill_2",
      300,
      "cash",
      undefined,
      undefined,
      0,
      { idempotencyKey: "attempt-1" },
    );
    await appointmentBillingService.recordPayment(
      "bill_2",
      300,
      "cash",
      undefined,
      undefined,
      0,
      { idempotencyKey: "attempt-2" },
    );

    const stored = store.get("appointmentBilling/bill_2");

    expect(stored.paidAmount).toBe(600);
    expect(stored.paymentHistory).toHaveLength(2);
  });
});

describe("appointmentBillingService.recordPayment — in-flight de-dupe", () => {
  it("two concurrent calls with identical arguments collapse into one applied payment", async () => {
    seedAppointmentBilling("bill_3");

    const [a, b] = await Promise.all([
      appointmentBillingService.recordPayment("bill_3", 300, "cash"),
      appointmentBillingService.recordPayment("bill_3", 300, "cash"),
    ]);

    expect(a).toBeUndefined();
    expect(b).toBeUndefined();
    expect(runTransactionMock).toHaveBeenCalledTimes(1);

    const stored = store.get("appointmentBilling/bill_3");

    expect(stored.paidAmount).toBe(300);
    expect(stored.paymentHistory).toHaveLength(1);
  });

  it("two concurrent calls for DIFFERENT invoices run independently — distinct fingerprints are never collapsed together", async () => {
    seedAppointmentBilling("bill_4a");
    seedAppointmentBilling("bill_4b");

    await Promise.all([
      appointmentBillingService.recordPayment("bill_4a", 300, "cash"),
      appointmentBillingService.recordPayment("bill_4b", 200, "card"),
    ]);

    expect(runTransactionMock).toHaveBeenCalledTimes(2);
    expect(store.get("appointmentBilling/bill_4a").paidAmount).toBe(300);
    expect(store.get("appointmentBilling/bill_4b").paidAmount).toBe(200);
  });

  it("a call AFTER the first has resolved is not collapsed — the guard only covers genuinely concurrent calls", async () => {
    seedAppointmentBilling("bill_5");

    await appointmentBillingService.recordPayment("bill_5", 300, "cash");
    await appointmentBillingService.recordPayment("bill_5", 300, "cash");

    expect(runTransactionMock).toHaveBeenCalledTimes(2);

    const stored = store.get("appointmentBilling/bill_5");

    expect(stored.paidAmount).toBe(600);
    expect(stored.paymentHistory).toHaveLength(2);
  });
});

describe("pathologyBillingService.recordPayment — idempotencyKey guard", () => {
  it("a retried call with the same idempotencyKey is a safe no-op, not a second charge", async () => {
    seedPathologyBilling("path_1");

    await pathologyBillingService.recordPayment(
      "path_1",
      300,
      "cash",
      undefined,
      undefined,
      "system",
      0,
      { idempotencyKey: "attempt-1" },
    );
    await pathologyBillingService.recordPayment(
      "path_1",
      300,
      "cash",
      undefined,
      undefined,
      "system",
      0,
      { idempotencyKey: "attempt-1" },
    );

    const stored = store.get("pathologyBilling/path_1");

    expect(stored.paidAmount).toBe(300);
    expect(stored.paymentHistory).toHaveLength(1);
  });

  it("two DIFFERENT idempotencyKeys are two real, separate payments", async () => {
    seedPathologyBilling("path_2");

    await pathologyBillingService.recordPayment(
      "path_2",
      300,
      "cash",
      undefined,
      undefined,
      "system",
      0,
      { idempotencyKey: "attempt-1" },
    );
    await pathologyBillingService.recordPayment(
      "path_2",
      300,
      "cash",
      undefined,
      undefined,
      "system",
      0,
      { idempotencyKey: "attempt-2" },
    );

    const stored = store.get("pathologyBilling/path_2");

    expect(stored.paidAmount).toBe(600);
    expect(stored.paymentHistory).toHaveLength(2);
  });
});

describe("pathologyBillingService.recordPayment — in-flight de-dupe", () => {
  it("two concurrent calls with identical arguments collapse into one applied payment", async () => {
    seedPathologyBilling("path_3");

    await Promise.all([
      pathologyBillingService.recordPayment("path_3", 300, "cash"),
      pathologyBillingService.recordPayment("path_3", 300, "cash"),
    ]);

    expect(runTransactionMock).toHaveBeenCalledTimes(1);

    const stored = store.get("pathologyBilling/path_3");

    expect(stored.paidAmount).toBe(300);
    expect(stored.paymentHistory).toHaveLength(1);
  });
});
