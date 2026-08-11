const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch } = require('firebase/firestore');
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
  try {
    const colName = 'medicines';
    const snapshot = await getDocs(collection(db, colName));
    
    if (snapshot.empty) {
      console.log(`No documents found in '${colName}'.`);
      process.exit(0);
    }

    console.log(`Found ${snapshot.size} documents in '${colName}'. Proceeding to delete...`);
    
    const batch = writeBatch(db);
    let count = 0;
    
    for (const docSnap of snapshot.docs) {
      console.log(`Deleting medicine: ${docSnap.data().name} (${docSnap.id})`);
      batch.delete(docSnap.ref);
      count++;
      
      if (count % 400 === 0) {
        console.log(`Committing batch of ${count} deletions...`);
        await batch.commit();
        const newBatch = writeBatch(db);
      }
    }
    
    await batch.commit();
    console.log(`Successfully deleted all ${snapshot.size} documents from '${colName}'.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error deleting medicines:', error);
    process.exit(1);
  }
})();
