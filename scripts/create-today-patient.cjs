const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, query, orderBy, limit, serverTimestamp } = require('firebase/firestore');
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

async function createTodayPatient() {
    // 1. Find recent patient to get clinicId and branchId
    console.log("Finding clinicId from recent patients...");
    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
        console.error("No patients found in DB to copy clinicId from.");
        process.exit(1);
    }
    const lastPatient = snap.docs[0].data();
    const clinicId = lastPatient.clinicId || "default";
    const branchId = lastPatient.branchId || clinicId;
    console.log(`Using clinicId: ${clinicId}, branchId: ${branchId}`);

    // 2. Create today's patient
    const name = `Test Today Patient ${Date.now().toString().slice(-4)}`;
    console.log(`Creating patient "${name}"...`);
    const docRef = await addDoc(collection(db, 'patients'), {
        name,
        email: "today@example.com",
        mobile: "+97798" + Math.floor(10000000 + Math.random() * 90000000),
        regNumber: (parseInt(lastPatient.regNumber) + 1).toString(),
        regNumberNumeric: (lastPatient.regNumberNumeric || 1000) + 1,
        isActive: true,
        isCritical: false,
        clinicId,
        branchId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    console.log(`Successfully created patient with ID: ${docRef.id}`);
    process.exit(0);
}

createTodayPatient().catch(err => {
    console.error(err);
    process.exit(1);
});
