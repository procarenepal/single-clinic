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

const mockSuppliers = [
  {
    name: 'MediCorp Distributors',
    contactPerson: 'Rajesh Sharma',
    phone: '9800000001',
    email: 'contact@medicorp.com',
    address: 'Kathmandu, Nepal',
    licenseNumber: 'LIC-001',
    isActive: true,
  },
  {
    name: 'Everest Pharmaceuticals',
    contactPerson: 'Sita Gurung',
    phone: '9800000002',
    email: 'info@everestpharma.com',
    address: 'Pokhara, Nepal',
    licenseNumber: 'LIC-002',
    isActive: true,
  },
  {
    name: 'Global Health Supplies',
    contactPerson: 'Ram Bahadur',
    phone: '9800000003',
    email: 'sales@globalhealth.com',
    address: 'Lalitpur, Nepal',
    licenseNumber: 'LIC-003',
    isActive: true,
  },
  {
    name: 'Nepal Medical Store',
    contactPerson: 'Anita Thapa',
    phone: '9800000004',
    email: 'support@nepalmed.com',
    address: 'Bhaktapur, Nepal',
    licenseNumber: 'LIC-004',
    isActive: true,
  },
  {
    name: 'Himalaya Biotech',
    contactPerson: 'Krishna Joshi',
    phone: '9800000005',
    email: 'admin@himalayabiotech.com',
    address: 'Biratnagar, Nepal',
    licenseNumber: 'LIC-005',
    isActive: true,
  }
];

(async () => {
  try {
    console.log(`Seeding ${mockSuppliers.length} suppliers...`);
    const suppliersRef = collection(db, 'suppliers');

    for (const supplier of mockSuppliers) {
      const data = {
        ...supplier,
        clinicId: CLINIC_ID,
        branchId: BRANCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'system_seed'
      };

      const docRef = await addDoc(suppliersRef, data);
      console.log(`Created supplier: ${supplier.name} (${docRef.id})`);
    }

    console.log('✅ Successfully seeded suppliers to Firestore!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding suppliers:', error);
    process.exit(1);
  }
})();
