const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
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

async function seedExpert() {
  const snap = await require('firebase/firestore').getDocs(require('firebase/firestore').query(require('firebase/firestore').collection(db, 'users'), require('firebase/firestore').where('role', '==', 'system-owner'))); const clinicId = snap.docs[0]?.data().clinicId || 'demo_clinic'; // Replace with your actual clinic ID
  
  // Create an expert profile
  const demoExpertId = "expert_demo_1";
  const expertRef = doc(db, "experts", demoExpertId);

  console.log("Seeding expert into 'experts' collection...");
  await setDoc(expertRef, {
    id: demoExpertId,
    name: "Deepak Sharma",
    expertType: "senior",
    defaultCommission: 20,
    speciality: "Skin & Laser Therapy Specialist",
    phone: "9876543212",
    email: "expert@procaresoft.com",
    licenseNumber: "EXP-88990",
    clinicId: clinicId,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Create a placeholder user profile for 'expert' role
  const userRef = doc(db, "users", "expert_uid_placeholder");
  console.log("Seeding expert into 'users' collection...");
  await setDoc(userRef, {
    email: "expert@procaresoft.com",
    role: "expert",
    displayName: "Deepak Sharma (Expert)",
    clinicId: clinicId
  });

  console.log("Successfully seeded expert: expert@procaresoft.com");
  process.exit(0);
}

seedExpert().catch(e => {
  console.error(e);
  process.exit(1);
});
