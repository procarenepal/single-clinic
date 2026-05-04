#!/usr/bin/env node
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, limit } = require('firebase/firestore');
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

const CLINIC_ID = "standalone";

async function seedMedicines() {
    console.log('--- Seeding Medicines ---');
    const MEDICINES_COLLECTION = 'medicines';
    const CATEGORIES_COLLECTION = 'medicineCategories';

    const mockCategories = [
        { name: "Analgesic", description: "Pain relief", isActive: true, clinicId: CLINIC_ID },
        { name: "Antibiotic", description: "Infection treatment", isActive: true, clinicId: CLINIC_ID },
        { name: "Antihistamine", description: "Allergy relief", isActive: true, clinicId: CLINIC_ID },
        { name: "Supplements", description: "Vitamins and minerals", isActive: true, clinicId: CLINIC_ID },
    ];

    const mockMedicines = [
        { name: "Paracetamol 500mg", genericName: "Paracetamol", type: "tablet", unit: "tablet", strength: "500mg", price: 5, costPrice: 2, isActive: true, clinicId: CLINIC_ID },
        { name: "Amoxicillin 250mg", genericName: "Amoxicillin", type: "capsule", unit: "capsule", strength: "250mg", price: 15, costPrice: 8, isActive: true, clinicId: CLINIC_ID },
        { name: "Cetirizine 10mg", genericName: "Cetirizine", type: "tablet", unit: "tablet", strength: "10mg", price: 8, costPrice: 3, isActive: true, clinicId: CLINIC_ID },
        { name: "Vitamin D3", genericName: "Cholecalciferol", type: "capsule", unit: "capsule", strength: "60000 IU", price: 25, costPrice: 12, isActive: true, clinicId: CLINIC_ID },
    ];

    const catMap = {};
    for (const cat of mockCategories) {
        const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), {
            ...cat,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        catMap[cat.name] = docRef.id;
        console.log(`[Category] Created: ${cat.name}`);
    }

    for (const med of mockMedicines) {
        let catId = "";
        if (med.name.includes("Paracetamol")) catId = catMap["Analgesic"];
        else if (med.name.includes("Amoxicillin")) catId = catMap["Antibiotic"];
        else if (med.name.includes("Cetirizine")) catId = catMap["Antihistamine"];
        else if (med.name.includes("Vitamin D3")) catId = catMap["Supplements"];

        await addDoc(collection(db, MEDICINES_COLLECTION), {
            ...med,
            categoryId: catId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        console.log(`[Medicine] Created: ${med.name}`);
    }
}

async function seedServices() {
    console.log('\n--- Seeding Services (Appointment Types) ---');
    const SERVICES_COLLECTION = 'appointmentTypes';

    const defaultServices = [
        { name: "General Consultation", price: 500, isActive: true, clinicId: CLINIC_ID },
        { name: "Follow-up Visit", price: 300, isActive: true, clinicId: CLINIC_ID },
        { name: "Emergency Consultation", price: 1000, isActive: true, clinicId: CLINIC_ID },
        { name: "Specialist Review", price: 800, isActive: true, clinicId: CLINIC_ID },
        { name: "Diagnostic Procedure", price: 1500, isActive: true, clinicId: CLINIC_ID },
    ];

    for (const service of defaultServices) {
        await addDoc(collection(db, SERVICES_COLLECTION), {
            ...service,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        console.log(`[Service] Created: ${service.name} (NPR ${service.price})`);
    }
}

async function main() {
    try {
        await seedMedicines();
        await seedServices();
        console.log('\n✅ Clinic data seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

main();
