#!/usr/bin/env node
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } = require('firebase/firestore');
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

const expertsPage = {
    name: 'Experts',
    path: '/dashboard/experts',
    icon: 'IoPeopleOutline',
    description: 'Manage clinical experts and technicians',
    order: 45 // Puts it near Doctors
};

async function seedExpertsPage() {
    console.log('Seeding Experts page...');
    const pagesRef = collection(db, 'pages');
    
    // Check if it already exists
    const q = query(pagesRef, where('path', '==', expertsPage.path));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        await addDoc(pagesRef, {
            ...expertsPage,
            isActive: true,
            showInSidebar: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log('Successfully added Experts page!');
    } else {
        console.log('Experts page already exists.');
    }

    process.exit(0);
}

seedExpertsPage().catch(console.error);
