const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, where } = require('firebase/firestore');
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

const CLINIC_ID = "default";

const skincareAppointmentTypes = [
  {
    name: "Acne Consultation & Care",
    price: 1200,
    color: "cyan",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Botox & Anti-Aging Consultation",
    price: 3000,
    color: "purple",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Advanced Chemical Peel",
    price: 2500,
    color: "orange",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Laser Hair Reduction Consultation",
    price: 1500,
    color: "blue",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Platelet-Rich Plasma (PRP) Therapy",
    price: 4500,
    color: "pink",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Microdermabrasion & Facial Rejuvenation",
    price: 3500,
    color: "emerald",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Mole & Skin Tag Removal (Electrocautery)",
    price: 2000,
    color: "red",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Hyperpigmentation & Melasma Treatment",
    price: 1800,
    color: "amber",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Eczema, Psoriasis & Allergy Management",
    price: 1000,
    color: "default",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
  {
    name: "Customized Skincare Routine & Product Audit",
    price: 800,
    color: "teal",
    isActive: true,
    clinicId: CLINIC_ID,
    createdBy: "seeder",
  },
];

async function main() {
  try {
    console.log("--- Seeding Skincare Hospital Appointment Types ---");
    const appointmentTypesRef = collection(db, "appointment_types");

    // 1. Fetch existing default appointment types to clean up or avoid duplicates
    console.log("Checking for existing appointment types for clinic 'default'...");
    const q = query(appointmentTypesRef, where("clinicId", "==", CLINIC_ID));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      console.log(`Found ${snapshot.size} existing appointment types. Deleting them to replace with the new skincare selection...`);
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, "appointment_types", docSnap.id)));
      await Promise.all(deletePromises);
      console.log("Deleted old appointment types successfully.");
    }

    // 2. Add the 10 skincare appointment types
    console.log("Adding 10 new skincare appointment types...");
    for (const type of skincareAppointmentTypes) {
      const docRef = await addDoc(appointmentTypesRef, {
        ...type,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`[Success] Created: "${type.name}" with ID: ${docRef.id} (Price: NPR ${type.price}, Color: ${type.color})`);
    }

    console.log("\n✅ 10 Skincare Hospital Appointment Types seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
