/**
 * patientPackages.test.ts
 *
 * Regression tests for the treatment-packages fixes this session:
 * 1. consumeSession — idempotency guard (no double-consumption per appointment)
 * 2. consumeSession — expiry enforced off expiresAt, not a stale status field
 * 3. consumeSession — refunded packages can't be consumed
 * 4. refundUnusedSessions — happy path (wallet credited, package closed out)
 * 5. refundUnusedSessions — guard conditions (nothing to refund, already
 *    refunded, invalid amount)
 * 6. walletService.refundFunds — records a "refund"-typed transaction and
 *    credits the wallet balance
 * 7. getPatientPackagesByClinic — queries by clinicId (+ optional branchId)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { patientPackageService } from "../patientPackageService";
import { walletService } from "../walletService";

// ─── Firebase mocks ─────────────────────────────────────────────────────────
const addDocMock = vi.fn().mockResolvedValue({ id: "new_doc_id" });
const updateDocMock = vi.fn().mockResolvedValue(undefined);
const getDocMock = vi.fn();
const getDocsMock = vi.fn().mockResolvedValue({ docs: [], empty: true });
const whereMock = vi.fn((...args: any[]) => ({ __where: args }));
const queryMock = vi.fn((...args: any[]) => ({ __query: args }));

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");

  return {
    ...actual,
    collection: vi.fn((_db: any, name: string) => ({ __collection: name })),
    addDoc: (...args: any[]) => addDocMock(...args),
    updateDoc: (...args: any[]) => updateDocMock(...args),
    getDoc: (...args: any[]) => getDocMock(...args),
    getDocs: (...args: any[]) => getDocsMock(...args),
    doc: vi.fn((_db: any, collectionName: string, id: string) => ({
      id,
      __collection: collectionName,
      ref: { id, __collection: collectionName },
    })),
    query: (...args: any[]) => queryMock(...args),
    where: (...args: any[]) => whereMock(...args),
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (...args: any[]) => ({ __arrayUnion: args }),
    Timestamp: {
      fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000) }),
      now: () => ({ seconds: Math.floor(Date.now() / 1000) }),
    },
  };
});

vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("../../config/firebase", () => ({ db: {} }));
vi.mock("../config/firebase", () => ({ db: {} }));

function makePackage(overrides: Record<string, any> = {}) {
  return {
    id: "pkg_1",
    patientId: "pat_1",
    packageId: "treatment_pkg_1",
    packageName: "10x Laser Hair Removal",
    clinicId: "clinic_1",
    branchId: "branch_1",
    totalSessions: 10,
    usedSessions: 3,
    sessions: [],
    status: "active",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  addDocMock.mockResolvedValue({ id: "new_doc_id" });
  updateDocMock.mockResolvedValue(undefined);
  getDocsMock.mockResolvedValue({ docs: [], empty: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// 1-3. consumeSession guards
// ═══════════════════════════════════════════════════════════════════════════
describe("consumeSession — duplicate-consumption guard (bug fix)", () => {
  it("skips consumption when a session ticket is already completed for this appointment", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () =>
        makePackage({
          usedSessions: 3,
          sessions: [
            { sessionNumber: 1, status: "completed", appointmentId: "appt_1" },
          ],
        }),
    });

    await patientPackageService.consumeSession("pkg_1", {
      appointmentId: "appt_1",
    });

    // No usedSessions increment, no wallet deduction attempt
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it("allows consumption for a genuinely new appointment", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () =>
        makePackage({
          usedSessions: 3,
          sessions: [
            { sessionNumber: 1, status: "completed", appointmentId: "appt_1" },
            { sessionNumber: 2, status: "pending" },
          ],
        }),
    });
    getDocMock.mockResolvedValueOnce({
      exists: () => false, // treatmentPackage lookup for wallet deduction
    });

    await patientPackageService.consumeSession("pkg_1", {
      appointmentId: "appt_2",
    });

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const updates = updateDocMock.mock.calls[0][1];

    expect(updates.usedSessions).toEqual({ __increment: 1 });
  });
});

describe("consumeSession — expiry enforced off expiresAt, not stale status (bug fix)", () => {
  it("blocks consumption when expiresAt has passed, even if status is still 'active'", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () =>
        makePackage({
          status: "active", // stale — never got corrected to "expired"
          expiresAt: { toDate: () => pastDate },
        }),
    });

    await expect(
      patientPackageService.consumeSession("pkg_1", {
        appointmentId: "appt_new",
      }),
    ).rejects.toThrow("Package is expired");
  });

  it("allows consumption when expiresAt is in the future", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () =>
        makePackage({
          status: "active",
          expiresAt: { toDate: () => futureDate },
        }),
    });
    getDocMock.mockResolvedValueOnce({ exists: () => false });

    await patientPackageService.consumeSession("pkg_1", {
      appointmentId: "appt_new",
    });

    expect(updateDocMock).toHaveBeenCalledTimes(1);
  });
});

describe("consumeSession — refunded packages can't be consumed (bug fix)", () => {
  it("blocks consumption when status is 'refunded'", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => makePackage({ status: "refunded" }),
    });

    await expect(
      patientPackageService.consumeSession("pkg_1", {
        appointmentId: "appt_new",
      }),
    ).rejects.toThrow("Package has been refunded and closed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4-5. refundUnusedSessions
// ═══════════════════════════════════════════════════════════════════════════
describe("refundUnusedSessions — happy path", () => {
  it("credits the wallet and closes the package out as refunded", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => makePackage({ totalSessions: 10, usedSessions: 4 }), // 6 unused
    });

    await patientPackageService.refundUnusedSessions(
      "pkg_1",
      1200,
      "Patient relocating",
      "staff_1",
    );

    // addDoc for the wallet transaction
    expect(addDocMock).toHaveBeenCalledTimes(1);
    const txn = addDocMock.mock.calls[0][1];

    expect(txn.type).toBe("refund");
    expect(txn.amount).toBe(1200);
    expect(txn.referenceId).toBe("pkg_1");

    // Two updateDoc calls: patient wallet balance increment, package status update
    expect(updateDocMock).toHaveBeenCalledTimes(2);
    const balanceUpdate = updateDocMock.mock.calls[0][1];

    expect(balanceUpdate.walletBalance).toEqual({ __increment: 1200 });

    const pkgUpdate = updateDocMock.mock.calls[1][1];

    expect(pkgUpdate.status).toBe("refunded");
    expect(pkgUpdate.refundedAmount).toBe(1200);
    expect(pkgUpdate.refundedSessions).toBe(6);
    expect(pkgUpdate.refundReason).toBe("Patient relocating");
  });
});

describe("refundUnusedSessions — guard conditions", () => {
  it("throws when there are no unused sessions to refund", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => makePackage({ totalSessions: 10, usedSessions: 10 }),
    });

    await expect(
      patientPackageService.refundUnusedSessions("pkg_1", 500, "reason", "staff_1"),
    ).rejects.toThrow("No unused sessions remain");
  });

  it("throws when the package is already refunded", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => makePackage({ status: "refunded", usedSessions: 4 }),
    });

    await expect(
      patientPackageService.refundUnusedSessions("pkg_1", 500, "reason", "staff_1"),
    ).rejects.toThrow("already been refunded");
  });

  it("throws when the refund amount is not positive", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => makePackage({ totalSessions: 10, usedSessions: 4 }),
    });

    await expect(
      patientPackageService.refundUnusedSessions("pkg_1", 0, "reason", "staff_1"),
    ).rejects.toThrow("must be greater than 0");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. walletService.refundFunds
// ═══════════════════════════════════════════════════════════════════════════
describe("walletService.refundFunds", () => {
  it("records a refund-typed transaction and credits the wallet balance", async () => {
    await walletService.refundFunds(
      "pat_1",
      "clinic_1",
      "branch_1",
      800,
      "pkg_1",
      "Unused sessions refund",
      "staff_1",
    );

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const txn = addDocMock.mock.calls[0][1];

    expect(txn.type).toBe("refund");
    expect(txn.amount).toBe(800);
    expect(txn.referenceId).toBe("pkg_1");

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    expect(updateDocMock.mock.calls[0][1].walletBalance).toEqual({
      __increment: 800,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. getPatientPackagesByClinic
// ═══════════════════════════════════════════════════════════════════════════
describe("getPatientPackagesByClinic", () => {
  it("queries by clinicId only when no branchId is given", async () => {
    getDocsMock.mockResolvedValueOnce({ docs: [], empty: true });

    await patientPackageService.getPatientPackagesByClinic("clinic_1");

    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(whereMock).toHaveBeenCalledWith("clinicId", "==", "clinic_1");
  });

  it("also filters by branchId when provided", async () => {
    getDocsMock.mockResolvedValueOnce({ docs: [], empty: true });

    await patientPackageService.getPatientPackagesByClinic("clinic_1", "branch_1");

    expect(whereMock).toHaveBeenCalledTimes(2);
    expect(whereMock).toHaveBeenCalledWith("branchId", "==", "branch_1");
  });

  it("returns mapped packages from the query results", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          id: "pkg_a",
          ref: { id: "pkg_a" },
          data: () => makePackage({ id: "pkg_a" }),
        },
      ],
      empty: false,
    });

    const results = await patientPackageService.getPatientPackagesByClinic(
      "clinic_1",
    );

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("pkg_a");
  });
});
