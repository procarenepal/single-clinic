/**
 * Read-only: which open visits still carry lines written by the old desk
 * (pseudo ids such as "consultation-fee", no origin), so the one-dedupe-key
 * change can be judged against real in-flight data before it ships.
 *
 *   node scripts/check-inflight-legacy-lines.mts
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const root = resolve(import.meta.dirname, "..");

initializeApp({
  credential: cert(
    require(resolve(root, "billing-backend/secrets/serviceAccountKey.json")),
  ),
});
const db = getFirestore();

(async () => {
  const snap = await db
    .collection("appointments")
    .where("status", "in", ["scheduled", "confirmed", "in-progress"])
    .get();
  let open = 0;
  const flagged: string[] = [];

  for (const d of snap.docs) {
    const a = d.data();

    if (a.checkoutCompleted) continue;
    open++;
    const lines: any[] = Array.isArray(a.pendingVisitItems) ? a.pendingVisitItems : [];
    const legacy = lines.filter(
      (l) =>
        !l.origin ||
        ["consultation-fee", "procedure-fee", "manual-gp-fee"].includes(
          l.appointmentTypeId,
        ),
    );

    if (legacy.length > 0 || a.consultationBillingId) {
      flagged.push(
        `${d.id} status=${a.status} date=${a.appointmentDate?.toDate?.().toISOString().slice(0, 10)} lines=${lines.length} legacy=${legacy.length}${a.consultationBillingId ? " consultationBillingId" : ""} deposited=${a.depositedAmount || 0}`,
      );
    }
  }
  console.log(`open visits: ${open}; carrying legacy lines or pointers: ${flagged.length}`);
  for (const f of flagged) console.log("  " + f);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
