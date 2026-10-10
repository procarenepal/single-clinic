/**
 * One-off, backup-first migration for the front-office redesign (stage 1).
 *
 *   node scripts/migrate-front-office-flags.mts            # dry run: prints the pre-flight report and every planned write
 *   node scripts/migrate-front-office-flags.mts --apply    # backs up, then writes
 *
 * What it does (all additive; no field is renamed, nothing is deleted):
 *   - appointment_types: explicit billAtFrontDesk / calculateCommission /
 *     isTaxable where undefined; pricedBy ("doctor" only for the clinic's
 *     designated consultation type); performerKind; procedureLog.
 *   - treatmentPackages: explicit isTaxable (false until the owner says
 *     otherwise) and sessionPerformerKind.
 *   - patientPackages: perSessionValue backfilled with the whole-rupee
 *     figure the wallet has been deducting.
 *   - appointmentBillingSettings/<clinic>.frontOffice: default types and the
 *     rooms the two hardcoded lists named, when none is configured.
 *   - pages: the "Front Office Settings" page document so the route is
 *     reachable under RBAC.
 *
 * Runs on Node 24 with native TypeScript stripping; imports the pure core
 * directly from src so the plan logic is the tested one.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  findDesignatedConsultation,
  planFrontOfficeSeed,
  planPackageFlags,
  planPatientPackageBackfill,
  planTypeFlags,
  preflightReport,
} from "../src/services/core/catalogueFlagsCore.ts";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const APPLY = process.argv.includes("--apply");
const CLINIC_ID =
  process.argv.find((a) => a.startsWith("--clinic="))?.slice(9) || "default";
const root = resolve(import.meta.dirname, "..");

initializeApp({
  credential: cert(
    require(resolve(root, "billing-backend/secrets/serviceAccountKey.json")),
  ),
});
const db = getFirestore();

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = resolve(root, "backups", `front-office-flags-${stamp}`);

async function readAll(collection: string) {
  const snap = await db
    .collection(collection)
    .where("clinicId", "==", CLINIC_ID)
    .get();

  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
}

async function backup(name: string, rows: unknown[]) {
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(
    resolve(backupDir, `${name}.json`),
    JSON.stringify(rows, null, 2),
  );
}

(async () => {
  const [types, packages, patientPackages, doctors] = await Promise.all([
    readAll("appointment_types"),
    readAll("treatmentPackages"),
    readAll("patientPackages"),
    readAll("doctors"),
  ]);
  const settingsRef = db
    .collection("appointmentBillingSettings")
    .doc(CLINIC_ID);
  const settingsSnap = await settingsRef.get();
  const settings = settingsSnap.exists ? settingsSnap.data() : null;
  const pageSnap = await db
    .collection("pages")
    .where("path", "==", "/dashboard/settings/front-office")
    .get();

  const frontOffice = planFrontOfficeSeed(settings?.frontOffice, types);
  const designated = findDesignatedConsultation(types);
  const typePlans = types.map((t: any) =>
    planTypeFlags(
      t,
      frontOffice.defaultConsultationTypeId,
      frontOffice.defaultExpertTypeId,
    ),
  );
  const packagePlans = packages.map((p: any) => planPackageFlags(p));
  const ppPlans = patientPackages
    .map((pp: any) =>
      planPatientPackageBackfill(
        pp,
        packages.find((p: any) => p.id === pp.packageId),
      ),
    )
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    patch: Record<string, unknown>;
  }>;
  const report = preflightReport({
    types,
    doctors,
    packages,
    typePlans,
    packagePlans,
    frontOffice,
  });

  console.log(
    `\n=== PRE-FLIGHT (clinic ${CLINIC_ID}) ${APPLY ? "— APPLY" : "— DRY RUN"} ===`,
  );
  for (const e of report.errors) console.log("  ERROR   ", e);
  for (const w of report.warnings) console.log("  WARNING ", w);
  for (const i of report.info) console.log("  info    ", i);

  console.log("\n=== PLANNED WRITES ===");
  for (const p of typePlans)
    if (Object.keys(p.patch).length)
      console.log(
        `  appointment_types/${p.id} (${p.name}):`,
        JSON.stringify(p.patch),
      );
  for (const p of packagePlans)
    if (Object.keys(p.patch).length)
      console.log(
        `  treatmentPackages/${p.id} (${p.name}):`,
        JSON.stringify(p.patch),
      );
  for (const p of ppPlans)
    console.log(
      `  patientPackages/${p.id} (${p.name}):`,
      JSON.stringify(p.patch),
    );
  const writeFrontOffice =
    !settings?.frontOffice || !(settings.frontOffice.rooms?.length > 0);

  if (writeFrontOffice)
    console.log(
      `  appointmentBillingSettings/${CLINIC_ID}.frontOffice:`,
      JSON.stringify(frontOffice),
    );
  else
    console.log(
      `  appointmentBillingSettings/${CLINIC_ID}.frontOffice: already configured, untouched`,
    );
  if (pageSnap.empty)
    console.log(
      "  pages: + Front Office Settings (/dashboard/settings/front-office)",
    );
  else console.log("  pages: Front Office Settings already exists");
  console.log(
    `  designated consultation: ${designated ? `${designated.name} (${designated.id})` : "NONE"}`,
  );

  if (!APPLY) {
    console.log(
      "\nDry run only. Re-run with --apply to write (a JSON backup is taken first).",
    );

    return;
  }
  if (report.errors.length) {
    console.log(
      "\nRefusing to apply while the pre-flight has errors. Fix them in the settings UI, then re-run.",
    );
    process.exit(2);
  }

  await backup("appointment_types", types);
  await backup("treatmentPackages", packages);
  await backup("patientPackages", patientPackages);
  await backup(
    "appointmentBillingSettings",
    settings ? [{ id: CLINIC_ID, ...settings }] : [],
  );
  await backup(
    "pages",
    pageSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
  );
  console.log(`\nBackup written to ${backupDir}`);

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };
  const queue = async (ref: any, patch: Record<string, unknown>) => {
    batch.update(ref, { ...patch, updatedAt: FieldValue.serverTimestamp() });
    ops++;
    if (ops >= 400) await flush();
  };

  for (const p of typePlans)
    if (Object.keys(p.patch).length)
      await queue(db.collection("appointment_types").doc(p.id), p.patch);
  for (const p of packagePlans)
    if (Object.keys(p.patch).length)
      await queue(db.collection("treatmentPackages").doc(p.id), p.patch);
  for (const p of ppPlans)
    await queue(db.collection("patientPackages").doc(p.id), p.patch);
  await flush();

  if (writeFrontOffice) {
    if (settingsSnap.exists) {
      await settingsRef.update({
        frontOffice,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "migration",
      });
    } else {
      console.log(
        "  (no billing settings document yet; frontOffice will be seeded when the app first creates it)",
      );
    }
  }
  if (pageSnap.empty) {
    await db.collection("pages").add({
      name: "Front Office Settings",
      path: "/dashboard/settings/front-office",
      icon: "IoBusinessOutline",
      description: "Front office defaults, rooms and roles",
      isActive: true,
      showInSidebar: true,
      order: 99,
      createdBy: "migration",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Post-check: every active type now carries explicit flags and a numeric price.
  const after = await readAll("appointment_types");
  const bad = after.filter(
    (t: any) =>
      t.isActive !== false &&
      (typeof t.price !== "number" ||
        typeof t.billAtFrontDesk !== "boolean" ||
        typeof t.isTaxable !== "boolean" ||
        !t.pricedBy ||
        !t.performerKind),
  );

  console.log(
    `\nApplied. Post-check: ${bad.length === 0 ? "every active type has explicit flags and a numeric price." : `${bad.length} type(s) still incomplete: ${bad.map((t: any) => t.name).join(", ")}`}`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
