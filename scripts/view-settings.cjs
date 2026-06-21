const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
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

async function viewSettings() {
    console.log('Querying SMS settings...');
    try {
        const docSnap = await getDoc(doc(db, 'smsSettings', 'default'));
        if (docSnap.exists()) {
            console.log(JSON.stringify(docSnap.data(), null, 2));
        } else {
            console.log('No default settings document found');
        }
    } catch (err) {
        console.error('Error fetching settings:', err);
    }
    process.exit(0);
}

viewSettings();
