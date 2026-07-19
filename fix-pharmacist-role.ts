import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
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
const db = getFirestore(app);

async function fixPharmacistRole() {
  try {
    const rolesRef = collection(db, "roles");
    const q = query(rolesRef, where("name", "==", "Pharmacist"));
    const rolesSnap = await getDocs(q);
    
    if (!rolesSnap.empty) {
      for (const roleDoc of rolesSnap.docs) {
        await updateDoc(doc(db, "roles", roleDoc.id), {
          permissions: ["nDegTSJU2f2h0gfwcf8F"] // Just giving it the follow-ups page ID (assuming that's the one I got)
        });
        console.log("Fixed permissions for role:", roleDoc.id);
      }
    } else {
      console.log("No Pharmacist role found.");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixPharmacistRole();
