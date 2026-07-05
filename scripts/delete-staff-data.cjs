const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, writeBatch } = require('firebase/firestore');
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
    const collectionsToDelete = [
      'staff_attendance',
      'leaveRequests',
      'leaveBalances',
      'staffCommissions'
    ];
    let totalDeleted = 0;
    
    for (const colName of collectionsToDelete) {
      const snapshot = await getDocs(collection(db, colName));
      
      if (snapshot.empty) {
        console.log(`No documents found in '${colName}'.`);
        continue;
      }

      console.log(`Found ${snapshot.size} documents in '${colName}'. Proceeding to delete...`);
      
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
      console.log(`Successfully deleted all ${snapshot.size} documents from '${colName}'.`);
      totalDeleted += snapshot.size;
    }
    
    // specifically delete payroll bills from account_bills
    const billsSnapshot = await getDocs(query(collection(db, 'account_bills'), where('category', '==', 'salary')));
    if (!billsSnapshot.empty) {
      console.log(`Found ${billsSnapshot.size} salary bills in 'account_bills'. Proceeding to delete...`);
      const batch = writeBatch(db);
      let count = 0;
      for (const docSnap of billsSnapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count % 400 === 0) {
          await batch.commit();
        }
      }
      await batch.commit();
      console.log(`Successfully deleted all ${billsSnapshot.size} salary bills.`);
      totalDeleted += billsSnapshot.size;
    } else {
      console.log(`No salary bills found in 'account_bills'.`);
    }

    console.log(`Successfully deleted a total of ${totalDeleted} staff-related documents across all collections.`);
    process.exit(0);
  } catch (error) {
    console.error('Error deleting staff data:', error);
    process.exit(1);
  }
})();
