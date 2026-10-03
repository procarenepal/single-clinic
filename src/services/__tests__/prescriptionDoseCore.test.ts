/**
 * prescriptionDoseCore.test.ts
 *
 * The frequency and duration parsing that decides how many units a
 * prescription dispenses was inlined inside a JSX callback in pharmacy.tsx,
 * where nothing exercised it. These tests pin it so the billing counter can
 * dispense against a prescription without re-deriving the rules — and so the
 * Nepali morning-noon-night notation keeps working, which is the part most
 * likely to be dropped by someone rewriting this.
 */

import { describe, it, expect } from "vitest";

import {
  courseDurationInDays,
  dosesPerDay,
  durationInDays,
  suggestedDispenseQuantity,
} from "../core/prescriptionDoseCore";

describe("dosesPerDay", () => {
  it("reads English, Latin and morning-noon-night notation as the same thing", () => {
    for (const once of [
      "once daily",
      "OD",
      "qd",
      "q.d.",
      "1-0-0",
      "0-1-0",
      "0-0-1",
    ]) {
      expect(dosesPerDay(once)).toBe(1);
    }
    for (const twice of [
      "twice daily",
      "BD",
      "bid",
      "b.i.d.",
      "1-0-1",
      "2-0-2",
    ]) {
      expect(dosesPerDay(twice)).toBe(2);
    }
    for (const thrice of [
      "three times daily",
      "TDS",
      "tid",
      "t.i.d.",
      "1-1-1",
    ]) {
      expect(dosesPerDay(thrice)).toBe(3);
    }
    for (const four of ["four times daily", "QID", "q.i.d."]) {
      expect(dosesPerDay(four)).toBe(4);
    }
  });

  it("is case and whitespace insensitive", () => {
    expect(dosesPerDay("  Twice Daily  ")).toBe(2);
    expect(dosesPerDay("  1-1-1 ")).toBe(3);
  });

  it("treats as-needed as a single unit", () => {
    // There is no schedule to multiply, and dispensing a full course nobody
    // asked for is the worse error.
    for (const prn of ["as needed", "SOS", "prn"]) {
      expect(dosesPerDay(prn)).toBe(1);
    }
  });

  it("picks up an explicitly numbered frequency", () => {
    expect(dosesPerDay("5 times")).toBe(5);
    expect(dosesPerDay("2 tabs")).toBe(2);
    expect(dosesPerDay("3 doses")).toBe(3);
  });

  it("falls back to one for anything unrecognised or missing", () => {
    expect(dosesPerDay("whenever")).toBe(1);
    expect(dosesPerDay("")).toBe(1);
    expect(dosesPerDay(undefined)).toBe(1);
    expect(dosesPerDay(null)).toBe(1);
  });
});

describe("durationInDays", () => {
  it("reads days, weeks and months", () => {
    expect(durationInDays("5 days")).toBe(5);
    expect(durationInDays("2 weeks")).toBe(14);
    expect(durationInDays("1 month")).toBe(30);
  });

  it("takes the first number it finds", () => {
    expect(durationInDays("10")).toBe(10);
    expect(durationInDays("7 day course")).toBe(7);
  });

  it("falls back to one day when there is no number", () => {
    expect(durationInDays("as directed")).toBe(1);
    expect(durationInDays("")).toBe(1);
    expect(durationInDays(undefined)).toBe(1);
  });
});

describe("suggestedDispenseQuantity", () => {
  it("multiplies doses per day by the prescribed days", () => {
    expect(
      suggestedDispenseQuantity({ frequency: "1-0-1", duration: "5 days" }),
    ).toBe(10);
    expect(
      suggestedDispenseQuantity({ frequency: "TDS", duration: "2 weeks" }),
    ).toBe(42);
    expect(
      suggestedDispenseQuantity({
        frequency: "once daily",
        duration: "1 month",
      }),
    ).toBe(30);
  });

  it("suggests a single unit when neither field says anything useful", () => {
    expect(suggestedDispenseQuantity({})).toBe(1);
  });
});

describe("courseDurationInDays", () => {
  it("takes the longest duration on the prescription", () => {
    expect(
      courseDurationInDays([
        { duration: "3 days" },
        { duration: "2 weeks" },
        { duration: "5 days" },
      ]),
    ).toBe(14);
  });

  it("is zero for an empty prescription", () => {
    expect(courseDurationInDays([])).toBe(0);
  });
});
