const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, getDoc } = require('firebase/firestore');
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
  console.log('Querying all appointments for clinic default...');
  const appSnap = await getDocs(query(collection(db, 'appointments'), where('clinicId', '==', CLINIC_ID)));
  console.log(`Total appointments found: ${appSnap.size}`);

  const typeCounts = {};
  appSnap.forEach(d => {
    const data = d.data();
    const typeId = data.appointmentTypeId || 'undefined';
    typeCounts[typeId] = (typeCounts[typeId] || 0) + 1;
  });

  console.log('\nAppointment Type ID Counts in Appointments collection:');
  for (const [typeId, count] of Object.entries(typeCounts)) {
    let name = 'UNKNOWN';
    if (typeId !== 'undefined') {
      const typeDoc = await getDoc(doc(db, 'appointment_types', typeId));
      if (typeDoc.exists()) {
        name = typeDoc.data().name;
      } else {
        name = 'DOES NOT EXIST IN appointment_types COLLECTION';
      }
    }
    console.log(`- Type ID: ${typeId} | Name: ${name} | Appointments Count: ${count}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
