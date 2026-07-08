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

async function deleteCollection(collectionName) {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  if (snapshot.empty) {
    console.log(`  ⏭  ${collectionName}: empty, skipping.`);
    return 0;
  }
  await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, collectionName, d.id))));
  console.log(`  ✅ ${collectionName}: deleted ${snapshot.size} record(s).`);
  return snapshot.size;
}

async function main() {
  console.log("🗑  Clearing stock book data...\n");

  await deleteCollection("stockTransactions");
  await deleteCollection("dailyStockSnapshots");

  console.log("\n✅ Done — all stock book records cleared.");
}

main().catch(console.error);
