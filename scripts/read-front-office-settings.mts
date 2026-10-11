/** Read-only: print the front-office defaults on appointmentBillingSettings/<clinic>. */
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp({ credential: cert(require(resolve(import.meta.dirname, "../billing-backend/secrets/serviceAccountKey.json"))) });
const db = getFirestore();
(async () => {
  const snap = await db.collection("appointmentBillingSettings").doc(process.argv[2] || "default").get();
  const d = snap.data() || {};
  const fo = d.frontOffice || {};
  console.log("exists:", snap.exists, "| frontOffice keys:", Object.keys(fo).sort().join(","));
  console.log("defaultConsultationTypeId:", fo.defaultConsultationTypeId, "| defaultExpertTypeId:", fo.defaultExpertTypeId, "| rooms:", fo.rooms?.length);
  console.log("enableTax:", d.enableTax, "defaultTaxPercentage:", d.defaultTaxPercentage, "updatedBy:", d.updatedBy);
})();
