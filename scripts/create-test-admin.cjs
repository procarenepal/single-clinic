const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
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
const auth = getAuth(app);
const db = getFirestore(app);

async function createTestAdmin() {
    const email = 'testadmin@procaresoft.com';
    const password = 'Password123!';
    
    console.log(`Creating test admin: ${email}...`);
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        console.log(`User created in Auth. UID: ${uid}`);
        
        await setDoc(doc(db, 'users', uid), {
            email: email,
            displayName: 'Test Admin',
            role: 'clinic-admin',
            clinicId: 'default',
            branchId: 'default',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log('User record created in Firestore users collection successfully!');
    } catch (e) {
        console.error('Error creating user:', e);
    }
    process.exit(0);
}

createTestAdmin();
