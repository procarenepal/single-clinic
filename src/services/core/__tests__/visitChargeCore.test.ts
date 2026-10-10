import { describe, it, expect } from "vitest";

import {
  resolveVisitLine,
  resolveTypePrice,
  resolveLineCommission,
  visitLineKey,
  perSessionValue,
  buildPackageSessionLine,
  isCollectableAtCheckIn,
  DOCTOR_EDIT_SETTINGS,
  APPOINTMENT_TYPES_SETTINGS,
  type ChargeableType,
  type ChargeClinician,
  type ChargeResolution,
} from "../visitChargeCore";

const NOW = new Date("2026-10-10T09:00:00Z");
const lineOf = (r: ChargeResolution) => {
  if (r.ok === true) return r.line;
  throw new Error(r.reason);
};
const refusalOf = (r: ChargeResolution) => {
  if (r.ok === false) return r;
  throw new Error("expected a refusal");
};
const input = {
  origin: "booked" as const,
  addedBy: "staff1",
  now: NOW,
  id: "l1",
};

const consult: ChargeableType = {
  id: "t-consult",
  name: "Doctor Consultation",
  price: 500,
  billAtFrontDesk: true,
  calculateCommission: true,
  isTaxable: true,
  taxRate: 13,
  pricedBy: "doctor",
  performerKind: "doctor",
};
const peel: ChargeableType = {
  id: "t-peel",
  name: "Advanced Chemical Peel",
  price: 2500,
  billAtFrontDesk: false,
  calculateCommission: true,
  defaultCommission: 20,
  isTaxable: true,
  performerKind: "either",
};
const drBhusal: ChargeClinician = {
  id: "doc1",
  name: "Dr. Pratik Bhusal",
  kind: "doctor",
  consultationCharge: 700,
  defaultCommission: 15,
};
const rina: ChargeClinician = {
  id: "exp1",
  name: "Rina",
  kind: "expert",
  defaultCommission: 10,
};

describe("resolveVisitLine — the one price/tax/commission path", () => {
  it("prices a doctor-priced consultation from the doctor's charge, not the catalogue", () => {
    const r = resolveVisitLine(consult, drBhusal, input);

    const line = lineOf(r);
    expect(line.price).toBe(700);
    expect(line.amount).toBe(700);
    expect(line.isTaxable).toBe(true);
    expect(line.taxRate).toBe(13);
    expect(line.commission).toBe(15);
    expect(line.collectAtCheckIn).toBe(true);
    expect(line.doctorId).toBe("doc1");
    expect(line.performerKind).toBe("doctor");
    expect(line.origin).toBe("booked");
    expect(line.appointmentTypeId).toBe("t-consult");
  });

  it("refuses a doctor-priced type when the doctor has no consultation charge, naming the setting", () => {
    const r = resolveVisitLine(
      consult,
      { ...drBhusal, consultationCharge: undefined },
      input,
    );

    const failed = refusalOf(r);
    expect(failed.reason).toMatch(/no consultation charge/);
    expect(failed.fixPath).toBe(DOCTOR_EDIT_SETTINGS);
  });

  it("refuses a catalogue type with no price — never a silent NPR 700 or 500", () => {
    const r = resolveVisitLine({ ...peel, price: undefined }, rina, {
      ...input,
      origin: "procedure",
    });

    const failed = refusalOf(r);
    expect(failed.reason).toMatch(/no price/);
    expect(failed.fixPath).toBe(APPOINTMENT_TYPES_SETTINGS);
  });

  it("a type priced 0 is FREE: a line is recorded and nothing is collectable", () => {
    const free: ChargeableType = {
      id: "t-fu",
      name: "Follow-up (free)",
      price: 0,
      billAtFrontDesk: true,
    };
    const r = resolveVisitLine(free, drBhusal, input);

    const line = lineOf(r);
    expect(line.price).toBe(0);
    expect(line.collectAtCheckIn).toBe(false);
  });

  it("the type's own commission rate beats the clinician's default; an excluded type earns 0", () => {
    const r = resolveVisitLine(peel, rina, { ...input, origin: "procedure" });

    expect(lineOf(r).commission).toBe(20);
    expect(
      resolveLineCommission(
        { calculateCommission: false, defaultCommission: 20 },
        rina,
      ),
    ).toEqual({
      calculateCommission: false,
      commission: 0,
    });
    expect(resolveLineCommission({}, rina).commission).toBe(10);
  });

  it("refuses a type the clinician's kind may not perform", () => {
    const r = resolveVisitLine(consult, rina, input);

    const failed = refusalOf(r);
    expect(failed.reason).toMatch(/performed by a doctor/);
  });

  it("legacy types with no flags are catalogue-priced, either-performer, not taxable, not collectable", () => {
    const legacy: ChargeableType = {
      id: "t-old",
      name: "Old Service",
      price: 1200,
    };
    const r = resolveVisitLine(legacy, rina, { ...input, origin: "procedure" });

    const line = lineOf(r);
    expect(line.price).toBe(1200);
    expect(line.isTaxable).toBe(false);
    expect(line.taxRate).toBeUndefined();
    expect(line.collectAtCheckIn).toBe(false);
  });

  it("quantity multiplies the amount, rounded to 2 dp", () => {
    const r = resolveVisitLine({ ...peel, price: 33.33 }, rina, {
      ...input,
      origin: "procedure",
      quantity: 3,
    });

    expect(lineOf(r).amount).toBe(99.99);
  });

  it("stamps recommendedBy on an expert-performed line", () => {
    const r = resolveVisitLine(peel, rina, {
      ...input,
      origin: "procedure",
      recommendedBy: "doc1",
    });

    expect(lineOf(r).recommendedBy).toBe("doc1");
  });
});

