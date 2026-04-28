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

async function findIds() {
    console.log('Searching for Clinic ID in users...');
    const usersSnap = await getDocs(query(collection(db, 'users'), limit(5)));
    if (usersSnap.empty) {
        console.log('No users found.');
    } else {
        usersSnap.docs.forEach(doc => {
            const data = doc.data();
            console.log(`User ${doc.id}: clinicId=${data.clinicId}, branchId=${data.branchId}, role=${data.role}`);
        });
    }
    process.exit(0);
}

findIds();
