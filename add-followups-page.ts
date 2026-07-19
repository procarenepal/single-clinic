import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, Timestamp, getDocs, query, where } from "firebase/firestore";
import * as dotenv from "dotenv";

// Load environment variables from .env
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addFollowUpsPage() {
  try {
    const pagesRef = collection(db, "pages");
    
    // Check if it already exists
    const q = query(pagesRef, where("path", "==", "/dashboard/follow-ups"));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      console.log("Follow-ups page already exists in the database. ID:", snapshot.docs[0].id);
      return;
    }

    const now = Timestamp.now();
    const newPageData = {
      name: "Patient Follow-ups",
      path: "/dashboard/follow-ups",
      description: "Track and manage patient follow-ups and treatment schedules",
      icon: "CalendarIcon",
      isActive: true,
      order: 15,
      autoAssign: true,
      showInSidebar: true,
      parentId: null,
      hasSubmenu: false,
      level: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(pagesRef, newPageData);
    console.log("Successfully created Follow-ups page with ID:", docRef.id);
    
    // Now optionally trigger the autoAssign logic for all clinic types
    // Since we set autoAssign to true, it will be handled when assigned.
    // Or we can just let it exist. Let's do a quick assign to clinic_type_pages.
    const clinicTypesRef = collection(db, "clinic_types");
    const clinicTypesSnapshot = await getDocs(clinicTypesRef);
    
    const clinicTypePagesRef = collection(db, "clinic_type_pages");
    
    for (const clinicTypeDoc of clinicTypesSnapshot.docs) {
      await addDoc(clinicTypePagesRef, {
        clinicTypeId: clinicTypeDoc.id,
        pageId: docRef.id,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
      console.log("Assigned to clinic type:", clinicTypeDoc.id);
    }
    
    console.log("All done!");
    process.exit(0);
  } catch (error) {
    console.error("Error adding page:", error);
    process.exit(1);
  }
}

addFollowUpsPage();
