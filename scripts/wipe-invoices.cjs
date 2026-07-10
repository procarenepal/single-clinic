require('dotenv').config();
const admin = require('firebase-admin');

let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
} catch (error) {
  console.error('Error parsing service account JSON:', error);
  process.exit(1);
}

if (!serviceAccount) {
  console.error('No service account found in environment variables.');
  process.exit(1);
}

const adminApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`
});

const db = admin.firestore();

async function wipeInvoicesAndCommissions() {
  console.log('Starting deletion of invoices and commissions...');

  const collectionsToDelete = [
    'appointment_billing',
    'pathology_billing',
    'doctorCommissions',
    'expertCommissions',
    'referralCommissions',
    'staffCommissions'
  ];

  for (const collectionName of collectionsToDelete) {
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) {
      console.log(`Collection ${collectionName} is empty. Skipping.`);
      continue;
    }

    const batch = db.batch();
    let count = 0;
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });
    
    await batch.commit();
    console.log(`Deleted ${count} documents from ${collectionName}.`);
  }

  // Update appointments to unlink billing
  console.log('Resetting appointments billing references...');
  const appointmentsSnapshot = await db.collection('appointments').get();
  
  const appointmentUpdates = [];
  appointmentsSnapshot.forEach((doc) => {
    const data = doc.data();
    let needsUpdate = false;
    const updates = {};
    
    if (data.billingId) {
      updates.billingId = admin.firestore.FieldValue.delete();
      needsUpdate = true;
    }
    if (data.consultationBillingId) {
      updates.consultationBillingId = admin.firestore.FieldValue.delete();
      needsUpdate = true;
    }
    if (data.billingStatus && data.billingStatus !== 'unpaid') {
      updates.billingStatus = 'unpaid';
      needsUpdate = true;
    }
    if (data.consultationBillingStatus && data.consultationBillingStatus !== 'unpaid') {
      updates.consultationBillingStatus = 'unpaid';
      needsUpdate = true;
    }
    if (data.paymentStatus && data.paymentStatus !== 'unpaid') {
      updates.paymentStatus = 'unpaid';
      needsUpdate = true;
    }
    
    // Also if status was completed and it was only marked completed due to billing, we might want to revert, 
    // but reverting status to 'scheduled' or 'billing' is safe?
    // The instructions say "delete all invoices and linked commissions...". Let's just unlink.
    
    if (needsUpdate) {
      appointmentUpdates.push({ ref: doc.ref, updates });
    }
  });

  if (appointmentUpdates.length > 0) {
    // Firestore batches support up to 500 operations
    const batches = [];
    let currentBatch = db.batch();
    let count = 0;

    for (const { ref, updates } of appointmentUpdates) {
      currentBatch.update(ref, updates);
      count++;
      
      if (count === 500) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        count = 0;
      }
    }
    
    if (count > 0) {
      batches.push(currentBatch.commit());
    }
    
    await Promise.all(batches);
    console.log(`Reset billing information for ${appointmentUpdates.length} appointments.`);
  } else {
    console.log('No appointments needed billing reset.');
  }

  console.log('Finished!');
  process.exit(0);
}

wipeInvoicesAndCommissions().catch(err => {
  console.error('Error during wipe:', err);
  process.exit(1);
});
