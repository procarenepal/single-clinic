import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { readFileSync } from "fs";

// Load .env manually
const env = readFileSync(".env", "utf8");
const vars = {};
env.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) vars[key.trim()] = rest.join("=").trim();
});

const firebaseConfig = {
  apiKey: vars["VITE_FIREBASE_API_KEY"],
  authDomain: vars["VITE_FIREBASE_AUTH_DOMAIN"],
  projectId: vars["VITE_FIREBASE_PROJECT_ID"],
  storageBucket: vars["VITE_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: vars["VITE_FIREBASE_MESSAGING_SENDER_ID"],
  appId: vars["VITE_FIREBASE_APP_ID"],
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteAllPurchases() {
  const colRef = collection(db, "medicinePurchases");
  const snapshot = await getDocs(colRef);

  if (snapshot.empty) {
    console.log("No purchase records found.");
    return;
  }

  console.log(`Found ${snapshot.size} purchase record(s). Deleting...`);

  const deletes = snapshot.docs.map((d) => deleteDoc(doc(db, "medicinePurchases", d.id)));
  await Promise.all(deletes);

  console.log(`✅ Successfully deleted ${snapshot.size} purchase record(s) from medicinePurchases.`);
}

deleteAllPurchases().catch(console.error);
