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

const missingInfo = {
  '7AWd2CvsvnTXI8VouDSe': 'Skin  Analyzer',
  '0RkOVCnoZRZA0vy4BwFP': 'Co2 Fractional Laser',
  'oB5m97FSgL8UoIRpbSIg': 'Doctor Consultation',
  'v8PHY9u2SFyfc1xUAZ7z': 'Hair Analyzer',
  'R9BArxbezaMhrsuYhnmL': 'TAATO REMOVAL-SMALL', // Note spelling: TAATO REMOVAL-SMALL
  'YC9zxKIgk45hdGM46uiS': 'Standard Hydra facial',
  'Es8XQLXPN2ZXGNgPyFce': 'UNKNOWN',
  'VHqRRus7PLLu6AdvBrce': 'Standard Hydra facial'
};

async function run() {
  console.log('Loading all local appointment types...');
  const typeSnap = await getDocs(query(collection(db, 'appointment_types'), where('clinicId', '==', CLINIC_ID)));
  const types = typeSnap.docs.map(d => ({ id: d.id, name: d.data().name.trim() }));
  console.log(`Loaded ${types.length} types.`);

  console.log('\nFinding matches for missing types:');
  for (const [missingId, missingName] of Object.entries(missingInfo)) {
    console.log(`\nMissing ID: ${missingId} | Name: "${missingName}"`);
    
    // Exact or case-insensitive match
    const cleanMissing = missingName.toLowerCase().replace(/\s+/g, ' ').trim();
    
    const matches = types.filter(t => {
      const cleanType = t.name.toLowerCase().replace(/\s+/g, ' ').trim();
      return cleanType.includes(cleanMissing) || cleanMissing.includes(cleanType);
    });

    if (matches.length > 0) {
      console.log('Matches found:');
      matches.forEach(m => console.log(`  - Target ID: ${m.id} | Target Name: "${m.name}"`));
    } else {
      console.log('No close matches found.');
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
