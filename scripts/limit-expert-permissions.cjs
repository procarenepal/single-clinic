const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');
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

async function limitExpertPermissions() {
    console.log('Fetching all pages...');
    const pagesSnapshot = await getDocs(collection(db, 'pages'));
    const pages = pagesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Define EXACT strict paths an expert should have access to.
    // Mirrors doctor permissions exactly — includes /dashboard/front-office for Expert Cabin.
    const strictPaths = [
        '/dashboard',
        '/dashboard/patients',
        '/dashboard/appointments',
        '/dashboard/prescriptions',
        '/dashboard/pathology',
        '/dashboard/front-office',   // Expert Cabin lives here
        '/dashboard/follow-ups',
        '/dashboard/profile'
    ];

    const permissionIds = pages
        .filter(page => {
            if (!page.path) return false;

            // Allow exact matches
            if (strictPaths.includes(page.path)) return true;

            // Allow sub-paths for specific modules only (NOT front-office sub-paths)
            const allowedSubpathPrefixes = [
                '/dashboard/patients',
                '/dashboard/appointments',
                '/dashboard/prescriptions',
                '/dashboard/pathology',
                '/dashboard/follow-ups'
            ];

            return allowedSubpathPrefixes.some(sp => page.path.startsWith(sp + '/'));
        })
        .map(page => page.id);

    console.log(`Found ${permissionIds.length} strict pages for expert permissions.`);

    const allowedPages = pages.filter(p => permissionIds.includes(p.id)).map(p => p.path);
    console.log('Allowed paths:', allowedPages);

    // Write to roles/expert (not roles/doctor)
    const roleRef = doc(db, 'roles', 'expert');
    await setDoc(roleRef, {
        permissions: permissionIds,
    }, { merge: true });

    console.log('Expert role permissions set — Expert Cabin (/dashboard/front-office) is now accessible.');
    process.exit(0);
}

limitExpertPermissions().catch(console.error);
