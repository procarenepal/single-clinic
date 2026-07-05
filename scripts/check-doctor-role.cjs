const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, updateDoc } = require('firebase/firestore');
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

async function checkAndFixDoctorRole() {
  console.log('Fetching all users...');
  const snap = await getDocs(collection(db, 'users'));

  let found = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const email = (data.email || '').toLowerCase();
    if (email.includes('doctor') || data.role === 'doctor') {
      found++;
      console.log(`\nUser: ${d.id}`);
      console.log(`  Email: ${data.email}`);
      console.log(`  Role:  ${data.role}`);
      console.log(`  DisplayName: ${data.displayName}`);

      // If role is not exactly "doctor", fix it
      if (data.role !== 'doctor' && email.includes('doctor')) {
        console.log(`  → Updating role to "doctor"...`);
        await updateDoc(doc(db, 'users', d.id), { role: 'doctor' });
        console.log(`  ✓ Updated`);
      }
    }
  }

  if (found === 0) {
    console.log('No doctor users found. All users:');
    snap.forEach(d => {
      const data = d.data();
      console.log(`  ${data.email} — role: ${data.role}`);
    });
  }

  console.log('\nDone.');
  process.exit(0);
}

checkAndFixDoctorRole().catch(e => {
  console.error(e);
  process.exit(1);
});
