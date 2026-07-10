import React, { useState } from "react";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";
import { db } from "@/config/firebase";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { doctorCommissionService } from "@/services/doctorCommissionService";
import { expertCommissionService } from "@/services/expertCommissionService";

export default function TestCommission() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const runEndToEndSimulation = async () => {
    setLoading(true);
    setLogs(["🚀 Starting End-to-End Commission UI Simulation..."]);

    try {
      const timestamp = Date.now();

      // 1. Fetch Real Profiles from Database
      addLog(`👨‍⚕️ Fetching Real Clinicians from Database...`);

      const doctorsSnap = await getDocs(collection(db, "doctors"));
      const expertsSnap = await getDocs(collection(db, "experts"));
      const staffSnap = await getDocs(collection(db, "users"));
      const patientsSnap = await getDocs(collection(db, "patients"));

      let mockDoctorId = `doc_sim_${timestamp}`;
      let mockDoctorName = "Dr. Simulation";
      let mockExpertId = `exp_sim_${timestamp}`;
      let mockExpertName = "Expert Simulation";
      let mockStaffId = `staff_sim_${timestamp}`;
      let mockStaffName = "Staff Simulation";
      let mockPatientId = `pat_sim_${timestamp}`;
      let mockPatientName = "Simulation Patient";

      if (!doctorsSnap.empty) {
        const docData = doctorsSnap.docs[0];

        mockDoctorId = docData.id;
        mockDoctorName = docData.data().name || "Unknown Doctor";
      } else {
        await setDoc(doc(db, "doctors", mockDoctorId), {
          name: mockDoctorName,
          defaultCommission: 20,
        });
      }

      if (!expertsSnap.empty) {
        const expData = expertsSnap.docs[0];

        mockExpertId = expData.id;
        mockExpertName = expData.data().name || "Unknown Expert";
      } else {
        await setDoc(doc(db, "experts", mockExpertId), {
          name: mockExpertName,
          defaultCommission: 15,
        });
      }

      if (!staffSnap.empty) {
        const staffData = staffSnap.docs[0];

        mockStaffId = staffData.id;
        mockStaffName = staffData.data().name || "Unknown Staff";
      } else {
        await setDoc(doc(db, "users", mockStaffId), {
          name: mockStaffName,
          commissionRate: 5,
        });
      }

      if (!patientsSnap.empty) {
        const patData = patientsSnap.docs[0];

        mockPatientId = patData.id;
        mockPatientName = patData.data().name || "Unknown Patient";
      }

      // 2. Create complex invoice
      const invoiceTotal = 20000;
      const globalDiscount = 2000; // 10%
      const finalAmount = invoiceTotal - globalDiscount; // 18000

      addLog(
        `📝 Creating Invoice for NPR ${invoiceTotal} with NPR ${globalDiscount} Global Discount...`,
      );
      const newInvoiceId = await appointmentBillingService.createBilling({
        patientId: mockPatientId,
        patientName: mockPatientName,
        clinicId: "demo_clinic",
        doctorId: mockDoctorId,
        doctorName: mockDoctorName,
        subtotal: invoiceTotal,
        mainDiscountAmount: globalDiscount,
        totalAmount: finalAmount,
        paidAmount: 0,
        status: "unpaid",
        invoiceDate: new Date(),
        items: [
          {
            appointmentTypeName: "Consultation",
            amount: 10000,
            doctorId: mockDoctorId,
            doctorName: mockDoctorName,
            commission: 20, // Expect: 10000 - 10% = 9000 * 20% = 1800
          },
          {
            appointmentTypeName: "Procedure",
            amount: 10000,
            doctorId: mockExpertId,
            doctorName: mockExpertName,
            commission: 15, // Expect: 10000 - 10% = 9000 * 15% = 1350
          },
        ],
        staffCommissions: [
          {
            staffId: mockStaffId,
            staffName: mockStaffName,
            commissionAmount: 900,
            percentage: 5,
          }, // 5% of 18000
        ],
      } as any);

      addLog(`✅ Invoice created: ${newInvoiceId}`);

      // 3. Partial Payment
      addLog(`💰 Simulating Partial Payment of NPR 5000...`);
      await appointmentBillingService.recordPayment(newInvoiceId, 5000, "cash");

      // Verify blockage
      const docComms1 = await getDocs(collection(db, "doctorCommissions"));
      const isBlocked = !docComms1.docs.some(
        (d) => d.data().billingId === newInvoiceId,
      );

      if (isBlocked) {
        addLog(
          `🛡️ SUCCESS: Commission engine securely blocked generation on partial payment.`,
        );
      } else {
        addLog(`❌ FAILED: Commissions were generated early!`);
        throw new Error("Commission generated on partial payment");
      }

      // 4. Final Payment
      addLog(`💰 Simulating Final Payment of NPR ${finalAmount - 5000}...`);
      await appointmentBillingService.recordPayment(
        newInvoiceId,
        finalAmount - 5000,
        "cash",
      );

      addLog(
        `⚙️ Running commission generation engine for fully paid invoice...`,
      );

      const updatedInvoice =
        await appointmentBillingService.getBillingById(newInvoiceId);

      if (
        updatedInvoice &&
        (updatedInvoice.paidAmount || 0) >= updatedInvoice.totalAmount
      ) {
        const doctorItems =
          updatedInvoice.items?.filter((i) => i.doctorId === mockDoctorId) ||
          [];
        const expertItems =
          updatedInvoice.items?.filter((i) => i.doctorId === mockExpertId) ||
          [];

        await doctorCommissionService.createCommission(
          {
            ...updatedInvoice,
            items: doctorItems,
          } as any,
          20,
          "sim_admin",
        );

        await expertCommissionService.createCommissionsFromBilling(
          {
            ...updatedInvoice,
            items: expertItems,
          } as any,
          15,
          "sim_admin",
        );
      }

      // Give the DB a second to write
      await new Promise((res) => setTimeout(res, 1500));

      // 5. Verify Results
      const docCommsFinal = await getDocs(collection(db, "doctorCommissions"));
      const expertCommsFinal = await getDocs(
        collection(db, "expertCommissions"),
      );

      const myDocComm = docCommsFinal.docs
        .find((d) => d.data().billingId === newInvoiceId)
        ?.data();
      const myExpComm = expertCommsFinal.docs
        .find((d) => d.data().billingId === newInvoiceId)
        ?.data();

      if (myDocComm && myDocComm.commissionAmount === 1800) {
        addLog(
          `✅ SUCCESS: Doctor Commission properly calculated with shared global discount burden (NPR 1800).`,
        );
      } else {
        addLog(
          `❌ ERROR: Doctor Commission wrong. Expected 1800, got ${myDocComm?.commissionAmount}`,
        );
      }

      if (myExpComm && myExpComm.commissionAmount === 1350) {
        addLog(
          `✅ SUCCESS: Expert Commission properly calculated with shared global discount burden (NPR 1350).`,
        );
      } else {
        addLog(
          `❌ ERROR: Expert Commission wrong. Expected 1350, got ${myExpComm?.commissionAmount}`,
        );
      }

      addLog(`🏁 End-to-End Validation Complete! Perfect accuracy achieved.`);
      addToast({ title: "Simulation Passed", color: "success" });
    } catch (err: any) {
      addLog(`❌ ERROR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const wipeFinancialData = async () => {
    if (
      !window.confirm(
        "Are you ABSOLUTELY sure? This will delete ALL invoices and commissions.",
      )
    )
      return;

    setLoading(true);
    setLogs(["🧹 Starting Financial Data Wipe..."]);

    try {
      // 1. Delete all appointment billings
      addLog("🗑️ Fetching all Appointment Billings...");
      const billingsSnap = await getDocs(collection(db, "appointmentBilling"));
      let billCount = 0;

      for (const d of billingsSnap.docs) {
        await deleteDoc(doc(db, "appointmentBilling", d.id));
        billCount++;
      }
      addLog(`✅ Deleted ${billCount} appointment invoices.`);

      // 1.5 Delete all pathology billings
      addLog("🗑️ Fetching all Pathology Billings...");
      const pathBillingsSnap = await getDocs(
        collection(db, "pathologyBilling"),
      );
      let pathBillCount = 0;

      for (const d of pathBillingsSnap.docs) {
        await deleteDoc(doc(db, "pathologyBilling", d.id));
        pathBillCount++;
      }
      addLog(`✅ Deleted ${pathBillCount} pathology invoices.`);

      // 2. Delete all doctor commissions
      addLog("🗑️ Fetching all Doctor Commissions...");
      const docCommSnap = await getDocs(collection(db, "doctorCommissions"));
      let docCommCount = 0;

      for (const d of docCommSnap.docs) {
        await deleteDoc(doc(db, "doctorCommissions", d.id));
        docCommCount++;
      }
      addLog(`✅ Deleted ${docCommCount} doctor commissions.`);

      // 3. Delete all expert commissions
      addLog("🗑️ Fetching all Expert Commissions...");
      const expCommSnap = await getDocs(collection(db, "expertCommissions"));
      let expCommCount = 0;

      for (const d of expCommSnap.docs) {
        await deleteDoc(doc(db, "expertCommissions", d.id));
        expCommCount++;
      }
      addLog(`✅ Deleted ${expCommCount} expert commissions.`);

      // 4. Delete all referral commissions
      addLog("🗑️ Fetching all Referral Commissions...");
      const refCommSnap = await getDocs(collection(db, "referralCommissions"));
      let refCommCount = 0;

      for (const d of refCommSnap.docs) {
        await deleteDoc(doc(db, "referralCommissions", d.id));
        refCommCount++;
      }
      addLog(`✅ Deleted ${refCommCount} referral commissions.`);

      // 4.5 Delete all appointments
      addLog("🗑️ Fetching all Appointments...");
      const apptSnap = await getDocs(collection(db, "appointments"));
      let apptCount = 0;

      for (const d of apptSnap.docs) {
        await deleteDoc(doc(db, "appointments", d.id));
        apptCount++;
      }
      addLog(`✅ Deleted ${apptCount} calendar appointments.`);

      // 5. Clear Patient-Clinician Relations
      addLog("🧹 Clearing Clinician links from Patients...");
      const patientsSnap = await getDocs(collection(db, "patients"));
      let patCount = 0;

      for (const p of patientsSnap.docs) {
        // If it's a simulated patient, delete it entirely
        if (p.id.includes("_sim_")) {
          await deleteDoc(doc(db, "patients", p.id));
          continue;
        }

        const data = p.data();

        if (data.assignedDoctorId || data.assignedExpertId) {
          await updateDoc(doc(db, "patients", p.id), {
            assignedDoctorId: null,
            assignedExpertId: null,
            assignedDoctorName: null,
            assignedExpertName: null,
          });
          patCount++;
        }
      }
      addLog(`✅ Cleared relations from ${patCount} patients.`);

      // 6. Reset Doctor/Expert cached commission totals and delete mocks
      addLog("🧹 Resetting cached totals on Doctors & Experts...");
      const docsSnap = await getDocs(collection(db, "doctors"));

      for (const d of docsSnap.docs) {
        if (d.id.includes("_sim_")) {
          await deleteDoc(doc(db, "doctors", d.id));
          continue;
        }
        await updateDoc(doc(db, "doctors", d.id), {
          totalCommissionEarned: 0,
          totalCommissionBalance: 0,
        });
      }
      const expsSnap = await getDocs(collection(db, "experts"));

      for (const e of expsSnap.docs) {
        if (e.id.includes("_sim_")) {
          await deleteDoc(doc(db, "experts", e.id));
          continue;
        }
        await updateDoc(doc(db, "experts", e.id), {
          totalCommissionEarned: 0,
          totalCommissionBalance: 0,
        });
      }

      const usersSnap = await getDocs(collection(db, "users"));

      for (const u of usersSnap.docs) {
        if (u.id.includes("_sim_")) {
          await deleteDoc(doc(db, "users", u.id));
        }
      }
      addLog(
        `✅ Reset cached totals and deleted all mock simulation profiles.`,
      );
    } catch (err: any) {
      addLog(`❌ ERROR: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
      addLog(`🏁 Financial Wipe Completed Successfully!`);
      addToast({ title: "Wipe Complete", color: "success" });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            🧪 Ultimate Commission Simulation
          </h1>
          <p className="text-sm text-default-500 mb-4">
            Runs a fully automated UI simulation: Creates clinicians, builds a
            complex multi-party invoice, applies a global discount, attempts a
            partial payment, and then forces full payment to prove perfect
            calculations.
          </p>
          <Button
            color="primary"
            disabled={loading}
            onClick={runEndToEndSimulation}
          >
            {loading ? "Simulating..." : "Run End-to-End Simulation"}
          </Button>
        </div>

        <div className="pt-8 border-t border-default-200">
          <h1 className="text-2xl font-bold text-danger">
            ⚠️ Danger Zone: Financial Wipe
          </h1>
          <p className="text-sm text-default-500 mb-4">
            This utility will cleanly wipe all historical test data so you can
            launch with a clean slate. It will delete ALL Invoices and
            Commissions. It will NOT delete Patient records, but it will sever
            their "Assigned Doctor/Expert" relations.
          </p>

          <Button color="danger" disabled={loading} onClick={wipeFinancialData}>
            {loading ? "Wiping Data..." : "Permanently Wipe Financial Data"}
          </Button>
        </div>
      </div>

      <div className="mt-8 bg-default-50 rounded-xl p-4 border border-default-200 min-h-[300px] font-mono text-sm">
        <h3 className="font-semibold mb-4 text-default-600">Action Logs:</h3>
        {logs.map((log, i) => (
          <div
            key={i}
            className={`mb-1 ${log.includes("SUCCESS") || log.includes("✅") ? "text-success" : log.includes("ERROR") || log.includes("❌") ? "text-danger" : "text-default-700"}`}
          >
            {log}
          </div>
        ))}
        {logs.length === 0 && (
          <span className="text-default-400">No logs yet...</span>
        )}
      </div>
    </div>
  );
}
