/**
 * The impure half of the charge core: find the clinician, put a line on the
 * visit, take the money the check-in scope says is due.
 *
 * Every front-office screen and the prescription page call these three
 * functions; none of them builds a line of its own any more. The old desk
 * had four line builders (check-in, routing, the booked-type fallback at
 * Complete Consultation, the Settle fallback) plus two on the prescription
 * page, each with its own price precedence, its own NPR 700/500 fallback
 * and its own dedupe key. Now: resolveVisitLine decides, mergeVisitLines
 * dedupes inside a transaction, and the deposit is claimed before any money
 * moves.
 */

import type {
  Appointment,
  AppointmentBillingItem,
  Doctor,
  Expert,
  TreatmentPackage,
} from "@/types/models";
import type { VisitPricingContext } from "./core/visitBillingCore";

import { appointmentService } from "./appointmentService";
import { doctorService } from "./doctorService";
import { expertService } from "./expertService";
import { patientPackageService } from "./patientPackageService";
import { walletService } from "./walletService";
import {
  buildPackageSessionLine,
  resolveVisitLine,
  withLinePrice,
  type ChargeClinician,
  type ChargeRefused,
  type ChargeableType,
  type VisitLine,
  type VisitLineOrigin,
} from "./core/visitChargeCore";

export interface VisitLineContext {
  clinicId: string;
  userId: string;
  pricing: VisitPricingContext;
  now?: Date;
}

export type EnsureLineResult =
  | { ok: true; line: VisitLine; added: boolean }
  | ChargeRefused;

export const doctorAsClinician = (d: Doctor): ChargeClinician => ({
  id: d.id,
  name: d.name,
  kind: "doctor",
  consultationCharge: d.consultationCharge,
  defaultCommission: d.defaultCommission,
});

export const expertAsClinician = (e: Expert): ChargeClinician => ({
  id: e.id,
  name: e.name,
  kind: "expert",
  defaultCommission: e.defaultCommission,
});

/**
 * The clinician behind an id: the loaded lists first, then a fetch (a
 * clinician who went inactive mid-visit is still the one who performed).
 * `kind` narrows the search when the caller knows it; without it a doctor
 * id is tried before an expert id.
 */
export async function findClinician(
  id: string | null | undefined,
  kind: "doctor" | "expert" | undefined,
  lists: { doctors: Doctor[]; experts: Expert[] },
): Promise<ChargeClinician | null> {
  if (!id || id === "unassigned") return null;

  if (kind !== "expert") {
    const d = lists.doctors.find((x) => x.id === id);

    if (d) return doctorAsClinician(d);
  }
  if (kind !== "doctor") {
    const e = lists.experts.find((x) => x.id === id);

    if (e) return expertAsClinician(e);
  }
  if (kind !== "expert") {
    const d = await doctorService.getDoctorById(id).catch(() => null);

    if (d) return doctorAsClinician(d);
  }
  if (kind !== "doctor") {
    const e = await expertService.getExpertById(id).catch(() => null);

    if (e) return expertAsClinician(e);
  }

  return null;
}

/**
 * Put one catalogue service on the visit for one performer, or say why it
 * cannot be. `price` is only for a share of a split procedure; the catalogue
 * price is the default and the only other source.
 */
export async function ensureVisitLine(input: {
  appointment: Pick<Appointment, "id">;
  type: ChargeableType;
  clinician: ChargeClinician;
  origin: VisitLineOrigin;
  ctx: VisitLineContext;
  recommendedBy?: string;
  price?: number;
}): Promise<EnsureLineResult> {
  const resolved = resolveVisitLine(input.type, input.clinician, {
    origin: input.origin,
    addedBy: input.ctx.userId,
    now: input.ctx.now || new Date(),
    recommendedBy: input.recommendedBy,
  });

  if (resolved.ok === false) return resolved;

  const line =
    typeof input.price === "number"
      ? withLinePrice(resolved.line, input.price)
      : resolved.line;
  const { added } = await appointmentService.appendPendingVisitLines(
    input.appointment.id,
    [line as AppointmentBillingItem],
  );

  return { ok: true, line, added: added.length > 0 };
}

/**
 * The commission-only line for a package session: price 0 (prepaid at
 * sale), commission on the per-session value fixed at sale. Legacy patient
 * packages without that value get the whole-rupee figure the wallet has
 * been deducting.
 */
export async function ensureSessionLine(input: {
  appointment: Pick<Appointment, "id">;
  patientPackageId: string;
  /** The clinic's packages, to find the one the patient package was sold from. */
  packages: TreatmentPackage[];
  performer: ChargeClinician;
  ctx: VisitLineContext;
}): Promise<EnsureLineResult> {
  const pp = await patientPackageService.getPatientPackageById(
    input.patientPackageId,
  );

  if (!pp) {
    return {
      ok: false,
      reason: "The package session could not be found on this patient.",
      fixPath: "Patients › Packages",
    };
  }
  const pkg = input.packages.find((p) => p.id === pp.packageId);
  const sessions = pp.totalSessions || pkg?.totalSessions || 0;
  // Legacy patient packages (sold before the per-session value was stored)
  // use the WHOLE-rupee figure consumeSession has been deducting, so the
  // commission base and the wallet agree. New sales store a 2 dp value.
  const credit = pkg?.walletCreditAmount ?? pkg?.price ?? 0;
  const value =
    typeof pp.perSessionValue === "number"
      ? pp.perSessionValue
      : sessions > 0
        ? Math.round(credit / sessions)
        : 0;
  const line = buildPackageSessionLine(
    {
      id: pkg?.id || pp.packageId,
      name: pp.packageName || pkg?.name || "Package session",
      calculateCommission: pkg?.calculateCommission,
      defaultCommission: pkg?.defaultCommission,
    },
    { id: pp.id, perSessionValue: value },
    input.performer,
    { addedBy: input.ctx.userId, now: input.ctx.now || new Date() },
  );
  const { added } = await appointmentService.appendPendingVisitLines(
    input.appointment.id,
    [line as AppointmentBillingItem],
  );

  return { ok: true, line, added: added.length > 0 };
}

/**
 * Collect what the check-in scope still says is due, as a wallet deposit
 * tagged to the visit. The amount is claimed atomically first, so two desks
 * cannot both take it; if the wallet write then fails the claim is handed
 * back and the error rethrown, so the visit never looks paid for money that
 * was not taken. Returns the amount collected — 0 when nothing was due or
 * another desk collected it a moment ago.
 */
export async function collectCheckInDue(
  visit: { id: string; patientId: string },
  ctx: VisitLineContext,
  method = "cash",
): Promise<number> {
  const claimed = await appointmentService.claimVisitDeposit(
    visit.id,
    "due",
    ctx.pricing,
    "checkin",
  );

  if (claimed <= 0) return 0;

  try {
    await walletService.addFunds(
      visit.patientId,
      ctx.clinicId,
      claimed,
      method,
      `Visit deposit — collected at check-in (appointment ${visit.id})`,
      ctx.userId,
      visit.id,
      "appointment",
    );
  } catch (err) {
    await appointmentService
      .releaseVisitDeposit(visit.id, claimed)
      .catch((releaseErr) =>
        console.error(
          "Failed to release an unfulfilled deposit claim:",
          releaseErr,
        ),
      );
    throw err;
  }

  return claimed;
}
