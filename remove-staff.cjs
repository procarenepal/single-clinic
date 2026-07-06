const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, deleteDoc, doc } = require('firebase/firestore');
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
    const emailToRemove = 'elinabudhathoki32@gmail.com';
    const colName = 'staff';
    const q = query(collection(db, colName), where('email', '==', emailToRemove));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log(`No staff member found with email ${emailToRemove}`);
    } else {
      for (const d of snap.docs) {
        await deleteDoc(doc(db, colName, d.id));
        console.log(`Successfully deleted staff member: ${d.data().name} (${d.id})`);
      }
    }
  } catch (err) {
    console.error('Error removing staff member:', err);
  }
  process.exit(0);
})();
