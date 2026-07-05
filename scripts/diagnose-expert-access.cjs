const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, getDoc } = require('firebase/firestore');
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

async function diagnose() {
  console.log('\n=== STEP 1: Check user_role_assignments ===');
  const assignSnap = await getDocs(query(
    collection(db, 'user_role_assignments'),
    where('userId', '==', AUTH_UID),
    where('clinicId', '==', CLINIC_ID)
  ));
  if (assignSnap.empty) {
    console.error('❌ NO role assignments found! This is the problem.');
    process.exit(1);
  }
  const assignments = [];
  assignSnap.forEach(d => {
    assignments.push(d.data());
    console.log('✅ Assignment:', JSON.stringify(d.data()));
  });

  console.log('\n=== STEP 2: Fetch role permissions ===');
  const allPermissions = new Set();
  for (const a of assignments) {
    const roleSnap = await getDoc(doc(db, 'roles', a.roleId));
    if (!roleSnap.exists()) {
      console.error('❌ Role not found:', a.roleId);
      continue;
    }
    const role = roleSnap.data();
    console.log(`Role "${role.name}" has ${role.permissions?.length || 0} permissions:`, role.permissions);
    (role.permissions || []).forEach(p => allPermissions.add(p));
  }

  console.log('\n=== STEP 3: Fetch all pages from pages collection ===');
  const pagesSnap = await getDocs(collection(db, 'pages'));
  const allPages = [];
  pagesSnap.forEach(d => allPages.push({ id: d.id, ...d.data() }));
  console.log(`Total pages in DB: ${allPages.length}`);

  console.log('\n=== STEP 4: Filter accessible pages ===');
  const accessible = allPages.filter(p => allPermissions.has(p.id));
  console.log(`\n✅ Accessible pages for expert user (${accessible.length}):`);
  accessible.forEach(p => console.log(`  - [${p.id}] ${p.path}`));

  if (accessible.length === 0) {
    console.error('\n❌ PROBLEM: The permission IDs in the role do NOT match any page IDs!');
    console.log('\nPermission IDs stored in role:', [...allPermissions]);
    console.log('\nSample page IDs from DB:', allPages.slice(0, 5).map(p => p.id));
  }

  process.exit(0);
}

diagnose().catch(e => { console.error(e); process.exit(1); });
