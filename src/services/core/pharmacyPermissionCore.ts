/**
 * Who may do what in pharmacy/medicine management.
 *
 * Mirrors frontOfficePermissionCore.ts: role lists live on the clinic's
 * PharmacySettings rather than as RBAC permission keys (the role editor
 * validates permissions against page ids only). Before this, pharmacy had
 * no action-level gate at all — only the page-level "can this role open
 * Pharmacy" RBAC route guard — so any role that could see the page could
 * silently edit a batch's price, deactivate a medicine, or issue a return.
 */

import type { PharmacySettings, UserRole } from "@/types/models";

export type PharmacyAction =
  | "editPrice"
  | "deactivateMedicine"
  | "issueReturn"
  | "discount"
  | "writeOffStock";

export const DEFAULT_PHARMACY_ROLES: Record<PharmacyAction, UserRole[]> = {
  editPrice: ["clinic-admin"],
  deactivateMedicine: ["clinic-admin"],
  issueReturn: ["clinic-admin", "staff"],
  discount: ["clinic-admin"],
  writeOffStock: ["clinic-admin"],
};

const ROLE_LIST_FIELD: Record<PharmacyAction, keyof PharmacySettings> = {
  editPrice: "editPriceRoles",
  deactivateMedicine: "deactivateMedicineRoles",
  issueReturn: "issueReturnRoles",
  discount: "discountRoles",
  writeOffStock: "writeOffStockRoles",
};

function roleListFor(
  action: PharmacyAction,
  settings?: Partial<PharmacySettings> | null,
): UserRole[] {
  const list = settings?.[ROLE_LIST_FIELD[action]] as UserRole[] | undefined;

  return Array.isArray(list) ? list : DEFAULT_PHARMACY_ROLES[action];
}

export function canDoPharmacyAction(
  role: UserRole | string | null | undefined,
  action: PharmacyAction,
  settings?: Partial<PharmacySettings> | null,
): boolean {
  if (!role) return false;

  return roleListFor(action, settings).includes(role as UserRole);
}

/** This role's pharmacy discount ceiling, as a %; null means no cap (unlimited). */
export function pharmacyDiscountCapForRole(
  role: UserRole | string | null | undefined,
  settings?: Partial<PharmacySettings> | null,
): number | null {
  if (!role) return 0;
  const cap = settings?.discountCapPercent?.[role as UserRole];

  return typeof cap === "number" && cap >= 0 ? cap : null;
}

/** This role's ceiling on how much a single price edit may move a price, as a %; null means no cap. */
export function pharmacyPriceChangeCapForRole(
  role: UserRole | string | null | undefined,
  settings?: Partial<PharmacySettings> | null,
): number | null {
  if (!role) return 0;
  const cap = settings?.priceChangeCapPercent?.[role as UserRole];

  return typeof cap === "number" && cap >= 0 ? cap : null;
}

/**
 * Whether changing a price from `oldPrice` to `newPrice` in one edit is over
 * the role's cap. A price with nothing to compare against (new, or
 * previously unset/zero) is never judged — there is no "change" yet, only
 * an initial value, and that is exactly the kind of edit creating a brand
 * new medicine already does unrestricted.
 */
export function priceChangeExceedsCap(
  oldPrice: number | null | undefined,
  newPrice: number,
  capPercent: number | null,
): boolean {
  if (capPercent === null) return false;
  if (!oldPrice || oldPrice <= 0) return false;
  const pctChange = (Math.abs(newPrice - oldPrice) / oldPrice) * 100;

  return pctChange > capPercent + 1e-9;
}
