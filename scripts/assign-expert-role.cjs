const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, addDoc } = require('firebase/firestore');
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

const AUTH_UID = 'cL9S8kzL0Lf642K6fRZEF5LGAEp1';
const CLINIC_ID = 'default';

async function assignExpertRole() {
  // 1. Find the Expert role for this clinic
  console.log('Fetching roles for clinic:', CLINIC_ID);
  const rolesSnap = await getDocs(query(
    collection(db, 'roles'),
    where('clinicId', '==', CLINIC_ID)
  ));

  let expertRoleId = null;
  rolesSnap.forEach(d => {
    const data = d.data();
    console.log('  Found role:', d.id, '|', data.name, '| linkedToExpert:', data.linkedToExpert);
    if (data.linkedToExpert === true || data.name?.toLowerCase() === 'expert') {
      expertRoleId = d.id;
    }
  });

  if (!expertRoleId) {
    console.error('No Expert role found in clinic. Check roles collection.');
    process.exit(1);
  }

  console.log('Using Expert role ID:', expertRoleId);

  // 2. Check if assignment already exists
  const existingSnap = await getDocs(query(
    collection(db, 'user_role_assignments'),
    where('userId', '==', AUTH_UID),
    where('clinicId', '==', CLINIC_ID)
  ));

  if (!existingSnap.empty) {
    existingSnap.forEach(d => console.log('Existing assignment:', d.id, JSON.stringify(d.data())));
    console.log('Assignment already exists! Role may already be assigned.');
    process.exit(0);
  }

  // 3. Create the assignment
  const ref = await addDoc(collection(db, 'user_role_assignments'), {
    userId: AUTH_UID,
    roleId: expertRoleId,
    clinicId: CLINIC_ID,
    assignedAt: new Date(),
  });

  console.log('Role assignment created:', ref.id);
  console.log('Expert user is now assigned to the Expert cabin role!');
  process.exit(0);
}

assignExpertRole().catch(e => { console.error(e); process.exit(1); });
