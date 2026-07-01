const admin = require("firebase-admin");
const fs = require("fs");

// 1. Check for service account key
const SERVICE_ACCOUNT_PATH = "./serviceAccountKey.json";

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "ERROR: serviceAccountKey.json not found in the root directory!"
  );
  console.error("Please download it from Firebase Console:");
  console.error("Project Settings -> Service Accounts -> Generate new private key");
  console.error("Save it as 'serviceAccountKey.json' in the procaresoft-main folder.");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

// 2. Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 3. Define collections to nuke
// Add or remove collection names here as needed
const COLLECTIONS_TO_CLEAR = [
  "patients",
  "appointments",
  "prescriptions",
  "billing",
  "appointmentBilling",
  "medicinePurchases",
  "pathology_requests",
  "call_logs",
  "visitors",
  "enquiries",
];

async function deleteCollection(collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack if you have a huge number
  // of documents.
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function runCleaner() {
  console.log("Starting database cleanup...");
  console.log("Warning: This will permanently delete data in the following collections:");
  console.log(COLLECTIONS_TO_CLEAR.join(", "));
  console.log("--------------------------------------------------");

  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    console.log(`Clearing collection: ${collectionName}...`);
    try {
      await deleteCollection(collectionName);
      console.log(`✅ Cleared ${collectionName}`);
    } catch (error) {
      console.error(`❌ Failed to clear ${collectionName}:`, error);
    }
  }

  console.log("--------------------------------------------------");
  console.log("Cleanup complete! Your database is now fresh.");
  process.exit(0);
}

runCleaner();
