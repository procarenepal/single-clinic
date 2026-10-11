/**
 * One-off, backup-first: nest the 9 Settings sub-screens under the
 * "Settings" page via `parentId`, so the sidebar's existing parent/child
 * rendering (already used by Front Office > Call Logs/Manage Visitors)
 * collapses them instead of listing each as its own flat top-level item.
 *
 *   node scripts/nest-settings-pages.mts            # dry run
 *   node scripts/nest-settings-pages.mts --apply    # backs up, then writes
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

const SETTINGS_PARENT_PATH = "/dashboard/settings";

(async () => {
  const snap = await db.collection("pages").get();
  const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  const parent = docs.find((p: any) => p.path === SETTINGS_PARENT_PATH);

  if (!parent) {
    console.error(`No page found at ${SETTINGS_PARENT_PATH}; aborting.`);
    process.exit(1);
  }
  const toNest = docs.filter(
    (p: any) =>
      p.path &&
      p.path.startsWith(SETTINGS_PARENT_PATH + "/") &&
      p.id !== parent.id &&
      p.parentId !== parent.id,
  );

  console.log(`Settings parent: ${parent.name} (${parent.id})`);
  console.log(
    `\n=== PLANNED (${toNest.length}) ${APPLY ? "— APPLY" : "— DRY RUN"} ===`,
  );
  for (const p of toNest) {
    console.log(
      `  ${p.name} (${p.id}): parentId ${p.parentId || "null"} -> ${parent.id}`,
    );
  }
  if (toNest.length === 0) {
    console.log("Nothing to do.");
    return;
  }
  if (!APPLY) {
    console.log(
      "\nDry run only. Re-run with --apply to write (a JSON backup is taken first).",
    );
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(root, "backups", `nest-settings-pages-${stamp}`);

  mkdirSync(backupDir, { recursive: true });
  writeFileSync(
    resolve(backupDir, "pages.json"),
    JSON.stringify(toNest, null, 2),
  );
  console.log(`\nBackup written to ${backupDir}`);

  const batch = db.batch();

  for (const p of toNest) {
    batch.update(db.collection("pages").doc(p.id), {
      parentId: parent.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(
    `\nApplied: ${toNest.length} page(s) nested under "${parent.name}".`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
