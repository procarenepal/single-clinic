import { describe, it, expect } from "vitest";

import {
  findDesignatedConsultation,
  findDesignatedExpertType,
  planTypeFlags,
  planPackageFlags,
  planPatientPackageBackfill,
  planFrontOfficeSeed,
  preflightReport,
  DEFAULT_ROOMS,
} from "../catalogueFlagsCore";

// The live catalogue as it stood on 2026-10-10: three flagged types, nine
// seeded without any flags, three of them with "Consultation" in the name.
const types = [
  {
    id: "consult",
    name: "Doctor Consultation",
    price: 700,
    isActive: true,
    billAtFrontDesk: true,
    calculateCommission: true,
    isTaxable: true,
    taxRate: 13,
  },
  {
    id: "skin",
    name: "Skin Test",
    price: 300,
    isActive: true,
    billAtFrontDesk: true,
    calculateCommission: true,
    isTaxable: true,
    taxRate: 13,
  },
  {
    id: "peel",
    name: "Advanced Chemical Peel",
    price: 2500,
    isActive: true,
    billAtFrontDesk: false,
    calculateCommission: true,
    isTaxable: true,
    taxRate: 13,
    defaultCommission: null,
  },
  { id: "acne", name: "Acne Consultation & Care", price: 1200, isActive: true },
  {
    id: "botox",
    name: "Botox & Anti-Aging Consultation",
    price: 3000,
    isActive: true,
  },
  {
    id: "laser",
    name: "Laser Hair Reduction Consultation",
    price: 1500,
    isActive: true,
  },
  {
    id: "prp",
    name: "Platelet-Rich Plasma (PRP) Therapy",
    price: 4500,
    isActive: true,
  },
];
const doctors = [
  {
    id: "d1",
    name: "Dr. Pratik Bhusal",
    isActive: true,
    consultationCharge: 700,
  },
];

describe("designation", () => {
  it("picks the exact 'Doctor Consultation' as the consultation, not every type with 'consult' in it", () => {
    expect(findDesignatedConsultation(types)?.id).toBe("consult");
  });

  it("falls back to a collect-at-check-in type named consultation", () => {
    expect(
      findDesignatedConsultation([
        {
          id: "x",
          name: "GP Consultation",
          billAtFrontDesk: true,
          isActive: true,
        },
      ])?.id,
    ).toBe("x");
    expect(
      findDesignatedConsultation([
        { id: "y", name: "Acne Consultation & Care", isActive: true },
      ]),
    ).toBeUndefined();
  });

  it("finds Skin Test as the default expert service", () => {
    expect(findDesignatedExpertType(types)?.id).toBe("skin");
  });
});

describe("planTypeFlags", () => {
  it("makes only the designated consultation doctor-priced and flags the others' price change", () => {
    const consult = planTypeFlags(types[0], "consult", "skin");
    const acne = planTypeFlags(types[3], "consult", "skin");

    expect(consult.patch).toEqual({
      pricedBy: "doctor",
      performerKind: "doctor",
      procedureLog: "none",
    });
    expect(consult.notes).toEqual([]);
    expect(acne.patch).toEqual({
      billAtFrontDesk: false,
      calculateCommission: true,
      isTaxable: false,
      pricedBy: "catalogue",
      performerKind: "either",
      procedureLog: "none",
    });
    expect(acne.notes[0]).toMatch(
      /was priced from the doctor's consultation charge by its name; it now bills its own catalogue price NPR 1200/,
    );
  });

  it("writes explicit false/true only where a boolean is missing", () => {
    const peel = planTypeFlags(types[2], "consult", "skin");

    expect(peel.patch).toEqual({
      pricedBy: "catalogue",
      performerKind: "either",
      procedureLog: "none",
    });
  });

  it("flags laser logs by name, and the designated expert type as expert-performed", () => {
    expect(planTypeFlags(types[5], "consult", "skin").patch.procedureLog).toBe(
      "laser",
    );
    expect(planTypeFlags(types[1], "consult", "skin").patch.performerKind).toBe(
      "expert",
    );
  });

  it("leaves already-set flags alone", () => {
    const done = planTypeFlags(
      {
        ...types[0],
        pricedBy: "catalogue",
        performerKind: "either",
        procedureLog: "none",
      },
      "consult",
      "skin",
    );

    expect(done.patch).toEqual({});
  });

  it("notes an unpriced type instead of inventing a price", () => {
    const p = planTypeFlags(
      { id: "u", name: "Unpriced", isActive: true },
      "consult",
      "skin",
    );

    expect(p.notes[0]).toMatch(/no numeric price/);
    expect(p.patch.price).toBeUndefined();
  });
});

