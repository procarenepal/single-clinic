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

async function findDoctors() {
    console.log('Searching for Doctors...');
    const doctorsSnap = await getDocs(query(collection(db, 'doctors'), limit(5)));
    if (doctorsSnap.empty) {
        console.log('No doctors found.');
    } else {
        doctorsSnap.docs.forEach(doc => {
            const data = doc.data();
            console.log(`Doctor ${doc.id}: name=${data.name}, clinicId=${data.clinicId}, branchId=${data.branchId}`);
        });
    }
    process.exit(0);
}

findDoctors();
