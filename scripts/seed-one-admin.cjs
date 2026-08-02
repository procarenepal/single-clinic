/**
 * Seed One Admin Script
 * Creates a single admin user with system-owner role.
 * Usage: node scripts/seed-one-admin.cjs
 */

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');
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
const auth = getAuth(app);
const db = getFirestore(app);

async function seedAdmin() {
  const email = 'karanbohara216@gmail.com';
  const password = 'Karan@1234';
  const displayName = 'Karan Bohara';

  console.log(`\n=== Seeding Admin User ===`);
  console.log(`Email: ${email}`);
  console.log(`Display Name: ${displayName}\n`);

  try {
    let uid;

    try {
      console.log('Creating Firebase Auth user...');
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCred.user.uid;
      console.log(`✅ Auth user created. UID: ${uid}`);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        console.log('⚠️  User already exists in Firebase Auth. Signing in to retrieve UID...');
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        uid = userCred.user.uid;
        console.log(`✅ Signed in. UID: ${uid}`);
      } else {
        throw authErr;
      }
    }

    // Write user document into Firestore with system-owner role
    console.log('\nWriting user document to Firestore...');
    await setDoc(doc(db, 'users', uid), {
      email: email,
      displayName: displayName,
      firstName: 'Karan',
      lastName: 'Bohara',
      role: 'system-owner',
      clinicId: null,
      branchId: null,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`✅ User document created/updated in Firestore 'users' collection.`);
    console.log(`\n=== Admin Seeded Successfully ===`);
    console.log(`Email    : ${email}`);
    console.log(`Password : ${password}`);
    console.log(`Role     : system-owner`);
    console.log(`UID      : ${uid}`);
  } catch (err) {
    console.error('\n❌ Error seeding admin:', err);
    process.exit(1);
  }

  process.exit(0);
}

seedAdmin();
