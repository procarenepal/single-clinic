#!/usr/bin/env node
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, serverTimestamp } = require('firebase/firestore');
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

async function seedAddExpertSubmenu() {
    console.log('Seeding Add Expert child page...');
    const pagesRef = collection(db, 'pages');
    
    // Find Experts page
    const parentQ = query(pagesRef, where('path', '==', '/dashboard/experts'));
    const parentSnap = await getDocs(parentQ);
    
    if (parentSnap.empty) {
        console.error('Parent /dashboard/experts not found!');
        process.exit(1);
    }
    
    const parentDoc = parentSnap.docs[0];
    
    // Update parent to have submenu
    await updateDoc(parentDoc.ref, {
        hasSubmenu: true,
        updatedAt: serverTimestamp()
    });

    const submenu = {
        name: 'Add Expert',
        path: '/dashboard/experts/new',
        icon: 'IoPersonAddOutline',
        description: 'Register a new clinical expert',
        parentId: parentDoc.id,
        order: 1,
        isActive: true,
        showInSidebar: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };
    
    const childQ = query(pagesRef, where('path', '==', submenu.path));
    const childSnap = await getDocs(childQ);
    
    if (childSnap.empty) {
        await addDoc(pagesRef, submenu);
        console.log('Successfully added "Add Expert" sub-menu!');
    } else {
        console.log('Add Expert submenu already exists.');
    }

    process.exit(0);
}

seedAddExpertSubmenu().catch(console.error);
