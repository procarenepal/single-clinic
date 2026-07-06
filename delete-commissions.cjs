const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, query, where } = require('firebase/firestore');
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

async function deleteCollection(collectionName, label) {
  const q = query(collection(db, collectionName), where('clinicId', '==', CLINIC_ID));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.log(`  No ${label} commission records found.`);
    return 0;
  }

  let deleted = 0;
  for (const docSnap of snap.docs) {
    await deleteDoc(doc(db, collectionName, docSnap.id));
    deleted++;
    console.log(`  ✓ Deleted ${label} commission: ${docSnap.id} (Invoice: ${docSnap.data().invoiceNumber || 'N/A'})`);
  }
  return deleted;
}

(async () => {
  try {
    console.log(`\nDeleting commission records for clinic: ${CLINIC_ID}...\n`);

    console.log('── Doctor Commissions ──────────────────');
    const doctorCount = await deleteCollection('doctorCommissions', 'doctor');

    console.log('\n── Expert Commissions ──────────────────');
    const expertCount = await deleteCollection('expertCommissions', 'expert');

    console.log(`\n✅ Done! Deleted ${doctorCount} doctor + ${expertCount} expert commission record(s).`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
