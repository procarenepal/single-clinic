const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp } = require('firebase/firestore');
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

async function seedAddDoctorPage() {
    console.log('Seeding Add Doctor child page...');
    const pagesRef = collection(db, 'pages');

    // 1. Find the Doctors page
    const docsQ = query(pagesRef, where('path', '==', '/dashboard/doctors'));
    const docsSnapshot = await getDocs(docsQ);

    if (docsSnapshot.empty) {
        console.error('Could not find the Doctors page!');
        process.exit(1);
    }

    const doctorsPageDoc = docsSnapshot.docs[0];
    const doctorsPageId = doctorsPageDoc.id;

    // Update Doctors page to have missing "hasSubmenu: true"
    await updateDoc(doc(db, 'pages', doctorsPageId), {
        hasSubmenu: true,
        updatedAt: serverTimestamp()
    });
    console.log('Updated Doctors page to support submenus.');

    // 2. Check if Add Doctor page already exists to prevent duplicates
    const targetPath = '/dashboard/new-doctor';
    const newDoctorQ = query(pagesRef, where('path', '==', targetPath));
    const newDoctorSnap = await getDocs(newDoctorQ);

    if (newDoctorSnap.empty) {
        await addDoc(pagesRef, {
            name: 'Add Doctor',
            path: targetPath,
            description: 'Add a new doctor to the system',
            icon: 'IoPersonAddOutline', // Optional
            isActive: true,
            showInSidebar: true,
            order: 1, // First sub-item
            parentId: doctorsPageId,
            level: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log('Successfully added "Add Doctor" sub-menu under Doctors!');
    } else {
        console.log('"Add Doctor" sub-menu already exists! Ensuring it is linked to Doctors page.');
        const existingDoc = newDoctorSnap.docs[0];
        await updateDoc(doc(db, 'pages', existingDoc.id), {
            parentId: doctorsPageId,
            level: 1,
            showInSidebar: true,
            isActive: true,
            updatedAt: serverTimestamp()
        });
    }

    process.exit(0);
}

seedAddDoctorPage().catch(console.error);
