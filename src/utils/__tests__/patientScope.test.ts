import { describe, it, expect } from "vitest";

import {
  OPEN_PATIENT_SCOPE,
  canEditPatient,
  canViewPatient,
  scopeFor,
  withTreatedPatients,
} from "../patientScope";

describe("scopeFor", () => {
  it("limits a doctor to the doctor record their email matches", () => {
    const scope = scopeFor("doctor", "doc-1");

    expect(scope.restricted).toBe(true);
    expect(scope.doctorId).toBe("doc-1");
  });

  it("gives a doctor login with no doctor record no patients, not everyone", () => {
    const scope = scopeFor("doctor", null);

    expect(scope.restricted).toBe(true);
    expect(scope.doctorId).toBe(null);
  });

  it("never limits a clinic admin, even one who is also a doctor", () => {
    expect(scopeFor("clinic-admin", null).restricted).toBe(false);
    expect(scopeFor("clinic-admin", "doc-1").restricted).toBe(false);
  });

  it("keeps limiting any other login that matches a doctor record", () => {
    const scope = scopeFor("staff", "doc-1");

    expect(scope.restricted).toBe(true);
    expect(scope.doctorId).toBe("doc-1");
  });

  it("leaves staff, hr, experts and unknown roles unlimited when no doctor matches", () => {
    expect(scopeFor("staff", null).restricted).toBe(false);
    expect(scopeFor("hr", null).restricted).toBe(false);
    expect(scopeFor("expert", null).restricted).toBe(false);
    expect(scopeFor(undefined, null).restricted).toBe(false);
  });
});

describe("withTreatedPatients", () => {
  it("adds the treated patients to a doctor's scope", () => {
    const scope = withTreatedPatients(scopeFor("doctor", "doc-1"), [
      "p-7",
      "p-8",
    ]);

    expect(scope.treatedPatientIds.has("p-7")).toBe(true);
    expect(scope.treatedPatientIds.has("p-8")).toBe(true);
    expect(scope.treatedPatientIds.size).toBe(2);
  });

  it("changes nothing for an unlimited login or a doctor with no record", () => {
    expect(withTreatedPatients(OPEN_PATIENT_SCOPE, ["p-7"])).toBe(
      OPEN_PATIENT_SCOPE,
    );

    const ghost = scopeFor("doctor", null);

    expect(withTreatedPatients(ghost, ["p-7"])).toBe(ghost);
  });
});

describe("canViewPatient", () => {
  const mine = withTreatedPatients(scopeFor("doctor", "doc-1"), ["p-treated"]);

  it("lets an unlimited login see any patient", () => {
    expect(canViewPatient(OPEN_PATIENT_SCOPE, { doctorId: "doc-2" })).toBe(
      true,
    );
    expect(canViewPatient(OPEN_PATIENT_SCOPE, {})).toBe(true);
  });

  it("lets a doctor see a patient assigned to them", () => {
    expect(canViewPatient(mine, { id: "p-1", doctorId: "doc-1" })).toBe(true);
  });

  it("lets a doctor see a patient they have treated, even if assigned elsewhere", () => {
    expect(canViewPatient(mine, { id: "p-treated", doctorId: "doc-2" })).toBe(
      true,
    );
    expect(canViewPatient(mine, { id: "p-treated" })).toBe(true);
  });

  it("hides every other doctor's patient and unassigned patients", () => {
    expect(canViewPatient(mine, { id: "p-9", doctorId: "doc-2" })).toBe(false);
    expect(canViewPatient(mine, { id: "p-9" })).toBe(false);
    expect(canViewPatient(mine, { doctorId: null })).toBe(false);
  });

  it("shows a doctor login with no doctor record nothing at all", () => {
    const none = scopeFor("doctor", null);

    expect(canViewPatient(none, { id: "p-1", doctorId: "doc-1" })).toBe(false);
    expect(canViewPatient(none, {})).toBe(false);
  });
});

describe("canEditPatient", () => {
  const mine = withTreatedPatients(scopeFor("doctor", "doc-1"), ["p-treated"]);

  it("lets an unlimited login edit any patient", () => {
    expect(canEditPatient(OPEN_PATIENT_SCOPE, { doctorId: "doc-2" })).toBe(
      true,
    );
  });

  it("lets a doctor edit only the patients assigned to them", () => {
    expect(canEditPatient(mine, { doctorId: "doc-1" })).toBe(true);
    expect(canEditPatient(mine, { doctorId: "doc-2" })).toBe(false);
    expect(canEditPatient(mine, {})).toBe(false);
  });

  it("does not let treating a patient grant the right to edit them", () => {
    expect(canViewPatient(mine, { id: "p-treated", doctorId: "doc-2" })).toBe(
      true,
    );
    expect(canEditPatient(mine, { doctorId: "doc-2" })).toBe(false);
  });

  it("lets a doctor login with no doctor record edit nobody", () => {
    expect(
      canEditPatient(scopeFor("doctor", null), { doctorId: "doc-1" }),
    ).toBe(false);
  });
});
