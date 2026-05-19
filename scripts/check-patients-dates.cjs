const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
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

// Mock patientService.getPatients
async function getPatients(clinicId) {
    const querySnapshot = await getDocs(collection(db, 'patients'));
    const patients = [];
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt
            ? new Date(data.createdAt.seconds * 1000)
            : new Date();
        patients.push({
            id: docSnap.id,
            ...data,
            createdAt,
        });
    });
    return patients;
}

// Replicate dailyReportService.getDailyPatients
async function testGetDailyPatients(clinicId, date) {
    const allPatients = await getPatients(clinicId);
    
    const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
    const endOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
    );

    console.log("Filtering range (Local Time):");
    console.log("Start:", startOfDay.toString());
    console.log("End:", endOfDay.toString());

    const filtered = allPatients.filter((patient) => {
        const createdAt = patient.createdAt;
        if (!createdAt) return false;
        
        // Emulate cache stringification and parsing
        const cachedStringified = JSON.parse(JSON.stringify(createdAt));
        const patientDate = new Date(cachedStringified);
        
        const matches = patientDate >= startOfDay && patientDate <= endOfDay;
        if (patient.id === "dogTbKJZXKuwQm7ZWsiY") {
            console.log("-----------------------------------------");
            console.log(`Checking Samu/Today Patient: ${patient.name}`);
            console.log(`patient.createdAt:`, createdAt.toString());
            console.log(`cachedStringified:`, cachedStringified);
            console.log(`patientDate parsed:`, patientDate.toString());
            console.log(`patientDate >= startOfDay:`, patientDate >= startOfDay);
            console.log(`patientDate <= endOfDay:`, patientDate <= endOfDay);
            console.log(`Matches?`, matches);
            console.log("-----------------------------------------");
        }
        return matches;
    });

    return filtered;
}

async function run() {
    const date = new Date(); // May 19, 2026
    const patients = await testGetDailyPatients("default", date);
    console.log(`Filtered patients count: ${patients.length}`);
    patients.forEach(p => console.log(`- ${p.name} (${p.id})`));
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
