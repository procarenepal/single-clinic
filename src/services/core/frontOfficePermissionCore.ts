/**
 * Who may do what at the front desk.
 *
 * Role lists live in the billing settings' `frontOffice` block rather than
 * as RBAC permission keys: the role editor validates permissions against
 * page ids only (rbacService.validatePermissions), so a key like
 * "billing.discount" would be rejected on save. This helper is the single
 * reader of the lists, so moving to per-user keys later is a one-file
 * change.
 */

import type { FrontOfficeSettings, UserRole } from "@/types/models";

export type FrontOfficeAction =
  | "discount"
  | "priceOverride"
  | "lineRemoval"
  | "skipTriage"
  | "settle"
  | "refund"
  | "sellPackage";

export const DEFAULT_FRONT_OFFICE_ROLES: Record<FrontOfficeAction, UserRole[]> =
  {
    discount: ["clinic-admin"],
    priceOverride: ["clinic-admin"],
    lineRemoval: ["clinic-admin", "staff"],
    skipTriage: ["clinic-admin"],
    settle: ["clinic-admin", "staff"],
    refund: ["clinic-admin"],
    sellPackage: ["clinic-admin", "staff"],
  };

const ROLE_LIST_FIELD: Record<FrontOfficeAction, keyof FrontOfficeSettings> = {
  discount: "discountRoles",
  priceOverride: "priceOverrideRoles",
  lineRemoval: "lineRemovalRoles",
  skipTriage: "skipTriageRoles",
  settle: "settleRoles",
  refund: "refundRoles",
  sellPackage: "sellPackageRoles",
};

/** The full settings block with every default applied. */
export function withFrontOfficeDefaults(
  settings?: Partial<FrontOfficeSettings> | null,
): FrontOfficeSettings {
  return {
    defaultConsultationTypeId: settings?.defaultConsultationTypeId,
    defaultExpertTypeId: settings?.defaultExpertTypeId,
    rooms: Array.isArray(settings?.rooms) ? settings.rooms : [],
    discountRoles:
      settings?.discountRoles ?? DEFAULT_FRONT_OFFICE_ROLES.discount,
    priceOverrideRoles:
      settings?.priceOverrideRoles ?? DEFAULT_FRONT_OFFICE_ROLES.priceOverride,
    lineRemovalRoles:
      settings?.lineRemovalRoles ?? DEFAULT_FRONT_OFFICE_ROLES.lineRemoval,
    skipTriageRoles:
      settings?.skipTriageRoles ?? DEFAULT_FRONT_OFFICE_ROLES.skipTriage,
    settleRoles: settings?.settleRoles ?? DEFAULT_FRONT_OFFICE_ROLES.settle,
    refundRoles: settings?.refundRoles ?? DEFAULT_FRONT_OFFICE_ROLES.refund,
    sellPackageRoles:
      settings?.sellPackageRoles ?? DEFAULT_FRONT_OFFICE_ROLES.sellPackage,
    triageForExpertVisits: settings?.triageForExpertVisits ?? false,
    collectProcedureBeforePerforming:
      settings?.collectProcedureBeforePerforming ?? false,
    settleV2: settings?.settleV2 ?? false,
    intakeV2: settings?.intakeV2 ?? false,
  };
}

export function canDoFrontOfficeAction(
  role: UserRole | string | null | undefined,
  action: FrontOfficeAction,
  settings?: Partial<FrontOfficeSettings> | null,
): boolean {
  if (!role) return false;
  const list = withFrontOfficeDefaults(settings)[
    ROLE_LIST_FIELD[action]
  ] as UserRole[];

  return Array.isArray(list) && list.includes(role as UserRole);
}
