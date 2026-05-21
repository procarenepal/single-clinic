import React, { useState } from "react";
import { collection, writeBatch, doc } from "firebase/firestore";

import { db } from "@/config/firebase";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const DOCTOR_NAMES = [
  "Dr. Sarah Jenkins",
  "Dr. Marcus Chen",
  "Dr. Emily Roberts",
  "Dr. David Kumar",
  "Dr. Michael Chang",
  "Dr. Olivia Bennett",
  "Dr. James Wilson",
  "Dr. Sophia Patel",
  "Dr. William Hayes",
  "Dr. Emma Thompson",
];

const EXPERT_NAMES = [
  "Dr. Robert Fox (Dermatologist)",
  "Dr. Alice Cooper (Cardiologist)",
  "Dr. John Watson (Neurologist)",
  "Dr. Mary Jane (Pediatrician)",
  "Dr. Peter Parker (Orthopedic)",
  "Dr. Bruce Wayne (Surgeon)",
  "Dr. Clark Kent (Optometrist)",
  "Dr. Diana Prince (Gynecologist)",
  "Dr. Barry Allen (Physiotherapist)",
  "Dr. Arthur Curry (ENT)",
];

const SUPPLIER_NAMES = [
  "MediLife Distributors",
  "PharmaCorp Global",
  "HealthPrime Supplies",
  "CureAll Logistics",
  "BioGenics Wholesale",
  "Apex Medical Suppliers",
  "NovaCare Pharma",
  "Sunrise Healthcare",
  "Pioneer Medical",
  "Guardian Health",
];

export default function StaffSeeder() {
  const { clinicId, currentUser } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const seedStaff = async () => {
    if (!clinicId || !currentUser) return;
    const confirmSeed = window.confirm(
      "Seed 10 Doctors, 10 Experts, and 10 Suppliers?",
    );

    if (!confirmSeed) return;

    setLoading(true);
    setMessage("Seeding staff and suppliers...");

    try {
      const batch = writeBatch(db);

      // Seed 10 Doctors
      const doctorsCol = collection(db, "doctors");

      for (let i = 0; i < 10; i++) {
        const docRef = doc(doctorsCol);

        batch.set(docRef, {
          id: docRef.id,
          name: DOCTOR_NAMES[i],
          doctorType: i % 3 === 0 ? "visiting" : "regular",
          defaultCommission: Math.floor(Math.random() * 30) + 10, // 10% to 40%
          speciality: "General Medicine",
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          email: `doctor${i + 1}@example.com`,
          nmcNumber: `NMC-${Math.floor(1000 + Math.random() * 9000)}`,
          clinicId: clinicId,
          branchId: "main",
          isActive: true,
          consultationCharge: Math.floor(Math.random() * 5 + 5) * 100, // 500 to 1000
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser.uid,
        });
      }

      // Seed 10 Experts
      const expertsCol = collection(db, "experts");

      for (let i = 0; i < 10; i++) {
        const docRef = doc(expertsCol);

        batch.set(docRef, {
          id: docRef.id,
          name: EXPERT_NAMES[i],
          expertType: i % 2 === 0 ? "visiting" : "regular",
          defaultCommission: Math.floor(Math.random() * 40) + 20, // 20% to 60%
          speciality: EXPERT_NAMES[i].split("(")[1].replace(")", ""),
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          email: `expert${i + 1}@example.com`,
          licenseNumber: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
          clinicId: clinicId,
          branchId: "main",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser.uid,
        });
      }

      // Seed 10 Suppliers
      const suppliersCol = collection(db, "suppliers");

      for (let i = 0; i < 10; i++) {
        const docRef = doc(suppliersCol);

        batch.set(docRef, {
          id: docRef.id,
          name: SUPPLIER_NAMES[i],
          contactPerson: `Contact Person ${i + 1}`,
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          email: `supplier${i + 1}@example.com`,
          address: `Supplier Address ${i + 1}, City`,
          licenseNumber: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
          clinicId: clinicId,
          branchId: "main",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser.uid,
        });
      }

      await batch.commit();

      // Clear cache so the newly seeded data shows up immediately
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(`procaresoft-cache:doctors:${clinicId}`);
        window.localStorage.removeItem(`procaresoft-cache:doctors:standalone`);
      }

      setMessage(
        "✅ Successfully seeded 10 Doctors, 10 Experts, and 10 Suppliers!",
      );
    } catch (error) {
      console.error("Error seeding staff:", error);
      setMessage("❌ Error seeding data. Check console.");
    } finally {
      setLoading(false);
    }
  };

  if (!clinicId) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
      <div>
        <h3 className="text-blue-800 font-bold text-sm">
          DEVELOPER TOOL: Staff & Supplier Seeder
        </h3>
        <p className="text-blue-600 text-xs mt-1">
          {message ||
            "Seed 10 Doctors, 10 Experts, and 10 Medicine Suppliers for testing."}
        </p>
      </div>
      <Button color="primary" disabled={loading} onClick={seedStaff}>
        {loading ? "Seeding..." : "Seed Staff & Suppliers"}
      </Button>
    </div>
  );
}
