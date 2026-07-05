const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } = require('firebase/firestore');
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
    const collectionsToDelete = ['appointmentBilling', 'pathologyBilling'];
    let totalDeleted = 0;
    
    for (const colName of collectionsToDelete) {
      const snapshot = await getDocs(collection(db, colName));
      
      if (snapshot.empty) {
        console.log(`No invoices found in '${colName}'.`);
        continue;
      }

      console.log(`Found ${snapshot.size} invoices in '${colName}'. Proceeding to delete...`);
      
      const batch = writeBatch(db);
      let count = 0;
      
      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        
        if (count % 400 === 0) {
          console.log(`Committing batch of ${count} deletions for '${colName}'...`);
          await batch.commit();
        }
      }
      
      await batch.commit();
      console.log(`Successfully deleted all ${snapshot.size} invoices from '${colName}'.`);
      totalDeleted += snapshot.size;
    }
    
    console.log(`Successfully deleted a total of ${totalDeleted} invoices across all collections.`);
    process.exit(0);
  } catch (error) {
    console.error('Error deleting invoices:', error);
    process.exit(1);
  }
})();
