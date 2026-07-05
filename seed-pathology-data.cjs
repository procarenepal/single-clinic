const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, writeBatch, Timestamp } = require('firebase/firestore');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

const TARGET_CLINIC_ID = 'default';

function convertTimestamps(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  // Check if it's our JSON representation of a Firestore Timestamp
  if (obj.type === 'firestore/timestamp/1.0' && 'seconds' in obj && 'nanoseconds' in obj) {
    return new Timestamp(obj.seconds, obj.nanoseconds);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertTimestamps);
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertTimestamps(value);
  }
  return result;
}

async function seedData() {
  try {
    const rawData = fs.readFileSync('pathology.json', 'utf8');
    const data = JSON.parse(rawData);

    const collectionsToSeed = [
      'pathologyCategories',
      'pathologyParameters',
      'pathologyTestTemplates',
      'pathologyUnits',
      'pathologyTestTypes'
    ];

    let batch = writeBatch(db);
    let operationCount = 0;
    let totalOperations = 0;

    for (const colName of collectionsToSeed) {
      if (!data[colName] || !Array.isArray(data[colName])) {
        console.log(`Skipping ${colName} - not found or not an array`);
        continue;
      }

      console.log(`Seeding ${data[colName].length} documents for ${colName}...`);

      for (const item of data[colName]) {
        // First convert timestamps properly
        const convertedItem = convertTimestamps(item);
        
        const seedItem = { ...convertedItem, clinicId: TARGET_CLINIC_ID };
        if (seedItem.branchId) seedItem.branchId = TARGET_CLINIC_ID;

        let docRef;
        if (item.id) {
          docRef = doc(db, colName, item.id);
        } else {
          docRef = doc(collection(db, colName));
          seedItem.id = docRef.id;
        }

        batch.set(docRef, seedItem);
        operationCount++;
        totalOperations++;

        if (operationCount >= 400) {
          await batch.commit();
          console.log(`Committed ${operationCount} writes...`);
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      await batch.commit();
      console.log(`Committed remaining ${operationCount} writes...`);
    }

    console.log(`Successfully seeded ${totalOperations} total documents to clinic '${TARGET_CLINIC_ID}'.`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
