// Firestore security-rules tests for the consolidated billing/wallet rules.
// Run with:  npm run test:rules
// (Firestore emulator via firebase-tools 13 — the installed 15.x refuses Java < 21,
//  and the backend runs on Java 17. Port 8199 so it does not collide with the Java
//  backend on 8080; see firebase.emulator.json. Not a vitest test — vitest excludes tests/**.)
// Exercises the rules as four principals the admin login cannot impersonate:
// staff, doctor, clinic-admin, and a member of another clinic.
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, updateDoc, deleteDoc, writeBatch, increment, Timestamp,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-procare",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
});

const STAFF = "staff1", DOC = "doc1", ADMIN = "admin1", OTHER = "other1";
const as = (uid) => env.authenticatedContext(uid).firestore();
const now = () => Timestamp.now();

async function reset() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const u = (id, role, clinicId) => setDoc(doc(db, "users", id), { role, clinicId, email: `${id}@x.test` });
    await Promise.all([
      u(STAFF, "staff", "default"), u(DOC, "doctor", "default"),
      u(ADMIN, "clinic-admin", "default"), u(OTHER, "staff", "other"),
      setDoc(doc(db, "patients", "p1"), { clinicId: "default", name: "P One", walletBalance: 100, createdBy: STAFF }),
      setDoc(doc(db, "patients", "p0"), { clinicId: "default", name: "P Zero", createdBy: STAFF }), // never had a wallet
      setDoc(doc(db, "appointmentBilling", "inv1"), { clinicId: "default", invoiceNumber: "INV-1", patientId: "p1", doctorId: "d", totalAmount: 565, paidAmount: 0, balanceAmount: 565, status: "draft", paymentStatus: "unpaid", irdSynced: false, createdBy: STAFF, paymentHistory: [], notes: "" }),
      setDoc(doc(db, "appointmentBilling", "inv2"), { clinicId: "default", invoiceNumber: "INV-2", patientId: "p1", doctorId: "d", totalAmount: 565, paidAmount: 0, balanceAmount: 565, status: "draft", paymentStatus: "unpaid", irdSynced: true, createdBy: STAFF, paymentHistory: [], notes: "" }),
      setDoc(doc(db, "appointmentBilling", "inv3"), { clinicId: "default", invoiceNumber: "INV-3", patientId: "p1", doctorId: "d", totalAmount: 565, paidAmount: 0, balanceAmount: 565, status: "finalized", paymentStatus: "unpaid", irdSynced: false, createdBy: STAFF, paymentHistory: [] }),
      setDoc(doc(db, "pathologyBilling", "lab1"), { clinicId: "default", invoiceNumber: "LAB-1", patientName: "P One", totalAmount: 565, paidAmount: 565, status: "paid", paymentStatus: "paid", irdSynced: false, createdBy: STAFF, reportStatus: "pending_collection" }),
      setDoc(doc(db, "medicinePurchases", "pur1"), { clinicId: "default", purchaseNo: "PH-1", items: [], total: 100, netAmount: 100, paymentType: "cash", paymentStatus: "paid", purchaseDate: now(), createdBy: STAFF, irdSynced: true, returns: [] }),
      setDoc(doc(db, "patientPackages", "pkg1"), { clinicId: "default", patientId: "p1", packageName: "X" }),
    ]);
  });
}

const results = [];
async function t(name, fn) {
  await reset();
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name, (e && e.message ? e.message : String(e)).split("\n")[0].slice(0, 160)]); }
}

const invoice = (createdBy, clinicId = "default") => ({
  clinicId, invoiceNumber: "INV-N", patientId: "p1", doctorId: "d", totalAmount: 100,
  paidAmount: 0, balanceAmount: 100, status: "draft", paymentStatus: "unpaid", irdSynced: false, createdBy, paymentHistory: [],
});
const row = (over) => ({ patientId: "p1", clinicId: "default", type: "deposit", amount: 50, createdAt: now(), createdBy: STAFF, notes: "t", ...over });

// ── appointmentBilling ──────────────────────────────────────────────────────
await t("appt: staff creates own-clinic invoice with createdBy == self", () =>
  assertSucceeds(setDoc(doc(as(STAFF), "appointmentBilling", "n1"), invoice(STAFF))));
