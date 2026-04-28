const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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

async function checkSpecialities() {
    console.log('Fetching all doctor specialities...');
    const snap = await getDocs(collection(db, 'doctor_specialities'));
    if (snap.empty) {
        console.log('No specialities found in "doctor_specialities" collection.');
    } else {
        console.log(`Found ${snap.size} specialities:`);
        snap.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- ${data.name} (key: ${data.key}, clinicId: ${data.clinicId}, branchId: ${data.branchId})`);
        });
    }
    process.exit(0);
}

checkSpecialities();
