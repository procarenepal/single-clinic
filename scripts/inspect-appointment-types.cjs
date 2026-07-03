const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CLINIC_ID = 'default';

async function run() {
  console.log('\nQuerying appointment_types for clinic default...');
  const typeSnap = await getDocs(query(collection(db, 'appointment_types'), where('clinicId', '==', CLINIC_ID)));
  console.log(`Found ${typeSnap.size} appointment types.`);
  typeSnap.forEach(d => {
    console.log(d.id, d.data().name);
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