describe("resolveTypePrice / isCollectableAtCheckIn", () => {
  it("doctor pricing needs a doctor on the visit", () => {
    expect(resolveTypePrice(consult, rina).ok).toBe(false);
    expect(resolveTypePrice(consult, null).ok).toBe(false);
  });

  it("collect at check-in needs the flag AND a price", () => {
    expect(isCollectableAtCheckIn({ billAtFrontDesk: true }, 700)).toBe(true);
    expect(isCollectableAtCheckIn({ billAtFrontDesk: true }, 0)).toBe(false);
    expect(isCollectableAtCheckIn({ billAtFrontDesk: false }, 700)).toBe(false);
    expect(isCollectableAtCheckIn({}, 700)).toBe(false);
  });
});

describe("visitLineKey", () => {
  it("is origin + service + performer, so three old dedupe keys become one", () => {
    expect(
      visitLineKey({
        origin: "booked",
        appointmentTypeId: "t1",
        doctorId: "d1",
      }),
    ).toBe("booked:t1:d1");
    expect(visitLineKey({ appointmentTypeId: "t1", doctorId: "d1" })).toBe(
      "booked:t1:d1",
    );
    expect(
      visitLineKey({
        origin: "procedure",
        appointmentTypeId: "t1",
        doctorId: "d1",
      }),
    ).not.toBe(
      visitLineKey({
        origin: "booked",
        appointmentTypeId: "t1",
        doctorId: "d1",
      }),
    );
  });
});

describe("package sessions", () => {
  it("one per-session value, 2 dp", () => {
    expect(perSessionValue(10000, 6)).toBe(1666.67);
    expect(perSessionValue(10000, 0)).toBe(0);
  });

  it("a session line is price 0, commission on the per-session value, never collectable or taxed", () => {
    const line = buildPackageSessionLine(
      {
        id: "pkg1",
        name: "Laser Hair Removal (6)",
        calculateCommission: true,
        defaultCommission: 12,
      },
      { id: "pp1", perSessionValue: 1666.67 },
      rina,
      { addedBy: "staff1", now: NOW },
    );

    expect(line.origin).toBe("session");
    expect(line.price).toBe(0);
    expect(line.amount).toBe(1666.67);
    expect(line.commission).toBe(12);
    expect(line.collectAtCheckIn).toBe(false);
    expect(line.isTaxable).toBe(false);
    expect(line.patientPackageId).toBe("pp1");
    expect(line.doctorId).toBe("exp1");
  });
});
