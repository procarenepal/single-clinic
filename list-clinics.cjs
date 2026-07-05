const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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
    const snap = await getDocs(collection(db, 'clinics'));
    snap.forEach(doc => {
      console.log('Clinic ID:', doc.id, 'Name:', doc.data().name);
    });
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
