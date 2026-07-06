const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, updateDoc, doc, query, where } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});

const db = getFirestore(app);
const CLINIC_ID = 'default';

async function deleteAppointments() {
  const q = query(collection(db, 'appointments'), where('clinicId', '==', CLINIC_ID));
  const snap = await getDocs(q);
  if (snap.empty) { console.log('  No appointments found.'); return 0; }
  let count = 0;
  for (const docSnap of snap.docs) {
    await deleteDoc(doc(db, 'appointments', docSnap.id));
    count++;
    console.log(`  ✓ Deleted appointment: ${docSnap.id}`);
  }
  return count;
}

async function resetCommissionBalances() {
  let count = 0;

  // Reset doctors
  const doctorsSnap = await getDocs(query(collection(db, 'doctors'), where('clinicId', '==', CLINIC_ID)));
  for (const docSnap of doctorsSnap.docs) {
    await updateDoc(doc(db, 'doctors', docSnap.id), {
      totalCommissionEarned: 0,
      totalCommissionBalance: 0,
    });
    count++;
    console.log(`  ✓ Reset doctor balances: ${docSnap.data().name || docSnap.id}`);
  }

  // Reset experts
  const expertsSnap = await getDocs(query(collection(db, 'experts'), where('clinicId', '==', CLINIC_ID)));
  for (const docSnap of expertsSnap.docs) {
    await updateDoc(doc(db, 'experts', docSnap.id), {
      totalCommissionEarned: 0,
      totalCommissionBalance: 0,
    });
    count++;
    console.log(`  ✓ Reset expert balances:  ${docSnap.data().name || docSnap.id}`);
  }

  return count;
}

(async () => {
  try {
    console.log(`\nCleaning up remaining data for clinic: ${CLINIC_ID}...\n`);

    console.log('── Appointments ────────────────────────');
    const apptCount = await deleteAppointments();

    console.log('\n── Commission Balances on Doctors/Experts ──');
    const resetCount = await resetCommissionBalances();

    console.log(`\n✅ Done! Deleted ${apptCount} appointment(s). Reset commission balances on ${resetCount} clinician(s).`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
