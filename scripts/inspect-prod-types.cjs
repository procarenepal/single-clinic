const admin = require('firebase-admin');
const serviceAccount = require('c:\\Users\\Karan Bohara\\Downloads\\procaresoft-firebase-adminsdk-fbsvc-9944f57efa.json');

const prodApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}, 'production');
const prodDb = prodApp.firestore();

async function run() {
  console.log('Querying production appointment_types...');
  const ids = ['v8PHY9u2SFyfc1xUAZ7z', '0RkOVCnoZRZA0vy4BwFP'];
  for (const id of ids) {
    const docSnap = await prodDb.collection('appointment_types').doc(id).get();
    if (docSnap.exists) {
      console.log(id, docSnap.data());
    } else {
      console.log(id, 'Does not exist in production');
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
