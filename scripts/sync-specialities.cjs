const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where } = require('firebase/firestore');
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

async function syncSpecialities() {
    console.log('🔄 Scanning doctors for unique specialities...');
    const doctorsSnap = await getDocs(collection(db, 'doctors'));

    if (doctorsSnap.empty) {
        console.log('No doctors found to sync from.');
        process.exit(0);
    }

    const specialityMap = new Map(); // compositeKey -> { name, key, clinicId, branchId }

    doctorsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.speciality) {
            const name = data.speciality.trim();
            const key = name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, '-');
            const clinicId = data.clinicId || 'default';
            const compositeKey = `${clinicId}_${key}`;

            if (!specialityMap.has(compositeKey)) {
                specialityMap.set(compositeKey, {
                    name,
                    key,
                    clinicId,
                    branchId: data.branchId || 'default'
                });
            }
        }
    });

    console.log(`🔍 Found ${specialityMap.size} unique specialities to sync.`);

    const specCollection = collection(db, 'doctor_specialities');
    let createdCount = 0;
    let skippedCount = 0;

    for (const spec of specialityMap.values()) {
        const q = query(specCollection,
            where('clinicId', '==', spec.clinicId),
            where('key', '==', spec.key)
        );
        const existing = await getDocs(q);

        if (existing.empty) {
            await addDoc(specCollection, {
                ...spec,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: 'system-sync'
            });
            console.log(`✅ Created speciality: "${spec.name}" for clinic: ${spec.clinicId}`);
            createdCount++;
        } else {
            console.log(`⏭️ Speciality already exists: "${spec.name}" for clinic: ${spec.clinicId}`);
            skippedCount++;
        }
    }

    console.log(`✨ Sync completed. Created: ${createdCount}, Skipped: ${skippedCount}`);
    process.exit(0);
}

syncSpecialities().catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
});
