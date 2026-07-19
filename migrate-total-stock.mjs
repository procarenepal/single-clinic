import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

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

async function migrateTotalStock() {
  console.log("Starting totalStock migration...");

  try {
    // 1. Fetch all medicines
    const medicinesSnap = await getDocs(collection(db, "medicines"));
    console.log(`Found ${medicinesSnap.size} medicines. Processing...`);

    // 2. Fetch all stock
    const stockSnap = await getDocs(collection(db, "medicineStock"));
    console.log(`Found ${stockSnap.size} stock batches.`);

    // 3. Aggregate stock by medicine ID
    const stockTotals = {};
    stockSnap.docs.forEach(doc => {
      const data = doc.data();
      const medId = data.medicineId;
      if (!medId) return;

      const current = data.currentStock || 0;
      const scheme = data.schemeStock || 0;

      if (!stockTotals[medId]) stockTotals[medId] = { current: 0, scheme: 0 };
      stockTotals[medId].current += current;
      stockTotals[medId].scheme += scheme;
    });

    // 4. Update all medicines
    let updatedCount = 0;
    for (const medDoc of medicinesSnap.docs) {
      const medId = medDoc.id;
      const totals = stockTotals[medId] || { current: 0, scheme: 0 };

      await updateDoc(doc(db, "medicines", medId), {
        totalStock: totals.current,
        totalSchemeStock: totals.scheme
      });

      updatedCount++;
      if (updatedCount % 50 === 0) {
        console.log(`Updated ${updatedCount}/${medicinesSnap.size} medicines...`);
      }
    }

    console.log("Migration complete! All medicines now have totalStock fields.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateTotalStock();
