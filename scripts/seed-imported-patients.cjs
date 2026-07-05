const { initializeApp } = require('firebase/app');
const { getFirestore, doc, writeBatch, Timestamp } = require('firebase/firestore');
const fs = require('fs');
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

function convertTimestamp(val) {
  if (val && typeof val === 'object' && val.seconds !== undefined && val.nanoseconds !== undefined) {
    return new Timestamp(val.seconds, val.nanoseconds);
  }
  return val;
}

(async () => {
  try {
    const dataPath = path.resolve(__dirname, '../patients.json');
    if (!fs.existsSync(dataPath)) {
      console.error('Error: patients.json not found in the root directory!');
      process.exit(1);
    }
    
    console.log('Reading patients.json...');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const patients = JSON.parse(rawData);
    console.log(`Loaded ${patients.length} patients from JSON.`);

    const CLINIC_ID = 'default';
    let batch = writeBatch(db);
    let count = 0;
    let total = 0;

    for (const p of patients) {
      // Overwrite IDs to current single-tenant environment
      p.clinicId = CLINIC_ID;
      p.branchId = 'default';
      
      // Keep only personal data by removing references to the old clinic's staff/doctors
      delete p.doctorId;
      delete p.assignedExpertId;
      delete p.createdBy;
      delete p.referralPartnerId;
      
      // Convert nested Firestore timestamps back to actual Timestamp objects
      if (p.createdAt) p.createdAt = convertTimestamp(p.createdAt);
      if (p.updatedAt) p.updatedAt = convertTimestamp(p.updatedAt);
      if (p.dob) p.dob = convertTimestamp(p.dob);
      if (p.bsDate) p.bsDate = convertTimestamp(p.bsDate);
      
      const docId = p.id;
      delete p.id; // Document ID is set on the reference, not strictly needed in the body
      
      const docRef = doc(db, 'patients', docId);
      batch.set(docRef, p);
      count++;
      total++;

      // Commit batch every 500 operations (Firestore limit)
      if (count === 500) {
        await batch.commit();
        console.log(`Committed ${total} patients...`);
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`Committed remaining patients. Total seeded: ${total}`);
    }

    console.log('Patient data successfully seeded!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding patients:', err);
    process.exit(1);
  }
})();
