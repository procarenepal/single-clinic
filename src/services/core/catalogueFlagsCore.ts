/**
 * The one-time translation of the catalogue's NAME-keyed behaviour into
 * explicit flags, and the pre-flight that the owner signs before the front
 * office starts refusing to bill anything the catalogue did not price.
 *
 * Today the desk decides "is this the consultation" by testing whether a
 * type's name contains "consult", which also matches "Acne Consultation &
 * Care" (NPR 1,200) and "Botox & Anti-Aging Consultation" (NPR 3,000) —
 * and bills them at the doctor's NPR 700 charge instead. The migration
 * must not enshrine that: only the clinic's designated consultation type
 * becomes doctor-priced, and every other "consult"-named type is listed in
 * the report with the price it will bill at from now on.
 *
 * Pure: records in, patches and a report out. The script applies them.
 */

export interface CatalogueTypeRecord {
  id: string;
  name: string;
  price?: number | null;
  isActive?: boolean;
  billAtFrontDesk?: boolean | null;
  calculateCommission?: boolean | null;
  isTaxable?: boolean | null;
  taxRate?: number | null;
  defaultCommission?: number | null;
  pricedBy?: string | null;
  performerKind?: string | null;
  procedureLog?: string | null;
}

export interface CatalogueDoctorRecord {
  id: string;
  name: string;
  isActive?: boolean;
  isDeleted?: boolean;
  consultationCharge?: number | null;
}

export interface CataloguePackageRecord {
  id: string;
  name: string;
  isActive?: boolean;
  isTaxable?: boolean | null;
  sessionPerformerKind?: string | null;
  walletCreditAmount?: number | null;
  totalSessions?: number | null;
}

export interface PatientPackageRecord {
  id: string;
  packageId?: string | null;
  packageName?: string | null;
  totalSessions?: number | null;
  perSessionValue?: number | null;
  status?: string | null;
}

export interface RecordPlan {
  id: string;
  name: string;
  patch: Record<string, unknown>;
  notes: string[];
}

const isMoney = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

const hasWord = (name: string, re: RegExp) => re.test(name || "");

/**
 * The clinic's designated consultation type: the one flagged to collect at
 * check-in whose name says "consultation", preferring an exact "Doctor
 * Consultation". Everything else named "…Consultation…" is a service with
 * its own catalogue price.
 */
export function findDesignatedConsultation(
  types: CatalogueTypeRecord[],
): CatalogueTypeRecord | undefined {
  const active = types.filter((t) => t.isActive !== false);
  const exact = active.find((t) =>
    /^\s*doctor consultation\s*$/i.test(t.name || ""),
  );

  if (exact) return exact;

  return active.find(
    (t) => t.billAtFrontDesk === true && hasWord(t.name, /consult/i),
  );
}

/** The clinic's default expert service, if the catalogue has the usual one. */
export function findDesignatedExpertType(
  types: CatalogueTypeRecord[],
): CatalogueTypeRecord | undefined {
  const active = types.filter((t) => t.isActive !== false);

  return active.find((t) => /^\s*skin test\s*$/i.test(t.name || ""));
}

/** What to write on one type so every reader finds explicit flags. */
export function planTypeFlags(
  type: CatalogueTypeRecord,
  designatedConsultationId: string | undefined,
  designatedExpertTypeId: string | undefined,
): RecordPlan {
  const patch: Record<string, unknown> = {};
  const notes: string[] = [];
  const isDesignated = type.id === designatedConsultationId;

  if (typeof type.billAtFrontDesk !== "boolean") patch.billAtFrontDesk = false;
  if (typeof type.calculateCommission !== "boolean")
    patch.calculateCommission = true;
  if (typeof type.isTaxable !== "boolean") patch.isTaxable = false;

  if (type.pricedBy !== "catalogue" && type.pricedBy !== "doctor") {
    patch.pricedBy = isDesignated ? "doctor" : "catalogue";
    if (!isDesignated && hasWord(type.name, /consult/i)) {
      notes.push(
        `"${type.name}" was priced from the doctor's consultation charge by its name; it now bills its own catalogue price NPR ${type.price ?? "?"}.`,
      );
    }
  }

  if (
    type.performerKind !== "doctor" &&
    type.performerKind !== "expert" &&
    type.performerKind !== "either"
  ) {
    patch.performerKind = isDesignated
      ? "doctor"
      : type.id === designatedExpertTypeId
        ? "expert"
        : "either";
  }

  if (type.procedureLog !== "none" && type.procedureLog !== "laser") {
    patch.procedureLog = hasWord(type.name, /laser/i) ? "laser" : "none";
  }

  if (!isMoney(type.price)) {
    notes.push(
      `"${type.name}" has no numeric price; the front office will refuse to bill it until one is set.`,
    );
  }

  return { id: type.id, name: type.name, patch, notes };
}

export function planPackageFlags(pkg: CataloguePackageRecord): RecordPlan {
  const patch: Record<string, unknown> = {};
  const notes: string[] = [];

  if (typeof pkg.isTaxable !== "boolean") {
    patch.isTaxable = false;
    notes.push(
      `"${pkg.name}" is recorded as not VAT-able; confirm per package.`,
    );
  }
  if (
    pkg.sessionPerformerKind !== "expert" &&
    pkg.sessionPerformerKind !== "doctor" &&
    pkg.sessionPerformerKind !== "either"
  ) {
    patch.sessionPerformerKind = "expert";
  }

  return { id: pkg.id, name: pkg.name, patch, notes };
}

