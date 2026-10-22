/**
 * visitLineService.test.ts
 *
 * visitLineService.ts had zero test coverage — flagged explicitly by the
 * 2026-10-18 audit as "the newest file this session's fix depends on".
 * It's the impure half of the charge core: every front-office screen and
 * the prescription page go through these functions to put a line on a
 * visit and collect the check-in deposit, so a mistake here is a mistake
 * in the money every one of those screens collects.
 *
 * The pure core functions it calls (resolveVisitLine, asCommissionOnlyLine,
 * buildPackageSessionLine, withLinePrice, findBookedLine,
 * getVisitPaymentGate) are used via their REAL implementations — they're
 * already fully tested in their own files, and reimplementing assumptions
 * about their behavior as mocks here would test this file's agreement with
 * a fiction rather than with the real decision logic. Only the actual I/O
 * boundary — Firestore and the other services — is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  findClinician,
  ensureVisitLine,
  ensureSessionLine,
  collectCheckInDue,
  appendBookedLines,
  checkInVisit,
  doctorAsClinician,
  expertAsClinician,
  type VisitLineContext,
  type CatalogueLists,
} from "../visitLineService";

// ─── Firestore mocks ────────────────────────────────────────────────────────
const getDocMock = vi.fn();
const updateDocMock = vi.fn();

// collectCheckInDue/checkInAppointment-style transactions: transaction.get
// routes to getDocMock (queued per call), transaction.update records calls
// for assertion.
const runTransactionMock = vi.fn(async (_db: any, updateFn: any) => {
  const transaction = {
    get: async (ref: any) => getDocMock(ref),
    update: (...args: any[]) => updateDocMock(...args),
  };

  return updateFn(transaction);
});

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>(
    "firebase/firestore",
  );

  return {
    ...actual,
    doc: vi.fn((_db: any, collection: string, id: string) => ({
      __collection: collection,
      __id: id,
    })),
    updateDoc: (...args: any[]) => updateDocMock(...args),
    runTransaction: (db: any, fn: any) => runTransactionMock(db, fn),
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (...vals: any[]) => ({ __arrayUnion: vals }),
    Timestamp: {
      now: () => ({ __now: true }),
      fromDate: (d: Date) => ({ __fromDate: d }),
    },
  };
});

vi.mock("../../config/firebase", () => ({ db: {} }));
vi.mock("../config/firebase", () => ({ db: {} }));

// ─── Service mocks ──────────────────────────────────────────────────────────
const appendPendingVisitLinesMock = vi.fn();
const getAppointmentByIdMock = vi.fn();
const reattributeVisitLineMock = vi.fn().mockResolvedValue(undefined);
const checkInAppointmentMock = vi.fn();
const markCheckInDepositFailedMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../appointmentService", () => ({
  appointmentService: {
    appendPendingVisitLines: (...args: any[]) =>
      appendPendingVisitLinesMock(...args),
    getAppointmentById: (...args: any[]) => getAppointmentByIdMock(...args),
    reattributeVisitLine: (...args: any[]) =>
      reattributeVisitLineMock(...args),
    checkInAppointment: (...args: any[]) => checkInAppointmentMock(...args),
    markCheckInDepositFailed: (...args: any[]) =>
      markCheckInDepositFailedMock(...args),
  },
}));

const getDoctorByIdMock = vi.fn();

vi.mock("../doctorService", () => ({
  doctorService: { getDoctorById: (...args: any[]) => getDoctorByIdMock(...args) },
}));

const getExpertByIdMock = vi.fn();

vi.mock("../expertService", () => ({
  expertService: { getExpertById: (...args: any[]) => getExpertByIdMock(...args) },
}));

const getPatientPackageByIdMock = vi.fn();

vi.mock("../patientPackageService", () => ({
  patientPackageService: {
    getPatientPackageById: (...args: any[]) =>
      getPatientPackageByIdMock(...args),
  },
}));

const deductFundsInTransactionMock = vi.fn();
const addFundsInTransactionMock = vi.fn();

vi.mock("../walletService", () => ({
  PATIENTS_COLLECTION: "patients",
  walletService: {
    deductFundsInTransaction: (...args: any[]) =>
      deductFundsInTransactionMock(...args),
    addFundsInTransaction: (...args: any[]) =>
      addFundsInTransactionMock(...args),
  },
}));

// collectCheckInDue reads BOTH the appointment and the patient inside one
// transaction via Promise.all — dispatching getDocMock by the ref's
// collection (rather than a mockResolvedValueOnce queue) is robust
// regardless of which of the two promises settles first.
let apptFixture: any = null;
let patientFixture: any = null;

beforeEach(() => {
  vi.clearAllMocks();
  appendPendingVisitLinesMock.mockResolvedValue({ added: [{}], skipped: [] });
  deductFundsInTransactionMock.mockReturnValue("wallet_txn_1");
  addFundsInTransactionMock.mockReturnValue("wallet_txn_2");
  // findClinician's fallback fetches default to "not found" rather than
  // undefined — a bare vi.fn() with no queued resolution returns undefined
  // (not a rejected/resolved promise), and findClinician unconditionally
  // calls .catch() on the result.
  getDoctorByIdMock.mockResolvedValue(null);
  getExpertByIdMock.mockResolvedValue(null);
  apptFixture = null;
  patientFixture = null;
  getDocMock.mockImplementation((ref: any) => {
    if (ref.__collection === "appointments") {
      return { exists: () => apptFixture !== null, data: () => apptFixture };
    }
    if (ref.__collection === "patients") {
      return {
        exists: () => patientFixture !== null,
        data: () => patientFixture,
      };
    }

    return { exists: () => false, data: () => undefined };
  });
});

const ctx: VisitLineContext = {
  clinicId: "clinic_1",
  userId: "staff_1",
  pricing: { isTaxEnabled: false, taxPercentage: 0 },
  now: new Date("2026-10-22T09:00:00Z"),
};

const doctor = {
  id: "doc_1",
  name: "Dr. A",
  consultationCharge: 700,
  defaultCommission: 10,
};
const expert = { id: "exp_1", name: "Expert B", defaultCommission: 15 };

const apptType = (over: any = {}) => ({
  id: "type_1",
  name: "Consultation",
  price: 1000,
  pricedBy: "catalogue",
  performerKind: "either",
  ...over,
});

describe("doctorAsClinician / expertAsClinician", () => {
  it("maps a Doctor record to a ChargeClinician", () => {
    expect(doctorAsClinician(doctor as any)).toEqual({
      id: "doc_1",
      name: "Dr. A",
      kind: "doctor",
      consultationCharge: 700,
      defaultCommission: 10,
    });
  });

  it("maps an Expert record to a ChargeClinician (no consultationCharge field)", () => {
    expect(expertAsClinician(expert as any)).toEqual({
      id: "exp_1",
      name: "Expert B",
      kind: "expert",
      defaultCommission: 15,
    });
  });
});

describe("findClinician", () => {
  const lists = { doctors: [doctor as any], experts: [expert as any] };

  it("returns null for a missing or 'unassigned' id", async () => {
    expect(await findClinician(null, undefined, lists)).toBeNull();
    expect(await findClinician(undefined, undefined, lists)).toBeNull();
    expect(await findClinician("unassigned", undefined, lists)).toBeNull();
  });

  it("finds a doctor in the loaded list without kind specified", async () => {
    const result = await findClinician("doc_1", undefined, lists);

    expect(result?.kind).toBe("doctor");
    expect(result?.id).toBe("doc_1");
  });

  it("finds an expert in the loaded list without kind specified", async () => {
    const result = await findClinician("exp_1", undefined, lists);

    expect(result?.kind).toBe("expert");
  });

  it("kind:'expert' skips the doctor list even if the id collides", async () => {
    const collidingLists = {
      doctors: [{ ...doctor, id: "shared_id" } as any],
      experts: [{ ...expert, id: "shared_id" } as any],
    };
    const result = await findClinician("shared_id", "expert", collidingLists);

    expect(result?.kind).toBe("expert");
  });

  it("kind:'doctor' skips the expert list even if the id collides", async () => {
    const collidingLists = {
      doctors: [{ ...doctor, id: "shared_id" } as any],
      experts: [{ ...expert, id: "shared_id" } as any],
    };
    const result = await findClinician("shared_id", "doctor", collidingLists);

    expect(result?.kind).toBe("doctor");
  });

  it("falls back to fetching a doctor not in the loaded list", async () => {
    getDoctorByIdMock.mockResolvedValueOnce(doctor);

    const result = await findClinician("doc_offline", undefined, {
      doctors: [],
      experts: [],
    });

    expect(result?.kind).toBe("doctor");
    expect(getDoctorByIdMock).toHaveBeenCalledWith("doc_offline");
  });

  it("falls back to fetching an expert when the doctor fetch finds nothing", async () => {
    getDoctorByIdMock.mockResolvedValueOnce(null);
    getExpertByIdMock.mockResolvedValueOnce(expert);

    const result = await findClinician("exp_offline", undefined, {
      doctors: [],
      experts: [],
    });

    expect(result?.kind).toBe("expert");
  });

  it("a rejected fetch is swallowed, not thrown, and the search continues", async () => {
    getDoctorByIdMock.mockRejectedValueOnce(new Error("network"));
    getExpertByIdMock.mockResolvedValueOnce(expert);

    const result = await findClinician("x", undefined, {
      doctors: [],
      experts: [],
    });

    expect(result?.kind).toBe("expert");
  });

  it("returns null when the id is found nowhere", async () => {
    getDoctorByIdMock.mockResolvedValueOnce(null);
    getExpertByIdMock.mockResolvedValueOnce(null);

    const result = await findClinician("ghost", undefined, {
      doctors: [],
      experts: [],
    });

    expect(result).toBeNull();
  });
});

describe("ensureVisitLine", () => {
  it("returns the refusal directly when the type cannot be priced", async () => {
    const result = await ensureVisitLine({
      appointment: { id: "appt_1" },
      type: apptType({ price: undefined }),
      clinician: doctorAsClinician(doctor as any),
      origin: "booked",
      ctx,
    });

    expect(result.ok).toBe(false);
    expect(appendPendingVisitLinesMock).not.toHaveBeenCalled();
  });

  it("appends the resolved line at the catalogue price by default", async () => {
    const result = await ensureVisitLine({
      appointment: { id: "appt_1" },
      type: apptType(),
      clinician: doctorAsClinician(doctor as any),
      origin: "booked",
      ctx,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.line.price).toBe(1000);
      expect(result.added).toBe(true);
    }
    expect(appendPendingVisitLinesMock).toHaveBeenCalledWith("appt_1", [
      expect.objectContaining({ price: 1000 }),
    ]);
  });

  it("uses commissionOnlyBase to zero the price while keeping the commission base", async () => {
    const result = await ensureVisitLine({
      appointment: { id: "appt_1" },
      type: apptType(),
      clinician: doctorAsClinician(doctor as any),
      origin: "booked",
      ctx,
      commissionOnlyBase: 1000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.line.price).toBe(0);
      expect(result.line.amount).toBe(1000);
    }
  });

  it("uses an explicit price override (a split procedure share) when given", async () => {
    const result = await ensureVisitLine({
      appointment: { id: "appt_1" },
      type: apptType(),
      clinician: doctorAsClinician(doctor as any),
      origin: "booked",
      ctx,
      price: 400,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.line.price).toBe(400);
  });

  it("reports added:false when the line was already on the visit (deduped)", async () => {
    appendPendingVisitLinesMock.mockResolvedValueOnce({
      added: [],
      skipped: [{}],
    });

    const result = await ensureVisitLine({
      appointment: { id: "appt_1" },
      type: apptType(),
      clinician: doctorAsClinician(doctor as any),
      origin: "booked",
      ctx,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.added).toBe(false);
  });
});

describe("ensureSessionLine", () => {
  const packages = [
    {
      id: "pkg_1",
      name: "10x Laser",
      totalSessions: 10,
      walletCreditAmount: 3000,
      calculateCommission: true,
      defaultCommission: 20,
    },
  ] as any;

  it("refuses when the patient package cannot be found", async () => {
    getPatientPackageByIdMock.mockResolvedValueOnce(null);

    const result = await ensureSessionLine({
      appointment: { id: "appt_1" },
      patientPackageId: "pp_ghost",
      packages,
      performer: doctorAsClinician(doctor as any),
      ctx,
    });

    expect(result.ok).toBe(false);
    expect(appendPendingVisitLinesMock).not.toHaveBeenCalled();
  });

  it("uses the stored perSessionValue when present", async () => {
    getPatientPackageByIdMock.mockResolvedValueOnce({
      id: "pp_1",
      packageId: "pkg_1",
      packageName: "10x Laser",
      totalSessions: 10,
      perSessionValue: 275,
    });

    const result = await ensureSessionLine({
      appointment: { id: "appt_1" },
      patientPackageId: "pp_1",
      packages,
      performer: doctorAsClinician(doctor as any),
      ctx,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.line.amount).toBe(275);
  });

  it("derives a legacy per-session value from walletCreditAmount/sessions when none is stored", async () => {
    getPatientPackageByIdMock.mockResolvedValueOnce({
      id: "pp_1",
      packageId: "pkg_1",
      packageName: "10x Laser",
      totalSessions: 10,
    });

    const result = await ensureSessionLine({
      appointment: { id: "appt_1" },
      patientPackageId: "pp_1",
      packages,
      performer: doctorAsClinician(doctor as any),
      ctx,
    });

    // 3000 / 10 = 300
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.line.amount).toBe(300);
  });

  it("is still well-defined (value 0) when the sold-from package is not in the catalogue list", async () => {
    getPatientPackageByIdMock.mockResolvedValueOnce({
      id: "pp_1",
      packageId: "pkg_unknown",
      packageName: "Orphaned Package",
      totalSessions: 0,
    });

    const result = await ensureSessionLine({
      appointment: { id: "appt_1" },
      patientPackageId: "pp_1",
      packages,
      performer: doctorAsClinician(doctor as any),
      ctx,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.line.amount).toBe(0);
  });
});

// A 1000-rupee, untaxed, undiscounted pending item — with isTaxEnabled:false
// and no discount fields, computeVisitPayableTotal reduces to a plain sum,
// so "owed" is predictably 1000 across every collectCheckInDue test below.
const apptWithOwed = (over: any = {}) => ({
  patientId: "pat_1",
  appointmentTypeId: "type_1",
  pendingVisitItems: [
    {
      price: 1000,
      amount: 1000,
      quantity: 1,
      isTaxable: false,
      // getVisitPaymentGate's scope defaults to "checkin" here, which
      // filters pendingVisitItems through isLineCollectableAtCheckIn —
      // without this explicit flag the line is excluded and "owed" is 0.
      collectAtCheckIn: true,
    },
  ],
  depositedAmount: 0,
  ...over,
});

describe("collectCheckInDue", () => {
  const visit = { id: "appt_1", patientId: "pat_1" };

  it("does nothing and runs no transaction when there is no credit to earmark and nothing to capture", async () => {
    const result = await collectCheckInDue(visit, ctx, null);

    expect(result).toEqual({ collected: 0, creditApplied: 0, txnId: null });
    expect(runTransactionMock).not.toHaveBeenCalled();
  });

  it("collects the full due amount as cash when there is no standing credit", async () => {
    apptFixture = apptWithOwed();
    patientFixture = { walletBalance: 0 };

    const result = await collectCheckInDue(visit, ctx, {
      method: "cash",
    });

    expect(result.collected).toBe(1000);
    expect(result.creditApplied).toBe(0);
    expect(result.txnId).toBe("wallet_txn_2");
    expect(addFundsInTransactionMock).toHaveBeenCalledTimes(1);
    expect(addFundsInTransactionMock.mock.calls[0][2]).toMatchObject({
      amount: 1000,
      paymentMethod: "cash",
      referenceId: "appt_1",
      referenceType: "appointment",
    });
    // The appointment's depositedAmount is raised by exactly what was taken.
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ depositedAmount: 1000 }),
    );
  });

  it("earmarks standing credit first, capped at what's actually due", async () => {
    apptFixture = apptWithOwed();
    patientFixture = { walletBalance: 2000 };

    const result = await collectCheckInDue(visit, ctx, null, {
      standingCredit: 500,
    });

    expect(result.creditApplied).toBe(500);
    expect(result.collected).toBe(0); // capture was null — no cash step
    expect(deductFundsInTransactionMock).toHaveBeenCalledTimes(1);
    expect(deductFundsInTransactionMock.mock.calls[0][2]).toMatchObject({
      amount: 500,
      referenceId: "appt_1",
      referenceType: "appointment",
    });
    expect(addFundsInTransactionMock).not.toHaveBeenCalled();
  });

  it("caps the credit claim at the wallet's real balance, not the requested amount", async () => {
    apptFixture = apptWithOwed();
    patientFixture = { walletBalance: 200 };

    const result = await collectCheckInDue(visit, ctx, null, {
      standingCredit: 500,
    });

    expect(result.creditApplied).toBe(200);
  });

  it("applies no credit and calls no wallet function when nothing is actually due", async () => {
    apptFixture = apptWithOwed({ depositedAmount: 1000 }); // already fully covered
    patientFixture = { walletBalance: 500 };

    const result = await collectCheckInDue(visit, ctx, null, {
      standingCredit: 500,
    });

    expect(result.creditApplied).toBe(0);
    expect(result.txnId).toBeNull();
    expect(deductFundsInTransactionMock).not.toHaveBeenCalled();
  });

  it("collects both credit and cash in sequence for the same visit", async () => {
    // The credit step's own transaction reads a fresh snapshot each time —
    // simulate its effect landing before the cash step reads by bumping
    // depositedAmount here, exactly as the real credit transaction.update
    // would have committed it.
    apptFixture = apptWithOwed();
    patientFixture = { walletBalance: 2000 };

    const originalGet = getDocMock.getMockImplementation()!;

    deductFundsInTransactionMock.mockImplementationOnce(() => {
      apptFixture = { ...apptFixture, depositedAmount: 300 };

      return "wallet_txn_1";
    });

    const result = await collectCheckInDue(
      visit,
      ctx,
      { method: "card", reference: "ref123" },
      { standingCredit: 300 },
    );

    expect(result.creditApplied).toBe(300);
    expect(result.collected).toBe(700); // 1000 owed - 300 already earmarked
    expect(originalGet).toBeDefined();
  });

  it("marks the deposit failed and rethrows when the credit step's transaction fails", async () => {
    apptFixture = null; // "Appointment not found" inside the transaction

    await expect(
      collectCheckInDue(visit, ctx, null, { standingCredit: 300 }),
    ).rejects.toThrow("Appointment not found");

    expect(markCheckInDepositFailedMock).toHaveBeenCalledWith("appt_1", true);
  });

  it("returns collected:0 (no wallet call) when the cash step finds nothing due", async () => {
    apptFixture = apptWithOwed({ depositedAmount: 1000 });
    patientFixture = { walletBalance: 0 };

    const result = await collectCheckInDue(visit, ctx, { method: "cash" });

    expect(result.collected).toBe(0);
    expect(result.txnId).toBeNull();
    expect(addFundsInTransactionMock).not.toHaveBeenCalled();
  });

  it("marks the deposit failed and rethrows when the cash step's transaction fails", async () => {
    apptFixture = null;

    await expect(
      collectCheckInDue(visit, ctx, { method: "cash" }),
    ).rejects.toThrow("Appointment not found");

    expect(markCheckInDepositFailedMock).toHaveBeenCalledWith("appt_1", true);
  });
});

describe("appendBookedLines", () => {
  const lists: CatalogueLists = {
    doctors: [doctor as any],
    experts: [expert as any],
    appointmentTypes: [apptType() as any],
    packages: [],
  };

  it("returns immediately with no work for a sibling appointment already billed elsewhere", async () => {
    const refusals = await appendBookedLines({
      appointment: { id: "appt_1", billedOnAppointmentId: "appt_main" },
      rows: [{ clinicianId: "doc_1", appointmentTypeId: "type_1" }],
      lists,
      ctx,
    });

    expect(refusals).toEqual([]);
    expect(appendPendingVisitLinesMock).not.toHaveBeenCalled();
  });

  it("skips rows with no clinician or appointmentTypeId", async () => {
    getAppointmentByIdMock.mockResolvedValue({
      pendingVisitItems: [],
      appointmentTypeId: "type_1",
    });

    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [
        { clinicianId: "", appointmentTypeId: "type_1" },
        { clinicianId: "unassigned", appointmentTypeId: "type_1" },
        { clinicianId: "doc_1", appointmentTypeId: "" },
        { clinicianId: "doc_1", appointmentTypeId: "default" },
      ],
      lists,
      ctx,
    });

    expect(refusals).toEqual([]);
    expect(appendPendingVisitLinesMock).not.toHaveBeenCalled();
  });

  it("refuses a row whose appointmentTypeId is not in the catalogue", async () => {
    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [{ clinicianId: "doc_1", appointmentTypeId: "type_ghost" }],
      lists,
      ctx,
    });

    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain("not in the catalogue");
  });

  it("refuses a row whose clinician cannot be found", async () => {
    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [{ clinicianId: "ghost_doc", appointmentTypeId: "type_1" }],
      lists,
      ctx,
    });

    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain("could not be found");
  });

  it("bills a genuinely new booked type once, to the first clinician", async () => {
    getAppointmentByIdMock.mockResolvedValue({
      pendingVisitItems: [],
      appointmentTypeId: "type_1",
    });

    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [{ clinicianId: "doc_1", appointmentTypeId: "type_1" }],
      lists,
      ctx,
    });

    expect(refusals).toEqual([]);
    expect(appendPendingVisitLinesMock).toHaveBeenCalledTimes(1);
    expect(appendPendingVisitLinesMock).toHaveBeenCalledWith("appt_1", [
      expect.objectContaining({ price: 1000, doctorId: "doc_1" }),
    ]);
  });

  it("re-attributes an existing booked line to a new clinician instead of billing it again", async () => {
    getAppointmentByIdMock.mockResolvedValue({
      appointmentTypeId: "type_1",
      pendingVisitItems: [
        {
          id: "line_1",
          appointmentTypeId: "type_1",
          doctorId: "someone_else",
          performerKind: "doctor",
          origin: "booked",
        },
      ],
    });

    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [{ clinicianId: "doc_1", appointmentTypeId: "type_1" }],
      lists,
      ctx,
    });

    expect(refusals).toEqual([]);
    expect(reattributeVisitLineMock).toHaveBeenCalledWith(
      "appt_1",
      "line_1",
      { id: "doc_1", name: "Dr. A", kind: "doctor" },
    );
    // Already on the visit — never billed as a brand-new line.
    expect(appendPendingVisitLinesMock).not.toHaveBeenCalled();
  });

  it("does not re-attribute when the existing line is already this clinician's", async () => {
    getAppointmentByIdMock.mockResolvedValue({
      appointmentTypeId: "type_1",
      pendingVisitItems: [
        {
          id: "line_1",
          appointmentTypeId: "type_1",
          doctorId: "doc_1",
          performerKind: "doctor",
          origin: "booked",
        },
      ],
    });

    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [{ clinicianId: "doc_1", appointmentTypeId: "type_1" }],
      lists,
      ctx,
    });

    expect(refusals).toEqual([]);
    expect(reattributeVisitLineMock).not.toHaveBeenCalled();
    expect(appendPendingVisitLinesMock).not.toHaveBeenCalled();
  });

  it("a second clinician on the SAME new type gets a commission-only line, not a second charge", async () => {
    getAppointmentByIdMock.mockResolvedValue({
      pendingVisitItems: [],
      appointmentTypeId: "type_1",
    });

    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [
        { clinicianId: "doc_1", appointmentTypeId: "type_1" },
        { clinicianId: "exp_1", appointmentTypeId: "type_1" },
      ],
      lists,
      ctx,
    });

    expect(refusals).toEqual([]);
    expect(appendPendingVisitLinesMock).toHaveBeenCalledTimes(2);
    const firstLine = appendPendingVisitLinesMock.mock.calls[0][1][0];
    const secondLine = appendPendingVisitLinesMock.mock.calls[1][1][0];

    expect(firstLine.price).toBe(1000); // the real charge
    expect(secondLine.price).toBe(0); // commission-only
    expect(secondLine.amount).toBe(1000); // full price as the commission base
  });

  it("de-duplicates two rows naming the same clinician for the same type", async () => {
    getAppointmentByIdMock.mockResolvedValue({
      pendingVisitItems: [],
      appointmentTypeId: "type_1",
    });

    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [
        { clinicianId: "doc_1", appointmentTypeId: "type_1" },
        { clinicianId: "doc_1", appointmentTypeId: "type_1" },
      ],
      lists,
      ctx,
    });

    expect(refusals).toEqual([]);
    expect(appendPendingVisitLinesMock).toHaveBeenCalledTimes(1);
  });

  it("routes a package-session row to ensureSessionLine instead of the catalogue path", async () => {
    getPatientPackageByIdMock.mockResolvedValueOnce({
      id: "pp_1",
      packageId: "pkg_1",
      packageName: "10x Laser",
      totalSessions: 10,
      perSessionValue: 300,
    });

    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [{ clinicianId: "doc_1", patientPackageId: "pp_1" }],
      lists: { ...lists, packages: [{ id: "pkg_1", name: "10x Laser" } as any] },
      ctx,
    });

    expect(refusals).toEqual([]);
    expect(appendPendingVisitLinesMock).toHaveBeenCalledWith("appt_1", [
      expect.objectContaining({ amount: 300, price: 0 }),
    ]);
    // Never touched the booked-type lookup path (no getAppointmentById call).
    expect(getAppointmentByIdMock).not.toHaveBeenCalled();
  });

  it("collects refusals across multiple independent rows rather than stopping at the first", async () => {
    getAppointmentByIdMock.mockResolvedValue({
      pendingVisitItems: [],
      appointmentTypeId: "type_1",
    });

    const refusals = await appendBookedLines({
      appointment: { id: "appt_1" },
      rows: [
        { clinicianId: "ghost", appointmentTypeId: "type_1" },
        { clinicianId: "doc_1", appointmentTypeId: "type_ghost" },
      ],
      lists,
      ctx,
    });

    expect(refusals).toHaveLength(2);
  });
});

describe("checkInVisit", () => {
  const baseAppointment = {
    id: "appt_1",
    patientId: "pat_1",
    billingId: null,
    consultationBillingId: null,
  };

  beforeEach(() => {
    checkInAppointmentMock.mockResolvedValue({
      transitioned: true,
      status: "confirmed",
    });
    getAppointmentByIdMock.mockResolvedValue({
      pendingVisitItems: [],
      appointmentTypeId: "type_1",
    });
  });

  it("appends booked lines then collects the deposit for a not-yet-invoiced visit", async () => {
    apptFixture = apptWithOwed();
    patientFixture = { walletBalance: 0 };

    const outcome = await checkInVisit({
      appointment: baseAppointment,
      rows: [{ clinicianId: "doc_1", appointmentTypeId: "type_1" }],
      lists: {
        doctors: [doctor as any],
        experts: [],
        appointmentTypes: [apptType() as any],
        packages: [],
      },
      ctx,
      capture: { method: "cash" },
    });

    expect(outcome.transitioned).toBe(true);
    expect(outcome.lineAppendFailed).toBe(false);
    expect(outcome.depositFailed).toBe(false);
    expect(outcome.collected).toBe(1000);
    expect(appendPendingVisitLinesMock).toHaveBeenCalledTimes(1);
  });

  it("skips appending lines and collecting a deposit entirely once the visit is already invoiced", async () => {
    const outcome = await checkInVisit({
      appointment: { ...baseAppointment, billingId: "inv_1" },
      rows: [{ clinicianId: "doc_1", appointmentTypeId: "type_1" }],
      lists: {
        doctors: [doctor as any],
        experts: [],
        appointmentTypes: [apptType() as any],
        packages: [],
      },
      ctx,
      capture: { method: "cash" },
    });

    expect(outcome.collected).toBe(0);
    expect(outcome.creditApplied).toBe(0);
    expect(outcome.depositFailed).toBe(false);
    expect(appendPendingVisitLinesMock).not.toHaveBeenCalled();
    expect(runTransactionMock).not.toHaveBeenCalled();
  });

  it("the arrival transition stays durable when appending the booked line throws", async () => {
    getAppointmentByIdMock.mockRejectedValue(new Error("Firestore down"));

    const outcome = await checkInVisit({
      appointment: baseAppointment,
      rows: [{ clinicianId: "doc_1", appointmentTypeId: "type_1" }],
      lists: {
        doctors: [doctor as any],
        experts: [],
        appointmentTypes: [apptType() as any],
        packages: [],
      },
      ctx,
      capture: null,
    });

    expect(outcome.transitioned).toBe(true); // check-in itself still succeeded
    expect(outcome.lineAppendFailed).toBe(true);
    expect(outcome.refusals).toEqual([
      "The visit's service could not be added — add it from the queue before sending the patient in.",
    ]);
  });

  it("reports depositFailed without throwing when collectCheckInDue's transaction fails", async () => {
    apptFixture = null; // forces "Appointment not found" inside the transaction

    const outcome = await checkInVisit({
      appointment: baseAppointment,
      rows: [],
      lists: {
        doctors: [],
        experts: [],
        appointmentTypes: [],
        packages: [],
      },
      ctx,
      capture: { method: "cash" },
    });

    expect(outcome.depositFailed).toBe(true);
    expect(outcome.collected).toBe(0);
  });
});
