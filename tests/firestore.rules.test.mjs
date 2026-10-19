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
      setDoc(doc(db, "patients", "pr"), { clinicId: "default", name: "P Residue", walletBalance: 4.547e-13, createdBy: STAFF }), // emptied wallet, float residue
      setDoc(doc(db, "appointmentBilling", "inv1"), { clinicId: "default", invoiceNumber: "INV-1", patientId: "p1", doctorId: "d", totalAmount: 565, paidAmount: 0, balanceAmount: 565, status: "draft", paymentStatus: "unpaid", irdSynced: false, createdBy: STAFF, paymentHistory: [], notes: "" }),
      setDoc(doc(db, "appointmentBilling", "inv2"), { clinicId: "default", invoiceNumber: "INV-2", patientId: "p1", doctorId: "d", totalAmount: 565, paidAmount: 0, balanceAmount: 565, status: "draft", paymentStatus: "unpaid", irdSynced: true, createdBy: STAFF, paymentHistory: [], notes: "" }),
      setDoc(doc(db, "appointmentBilling", "inv3"), { clinicId: "default", invoiceNumber: "INV-3", patientId: "p1", doctorId: "d", totalAmount: 565, paidAmount: 0, balanceAmount: 565, status: "finalized", paymentStatus: "unpaid", irdSynced: false, createdBy: STAFF, paymentHistory: [] }),
      setDoc(doc(db, "pathologyBilling", "lab1"), { clinicId: "default", invoiceNumber: "LAB-1", patientName: "P One", totalAmount: 565, paidAmount: 565, status: "paid", paymentStatus: "paid", irdSynced: false, createdBy: STAFF, reportStatus: "pending_collection" }),
      setDoc(doc(db, "medicinePurchases", "pur1"), { clinicId: "default", purchaseNo: "PH-1", items: [], total: 100, netAmount: 100, paymentType: "cash", paymentStatus: "paid", purchaseDate: now(), createdBy: STAFF, irdSynced: true, returns: [] }),
      setDoc(doc(db, "patientPackages", "pkg1"), { clinicId: "default", patientId: "p1", packageName: "X" }),
      // Commission records: one owing in full, one paid in full, one cancelled, and one per sibling collection.
      setDoc(doc(db, "doctorCommissions", "dc1"), commissionSeed("doctorId", {})),
      setDoc(doc(db, "doctorCommissions", "dc2"), commissionSeed("doctorId", { paidAmount: 84.75, status: "paid", paymentMethod: "cash", paidDate: now() })),
      setDoc(doc(db, "doctorCommissions", "dc3"), commissionSeed("doctorId", { status: "cancelled" })),
      setDoc(doc(db, "expertCommissions", "ec1"), commissionSeed("expertId", {})),
      setDoc(doc(db, "referralCommissions", "rc1"), commissionSeed("partnerId", { paidAmount: 0 })),
      setDoc(doc(db, "staffCommissions", "sc1"), commissionSeed("staffId", {})),
      // Visits: one with nothing collected yet, one holding a deposit (part of it wallet credit), one invoiced.
      setDoc(doc(db, "appointments", "a1"), { clinicId: "default", patientId: "p1", status: "confirmed", depositedAmount: 0, createdBy: STAFF }),
      setDoc(doc(db, "appointments", "a2"), { clinicId: "default", patientId: "p1", status: "confirmed", depositedAmount: 500, depositFromCredit: 200, depositTxnIds: ["w1", "w2"], createdBy: STAFF }),
      setDoc(doc(db, "appointments", "a3"), { clinicId: "default", patientId: "p1", status: "completed", billingId: "inv1", depositedAmount: 500, depositFromCredit: 200, depositTxnIds: ["w1", "w2"], createdBy: STAFF }),
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
// A commission record in any of the four collections; `idField` names the clinician field.
const commissionSeed = (idField, over) => ({
  [idField]: "e1", clinicId: "default", branchId: "default", billingId: "inv1", billingType: "appointment",
  invoiceNumber: "INV-1", patientId: "p1", patientName: "P One", serviceNames: ["Consult"],
  totalInvoiceAmount: 565, commissionPercentage: 15, commissionAmount: 84.75, status: "pending",
  createdAt: now(), updatedAt: now(), createdBy: ADMIN, ...over,
});

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


