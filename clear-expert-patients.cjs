const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');
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
    const colName = 'patients';
    const snap = await getDocs(collection(db, colName));
    console.log(`Scanning ${snap.size} records in ${colName} for expert/doctor links...`);
    
    let updatedCount = 0;
    for (const d of snap.docs) {
      const data = d.data();
      if (data.assignedExpertId || data.doctorId) {
        await updateDoc(doc(db, colName, d.id), {
          assignedExpertId: null,
          doctorId: null
        });
        updatedCount++;
      }
    }
    
    console.log(`Successfully unlinked ${updatedCount} patients from experts and doctors.`);
  } catch (err) {
    console.error('Error unlinking patients:', err);
  }
  process.exit(0);
})();
