/**
 * Seed 30 Dummy Medicines Script
 * Usage: node scripts/seed-medicines.cjs
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp, getDocs, limit, query } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

const MEDICINES = [
  { name: 'Paracetamol', genericName: 'Acetaminophen', type: 'Tablet', strength: '500mg', mrp: 20 },
  { name: 'Amoxicillin', genericName: 'Amoxicillin', type: 'Capsule', strength: '250mg', mrp: 50 },
  { name: 'Ibuprofen', genericName: 'Ibuprofen', type: 'Tablet', strength: '400mg', mrp: 30 },
  { name: 'Cetirizine', genericName: 'Cetirizine', type: 'Tablet', strength: '10mg', mrp: 15 },
  { name: 'Azithromycin', genericName: 'Azithromycin', type: 'Tablet', strength: '500mg', mrp: 120 },
  { name: 'Pantoprazole', genericName: 'Pantoprazole', type: 'Tablet', strength: '40mg', mrp: 60 },
  { name: 'Omeprazole', genericName: 'Omeprazole', type: 'Capsule', strength: '20mg', mrp: 40 },
  { name: 'Metformin', genericName: 'Metformin', type: 'Tablet', strength: '500mg', mrp: 35 },
  { name: 'Amlodipine', genericName: 'Amlodipine', type: 'Tablet', strength: '5mg', mrp: 25 },
  { name: 'Losartan', genericName: 'Losartan', type: 'Tablet', strength: '50mg', mrp: 45 },
  { name: 'Atorvastatin', genericName: 'Atorvastatin', type: 'Tablet', strength: '10mg', mrp: 80 },
  { name: 'Aspirin', genericName: 'Acetylsalicylic acid', type: 'Tablet', strength: '75mg', mrp: 10 },
  { name: 'Diclofenac', genericName: 'Diclofenac', type: 'Gel', strength: '1%', mrp: 90 },
  { name: 'Salbutamol', genericName: 'Albuterol', type: 'Inhaler', strength: '100mcg', mrp: 250 },
  { name: 'Ciprofloxacin', genericName: 'Ciprofloxacin', type: 'Tablet', strength: '500mg', mrp: 65 },
  { name: 'Levocetirizine', genericName: 'Levocetirizine', type: 'Tablet', strength: '5mg', mrp: 20 },
  { name: 'Ranitidine', genericName: 'Ranitidine', type: 'Tablet', strength: '150mg', mrp: 18 },
  { name: 'Domperidone', genericName: 'Domperidone', type: 'Tablet', strength: '10mg', mrp: 22 },
  { name: 'Ondansetron', genericName: 'Ondansetron', type: 'Tablet', strength: '4mg', mrp: 38 },
  { name: 'Tramadol', genericName: 'Tramadol', type: 'Capsule', strength: '50mg', mrp: 48 },
  { name: 'Pregabalin', genericName: 'Pregabalin', type: 'Capsule', strength: '75mg', mrp: 110 },
  { name: 'Gabapentin', genericName: 'Gabapentin', type: 'Tablet', strength: '300mg', mrp: 95 },
  { name: 'Montelukast', genericName: 'Montelukast', type: 'Tablet', strength: '10mg', mrp: 85 },
  { name: 'Ceftriaxone', genericName: 'Ceftriaxone', type: 'Injection', strength: '1g', mrp: 150 },
  { name: 'Dexamethasone', genericName: 'Dexamethasone', type: 'Tablet', strength: '4mg', mrp: 12 },
  { name: 'Prednisolone', genericName: 'Prednisolone', type: 'Tablet', strength: '5mg', mrp: 14 },
  { name: 'Hydrocortisone', genericName: 'Hydrocortisone', type: 'Cream', strength: '1%', mrp: 45 },
  { name: 'Clotrimazole', genericName: 'Clotrimazole', type: 'Cream', strength: '1%', mrp: 55 },
  { name: 'Miconazole', genericName: 'Miconazole', type: 'Ointment', strength: '2%', mrp: 65 },
  { name: 'Fexofenadine', genericName: 'Fexofenadine', type: 'Tablet', strength: '120mg', mrp: 40 },
];

async function seedMedicines() {
  console.log('Seeding 30 medicines...');

  try {
    // 1. Get a clinic ID
    const clinicsSnap = await getDocs(query(collection(db, 'clinics'), limit(1)));
    if (clinicsSnap.empty) {
      console.error('No clinics found. Please seed a clinic first.');
      process.exit(1);
    }
    const clinicId = clinicsSnap.docs[0].id;
    console.log(`Using Clinic ID: ${clinicId}`);

    // 2. Add medicines
    const medicinesRef = collection(db, 'medicines');
    
    let addedCount = 0;
    for (const med of MEDICINES) {
      await addDoc(medicinesRef, {
        name: med.name,
        genericName: med.genericName,
        type: med.type,
        strength: med.strength,
        mrp: med.mrp,
        clinicId: clinicId,
        isActive: true,
        stock: Math.floor(Math.random() * 100) + 10,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addedCount++;
    }

    console.log(`\n✅ Successfully seeded ${addedCount} medicines to Firestore!`);
  } catch (err) {
    console.error('\n❌ Error seeding medicines:', err);
    process.exit(1);
  }

  process.exit(0);
}

seedMedicines();
