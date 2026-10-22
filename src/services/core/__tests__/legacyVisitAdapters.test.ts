import { describe, it, expect } from "vitest";

import {
  legacyLineOrigin,
  findBookedLine,
  mergeVisitLines,
  legacyRecommendationToItems,
  type LegacyLineShape,
} from "../legacyVisitAdapters";

const NOW = new Date("2026-10-22T09:00:00Z");
const doctorVisit = {
  doctorId: "doc_1",
  doctorName: "Dr. A",
  assignedExpertId: null,
  expertName: null,
};
const expertVisit = {
  doctorId: "doc_1",
  doctorName: "Dr. A",
  assignedExpertId: "exp_1",
  expertName: "Expert B",
};

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

describe("legacyRecommendationToItems", () => {
  it("returns nothing for a non-object recommendation", () => {
    expect(legacyRecommendationToItems(null, doctorVisit, NOW)).toEqual([]);
    expect(legacyRecommendationToItems(undefined, doctorVisit, NOW)).toEqual(
      [],
    );
    expect(legacyRecommendationToItems("legacy", doctorVisit, NOW)).toEqual(
      [],
    );
  });

  it("returns nothing when there are no items and no single-fee name", () => {
    expect(legacyRecommendationToItems({}, doctorVisit, NOW)).toEqual([]);
  });

  it("maps a legacy single-fee recommendation (no items array) into one item", () => {
    const result = legacyRecommendationToItems(
      { name: "Laser Session", fee: 1500 },
      doctorVisit,
      NOW,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "Laser Session",
      quantity: 1,
      doToday: true,
      status: "recommended",
      decidedAt: NOW,
    });
  });

  it("maps every entry of a multi-item recommendation, filtering out empty ones", () => {
    const result = legacyRecommendationToItems(
      {
        items: [
          { id: "t1", name: "Consult", quantity: 2 },
          { name: "" }, // neither id nor name — filtered out
          { id: "", name: "" }, // same
          { id: "t2", name: "Follow-up" },
        ],
      },
      doctorVisit,
      NOW,
    );

    expect(result).toHaveLength(2);
    expect(result.map((i) => i.appointmentTypeId)).toEqual(["t1", "t2"]);
    expect(result[0].quantity).toBe(2);
  });

  it("attributes to the assigned expert when one is on the visit", () => {
    const result = legacyRecommendationToItems(
      { name: "Facial", fee: 800 },
      expertVisit,
      NOW,
    );

    expect(result[0].performedBy).toEqual({
      id: "exp_1",
      kind: "expert",
      name: "Expert B",
    });
  });

  it("falls back to the doctor when assignedExpertId is 'unassigned'", () => {
    const result = legacyRecommendationToItems(
      { name: "Facial", fee: 800 },
      { ...expertVisit, assignedExpertId: "unassigned" },
      NOW,
    );

    expect(result[0].performedBy).toEqual({
      id: "doc_1",
      kind: "doctor",
      name: "Dr. A",
    });
  });

  it("resolves a name-only item's appointmentTypeId via the lookup callback", () => {
    const resolveTypeId = (name: string) =>
      name === "Known Service" ? "type_known" : undefined;

    const result = legacyRecommendationToItems(
      { items: [{ name: "Known Service" }, { name: "Unknown Service" }] },
      doctorVisit,
      NOW,
      resolveTypeId,
    );

    expect(result[0].appointmentTypeId).toBe("type_known");
    expect(result[1].appointmentTypeId).toBe("");
  });

  it("clamps a zero or fractional quantity up to a whole 1", () => {
    const result = legacyRecommendationToItems(
      { items: [{ id: "t1", name: "X", quantity: 0 }] },
      doctorVisit,
      NOW,
    );

    expect(result[0].quantity).toBe(1);
  });

  it("uses the recommendation's own recommendedBy over the visit's doctor", () => {
    const result = legacyRecommendationToItems(
      { name: "X", fee: 100, recommendedBy: "dr_other" },
      doctorVisit,
      NOW,
    );

    expect(result[0].recommendedBy).toBe("dr_other");
  });
});
