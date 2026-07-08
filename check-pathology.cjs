const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function check() {
  const snap = await db.collection("pathologyBillingSettings").get();
  snap.docs.forEach(doc => console.log(doc.id, doc.data()));
}

check().catch(console.error).then(() => process.exit(0));
