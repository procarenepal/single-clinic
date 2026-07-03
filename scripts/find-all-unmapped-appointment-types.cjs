const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
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

const CLINIC_ID = 'default';

async function run() {
  console.log('Loading all appointment types...');
  const typeSnap = await getDocs(query(collection(db, 'appointment_types'), where('clinicId', '==', CLINIC_ID)));
  const typeMap = {};
  typeSnap.docs.forEach(doc => {
    typeMap[doc.id] = doc.data().name;
  });
  console.log(`Loaded ${typeSnap.size} appointment types.`);

  console.log('Loading appointments...');
  const appSnap = await getDocs(query(collection(db, 'appointments'), where('clinicId', '==', CLINIC_ID)));
  console.log(`Loaded ${appSnap.size} appointments.`);

  const unmapped = {};
  appSnap.docs.forEach(doc => {
    const data = doc.data();
    const typeId = data.appointmentTypeId;
    if (typeId && !typeMap[typeId]) {
      if (!unmapped[typeId]) {
        unmapped[typeId] = {
          count: 0,
          appointmentTypeField: new Set(),
          sampleDates: []
        };
      }
      unmapped[typeId].count++;
      if (data.appointmentType) {
        unmapped[typeId].appointmentTypeField.add(data.appointmentType);
      }
      if (unmapped[typeId].sampleDates.length < 3) {
        unmapped[typeId].sampleDates.push(data.appointmentDate?.toDate?.() || data.appointmentDate);
      }
    }
  });

  console.log('\nUnmapped appointmentTypeId count and names in appointments:');
  for (const [id, info] of Object.entries(unmapped)) {
    console.log(`- ID: ${id} | Count: ${info.count} | Field values: ${Array.from(info.appointmentTypeField).join(', ')} | Samples: ${info.sampleDates.join(', ')}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
