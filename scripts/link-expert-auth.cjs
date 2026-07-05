const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDocs, query, collection, where } = require('firebase/firestore');
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

async function linkAuthToFirestore() {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, 'expert@procaresoft.com', 'password123');
    const uid = userCredential.user.uid;
    
    console.log('Successfully logged in. UID:', uid);
    
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'system-owner')));
    const clinicId = snap.docs[0]?.data().clinicId || 'demo_clinic';
    
    await setDoc(doc(db, 'users', uid), {
      email: 'expert@procaresoft.com',
      role: 'expert',
      displayName: 'Deepak Sharma (Expert)',
      clinicId: clinicId, isActive: true
    });
    
    console.log('Successfully linked Auth UID to Firestore Users collection.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

linkAuthToFirestore();
