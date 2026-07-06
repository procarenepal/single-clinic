const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function checkAll(colName) {
  const snap = await getDocs(collection(db, colName));
  console.log(`\n── ${colName} (${snap.size} records) ──`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`  id=${d.id} | doctorId/expertId=${data.doctorId || data.expertId} | clinicId=${data.clinicId} | amount=${data.commissionAmount} | invoice=${data.invoiceNumber}`);
  });
}

(async () => {
  await checkAll('doctorCommissions');
  await checkAll('expertCommissions');

  // Also check the latest billing to see what clinicId it has
  console.log('\n── Latest appointmentBilling records ──');
  const bSnap = await getDocs(collection(db, 'appointmentBilling'));
  bSnap.forEach(d => {
    const data = d.data();
    console.log(`  invoice=${data.invoiceNumber} | clinicId=${data.clinicId} | paymentStatus=${data.paymentStatus} | doctorId=${data.doctorId} | items[0].doctorId=${data.items?.[0]?.doctorId}`);
  });

  process.exit(0);
})();
