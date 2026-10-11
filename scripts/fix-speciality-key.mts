/**
 * One-off, backup-first: the "General Practice" doctor_speciality document
 * has no `key` field, so getActiveSpecialitiesForDropdown's fallback
 * (`speciality.key || speciality.id`) handed out the raw Firestore document
 * id as the dropdown value — which then got saved onto Manisha Basnet's
 * expert record as her `speciality`, and now renders verbatim on her
 * profile instead of "General Practice".
 *
 * Backfills the missing key on the speciality document, then corrects every
 * doctor/expert record whose `speciality` field holds that same raw id.
 *
 *   node scripts/fix-speciality-key.mts            # dry run
 *   node scripts/fix-speciality-key.mts --apply    # backs up, then writes
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const APPLY = process.argv.includes("--apply");
const root = resolve(import.meta.dirname, "..");

initializeApp({
  credential: cert(
    require(resolve(root, "billing-backend/secrets/serviceAccountKey.json")),
  ),
});
const db = getFirestore();

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

(async () => {
  const specialitiesSnap = await db.collection("doctor_specialities").get();
  const specialities = specialitiesSnap.docs.map((d: any) => ({
    id: d.id,
    ...d.data(),
  }));
  const missingKey = specialities.filter((s: any) => !s.key);

  if (missingKey.length === 0) {
    console.log("Every speciality already has a key. Nothing to do.");
    return;
  }

  // One key per speciality document, derived from its name and checked for
  // collision against every OTHER speciality's key (existing or freshly
  // assigned in this same run).
  const takenKeys = new Set(
    specialities.map((s: any) => s.key).filter(Boolean),
  );
  const keyAssignments = new Map<string, string>(); // speciality doc id -> new key

  for (const s of missingKey) {
    let key = slugify(s.name || s.id);
    let suffix = 2;

    while (takenKeys.has(key)) {
      key = `${slugify(s.name || s.id)}-${suffix}`;
      suffix += 1;
    }
    takenKeys.add(key);
    keyAssignments.set(s.id, key);
  }

  const [expertsSnap, doctorsSnap] = await Promise.all([
    db.collection("experts").get(),
    db.collection("doctors").get(),
  ]);
  const missingKeyIds = new Set(keyAssignments.keys());

  const expertFixes = expertsSnap.docs
    .map((d: any) => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter((e: any) => missingKeyIds.has(e.speciality))
    .map((e: any) => ({
      collection: "experts",
      id: e.id,
      name: e.name,
      from: e.speciality,
      to: keyAssignments.get(e.speciality)!,
    }));
  const doctorFixes = doctorsSnap.docs
    .map((d: any) => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter((d: any) => missingKeyIds.has(d.speciality))
    .map((d: any) => ({
      collection: "doctors",
      id: d.id,
      name: d.name,
      from: d.speciality,
      to: keyAssignments.get(d.speciality)!,
    }));

  console.log(
    `\n=== PLANNED ${APPLY ? "— APPLY" : "— DRY RUN"} ===`,
  );
  console.log(`\nSpecialities missing a key (${missingKey.length}):`);
  for (const s of missingKey) {
    console.log(`  ${s.name} (${s.id}): key -> "${keyAssignments.get(s.id)}"`);
  }
  console.log(
    `\nRecords whose speciality field holds a raw doc id (${expertFixes.length + doctorFixes.length}):`,
  );
  for (const f of [...expertFixes, ...doctorFixes]) {
    console.log(
      `  [${f.collection}] ${f.name} (${f.id}): speciality "${f.from}" -> "${f.to}"`,
    );
  }

  if (!APPLY) {
    console.log(
      "\nDry run only. Re-run with --apply to write (a JSON backup is taken first).",
    );
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(root, "backups", `fix-speciality-key-${stamp}`);

  mkdirSync(backupDir, { recursive: true });
  writeFileSync(
    resolve(backupDir, "doctor_specialities.json"),
    JSON.stringify(missingKey, null, 2),
  );
  writeFileSync(
    resolve(backupDir, "experts.json"),
    JSON.stringify(expertFixes, null, 2),
  );
  writeFileSync(
    resolve(backupDir, "doctors.json"),
    JSON.stringify(doctorFixes, null, 2),
  );
  console.log(`\nBackup written to ${backupDir}`);

  const batch = db.batch();

  for (const s of missingKey) {
    batch.update(db.collection("doctor_specialities").doc(s.id), {
      key: keyAssignments.get(s.id),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  for (const f of expertFixes) {
    batch.update(db.collection("experts").doc(f.id), {
      speciality: f.to,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  for (const f of doctorFixes) {
    batch.update(db.collection("doctors").doc(f.id), {
      speciality: f.to,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  console.log(
    `\nApplied: ${missingKey.length} speciality key(s) backfilled, ${expertFixes.length + doctorFixes.length} record(s) corrected.`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
