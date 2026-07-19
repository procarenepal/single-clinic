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

async function createTestAdmin() {
  const email = 'testadmin@example.com';
  const password = 'Password123!';
  const clinicId = 'default';

  console.log(`Checking/Creating test admin: ${email}...`);
  try {
    let uid;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCred.user.uid;
      console.log(`Created new auth user. UID: ${uid}`);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        console.log('User already exists in Firebase Auth. Logging in to get UID...');
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        uid = userCred.user.uid;
        console.log(`Logged in. UID: ${uid}`);
      } else {
        throw authErr;
      }
    }

    // Create user document with role: 'system-owner'
    await setDoc(doc(db, 'users', uid), {
      email: email,
      displayName: 'Test Admin',
      role: 'system-owner',
      clinicId: clinicId,
      branchId: 'default',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('User document created/updated in Firestore `users` collection.');
    console.log('Successfully set up testadmin@example.com with password Password123!');
  } catch (e) {
    console.error('Error in creating test admin:', e);
  }
  process.exit(0);
}

createTestAdmin();
