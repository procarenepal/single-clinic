const dotenv = require('dotenv');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportData() {
  const medicinesSnap = await getDocs(collection(db, "medicines"));
  const medicines = medicinesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const stockSnap = await getDocs(collection(db, "medicineStock"));
  const stockItems = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const rows = [];
  let totalCost = 0;
  let totalQty = 0;

  stockItems.forEach(s => {
    const med = medicines.find(m => m.id === s.medicineId);
    if (!med) return;
    const cp = s.costPrice ?? med.costPrice ?? 0;
    const qty = s.currentStock || 0;
    const val = qty * cp;
    if (qty > 0) {
      rows.push({
        name: med.name,
        qty: qty,
        cp: cp,
        total: val
      });
      totalCost += val;
      totalQty += qty;
    }
  });

  // Sort rows alphabetically
  rows.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Number of items: ${rows.length}`);
  console.log(`Total Quantity: ${totalQty}`);
  console.log(`Calculated Total Cost: NPR ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // Print first 5 items as a sample
  console.log("\nSample items (First 5):");
  rows.slice(0, 5).forEach(r => {
    console.log(`- ${r.name}: Qty ${r.qty} * CP ${r.cp} = NPR ${r.total.toFixed(2)}`);
  });

  process.exit(0);
}

exportData().catch(err => {
  console.error(err);
  process.exit(1);
});
