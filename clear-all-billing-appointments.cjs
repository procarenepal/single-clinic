const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function clearCollection(colName) {
  try {
    const snap = await getDocs(collection(db, colName));
    if (snap.empty) {
      console.log(`  [SKIP] ${colName} — already empty.`);
      return 0;
    }
    console.log(`  [DEL]  ${colName} — deleting ${snap.size} records...`);
    let count = 0;
    for (const d of snap.docs) {
      await deleteDoc(doc(db, colName, d.id));
      count++;
    }
    console.log(`  [DONE] ${colName} — deleted ${count} records.`);
    return count;
  } catch (err) {
    console.error(`  [ERR]  ${colName}:`, err.message);
    return 0;
  }
}

(async () => {
  console.log('');
  console.log('⚠️  WARNING: This will permanently delete ALL appointments and billing data.');
  console.log(`   Project: ${process.env.VITE_FIREBASE_PROJECT_ID}`);
  console.log('');
  console.log('🗑️  Starting cleanup...');
  console.log('');

  // ── Appointments ──────────────────────────────────────────────
  console.log('📅 Appointments:');
  await clearCollection('appointments');

  // ── Appointment Billing ───────────────────────────────────────
  console.log('');
  console.log('💳 Appointment Billing:');
  await clearCollection('appointmentBilling');

  // ── Pathology Billing ─────────────────────────────────────────
  console.log('');
  console.log('🧪 Pathology Billing:');
  await clearCollection('pathologyBilling');

  // ── Commissions ───────────────────────────────────────────────
  console.log('');
  console.log('💰 Commissions:');
  await clearCollection('doctorCommissions');
  await clearCollection('expertCommissions');
  await clearCollection('staffCommissions');
  await clearCollection('referralCommissions');

  console.log('');
  console.log('✅ All done. Appointments and billing have been cleared.');
  process.exit(0);
})();
