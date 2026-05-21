// src/scripts/seed-medicines.ts
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { medicineService } from "../services/medicineService";

async function seedMedicinesDirectly() {
  console.log("🌱 Starting Medicine Seeding from terminal...");

  // 1. Get all clinics
  const clinicsRef = collection(db, "clinics");
  const clinicsSnapshot = await getDocs(clinicsRef);
  const clinics = clinicsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  if (clinics.length === 0) {
    console.log("❌ No clinics found in the database. Cannot seed medicines.");

    return;
  }

  console.log(`✓ Found ${clinics.length} clinics in the system.`);

  // 2. Loop and seed for each clinic
  for (const clinic of clinics) {
    const clinicId = clinic.id;

    console.log(`\n--------------------------------------------`);
    console.log(
      `Cleaning and Seeding for Clinic: ${(clinic as any).name || clinicId}`,
    );

    // Find a user belonging to this clinic to act as creator
    const usersRef = collection(db, "users");
    const qUser = query(usersRef, where("clinicId", "==", clinicId));
    const usersSnapshot = await getDocs(qUser);

    let userId = "system-seeder";

    if (!usersSnapshot.empty) {
      userId = usersSnapshot.docs[0].id;
      console.log(
        `✓ Using active user: ${userId} (${(usersSnapshot.docs[0].data() as any).name || "Unnamed"})`,
      );
    } else {
      const allUsersSnapshot = await getDocs(usersRef);

      if (!allUsersSnapshot.empty) {
        userId = allUsersSnapshot.docs[0].id;
      }
    }

    // --- CLEANUP FIRST ---
    console.log("🧹 Cleaning up old medicine data for a clean slate...");

    // A. Delete Medicine Stock Records
    const stockRef = collection(db, "medicineStock");
    const qStock = query(stockRef, where("clinicId", "==", clinicId));
    const stockSnapshot = await getDocs(qStock);

    for (const d of stockSnapshot.docs) {
      await deleteDoc(doc(db, "medicineStock", d.id));
    }
    console.log(`✓ Deleted ${stockSnapshot.docs.length} stock documents.`);

    // B. Delete Stock Transactions
    const txRef = collection(db, "stockTransactions");
    const qTx = query(txRef, where("clinicId", "==", clinicId));
    const txSnapshot = await getDocs(qTx);

    for (const d of txSnapshot.docs) {
      await deleteDoc(doc(db, "stockTransactions", d.id));
    }
    console.log(`✓ Deleted ${txSnapshot.docs.length} stock transactions.`);

    // C. Delete Medicines
    const medRef = collection(db, "medicines");
    const qMed = query(medRef, where("clinicId", "==", clinicId));
    const medSnapshot = await getDocs(qMed);

    for (const d of medSnapshot.docs) {
      await deleteDoc(doc(db, "medicines", d.id));
    }
    console.log(`✓ Deleted ${medSnapshot.docs.length} medicine documents.`);

    // D. Delete Categories
    const catRef = collection(db, "medicineCategories");
    const qCat = query(catRef, where("clinicId", "==", clinicId));
    const catSnapshot = await getDocs(qCat);

    for (const d of catSnapshot.docs) {
      await deleteDoc(doc(db, "medicineCategories", d.id));
    }
    console.log(`✓ Deleted ${catSnapshot.docs.length} category documents.`);

    // E. Delete Brands
    const brandRef = collection(db, "medicineBrands");
    const qBrand = query(brandRef, where("clinicId", "==", clinicId));
    const brandSnapshot = await getDocs(qBrand);

    for (const d of brandSnapshot.docs) {
      await deleteDoc(doc(db, "medicineBrands", d.id));
    }
    console.log(`✓ Deleted ${brandSnapshot.docs.length} brand documents.`);

    // --- SEEDING ---
    try {
      console.log(
        `⏳ Seeding 50 medicines with complete stock records and audit trails...`,
      );
      await medicineService.seedDefaultMedicines(clinicId, undefined, userId);
      console.log(
        `✨ Successfully seeded 50 medicines and stock records for clinic ${clinicId}!`,
      );
    } catch (err) {
      console.error(`❌ Failed to seed medicines for clinic ${clinicId}:`, err);
    }
  }

  console.log("\n============================================");
  console.log("🎉 Seeding script execution finished!");
  process.exit(0);
}

seedMedicinesDirectly().catch((err) => {
  console.error("❌ Seeding failed with unexpected error:", err);
  process.exit(1);
});
