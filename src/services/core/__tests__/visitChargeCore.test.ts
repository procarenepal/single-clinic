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
  asCommissionOnlyLine,
  previewLineCharge,
  refusalMessage,
  splitAmount,
  withLinePrice,
} from "../visitChargeCore";
import { findBookedLine, mergeVisitLines } from "../legacyVisitAdapters";

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

describe("splitAmount / withLinePrice — shares that still sum to the catalogue price", () => {
  it("puts the odd paisa on the first shares", () => {
    expect(splitAmount(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitAmount(2500, 2)).toEqual([1250, 1250]);
    expect(splitAmount(0.05, 2)).toEqual([0.03, 0.02]);
    expect(splitAmount(700, 0)).toEqual([700]);
  });

  it("the shares always sum to the whole, two decimals", () => {
    for (let n = 1; n <= 7; n++) {
      for (const total of [1, 99.99, 1666.67, 4500, 0.01]) {
        const sum = splitAmount(total, n).reduce((a, b) => a + b, 0);

        expect(Math.round(sum * 100) / 100).toBe(total);
      }
    }
  });

  it("withLinePrice keeps the line and re-derives the amount", () => {
    const line = resolveVisitLine(
      { id: "t", name: "Peel", price: 2500 },
      rina,
      { origin: "procedure", addedBy: "u", now: new Date(0) },
    );

    if (line.ok === false) throw new Error("expected a line");
    const share = withLinePrice(line.line, 1250);

    expect(share.price).toBe(1250);
    expect(share.amount).toBe(1250);
    expect(share.appointmentTypeId).toBe("t");
    expect(share.id).toBe(line.line.id);
  });

  it("asCommissionOnlyLine bills the patient nothing but keeps the full price as the commission base", () => {
    // A service shared by three clinicians: the patient is charged once
    // (a separate full-price line, not shown here), and each OTHER
    // clinician gets this instead — their own commission on the FULL
    // catalogue price, not a three-way split of it.
    const line = resolveVisitLine(
      { id: "t", name: "Acne Consultation & Care", price: 400, defaultCommission: 12 },
      rina,
      { origin: "booked", addedBy: "u", now: new Date(0) },
    );

    if (line.ok === false) throw new Error("expected a line");
    const shared = asCommissionOnlyLine(line.line, 400);

    expect(shared.price).toBe(0);
    expect(shared.amount).toBe(400);
    expect(shared.collectAtCheckIn).toBe(false);
    // Everything else about the line — who it's attributed to, their
    // commission rate — is untouched.
    expect(shared.doctorId).toBe(rina.id);
    expect(shared.commission).toBe(12);
  });
});

describe("previewLineCharge — the read-only fee line", () => {
  const pricing = { taxPercentage: 13, isTaxEnabled: true };

  it("prices, taxes and flags collect-at-check-in like the resolver", () => {
    const p = previewLineCharge(
      {
        id: "c",
        name: "Doctor Consultation",
        pricedBy: "doctor",
        performerKind: "doctor",
        billAtFrontDesk: true,
        isTaxable: true,
        taxRate: 13,
      },
      { id: "d1", name: "Dr. A", kind: "doctor", consultationCharge: 700 },
      pricing,
    );

    expect(p).toEqual({
      ok: true,
      price: 700,
      vat: 91,
      total: 791,
      isTaxable: true,
      collectAtCheckIn: true,
      isFree: false,
    });
  });

  it("a free type previews as free and not collectable; an exempt type has no VAT", () => {
    const free = previewLineCharge(
      { id: "f", name: "Follow-up", price: 0, billAtFrontDesk: true },
      null,
      pricing,
    );

    expect(free).toMatchObject({
      ok: true,
      isFree: true,
      collectAtCheckIn: false,
      total: 0,
    });
    const exempt = previewLineCharge(
      { id: "e", name: "Dressing", price: 300, isTaxable: false },
      null,
      pricing,
    );

    expect(exempt).toMatchObject({ ok: true, vat: 0, total: 300 });
  });

  it("refuses what the resolver refuses, and formats one sentence", () => {
    const noDoctorYet = previewLineCharge(
      { id: "c", name: "Doctor Consultation", pricedBy: "doctor" },
      null,
      pricing,
    );

    expect(noDoctorYet.ok).toBe(false);
    const wrongKind = previewLineCharge(
      {
        id: "c",
        name: "Doctor Consultation",
        pricedBy: "doctor",
        performerKind: "doctor",
      },
      rina,
      pricing,
    );

    expect(wrongKind.ok).toBe(false);
    if (wrongKind.ok === false) {
      expect(refusalMessage(wrongKind)).toMatch(
        /performed by a doctor, not Rina\. Fix it under Settings/,
      );
    }
    const unpriced = previewLineCharge(
      { id: "u", name: "Mystery" },
      null,
      pricing,
    );

    expect(unpriced.ok).toBe(false);
  });
});

describe("mergeVisitLines / findBookedLine — one dedupe rule", () => {
  const booked = {
    id: "a",
    origin: "booked",
    appointmentTypeId: "c",
    doctorId: "d1",
    price: 700,
    amount: 700,
  };
  const procedure = {
    id: "b",
    origin: "procedure",
    appointmentTypeId: "p",
    doctorId: "e1",
    price: 2500,
    amount: 2500,
  };

  it("skips a line already on the visit and keeps the rest", () => {
    const r = mergeVisitLines([booked], [booked, procedure], "c");

    expect(r.added).toEqual([procedure]);
    expect(r.skipped).toEqual([booked]);
    expect(r.next).toHaveLength(2);
  });

  it("matches a legacy line that never stored its origin", () => {
    const legacy = {
      id: "old",
      appointmentTypeId: "c",
      doctorId: "d1",
      price: 700,
      amount: 700,
    };
    const r = mergeVisitLines([legacy], [booked], "c");

    expect(r.added).toEqual([]);
    expect(r.skipped).toEqual([booked]);
  });

  it("the same service for a different performer is a different line", () => {
    const r = mergeVisitLines(
      [booked],
      [{ ...booked, id: "x", doctorId: "d2" }],
      "c",
    );

    expect(r.added).toHaveLength(1);
  });

  it("finds the booked line for a service whoever performs it", () => {
    expect(findBookedLine([booked, procedure], "c", "c")?.id).toBe("a");
    expect(findBookedLine([procedure], "c", "c")).toBeUndefined();
    expect(
      findBookedLine(
        [
          {
            id: "old",
            appointmentTypeId: "c",
            doctorId: "d9",
            price: 700,
            amount: 700,
          },
        ],
        "c",
        "c",
      )?.id,
    ).toBe("old");
  });
});

describe("legacy pseudo-id lines", () => {
  it("the old desk's consultation-fee line is the booked line, so nothing is appended twice", () => {
    const legacy = {
      id: "old",
      appointmentTypeId: "consultation-fee",
      doctorId: "d1",
      price: 700,
      amount: 700,
    };

    expect(findBookedLine([legacy], "c", "c")?.id).toBe("old");
    expect(findBookedLine([legacy], "c", undefined)?.id).toBe("old");
    const r = mergeVisitLines([legacy], [legacy], "c");

    expect(r.added).toEqual([]);
  });
});
