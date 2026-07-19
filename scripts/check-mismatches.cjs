const fs = require('fs');
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

async function checkMismatches() {
  console.log("Fetching collections...");
  const medicinesSnap = await getDocs(collection(db, "medicines"));
  const medicines = medicinesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const stockSnap = await getDocs(collection(db, "medicineStock"));
  const stockItems = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const txSnap = await getDocs(collection(db, "stockTransactions"));
  const txItems = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`\n--- Stats ---`);
  console.log(`Medicines: ${medicines.length}`);
  console.log(`Stock Entries: ${stockItems.length}`);
  console.log(`Transactions: ${txItems.length}`);

  // 1. Check stock entries with missing medicines
  console.log(`\n--- Stock Entries with Missing Medicine Document ---`);
  const missingMeds = [];
  stockItems.forEach(s => {
    const med = medicines.find(m => m.id === s.medicineId);
    if (!med) {
      console.log(`Stock Entry ID: ${s.id} | Medicine ID: ${s.medicineId} | Batch: ${s.batchNumber} | Qty: ${s.currentStock}`);
      missingMeds.push(s);
    }
  });
  if (missingMeds.length === 0) console.log("None found!");

  // 2. Check medicines without any stock entries
  console.log(`\n--- Medicines with no stock entries ---`);
  let noStockCount = 0;
  medicines.forEach(m => {
    const stock = stockItems.filter(s => s.medicineId === m.id);
    if (stock.length === 0) {
      console.log(`Medicine: ${m.name} (${m.id})`);
      noStockCount++;
    }
  });
  if (noStockCount === 0) console.log("None found!");

  // 3. Find items where currentStock does not match sum of transactions
  console.log(`\n--- Checking Transaction Totals vs Current Stock ---`);
  let totalMismatches = 0;
  stockItems.forEach(s => {
    const med = medicines.find(m => m.id === s.medicineId);
    if (!med) return;
    
    // filter transactions
    const relatedTxs = txItems.filter(t => t.medicineId === s.medicineId && t.batchNumber === s.batchNumber);
    let calculated = 0;
    relatedTxs.forEach(t => {
      const type = (t.type || t.transactionType || '').toLowerCase();
      const qty = Number(t.quantity) || 0;
      if (type === 'in' || type === 'purchase' || type === 'stock_in' || type === 'opening_stock') {
        calculated += qty;
      } else if (type === 'out' || type === 'sale' || type === 'stock_out') {
        calculated -= qty;
      }
    });
    
    if (calculated !== s.currentStock) {
      console.log(`Mismatch - Med: ${med.name} | Batch: ${s.batchNumber} | DB Stock: ${s.currentStock} | Calculated from Txs: ${calculated} (Diff: ${s.currentStock - calculated})`);
      totalMismatches++;
    }
  });
  console.log(`Total mismatches: ${totalMismatches}`);

  process.exit(0);
}

checkMismatches().catch(err => {
  console.error(err);
  process.exit(1);
});
