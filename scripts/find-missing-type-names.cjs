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
  const missingIds = [
    '7AWd2CvsvnTXI8VouDSe',
    '0RkOVCnoZRZA0vy4BwFP',
    'oB5m97FSgL8UoIRpbSIg',
    'v8PHY9u2SFyfc1xUAZ7z',
    'R9BArxbezaMhrsuYhnmL',
    'YC9zxKIgk45hdGM46uiS',
    'Es8XQLXPN2ZXGNgPyFce',
    'VHqRRus7PLLu6AdvBrce'
  ];

  console.log('Querying billings to find names for missing appointment type IDs...');
  const billingSnap = await getDocs(query(collection(db, 'appointmentBilling'), where('clinicId', '==', CLINIC_ID)));
  console.log(`Found ${billingSnap.size} billing records.`);

  const idNames = {};
  billingSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach(item => {
        if (missingIds.includes(item.appointmentTypeId)) {
          idNames[item.appointmentTypeId] = item.appointmentTypeName || item.name;
        }
      });
    }
  });

  console.log('\nResults from appointmentBilling items:');
  missingIds.forEach(id => {
    console.log(`- ID: ${id} | Name in billing: ${idNames[id] || 'NOT FOUND'}`);
  });

  // Let's also check if there's any other billing collection, like consultationBilling
  const consultSnap = await getDocs(query(collection(db, 'consultationBilling'), where('clinicId', '==', CLINIC_ID)));
  console.log(`\nFound ${consultSnap.size} consultationBilling records.`);
  consultSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach(item => {
        if (missingIds.includes(item.appointmentTypeId)) {
          idNames[item.appointmentTypeId] = item.appointmentTypeName || item.name;
        }
      });
    }
    // Also check if consultationBilling itself maps doctor/expert consults
    if (data.appointmentTypeId && missingIds.includes(data.appointmentTypeId)) {
      idNames[data.appointmentTypeId] = data.appointmentTypeName || data.name || 'Doctor Consultation';
    }
  });

  console.log('\nUpdated Results with consultationBilling:');
  missingIds.forEach(id => {
    console.log(`- ID: ${id} | Name: ${idNames[id] || 'NOT FOUND'}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
