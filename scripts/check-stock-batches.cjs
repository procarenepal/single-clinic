const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query } = require('firebase/firestore');
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

async function checkStock() {
    console.log('Querying medicineStock...');
    const snap = await getDocs(collection(db, 'medicineStock'));
    snap.docs.forEach(doc => {
        const data = doc.data();
        const expiryStr = data.expiryDate ? (data.expiryDate.toDate ? data.expiryDate.toDate().toISOString() : data.expiryDate) : 'N/A';
        console.log(`Medicine Stock Document ${doc.id}:`);
        console.log(`  medicineId: ${data.medicineId}`);
        console.log(`  medicineName: ${data.medicineName}`);
        console.log(`  batchNumber: ${data.batchNumber}`);
        console.log(`  expiryDate: ${expiryStr}`);
        console.log(`  currentStock: ${data.currentStock}`);
    });
    process.exit(0);
}

checkStock();