// ── patients: delete ─────────────────────────────────────────────────────────
await t("patients: clinic-admin can delete a patient who holds no wallet money", () =>
  assertSucceeds(deleteDoc(doc(as(ADMIN), "patients", "p0"))));
await t("patients: clinic-admin cannot delete a patient who holds wallet money", () =>
  assertFails(deleteDoc(doc(as(ADMIN), "patients", "p1"))));
await t("patients: a sub-paisa float residue does not count as held money", () =>
  assertSucceeds(deleteDoc(doc(as(ADMIN), "patients", "pr"))));
await t("patients: staff cannot delete a patient at all", () =>
  assertFails(deleteDoc(doc(as(STAFF), "patients", "p0"))));

// ── doctorCommissions: clawbacks ─────────────────────────────────────────────
const commission = (over) => ({
  doctorId: "d", doctorName: "Dr D", clinicId: "default", branchId: "default", billingId: "inv1", billingType: "appointment",
  invoiceNumber: "INV-1", appointmentDate: now(), patientId: "p1", patientName: "P One", serviceNames: ["Consult"],
  totalInvoiceAmount: 565, commissionPercentage: 15, commissionAmount: 84.75, status: "pending",
  createdAt: now(), updatedAt: now(), createdBy: ADMIN, ...over,
});
await t("commission: clinic-admin creates an ordinary (positive) commission", () =>
  assertSucceeds(setDoc(doc(as(ADMIN), "doctorCommissions", "c1"), commission({}))));
// The refusal cases run as STAFF: this rules file lets clinic-admin bypass
// every field validation via isSuperAdmin() (pre-existing, file-wide), so
// only the validated branch — staff — exercises the carve-out.
await t("commission: a negative amount with no clawbackOf is refused", () =>
  assertFails(setDoc(doc(as(STAFF), "doctorCommissions", "c2"), commission({ commissionAmount: -84.75, createdBy: STAFF }))));
await t("commission: a negative amount with an empty clawbackOf is refused", () =>
  assertFails(setDoc(doc(as(STAFF), "doctorCommissions", "c3"), commission({ commissionAmount: -84.75, clawbackOf: "", createdBy: STAFF }))));
await t("commission: a clawback (negative, naming the original) is allowed", () =>
  assertSucceeds(setDoc(doc(as(ADMIN), "doctorCommissions", "c4"), commission({ commissionAmount: -84.75, clawbackOf: "c1", clawbackReason: "Invoice reversed after this commission was paid out" }))));
await t("commission: staff (has commission access) can write a clawback too", () =>
  assertSucceeds(setDoc(doc(as(STAFF), "doctorCommissions", "c5"), commission({ commissionAmount: -84.75, clawbackOf: "c1", createdBy: STAFF }))));
await t("commission: recording a recovery on a clawback (negative paidAmount) is allowed", async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "doctorCommissions", "c6"), commission({ commissionAmount: -84.75, clawbackOf: "c1" })));
  await assertSucceeds(updateDoc(doc(as(ADMIN), "doctorCommissions", "c6"), { paidAmount: -84.75, status: "paid", paymentMethod: "cash", paidDate: now(), updatedAt: now() }));
});
await t("commission: an ordinary commission cannot be edited into a negative amount", async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "doctorCommissions", "c7"), commission({})));
  await assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "c7"), { commissionAmount: -10 }));
});
await t("commission: other-clinic member cannot write a clawback here", () =>
  assertFails(setDoc(doc(as(OTHER), "doctorCommissions", "c8"), commission({ commissionAmount: -84.75, clawbackOf: "c1", createdBy: OTHER }))));

