/**
 * auditLogService.test.ts
 *
 * Unit tests for the three audit-log helpers added to close the "18
 * silent write paths" gap in wallet/package/commission services —
 * collecting a deposit, spending wallet credit, consuming a prepaid
 * package session, and every commission create/pay/cancel/clawback
 * previously left no durable record of who did it or why.
 *
 * These test the helpers' own document-shaping logic in isolation
 * (eventType, details payload, undefined stripping) — the per-service
 * instrumentation itself (walletService, patientPackageService, the four
 * commission services) is exercised by their own existing test suites,
 * each with auditLogService stubbed so it doesn't interfere with their
 * addDoc/updateDoc call-count assertions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { auditLogService } from "../auditLogService";

const addDocMock = vi.fn().mockResolvedValue({ id: "log_1" });

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");

  return {
    ...actual,
    collection: vi.fn((_db: any, name: string) => ({ __collection: name })),
    addDoc: (...args: any[]) => addDocMock(...args),
    Timestamp: {
      now: () => ({ __now: true }),
      fromDate: (d: Date) => ({ __fromDate: d }),
    },
  };
});

vi.mock("../../config/firebase", () => ({ db: {}, auth: { currentUser: null } }));
vi.mock("../config/firebase", () => ({ db: {}, auth: { currentUser: null } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auditLogService.logWalletTransaction", () => {
  it("writes a wallet_transaction entry with the deposit/deduction/refund details", async () => {
    await auditLogService.logWalletTransaction({
      performedBy: "staff_1",
      clinicId: "clinic_1",
      patientId: "pat_1",
      patientName: "Patient One",
      type: "deposit",
      amount: 500,
      notes: "Check-in deposit",
      referenceId: "appt_1",
      referenceType: "appointment",
    });

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const entry = addDocMock.mock.calls[0][1];

    expect(entry.eventType).toBe("wallet_transaction");
    expect(entry.performedBy).toBe("staff_1");
    expect(entry.clinicId).toBe("clinic_1");
    expect(entry.status).toBe("success");
    expect(entry.details).toEqual({
      patientId: "pat_1",
      patientName: "Patient One",
      type: "deposit",
      amount: 500,
      notes: "Check-in deposit",
      referenceId: "appt_1",
      referenceType: "appointment",
    });
  });

  it("strips undefined optional fields rather than writing them", async () => {
    await auditLogService.logWalletTransaction({
      performedBy: "staff_1",
      clinicId: "clinic_1",
      patientId: "pat_1",
      type: "deduction",
      amount: 200,
    });

    const entry = addDocMock.mock.calls[0][1];

    expect("patientName" in entry.details).toBe(false);
    expect("notes" in entry.details).toBe(false);
    expect("referenceId" in entry.details).toBe(false);
  });
});

describe("auditLogService.logPackageSessionEvent", () => {
  it("writes a package_session_event entry for a consumed session", async () => {
    await auditLogService.logPackageSessionEvent({
      performedBy: "doc_1",
      clinicId: "clinic_1",
      packageId: "pkg_1",
      packageName: "10x Laser",
      patientId: "pat_1",
      action: "session_consumed",
      details: { appointmentId: "appt_1", walletDeducted: 300 },
    });

    const entry = addDocMock.mock.calls[0][1];

    expect(entry.eventType).toBe("package_session_event");
    expect(entry.details).toEqual({
      packageId: "pkg_1",
      packageName: "10x Laser",
      patientId: "pat_1",
      action: "session_consumed",
      appointmentId: "appt_1",
      walletDeducted: 300,
    });
  });
});

describe("auditLogService.logCommissionEvent", () => {
  it("writes a commission_event entry for a payout, naming the clinician type", async () => {
    await auditLogService.logCommissionEvent({
      performedBy: "admin_1",
      clinicId: "clinic_1",
      branchId: "branch_1",
      commissionId: "comm_1",
      clinicianType: "doctor",
      clinicianId: "doc_1",
      clinicianName: "Dr. A",
      action: "paid",
      amount: 500,
      billingId: "bill_1",
    });

    const entry = addDocMock.mock.calls[0][1];

    expect(entry.eventType).toBe("commission_event");
    expect(entry.details).toEqual({
      commissionId: "comm_1",
      clinicianType: "doctor",
      clinicianId: "doc_1",
      clinicianName: "Dr. A",
      action: "paid",
      amount: 500,
      billingId: "bill_1",
    });
  });

  it("covers every clinician type the four commission services use", async () => {
    for (const clinicianType of [
      "doctor",
      "expert",
      "staff",
      "referral-partner",
    ] as const) {
      await auditLogService.logCommissionEvent({
        performedBy: "system",
        clinicId: "clinic_1",
        commissionId: "comm_x",
        clinicianType,
        action: "created",
      });
    }

    expect(addDocMock).toHaveBeenCalledTimes(4);
    const types = addDocMock.mock.calls.map((c) => c[1].details.clinicianType);

    expect(types).toEqual(["doctor", "expert", "staff", "referral-partner"]);
  });
});
