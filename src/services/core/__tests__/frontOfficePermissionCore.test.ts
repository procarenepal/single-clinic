import { describe, it, expect } from "vitest";

import {
  canDoFrontOfficeAction,
  withFrontOfficeDefaults,
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
  });
});
