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

const mockDoctors = [
    { name: "Dr. Aakash Sharma", doctorType: "regular", defaultCommission: 40, speciality: "Dermatology", phone: "9800000001", email: "aakash@hospital.com", nmcNumber: "NMC-1001", clinicId: "default", branchId: "default", isActive: true },
    { name: "Dr. Bimala Thapa", doctorType: "regular", defaultCommission: 45, speciality: "Cosmetology", phone: "9800000002", email: "bimala@hospital.com", nmcNumber: "NMC-1002", clinicId: "default", branchId: "default", isActive: true },
    { name: "Dr. Chirag Karki", doctorType: "visiting", defaultCommission: 50, speciality: "Laser Surgery", phone: "9800000003", email: "chirag@hospital.com", nmcNumber: "NMC-1003", clinicId: "default", branchId: "default", isActive: true },
    { name: "Dr. Diksha Gurung", doctorType: "regular", defaultCommission: 40, speciality: "Dermatology", phone: "9800000004", email: "diksha@hospital.com", nmcNumber: "NMC-1004", clinicId: "default", branchId: "default", isActive: true },
    { name: "Dr. Eshan Rai", doctorType: "visiting", defaultCommission: 60, speciality: "Plastic Surgery", phone: "9800000005", email: "eshan@hospital.com", nmcNumber: "NMC-1005", clinicId: "default", branchId: "default", isActive: true },
];

const mockExperts = [
    { name: "Exp. Alisha Shrestha", expertType: "regular", defaultCommission: 30, speciality: "Laser Technician", phone: "9810000001", email: "alisha@hospital.com", licenseNumber: "LIC-2001", clinicId: "default", branchId: "default", isActive: true },
    { name: "Exp. Bikash Tamang", expertType: "regular", defaultCommission: 30, speciality: "Skin Therapist", phone: "9810000002", email: "bikash@hospital.com", licenseNumber: "LIC-2002", clinicId: "default", branchId: "default", isActive: true },
    { name: "Exp. Chanda Magar", expertType: "visiting", defaultCommission: 35, speciality: "Hair Transplant Tech", phone: "9810000003", email: "chanda@hospital.com", licenseNumber: "LIC-2003", clinicId: "default", branchId: "default", isActive: true },
    { name: "Exp. Dipendra KC", expertType: "regular", defaultCommission: 30, speciality: "Aesthetician", phone: "9810000004", email: "dipendra@hospital.com", licenseNumber: "LIC-2004", clinicId: "default", branchId: "default", isActive: true },
    { name: "Exp. Eliza Basnet", expertType: "visiting", defaultCommission: 40, speciality: "Advanced Laser Tech", phone: "9810000005", email: "eliza@hospital.com", licenseNumber: "LIC-2005", clinicId: "default", branchId: "default", isActive: true },
];

async function seedData() {
    console.log('Seeding 5 Doctors...');
    const doctorsRef = collection(db, 'doctors');
    for (const doc of mockDoctors) {
        await addDoc(doctorsRef, {
            ...doc,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }
    console.log('Doctors seeded successfully.');

    console.log('Seeding 5 Experts...');
    const expertsRef = collection(db, 'experts');
    for (const exp of mockExperts) {
        await addDoc(expertsRef, {
            ...exp,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }
    console.log('Experts seeded successfully.');

    process.exit(0);
}

seedData().catch(console.error);
