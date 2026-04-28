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
    console.log('Finding Clinic ID...');
    const clinicsSnap = await getDocs(query(collection(db, 'clinics'), limit(1)));
    if (clinicsSnap.empty) {
        console.log('No clinics found. Using "default"');
    } else {
        console.log(`Clinic ID: ${clinicsSnap.docs[0].id}`);
    }

    console.log('Finding Branch ID...');
    const branchesSnap = await getDocs(query(collection(db, 'branches'), limit(1)));
    if (branchesSnap.empty) {
        console.log('No branches found. Using "default"');
    } else {
        console.log(`Branch ID: ${branchesSnap.docs[0].id}`);
    }
    process.exit(0);
}

findIds();
