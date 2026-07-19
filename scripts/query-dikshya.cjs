const dotenv = require('dotenv');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function queryFollowups() {
  const q = query(collection(db, "patientFollowups"), where("patientName", "==", "Dikshya Bhattarai"));
  const snap = await getDocs(q);
  console.log(`Found ${snap.docs.length} follow-ups for Dikshya Bhattarai:`);
  snap.docs.forEach(doc => {
    console.log(`\nID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

queryFollowups().catch(err => {
  console.error(err);
  process.exit(1);
});
