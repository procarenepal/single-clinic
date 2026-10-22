import { describe, it, expect } from "vitest";

import {
  canDoPharmacyAction,
  pharmacyDiscountCapForRole,
  pharmacyPriceChangeCapForRole,
  priceChangeExceedsCap,
  DEFAULT_PHARMACY_ROLES,
} from "../pharmacyPermissionCore";

describe("canDoPharmacyAction", () => {
  it("applies the defaults when the clinic has configured nothing", () => {
    expect(canDoPharmacyAction("clinic-admin", "editPrice")).toBe(true);
    expect(canDoPharmacyAction("staff", "editPrice")).toBe(false);
    expect(canDoPharmacyAction("staff", "issueReturn")).toBe(true);
    expect(canDoPharmacyAction("doctor", "issueReturn")).toBe(false);
    expect(canDoPharmacyAction("staff", "discount")).toBe(false);
  });

  it("honours a configured role list and ignores unknown roles", () => {
    expect(
      canDoPharmacyAction("staff", "discount", {
        discountRoles: ["clinic-admin", "staff"],
      }),
    ).toBe(true);
    expect(canDoPharmacyAction(null, "discount")).toBe(false);
  });

  it("an explicitly empty list means no one, not 'use the default'", () => {
    expect(
      canDoPharmacyAction("clinic-admin", "issueReturn", {
        issueReturnRoles: [],
      }),
    ).toBe(false);
  });

  it("DEFAULT_PHARMACY_ROLES covers every action", () => {
    expect(Object.keys(DEFAULT_PHARMACY_ROLES).sort()).toEqual(
      [
        "deactivateMedicine",
        "discount",
        "editPrice",
        "issueReturn",
        "writeOffStock",
      ].sort(),
    );
  });

  it("writeOffStock defaults to clinic-admin only", () => {
    expect(canDoPharmacyAction("clinic-admin", "writeOffStock")).toBe(true);
    expect(canDoPharmacyAction("staff", "writeOffStock")).toBe(false);
  });
});

describe("pharmacyDiscountCapForRole", () => {
  it("is unlimited when nothing is configured", () => {
    expect(pharmacyDiscountCapForRole("clinic-admin")).toBeNull();
  });

  it("reads the configured cap for that role only", () => {
    const settings = { discountCapPercent: { staff: 10 } };

    expect(pharmacyDiscountCapForRole("staff", settings)).toBe(10);
    expect(pharmacyDiscountCapForRole("clinic-admin", settings)).toBeNull();
  });

  it("no role gets no discount", () => {
    expect(pharmacyDiscountCapForRole(null)).toBe(0);
  });
});

describe("pharmacyPriceChangeCapForRole", () => {
  it("is unlimited when nothing is configured", () => {
    expect(pharmacyPriceChangeCapForRole("clinic-admin")).toBeNull();
  });

  it("reads the configured cap for that role only", () => {
    const settings = { priceChangeCapPercent: { staff: 20 } };

    expect(pharmacyPriceChangeCapForRole("staff", settings)).toBe(20);
    expect(pharmacyPriceChangeCapForRole("clinic-admin", settings)).toBeNull();
  });
});

describe("priceChangeExceedsCap", () => {
  it("never exceeds an unlimited (null) cap", () => {
    expect(priceChangeExceedsCap(100, 1000, null)).toBe(false);
  });

  it("judges the % change against the old price", () => {
    expect(priceChangeExceedsCap(100, 115, 20)).toBe(false); // +15%
    expect(priceChangeExceedsCap(100, 125, 20)).toBe(true); // +25%
    expect(priceChangeExceedsCap(100, 120, 20)).toBe(false); // exactly at the cap
  });

  it("a decrease is judged by its magnitude too, not just increases", () => {
    expect(priceChangeExceedsCap(100, 70, 20)).toBe(true); // -30%
    expect(priceChangeExceedsCap(100, 90, 20)).toBe(false); // -10%
  });

  it("no prior price means nothing to compare against — never exceeds", () => {
    expect(priceChangeExceedsCap(0, 500, 20)).toBe(false);
    expect(priceChangeExceedsCap(null, 500, 20)).toBe(false);
    expect(priceChangeExceedsCap(undefined, 500, 20)).toBe(false);
  });
});
