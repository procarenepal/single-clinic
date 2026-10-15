/**
 * Read-only: how many active catalog entries (appointment types, pathology
 * test types, medicines) are missing the new compulsory hsCode field.
 *
 * The compulsory check lives at invoice-submission time in every billing
 * form, not as a Firestore constraint — so nothing breaks the moment this
 * script runs. But any catalog item listed below will block billing the
 * first time staff try to use it, until someone fills in its HS Code.
 * Run this before relying on that gate so the blast radius is known, not
 * discovered live at the front desk.
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp({
  credential: cert(
    require(
      resolve(
        import.meta.dirname,
        "../billing-backend/secrets/serviceAccountKey.json",
      ),
    ),
  ),
});
const db = getFirestore();

(async () => {
  const collections: { name: string; label: string }[] = [
    { name: "appointment_types", label: "Appointment Types" },
    { name: "pathologyTestTypes", label: "Pathology Test Types" },
    { name: "medicines", label: "Medicines" },
  ];

  let totalMissing = 0;

  for (const { name, label } of collections) {
    const snap = await db
      .collection(name)
      .where("isActive", "==", true)
      .get();

    const missing: string[] = [];

    snap.forEach((doc: any) => {
      const d = doc.data();

      if (!d.hsCode || !String(d.hsCode).trim()) {
        missing.push(d.name || doc.id);
      }
    });

    console.log(
      `\n${label}: ${snap.size} active, ${missing.length} missing HS Code`,
    );
    if (missing.length > 0) {
      missing
        .slice(0, 50)
        .forEach((n) => console.log(`  - ${n}`));
      if (missing.length > 50) {
        console.log(`  ... and ${missing.length - 50} more`);
      }
    }
    totalMissing += missing.length;
  }

  console.log(
    `\nTotal: ${totalMissing} active catalog item(s) will block billing until given an HS Code.`,
  );
})();
