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

async function limitDoctorPermissions() {
    console.log('Fetching all pages...');
    const pagesSnapshot = await getDocs(collection(db, 'pages'));
    const pages = pagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Define EXACT strict paths a doctor should have access to.
    const strictPaths = [
        '/dashboard',
        '/dashboard/patients',
        '/dashboard/appointments',
        '/dashboard/prescriptions',
        '/dashboard/pathology',
        '/dashboard/front-office', // We want EXACTLY this for the doctor cabin
        '/dashboard/follow-ups',
        '/dashboard/profile'
    ];

    const permissionIds = pages
        .filter(page => {
            if (!page.path) return false;
            
            // Allow exact matches
            if (strictPaths.includes(page.path)) return true;
            
            // Allow sub-paths for specific modules only (NOT front-office)
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

    console.log(`Found ${permissionIds.length} strict pages for doctor permissions.`);
    
    const allowedPages = pages.filter(p => permissionIds.includes(p.id)).map(p => p.path);
    console.log('Allowed paths:', allowedPages);

    const roleRef = doc(db, 'roles', 'doctor');
    await setDoc(roleRef, {
        permissions: permissionIds,
    }, { merge: true });

    console.log('Doctor role permissions strictly limited (removed manage-visitors and call-logs).');
    process.exit(0);
}

limitDoctorPermissions().catch(console.error);