describe("packages", () => {
  it("records not-taxable and expert-performed when unset, with a note to confirm", () => {
    const p = planPackageFlags({ id: "p1", name: "Laser (6)" });

    expect(p.patch).toEqual({
      isTaxable: false,
      sessionPerformerKind: "expert",
    });
    expect(p.notes[0]).toMatch(/not VAT-able/);
  });

  it("backfills the whole-rupee per-session value the wallet has been deducting", () => {
    const plan = planPatientPackageBackfill(
      { id: "pp1", packageId: "p1", totalSessions: 6 },
      {
        id: "p1",
        name: "Laser (6)",
        walletCreditAmount: 10000,
        totalSessions: 6,
      },
    );

    expect(plan?.patch).toEqual({ perSessionValue: 1667 });
    expect(
      planPatientPackageBackfill(
        { id: "pp2", perSessionValue: 1666.67 },
        undefined,
      ),
    ).toBeNull();
    expect(planPatientPackageBackfill({ id: "pp3" }, undefined)).toBeNull();
  });
});

describe("front office seed + pre-flight", () => {
  it("seeds the two default types and the rooms from the old hardcoded lists", () => {
    const seed = planFrontOfficeSeed(null, types);

    expect(seed.defaultConsultationTypeId).toBe("consult");
    expect(seed.defaultExpertTypeId).toBe("skin");
    expect(seed.rooms).toBe(DEFAULT_ROOMS);
    expect(
      seed.rooms.filter((r) => r.isExclusive).map((r) => r.name),
    ).toContain("Laser Room 1");
    expect(seed.rooms.find((r) => r.name === "Lobby")?.isExclusive).toBe(false);
  });

  it("keeps existing settings", () => {
    const seed = planFrontOfficeSeed(
      {
        defaultConsultationTypeId: "other",
        rooms: [{ id: "r", name: "Room", isExclusive: true }],
      },
      types,
    );

    expect(seed.defaultConsultationTypeId).toBe("other");
    expect(seed.rooms).toHaveLength(1);
  });

  it("errors on an unpriced type and a doctor with no charge; warns on the renamed-price types", () => {
    const fo = planFrontOfficeSeed(null, types);
    const typePlans = types.map((t) =>
      planTypeFlags(t, fo.defaultConsultationTypeId, fo.defaultExpertTypeId),
    );
    const report = preflightReport({
      types: [...types, { id: "u", name: "Unpriced", isActive: true }],
      doctors: [...doctors, { id: "d2", name: "Dr. New", isActive: true }],
      packages: [],
      typePlans: [
        ...typePlans,
        planTypeFlags(
          { id: "u", name: "Unpriced", isActive: true },
          "consult",
          "skin",
        ),
      ],
      packagePlans: [],
      frontOffice: fo,
    });

    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/"Unpriced" has no numeric price/),
        expect.stringMatching(/Dr. New has no consultation charge/),
      ]),
    );
    expect(
      report.warnings.filter((w) =>
        /now bills its own catalogue price/.test(w),
      ),
    ).toHaveLength(3);
    expect(report.info[0]).toMatch(
      /Designated consultation type: "Doctor Consultation"/,
    );
  });

  it("is clean for the live catalogue once flags are planned", () => {
    const fo = planFrontOfficeSeed(null, types);
    const report = preflightReport({
      types,
      doctors,
      packages: [],
      typePlans: types.map((t) =>
        planTypeFlags(t, fo.defaultConsultationTypeId, fo.defaultExpertTypeId),
      ),
      packagePlans: [],
      frontOffice: fo,
    });

    expect(report.errors).toEqual([]);
  });
});
