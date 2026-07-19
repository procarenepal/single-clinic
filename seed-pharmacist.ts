import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where, addDoc, doc, setDoc, Timestamp } from "firebase/firestore";
import * as dotenv from "dotenv";

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

const app = initializeApp(firebaseConfig, "secondary");
const auth = getAuth(app);
const db = getFirestore(app);

async function seedPharmacist() {
  try {
    const email = "pharmacist@procaresoft.com";
    const password = "password123";
    
    console.log("Creating user auth profile...");
    let uid = "";
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCredential.user.uid;
      await signOut(auth);
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use") {
        console.log("User already exists, let's just find the UID and proceed (or fail if we can't find it).");
        // We can't easily get UID without admin SDK, so we'll just throw if it exists.
        console.error("Please delete pharmacist@procaresoft.com from Authentication in Firebase console first, or change the email in this script.");
        process.exit(1);
      } else {
        throw e;
      }
    }
    
    console.log("Created Auth User with UID:", uid);
    
    console.log("Creating user document...");
    // Just use a dummy clinicId, or try to find one
    const clinicsSnap = await getDocs(collection(db, "clinics"));
    const clinicId = clinicsSnap.empty ? "dummy-clinic" : clinicsSnap.docs[0].id;

    await setDoc(doc(db, "users", uid), {
      id: uid,
      email,
      firstName: "Pharma",
      lastName: "Test",
      displayName: "Pharma Test",
      role: "staff",
      clinicId: clinicId,
      branchId: null,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    console.log("User document created.");
    
    console.log("Looking for Pharmacist role...");
    const rolesRef = collection(db, "roles");
    const q = query(rolesRef, where("name", "==", "Pharmacist"));
    const rolesSnap = await getDocs(q);
    
    let roleId = "";
    if (rolesSnap.empty) {
      console.log("Pharmacist role not found. Creating it...");
      const newRoleDoc = await addDoc(rolesRef, {
        name: "Pharmacist",
        description: "Manages pharmacy and medicines",
        clinicId: clinicId,
        isSystem: false,
        permissions: {
          pages: {
            // Give them access to Follow-ups
            // The path must match what the system checks.
            "nDegTSJU2f2h0gfwcf8F": ["view", "create", "edit"], // Try to use the Follow-up page ID if we know it. We'll just grant view/edit generic.
          }
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      roleId = newRoleDoc.id;
    } else {
      roleId = rolesSnap.docs[0].id;
    }
    
    console.log("Assigning role to user...");
    await addDoc(collection(db, "user_roles"), {
      userId: uid,
      roleId: roleId,
      clinicId: clinicId,
      assignedBy: "system",
      assignedAt: Timestamp.now(),
      isActive: true,
    });
    
    console.log("Success! Pharmacist user seeded.");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding pharmacist:", error);
    process.exit(1);
  }
}

seedPharmacist();
