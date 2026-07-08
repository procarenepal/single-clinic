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

const realDoctorsList = [
  { name: "DR SHASHANK SHEKHAR", phone: "9852030989", email: "doctorhsclh@gmail.com", speciality: "Dermatology Venereology & Cosmetology", doctorType: "regular", defaultCommission: 0, isActive: false, nmcNumber: "21433", clinicId: "default", branchId: "default" },
  { name: "DR DEEPA DEV CHHETRI", phone: "9842297330", email: "", speciality: "Dermatology Venereology & Cosmetology", doctorType: "regular", defaultCommission: 5, isActive: true, nmcNumber: "8877", clinicId: "default", branchId: "default" },
  { name: "MS NANU MAYA GURUNG", phone: "9829342178", email: "", speciality: "Aesthetic-Nurse", doctorType: "regular", defaultCommission: 1.5, isActive: true, nmcNumber: "0000", clinicId: "default", branchId: "default" },
  { name: "Dikshya Bhattrai", phone: "9807361872", email: "", speciality: "Aesthetic-Nurse", doctorType: "regular", defaultCommission: 1.5, isActive: true, nmcNumber: "0000255", clinicId: "default", branchId: "default" },
  { name: "MS.NIRVANA SIWAKOTI", phone: "9852030989", email: "technicianhsclh@gmail.com", speciality: "Aesthetic-Expert", doctorType: "regular", defaultCommission: 1.5, isActive: true, nmcNumber: "1214", clinicId: "default", branchId: "default" },
  { name: "Dr.SUMIT RAY", phone: "9852833735", email: "doctorhsclh@gmail.com", speciality: "Dermatology Venereology & Cosmetology", doctorType: "visiting", defaultCommission: 0, isActive: true, nmcNumber: "16366", clinicId: "default", branchId: "default" },
  { name: "MS PUJA KHADKA", phone: "9705566150", email: "", speciality: "Laser-Specialist", doctorType: "regular", defaultCommission: 1.5, isActive: true, nmcNumber: "11111", clinicId: "default", branchId: "default" },
  { name: "MS SONIYA GAUTAM", phone: "9814300076", email: "", speciality: "Aesthetic-Nurse", doctorType: "regular", defaultCommission: 1.5, isActive: true, nmcNumber: "0", clinicId: "default", branchId: "default" }
];

async function seedData() {
  console.log('Clearing existing doctors...');
  const drSnap = await getDocs(collection(db, 'doctors'));
  await Promise.all(drSnap.docs.map(d => deleteDoc(doc(db, 'doctors', d.id))));

  console.log('Seeding exact Doctors list from screenshot...');
  const doctorsRef = collection(db, 'doctors');
  for (const dr of realDoctorsList) {
    await addDoc(doctorsRef, {
      ...dr,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  
  console.log('✅ Real doctors list restored successfully.');
}

seedData().catch(console.error);
