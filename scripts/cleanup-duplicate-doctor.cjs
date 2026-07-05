const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc, query, where, writeBatch } = require('firebase/firestore');
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
  const ROGUE_ROLE_ID = 'd0LoOZTFtG4YQjEE7CEy';
  const CORRECT_ROLE_ID = 'doctor';
  
  // Find all assignments with the rogue role
  const assignmentsQuery = query(collection(db, 'user_role_assignments'), where('roleId', '==', ROGUE_ROLE_ID));
  const assignmentsSnap = await getDocs(assignmentsQuery);
  
  if (!assignmentsSnap.empty) {
    console.log(`Found ${assignmentsSnap.size} users with the rogue role. Reassigning to correct Doctor role...`);
    
    // We do sequential updates to be safe
    
    // Wait, rbacService might not initialize easily in this pure node script because of imports.
    // Let's do it manually via Firestore batch.
    const batch = writeBatch(db);
    
    for (const docSnap of assignmentsSnap.docs) {
      const data = docSnap.data();
      // Add the correct role if they don't have it already
      const newRef = doc(collection(db, 'user_role_assignments'));
      batch.set(newRef, {
        userId: data.userId,
        roleId: CORRECT_ROLE_ID,
        clinicId: data.clinicId,
        assignedAt: new Date()
      });
      // Delete the old assignment
      batch.delete(docSnap.ref);
    }
    await batch.commit();
    console.log('Reassignment complete.');
  } else {
    console.log('No users were assigned to the rogue role.');
  }

  // Delete the rogue role
  await deleteDoc(doc(db, 'roles', ROGUE_ROLE_ID));
  console.log('Rogue role deleted successfully.');
  
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
