import React, { useState } from "react";
import { collection, writeBatch, doc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const MEDICINE_BASES = [
  { name: "Paracetamol", type: "Tablet", unit: "tablet", strength: "500mg", rx: false },
  { name: "Ibuprofen", type: "Tablet", unit: "tablet", strength: "400mg", rx: false },
  { name: "Amoxicillin", type: "Capsule", unit: "capsule", strength: "500mg", rx: true },
  { name: "Cetirizine", type: "Tablet", unit: "tablet", strength: "10mg", rx: false },
  { name: "Omeprazole", type: "Capsule", unit: "capsule", strength: "20mg", rx: true },
  { name: "Azithromycin", type: "Tablet", unit: "tablet", strength: "250mg", rx: true },
  { name: "Diclofenac", type: "Gel", unit: "tube", strength: "1%", rx: false },
  { name: "Amlodipine", type: "Tablet", unit: "tablet", strength: "5mg", rx: true },
  { name: "Metformin", type: "Tablet", unit: "tablet", strength: "500mg", rx: true },
  { name: "Pantoprazole", type: "Tablet", unit: "tablet", strength: "40mg", rx: true },
  { name: "Ciprofloxacin", type: "Tablet", unit: "tablet", strength: "500mg", rx: true },
  { name: "Loratadine", type: "Tablet", unit: "tablet", strength: "10mg", rx: false },
  { name: "Salbutamol", type: "Inhaler", unit: "piece", strength: "100mcg", rx: true },
  { name: "Aspirin", type: "Tablet", unit: "tablet", strength: "75mg", rx: false },
  { name: "Atorvastatin", type: "Tablet", unit: "tablet", strength: "20mg", rx: true },
  { name: "Dexamethasone", type: "Injection", unit: "vial", strength: "4mg/ml", rx: true },
  { name: "Ondansetron", type: "Tablet", unit: "tablet", strength: "4mg", rx: true },
  { name: "Ranitidine", type: "Tablet", unit: "tablet", strength: "150mg", rx: false },
  { name: "Fluconazole", type: "Capsule", unit: "capsule", strength: "150mg", rx: true },
  { name: "Levothyroxine", type: "Tablet", unit: "tablet", strength: "50mcg", rx: true },
];

const MANUFACTURERS = ["PharmaCorp", "MediLife Labs", "Global Health", "CureAll Inc.", "BioGenics", "HealthPrime"];

export default function MedicineSeeder() {
  const { clinicId, currentUser } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const seedMedicines = async () => {
    if (!clinicId || !currentUser) return;
    const confirmSeed = window.confirm("Seed 100 realistic medicines into the clinic?");
    if (!confirmSeed) return;

    setLoading(true);
    setMessage("Generating and seeding 100 medicines...");

    try {
      const medicinesCol = collection(db, "medicines");
      
      // Firestore batches can handle up to 500 operations
      const batch = writeBatch(db);

      for (let i = 0; i < 100; i++) {
        const base = MEDICINE_BASES[i % MEDICINE_BASES.length];
        const manufacturer = MANUFACTURERS[Math.floor(Math.random() * MANUFACTURERS.length)];
        
        // Add variations to make 100 unique medicines
        const variation = Math.floor(i / MEDICINE_BASES.length) + 1;
        const medicineName = variation > 1 ? `${base.name} (Var ${variation})` : base.name;
        
        const costPrice = Math.floor(Math.random() * 50) + 5; // 5 to 55
        const price = costPrice + Math.floor(Math.random() * 20) + 5; // Markup of 5 to 25

        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + Math.floor(Math.random() * 3) + 1); // 1-3 years from now

        const docRef = doc(medicinesCol); // Auto-generate ID
        
        batch.set(docRef, {
          id: docRef.id,
          name: medicineName,
          genericName: base.name,
          type: base.type,
          strength: base.strength,
          unit: base.unit,
          description: `Standard ${base.name} used for various treatments.`,
          manufacturer: manufacturer,
          batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
          expiryDate: expiryDate,
          price: price,
          costPrice: costPrice,
          barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
          prescriptionRequired: base.rx,
          isActive: true,
          isVatApplied: false,
          vatPercentage: 0,
          clinicId: clinicId,
          branchId: "main",
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser.uid,
        });
      }

      await batch.commit();

      setMessage("✅ Successfully seeded 100 medicines! Please refresh the page.");
    } catch (error) {
      console.error("Error seeding medicines:", error);
      setMessage("❌ Error seeding medicines. Check console.");
    } finally {
      setLoading(false);
    }
  };

  if (!clinicId) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center justify-between">
      <div>
        <h3 className="text-emerald-800 font-bold text-sm">DEVELOPER TOOL: Medicine Seeder</h3>
        <p className="text-emerald-600 text-xs mt-1">
          {message || "Seed 100 realistic medicines into the catalog for testing."}
        </p>
      </div>
      <Button 
        color="success" 
        onClick={seedMedicines} 
        disabled={loading}
      >
        {loading ? "Seeding..." : "Seed 100 Medicines"}
      </Button>
    </div>
  );
}
