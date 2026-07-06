const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, query, where } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});

const db = getFirestore(app);
const CLINIC_ID = 'default';

(async () => {
  try {
    console.log(`\nFetching patients assigned to doctors/experts in clinic: ${CLINIC_ID}...\n`);

    // Fetch all patients for the clinic
    const q = query(collection(db, 'patients'), where('clinicId', '==', CLINIC_ID));
    const snap = await getDocs(q);

    if (snap.empty) {
      console.log('No patients found.');
      process.exit(0);
    }

    // Filter only those assigned to a doctor or expert
    const assigned = snap.docs.filter(docSnap => {
      const data = docSnap.data();
      return data.doctorId || data.assignedExpertId;
    });

    if (assigned.length === 0) {
      console.log(`Found ${snap.size} patient(s) total, but none are assigned to a doctor or expert.`);
      process.exit(0);
    }

    console.log(`Found ${snap.size} patient(s) total. ${assigned.length} are assigned to a doctor or expert.\n`);

    let deleted = 0;
    for (const docSnap of assigned) {
      const data = docSnap.data();
      const assignedTo = [
        data.doctorId ? `Doctor: ${data.doctorId}` : null,
        data.assignedExpertId ? `Expert: ${data.assignedExpertId}` : null,
      ].filter(Boolean).join(', ');

      await deleteDoc(doc(db, 'patients', docSnap.id));
      deleted++;
      console.log(`  ✓ Deleted patient: ${data.name || 'Unknown'} (${docSnap.id}) [${assignedTo}]`);
    }

    console.log(`\n✅ Done! Deleted ${deleted} patient(s) assigned to doctors/experts.`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
