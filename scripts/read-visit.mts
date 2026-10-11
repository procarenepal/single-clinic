/** Read-only: dump a visit's billing-relevant fields by patient name. */
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp({ credential: cert(require(resolve(import.meta.dirname, "../billing-backend/secrets/serviceAccountKey.json"))) });
const db = getFirestore();
(async () => {
  const name = process.argv[2];
  const pts = await db.collection("patients").where("name", "==", name).get();
  for (const p of pts.docs) {
    console.log("patient", p.id, p.data().name, "regNumber", p.data().regNumber);
    const appts = await db.collection("appointments").where("patientId", "==", p.id).get();
    for (const a of appts.docs) {
      const d = a.data();
      console.log(" appt", a.id, "type", d.appointmentTypeId, "status", d.status, "doctor", d.doctorId, "expert", d.assignedExpertId, "deposited", d.depositedAmount, "billingId", d.billingId);
      for (const l of d.pendingVisitItems || []) console.log("   line", JSON.stringify({ id: l.id, type: l.appointmentTypeId, name: l.appointmentTypeName, price: l.price, amount: l.amount, origin: l.origin, collect: l.collectAtCheckIn, taxable: l.isTaxable, doctor: l.doctorName }));
      if (d.recommendedProcedure) console.log("   rec", JSON.stringify(d.recommendedProcedure).slice(0, 300));
    }
    const tx = await db.collection("walletTransactions").where("patientId", "==", p.id).get();
    for (const t of tx.docs) console.log(" wallet", t.data().type, t.data().amount, t.data().description || t.data().notes);
  }
})();
