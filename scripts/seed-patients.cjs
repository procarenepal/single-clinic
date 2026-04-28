#!/usr/bin/env node
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
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

const PATIENTS_COLLECTION = 'patients';

const mockPatients = [
    { name: "John Doe", email: "john@example.com", phone: "1234567890", mobile: "1234567890", gender: "male", bloodGroup: "O+", regNumber: "1001", regNumberNumeric: 1001, isActive: true, isCritical: false, clinicId: "default" },
    { name: "Jane Smith", email: "jane@example.com", phone: "1234567891", mobile: "1234567891", gender: "female", bloodGroup: "A+", regNumber: "1002", regNumberNumeric: 1002, isActive: true, isCritical: false, clinicId: "default" },
    { name: "Bob Johnson", email: "bob@example.com", phone: "1234567892", mobile: "1234567892", gender: "male", bloodGroup: "B+", regNumber: "1003", regNumberNumeric: 1003, isActive: true, isCritical: true, clinicId: "default" },
    { name: "Alice Williams", email: "alice@example.com", phone: "1234567893", mobile: "1234567893", gender: "female", bloodGroup: "O-", regNumber: "1004", regNumberNumeric: 1004, isActive: true, isCritical: false, clinicId: "default" },
    { name: "Michael Brown", email: "michael@example.com", phone: "1234567894", mobile: "1234567894", gender: "male", bloodGroup: "AB+", regNumber: "1005", regNumberNumeric: 1005, isActive: true, isCritical: false, clinicId: "default" },
    { name: "Sarah Davis", email: "sarah@example.com", phone: "1234567895", mobile: "1234567895", gender: "female", bloodGroup: "A-", regNumber: "1006", regNumberNumeric: 1006, isActive: true, isCritical: true, clinicId: "default" },
    { name: "David Miller", email: "david@example.com", phone: "1234567896", mobile: "1234567896", gender: "male", bloodGroup: "O+", regNumber: "1007", regNumberNumeric: 1007, isActive: true, isCritical: false, clinicId: "default" },
    { name: "Emily Wilson", email: "emily@example.com", phone: "1234567897", mobile: "1234567897", gender: "female", bloodGroup: "B-", regNumber: "1008", regNumberNumeric: 1008, isActive: true, isCritical: false, clinicId: "default" },
    { name: "James Moore", email: "james@example.com", phone: "1234567898", mobile: "1234567898", gender: "male", bloodGroup: "AB-", regNumber: "1009", regNumberNumeric: 1009, isActive: true, isCritical: true, clinicId: "default" },
    { name: "Emma Taylor", email: "emma@example.com", phone: "1234567899", mobile: "1234567899", gender: "female", bloodGroup: "O+", regNumber: "1010", regNumberNumeric: 1010, isActive: true, isCritical: false, clinicId: "default" },
    { name: "William Anderson", email: "william@example.com", phone: "1234567800", mobile: "1234567800", gender: "male", bloodGroup: "A+", regNumber: "1011", regNumberNumeric: 1011, isActive: true, isCritical: false, clinicId: "default" },
    { name: "Olivia Thomas", email: "olivia@example.com", phone: "1234567801", mobile: "1234567801", gender: "female", bloodGroup: "B+", regNumber: "1012", regNumberNumeric: 1012, isActive: true, isCritical: false, clinicId: "default" },
];

async function seedPatients() {
    console.log('Seeding 12 mock patients...');
    const patientsRef = collection(db, PATIENTS_COLLECTION);
    let count = 0;

    for (const patient of mockPatients) {
        try {
            const docRef = await addDoc(patientsRef, {
                ...patient,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            console.log(`Created patient: ${patient.name} (${docRef.id})`);
            count++;
        } catch (e) {
            console.error(`Failed to create patient ${patient.name}:`, e);
        }
    }

    console.log(`Successfully seeded ${count} patients.`);
    process.exit(0);
}

seedPatients();
