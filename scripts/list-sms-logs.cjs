const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy, limit } = require('firebase/firestore');
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

async function listSMSLogs() {
    console.log('Querying latest 5 SMS logs...');
    try {
        const q = query(collection(db, 'smsLogs'), orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        snap.docs.forEach(doc => {
            const data = doc.data();
            console.log(`Log ID: ${doc.id}`);
            console.log(`  recipient: ${data.patientName || data.patientPhone}`);
            console.log(`  message: ${data.message}`);
            console.log(`  status: ${data.status}`);
            console.log(`  createdAt: ${data.createdAt?.toDate?.() || data.createdAt}`);
            console.log(`  ----------------------------------------`);
        });
    } catch (err) {
        console.error('Error fetching logs:', err);
    }
    process.exit(0);
}

listSMSLogs();
