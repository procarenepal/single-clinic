import React, { useState } from "react";
import { collection, getDocs, writeBatch } from "firebase/firestore";

import { db } from "@/config/firebase";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function DatabaseCleaner() {
  const { clinicId } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const clearData = async () => {
    if (!clinicId) return;
    const confirmDelete = window.confirm(
      "Are you absolutely sure? This will delete all transactional data (patients, appointments, etc.) for this clinic!",
    );

    if (!confirmDelete) return;

    setLoading(true);
    setMessage("Clearing data...");

    const collectionsToClear = [
      "patients",
      "appointments",
      "prescriptions",
      "billing",
      "appointmentBilling",
      "medicinePurchases",
      "pathology_requests",
      "call_logs",
      "visitors",
      "enquiries",
      "users",
      "doctors",
      "experts",
      "medicines",
      "medicines_catalog",
      "pathology_tests",
      "pathology_categories",
      "pathologyBilling",
      "expenses",
      "documents",
    ];

    try {
      for (const colName of collectionsToClear) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);

        // We delete documents where clinicId matches, just to be safe
        const batch = writeBatch(db);
        let count = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();

          // DO NOT delete the target user or doctor with this email
          if (data.email === "karanbohara216@gmail.com") {
            return;
          }

          if (data.clinicId === clinicId) {
            batch.delete(doc.ref);
            count++;
          }
        });

        if (count > 0) {
          await batch.commit();
        }
      }

      setMessage("Database cleared successfully! Please refresh the page.");
    } catch (error) {
      console.error("Error clearing database:", error);
      setMessage("Error clearing database. Check console.");
    } finally {
      setLoading(false);
    }
  };

  if (!clinicId) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between">
      <div>
        <h3 className="text-red-800 font-bold text-sm">
          DEVELOPER TOOL: Database Cleaner
        </h3>
        <p className="text-red-600 text-xs mt-1">
          {message ||
            "Wipe all patients, appointments, and prescriptions to test a fresh patient flow."}
        </p>
      </div>
      <Button color="danger" disabled={loading} onClick={clearData}>
        {loading ? "Nuking..." : "Nuke Clinic Data"}
      </Button>
    </div>
  );
}
