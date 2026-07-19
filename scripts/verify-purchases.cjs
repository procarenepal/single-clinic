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

function formatDate(timestamp) {
  if (!timestamp) return "N/A";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function verifyPurchases() {
  const purchasesSnap = await getDocs(collection(db, "supplier_purchase_records"));
  const purchases = purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Total purchase records in db: ${purchases.length}`);

  const byDate = {};
  purchases.forEach(p => {
    // Purchase records usually have a purchaseDate or createdAt
    const dateStr = formatDate(p.purchaseDate || p.createdAt);
    byDate[dateStr] = byDate[dateStr] || { count: 0, netAmount: 0, totalAmount: 0 };
    byDate[dateStr].count += 1;
    byDate[dateStr].netAmount += p.netAmount || 0;
    byDate[dateStr].totalAmount += p.totalAmount || 0;
  });

  console.log("\nPurchases by Date:");
  Object.keys(byDate).forEach(d => {
    console.log(`Date: ${d} | Count: ${byDate[d].count} | NetAmount: NPR ${byDate[d].netAmount.toLocaleString()} | TotalAmount: NPR ${byDate[d].totalAmount.toLocaleString()}`);
  });

  process.exit(0);
}

verifyPurchases().catch(err => {
  console.error(err);
  process.exit(1);
});
