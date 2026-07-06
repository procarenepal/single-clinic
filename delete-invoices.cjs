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

(async () => {
  try {
    console.log(`\nFetching all invoices for clinic: ${CLINIC_ID}...`);

    const q = query(
      collection(db, 'appointmentBilling'),
      where('clinicId', '==', CLINIC_ID)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      console.log('No invoices found. Nothing to delete.');
      process.exit(0);
    }

    console.log(`Found ${snap.size} invoice(s). Deleting...`);

    let deleted = 0;
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, 'appointmentBilling', docSnap.id));
      deleted++;
      console.log(`  ✓ Deleted invoice ${docSnap.id} (${docSnap.data().invoiceNumber || 'no number'})`);
    }

    console.log(`\n✅ Done! Deleted ${deleted} invoice(s) from clinic "${CLINIC_ID}".`);
    process.exit(0);
  } catch (e) {
    console.error('Error deleting invoices:', e);
    process.exit(1);
  }
})();
