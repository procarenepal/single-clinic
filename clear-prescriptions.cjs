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

(async () => {
  try {
    const colName = 'prescriptions';
    const snap = await getDocs(collection(db, colName));
    console.log(`Found ${snap.size} records in ${colName}. Deleting...`);
    
    let deletedPrescriptions = 0;
    let deletedItems = 0;
    
    for (const d of snap.docs) {
      // First, delete items in the subcollection
      const itemsSnap = await getDocs(collection(db, colName, d.id, 'items'));
      for (const itemDoc of itemsSnap.docs) {
        await deleteDoc(doc(db, colName, d.id, 'items', itemDoc.id));
        deletedItems++;
      }
      
      // Then delete the prescription document
      await deleteDoc(doc(db, colName, d.id));
      deletedPrescriptions++;
    }
    
    console.log(`Successfully deleted ${deletedPrescriptions} prescriptions and ${deletedItems} prescription items.`);
  } catch (err) {
    console.error('Error clearing prescriptions:', err);
  }
  process.exit(0);
})();
