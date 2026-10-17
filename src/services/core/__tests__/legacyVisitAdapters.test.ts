import { describe, it, expect } from "vitest";

import {
  legacyLineOrigin,
  findBookedLine,
  mergeVisitLines,
  type LegacyLineShape,
} from "../legacyVisitAdapters";

describe("legacyLineOrigin", () => {
  it("trusts an explicit origin first", () => {
    expect(legacyLineOrigin({ origin: "procedure" }, "t1")).toBe("procedure");
  });

  it("treats a price-0, amount>0 line as a package session", () => {
    expect(legacyLineOrigin({ price: 0, amount: 500 })).toBe("session");
    expect(legacyLineOrigin({ patientPackageId: "pp1", price: 100 })).toBe(
      "session",
    );
  });

  it("treats a line matching the visit's own appointment type as booked", () => {
    expect(legacyLineOrigin({ appointmentTypeId: "t1" }, "t1")).toBe("booked");
  });

  it("treats a legacy GP-fee id as booked regardless of the visit's type", () => {
    expect(legacyLineOrigin({ appointmentTypeId: "manual-gp-fee" }, "t1")).toBe(
      "booked",
    );
    expect(
      legacyLineOrigin({ appointmentTypeId: "consultation-fee" }, "t1"),
    ).toBe("booked");
  });

  it("falls back to procedure for anything else", () => {
    expect(legacyLineOrigin({ appointmentTypeId: "co2-laser" }, "t1")).toBe(
      "procedure",
    );
  });
});

describe("findBookedLine", () => {
  it("matches the booked line for a type regardless of who performed it", () => {
    // This is the invariant appendBookedLines/handleConfirmRoute/ensureBookedLine
    // all rely on to avoid double-charging a visit's booked fee when the
    // clinician changes mid-visit (Undo Check-In, Send Back to Lobby).
    const lines: LegacyLineShape[] = [
      { appointmentTypeId: "consult", origin: "booked", doctorId: "dr-A" },
    ];

    expect(findBookedLine(lines, "consult", "consult")?.doctorId).toBe("dr-A");
  });

  it("returns undefined when no line matches the requested type", () => {
    const lines: LegacyLineShape[] = [
      { appointmentTypeId: "consult", origin: "booked", doctorId: "dr-A" },
    ];

    expect(findBookedLine(lines, "prp", "consult")).toBeUndefined();
  });

  it("ignores a session or procedure line even if the type id matches", () => {
    const lines: LegacyLineShape[] = [
      { appointmentTypeId: "consult", origin: "procedure", doctorId: "dr-A" },
    ];

    expect(findBookedLine(lines, "consult", "other-type")).toBeUndefined();
  });
});

describe("mergeVisitLines — why appendBookedLines must guard with findBookedLine first", () => {
  it("keys a booked line by (type, doctor), so a different doctor for the SAME type is treated as a brand-new line", () => {
    // This is the exact trap: without a findBookedLine check first, routing
    // an already-booked-and-paid visit to a new doctor would pass this
    // merge and silently add a second, duplicate charge for one visit.
    const existing: LegacyLineShape[] = [
      { appointmentTypeId: "consult", origin: "booked", doctorId: "dr-A" },
    ];
    const incoming: LegacyLineShape[] = [
      { appointmentTypeId: "consult", origin: "booked", doctorId: "dr-B" },
    ];
    const result = mergeVisitLines(existing, incoming, "consult");

    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(result.next).toHaveLength(2);
  });

  it("skips a truly identical line (same type, same doctor)", () => {
    const existing: LegacyLineShape[] = [
      { appointmentTypeId: "consult", origin: "booked", doctorId: "dr-A" },
    ];
    const incoming: LegacyLineShape[] = [
      { appointmentTypeId: "consult", origin: "booked", doctorId: "dr-A" },
    ];
    const result = mergeVisitLines(existing, incoming, "consult");

    expect(result.added).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });
});
