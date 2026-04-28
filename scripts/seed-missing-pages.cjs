const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, query, where, serverTimestamp } = require('firebase/firestore');
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

const missingPages = [
    { name: 'Prescriptions', path: '/dashboard/prescriptions', icon: 'IoDocumentTextOutline', description: 'Manage patient prescriptions' },
    { name: 'Medicine Management', path: '/dashboard/medicine-management', icon: 'IoMedkitOutline', description: 'Medicine inventory configuration' },
    { name: 'Bed Management', path: '/dashboard/bed-management', icon: 'IoBedOutline', description: 'Manage beds and IPD' },
    { name: 'Pharmacy', path: '/dashboard/pharmacy', icon: 'IoMedicalOutline', description: 'Pharmacy and medicine sales' },
    { name: 'Pathology', path: '/dashboard/pathology', icon: 'IoFlaskOutline', description: 'Pathology and lab tests' },
    { name: 'Communication', path: '/dashboard/communication', icon: 'IoChatbubblesOutline', description: 'Communication and SMS Logs' },
    { name: 'Front Office', path: '/dashboard/front-office', icon: 'IoBusinessOutline', description: 'Front office management' },
    { name: 'Text Editor', path: '/dashboard/text-editor', icon: 'IoDocumentOutline', description: 'Text editor' },
    { name: 'Enquiry Management', path: '/dashboard/enquiries', icon: 'IoInformationCircleOutline', description: 'Patient enquiries' }
];

async function seedPages() {
    console.log('Seeding missing standalone pages...');
    const pagesRef = collection(db, 'pages');
    let count = 0;

    for (const page of missingPages) {
        const q = query(pagesRef, where('path', '==', page.path));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            await addDoc(pagesRef, {
                ...page,
                isActive: true,
                showInSidebar: true,
                order: 99, // Will be sorted by our navigationService algorithm anyway
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log(`Added: ${page.name}`);
            count++;
        } else {
            console.log(`Skip: ${page.name} already exists.`);
        }
    }

    console.log(`Finished seeding! Added ${count} new pages.`);
    process.exit(0);
}

seedPages().catch(console.error);
