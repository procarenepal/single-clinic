const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, Timestamp } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});

const db = getFirestore(app);

const IDS_TO_RESTORE = [
  '7O3Dvb5YMQ3dSjtpIxdg',
  'HG5AQBjpQvdc9AQGTzLd',
  'OK9HYNC0RhSoL4hJaNhP',
  'VmYy4kujrdIWaJhvj24p',
  'eJ7wHIhZhoogVNf1oFkX',
  'fU5TMgs73dYk2n8exE82',
  'rRl3vcg6ClryChyWUmnm',
];

function toTimestampSafe(val) {
  if (!val) return Timestamp.now();
  if (val._seconds !== undefined) return new Timestamp(val._seconds, val._nanoseconds || 0);
  const d = new Date(val);
  return isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
}

(async () => {
  try {
    const allPatients = require('./patients.json');
    const arr = Array.isArray(allPatients) ? allPatients : Object.values(allPatients);
    const toRestore = arr.filter(p => IDS_TO_RESTORE.includes(p.id));

    console.log(`\nRestoring ${toRestore.length} patient(s)...\n`);

    for (const patient of toRestore) {
      const { id, ...data } = patient;

      // Convert date fields to Firestore Timestamps
      const cleaned = { ...data };
      if (cleaned.createdAt) cleaned.createdAt = toTimestampSafe(cleaned.createdAt);
      if (cleaned.updatedAt) cleaned.updatedAt = toTimestampSafe(cleaned.updatedAt);
      if (cleaned.dateOfBirth) cleaned.dateOfBirth = toTimestampSafe(cleaned.dateOfBirth);

      // Remove the assignedExpertId and doctorId so they are clean (unassigned)
      delete cleaned.assignedExpertId;
      delete cleaned.doctorId;

      await setDoc(doc(db, 'patients', id), cleaned);
      console.log(`  ✓ Restored: ${data.name || 'Unknown'} (${id})`);
    }

    console.log(`\n✅ Done! Restored ${toRestore.length} patient(s) without doctor/expert assignment.`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