// ── commission records: the three legitimate changes, and nothing else ──────
// payCommission, updateCommissionStatus("cancelled") and reduceCommissionAmount
// are the only writers; everything a direct SDK write could do beyond them is
// refused — for clinic-admin too.
await t("commission: paying it in full records paid", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { paidAmount: 84.75, status: "paid", paymentMethod: "cash", paidDate: now(), updatedAt: now() })));
await t("commission: a part payment leaves it pending", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { paidAmount: 40, status: "pending", paymentMethod: "cash", paidDate: now(), paidBy: STAFF, paymentReference: "r", paymentNotes: "n", updatedAt: now() })));
await t("commission: a part payment cannot be labelled paid", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { paidAmount: 40, status: "paid", paymentMethod: "cash", paidDate: now(), updatedAt: now() })));
await t("commission: paying more than is owed is refused", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { paidAmount: 100, status: "paid", paymentMethod: "cash", paidDate: now(), updatedAt: now() })));
await t("commission: marking paid with no money recorded is refused", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { status: "paid", updatedAt: now() })));
await t("commission: a payment must say how and when it was paid", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { paidAmount: 84.75, status: "paid", updatedAt: now() })));
await t("commission: the amount cannot be inflated", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { commissionAmount: 200, updatedAt: now() })));
await t("commission: clinic-admin is held to the same invariants", () =>
  assertFails(updateDoc(doc(as(ADMIN), "doctorCommissions", "dc1"), { commissionAmount: 200, updatedAt: now() })));
await t("commission: clinic-admin cannot mark paid with no money recorded either", () =>
  assertFails(updateDoc(doc(as(ADMIN), "doctorCommissions", "dc1"), { status: "paid", updatedAt: now() })));
await t("commission: a partial reversal shrinks the amount", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { commissionAmount: 40, paidAmount: 0, status: "pending", updatedAt: now() })));
await t("commission: a partial reversal of a paid record moves the paid share off it", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "doctorCommissions", "dc2"), { commissionAmount: 50, paidAmount: 50, status: "paid", updatedAt: now() })));
await t("commission: a reversal that empties the record cancels it", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "doctorCommissions", "dc2"), { commissionAmount: 0, paidAmount: 0, status: "cancelled", updatedAt: now() })));
await t("commission: paid money cannot vanish while the amount stands", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc2"), { paidAmount: 0, status: "pending", updatedAt: now() })));
await t("commission: cancelling is allowed", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { status: "cancelled", updatedAt: now() })));
await t("commission: cancelled is final", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc3"), { status: "pending", updatedAt: now() })));
await t("commission: it cannot be moved to another clinician", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { doctorId: "someone-else", updatedAt: now() })));
await t("commission: it cannot be re-pointed at another invoice", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { billingId: "inv2", updatedAt: now() })));
await t("commission: its rate cannot be rewritten", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { commissionPercentage: 50, updatedAt: now() })));
await t("commission: it cannot be turned into a clawback after the fact", () =>
  assertFails(updateDoc(doc(as(STAFF), "doctorCommissions", "dc1"), { clawbackOf: "dc2", commissionAmount: -84.75, updatedAt: now() })));
await t("commission: a record cannot be born paid", () =>
  assertFails(setDoc(doc(as(STAFF), "doctorCommissions", "c9"), commission({ status: "paid", paidAmount: 84.75, createdBy: STAFF }))));
await t("commission: a record cannot be born with money already on it", () =>
  assertFails(setDoc(doc(as(STAFF), "doctorCommissions", "c10"), commission({ paidAmount: 10, createdBy: STAFF }))));
await t("commission: a record cannot be born cancelled", () =>
  assertFails(setDoc(doc(as(STAFF), "doctorCommissions", "c11"), commission({ status: "cancelled", createdBy: STAFF }))));
await t("doctorCommissions: staff cannot delete", () =>
  assertFails(deleteDoc(doc(as(STAFF), "doctorCommissions", "dc1"))));
await t("doctorCommissions: clinic-admin can delete", () =>
  assertSucceeds(deleteDoc(doc(as(ADMIN), "doctorCommissions", "dc1"))));

