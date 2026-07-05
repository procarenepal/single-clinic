const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
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
const { getFirestore, doc, setDoc } = require('firebase/firestore'); const auth = getAuth(app); const db = getFirestore(app);

async function createAuthUser() {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, 'expert@procaresoft.com', 'password123');
    console.log('Successfully created Firebase Auth user for:', userCredential.user.email); const snap = await require('firebase/firestore').getDocs(require('firebase/firestore').query(require('firebase/firestore').collection(db, 'users'), require('firebase/firestore').where('role', '==', 'system-owner'))); const clinicId = snap.docs[0]?.data().clinicId || 'demo_clinic'; await setDoc(doc(db, 'users', userCredential.user.uid), { email: 'expert@procaresoft.com', role: 'expert', displayName: 'Deepak Sharma (Expert)', clinicId: clinicId });
    console.log('You can now log in using password123');
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('The user expert@procaresoft.com already exists in Firebase Auth.');
    } else {
      console.error('Error creating user:', error.message);
    }
    process.exit(1);
  }
}

createAuthUser();
