const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
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

async function run() {
  const ids = ['v8PHY9u2SFyfc1xUAZ7z', '0ga6ymgs7ze6OvqrirEM', '0RkOVCnoZRZA0vy4BwFP', 'L26Bn7wEmYkcIO1rXjO8'];
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'appointment_types', id));
    if (snap.exists()) {
      console.log(snap.id, snap.data());
    } else {
      console.log(id, 'Does not exist');
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
