import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc } from "firebase/firestore";
import { readFileSync } from "fs";

// Load .env manually
const env = readFileSync(".env", "utf8");
const vars = {};
env.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) vars[key.trim()] = rest.join("=").trim();
});

const firebaseConfig = {
  apiKey: vars["VITE_FIREBASE_API_KEY"],
  authDomain: vars["VITE_FIREBASE_AUTH_DOMAIN"],
  projectId: vars["VITE_FIREBASE_PROJECT_ID"],
  storageBucket: vars["VITE_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: vars["VITE_FIREBASE_MESSAGING_SENDER_ID"],
  appId: vars["VITE_FIREBASE_APP_ID"],
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const realDoctors = [
  { name: "DR.Sumit Roy", doctorType: "visiting", defaultCommission: 30, speciality: "Dermatologist-Venereologist-Cosmetologist", phone: "9852030989", email: "", nmcNumber: "11415", clinicId: "default", branchId: "default", isActive: true },
];

const realExperts = [
  { name: "Nirvana Siwakoti", expertType: "regular", defaultCommission: 1.5, speciality: "Aesthetic-Expert", phone: "9706107059", email: "", licenseNumber: "00000", clinicId: "default", branchId: "default", isActive: true },
  { name: "Dikshya Bhattarai", expertType: "regular", defaultCommission: 1.5, speciality: "Aesthetic-Nurse", phone: "9802744418", email: "", licenseNumber: "0000", clinicId: "default", branchId: "default", isActive: true },
  { name: "Soniya Gautam", expertType: "regular", defaultCommission: 1.5, speciality: "Aesthetic-Nurse", phone: "9802744418", email: "", licenseNumber: "0000", clinicId: "default", branchId: "default", isActive: true },
  { name: "Nanu Maya Gurung", expertType: "regular", defaultCommission: 1.5, speciality: "Aesthetic-Nurse", phone: "9802744418", email: "", licenseNumber: "0000", clinicId: "default", branchId: "default", isActive: true },
  { name: "Puja Khadka", expertType: "regular", defaultCommission: 1.5, speciality: "Laser-Specialist", phone: "9802744418", email: "", licenseNumber: "0000", clinicId: "default", branchId: "default", isActive: true },
];

async function seedData() {
  console.log('Clearing dummy data...');
  const drSnap = await getDocs(collection(db, 'doctors'));
  await Promise.all(drSnap.docs.map(d => deleteDoc(doc(db, 'doctors', d.id))));
  const exSnap = await getDocs(collection(db, 'experts'));
  await Promise.all(exSnap.docs.map(d => deleteDoc(doc(db, 'experts', d.id))));

  console.log('Seeding real Doctors...');
  const doctorsRef = collection(db, 'doctors');
  for (const dr of realDoctors) {
    await addDoc(doctorsRef, {
      ...dr,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  
  console.log('Seeding real Experts...');
  const expertsRef = collection(db, 'experts');
  for (const ex of realExperts) {
    await addDoc(expertsRef, {
      ...ex,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  console.log('✅ Real clinicians restored.');
}

seedData().catch(console.error);
