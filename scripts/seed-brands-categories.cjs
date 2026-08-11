const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
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

const CLINIC_ID = 'default';
const BRANCH_ID = 'default_branch';

const mockBrands = [
  { name: 'Pfizer', manufacturer: 'Pfizer Inc.', description: 'Global pharmaceutical company', isActive: true },
  { name: 'GSK', manufacturer: 'GlaxoSmithKline', description: 'British multinational pharmaceutical company', isActive: true },
  { name: 'Novartis', manufacturer: 'Novartis AG', description: 'Swiss multinational pharmaceutical company', isActive: true },
  { name: 'Cipla', manufacturer: 'Cipla Ltd.', description: 'Indian multinational pharmaceutical company', isActive: true },
  { name: 'Sun Pharma', manufacturer: 'Sun Pharmaceutical Industries Ltd.', description: 'Indian multinational pharmaceutical company', isActive: true },
];

const mockCategories = [
  { name: 'Antibiotics', description: 'Medicines used to treat bacterial infections', isActive: true },
  { name: 'Painkillers', description: 'Analgesics used to relieve pain', isActive: true },
  { name: 'Vitamins & Supplements', description: 'Nutritional supplements', isActive: true },
  { name: 'Antacids', description: 'Medicines that neutralize stomach acid', isActive: true },
  { name: 'Antihistamines', description: 'Medicines often used to relieve symptoms of allergies', isActive: true },
];

(async () => {
  try {
    console.log(`Seeding ${mockBrands.length} brands...`);
    const brandsRef = collection(db, 'medicineBrands');
    for (const brand of mockBrands) {
      await addDoc(brandsRef, {
        ...brand,
        clinicId: CLINIC_ID,
        branchId: BRANCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'system_seed'
      });
      console.log(`Created brand: ${brand.name}`);
    }

    console.log(`Seeding ${mockCategories.length} categories...`);
    const categoriesRef = collection(db, 'medicineCategories');
    for (const category of mockCategories) {
      await addDoc(categoriesRef, {
        ...category,
        clinicId: CLINIC_ID,
        branchId: BRANCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'system_seed'
      });
      console.log(`Created category: ${category.name}`);
    }
    
    console.log('✅ Successfully seeded brands and categories to Firestore!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
})();
