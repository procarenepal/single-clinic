#!/usr/bin/env node
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const defaultTemplates = [
  // English Templates
  {
    name: "Appointment Reminder (EN)",
    type: "patient",
    language: "en",
    message: "Dear {patientName}, you have an appointment scheduled at {clinicName} on {date} at {time}. Please arrive 10 minutes early. For changes, call {clinicPhone}.",
  },
  {
    name: "Welcome Message (EN)",
    type: "patient",
    language: "en",
    message: "Welcome {patientName} to {clinicName}! We are glad to have you. For appointments, call {clinicPhone}.",
  },
  {
    name: "Follow-up Reminder (EN)",
    type: "patient",
    language: "en",
    message: "Dear {patientName}, it's time for your follow-up visit at {clinicName}. Please call {clinicPhone} to schedule.",
  },
  {
    name: "Lab Report Ready (EN)",
    type: "patient",
    language: "en",
    message: "Dear {patientName}, your lab report is ready. Please visit our clinic or call {clinicPhone} to discuss with your doctor.",
  },

  // Nepali Templates
  {
    name: "Appointment Reminder (NE)",
    type: "patient",
    language: "ne",
    message: "नमस्ते {patientName}, तपाईंको {clinicName} मा {date} को दिन {time} बजे भेट्ने समय तय गरिएको छ। कृपया १० मिनेट अगाडि आउनुहोला।",
  },
  {
    name: "Welcome Message (NE)",
    type: "patient",
    language: "ne",
    message: "नमस्ते {patientName}, {clinicName} मा स्वागत छ! हामी तपाईंको सेवा गर्न पाउँदा खुसी छौं।",
  },
  {
    name: "Follow-up Reminder (NE)",
    type: "patient",
    language: "ne",
    message: "नमस्ते {patientName}, तपाईंको फलो-अप परीक्षणको समय भएको छ। कृपया {clinicPhone} मा सम्पर्क गरी समय लिनुहोला।",
  },
  {
    name: "Lab Report Ready (NE)",
    type: "patient",
    language: "ne",
    message: "नमस्ते {patientName}, तपाईंको ल्याब रिपोर्ट तयार छ। कृपया क्लिनिकमा आउनुहोला वा {clinicPhone} मा सम्पर्क गर्नुहोला।",
  },
];

async function seedData() {
    console.log('Seeding SMS templates...');
    const clinicId = 'default';
    const templatesRef = collection(db, 'smsTemplates');
    
    const existingSnap = await getDocs(query(templatesRef, where('clinicId', '==', clinicId)));
    const existingNames = new Set(existingSnap.docs.map(d => d.data().name.toLowerCase()));
    
    let count = 0;
    let skipped = 0;
    
    for (const t of defaultTemplates) {
        if (existingNames.has(t.name.toLowerCase())) {
            skipped++;
            continue;
        }
        
        await addDoc(templatesRef, {
            clinicId,
            name: t.name,
            type: t.type,
            language: t.language,
            message: t.message,
            isActive: true,
            usageCount: 0,
            createdBy: 'system-seeder',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        count++;
    }
    
    console.log(`Templates seeded successfully! Added: ${count}, Skipped: ${skipped}`);
    process.exit(0);
}

seedData().catch(console.error);
