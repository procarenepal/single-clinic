const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } = require('firebase/firestore');
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

async function seedOneDoctor() {
    const email = 'testdoctor@procaresoft.com';
    const password = 'Password123!';
    const name = 'Dr. Test Seed';
    const clinicId = 'default';
    const branchId = 'default';

    console.log(`Creating test doctor: ${email}...`);
    try {
        let uid;
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            uid = userCred.user.uid;
            console.log(`User created in Auth. UID: ${uid}`);
        } catch (authErr) {
            console.error('Error creating auth user (might already exist):', authErr.message);
            // We could try to fetch user if already exists, but for script simplicity we'll just throw
            throw authErr;
        }

        // 1. Create User document
        await setDoc(doc(db, 'users', uid), {
            email: email,
            displayName: name,
            role: 'staff',
            clinicId: clinicId,
            branchId: branchId,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log('User record created in Firestore `users` collection.');

        // 2. Create Doctor profile
        const docRef = await addDoc(collection(db, 'doctors'), {
            name: name,
            doctorType: 'regular',
            defaultCommission: 50,
            speciality: 'General Medicine',
            phone: '9800000000',
            email: email,
            nmcNumber: 'NMC-0000',
            clinicId: clinicId,
            branchId: branchId,
            isActive: true,
            userId: uid, // In case system uses userId to link
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: 'system'
        });
        console.log(`Doctor profile created in \`doctors\` collection with ID: ${docRef.id}`);

        // 3. Assign appropriate permissions via userRoleAssignments
        // Using a custom ID for assignment
        const assignmentId = `${uid}_doctor_${clinicId}`;
        await setDoc(doc(db, 'userRoleAssignments', assignmentId), {
            userId: uid,
            roleId: 'doctor', // 'doctor' role was created in initialize-system.cjs
            clinicId: clinicId,
            createdAt: serverTimestamp()
        });
        console.log('Assigned `doctor` role to the user in `userRoleAssignments`.');

        console.log('Successfully seeded one doctor with permissions!');
    } catch (e) {
        console.error('Error in seeding process:', e);
    }
    process.exit(0);
}

seedOneDoctor();
