#!/usr/bin/env node
/**
 * Downloads one MySQL backup file from Firebase Storage's mysql-backups/
 * path (uploaded nightly by DatabaseBackupService.java) to a local file.
 *
 * Client access to mysql-backups/ is deliberately denied by storage.rules
 * (IRD clause 6(ढ) — "backup access restricted to authorized users") — this
 * script authenticates as the Firebase project owner via a service account,
 * the same credential used for one-off admin scripts throughout this
 * project. Only someone holding that credential file can run this.
 *
 * Usage (run from billing-backend/):
 *   node scripts/download-backup.cjs [--list] [<filename>]
 *
 *   --list              List available backups in mysql-backups/, newest first.
 *   <filename>          Download that specific file (e.g. procare_billing_2026-08-30_020000.sql)
 *                        to ./restored/<filename>. Omit to download the newest backup.
 *
 * Requires: npm install --no-save firebase-admin  (run from the repo root,
 * matching this project's standing one-off-script convention — see
 * firestore_admin_script_pattern in project memory).
 */
const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");

const serviceAccountPath = path.join(__dirname, "..", "secrets", "serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "skincare-hospital.firebasestorage.app",
});

async function main() {
  const args = process.argv.slice(2);
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: "mysql-backups/" });

  files.sort((a, b) => (a.name < b.name ? 1 : -1)); // newest first (timestamped filenames sort lexically)

  if (args.includes("--list")) {
    if (files.length === 0) {
      console.log("No backups found under mysql-backups/.");
      return;
    }
    console.log(`${files.length} backup(s), newest first:\n`);
    for (const f of files) {
      const [meta] = await f.getMetadata();
      console.log(`  ${f.name.replace("mysql-backups/", "")}  (${meta.size} bytes, ${meta.timeCreated})`);
    }
    return;
  }

  const requested = args.find((a) => !a.startsWith("--"));
  const target = requested
    ? files.find((f) => f.name === `mysql-backups/${requested}`)
    : files[0];

  if (!target) {
    console.error(requested ? `Backup not found: ${requested}` : "No backups exist yet.");
    process.exit(1);
  }

  const outDir = path.join(__dirname, "..", "restored");

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, path.basename(target.name));

  await target.download({ destination: outPath });
  console.log(`Downloaded to ${outPath}`);
  console.log(`Next: scripts/restore-mysql-backup.sh "${outPath}"`);
}

main().catch((err) => {
  console.error("Download failed:", err);
  process.exit(1);
});
