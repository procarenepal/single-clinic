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
    const colName = 'referralCommissions';
    const snap = await getDocs(collection(db, colName));
    console.log(`Found ${snap.size} records in ${colName}. Deleting...`);
    
    let deletedCount = 0;
    for (const d of snap.docs) {
      await deleteDoc(doc(db, colName, d.id));
      deletedCount++;
    }
    
    console.log(`Successfully deleted ${deletedCount} records from ${colName}.`);
  } catch (err) {
    console.error('Error clearing referral commissions:', err);
  }
  process.exit(0);
})();