await t("appt: doctor can create (role authority lives in the Java ledger, not here)", () =>
  assertSucceeds(setDoc(doc(as(DOC), "appointmentBilling", "n2"), invoice(DOC))));
await t("appt: createdBy must be the caller", () =>
  assertFails(setDoc(doc(as(STAFF), "appointmentBilling", "n3"), invoice(DOC))));
await t("appt: cannot create for another clinic", () =>
  assertFails(setDoc(doc(as(STAFF), "appointmentBilling", "n4"), invoice(STAFF, "other"))));
await t("appt: other-clinic member cannot create here", () =>
  assertFails(setDoc(doc(as(OTHER), "appointmentBilling", "n5"), invoice(OTHER))));
await t("appt: missing required keys refused", () =>
  assertFails(setDoc(doc(as(STAFF), "appointmentBilling", "n6"), { clinicId: "default", createdBy: STAFF, totalAmount: 1 })));
await t("appt: unlocked invoice — amounts editable", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "appointmentBilling", "inv1"), { totalAmount: 600, updatedAt: now() })));
await t("appt: IRD-synced invoice — amounts frozen", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointmentBilling", "inv2"), { totalAmount: 600 })));
await t("appt: finalized invoice — amounts frozen", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointmentBilling", "inv3"), { items: [] })));
await t("appt: IRD-synced invoice — payment bookkeeping still allowed", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "appointmentBilling", "inv2"), { paidAmount: 565, balanceAmount: 0, paymentStatus: "paid", paymentMethod: "cash", paymentDate: now(), paymentHistory: [{ id: "e", amount: 565, method: "cash", date: now(), recordedBy: STAFF }], updatedAt: now() })));
await t("appt: IRD-synced invoice — cancel/notes/credit-note link allowed", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "appointmentBilling", "inv2"), { status: "cancelled", paymentStatus: "cancelled", notes: "Cancelled. Reason: x", hasCreditNote: true, updatedAt: now() })));
await t("appt: client cannot assert irdSynced", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointmentBilling", "inv1"), { irdSynced: true })));
await t("appt: clinic-admin cannot assert irdSynced either", () =>
  assertFails(updateDoc(doc(as(ADMIN), "appointmentBilling", "inv1"), { irdSynced: true })));
await t("appt: clinicId cannot be moved", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointmentBilling", "inv1"), { clinicId: "other" })));
await t("appt: staff cannot delete", () =>
  assertFails(deleteDoc(doc(as(STAFF), "appointmentBilling", "inv1"))));
await t("appt: clinic-admin cannot delete", () =>
  assertFails(deleteDoc(doc(as(ADMIN), "appointmentBilling", "inv1"))));

// ── pathologyBilling ────────────────────────────────────────────────────────
await t("lab: paid invoice — lab workflow fields still editable", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "pathologyBilling", "lab1"), { reportStatus: "in_lab", sampleCollectionDate: now(), updatedAt: now() })));
await t("lab: paid invoice — amounts frozen", () =>
  assertFails(updateDoc(doc(as(STAFF), "pathologyBilling", "lab1"), { totalAmount: 1 })));
await t("lab: walk-in create (patientName, no patientId)", () =>
  assertSucceeds(setDoc(doc(as(STAFF), "pathologyBilling", "lab2"), { clinicId: "default", invoiceNumber: "LAB-2", patientName: "Walk In", totalAmount: 100, status: "draft", createdBy: STAFF })));

// ── medicinePurchases ───────────────────────────────────────────────────────
await t("pharmacy: synced sale — a return is allowed", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "medicinePurchases", "pur1"), { returns: [{ id: "r1", totalAmount: -10 }], totalReturnedAmount: 10, updatedAt: now() })));
await t("pharmacy: synced sale — total frozen", () =>
  assertFails(updateDoc(doc(as(STAFF), "medicinePurchases", "pur1"), { total: 90 })));

// ── patients / walletTransactions: the ledger link ──────────────────────────
await t("wallet: profile edit without touching balance", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "patients", "p1"), { name: "Renamed" })));
await t("wallet: staff cannot set walletBalance directly", () =>
  assertFails(updateDoc(doc(as(STAFF), "patients", "p1"), { walletBalance: 999 })));
