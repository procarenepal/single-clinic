/**
 * Stage-3 browser-check fixtures: a FRESH patient (zero wallet balance, so
 * no leftover credit from earlier runs covers today's fee) with scheduled
 * appointments for TODAY, so the desk's per-appointment Check In can be
 * driven.
 *   node scripts/stage3-fixture.mts --create            # creates a new patient, prints the ids
 *   node scripts/stage3-fixture.mts --dump "<name>"      # appointments + wallet rows + invoice count
 *   node scripts/stage3-fixture.mts --delete "<name>"    # removes the patient's fixture appointments
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
// Which Firebase project this touches is decided by the service-account
// key. Default to the DEV key when it exists so a fixture run never lands
// in production by accident; FIREBASE_SERVICE_ACCOUNT_PATH overrides.
const keyPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  [
    "../billing-backend/secrets/serviceAccountKey.dev.json",
    "../billing-backend/secrets/serviceAccountKey.json",
  ]
    .map((p) => resolve(import.meta.dirname, p))
    .find((p) => require("node:fs").existsSync(p));
const serviceAccount = require(keyPath);

initializeApp({ credential: cert(serviceAccount) });
console.log(`[stage3-fixture] project: ${serviceAccount.project_id}`);
const db = getFirestore();
const [mode, patientNameArg] = [process.argv[2], process.argv[3]];
const TAG = "stage3-fixture";

(async () => {
  if (mode === "--dump" || mode === "--delete") {
    const pts = await db
      .collection("patients")
      .where("name", "==", patientNameArg)
      .get();
    if (pts.empty) throw new Error("patient not found: " + patientNameArg);
    const patient = pts.docs[0];
    const types = (
      await db
        .collection("appointment_types")
        .where("clinicId", "==", "default")
        .get()
    ).docs.map((d: any) => ({ id: d.id, ...d.data() }));
    if (mode === "--dump") {
      const appts = await db
        .collection("appointments")
        .where("patientId", "==", patient.id)
        .get();
      for (const a of appts.docs) {
        const d = a.data();
        console.log(
          "appt",
          a.id,
          "| type",
          types.find((t: any) => t.id === d.appointmentTypeId)?.name ||
            d.appointmentTypeId,
          "| status",
          d.status,
          "| checkedInAt",
          d.checkedInAt?.toDate?.()?.toISOString() || null,
          "| deposited",
          d.depositedAmount || 0,
          "| txns",
          (d.depositTxnIds || []).length,
          "| failedAt",
          d.checkInDepositFailedAt ? "set" : null,
          "| billingId",
          d.billingId || null,
          "| lines",
          (d.pendingVisitItems || [])
            .map(
              (l: any) =>
                `${l.appointmentTypeName}:${l.amount}:${l.collectAtCheckIn ? "collect" : "later"}`,
            )
            .join(","),
        );
      }
      const tx = await db
        .collection("walletTransactions")
        .where("patientId", "==", patient.id)
        .get();
      for (const t of tx.docs) {
        const d = t.data();
        console.log(
          "wallet",
          d.type,
          d.amount,
          d.paymentMethod,
          "ref=",
          d.paymentReference || null,
          "appt=",
          d.referenceId || null,
        );
      }
      console.log("patient walletBalance", patient.data().walletBalance);
      const inv = await db
        .collection("appointmentBilling")
        .where("patientId", "==", patient.id)
        .get();
      console.log("invoices for patient:", inv.size);
      return;
    }
    const appts = await db
      .collection("appointments")
      .where("patientId", "==", patient.id)
      .where("createdBy", "==", TAG)
      .get();
    for (const a of appts.docs) await a.ref.delete();
    console.log(
      "deleted",
      appts.size,
      "fixture appointments for",
      patientNameArg,
    );
    return;
  }

  // --create: a brand-new patient, guaranteed zero wallet balance, so
  // standing credit never silently covers the fee a test expects to collect.
  const types = (
    await db
      .collection("appointment_types")
      .where("clinicId", "==", "default")
      .get()
  ).docs.map((d: any) => ({ id: d.id, ...d.data() }));
  const byName = (re: RegExp) => types.find((t: any) => re.test(t.name));
  const consult = byName(/^Doctor Consultation$/i);
  const prp = byName(/PRP/i);
  const free = byName(/Stage 2 Free Follow-up/i);
  const doctor =
    (await db.collection("doctors").where("name", "==", "Pratik Bhusal").get())
      .docs[0] ||
    (
      await db.collection("doctors").where("clinicId", "==", "default").get()
    ).docs.find((d: any) => /Pratik/.test(d.data().name));
  const expert = (
    await db.collection("experts").where("clinicId", "==", "default").get()
  ).docs.find((d: any) => /Manisha/.test(d.data().name));

  const now = new Date();
  const stamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const patientName = `S3 Fixture ${stamp}`;
  const lastReg = (
    await db.collection("patients").orderBy("regNumber", "desc").limit(1).get()
  ).docs[0]?.data()?.regNumber;
  const regNumber = (Number(lastReg) || 1000) + 1;
  const patientRef = await db.collection("patients").add({
    name: patientName,
    mobile: "97" + String(Date.now()).slice(-8),
    regNumber: String(regNumber),
    gender: "male",
    age: 33,
    clinicId: "default",
    branchId: "default",
    isActive: true,
    createdBy: TAG,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    walletBalance: 0,
  });

  const base = {
    patientId: patientRef.id,
    clinicId: "default",
    branchId: "default",
    appointmentDate: Timestamp.fromDate(
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
    ),
    status: "scheduled",
    createdBy: TAG,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    registrationDate: Timestamp.fromDate(now),
  };
  const made: Record<string, string> = {};
  const add = async (key: string, data: any) => {
    const ref = await db.collection("appointments").add({ ...base, ...data });
    made[key] = ref.id;
  };
  await add("consult", {
    doctorId: doctor.id,
    appointmentTypeId: consult.id,
    startTime: "09:00",
    reason: "Stage 3: scheduled consultation",
  });
  await add("prp", {
    doctorId: "unassigned",
    assignedExpertId: expert.id,
    appointmentTypeId: prp.id,
    startTime: "09:15",
    reason: "Stage 3: PRP booking",
  });
  if (free)
    await add("free", {
      doctorId: doctor.id,
      appointmentTypeId: free.id,
      startTime: "09:30",
      reason: "Stage 3: free follow-up",
    });
  // made.consult/prp/free are the created APPOINTMENTS' ids; consultTypeId
  // etc. are the catalogue service ids those appointments were booked
  // against — a caller that needs to book a further appointment against
  // the same service (e.g. a second same-day consultation) needs the
  // latter, not the former.
  console.log(
    JSON.stringify({
      patientName,
      patientId: patientRef.id,
      doctor: doctor.data().name,
      expert: expert.data().name,
      consultTypeId: consult?.id,
      prpTypeId: prp?.id,
      freeTypeId: free?.id,
      prpType: prp?.name,
      prpPrice: prp?.price,
      prpCollect: prp?.billAtFrontDesk,
      freeType: free?.name || null,
      consultTaxable: Boolean(consult?.isTaxable),
      consultPrice: consult?.price,
      ...made,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
