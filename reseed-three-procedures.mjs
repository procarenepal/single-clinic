/**
 * reseed-three-procedures.mjs
 * Deletes and re-creates the three procedure types from Firestore.
 * Run: node reseed-three-procedures.mjs
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAWW5VnsL26DX4nHQeAMYJlG0IEoBwDgFs",
  authDomain: "skincare-hospital.firebaseapp.com",
  projectId: "skincare-hospital",
  storageBucket: "skincare-hospital.firebasestorage.app",
  messagingSenderId: "212424949715",
  appId: "1:212424949715:web:65d31a53959dc175387926",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// These are the EXACT names to delete and re-seed
const TARGETS = [
  { name: "Manual facial with kit", price: 3500 },
  { name: "Candela Gentle Max Pro-Bikini/Brazilian Area", price: 8000 },
  { name: "(PDRN Salmon) DNA Pep, Hyalu", price: 15000 },
];

async function run() {
  const col = collection(db, "appointment_types");
  const snap = await getDocs(col);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Detect clinicId from existing records
  const firstWithClinic = all.find(t => t.clinicId);
  const CLINIC_ID = firstWithClinic?.clinicId ?? "standalone";
  console.log(`Using clinicId = "${CLINIC_ID}"\n`);

  for (const target of TARGETS) {
    // Find ALL docs with this exact name
    const matches = all.filter(t => t.name === target.name);

    if (matches.length > 0) {
      for (const m of matches) {
        console.log(`🗑️  Deleting "${m.name}" (id=${m.id}, isActive=${m.isActive}, price=${m.price})`);
        await deleteDoc(doc(db, "appointment_types", m.id));
        console.log(`   ✅ Deleted`);
      }
    } else {
      console.log(`ℹ️  "${target.name}" not found — will create fresh`);
    }

    // Re-create fresh
    const ref = await addDoc(col, {
      name: target.name,
      price: target.price,
      color: "none",
      isActive: true,
      clinicId: CLINIC_ID,
      billAtFrontDesk: false,
      calculateCommission: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`➕ Re-created: "${target.name}" → id=${ref.id}\n`);
  }

  // Final verification — list all with these names
  console.log("=== Final verification ===");
  const snap2 = await getDocs(col);
  const all2 = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
  for (const target of TARGETS) {
    const found = all2.filter(t => t.name === target.name);
    if (found.length === 0) {
      console.log(`❌ MISSING: "${target.name}"`);
    } else {
      found.forEach(f => console.log(`✅ "${f.name}"  id=${f.id}  isActive=${f.isActive}  price=${f.price}`));
    }
  }

  console.log("\n✅ Done! Hard-refresh browser (Ctrl+Shift+R) to reload appointment types.\n");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
