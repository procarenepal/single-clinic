const dotenv = require('dotenv');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, Timestamp } = require('firebase/firestore');

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedFollowups() {
  // 1. Fetch some patients to link follow-ups to
  const patientsSnap = await getDocs(collection(db, "patients"));
  if (patientsSnap.empty) {
    console.error("No patients found in the database. Please add some patients first.");
    process.exit(1);
  }

  const patients = patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Found ${patients.length} patients in database.`);

  const clinicId = "default";
  const branchId = "";
  const createdBy = "system-seed";

  // We want to create follow-ups for all 4 categories:
  // - pathology
  // - pharmacy
  // - appointment
  // - general

  const samples = [
    {
      category: "pathology",
      service: "CBC | Thyroid Panel | Lipid Profile",
      product: "",
      notes: "Routine health checkup",
      initStatus: "good",
      overallStatus: "pending",
      session: "1st",
      visitDate: new Date("2026-07-15"),
      nextFollowupDate: new Date("2026-07-25"),
      followedBy: "Lab Tech Subash"
    },
    {
      category: "pharmacy",
      service: "",
      product: "CEUTICOZ KERAMOTE REPAIR CONDITIONER 100ML, Exo-Cicaderm Cream",
      notes: "Dispensed hair and skin care routine",
      initStatus: "good",
      overallStatus: "pending",
      session: "1st",
      visitDate: new Date("2026-07-16"),
      nextFollowupDate: new Date("2026-07-28"),
      followedBy: "Pharmacist Milan"
    },
    {
      category: "appointment",
      service: "Doctor Consultation | Laser Hair Removal",
      product: "",
      notes: "Follow up on laser session progress",
      initStatus: "good",
      overallStatus: "pending",
      session: "1st",
      visitDate: new Date("2026-07-17"),
      nextFollowupDate: new Date("2026-07-30"),
      followedBy: "Dr. Aayush"
    },
    {
      category: "general",
      service: "Hydrafacial Skin Treatment",
      product: "TPS NIACINAMIDE 5% serum",
      notes: "Facial therapy and serum routine instruction",
      initStatus: "neutral",
      overallStatus: "pending",
      session: "1st",
      visitDate: new Date("2026-07-18"),
      nextFollowupDate: new Date("2026-08-01"),
      followedBy: "CEO Suman"
    }
  ];

  console.log("\nStarting seeding...");

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    // Pick a patient (rotate if multiple, otherwise use the first one)
    const patient = patients[i % patients.length];

    const followupData = {
      clinicId,
      branchId,
      category: sample.category,
      patientId: patient.id,
      patientName: patient.fullName || patient.name || "Unknown",
      patientMobile: patient.mobile || patient.phone || "9800000000",
      visitDate: Timestamp.fromDate(sample.visitDate),
      session: sample.session,
      initStatus: sample.initStatus,
      overallStatus: sample.overallStatus,
      service: sample.service,
      product: sample.product,
      notes: sample.notes,
      followedBy: sample.followedBy,
      nextFollowupDate: Timestamp.fromDate(sample.nextFollowupDate),
      followupDates: {
        first: Timestamp.fromDate(sample.nextFollowupDate),
        second: null,
        third: null,
        fourth: null,
        fifth: null
      },
      noteHistory: [
        {
          date: Timestamp.fromDate(new Date()),
          note: sample.notes,
          user: "system-seed"
        }
      ],
      logs: [
        {
          date: Timestamp.fromDate(new Date()),
          note: `Created seeded ${sample.category} follow-up`,
          user: "system-seed"
        }
      ],
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
      createdBy
    };

    const docRef = await addDoc(collection(db, "patientFollowups"), followupData);
    console.log(`Created ${sample.category} follow-up with ID: ${docRef.id} for patient: ${followupData.patientName}`);
  }

  console.log("\nSeeding completed successfully!");
  process.exit(0);
}

seedFollowups().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
