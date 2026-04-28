const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
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

async function checkSpaces() {
    const pagesRef = collection(db, 'pages');
    const snap = await getDocs(pagesRef);

    for (const p of snap.docs) {
        const data = p.data();
        if (data.path && data.path.includes(' ')) {
            console.log(`Found space in path: '${data.path}' for page '${data.name}' (${p.id})`);
            const newPath = data.path.replace(/\s+/g, '-').replace('/dashboard/new-doctor', '/dashboard/doctors/new');
            await updateDoc(doc(db, 'pages', p.id), { path: newPath });
            console.log(`Updated to: '${newPath}'`);
        } else if (data.path === '/dashboard/new doctor') {
            // Just in case
            await updateDoc(doc(db, 'pages', p.id), { path: '/dashboard/doctors/new' });
        }
    }
}

checkSpaces().then(() => process.exit(0)).catch(console.error);