// ── expert / referral / staff commissions: same invariants, plain membership ─
// These three used to be `allow create, update` at clinic membership with no
// field checks at all.
for (const [coll, id, idField] of [
  ["expertCommissions", "ec1", "expertId"],
  ["referralCommissions", "rc1", "partnerId"],
  ["staffCommissions", "sc1", "staffId"],
]) {
  await t(`${coll}: staff creates a sound record`, () =>
    assertSucceeds(setDoc(doc(as(STAFF), coll, "new1"), commissionSeed(idField, { createdBy: STAFF }))));
  await t(`${coll}: a record missing its required fields is refused`, () =>
    assertFails(setDoc(doc(as(STAFF), coll, "new2"), { clinicId: "default", commissionAmount: 10, createdBy: STAFF })));
  await t(`${coll}: createdBy must be the caller`, () =>
    assertFails(setDoc(doc(as(STAFF), coll, "new3"), commissionSeed(idField, { createdBy: DOC }))));
  await t(`${coll}: a clawback naming its original is allowed`, () =>
    assertSucceeds(setDoc(doc(as(STAFF), coll, "new4"), commissionSeed(idField, { commissionAmount: -20, clawbackOf: id, clawbackReason: "reversed", createdBy: STAFF }))));
  await t(`${coll}: a negative amount with no clawbackOf is refused`, () =>
    assertFails(setDoc(doc(as(STAFF), coll, "new5"), commissionSeed(idField, { commissionAmount: -20, createdBy: STAFF }))));
  await t(`${coll}: paying in full is allowed`, () =>
    assertSucceeds(updateDoc(doc(as(STAFF), coll, id), { paidAmount: 84.75, status: "paid", paymentMethod: "bank", paidDate: now(), updatedAt: now() })));
  await t(`${coll}: paying more than is owed is refused`, () =>
    assertFails(updateDoc(doc(as(STAFF), coll, id), { paidAmount: 500, status: "paid", paymentMethod: "bank", paidDate: now(), updatedAt: now() })));
  await t(`${coll}: the amount cannot be inflated`, () =>
    assertFails(updateDoc(doc(as(STAFF), coll, id), { commissionAmount: 999, updatedAt: now() })));
  await t(`${coll}: marking paid with no money recorded is refused`, () =>
    assertFails(updateDoc(doc(as(STAFF), coll, id), { status: "paid", updatedAt: now() })));
  await t(`${coll}: cancelling is allowed`, () =>
    assertSucceeds(updateDoc(doc(as(STAFF), coll, id), { status: "cancelled", updatedAt: now() })));
  await t(`${coll}: other-clinic member cannot touch it`, () =>
    assertFails(updateDoc(doc(as(OTHER), coll, id), { status: "cancelled", updatedAt: now() })));
  await t(`${coll}: staff cannot delete`, () =>
    assertFails(deleteDoc(doc(as(STAFF), coll, id))));
  await t(`${coll}: clinic-admin can delete`, () =>
    assertSucceeds(deleteDoc(doc(as(ADMIN), coll, id))));
}

