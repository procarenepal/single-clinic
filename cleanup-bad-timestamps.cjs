const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } = require('firebase/firestore');
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

async function cleanup() {
  try {
    const collectionsToSeed = [
      'pathologyCategories',
      'pathologyParameters',
      'pathologyTestTemplates',
      'pathologyUnits',
      'pathologyTestTypes'
    ];

    let batch = writeBatch(db);
    let operationCount = 0;
    let totalDeleted = 0;

    for (const colName of collectionsToSeed) {
      const snapshot = await getDocs(collection(db, colName));
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.clinicId === TARGET_CLINIC_ID) {
          // Check if createdAt is a plain object or doesn't have toDate
          if (data.createdAt && typeof data.createdAt.toDate !== 'function') {
            console.log(`Deleting ${colName} document ${docSnap.id} with bad timestamp...`);
            batch.delete(doc(db, colName, docSnap.id));
            operationCount++;
            totalDeleted++;
          }
        }
        
        if (operationCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`Successfully deleted ${totalDeleted} documents with bad timestamps.`);
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning up data:', error);
    process.exit(1);
  }
}

cleanup();
