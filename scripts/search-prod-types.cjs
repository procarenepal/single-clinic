const admin = require('firebase-admin');
const serviceAccount = require('c:\\Users\\Karan Bohara\\Downloads\\procaresoft-firebase-adminsdk-fbsvc-9944f57efa.json');

const prodApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}, 'production');
const prodDb = prodApp.firestore();

async function run() {
  console.log('Searching all production appointment_types for missing IDs...');
  const ids = [
    '7AWd2CvsvnTXI8VouDSe',
    '0RkOVCnoZRZA0vy4BwFP',
    'oB5m97FSgL8UoIRpbSIg',
    'v8PHY9u2SFyfc1xUAZ7z',
    'R9BArxbezaMhrsuYhnmL',
    'YC9zxKIgk45hdGM46uiS',
    'Es8XQLXPN2ZXGNgPyFce',
    'VHqRRus7PLLu6AdvBrce'
  ];
  
  for (const id of ids) {
    const docSnap = await prodDb.collection('appointment_types').doc(id).get();
    if (docSnap.exists) {
      console.log(`Found ID: ${id} | Name: ${docSnap.data().name} | ClinicId: ${docSnap.data().clinicId}`);
    } else {
      console.log(`ID: ${id} not found anywhere in production.`);
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