// ── appointments: the visit's deposit is ledgered ───────────────────────────
// A rise must be written in the same transaction as the wallet row that took
// the money and names this visit (collectCheckInDue); a fall is only for a
// visit that has been invoiced or will never be. Everything else is refused —
// clinic-admin included.
const depositRow = (over) => row({ referenceId: "a1", referenceType: "appointment", amount: 500, ...over });
await t("deposit: cash collected at check-in — row + balance + visit in one batch", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "d1"), depositRow({}));
  b.update(doc(db, "patients", "p1"), { walletBalance: 600, lastWalletTxnId: "d1" });
  b.update(doc(db, "appointments", "a1"), { depositedAmount: 500, depositTxnIds: ["d1"], checkInDepositFailedAt: null });
  await assertSucceeds(b.commit());
});
await t("deposit: wallet credit spent at check-in — deduction row, credit share rises by exactly it", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "d2"), depositRow({ type: "deduction", amount: 80 }));
  b.update(doc(db, "patients", "p1"), { walletBalance: 20, lastWalletTxnId: "d2" });
  b.update(doc(db, "appointments", "a1"), { depositedAmount: 80, depositFromCredit: increment(80), depositTxnIds: ["d2"] });
  await assertSucceeds(b.commit());
});
await t("deposit: a rise with no ledger row is refused", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointments", "a1"), { depositedAmount: 500 })));
await t("deposit: clinic-admin cannot invent a deposit either", () =>
  assertFails(updateDoc(doc(as(ADMIN), "appointments", "a1"), { depositedAmount: 500, depositTxnIds: ["nope"] })));
await t("deposit: a rise larger than its row is refused", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "d3"), depositRow({}));
  b.update(doc(db, "patients", "p1"), { walletBalance: 600, lastWalletTxnId: "d3" });
  b.update(doc(db, "appointments", "a1"), { depositedAmount: 900, depositTxnIds: ["d3"] });
  await assertFails(b.commit());
});
await t("deposit: a row for a different visit does not vouch for this one", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "d4"), depositRow({ referenceId: "a2" }));
  b.update(doc(db, "patients", "p1"), { walletBalance: 600, lastWalletTxnId: "d4" });
  b.update(doc(db, "appointments", "a1"), { depositedAmount: 500, depositTxnIds: ["d4"] });
  await assertFails(b.commit());
});
await t("deposit: the credit share cannot rise on a cash (deposit) row", async () => {
  const db = as(STAFF); const b = writeBatch(db);
  b.set(doc(db, "walletTransactions", "d5"), depositRow({}));
  b.update(doc(db, "patients", "p1"), { walletBalance: 600, lastWalletTxnId: "d5" });
  b.update(doc(db, "appointments", "a1"), { depositedAmount: 500, depositFromCredit: 500, depositTxnIds: ["d5"] });
  await assertFails(b.commit());
});
await t("deposit: the credit share alone cannot be rewritten", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointments", "a2"), { depositFromCredit: 500 })));
await t("deposit: a collected deposit cannot be zeroed on a live visit", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointments", "a2"), { depositedAmount: 0, depositFromCredit: 0 })));
await t("deposit: clinic-admin cannot zero it on a live visit either", () =>
  assertFails(updateDoc(doc(as(ADMIN), "appointments", "a2"), { depositedAmount: 0, depositFromCredit: 0 })));
await t("deposit: checkout releases the applied deposit and its credit share together", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "appointments", "a3"), { depositedAmount: increment(-500), depositFromCredit: increment(-200), updatedAt: now() })));
await t("deposit: checkout may release part of it, credit share first", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "appointments", "a3"), { depositedAmount: 300, depositFromCredit: 0, updatedAt: now() })));
await t("deposit: a release that leaves the credit share above the deposit is refused", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointments", "a3"), { depositedAmount: 100, updatedAt: now() })));
await t("deposit: cancelling the visit clears it in the same write", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "appointments", "a2"), { status: "cancelled", depositedAmount: 0, depositFromCredit: 0, depositTxnIds: [], pendingVisitItems: [] })));
await t("deposit: no-show clears it after the status moved", async () => {
  await assertSucceeds(updateDoc(doc(as(STAFF), "appointments", "a2"), { status: "no-show" }));
  await assertSucceeds(updateDoc(doc(as(STAFF), "appointments", "a2"), { depositedAmount: 0, depositFromCredit: 0 }));
});
await t("deposit: it cannot go negative", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointments", "a3"), { depositedAmount: -50, depositFromCredit: 0 })));
await t("deposit: untouched — other fields edit freely", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "appointments", "a2"), { notes: "triaged", pendingVisitItems: [{ id: "l1", price: 700, amount: 700 }] })));

// ── users: nobody promotes themselves ────────────────────────────────────────
await t("users: a member may edit their own profile", () =>
  assertSucceeds(updateDoc(doc(as(STAFF), "users", STAFF), { displayName: "S. One" })));
await t("users: a member cannot change their own role", () =>
  assertFails(updateDoc(doc(as(STAFF), "users", STAFF), { role: "clinic-admin" })));
await t("users: a clinic-admin cannot change their own role either", () =>
  assertFails(updateDoc(doc(as(ADMIN), "users", ADMIN), { role: "super-admin" })));
await t("users: a member cannot move themselves to another clinic", () =>
  assertFails(updateDoc(doc(as(STAFF), "users", STAFF), { clinicId: "other" })));

// ── appointmentBilling: a locked invoice stays locked ────────────────────────
// A lone `status: "draft"` write on a locked invoice used to pass the
// bookkeeping allowlist (status is a bookkeeping field) and re-open it for a
// second write that rewrote the amounts.
await t("appt: finalized invoice cannot be re-opened by writing status draft", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointmentBilling", "inv3"), { status: "draft", updatedAt: now() })));
// inv2 is seeded as draft+irdSynced, so "draft" would be a no-op write;
// the assertion that matters on a synced invoice is that status moves to
// nothing but cancelled.
await t("appt: IRD-synced invoice — status may move only to cancelled", () =>
  assertFails(updateDoc(doc(as(STAFF), "appointmentBilling", "inv2"), { status: "paid", updatedAt: now() })));

await env.cleanup();
const failed = results.filter((r) => r[0] === "FAIL");
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "\n       -> " + r[2] : "");
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
