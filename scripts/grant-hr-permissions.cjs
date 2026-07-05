const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, query, where, updateDoc } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

(async () => {
  // 1. Ensure HR page exists in `pages` collection
  const pagesRef = collection(db, 'pages');
  const hrPageQuery = query(pagesRef, where('path', '==', '/dashboard/hr'));
  const hrPageSnap = await getDocs(hrPageQuery);
  
  let hrPageId;
  if (hrPageSnap.empty) {
    const newPageRef = doc(collection(db, 'pages'));
    hrPageId = newPageRef.id;
    await setDoc(newPageRef, {
      name: 'HR Management',
      path: '/dashboard/hr',
      description: 'Manage Staff, Attendance, Leaves, and Payroll',
      isActive: true,
      category: 'ADMINISTRATION & SETTINGS'
    });
    console.log('Created HR Management page in DB with ID:', hrPageId);
  } else {
    hrPageId = hrPageSnap.docs[0].id;
    console.log('HR Management page already exists with ID:', hrPageId);
  }

  // 2. Fetch all page IDs
  const allPagesSnap = await getDocs(pagesRef);
  const allPageIds = allPagesSnap.docs.map(d => d.id);
  console.log('Found', allPageIds.length, 'pages in the system.');

  // 3. Update the Human Resources role to have ALL permissions
  const rolesRef = collection(db, 'roles');
  const hrRoleQuery = query(rolesRef, where('name', '==', 'Human Resources'));
  const hrRoleSnap = await getDocs(hrRoleQuery);

  if (!hrRoleSnap.empty) {
    const hrRoleDoc = hrRoleSnap.docs[0];
    await updateDoc(hrRoleDoc.ref, {
      permissions: allPageIds
    });
    console.log('Updated Human Resources role to include all permissions!');
  } else {
    console.log('Human Resources role not found!');
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
