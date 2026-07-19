const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
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

async function listUsers() {
    console.log('Querying users...');
    const q = query(collection(db, 'users'), limit(10));
    const snap = await getDocs(q);
    snap.docs.forEach(doc => {
        const data = doc.data();
        console.log(`User ID: ${doc.id}`);
        console.log(`  email: ${data.email}`);
        console.log(`  displayName: ${data.displayName}`);
        console.log(`  role: ${data.role}`);
        console.log(`  isActive: ${data.isActive}`);
        console.log(`  clinicId: ${data.clinicId}`);
        console.log('----------------');
    });
    process.exit(0);
}

listUsers().catch(err => {
    console.error(err);
    process.exit(1);
});
