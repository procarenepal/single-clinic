const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');
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

async function fixPaths() {
    const pagesRef = collection(db, 'pages');

    const fixes = [
        { old: '/dashboard/new-doctor', new: '/dashboard/doctors/new' },
        { old: '/dashboard/new-patient', new: '/dashboard/patients/new' },
        { old: '/dashboard/front-office/call-logs', new: '/dashboard/front-office/manage-call-logs' }
    ];

    for (const fix of fixes) {
        const q = query(pagesRef, where('path', '==', fix.old));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await updateDoc(doc(db, 'pages', snap.docs[0].id), {
                path: fix.new
            });
            console.log(`Updated path from ${fix.old} to ${fix.new}`);
        } else {
            console.log(`Path ${fix.old} not found in database.`);
        }
    }
}

fixPaths().then(() => process.exit(0)).catch(console.error);
