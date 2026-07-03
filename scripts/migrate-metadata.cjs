const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  addDoc,
  updateDoc, 
  writeBatch,
  serverTimestamp 
} = require('firebase/firestore');
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

const SOURCE_CLINIC_ID = 'f1ZPaP1sZrb66T0s9o1O';
const TARGET_CLINIC_ID = 'default';
const USER_ID = 'system-seeder';

async function run() {
  console.log('🚀 Starting safe metadata migration...');
  console.log(`Source Clinic: ${SOURCE_CLINIC_ID}`);
  console.log(`Target Clinic: ${TARGET_CLINIC_ID}`);

  // --- 1. MIGRATE CATEGORIES ---
  console.log('\n--- 1. Migrating Categories ---');
  // Fetch source categories
  const sourceCatSnap = await getDocs(query(collection(db, 'medicineCategories'), where('clinicId', '==', SOURCE_CLINIC_ID)));
  const sourceCategories = sourceCatSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Found ${sourceCategories.length} categories in source clinic.`);

  // Fetch target categories (to avoid duplicates)
  const targetCatSnap = await getDocs(query(collection(db, 'medicineCategories'), where('clinicId', '==', TARGET_CLINIC_ID)));
  const targetCategoriesMap = {};
  targetCatSnap.docs.forEach(d => {
    targetCategoriesMap[d.data().name.toLowerCase().trim()] = d.id;
  });

  const categoryIdMap = {}; // oldId -> newId
  for (const cat of sourceCategories) {
    const normName = cat.name.toLowerCase().trim();
    if (targetCategoriesMap[normName]) {
      categoryIdMap[cat.id] = targetCategoriesMap[normName];
    } else {
      console.log(`Creating category "${cat.name}" for target clinic...`);
      const newCatRef = await addDoc(collection(db, 'medicineCategories'), {
        name: cat.name,
        description: cat.description || '',
        isActive: cat.isActive !== undefined ? cat.isActive : true,
        clinicId: TARGET_CLINIC_ID,
        branchId: '',
        createdBy: USER_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      categoryIdMap[cat.id] = newCatRef.id;
      targetCategoriesMap[normName] = newCatRef.id;
    }
  }
  console.log('✓ Categories migration completed.');

  // --- 2. MIGRATE BRANDS ---
  console.log('\n--- 2. Migrating Brands ---');
  // Fetch source brands
  const sourceBrandSnap = await getDocs(query(collection(db, 'medicineBrands'), where('clinicId', '==', SOURCE_CLINIC_ID)));
  const sourceBrands = sourceBrandSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Found ${sourceBrands.length} brands in source clinic.`);

  // Fetch target brands (to avoid duplicates)
  const targetBrandSnap = await getDocs(query(collection(db, 'medicineBrands'), where('clinicId', '==', TARGET_CLINIC_ID)));
  const targetBrandsMap = {};
  targetBrandSnap.docs.forEach(d => {
    targetBrandsMap[d.data().name.toLowerCase().trim()] = d.id;
  });

  const brandIdMap = {}; // oldId -> newId
  for (const brand of sourceBrands) {
    const normName = brand.name.toLowerCase().trim();
    if (targetBrandsMap[normName]) {
      brandIdMap[brand.id] = targetBrandsMap[normName];
    } else {
      console.log(`Creating brand "${brand.name}" for target clinic...`);
      const newBrandRef = await addDoc(collection(db, 'medicineBrands'), {
        name: brand.name,
        description: brand.description || '',
        isActive: brand.isActive !== undefined ? brand.isActive : true,
        clinicId: TARGET_CLINIC_ID,
        branchId: '',
        createdBy: USER_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      brandIdMap[brand.id] = newBrandRef.id;
      targetBrandsMap[normName] = newBrandRef.id;
    }
  }
  console.log('✓ Brands migration completed.');

  // --- 3. MIGRATE SUPPLIERS ---
  console.log('\n--- 3. Migrating Suppliers ---');
  // Fetch source suppliers
  const sourceSupplierSnap = await getDocs(query(collection(db, 'suppliers'), where('clinicId', '==', SOURCE_CLINIC_ID)));
  const sourceSuppliers = sourceSupplierSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Found ${sourceSuppliers.length} suppliers in source clinic.`);

  // Fetch target suppliers (to avoid duplicates)
  const targetSupplierSnap = await getDocs(query(collection(db, 'suppliers'), where('clinicId', '==', TARGET_CLINIC_ID)));
  const targetSuppliersMap = {};
  targetSupplierSnap.docs.forEach(d => {
    targetSuppliersMap[d.data().name.toLowerCase().trim()] = d.id;
  });

  const supplierIdMap = {}; // oldId -> newId
  for (const supplier of sourceSuppliers) {
    const normName = supplier.name.toLowerCase().trim();
    if (targetSuppliersMap[normName]) {
      supplierIdMap[supplier.id] = targetSuppliersMap[normName];
    } else {
      console.log(`Creating supplier "${supplier.name}" for target clinic...`);
      const newSupplierRef = await addDoc(collection(db, 'suppliers'), {
        name: supplier.name,
        contactPerson: supplier.contactPerson || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        panNumber: supplier.panNumber || '',
        isActive: supplier.isActive !== undefined ? supplier.isActive : true,
        clinicId: TARGET_CLINIC_ID,
        branchId: '',
        createdBy: USER_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      supplierIdMap[supplier.id] = newSupplierRef.id;
      targetSuppliersMap[normName] = newSupplierRef.id;
    }
  }
  console.log('✓ Suppliers migration completed.');

  // --- 4. MAP MEDICINES AND STOCKS ---
  console.log('\n--- 4. Mapping Medicines & Stocks ---');
  // Fetch source medicines
  const sourceMedSnap = await getDocs(query(collection(db, 'medicines'), where('clinicId', '==', SOURCE_CLINIC_ID)));
  const sourceMedicines = sourceMedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Loaded ${sourceMedicines.length} medicines from source clinic.`);

  // Create a map of source medicines by name (lowercased)
  const sourceMedMap = {};
  sourceMedicines.forEach(m => {
    const key = (m.name || '').toLowerCase().trim();
    sourceMedMap[key] = m;
  });

  // Fetch target medicines
  const targetMedSnap = await getDocs(query(collection(db, 'medicines'), where('clinicId', '==', TARGET_CLINIC_ID)));
  const targetMedicines = targetMedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Loaded ${targetMedicines.length} medicines in target clinic.`);

  // Map each target medicine to its source counterpart and update
  let count = 0;
  let batch = writeBatch(db);
  const BATCH_SIZE = 400;

  for (const targetMed of targetMedicines) {
    const key = (targetMed.name || '').toLowerCase().trim();
    const sourceMed = sourceMedMap[key];

    if (sourceMed) {
      const newBrandId = brandIdMap[sourceMed.brandId] || '';
      const newCategoryId = categoryIdMap[sourceMed.categoryId] || '';
      const newSupplierId = supplierIdMap[sourceMed.supplierId] || '';

      const medRef = doc(db, 'medicines', targetMed.id);
      batch.update(medRef, {
        brandId: newBrandId,
        categoryId: newCategoryId,
        supplierId: newSupplierId,
        updatedAt: new Date()
      });

      count++;

      if (count % BATCH_SIZE === 0) {
        await batch.commit();
        batch = writeBatch(db);
        console.log(`✓ Updated batch of ${count} medicines...`);
      }
    }
  }

  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
    console.log(`✓ Updated final medicine batch. Total medicines updated: ${count}`);
  }

  // --- 5. UPDATE STOCK SUPPLIER IDS ---
  console.log('\n--- 5. Mapping Stock Supplier IDs ---');
  // Load target stocks
  const stockSnap = await getDocs(query(collection(db, 'medicineStock'), where('clinicId', '==', TARGET_CLINIC_ID)));
  console.log(`Loaded ${stockSnap.size} stock records in target clinic.`);

  let stockCount = 0;
  let stockBatch = writeBatch(db);

  for (const stockDoc of stockSnap.docs) {
    const stockData = stockDoc.data();
    // Find target medicine
    const targetMed = targetMedicines.find(m => m.id === stockData.medicineId);
    if (targetMed) {
      const key = (targetMed.name || '').toLowerCase().trim();
      const sourceMed = sourceMedMap[key];
      if (sourceMed) {
        const newSupplierId = supplierIdMap[sourceMed.supplierId] || '';
        const stockRef = doc(db, 'medicineStock', stockDoc.id);
        stockBatch.update(stockRef, {
          supplierId: newSupplierId,
          updatedAt: new Date()
        });
        stockCount++;

        if (stockCount % BATCH_SIZE === 0) {
          await stockBatch.commit();
          stockBatch = writeBatch(db);
          console.log(`✓ Updated batch of ${stockCount} stock records...`);
        }
      }
    }
  }

  if (stockCount % BATCH_SIZE !== 0) {
    await stockBatch.commit();
    console.log(`✓ Updated final stock batch. Total stock records updated: ${stockCount}`);
  }

  console.log('\n🎉 Safe metadata migration successfully completed without modifying production clinic data!');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
