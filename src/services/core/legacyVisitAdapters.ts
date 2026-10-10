/**
 * Read-side adapters for visits recorded before the typed visit model.
 *
 * Lines written by the old desk carry no `origin` or `collectAtCheckIn`;
 * recommendations were an untyped `recommendedProcedure` blob with items
 * keyed by `id` and no performer. These helpers let every new reader treat
 * such records as if they had been written in the new shape, so in-flight
 * visits settle correctly the day the new code ships. They are the only
 * place legacy shapes are interpreted; delete them with the last stage.
 */

import type { VisitRecommendedItem } from "@/types/models";

import type { VisitLineOrigin } from "./visitChargeCore";

export interface LegacyLineShape {
  appointmentTypeId?: string | null;
  origin?: string | null;
  collectAtCheckIn?: boolean | null;
  price?: number | null;
  amount?: number | null;
  patientPackageId?: string | null;
  lineKind?: string | null;
}

/**
 * Where a line came from. A legacy line is "booked" when it carries the
 * appointment's own type (the consultation the desk appended at intake),
 * "session" when it is a price-0 commission-only package line, else
 * "procedure".
 */
export function legacyLineOrigin(
  line: LegacyLineShape,
  appointmentTypeId?: string | null,
): VisitLineOrigin {
  if (
    line.origin === "booked" ||
    line.origin === "procedure" ||
    line.origin === "session" ||
    line.origin === "manual"
  ) {
    return line.origin;
  }
  if (
    line.patientPackageId ||
    ((line.price || 0) === 0 && (line.amount || 0) > 0)
  ) {
    return "session";
  }
  if (appointmentTypeId && line.appointmentTypeId === appointmentTypeId) {
    return "booked";
  }

  return "procedure";
}

/**
 * Whether this line's money is collected at check-in. The flag wins when
 * present; a legacy booked line was always deposited at intake under the
 * old model, so it counts as collectable; everything else waits for Settle.
 */
export function isLineCollectableAtCheckIn(
  line: LegacyLineShape,
  appointmentTypeId?: string | null,
): boolean {
  if (typeof line.collectAtCheckIn === "boolean") return line.collectAtCheckIn;
  if ((line.price || 0) <= 0) return false;

  return legacyLineOrigin(line, appointmentTypeId) === "booked";
}

interface LegacyRecommendation {
  items?: Array<{
    id?: string;
    name?: string;
    price?: number;
    fee?: number;
    quantity?: number;
  }>;
  fee?: number;
  name?: string;
  recommendedBy?: string;
}

/**
 * The old untyped recommendation as typed items. No performer was recorded,
 * so the assigned expert (else the doctor) is assumed — exactly what the
 * old Finalise modal's "blank = Auto" did.
 */
export function legacyRecommendationToItems(
  rec: unknown,
  visit: {
    doctorId?: string | null;
    assignedExpertId?: string | null;
    doctorName?: string | null;
    expertName?: string | null;
  },
  now: Date,
): VisitRecommendedItem[] {
  if (!rec || typeof rec !== "object") return [];

  const legacy = rec as LegacyRecommendation;
  const hasExpert = Boolean(
    visit.assignedExpertId && visit.assignedExpertId !== "unassigned",
  );
  const performedBy: VisitRecommendedItem["performedBy"] = hasExpert
    ? {
        id: visit.assignedExpertId as string,
        kind: "expert",
        name: visit.expertName || "",
      }
    : {
        id: visit.doctorId || "unassigned",
        kind: "doctor",
        name: visit.doctorName || "",
      };
  const recommendedBy = legacy.recommendedBy || visit.doctorId || "";
  const items =
    Array.isArray(legacy.items) && legacy.items.length > 0
      ? legacy.items
      : legacy.name
        ? [{ id: "", name: legacy.name, price: legacy.fee }]
        : [];

  return items
    .filter((i) => i && (i.id || i.name))
    .map((i, index) => ({
      id: `legacy-${index}-${i.id || i.name}`,
      appointmentTypeId: i.id || "",
      name: i.name || "",
      quantity: Math.max(1, Math.floor(i.quantity || 1)),
      performedBy,
      recommendedBy,
      doToday: true,
      status: "recommended" as const,
      decidedAt: now,
    }));
}