/**
 * Legacy packages are backfilled with the WHOLE-RUPEE figure the wallet has
 * actually been deducting per session (Math.round), so arithmetic on a
 * package mid-way through its sessions does not shift. New sales use two
 * decimals.
 */
export function planPatientPackageBackfill(
  pp: PatientPackageRecord,
  pkg: CataloguePackageRecord | undefined,
): RecordPlan | null {
  if (typeof pp.perSessionValue === "number") return null;
  const sessions = pp.totalSessions || pkg?.totalSessions || 0;
  const credit = pkg?.walletCreditAmount || 0;

  if (!(sessions > 0) || !(credit > 0)) return null;

  return {
    id: pp.id,
    name: pp.packageName || pkg?.name || pp.id,
    patch: { perSessionValue: Math.round(credit / sessions) },
    notes: [],
  };
}

export interface RoomSeed {
  id: string;
  name: string;
  isExclusive: boolean;
}

/** The rooms the two hardcoded lists in the desk and the routing modal named. */
export const DEFAULT_ROOMS: RoomSeed[] = [
  { id: "opd-1", name: "OPD Room 1", isExclusive: true },
  { id: "opd-2", name: "OPD Room 2", isExclusive: true },
  { id: "opd-3", name: "OPD Room 3", isExclusive: true },
  { id: "laser-1", name: "Laser Room 1", isExclusive: true },
  { id: "laser-2", name: "Laser Room 2", isExclusive: true },
  { id: "prp-a", name: "PRP Cabin A", isExclusive: true },
  { id: "prp-b", name: "PRP Cabin B", isExclusive: true },
  { id: "facial", name: "Facial Therapy Room", isExclusive: true },
  { id: "lobby", name: "Lobby", isExclusive: false },
  { id: "triage", name: "Triage Area", isExclusive: false },
  { id: "billing", name: "Billing Counter", isExclusive: false },
  { id: "pharmacy", name: "Pharmacy", isExclusive: false },
];

export interface FrontOfficeSeed {
  defaultConsultationTypeId?: string;
  defaultExpertTypeId?: string;
  rooms: RoomSeed[];
}

/** The frontOffice block to seed when the clinic has none. */
export function planFrontOfficeSeed(
  existing: Partial<FrontOfficeSeed> | null | undefined,
  types: CatalogueTypeRecord[],
): FrontOfficeSeed {
  return {
    defaultConsultationTypeId:
      existing?.defaultConsultationTypeId ||
      findDesignatedConsultation(types)?.id,
    defaultExpertTypeId:
      existing?.defaultExpertTypeId || findDesignatedExpertType(types)?.id,
    rooms:
      Array.isArray(existing?.rooms) && existing.rooms.length > 0
        ? existing.rooms
        : DEFAULT_ROOMS,
  };
}

export interface PreflightReport {
  /** Must be fixed before the front office refuses instead of fabricating. */
  errors: string[];
  /** Behaviour that changes on purpose; the owner should know. */
  warnings: string[];
  info: string[];
}

/**
 * Everything the owner must see before stage 2 ships. Errors block; warnings
 * are the deliberate changes; info is what was derived.
 */
export function preflightReport(input: {
  types: CatalogueTypeRecord[];
  doctors: CatalogueDoctorRecord[];
  packages: CataloguePackageRecord[];
  typePlans: RecordPlan[];
  packagePlans: RecordPlan[];
  frontOffice: FrontOfficeSeed;
}): PreflightReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const active = input.types.filter((t) => t.isActive !== false);
  const designated = active.find(
    (t) => t.id === input.frontOffice.defaultConsultationTypeId,
  );
  const liveDoctors = input.doctors.filter(
    (d) => d.isActive !== false && !d.isDeleted,
  );

  for (const t of active) {
    if (!isMoney(t.price))
      errors.push(`Type "${t.name}" has no numeric price.`);
  }
  if (!designated) {
    errors.push(
      'No consultation type could be designated (none named "Doctor Consultation" and none collect-at-check-in with "consult" in its name). Set one in Settings › Front Office.',
    );
  } else {
    info.push(
      `Designated consultation type: "${designated.name}" (${designated.id}), priced from each doctor's consultation charge.`,
    );
    for (const d of liveDoctors) {
      if (!isMoney(d.consultationCharge) || d.consultationCharge === 0) {
        errors.push(
          `Doctor ${d.name} has no consultation charge; check-in for "${designated.name}" with this doctor will be refused.`,
        );
      }
    }
  }
  for (const p of input.typePlans) for (const n of p.notes) warnings.push(n);
  for (const p of input.packagePlans) for (const n of p.notes) warnings.push(n);
  if (input.frontOffice.defaultExpertTypeId) {
    const et = active.find(
      (t) => t.id === input.frontOffice.defaultExpertTypeId,
    );

    info.push(
      `Default expert service: "${et?.name || input.frontOffice.defaultExpertTypeId}".`,
    );
  }
  info.push(
    `Rooms: ${input.frontOffice.rooms.map((r) => r.name + (r.isExclusive ? "" : " (shared)")).join(", ")}.`,
  );
  const flagged = input.typePlans.filter(
    (p) => Object.keys(p.patch).length > 0,
  ).length;

  info.push(
    `${flagged} of ${input.types.length} types receive explicit flags; ${input.packagePlans.filter((p) => Object.keys(p.patch).length > 0).length} of ${input.packages.length} packages.`,
  );

  return { errors, warnings, info };
}