await t("wallet: clinic-admin cannot set walletBalance directly either", () =>
  assertFails(updateDoc(doc(as(ADMIN), "patients", "p1"), { walletBalance: 999 })));
await t("wallet: deposit — row + balance in one batch succeeds", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t1"), row({}));
  b.update(doc(db, "patients", "p1"), { walletBalance: 150, lastWalletTxnId: "t1" });
  await assertSucceeds(b.commit());
});
await t("wallet: deposit via increment() transform also satisfies the rule", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t1b"), row({}));
  b.update(doc(db, "patients", "p1"), { walletBalance: increment(50), lastWalletTxnId: "t1b" });
  await assertSucceeds(b.commit());
});
await t("wallet: first deposit on a patient with no walletBalance field", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t1c"), row({ patientId: "p0" }));
  b.update(doc(db, "patients", "p0"), { walletBalance: 50, lastWalletTxnId: "t1c" });
  await assertSucceeds(b.commit());
});
await t("wallet: deduction — balance must drop by the row amount", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t2"), row({ type: "deduction", amount: 30, referenceId: "inv1", referenceType: "invoice" }));
  b.update(doc(db, "patients", "p1"), { walletBalance: 70, lastWalletTxnId: "t2" });
  await assertSucceeds(b.commit());
});
await t("wallet: balance that does not match the row is refused", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t3"), row({}));
  b.update(doc(db, "patients", "p1"), { walletBalance: 160, lastWalletTxnId: "t3" });
  await assertFails(b.commit());
});
await t("wallet: balance move without naming the row is refused", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t4"), row({}));
  b.update(doc(db, "patients", "p1"), { walletBalance: 150 });
  await assertFails(b.commit());
});
await t("wallet: row attributed to someone else is refused", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t5"), row({ createdBy: DOC }));
  b.update(doc(db, "patients", "p1"), { walletBalance: 150, lastWalletTxnId: "t5" });
  await assertFails(b.commit());
});
await t("wallet: row attributed to 'system' is refused", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t5b"), row({ createdBy: "system" }));
  b.update(doc(db, "patients", "p1"), { walletBalance: 150, lastWalletTxnId: "t5b" });
  await assertFails(b.commit());
});
await t("wallet: ledger row alone, with no balance move, is refused", () =>
  assertFails(setDoc(doc(as(STAFF), "walletTransactions", "t6"), row({}))));
await t("wallet: a row for another clinic's patient is refused", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t7"), row({ clinicId: "other" }));
  b.update(doc(db, "patients", "p1"), { walletBalance: 150, lastWalletTxnId: "t7" });
  await assertFails(b.commit());
});
await t("wallet: zero or negative amounts refused", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "t8"), row({ amount: 0 }));
  b.update(doc(db, "patients", "p1"), { walletBalance: 100, lastWalletTxnId: "t8" });
  await assertFails(b.commit());
});
await t("wallet: ledger rows are append-only (no update)", async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "walletTransactions", "t9"), row({})));
  await assertFails(updateDoc(doc(as(ADMIN), "walletTransactions", "t9"), { amount: 1 }));
});
await t("wallet: ledger rows are append-only (no delete)", async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "walletTransactions", "t10"), row({})));
  await assertFails(deleteDoc(doc(as(ADMIN), "walletTransactions", "t10")));
});
await t("wallet: a patient cannot be born with a balance", () =>
  assertFails(setDoc(doc(as(STAFF), "patients", "p9"), { clinicId: "default", name: "Rich", walletBalance: 500, createdBy: STAFF })));

// ── patientPackages ─────────────────────────────────────────────────────────
await t("packages: clinic member can create and update", async () => {
  await assertSucceeds(setDoc(doc(as(STAFF), "patientPackages", "pkg2"), { clinicId: "default", patientId: "p1" }));
  await assertSucceeds(updateDoc(doc(as(STAFF), "patientPackages", "pkg1"), { usedSessions: 1 }));
});
await t("packages: nobody deletes, clinic-admin included", async () => {
  await assertFails(deleteDoc(doc(as(STAFF), "patientPackages", "pkg1")));
  await assertFails(deleteDoc(doc(as(ADMIN), "patientPackages", "pkg1")));
});

await env.cleanup();
const failed = results.filter((r) => r[0] === "FAIL");
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "\n       -> " + r[2] : "");
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
