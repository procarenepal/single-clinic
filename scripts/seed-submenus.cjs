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

async function seedSubMenus() {
    const pagesRef = collection(db, 'pages');

    // Helper function to link a child to a parent
    async function addSubMenu(parentPath, childName, childPath, icon) {
        // 1. Find parent
        const parentQ = query(pagesRef, where('path', '==', parentPath));
        const parentSnap = await getDocs(parentQ);
        if (parentSnap.empty) {
            console.error(`Parent ${parentPath} not found! Skipping ${childName}.`);
            return;
        }
        const parentDoc = parentSnap.docs[0];

        // Ensure parent has hasSubmenu = true
        if (!parentDoc.data().hasSubmenu) {
            await updateDoc(doc(db, 'pages', parentDoc.id), {
                hasSubmenu: true,
                updatedAt: serverTimestamp()
            });
            console.log(`Updated ${parentPath} to hasSubmenu: true`);
        }

        // 2. Check if child exists
        const childQ = query(pagesRef, where('path', '==', childPath));
        const childSnap = await getDocs(childQ);

        if (childSnap.empty) {
            await addDoc(pagesRef, {
                name: childName,
                path: childPath,
                description: `Submenu for ${childName}`,
                icon: icon,
                isActive: true,
                showInSidebar: true,
                order: Math.floor(Math.random() * 10), // order inside parent
                parentId: parentDoc.id,
                level: 1,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log(`Successfully added Submenu: ${childName} -> ${childPath}`);
        } else {
            console.log(`Submenu already exists: ${childName}. Ensuring it links to parent.`);
            await updateDoc(doc(db, 'pages', childSnap.docs[0].id), {
                parentId: parentDoc.id,
                level: 1,
                showInSidebar: true,
                isActive: true,
                updatedAt: serverTimestamp()
            });
        }
    }

    console.log('Seeding other standard submenus...');
    await addSubMenu('/dashboard/patients', 'Add Patient', '/dashboard/new-patient', 'IoPersonAddOutline');
    await addSubMenu('/dashboard/front-office', 'Manage Visitors', '/dashboard/front-office/manage-visitors', 'IoPeopleOutline');
    await addSubMenu('/dashboard/front-office', 'Call Logs', '/dashboard/front-office/call-logs', 'IoCallOutline');

    console.log('Done!');
    process.exit(0);
}

seedSubMenus().catch(console.error);
