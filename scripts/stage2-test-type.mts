/**
 * Test fixture for the stage-2 browser check: a FREE catalogue service.
 *   node scripts/stage2-test-type.mts --create   # adds "Stage 2 Free Follow-up" (price 0)
 *   node scripts/stage2-test-type.mts --delete   # removes it again
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const root = resolve(import.meta.dirname, "..");
// Default to the DEV key when it exists so a fixture never lands in
// production by accident; FIREBASE_SERVICE_ACCOUNT_PATH overrides.
const keyPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  ["billing-backend/secrets/serviceAccountKey.dev.json", "billing-backend/secrets/serviceAccountKey.json"]
    .map((p) => resolve(root, p))
    .find((p) => require("node:fs").existsSync(p));
const serviceAccount = require(keyPath);

initializeApp({ credential: cert(serviceAccount) });
console.log(`[stage2-test-type] project: ${serviceAccount.project_id}`);
const db = getFirestore();
const NAME = "Stage 2 Free Follow-up";

(async () => {
  const existing = await db.collection("appointment_types").where("clinicId", "==", "default").where("name", "==", NAME).get();
  if (process.argv.includes("--delete")) {
    for (const d of existing.docs) await d.ref.delete();
    console.log(`deleted ${existing.size} "${NAME}" type(s)`);
    return;
  }
  if (!existing.empty) { console.log(`exists: ${existing.docs[0].id}`); return; }
  const ref = await db.collection("appointment_types").add({
    name: NAME, price: 0, clinicId: "default", branchId: "default", isActive: true,
    billAtFrontDesk: true, calculateCommission: false, isTaxable: false,
    pricedBy: "catalogue", performerKind: "either", procedureLog: "none",
    createdBy: "stage2-smoke", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`created ${ref.id}`);
})().catch((e) => { console.error(e); process.exit(1); });
