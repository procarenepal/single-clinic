const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDocs, collection, query, where, serverTimestamp } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(app);
const auth = getAuth(app);

async function provisionHRUser() {
  const email = 'hr@procaresoft.com';
  const password = 'Password123!';
  const clinicId = 'default';

  try {
    let uid;
    // Attempt to create user in Firebase Auth
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCredential.user.uid;
      console.log(`Created new auth user: ${uid}`);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('User already exists in Firebase Auth. We will attempt to link it.');
        // If we really wanted to we could find the UID, but we can't easily query by email in client SDK without Admin SDK.
        // Assuming we're just creating a fresh one.
        console.error('Please use a different email or delete hr@procaresoft.com from Firebase Console first.');
        process.exit(1);
      } else {
        throw error;
      }
    }

    // 1. Create the user document in 'users' collection
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      email,
      role: 'hr',
      clinicId,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      displayName: 'HR Manager'
    });
    console.log('Created user document with role: hr');

    // 2. Create an HR system role in 'roles' if it doesn't exist
    const rolesRef = collection(db, 'roles');
    const q = query(rolesRef, where('name', '==', 'Human Resources'));
    const roleSnap = await getDocs(q);
    
    let roleId;
    if (roleSnap.empty) {
      const newRoleRef = doc(collection(db, 'roles'));
      roleId = newRoleRef.id;
      await setDoc(newRoleRef, {
        name: 'Human Resources',
        description: 'HR Role with access to Staff Management, Payroll, and Dashboard',
        permissions: ['f7fCTlidiiOabS1heZMT', 'dashboard-hr-specific', 'dashboard'], // Using some generic IDs, wait we need to check real page IDs for HR
        clinicId,
        isActive: true,
        isDefault: false
      });
      console.log('Created Human Resources custom role document');
    } else {
      roleId = roleSnap.docs[0].id;
      console.log('Found existing Human Resources custom role document');
    }

    // 3. Assign role to user
    const assignmentRef = doc(collection(db, 'user_role_assignments'));
    await setDoc(assignmentRef, {
      userId: uid,
      roleId: roleId,
      clinicId,
      assignedAt: serverTimestamp()
    });
    console.log('Created role assignment for HR user');

    console.log('---');
    console.log(`HR user provisioned successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

  } catch (error) {
    console.error('Error provisioning HR user:', error);
  } finally {
    process.exit(0);
  }
}

provisionHRUser();
