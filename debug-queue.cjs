const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const fs = require('fs');

// Firebase configuration
const firebaseConfig = {
  apiKey: "demo",
  authDomain: "demo.firebaseapp.com",
  projectId: "procaresoft-demo",
  storageBucket: "demo.appspot.com",
  messagingSenderId: "123",
  appId: "1:123:web:123"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugQueue() {
  console.log("Fetching appointments...");
  const apptsSnap = await getDocs(collection(db, "appointments"));
  
  const today = new Date().toISOString().split('T')[0];
  console.log(`Filtering for today: ${today}`);
  
  const appts = [];
  apptsSnap.forEach(doc => {
    const data = doc.data();
    if (data.date === today || (data.appointmentDate && data.appointmentDate.startsWith(today))) {
      appts.push({ id: doc.id, ...data });
    }
  });
  
  console.log(`Found ${appts.length} appointments for today.`);
  
  const expertsSnap = await getDocs(collection(db, "experts"));
  const experts = [];
  expertsSnap.forEach(doc => experts.push({ id: doc.id, ...doc.data() }));
  
  console.log(`\n--- EXPERTS ---`);
  experts.forEach(e => {
    console.log(`ID: ${e.id}, Name: ${e.name}, Email: ${e.email}`);
  });
  
  console.log(`\n--- APPOINTMENTS ---`);
  appts.forEach(a => {
    console.log(`Appt ID: ${a.id}`);
    console.log(`  Patient ID: ${a.patientId}`);
    console.log(`  Doctor ID: ${a.doctorId}`);
    console.log(`  Assigned Expert ID: ${a.assignedExpertId}`);
    console.log(`  Status: ${a.status}`);
    console.log(`  Doctor Consultation Completed: ${a.doctorConsultationCompleted}`);
    console.log(`---`);
  });
  
  process.exit(0);
}

debugQueue().catch(console.error);
