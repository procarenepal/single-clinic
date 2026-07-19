/**
 * fix-appointment-types.mjs
 * Uses the Firebase JS SDK (already installed) - no service account needed.
 * Run: node fix-appointment-types.mjs
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyAWW5VnsL26DX4nHQeAMYJlG0IEoBwDgFs",
  authDomain:        "skincare-hospital.firebaseapp.com",
  projectId:         "skincare-hospital",
  storageBucket:     "skincare-hospital.firebasestorage.app",
  messagingSenderId: "212424949715",
  appId:             "1:212424949715:web:65d31a53959dc175387926",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── The EXACT names required in Firestore ────────────────────────────────────
const REQUIRED = [
  { name: "Manual facial with kit",                        price: 2000  },
  { name: "Candela Gentle Max Pro-Bikini/Brazilian Area",   price: 8000  },
  { name: "(PDRN Salmon) DNA Pep, Hyalu",                  price: 15000 },
];

// ── Known bad/typo variants to delete ────────────────────────────────────────
const DELETE_NAMES = [
  "Candela Gentle Max Pro-Bikini/Brazillian Area",
  "Candela Gentle Max Pro-Bikini/Brazil Area",
  "(PDRN Salmon) DNA Pep Hyalu",
  "PDRN Salmon DNA Pep, Hyalu",
  "Manual Facial With Kit",
];

async function run() {
  const col = collection(db, "appointment_types");
  const snap = await getDocs(col);

  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`\n=== Found ${all.length} appointment types ===`);
  all.forEach(t =>
    console.log(`  [${t.id}]  "${t.name}"  price=${t.price}  clinicId=${t.clinicId ?? "-"}`)
  );

  // Delete bad names
  console.log("\n🗑️  Deleting wrong-named variants...");
  for (const badName of DELETE_NAMES) {
    const found = all.filter(t => t.name === badName);
    for (const t of found) {
      await deleteDoc(doc(db, "appointment_types", t.id));
      console.log(`   Deleted: "${badName}" (${t.id})`);
    }
    if (!found.length) console.log(`   Not found (OK): "${badName}"`);
  }

  // Seed missing
  console.log("\n➕ Checking required types...");
  // Use clinicId from first existing doc (or fallback)
  const firstDoc = all.find(t => t.clinicId);
  const CLINIC_ID = firstDoc?.clinicId ?? "standalone";
  console.log(`   Using clinicId = "${CLINIC_ID}"\n`);

  for (const req of REQUIRED) {
    const existing = all.find(t => t.name === req.name);
    if (existing) {
      console.log(`   ✅ Already exists: "${req.name}"`);
    } else {
      const ref = await addDoc(col, {
        name:               req.name,
        price:              req.price,
        color:              "none",
        isActive:           true,
        clinicId:           CLINIC_ID,
        billAtFrontDesk:    false,
        calculateCommission: true,
        createdAt:          new Date(),
        updatedAt:          new Date(),
      });
      console.log(`   ✅ Created: "${req.name}"  →  id=${ref.id}`);
    }
  }

  console.log("\n✅ Done! Hard-refresh the browser (Ctrl+Shift+R) to see changes.\n");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
