import { describe, it, expect } from "vitest";

import {
  canDoFrontOfficeAction,
  withFrontOfficeDefaults,
  discountCapForRole,
  discountExceedsCap,
  DEFAULT_FRONT_OFFICE_ROLES,
} from "../frontOfficePermissionCore";

describe("canDoFrontOfficeAction", () => {
  it("applies the defaults when the clinic has configured nothing", () => {
    expect(canDoFrontOfficeAction("clinic-admin", "discount")).toBe(true);
    expect(canDoFrontOfficeAction("staff", "discount")).toBe(false);
    expect(canDoFrontOfficeAction("staff", "settle")).toBe(true);
    expect(canDoFrontOfficeAction("doctor", "settle")).toBe(false);
    expect(canDoFrontOfficeAction("expert", "settle")).toBe(false);
    expect(canDoFrontOfficeAction("staff", "refund")).toBe(false);
  });

  it("honours a configured role list and ignores unknown roles", () => {
    const settings = { discountRoles: ["clinic-admin", "staff"] as const };

    expect(
      canDoFrontOfficeAction("staff", "discount", {
        discountRoles: [...settings.discountRoles],
      }),
    ).toBe(true);
    expect(
      canDoFrontOfficeAction("nobody", "discount", {
        discountRoles: [...settings.discountRoles],
      }),
    ).toBe(false);
    expect(canDoFrontOfficeAction(null, "discount")).toBe(false);
  });

  it("an explicitly empty list means no one, not 'use the default'", () => {
    expect(
      canDoFrontOfficeAction("clinic-admin", "refund", { refundRoles: [] }),
    ).toBe(false);
  });

  it("withFrontOfficeDefaults fills every field", () => {
    const d = withFrontOfficeDefaults(null);

    expect(d.rooms).toEqual([]);
    expect(d.settleRoles).toEqual(DEFAULT_FRONT_OFFICE_ROLES.settle);
    expect(d.triageForExpertVisits).toBe(false);
    expect(d.collectProcedureBeforePerforming).toBe(false);
    expect(d.settleV2).toBe(false);
    expect(d.intakeV2).toBe(false);
    expect(d.discountCapPercent).toEqual({});
  });
});

describe("discountCapForRole", () => {
  it("is unlimited when nothing is configured", () => {
    expect(discountCapForRole("clinic-admin")).toBeNull();
  });

  it("reads the configured cap for that role only", () => {
    const settings = { discountCapPercent: { staff: 10 } };

    expect(discountCapForRole("staff", settings)).toBe(10);
    expect(discountCapForRole("clinic-admin", settings)).toBeNull();
  });

  it("a role with no role at all gets no discount", () => {
    expect(discountCapForRole(null)).toBe(0);
    expect(discountCapForRole(undefined)).toBe(0);
  });

  it("a configured cap of 0 is a real cap, not 'unset'", () => {
    expect(discountCapForRole("staff", { discountCapPercent: { staff: 0 } })).toBe(
      0,
    );
  });
});

describe("discountExceedsCap", () => {
  it("never exceeds an unlimited (null) cap", () => {
    expect(discountExceedsCap("percent", 90, 1000, null)).toBe(false);
  });

  it("a percent discount compares directly against the cap", () => {
    expect(discountExceedsCap("percent", 10, 1000, 15)).toBe(false);
    expect(discountExceedsCap("percent", 20, 1000, 15)).toBe(true);
    expect(discountExceedsCap("percent", 15, 1000, 15)).toBe(false);
  });

  it("a flat discount is judged as the % of the subtotal it represents", () => {
    // 150 off a 1000 subtotal is 15% — at the cap, not over it.
    expect(discountExceedsCap("flat", 150, 1000, 15)).toBe(false);
    expect(discountExceedsCap("flat", 200, 1000, 15)).toBe(true);
  });

  it("nothing can exceed a cap against a zero subtotal", () => {
    expect(discountExceedsCap("flat", 50, 0, 15)).toBe(false);
  });

  it("no discount at all never exceeds", () => {
    expect(discountExceedsCap("percent", 0, 1000, 5)).toBe(false);
  });
});
