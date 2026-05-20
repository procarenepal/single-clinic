import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { title } from "@/components/primitives";
import {
  IoPeopleOutline,
  IoCallOutline,
  IoTimeOutline,
  IoAddOutline,
  IoEyeOutline,
  IoCalendarOutline,
  IoPhonePortraitOutline,
  IoCheckmarkCircleOutline,
  IoPlayOutline,
  IoCardOutline,
  IoCloseOutline,
  IoHeartOutline,
  IoThermometerOutline,
  IoSpeedometerOutline,
  IoBodyOutline,
  IoWarningOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoReceiptOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { prescriptionService } from "@/services/prescriptionService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { PatientNoteEntriesService } from "@/services/patientNoteEntriesService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { referralCommissionService } from "@/services/referralCommissionService";
import { doctorCommissionService } from "@/services/doctorCommissionService";
import { expertCommissionService } from "@/services/expertCommissionService";
import { staffCommissionService } from "@/services/staffCommissionService";
import { expertService } from "@/services/expertService";
import { hrService } from "@/services/hrService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { Appointment, Patient, Doctor, AppointmentType, ReferralPartner, Expert, StaffMember } from "@/types/models";
import { Spinner } from "@/components/ui";
import { isToday } from "date-fns";
import { db } from "@/config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { NotificationService } from "@/services/notificationService";

export default function FrontOfficeDesk() {
  const navigate = useNavigate();
  const { clinicId, currentUser, branchId, userData } = useAuthContext();

  // Real-time queue data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [billings, setBillings] = useState<any[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  // App states
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"lobby" | "triage" | "doctor" | "expert" | "billing" | "pharmacy" | "all">("lobby");

  // Auto-switch active tab based on resolved doctor/expert role
  useEffect(() => {
    const isDoc = doctors.some((d) => d.email?.toLowerCase() === currentUser?.email?.toLowerCase());
    const isExp = experts.some((e) => e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
    if (isDoc) {
      setActiveTab("doctor");
    } else if (isExp) {
      setActiveTab("expert");
    }
  }, [doctors, experts, currentUser?.email]);

  // Seed demo doctor and expert
  const seedDemoDoctorAndExpert = async () => {
    if (!clinicId) {
      addToast({
        title: "Seed Error",
        description: "Clinic ID not found. Please log in.",
        color: "danger",
      });
      return;
    }

    try {
      const { doc, setDoc } = await import("firebase/firestore");

      // 1. Seed Doctor
      const demoDoctorId = "doctor_karan";
      const doctorRef = doc(db, "doctors", demoDoctorId);
      await setDoc(doctorRef, {
        id: demoDoctorId,
        name: "Dr. Karan Bohara",
        doctorType: "regular",
        defaultCommission: 10,
        speciality: "Dermatology & Aesthetics",
        phone: "9876543210",
        email: "doctor@procaresoft.com",
        nmcNumber: "NMC-12345",
        clinicId: clinicId,
        branchId: branchId || clinicId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser?.uid || "system",
      });

      // 2. Seed Expert
      const demoExpertId = "expert_deepak";
      const expertRef = doc(db, "experts", demoExpertId);
      await setDoc(expertRef, {
        id: demoExpertId,
        name: "Deepak Sharma",
        expertType: "regular",
        defaultCommission: 15,
        speciality: "Skin & Laser Therapy Specialist",
        phone: "9876543211",
        email: "expert@procaresoft.com",
        licenseNumber: "LIC-98765",
        clinicId: clinicId,
        branchId: branchId || clinicId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser?.uid || "system",
      });

      addToast({
        title: "Seed Successful",
        description: "Doctor (doctor@procaresoft.com) and Expert (expert@procaresoft.com) seeded successfully.",
        color: "success",
      });
    } catch (err: any) {
      console.error("Error seeding demo clinicians:", err);
      addToast({
        title: "Seed Failed",
        description: err.message || "Failed to write seed data.",
        color: "danger",
      });
    }
  };

  // Triage modal state
  const [isTriageModalOpen, setIsTriageModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [triageSaving, setTriageSaving] = useState(false);
  const [vitals, setVitals] = useState({
    bpSystolic: "",
    bpDiastolic: "",
    pulse: "",
    temp: "",
    weight: "",
    spo2: "",
    complaints: "",
  });

  // Procedure log modal state
  const [isProcedureModalOpen, setIsProcedureModalOpen] = useState(false);
  const [procedureSaving, setProcedureSaving] = useState(false);
  const [historicalProcedures, setHistoricalProcedures] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [procedure, setProcedure] = useState({
    procedureType: "CO2 Laser Resurfacing",
    energy: "",
    spotSize: "",
    pulseWidth: "",
    passes: "",
    area: "Full Face",
    fee: "",
    notes: "",
  });

  // Quick walk-in intake modal state
  const [isQuickIntakeOpen, setIsQuickIntakeOpen] = useState(false);
  const [quickIntakeSaving, setQuickIntakeSaving] = useState(false);
  const [intakeMode, setIntakeMode] = useState<"new" | "existing">("new");
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [selectedExistingPatient, setSelectedExistingPatient] = useState<Patient | null>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);

  // Date filter for the queue
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [quickIntakeForm, setQuickIntakeForm] = useState({
    name: "",
    mobile: "",
    age: "",
    gender: "male",
    appointmentDate: new Date().toISOString().split("T")[0],
    doctorId: "",
    assignedExpertId: "",
    appointmentTypeId: "",
    reason: "",
    referralPartnerId: "",
    referrals: [] as Array<{
      type: "referral-partner" | "doctor" | "expert" | "staff";
      id: string;
      name: string;
      commissionPercentage: number;
      referredById?: string;
      referredByName?: string;
    }>,
  });

  // Mobile duplicate state
  const [mobileStatus, setMobileStatus] = useState<"idle" | "checking" | "duplicate" | "clear">("idle");

  useEffect(() => {
    const mobile = quickIntakeForm.mobile.trim();
    if (!mobile || mobile.length < 10 || !clinicId) {
      setMobileStatus("idle");
      return;
    }

    setMobileStatus("checking");
    const timeoutId = setTimeout(async () => {
      try {
        const exists = await patientService.checkMobileExists(mobile, clinicId);
        setMobileStatus(exists ? "duplicate" : "clear");
      } catch {
        setMobileStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [quickIntakeForm.mobile, clinicId]);

  // Load supporting data
  useEffect(() => {
    if (!clinicId) return;

    let isActive = true;
    const loadStaticData = async () => {
      try {
        const [patientsData, doctorsData, apptTypesData, referralPartnersData, expertsData, staffData] = await Promise.all([
          patientService.getPatients(clinicId),
          doctorService.getDoctors(clinicId),
          appointmentTypeService.getAppointmentTypesByClinic(clinicId, branchId || undefined),
          referralPartnerService.getReferralPartnersByClinic(clinicId, branchId || undefined),
          expertService.getExpertsByClinic(clinicId || undefined, branchId || undefined),
          hrService.getStaffByClinic(clinicId!, branchId || undefined),
        ]);

        if (isActive) {
          setPatients(patientsData);
          setDoctors(doctorsData);
          setAppointmentTypes(apptTypesData);
          setReferralPartners(referralPartnersData);
          setExperts(expertsData || []);
          setStaff(staffData || []);

          // Pre-select first doctor and first appointment type for quick walk-in intake
          if (doctorsData.length > 0) {
            setQuickIntakeForm(prev => ({ ...prev, doctorId: doctorsData[0].id }));
          }
          if (apptTypesData.length > 0) {
            setQuickIntakeForm(prev => ({ ...prev, appointmentTypeId: apptTypesData[0].id }));
          }
        }
      } catch (err) {
        console.error("Error loading supporting front-office data:", err);
      }
    };

    loadStaticData();
    return () => {
      isActive = false;
    };
  }, [clinicId, branchId]);

  // Live Sync Appointments & Billings
  useEffect(() => {
    if (!clinicId) return;

    setLoading(true);

    // Subscribe to Appointments
    const unsubscribeAppts = appointmentService.subscribeToClinicAppointments(
      undefined,
      branchId || undefined,
      (data) => {
        // Filter by selected date
        const filtered = data.filter((appt) => {
          const d = appt.appointmentDate;
          return (
            d.getFullYear() === selectedDate.getFullYear() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getDate() === selectedDate.getDate()
          );
        });
        setAppointments(filtered);
      },
      (err) => {
        console.error("Live appointments subscription error:", err);
      }
    );

    // Subscribe to Billings in real-time
    const billingCollection = collection(db, "appointmentBilling");
    let qBilling = query(billingCollection, where("clinicId", "==", clinicId));
    if (branchId) {
      qBilling = query(billingCollection, where("clinicId", "==", clinicId), where("branchId", "==", branchId));
    }

    const unsubscribeBillings = onSnapshot(
      qBilling,
      (snapshot) => {
        const records: any[] = [];
        snapshot.forEach((docSnap) => {
          records.push({ id: docSnap.id, ...docSnap.data() });
        });
        setBillings(records);
        setLoading(false);
      },
      (err) => {
        console.error("Live billings subscription error:", err);
        setLoading(false);
      }
    );

    // Subscribe to Prescriptions in real-time
    const prescriptionCollection = collection(db, "prescriptions");
    let qPrescription = query(prescriptionCollection, where("clinicId", "==", clinicId));
    if (branchId) {
      qPrescription = query(prescriptionCollection, where("clinicId", "==", clinicId), where("branchId", "==", branchId));
    }

    const unsubscribePrescriptions = onSnapshot(
      qPrescription,
      (snapshot) => {
        const records: any[] = [];
        snapshot.forEach((docSnap) => {
          records.push({ id: docSnap.id, ...docSnap.data() });
        });
        setPrescriptions(records);
      },
      (err) => {
        console.error("Live prescriptions subscription error:", err);
      }
    );

    return () => {
      unsubscribeAppts?.();
      unsubscribeBillings?.();
      unsubscribePrescriptions?.();
    };
  }, [clinicId, branchId, selectedDate]);

  // Helpers to resolve names
  const getPatientName = (patientId: string) =>
    patients.find((p) => p.id === patientId)?.name || "Walk-In Patient";

  const getPatientReg = (patientId: string) =>
    patients.find((p) => p.id === patientId)?.regNumber || "N/A";

  const getDoctorName = (appt: Appointment) => {
    const stage = getPatientStage(appt);
    const doc = doctors.find((d) => d.id === appt.doctorId);
    const exp = appt.assignedExpertId && appt.assignedExpertId !== "unassigned"
      ? experts.find((e) => e.id === appt.assignedExpertId)
      : null;

    if (doc && exp) {
      if (stage === "doctor") {
        return doc.name.startsWith("Dr.") ? doc.name : `Dr. ${doc.name}`;
      } else if (stage === "expert") {
        return exp.name;
      } else {
        const docFormatted = doc.name.startsWith("Dr.") ? doc.name : `Dr. ${doc.name}`;
        return `${docFormatted} / ${exp.name}`;
      }
    }

    if (exp) return exp.name;
    if (doc) return doc.name.startsWith("Dr.") ? doc.name : `Dr. ${doc.name}`;

    const fallbackExp = experts.find((e) => e.id === appt.doctorId);
    if (fallbackExp) return fallbackExp.name;

    return appt.doctorId === "unassigned" ? "Expert Cabin" : "Dr. Dermatologist";
  };

  const getDoctorSpeciality = (appt: Appointment) => {
    const stage = getPatientStage(appt);
    const doc = doctors.find((d) => d.id === appt.doctorId);
    const exp = appt.assignedExpertId && appt.assignedExpertId !== "unassigned"
      ? experts.find((e) => e.id === appt.assignedExpertId)
      : null;

    if (doc && exp) {
      if (stage === "doctor") {
        return doc.speciality || "Dermatology";
      } else if (stage === "expert") {
        return exp.speciality || "Skin & Laser Consultant";
      } else {
        return `${doc.speciality || "Dermatology"} & ${exp.speciality || "Laser Consultant"}`;
      }
    }

    if (exp) return exp.speciality || "Skin & Laser Consultant";
    if (doc) return doc.speciality || "Dermatology";

    const fallbackExp = experts.find((e) => e.id === appt.doctorId);
    if (fallbackExp) return fallbackExp.speciality || "Skin & Laser Consultant";

    return appt.doctorId === "unassigned" ? "Skin & Laser Consultant" : "Dermatologist";
  };

  const getApptTypeLabel = (typeId: string) =>
    appointmentTypes.find((t) => t.id === typeId)?.name || "General Checkup";

  const formatTimeTo12Hour = (time24: string): string => {
    if (!time24) return "Not set";
    try {
      const [hours, minutes] = time24.split(":");
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return time24;
    }
  };

  const createConsultationBill = async (
    patientId: string,
    doctorId: string,
    appointmentId: string,
    reason: string
  ) => {
    if (!clinicId) return;

    try {
      let pat = patients.find((p) => p.id === patientId);
      if (!pat && patientId) {
        try {
          pat = (await patientService.getPatientById(patientId)) || undefined;
        } catch (err) {
          console.error("Error loading patient for consultation billing:", err);
        }
      }

      let docInfo = doctors.find((d) => d.id === doctorId);
      if (!docInfo && doctorId && doctorId !== "unassigned") {
        try {
          docInfo = (await doctorService.getDoctorById(doctorId)) || undefined;
        } catch (err) {
          console.error("Error loading doctor for consultation billing:", err);
        }
      }

      // 1. Get consultation charge from doctor info (with a fallback to 500 NPR)
      let price = 500;
      if (docInfo && docInfo.consultationCharge !== undefined) {
        price = Number(docInfo.consultationCharge) || 0;
      }

      // 2. Resolve all referrers (polymorphic and multiple)
      const processedReferrals: Array<{
        type: "referral-partner" | "doctor" | "expert" | "staff";
        id: string;
        name: string;
        commissionPercentage: number;
        commissionAmount: number;
      }> = [];

      if (pat?.referrals && Array.isArray(pat.referrals) && pat.referrals.length > 0) {
        for (const ref of pat.referrals) {
          const pct = ref.commissionPercentage || 0;
          const amt = (price * pct) / 100;
          processedReferrals.push({
            type: ref.type,
            id: ref.id,
            name: ref.name,
            commissionPercentage: pct,
            commissionAmount: amt,
          });
        }
      } else if (pat?.referralPartnerId) {
        // Backward compatibility fallback: single referral partner ID
        try {
          const partner = await referralPartnerService.getReferralPartnerById(pat.referralPartnerId);
          if (partner) {
            const pct = partner.defaultCommission || 0;
            const amt = (price * pct) / 100;
            processedReferrals.push({
              type: "referral-partner",
              id: partner.id,
              name: partner.name,
              commissionPercentage: pct,
              commissionAmount: amt,
            });
          }
        } catch (err) {
          console.error("Error fetching fallback referral partner for automated billing:", err);
        }
      }

      // Keep primary partner values for legacy schema columns
      const primaryPartner = processedReferrals.find(r => r.type === "referral-partner");
      const refPartnerId = primaryPartner ? primaryPartner.id : (pat?.referralPartnerId || undefined);
      const refCommissionAmt = primaryPartner ? primaryPartner.commissionAmount : undefined;

      const invoiceNo = await appointmentBillingService.generateInvoiceNumber(clinicId!);

      const billingItem = {
        id: crypto.randomUUID(),
        appointmentTypeId: "consultation-fee",
        appointmentTypeName: `Doctor Consultation Fee - Dr. ${docInfo?.name || "GP"}`,
        price: price,
        quantity: 1,
        commission: docInfo?.defaultCommission || 0,
        doctorId: doctorId,
        doctorName: docInfo?.name || "Unknown Doctor",
        amount: price,
      };

      const billingData = {
        invoiceNumber: invoiceNo,
        clinicId: clinicId!,
        branchId: branchId || clinicId!,
        patientId: patientId,
        patientName: pat?.name || "Unknown Patient",
        doctorId: doctorId,
        doctorName: docInfo?.name || "Unknown Doctor",
        doctorType: (docInfo?.doctorType || "regular") as "regular" | "visitor",
        referralPartnerId: refPartnerId,
        referralCommissionAmount: refCommissionAmt && refCommissionAmt > 0 ? refCommissionAmt : undefined,
        referrals: processedReferrals, // Save complete polymorph referral ledger on invoice
        invoiceDate: new Date(),
        items: [billingItem],
        subtotal: price,
        itemDiscountAmount: 0,
        mainDiscountAmount: 0,
        discountType: "percent" as const,
        discountValue: 0,
        discountAmount: 0,
        taxPercentage: 0,
        taxAmount: 0,
        totalAmount: price,
        status: "draft" as const,
        paymentStatus: "unpaid" as const,
        paidAmount: 0,
        balanceAmount: price,
        createdBy: currentUser?.uid || "system",
      };

      const billingId = await appointmentBillingService.createBilling(billingData);

      // Link billing record to the appointment in Firestore
      await appointmentService.updateAppointment(appointmentId, {
        consultationBillingId: billingId,
        consultationBillingStatus: "unpaid",
        billingId: null,
        billingStatus: "unpaid",
        paymentStatus: "unpaid",
        updatedAt: new Date(),
      } as any);

      // Log commissions
      const creatorUserId = currentUser?.uid || "system";

      // 1) Log Consulting Doctor Commission
      if (docInfo?.defaultCommission && docInfo.defaultCommission > 0) {
        try {
          await doctorCommissionService.createCommission(
            {
              id: billingId,
              ...billingData,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any,
            docInfo.defaultCommission,
            creatorUserId
          );
        } catch (docCommErr) {
          console.error("Error creating consulting doctor commission:", docCommErr);
        }
      }

      // 2) Log Polymorphic Referrer Commissions
      for (const r of processedReferrals) {
        if (r.commissionAmount <= 0) continue;

        const billingRecord = {
          id: billingId,
          ...billingData,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;

        try {
          if (r.type === "referral-partner") {
            await referralCommissionService.createReferralCommission(
              billingRecord,
              {
                id: r.id,
                name: r.name,
                defaultCommission: r.commissionPercentage,
              } as any,
              r.commissionAmount,
              creatorUserId
            );
          } else if (r.type === "doctor") {
            const refBillingRecord = {
              ...billingRecord,
              doctorId: r.id,
              doctorName: r.name,
            };
            await doctorCommissionService.createCommission(
              refBillingRecord,
              r.commissionPercentage,
              creatorUserId
            );
          } else if (r.type === "expert") {
            await expertCommissionService.createCommission(
              r.id,
              r.name,
              billingRecord,
              r.commissionPercentage,
              creatorUserId
            );
          } else if (r.type === "staff") {
            await staffCommissionService.createRegistrationCommission(
              r.id,
              r.name,
              billingRecord.clinicId,
              billingRecord.branchId,
              billingRecord.patientId,
              billingRecord.patientName,
              `Doctor Consultation Fee - Dr. ${docInfo?.name || "GP"}`,
              price,
              r.commissionAmount,
              r.commissionPercentage,
              creatorUserId
            );
          }
        } catch (commErr) {
          console.error(`Error logging polymorphic commission for ${r.name} (${r.type}):`, commErr);
        }
      }

      console.log("Doctor Consultation Bill automatically generated:", billingId);
      return billingId;
    } catch (err) {
      console.error("Error automatically generating consultation bill:", err);
      throw err;
    }
  };

  // Dynamic state machine triggers
  const handleCheckIn = async (appointmentId: string) => {
    try {
      const appt = appointments.find((a) => a.id === appointmentId);
      if (!appt) {
        throw new Error("Appointment not found");
      }

      await appointmentService.updateAppointmentStatus(appointmentId, "confirmed");

      // Generate consultation bill if doctor is assigned
      if (appt.doctorId && appt.doctorId !== "unassigned") {
        await createConsultationBill(
          appt.patientId,
          appt.doctorId,
          appointmentId,
          appt.reason || "General consultation"
        );
      }

      addToast({
        title: "Checked In Successfully",
        description: "Patient has been marked as Arrived and placed in Lobby.",
        color: "success",
      });
    } catch (err) {
      console.error("Error checking in patient:", err);
      addToast({
        title: "Check-in Failed",
        description: "Could not update status. Please try again.",
        color: "danger",
      });
    }
  };

  const handleSendToDoctor = async (appointmentId: string) => {
    try {
      const appt = appointments.find((a) => a.id === appointmentId);
      const hasDoc = appt?.doctorId && appt.doctorId !== "unassigned";
      await appointmentService.updateAppointmentStatus(appointmentId, "in-progress");
      addToast({
        title: hasDoc ? "Sent to Doctor Cabin" : "Sent to Expert Cabin",
        description: "Patient status updated to In Consultation.",
        color: "success",
      });
    } catch (err) {
      console.error("Error sending patient to doctor/expert cabin:", err);
    }
  };

  const ensureBookedAppointmentTypeBilled = async (appt: Appointment) => {
    if (!clinicId) return null;

    const billingId = appt.consultationBillingId || appt.billingId;
    if (!billingId) return null;

    try {
      const billing = await appointmentBillingService.getBillingById(billingId);
      if (!billing) return null;

      // Check if the booked appointment type is already in the billing items
      const hasBookedItem = billing.items?.some(
        (item: any) => item.appointmentTypeId === appt.appointmentTypeId
      );

      if (hasBookedItem) {
        return billing.paymentStatus || "unpaid";
      }

      // Get the price of the booked appointment type
      const apptType = appointmentTypes.find((t) => t.id === appt.appointmentTypeId);
      if (!apptType) return null;

      const price = Number(apptType.price) || 0;
      if (price <= 0) return null;

      const isExpert = appt.assignedExpertId && appt.assignedExpertId !== "unassigned";
      const clinicianId = isExpert ? appt.assignedExpertId : (appt.doctorId || "unassigned");
      const docInfo = doctors.find((d) => d.id === clinicianId) || experts.find((e) => e.id === clinicianId);

      const newItem = {
        id: crypto.randomUUID(),
        appointmentTypeId: appt.appointmentTypeId,
        appointmentTypeName: apptType.name || "Procedure/Service Fee",
        price: price,
        quantity: 1,
        commission: (docInfo as any)?.defaultCommission || 0,
        doctorId: clinicianId,
        doctorName: docInfo?.name || "Clinician",
        amount: price,
      };

      const updatedItems = [...(billing.items || []), newItem];
      const totals = appointmentBillingService.calculateInvoiceTotals(
        updatedItems,
        billing.discountType || "percent",
        billing.discountValue || 0,
        billing.taxPercentage || 0
      );

      const newPaid = billing.paidAmount || 0;
      const newTotal = totals.totalAmount;
      const newBalance = newTotal - newPaid;
      const newPaymentStatus = newPaid >= newTotal ? "paid" : (newPaid > 0 ? "partial" : "unpaid");
      const newStatus = newPaymentStatus === "paid" ? "paid" : "draft";

      await appointmentBillingService.updateBilling(billingId, {
        items: updatedItems,
        subtotal: totals.subtotal,
        itemDiscountAmount: totals.itemDiscountAmount,
        mainDiscountAmount: totals.mainDiscountAmount,
        discountAmount: totals.totalDiscount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        balanceAmount: newBalance,
        paymentStatus: newPaymentStatus,
        status: newStatus,
      });

      return newPaymentStatus;
    } catch (err) {
      console.error("Error ensuring booked appointment type is billed:", err);
      return null;
    }
  };

  const handleCompleteConsultation = async (appointmentId: string) => {
    try {
      const appt = appointments.find(a => a.id === appointmentId);
      if (!appt) return;
      const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
      const hasExpert = appt.assignedExpertId && appt.assignedExpertId !== "unassigned";

      if (hasDoctor && hasExpert && !appt.doctorConsultationCompleted) {
        // Complete the Doctor part and route to Expert
        await appointmentService.updateAppointment(appointmentId, {
          doctorConsultationCompleted: true,
          updatedAt: new Date(),
        } as any);

        if (clinicId && appt.assignedExpertId) {
          const patObj = patients.find((p) => p.id === appt.patientId);
          const patName = patObj ? patObj.name : "Patient";
          const docObj = doctors.find((d) => d.id === appt.doctorId);
          const docName = docObj ? docObj.name : "Clinician";
          NotificationService.sendNotification(clinicId, {
            title: "New Procedure Referral",
            message: `Patient ${patName} has been routed to your cabin by Dr. ${docName} for procedure.`,
            type: "expert_queue",
            targetRole: "expert",
            targetUserId: appt.assignedExpertId,
          });
        }

        addToast({
          title: "Consultation Completed",
          description: "Doctor consultation completed. Routing patient to Expert Cabin.",
          color: "success",
        });
      } else {
        // Standard completion (no expert, or expert consultation completed)
        let billingStatus = appt.billingStatus || "unpaid";
        let paymentStatus = appt.paymentStatus || "unpaid";

        const newPS = await ensureBookedAppointmentTypeBilled(appt);
        if (newPS) {
          billingStatus = newPS;
          paymentStatus = newPS;
        }

        await appointmentService.updateAppointment(appointmentId, {
          status: "completed",
          billingStatus,
          paymentStatus,
          updatedAt: new Date(),
        } as any);

        if (clinicId) {
          const patObj = patients.find((p) => p.id === appt.patientId);
          const patName = patObj ? patObj.name : "Patient";
          NotificationService.sendNotification(clinicId, {
            title: "Consultation Completed",
            message: `Consultation for patient ${patName} is completed. Ready for billing settlement.`,
            type: "billing_queue",
            targetRole: "front-office",
          });
        }

        addToast({
          title: "Consultation Completed",
          description: "Patient consultation marked as complete.",
          color: "success",
        });
      }
    } catch (err) {
      console.error("Error completing consultation:", err);
      addToast({
        title: "Error",
        description: "Failed to complete consultation.",
        color: "danger",
      });
    }
  };

  const handleCompleteCheckout = async (appointmentId: string) => {
    try {
      await appointmentService.updateAppointment(appointmentId, {
        checkoutCompleted: true,
        updatedAt: new Date(),
      } as any);
      addToast({
        title: "Checkout Completed",
        description: "Patient checkout finalized successfully.",
        color: "success",
      });
    } catch (err) {
      console.error("Error completing checkout:", err);
      addToast({
        title: "Error",
        description: "Failed to complete checkout.",
        color: "danger",
      });
    }
  };

  const handleOpenTriage = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setVitals({
      bpSystolic: "",
      bpDiastolic: "",
      pulse: "",
      temp: "",
      weight: "",
      spo2: "",
      complaints: "",
    });
    setIsTriageModalOpen(true);
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment || !clinicId) return;

    setTriageSaving(true);
    try {
      // Format a clean, highly readable medical vitals string
      const formattedBP = vitals.bpSystolic && vitals.bpDiastolic ? `${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg` : "Not recorded";
      const formattedTemp = vitals.temp ? `${vitals.temp} °F` : "Not recorded";
      const formattedPulse = vitals.pulse ? `${vitals.pulse} bpm` : "Not recorded";
      const formattedWeight = vitals.weight ? `${vitals.weight} kg` : "Not recorded";
      const formattedSpO2 = vitals.spo2 ? `${vitals.spo2}%` : "Not recorded";
      const formattedComplaints = vitals.complaints.trim() || "None reported";

      const vitalsLog = `BP: ${formattedBP} | Temp: ${formattedTemp} | Pulse: ${formattedPulse} | Weight: ${formattedWeight} | SpO2: ${formattedSpO2}\nChief Complaints: ${formattedComplaints}`;

      // 1. Save directly into patient Note Entries (sectionKey = "triage-vitals")
      await PatientNoteEntriesService.saveNoteEntry(
        clinicId,
        selectedAppointment.patientId,
        "triage-vitals",
        "Triage Vitals",
        vitalsLog,
        currentUser?.uid || "front-desk"
      );

      // 2. Add metadata record directly on the appointment to state triage is completed
      await appointmentService.updateAppointment(selectedAppointment.id, {
        notes: `[Triage Vitals Recorded] BP: ${formattedBP}, Temp: ${formattedTemp}\nComplaints: ${formattedComplaints}`,
        // Keep status as confirmed (Checked-In) but flagged with vitals
        updatedAt: new Date(),
      } as any);

      // Trigger notification for Doctor that Triage is done and patient is ready
      if (clinicId) {
        const patObj = patients.find((p) => p.id === selectedAppointment.patientId);
        const patName = patObj ? patObj.name : "Patient";
        if (selectedAppointment.doctorId && selectedAppointment.doctorId !== "unassigned") {
          NotificationService.sendNotification(clinicId, {
            title: "Patient Vitals Recorded",
            message: `Vitals for patient ${patName} have been recorded. They are now waiting in your cabin.`,
            type: "doctor_queue",
            targetRole: "doctor",
            targetUserId: selectedAppointment.doctorId,
          });
        }
      }

      addToast({
        title: "Triage Vitals Saved",
        description: "Vitals recorded successfully. Patient is ready for doctor cabin.",
        color: "success",
      });

      setIsTriageModalOpen(false);
      setSelectedAppointment(null);
    } catch (err) {
      console.error("Error saving triage vitals:", err);
      addToast({
        title: "Error Saving Triage",
        description: "Failed to record vitals to database.",
        color: "danger",
      });
    } finally {
      setTriageSaving(false);
    }
  };

  const handleSaveProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment || !clinicId) return;

    setProcedureSaving(true);
    try {
      const currentUserId = currentUser?.uid || "expert";

      // Build descriptive note content
      const settingsStr = `Energy: ${procedure.energy || "N/A"} J/cm² | Spot: ${procedure.spotSize || "N/A"} mm | Pulse: ${procedure.pulseWidth || "N/A"} ms | Passes: ${procedure.passes || "N/A"}`;
      const procedureNoteContent = `Procedure: ${procedure.procedureType}\nArea: ${procedure.area || "N/A"}\nLaser Settings: ${settingsStr}\nClinical Notes: ${procedure.notes || "None"}\nCharge: ${procedure.fee ? `${procedure.fee} NPR` : "Free/Included"}`;

      // Save directly into patient Note Entries (sectionKey = "laser-procedure")
      await PatientNoteEntriesService.saveNoteEntry(
        clinicId,
        selectedAppointment.patientId,
        "laser-procedure",
        "Laser & Procedure Log",
        procedureNoteContent,
        currentUserId
      );

      // If fee > 0, update or create draft invoice
      const feeNum = Number(procedure.fee);
      let newPaymentStatus: "unpaid" | "partial" | "paid" = selectedAppointment.paymentStatus || "unpaid";
      let billingId = selectedAppointment.consultationBillingId || selectedAppointment.billingId;

      if (feeNum > 0) {
        if (billingId) {
          const billing = await appointmentBillingService.getBillingById(billingId);
          if (billing) {
            const procedureItem = {
              id: crypto.randomUUID(),
              appointmentTypeId: selectedAppointment.appointmentTypeId || "procedure-fee",
              appointmentTypeName: `${procedure.procedureType} (Procedure Fee)`,
              price: feeNum,
              quantity: 1,
              commission: 0,
              discountValue: 0,
              discountType: "percent" as const,
              discountAmount: 0,
              amount: feeNum,
            };

            const updatedItems = [...(billing.items || []), procedureItem];
            const totals = appointmentBillingService.calculateInvoiceTotals(
              updatedItems,
              billing.discountType || "percent",
              billing.discountValue || 0,
              billing.taxPercentage || 0
            );

            const newPaid = billing.paidAmount || 0;
            const newTotal = totals.totalAmount;
            const newBalance = newTotal - newPaid;
            newPaymentStatus = newPaid >= newTotal ? "paid" : (newPaid > 0 ? "partial" : "unpaid");
            const newStatus = newPaymentStatus === "paid" ? "paid" : "draft";

            await appointmentBillingService.updateBilling(billingId, {
              items: updatedItems,
              subtotal: totals.subtotal,
              itemDiscountAmount: totals.itemDiscountAmount,
              mainDiscountAmount: totals.mainDiscountAmount,
              discountAmount: totals.totalDiscount,
              taxAmount: totals.taxAmount,
              totalAmount: totals.totalAmount,
              balanceAmount: newBalance,
              paymentStatus: newPaymentStatus,
              status: newStatus,
            });
          }
        } else {
          // No invoice exists. Create a draft invoice for this procedure from scratch.
          try {
            const invoiceNo = await appointmentBillingService.generateInvoiceNumber(clinicId);

            let pat = patients.find((p) => p.id === selectedAppointment.patientId);
            if (!pat && selectedAppointment.patientId) {
              pat = (await patientService.getPatientById(selectedAppointment.patientId)) || undefined;
            }

            const apptTypeName = getApptTypeLabel(selectedAppointment.appointmentTypeId);
            const isExpert = selectedAppointment.assignedExpertId && selectedAppointment.assignedExpertId !== "unassigned";
            const clinicianId = isExpert ? selectedAppointment.assignedExpertId : (selectedAppointment.doctorId || "unassigned");
            const docInfo = doctors.find((d) => d.id === clinicianId) || experts.find((e) => e.id === clinicianId);

            const billingItem = {
              id: crypto.randomUUID(),
              appointmentTypeId: selectedAppointment.appointmentTypeId || "procedure-fee",
              appointmentTypeName: `${procedure.procedureType} (Procedure Fee)`,
              price: feeNum,
              quantity: 1,
              commission: (docInfo as any)?.defaultCommission || 0,
              doctorId: clinicianId,
              doctorName: docInfo?.name || "Clinician",
              amount: feeNum,
            };

            const billingData = {
              invoiceNumber: invoiceNo,
              clinicId: clinicId,
              branchId: branchId || clinicId,
              patientId: selectedAppointment.patientId,
              patientName: pat?.name || "Unknown Patient",
              doctorId: clinicianId,
              doctorName: docInfo?.name || "Clinician",
              doctorType: ((docInfo as any)?.doctorType || "regular") as "regular" | "visitor",
              invoiceDate: new Date(),
              items: [billingItem],
              subtotal: feeNum,
              itemDiscountAmount: 0,
              mainDiscountAmount: 0,
              discountType: "percent" as const,
              discountValue: 0,
              discountAmount: 0,
              taxPercentage: 0,
              taxAmount: 0,
              totalAmount: feeNum,
              status: "draft" as const,
              paymentStatus: "unpaid" as const,
              paidAmount: 0,
              balanceAmount: feeNum,
              createdBy: currentUser?.uid || "system",
            };

            const newBillingId = await appointmentBillingService.createBilling(billingData);
            billingId = newBillingId;
            newPaymentStatus = "unpaid";

            // Link new billing to appointment
            await appointmentService.updateAppointment(selectedAppointment.id, {
              billingId: newBillingId,
              billingStatus: "unpaid",
              paymentStatus: "unpaid",
              updatedAt: new Date(),
            } as any);
          } catch (genErr) {
            console.error("Error creating procedure invoice from scratch:", genErr);
          }
        }
      }

      // Mark appointment expert consultation completed (routing to billing / completed)
      await appointmentService.updateAppointment(selectedAppointment.id, {
        status: "completed",
        billingStatus: newPaymentStatus,
        paymentStatus: newPaymentStatus,
        updatedAt: new Date(),
      } as any);

      // Trigger notification for Front Office / Billing Counter that procedure is done and billing is pending
      if (clinicId) {
        const patObj = patients.find((p) => p.id === selectedAppointment.patientId);
        const patName = patObj ? patObj.name : "Patient";
        NotificationService.sendNotification(clinicId, {
          title: "Procedure Log Recorded",
          message: `Procedure log for patient ${patName} has been recorded. Ready for billing settlement.`,
          type: "billing_queue",
          targetRole: "front-office",
        });
      }

      addToast({
        title: "Procedure Log Saved",
        description: "Laser & Procedure details logged successfully. Patient is routed to Billing Counter.",
        color: "success",
      });

      setIsProcedureModalOpen(false);
      setSelectedAppointment(null);
      setHistoricalProcedures([]);
      setProcedure({
        procedureType: "CO2 Laser Resurfacing",
        energy: "",
        spotSize: "",
        pulseWidth: "",
        passes: "",
        area: "Full Face",
        fee: "",
        notes: "",
      });
    } catch (err) {
      console.error("Error saving procedure log:", err);
      addToast({
        title: "Error Saving Log",
        description: "Failed to record procedure log to database.",
        color: "danger",
      });
    } finally {
      setProcedureSaving(false);
    }
  };

  // Determine stage of patient based on appointment
  const getPatientStage = (appt: Appointment): "scheduled" | "lobby" | "triage-done" | "doctor" | "expert" | "billing" | "pharmacy" | "completed" => {
    const status = appt.status?.toLowerCase();

    if (status === "scheduled") return "scheduled";
    if (status === "confirmed") {
      // Check if triage vitals note header prefix exists inside notes field
      if (appt.notes?.includes("[Triage Vitals Recorded]")) {
        return "triage-done";
      }
      return "lobby";
    }
    if (status === "in-progress") {
      const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
      const hasExpert = appt.assignedExpertId && appt.assignedExpertId !== "unassigned";
      if (hasDoctor && hasExpert) {
        return appt.doctorConsultationCompleted ? "expert" : "doctor";
      }
      return hasDoctor ? "doctor" : "expert";
    }
    if (status === "completed") {
      const isCheckedOut = appt.checkoutCompleted === true ||
        appt.notes?.includes("[Checkout Completed]") ||
        appt.billingStatus === "paid" ||
        appt.paymentStatus === "paid";
      if (isCheckedOut) {
        // Check if there is an active prescription sent to pharmacy
        const hasPendingPrescription = prescriptions.some(p =>
          (p.appointmentId === appt.id || p.patientId === appt.patientId) &&
          p.sendToPharmacy === true &&
          p.status === "active"
        );

        if (hasPendingPrescription) {
          return "pharmacy";
        }
        return "completed";
      }

      return "billing"; // Waiting for invoice/checkout
    }
    return "completed";
  };

  // Filter list by selected active tab
  const filteredAppointments = appointments.filter((appt) => {
    const stage = getPatientStage(appt);
    const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";

    if (activeTab === "lobby") return stage === "scheduled" || stage === "lobby";
    if (activeTab === "triage") return stage === "lobby";
    if (activeTab === "doctor") return stage === "doctor" || (stage === "triage-done" && hasDoctor);
    if (activeTab === "expert") return stage === "expert" || (stage === "triage-done" && !hasDoctor);
    if (activeTab === "billing") return stage === "billing";
    if (activeTab === "pharmacy") return stage === "pharmacy";
    return true; // All
  });

  const StatCard = ({
    icon,
    label,
    value,
    colorClass,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    colorClass: string;
  }) => (
    <div className="bg-surface border border-border-base p-4 rounded flex items-center gap-4 hover:border-primary/50 transition-colors">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-[12px] font-medium text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text-main mt-0.5">{value}</p>
      </div>
    </div>
  );

  const getTriageClass = (type: "bp" | "temp" | "pulse" | "spo2", valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return "border-border-base focus:border-primary";

    if (type === "temp" && val > 99.5) return "border-saffron-500 focus:border-saffron-500 bg-saffron-50/10 text-saffron-600";
    if (type === "pulse" && (val < 60 || val > 100)) return "border-saffron-500 focus:border-saffron-500 bg-saffron-50/10 text-saffron-600";
    if (type === "spo2" && val < 95) return "border-red-500 focus:border-red-500 bg-red-50/10 text-red-600";

    return "border-border-base focus:border-primary bg-surface text-text-main";
  };

  const renderTriageModal = () => {
    if (!isTriageModalOpen || !selectedAppointment) return null;

    const modalRoot = document.getElementById("dashboard-scroll-container") || document.body;

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsTriageModalOpen(false)} />
        <div className="bg-surface rounded border border-border-base shadow-xl max-w-lg w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[14.5px] text-text-main">
                🩺 Record Triage Vitals
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Patient: <span className="font-semibold text-primary">{getPatientName(selectedAppointment.patientId)}</span>
              </p>
            </div>
            <button className="text-text-muted hover:text-text-main p-1" onClick={() => setIsTriageModalOpen(false)}>
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveTriage}>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {/* Systolic BP */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                    <IoHeartOutline className="text-red-500" /> Blood Pressure (Systolic)
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary"
                    placeholder="e.g. 120"
                    type="number"
                    value={vitals.bpSystolic}
                    onChange={(e) => setVitals((v) => ({ ...v, bpSystolic: e.target.value }))}
                  />
                </div>
                {/* Diastolic BP */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                    <IoHeartOutline className="text-red-500" /> Blood Pressure (Diastolic)
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary"
                    placeholder="e.g. 80"
                    type="number"
                    value={vitals.bpDiastolic}
                    onChange={(e) => setVitals((v) => ({ ...v, bpDiastolic: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Temperature */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                    <IoThermometerOutline className="text-saffron-500" /> Temperature (°F)
                  </label>
                  <input
                    className={`w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors ${getTriageClass("temp", vitals.temp)}`}
                    placeholder="e.g. 98.6"
                    step="0.1"
                    type="number"
                    value={vitals.temp}
                    onChange={(e) => setVitals((v) => ({ ...v, temp: e.target.value }))}
                  />
                  {vitals.temp && parseFloat(vitals.temp) > 99.5 && (
                    <p className="text-[10px] font-bold text-saffron-600 mt-1 leading-none">⚠️ High Temp / Fever Warning</p>
                  )}
                </div>
                {/* Pulse Rate */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                    <IoSpeedometerOutline className="text-teal-500" /> Pulse / Heart Rate (bpm)
                  </label>
                  <input
                    className={`w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors ${getTriageClass("pulse", vitals.pulse)}`}
                    placeholder="e.g. 72"
                    type="number"
                    value={vitals.pulse}
                    onChange={(e) => setVitals((v) => ({ ...v, pulse: e.target.value }))}
                  />
                  {vitals.pulse && (parseFloat(vitals.pulse) < 60 || parseFloat(vitals.pulse) > 100) && (
                    <p className="text-[10px] font-bold text-saffron-600 mt-1 leading-none">⚠️ Pulse outside normal range</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Weight */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                    <IoBodyOutline className="text-sky-500" /> Weight (kg)
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                    placeholder="e.g. 70"
                    step="0.1"
                    type="number"
                    value={vitals.weight}
                    onChange={(e) => setVitals((v) => ({ ...v, weight: e.target.value }))}
                  />
                </div>
                {/* SpO2 */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                    <IoSpeedometerOutline className="text-indigo-500" /> SpO2 (%) Oxygen Saturation
                  </label>
                  <input
                    className={`w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors ${getTriageClass("spo2", vitals.spo2)}`}
                    placeholder="e.g. 98"
                    type="number"
                    value={vitals.spo2}
                    onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))}
                  />
                  {vitals.spo2 && parseFloat(vitals.spo2) < 95 && (
                    <p className="text-[10px] font-bold text-red-600 mt-1 leading-none">🚨 Critical Low Oxygen warning</p>
                  )}
                </div>
              </div>

              {/* Chief Complaints */}
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <IoCreateOutline className="text-text-muted" /> Chief Complaints / Symptoms
                </label>
                <textarea
                  className="w-full min-h-20 px-3 py-2 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors resize-none"
                  placeholder="Describe patient symptoms (e.g. cough for 3 days, mild headache)..."
                  value={vitals.complaints}
                  onChange={(e) => setVitals((v) => ({ ...v, complaints: e.target.value }))}
                />
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-border-base bg-surface-2 flex justify-end gap-3 rounded-b-lg">
              <button
                className="h-9 px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors"
                type="button"
                onClick={() => setIsTriageModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="h-9 px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                disabled={triageSaving}
                type="submit"
              >
                {triageSaving ? "Saving..." : "Save Vitals"}
              </button>
            </div>
          </form>
        </div>
      </div>,
      modalRoot
    );
  };

  const renderProcedureModal = () => {
    if (!isProcedureModalOpen || !selectedAppointment) return null;

    const modalRoot = document.getElementById("dashboard-scroll-container") || document.body;

    const getBookedApptTypeOption = () => {
      const label = getApptTypeLabel(selectedAppointment.appointmentTypeId);
      const standardOptions = [
        "CO2 Laser Resurfacing",
        "Q-Switched Nd:YAG Laser",
        "Carbon Laser Peel",
        "Chemical Peel",
        "Hydrafacial",
        "PRP Therapy",
        "Botox / Fillers",
        "Microdermabrasion",
        "Other"
      ];
      if (!standardOptions.includes(label)) {
        return <option value={label}>{label} (Booked)</option>;
      }
      return null;
    };

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setIsProcedureModalOpen(false); setHistoricalProcedures([]); }} />
        <div className="bg-surface rounded border border-border-base shadow-xl max-w-4xl w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[14.5px] text-text-main flex items-center gap-1.5">
                ⚡ Record Laser & Aesthetic Procedure Log
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Patient: <span className="font-semibold text-primary">{getPatientName(selectedAppointment.patientId)}</span>
              </p>
            </div>
            <button className="text-text-muted hover:text-text-main p-1" onClick={() => { setIsProcedureModalOpen(false); setHistoricalProcedures([]); }}>
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-0 overflow-hidden flex-1">
            {/* Left side: Log Form */}
            <form onSubmit={handleSaveProcedure} className="col-span-3 flex flex-col justify-between border-r border-border-base max-h-[75vh]">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  {/* Procedure Type */}
                  <div className="col-span-2">
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                      Procedure Type
                    </label>
                    <select
                      className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                      value={procedure.procedureType}
                      onChange={(e) => setProcedure((p) => ({ ...p, procedureType: e.target.value }))}
                    >
                      <option value="CO2 Laser Resurfacing">CO2 Laser Resurfacing</option>
                      <option value="Q-Switched Nd:YAG Laser">Q-Switched Nd:YAG Laser</option>
                      <option value="Carbon Laser Peel">Carbon Laser Peel</option>
                      <option value="Chemical Peel">Chemical Peel</option>
                      <option value="Hydrafacial">Hydrafacial</option>
                      <option value="PRP Therapy">PRP Therapy</option>
                      <option value="Botox / Fillers">Botox / Fillers</option>
                      <option value="Microdermabrasion">Microdermabrasion</option>
                      {getBookedApptTypeOption()}
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Treated Area */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                      Treated Area
                    </label>
                    <input
                      className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                      placeholder="e.g. Full Face, Cheeks"
                      type="text"
                      value={procedure.area}
                      onChange={(e) => setProcedure((p) => ({ ...p, area: e.target.value }))}
                    />
                  </div>

                  {/* Procedure Cost/Fee */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                      Additional Procedure Fee (NPR) <span className="text-[10px] font-normal text-text-muted">(Optional)</span>
                    </label>
                    <input
                      className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                      placeholder="Leave blank if already billed"
                      type="number"
                      value={procedure.fee}
                      onChange={(e) => setProcedure((p) => ({ ...p, fee: e.target.value }))}
                    />
                  </div>

                  {/* Energy (Fluence) */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                      Energy / Fluence (J/cm²)
                    </label>
                    <input
                      className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                      placeholder="e.g. 15"
                      type="text"
                      value={procedure.energy}
                      onChange={(e) => setProcedure((p) => ({ ...p, energy: e.target.value }))}
                    />
                  </div>

                  {/* Spot Size */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                      Spot Size (mm)
                    </label>
                    <input
                      className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                      placeholder="e.g. 4"
                      type="text"
                      value={procedure.spotSize}
                      onChange={(e) => setProcedure((p) => ({ ...p, spotSize: e.target.value }))}
                    />
                  </div>

                  {/* Pulse Width */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                      Pulse Width (ms)
                    </label>
                    <input
                      className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                      placeholder="e.g. 10"
                      type="text"
                      value={procedure.pulseWidth}
                      onChange={(e) => setProcedure((p) => ({ ...p, pulseWidth: e.target.value }))}
                    />
                  </div>

                  {/* Passes */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                      Passes (Count)
                    </label>
                    <input
                      className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                      placeholder="e.g. 2"
                      type="text"
                      value={procedure.passes}
                      onChange={(e) => setProcedure((p) => ({ ...p, passes: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                    Clinical Procedure Notes
                  </label>
                  <textarea
                    className="w-full min-h-[80px] p-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main resize-none"
                    placeholder="Enter skin reaction details, patient tolerance, or post-procedure cream recommendations..."
                    value={procedure.notes}
                    onChange={(e) => setProcedure((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="px-5 py-4 border-t border-border-base bg-surface-2 flex justify-end gap-2.5">
                <button
                  className="h-9 px-4 rounded text-[13px] font-semibold border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                  type="button"
                  onClick={() => { setIsProcedureModalOpen(false); setHistoricalProcedures([]); }}
                >
                  Cancel
                </button>
                <button
                  className="h-9 px-4 rounded text-[13px] font-semibold bg-primary text-white hover:bg-primary/95 transition-colors outline-none disabled:opacity-50"
                  type="submit"
                  disabled={procedureSaving}
                >
                  {procedureSaving ? "Saving Log..." : "Save Log & Complete"}
                </button>
              </div>
            </form>

            {/* Right side: Patient History */}
            <div className="col-span-2 bg-surface-2 p-5 flex flex-col max-h-[75vh] overflow-hidden">
              <h4 className="font-bold text-[13px] text-text-main mb-3 flex items-center gap-1.5 border-b border-border-base pb-2">
                📋 Past Treatment Records ({historicalProcedures.length})
              </h4>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loadingHistory ? (
                  <div className="h-full flex items-center justify-center py-10">
                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                  </div>
                ) : historicalProcedures.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center text-text-muted">
                    <IoReceiptOutline className="w-8 h-8 opacity-40 mb-1.5 text-text-muted" />
                    <p className="text-[12px]">No past procedures recorded for this patient.</p>
                  </div>
                ) : (
                  historicalProcedures.map((entry) => {
                    const lines = entry.content.split("\n");
                    let procType = "";
                    let area = "";
                    let settings = "";
                    let notes = "";
                    let fee = "";

                    lines.forEach((line: string) => {
                      if (line.startsWith("Procedure:")) procType = line.replace("Procedure:", "").trim();
                      else if (line.startsWith("Area:")) area = line.replace("Area:", "").trim();
                      else if (line.startsWith("Laser Settings:")) settings = line.replace("Laser Settings:", "").trim();
                      else if (line.startsWith("Clinical Notes:")) notes = line.replace("Clinical Notes:", "").trim();
                      else if (line.startsWith("Charge:")) fee = line.replace("Charge:", "").trim();
                    });

                    return (
                      <div key={entry.id} className="p-3 bg-surface border border-border-base rounded-md text-[12px] space-y-1.5 shadow-sm hover:border-border-muted transition-colors">
                        <div className="flex justify-between items-center border-b border-border-base pb-1">
                          <span className="font-semibold text-primary">{procType || "Laser Procedure"}</span>
                          <span className="text-[10px] text-text-muted">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                        {area && (
                          <p className="text-text-main text-[11.5px]">
                            <span className="font-medium text-text-muted">Area:</span> {area}
                          </p>
                        )}
                        {settings && (
                          <div className="bg-surface-2 p-1.5 rounded text-[10.5px] font-mono text-text-main border border-border-base leading-relaxed">
                            {settings}
                          </div>
                        )}
                        {notes && notes !== "None" && (
                          <p className="text-text-main italic text-[11px] bg-amber-50/20 p-1.5 rounded border border-amber-100/10 leading-snug">
                            "{notes}"
                          </p>
                        )}
                        {fee && (
                          <p className="text-[10px] text-text-muted text-right">
                            {fee}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>,
      modalRoot
    );
  };

  const addReferrerRow = () => {
    setQuickIntakeForm((prev) => {
      const firstRp = referralPartners[0];
      const newRef = {
        type: "referral-partner" as const,
        id: firstRp?.id || "",
        name: firstRp?.name || "",
        commissionPercentage: firstRp?.defaultCommission || 0,
        referredById: "",
        referredByName: "",
      };
      return {
        ...prev,
        referrals: [...prev.referrals, newRef],
      };
    });
  };

  const updateReferrerRow = (index: number, key: string, value: any) => {
    setQuickIntakeForm((prev) => {
      const updated = [...prev.referrals];
      const current = { ...updated[index] };

      if (key === "type") {
        current.type = value;
        if (value === "referral-partner") {
          const first = referralPartners[0];
          current.id = first?.id || "";
          current.name = first?.name || "";
          current.commissionPercentage = first?.defaultCommission || 0;
        } else if (value === "doctor") {
          const first = doctors[0];
          current.id = first?.id || "";
          current.name = first?.name || "";
          current.commissionPercentage = first?.defaultCommission || 0;
        } else if (value === "expert") {
          const first = experts[0];
          current.id = first?.id || "";
          current.name = first?.name || "";
          current.commissionPercentage = first?.defaultCommission || 0;
        } else if (value === "staff") {
          const first = staff[0];
          current.id = first?.id || "";
          current.name = first?.name || "";
          current.commissionPercentage = first?.defaultCommission || 0;
        }
      } else if (key === "id") {
        current.id = value;
        if (current.type === "referral-partner") {
          const match = referralPartners.find(rp => rp.id === value);
          current.name = match?.name || "";
          current.commissionPercentage = match?.defaultCommission || 0;
        } else if (current.type === "doctor") {
          const match = doctors.find(d => d.id === value);
          current.name = match?.name || "";
          current.commissionPercentage = match?.defaultCommission || 0;
        } else if (current.type === "expert") {
          const match = experts.find(e => e.id === value);
          current.name = match?.name || "";
          current.commissionPercentage = match?.defaultCommission || 0;
        } else if (current.type === "staff") {
          const match = staff.find(s => s.id === value);
          current.name = match?.name || "";
          current.commissionPercentage = match?.defaultCommission || 0;
        }
      } else if (key === "commissionPercentage") {
        current.commissionPercentage = Number(value) || 0;
      } else if (key === "referredById") {
        current.referredById = value;
        const matchDoc = doctors.find(d => d.id === value);
        const matchExp = experts.find(e => e.id === value);
        current.referredByName = matchDoc ? `Dr. ${matchDoc.name}` : (matchExp?.name || "");
      }

      updated[index] = current;
      return { ...prev, referrals: updated };
    });
  };

  const removeReferrerRow = (index: number) => {
    setQuickIntakeForm((prev) => ({
      ...prev,
      referrals: prev.referrals.filter((_, i) => i !== index),
    }));
  };

  const handleQuickIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasDoctor = !!quickIntakeForm.doctorId;
    const hasExpert = !!quickIntakeForm.assignedExpertId;
    const hasReferral = quickIntakeForm.referrals.length > 0;

    if (intakeMode === "new") {
      if (!quickIntakeForm.name || !quickIntakeForm.mobile || !quickIntakeForm.age) {
        addToast({
          title: "Validation Error",
          description: "Please fill in all patient profile fields (Name, Mobile, Age).",
          color: "danger",
        });
        return;
      }
    } else {
      if (!selectedExistingPatient) {
        addToast({
          title: "Validation Error",
          description: "Please select an existing patient from the search results.",
          color: "danger",
        });
        return;
      }
    }

    if (!hasDoctor && !hasExpert && !hasReferral) {
      addToast({
        title: "Validation Error",
        description: "Please assign either a consulting Doctor, an Expert, or at least one Referral Source.",
        color: "danger",
      });
      return;
    }

    setQuickIntakeSaving(true);
    try {
      let patientIdToUse = "";
      let regNumberToUse = "";

      if (intakeMode === "new") {
        // Check uniqueness of mobile first
        if (quickIntakeForm.mobile.trim() && clinicId) {
          const mobileExists = await patientService.checkMobileExists(
            quickIntakeForm.mobile.trim(),
            clinicId,
          );
          if (mobileExists) {
            addToast({
              title: "Duplicate Mobile",
              description: "A patient with this mobile number already exists.",
              color: "danger",
            });
            setQuickIntakeSaving(false);
            return;
          }
        }

        // 1) Generate next reg number
        const nextReg = await patientService.getNextRegistrationNumber(clinicId || undefined);
        regNumberToUse = nextReg;

        // 2) Create patient
        const firstPartner = quickIntakeForm.referrals.find(r => r.type === "referral-partner");
        const refPartnerId = firstPartner ? firstPartner.id : (quickIntakeForm.referralPartnerId || undefined);

        const newPatientId = await patientService.createPatient({
          name: quickIntakeForm.name.trim(),
          mobile: quickIntakeForm.mobile.trim(),
          age: quickIntakeForm.age.trim(),
          gender: quickIntakeForm.gender as "male" | "female" | "other",
          regNumber: nextReg,
          address: "Clinic Walk-in",
          clinicId: clinicId || "standalone",
          branchId: branchId || clinicId || "standalone",
          referralPartnerId: refPartnerId,
          referrals: quickIntakeForm.referrals,
          doctorId: quickIntakeForm.doctorId || "unassigned",
          assignedExpertId: quickIntakeForm.assignedExpertId || undefined,
        });
        patientIdToUse = newPatientId;
        const newPatient = {
          id: newPatientId,
          name: quickIntakeForm.name.trim(),
          mobile: quickIntakeForm.mobile.trim(),
          age: quickIntakeForm.age.trim(),
          gender: quickIntakeForm.gender as "male" | "female" | "other",
          regNumber: nextReg,
          address: "Clinic Walk-in",
          clinicId: clinicId || "standalone",
          branchId: branchId || clinicId || "standalone",
          referralPartnerId: refPartnerId,
          referrals: quickIntakeForm.referrals,
          doctorId: quickIntakeForm.doctorId || "unassigned",
          assignedExpertId: quickIntakeForm.assignedExpertId || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Patient;
        setPatients((prev) => [...prev, newPatient]);
      } else {
        // Use the existing patient
        patientIdToUse = selectedExistingPatient.id;
        regNumberToUse = selectedExistingPatient.regNumber || "N/A";

        // Optionally update existing patient's doctor, referrals or expert in background if changed
        const updateData: any = {};
        if (quickIntakeForm.doctorId) updateData.doctorId = quickIntakeForm.doctorId;
        if (quickIntakeForm.assignedExpertId) updateData.assignedExpertId = quickIntakeForm.assignedExpertId;
        if (quickIntakeForm.referrals.length > 0) {
          updateData.referrals = quickIntakeForm.referrals;
          const firstPartner = quickIntakeForm.referrals.find(r => r.type === "referral-partner");
          if (firstPartner) updateData.referralPartnerId = firstPartner.id;
        }

        if (Object.keys(updateData).length > 0) {
          await patientService.updatePatient(selectedExistingPatient.id, updateData);
        }
      }

      // 3) Create Checked-In appointment (status: confirmed)
      const now = new Date();
      let appointmentDate = now;
      if (quickIntakeForm.appointmentDate) {
        appointmentDate = new Date(quickIntakeForm.appointmentDate);
        // keep current time if it's today, otherwise time is midnight.
        if (appointmentDate.toDateString() === now.toDateString()) {
          appointmentDate = now;
        }
      }

      const startTime24 = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const isTodayAppt = appointmentDate.toDateString() === now.toDateString();

      const apptData = {
        patientId: patientIdToUse,
        doctorId: quickIntakeForm.doctorId || "unassigned",
        assignedExpertId: quickIntakeForm.assignedExpertId || undefined,
        appointmentTypeId: quickIntakeForm.appointmentTypeId || (appointmentTypes[0]?.id || "default"),
        appointmentDate: appointmentDate,
        startTime: isTodayAppt ? startTime24 : undefined,
        endTime: undefined,
        // Only mark as "confirmed" (checked-in) if the appointment is TODAY.
        // Future appointments stay "scheduled" and won't appear in today's lobby queue.
        status: isTodayAppt ? ("confirmed" as const) : ("scheduled" as const),
        reason: quickIntakeForm.reason.trim() || "Walk-in General Checkup",
        clinicId: clinicId || "standalone",
        branchId: branchId || clinicId || "standalone",
        createdBy: currentUser?.uid || "",
      };

      const newApptId = await appointmentService.createAppointment(apptData);

      // Generate consultation bill if doctor is assigned
      if (quickIntakeForm.doctorId && quickIntakeForm.doctorId !== "unassigned") {
        try {
          await createConsultationBill(
            patientIdToUse,
            quickIntakeForm.doctorId,
            newApptId,
            quickIntakeForm.reason.trim() || "Walk-in General Checkup"
          );
        } catch (billErr) {
          console.error("Error generating quick intake consultation bill:", billErr);
        }
      }

      const patientDisplayName = intakeMode === "new" ? quickIntakeForm.name : selectedExistingPatient.name;

      // Trigger real-time notifications for the assigned Doctor and Expert
      if (clinicId) {
        if (quickIntakeForm.doctorId && quickIntakeForm.doctorId !== "unassigned") {
          const docObj = doctors.find((d) => d.id === quickIntakeForm.doctorId);
          const docName = docObj ? docObj.name : "Clinician";
          NotificationService.sendNotification(clinicId, {
            title: "New Patient Checked In",
            message: `Patient ${patientDisplayName} is checked in for consultation with Dr. ${docName}.`,
            type: "triage",
            targetRole: "doctor",
            targetUserId: quickIntakeForm.doctorId,
          });
        }
        if (quickIntakeForm.assignedExpertId && quickIntakeForm.assignedExpertId !== "unassigned") {
          const expObj = experts.find((e) => e.id === quickIntakeForm.assignedExpertId);
          const expName = expObj ? expObj.name : "Expert";
          NotificationService.sendNotification(clinicId, {
            title: "New Patient Checked In",
            message: `Patient ${patientDisplayName} is checked in directly for procedure with Expert ${expName}.`,
            type: "triage",
            targetRole: "expert",
            targetUserId: quickIntakeForm.assignedExpertId,
          });
        }
      }

      addToast({
        title: "Quick Check-In Successful",
        description: `${patientDisplayName} is checked in successfully (Reg# ${regNumberToUse}).`,
        color: "success",
      });

      // Fetch fresh patient list so local names resolve immediately
      const updatedPatients = await patientService.getPatients(clinicId);
      setPatients(updatedPatients);

      // Reset and close
      setIsQuickIntakeOpen(false);
      setIntakeMode("new");
      setPatientSearchQuery("");
      setSelectedExistingPatient(null);
      setIsSearchDropdownOpen(false);
      setQuickIntakeForm({
        name: "",
        mobile: "",
        age: "",
        gender: "male",
        appointmentDate: new Date().toISOString().split("T")[0],
        doctorId: "",
        assignedExpertId: "",
        appointmentTypeId: appointmentTypes[0]?.id || "",
        reason: "",
        referralPartnerId: "",
        referrals: [],
      });
    } catch (err) {
      console.error("Error creating walk-in intake:", err);
      addToast({
        title: "Registration Failed",
        description: "Failed to perform walk-in patient intake check-in.",
        color: "danger",
      });
    } finally {
      setQuickIntakeSaving(false);
    }
  };

  const renderQuickIntakeModal = () => {
    if (!isQuickIntakeOpen) return null;

    const modalRoot = document.getElementById("dashboard-scroll-container") || document.body;

    return createPortal(
      <>
        {/* Fixed backdrop — covers full viewport independently */}
        <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm" onClick={() => setIsQuickIntakeOpen(false)} />

        {/* Scroll container — sits over backdrop */}
        <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4 pointer-events-none">
          <div className="bg-surface rounded border border-border-base shadow-2xl w-full max-w-6xl relative my-auto pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-[14px] sm:text-[14.5px] text-text-main">
                  📋 Quick Walk-In Registration
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Register & Check-in walk-in patient instantly.
                </p>
              </div>
              <button className="text-text-muted hover:text-text-main p-1" onClick={() => setIsQuickIntakeOpen(false)}>
                <IoCloseOutline className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickIntakeSubmit}>
              <div className="p-4 sm:p-5 max-h-[calc(100vh-10rem)] overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

                  {/* Left Column: Demographics & Intake Details */}
                  <div className="space-y-4">
                    {/* Intake Mode Switcher */}
                    <div className="flex bg-surface-2 p-1 rounded-lg border border-border-base w-full mb-2">
                      <button
                        type="button"
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${intakeMode === "new"
                          ? "bg-primary text-white shadow-sm"
                          : "text-text-muted hover:text-text-main"
                          }`}
                        onClick={() => {
                          setIntakeMode("new");
                          setSelectedExistingPatient(null);
                          setPatientSearchQuery("");
                        }}
                      >
                        New Patient Walk-in
                      </button>
                      <button
                        type="button"
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${intakeMode === "existing"
                          ? "bg-primary text-white shadow-sm"
                          : "text-text-muted hover:text-text-main"
                          }`}
                        onClick={() => {
                          setIntakeMode("existing");
                        }}
                      >
                        Search Existing Patient
                      </button>
                    </div>

                    <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-border-base pb-1">
                      {intakeMode === "new" ? "New Patient Profile & Consultation" : "Select Patient & Consultation"}
                    </h4>

                    {intakeMode === "new" ? (
                      <>
                        {/* Full Name */}
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Patient Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                            placeholder="e.g. John Doe"
                            type="text"
                            value={quickIntakeForm.name}
                            onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, name: e.target.value }))}
                          />
                        </div>

                        {/* Mobile & Age */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Mobile Number <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                required
                                className={`w-full h-9 px-3 pr-8 text-[13px] border ${mobileStatus === "duplicate" ? "border-error focus:border-error focus:ring-1 focus:ring-error/20" : "border-border-base focus:border-primary focus:ring-1 focus:ring-primary/20"} rounded outline-none bg-surface text-text-main transition-colors`}
                                placeholder="e.g. 98XXXXXXXX"
                                type="tel"
                                value={quickIntakeForm.mobile}
                                onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, mobile: e.target.value }))}
                              />
                              {mobileStatus === "checking" && (
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                  <Spinner size="xs" />
                                </div>
                              )}
                            </div>
                            {mobileStatus === "duplicate" && (
                              <p className="text-[10.5px] text-error font-medium mt-1">
                                ⚠️ Patient with this mobile exists.
                              </p>
                            )}
                            {mobileStatus === "clear" && (
                              <p className="text-[10.5px] text-health-600 font-medium mt-1">
                                ✓ Number available.
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Age <span className="text-red-500">*</span>
                            </label>
                            <input
                              required
                              className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                              placeholder="e.g. 28 or 10 Months"
                              type="text"
                              value={quickIntakeForm.age}
                              onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, age: e.target.value }))}
                            />
                          </div>
                        </div>

                        {/* Gender, Appointment Category & Date */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Gender
                            </label>
                            <select
                              className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                              value={quickIntakeForm.gender}
                              onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, gender: e.target.value }))}
                            >
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Appointment Date
                            </label>
                            <input
                              required
                              type="date"
                              className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                              value={quickIntakeForm.appointmentDate}
                              onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Appointment Category
                            </label>
                            <select
                              className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                              value={quickIntakeForm.appointmentTypeId}
                              onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, appointmentTypeId: e.target.value }))}
                            >
                              {appointmentTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Existing Patient Search Panel */}
                        <div className="space-y-4">
                          {!selectedExistingPatient ? (
                            <div className="relative">
                              <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                                🔍 Search Existing Patient
                              </label>
                              <div className="relative flex items-center border border-border-base rounded-[10px] min-h-[38px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
                                <IoSearchOutline className="ml-3 w-4 h-4 text-text-muted/70 shrink-0" />
                                <input
                                  type="text"
                                  className="flex-1 w-full text-[13.5px] px-2 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/70"
                                  placeholder="Search by name, Reg # or mobile number..."
                                  value={patientSearchQuery}
                                  onChange={(e) => {
                                    setPatientSearchQuery(e.target.value);
                                    setIsSearchDropdownOpen(true);
                                  }}
                                  onFocus={() => setIsSearchDropdownOpen(true)}
                                />
                                {patientSearchQuery && (
                                  <button
                                    type="button"
                                    className="mr-3 text-text-muted hover:text-text-main"
                                    onClick={() => setPatientSearchQuery("")}
                                  >
                                    <IoCloseOutline className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              {/* Search Results Dropdown */}
                              {isSearchDropdownOpen && patientSearchQuery.trim().length > 0 && (
                                <>
                                  <div
                                    className="fixed inset-0 z-[10]"
                                    onClick={() => setIsSearchDropdownOpen(false)}
                                  />
                                  <div className="absolute left-0 right-0 mt-1 bg-surface border border-border-base rounded-lg shadow-xl max-h-60 overflow-y-auto z-[20] pr-1">
                                    {(() => {
                                      const query = patientSearchQuery.toLowerCase();
                                      const filteredPatients = patients.filter(
                                        (p) =>
                                          p.name.toLowerCase().includes(query) ||
                                          (p.regNumber && p.regNumber.toLowerCase().includes(query)) ||
                                          p.mobile.includes(query)
                                      );

                                      if (filteredPatients.length === 0) {
                                        return (
                                          <div className="p-4 text-center text-xs text-text-muted">
                                            No matching patients found.
                                          </div>
                                        );
                                      }

                                      return filteredPatients.map((p) => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          className="w-full text-left px-4 py-2.5 hover:bg-primary/5 border-b border-border-base/30 last:border-0 flex items-center justify-between transition-colors"
                                          onClick={() => {
                                            setSelectedExistingPatient(p);
                                            setIsSearchDropdownOpen(false);
                                            // Auto-fill physician or referrals if they exist on the patient
                                            setQuickIntakeForm((prev) => {
                                              const updated = { ...prev };
                                              if (p.doctorId && p.doctorId !== "unassigned") {
                                                updated.doctorId = p.doctorId;
                                              }
                                              if (p.assignedExpertId) {
                                                updated.assignedExpertId = p.assignedExpertId;
                                              }
                                              if (p.referrals && p.referrals.length > 0) {
                                                updated.referrals = p.referrals;
                                              }
                                              return updated;
                                            });
                                          }}
                                        >
                                          <div>
                                            <p className="text-[13px] font-bold text-text-main leading-tight font-sans">
                                              {p.name}
                                            </p>
                                            <p className="text-[11px] text-text-muted mt-0.5 leading-tight font-sans">
                                              Reg #: {p.regNumber || "N/A"} • Mob: {p.mobile}
                                            </p>
                                          </div>
                                          <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase">
                                            Select
                                          </span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            /* Selected Patient Preview Card */
                            <div className="bg-surface-2/60 border border-border-base rounded-xl p-4 flex flex-col gap-3.5 relative shadow-sm animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-base font-bold shrink-0 shadow-sm">
                                  {selectedExistingPatient.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-[14.5px] font-extrabold text-text-main leading-none">
                                      {selectedExistingPatient.name}
                                    </p>
                                    {selectedExistingPatient.isCritical && (
                                      <span className="text-[9px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 px-1 py-0.5 rounded leading-none">
                                        CRITICAL
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11.5px] text-text-muted mt-1.5 font-medium leading-none">
                                    Reg #: <span className="text-primary font-bold">{selectedExistingPatient.regNumber || "N/A"}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border-base/50 pt-3 text-[12px]">
                                <div>
                                  <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">Mobile Number</span>
                                  <span className="text-text-main font-semibold mt-0.5 block">{selectedExistingPatient.mobile}</span>
                                </div>
                                <div>
                                  <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">Age / Gender</span>
                                  <span className="text-text-main font-semibold mt-0.5 block">
                                    {selectedExistingPatient.age || "—"} / {selectedExistingPatient.gender || "—"}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                className="w-full mt-1.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-[11.5px] font-bold transition-all shadow-none flex items-center justify-center gap-1"
                                onClick={() => {
                                  setSelectedExistingPatient(null);
                                  setPatientSearchQuery("");
                                }}
                              >
                                <IoCloseOutline className="w-4 h-4" /> Reset & Search Another Patient
                              </button>
                            </div>
                          )}

                          {/* Appointment Category for Existing Patient */}
                          <div>
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Appointment Category
                            </label>
                            <select
                              className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                              value={quickIntakeForm.appointmentTypeId}
                              onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, appointmentTypeId: e.target.value }))}
                            >
                              {appointmentTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Assigned Doctor & Assigned Expert */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                          Assigned Doctor (Internal)
                        </label>
                        <select
                          className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                          value={quickIntakeForm.doctorId}
                          onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, doctorId: e.target.value }))}
                        >
                          <option value="">None / Unassigned</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              Dr. {d.name} ({d.speciality || "GP"})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                          Assigned Expert (External)
                        </label>
                        <select
                          className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                          value={quickIntakeForm.assignedExpertId}
                          onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, assignedExpertId: e.target.value }))}
                        >
                          <option value="">None / Unassigned</option>
                          {experts.map((exp) => (
                            <option key={exp.id} value={exp.id}>
                              {exp.name} ({exp.speciality || "Consultant"})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Complaints / Reason */}
                    <div>
                      <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                        Chief Complaints / Reason for Visit
                      </label>
                      <textarea
                        className="w-full min-h-16 px-3 py-2 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors resize-none"
                        placeholder="e.g. fever since yesterday, follow-up consult..."
                        value={quickIntakeForm.reason}
                        onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, reason: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Right Column: Polymorphic Referrals Panel */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-border-base pb-1">
                        Referral Sources & Commissions
                      </h4>

                      <div className="border border-border-base rounded p-3 bg-surface-2/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-[11.5px] font-bold text-text-main">
                              Referral Sources & Commission Splits
                            </label>
                            <p className="text-[10px] text-text-muted">
                              Associate this patient check-in with one or more referrers.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={addReferrerRow}
                            className="px-2.5 py-1 text-[11px] font-bold text-primary border border-primary/20 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded transition-colors"
                          >
                            ➕ Add Referrer
                          </button>
                        </div>

                        {quickIntakeForm.referrals.length === 0 ? (
                          <div className="py-4 text-center text-[11.5px] text-text-muted bg-surface/50 border border-dashed border-border-base rounded">
                            No active referrals added (Patient is a Direct Walk-in).
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                            {quickIntakeForm.referrals.map((ref, idx) => (
                              <div key={idx} className="flex flex-col gap-2 bg-surface p-2 border border-border-base rounded shadow-none relative">
                                <div className="flex items-center gap-2">
                                  <div className="grid grid-cols-12 gap-2 flex-1">
                                    {/* Referrer Type Dropdown */}
                                    <div className="col-span-4">
                                      <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                        Type
                                      </label>
                                      <select
                                        className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                        value={ref.type}
                                        onChange={(e) => updateReferrerRow(idx, "type", e.target.value)}
                                      >
                                        <option value="referral-partner">External Partner</option>
                                        <option value="doctor">Internal Doctor</option>
                                        <option value="expert">External Expert</option>
                                        <option value="staff">Internal Staff</option>
                                      </select>
                                    </div>

                                    {/* Referrer Name Dropdown */}
                                    <div className="col-span-5">
                                      <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                        Name
                                      </label>
                                      <select
                                        className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                        value={ref.id}
                                        onChange={(e) => updateReferrerRow(idx, "id", e.target.value)}
                                      >
                                        {ref.type === "referral-partner" && (
                                          <>
                                            <option value="">-- Choose Partner --</option>
                                            {referralPartners.map((rp) => (
                                              <option key={rp.id} value={rp.id}>
                                                {rp.name}
                                              </option>
                                            ))}
                                          </>
                                        )}
                                        {ref.type === "doctor" && (
                                          <>
                                            <option value="">-- Choose Doctor --</option>
                                            {doctors.map((d) => (
                                              <option key={d.id} value={d.id}>
                                                Dr. {d.name}
                                              </option>
                                            ))}
                                          </>
                                        )}
                                        {ref.type === "expert" && (
                                          <>
                                            <option value="">-- Choose Expert --</option>
                                            {experts.map((exp) => (
                                              <option key={exp.id} value={exp.id}>
                                                {exp.name}
                                              </option>
                                            ))}
                                          </>
                                        )}
                                        {ref.type === "staff" && (
                                          <>
                                            <option value="">-- Choose Staff --</option>
                                            {staff.map((s) => (
                                              <option key={s.id} value={s.id}>
                                                {s.name}
                                              </option>
                                            ))}
                                          </>
                                        )}
                                      </select>
                                    </div>

                                    {/* Commission split percentage */}
                                    <div className="col-span-3">
                                      <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                        Split %
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full h-8 px-1 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors text-right"
                                        value={ref.commissionPercentage}
                                        onChange={(e) => updateReferrerRow(idx, "commissionPercentage", e.target.value)}
                                      />
                                    </div>
                                  </div>

                                  {/* Action delete button */}
                                  <button
                                    type="button"
                                    onClick={() => removeReferrerRow(idx)}
                                    className="h-8 w-8 rounded border border-border-base text-red-500 hover:bg-red-500/5 flex items-center justify-center transition-colors shrink-0 mt-3"
                                    title="Remove referrer"
                                  >
                                    &times;
                                  </button>
                                </div>

                                {/* Partner sub-row: Specific referred by doctor/expert */}
                                {ref.type === "referral-partner" && (
                                  <div className="border-t border-border-base/50 pt-2 mt-1 grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-5">
                                      <span className="text-[9.5px] font-bold text-text-muted">Referred By (Doc/Expert):</span>
                                    </div>
                                    <div className="col-span-7">
                                      <select
                                        className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                        value={ref.referredById || ""}
                                        onChange={(e) => updateReferrerRow(idx, "referredById", e.target.value)}
                                      >
                                        <option value="">-- Optional Referring Person --</option>
                                        <optgroup label="Internal Doctors">
                                          {doctors.map((d) => (
                                            <option key={d.id} value={d.id}>
                                              Dr. {d.name} ({d.speciality || "GP"})
                                            </option>
                                          ))}
                                        </optgroup>
                                        <optgroup label="External Experts">
                                          {experts.map((exp) => (
                                            <option key={exp.id} value={exp.id}>
                                              {exp.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      </select>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Smart CTA Redirect link */}
                    <div className="p-3 bg-primary/5 rounded border border-primary/10 text-center">
                      <p className="text-[11px] text-text-muted">
                        Need to record Insurance, full family history, or payment details?
                      </p>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary hover:underline mt-1"
                        onClick={() => {
                          setIsQuickIntakeOpen(false);
                          navigate("/dashboard/patients/new");
                        }}
                      >
                        Go to Full Patient Registration Page &rarr;
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              <div className="px-4 sm:px-5 py-3 border-t border-border-base bg-surface-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 rounded-b-lg">
                <button
                  className="h-9 px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors w-full sm:w-auto"
                  type="button"
                  onClick={() => setIsQuickIntakeOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="h-9 px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors w-full sm:w-auto"
                  disabled={quickIntakeSaving}
                  type="submit"
                >
                  {quickIntakeSaving ? "Checking In..." : "Complete Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </>,
      modalRoot
    );
  };

  const handleSettleBilling = async (appt: Appointment) => {
    // 1. If the appointment already has a cached billingId, let's inspect it.
    let targetBillingId = appt.billingId;

    if (targetBillingId) {
      // Find the bill in our local real-time billings state
      const matchingBill = billings.find(b => b.id === targetBillingId);
      if (matchingBill) {
        const isConsBill = matchingBill.items?.some((item: any) =>
          item.appointmentTypeId === "consultation-fee" ||
          item.appointmentTypeName?.includes("Consultation Fee")
        );
        const isPaid = matchingBill.status === "paid" || matchingBill.paymentStatus === "paid";

        // If it's a paid consultation bill, ignore it so we don't navigate to it
        if (isConsBill && isPaid) {
          targetBillingId = null;
        }
      }
    }

    if (targetBillingId) {
      navigate(`/dashboard/appointments-billing/${targetBillingId}`);
      return;
    }

    // 2. Fetch the draft invoices for this patient to find the matching billing record
    try {
      if (!clinicId) return;
      const patientBillings = await appointmentBillingService.getBillingByPatient(appt.patientId, clinicId);

      // Find the most recent draft billing record for this patient that is NOT a consultation bill
      const draftBilling = patientBillings.find(b =>
        b.status === "draft" &&
        !b.items?.some((item: any) =>
          item.appointmentTypeId === "consultation-fee" ||
          item.appointmentTypeName?.includes("Consultation Fee")
        )
      );

      if (draftBilling) {
        navigate(`/dashboard/appointments-billing/${draftBilling.id}`);
      } else {
        // Automatically create a draft billing invoice for the procedure/appointment type!
        try {
          const isExpert = appt.assignedExpertId && appt.assignedExpertId !== "unassigned";
          const clinicianId = isExpert ? appt.assignedExpertId : (appt.doctorId || "unassigned");

          let docInfo = doctors.find((d) => d.id === clinicianId);
          if (!docInfo && isExpert) {
            docInfo = experts.find((e) => e.id === clinicianId) as any;
          }

          if (!docInfo && clinicianId && clinicianId !== "unassigned") {
            try {
              const fetchedDoc = await doctorService.getDoctorById(clinicianId);
              if (fetchedDoc) {
                docInfo = fetchedDoc;
              } else {
                const dbExp = await expertService.getExpertById(clinicianId);
                if (dbExp) docInfo = dbExp as any;
              }
            } catch (err) {
              console.error("Error loading doctor/expert details dynamically:", err);
            }
          }

          const apptType = appointmentTypes.find((t) => t.id === appt.appointmentTypeId);

          let pat = patients.find((p) => p.id === appt.patientId);
          if (!pat && appt.patientId) {
            try {
              pat = (await patientService.getPatientById(appt.patientId)) || undefined;
            } catch (err) {
              console.error("Error loading patient details dynamically:", err);
            }
          }

          let price = 500;
          let appointmentTypeName = "General Consultation";
          if (apptType) {
            price = Number(apptType.price) || 500;
            appointmentTypeName = apptType.name || "General Consultation";
          }

          // Resolve referrals
          const processedReferrals: Array<{
            type: "referral-partner" | "doctor" | "expert" | "staff";
            id: string;
            name: string;
            commissionPercentage: number;
            commissionAmount: number;
          }> = [];

          if (pat?.referrals && Array.isArray(pat.referrals) && pat.referrals.length > 0) {
            for (const ref of pat.referrals) {
              const pct = ref.commissionPercentage || 0;
              const amt = (price * pct) / 100;
              processedReferrals.push({
                type: ref.type,
                id: ref.id,
                name: ref.name,
                commissionPercentage: pct,
                commissionAmount: amt,
              });
            }
          } else if (pat?.referralPartnerId) {
            try {
              const partner = await referralPartnerService.getReferralPartnerById(pat.referralPartnerId);
              if (partner) {
                const pct = partner.defaultCommission || 0;
                const amt = (price * pct) / 100;
                processedReferrals.push({
                  type: "referral-partner",
                  id: partner.id,
                  name: partner.name,
                  commissionPercentage: pct,
                  commissionAmount: amt,
                });
              }
            } catch (err) {
              console.error("Error fetching fallback referral partner for automatic procedure billing:", err);
            }
          }

          const primaryPartner = processedReferrals.find(r => r.type === "referral-partner");
          const refPartnerId = primaryPartner ? primaryPartner.id : (pat?.referralPartnerId || undefined);
          const refCommissionAmt = primaryPartner ? primaryPartner.commissionAmount : undefined;

          const invoiceNo = await appointmentBillingService.generateInvoiceNumber(clinicId);

          const billingItem = {
            id: crypto.randomUUID(),
            appointmentTypeId: appt.appointmentTypeId || "manual-gp-fee",
            appointmentTypeName: appointmentTypeName,
            price: price,
            quantity: 1,
            commission: docInfo?.defaultCommission || 0,
            doctorId: clinicianId,
            doctorName: docInfo ? (docInfo.name.startsWith("Dr.") || isExpert ? docInfo.name : `Dr. ${docInfo.name}`) : (isExpert ? "Expert Cabin" : "Unknown Doctor"),
            amount: price,
          };

          const billingData = {
            invoiceNumber: invoiceNo,
            clinicId: clinicId,
            branchId: branchId ?? clinicId,
            patientId: appt.patientId,
            patientName: pat?.name || "Unknown Patient",
            doctorId: clinicianId,
            doctorName: docInfo ? (docInfo.name.startsWith("Dr.") || isExpert ? docInfo.name : `Dr. ${docInfo.name}`) : (isExpert ? "Expert Cabin" : "Unknown Doctor"),
            doctorType: (docInfo?.doctorType || "regular") as "regular" | "visitor",
            referralPartnerId: refPartnerId,
            referralCommissionAmount: refCommissionAmt && refCommissionAmt > 0 ? refCommissionAmt : undefined,
            referrals: processedReferrals,
            invoiceDate: new Date(),
            items: [billingItem],
            subtotal: price,
            itemDiscountAmount: 0,
            mainDiscountAmount: 0,
            discountType: "percent" as const,
            discountValue: 0,
            discountAmount: 0,
            taxPercentage: 0,
            taxAmount: 0,
            totalAmount: price,
            status: "draft" as const,
            paymentStatus: "unpaid" as const,
            paidAmount: 0,
            balanceAmount: price,
            createdBy: currentUser?.uid || "system",
          };

          const newBillingId = await appointmentBillingService.createBilling(billingData);

          // 1) Log Consulting Doctor Commission
          if (docInfo?.defaultCommission && docInfo.defaultCommission > 0) {
            try {
              await doctorCommissionService.createCommission(
                { id: newBillingId, ...billingData, createdAt: new Date(), updatedAt: new Date() } as any,
                docInfo.defaultCommission,
                currentUser?.uid || "system"
              );
            } catch (err) {
              console.error("Error creating doctor commission on automatic procedure bill:", err);
            }
          }

          // 1.5) Log Assigned Expert Commission
          const expertId = appt.assignedExpertId || pat?.assignedExpertId;
          if (expertId) {
            try {
              const expertInfo = await expertService.getExpertById(expertId);
              if (expertInfo && expertInfo.defaultCommission && expertInfo.defaultCommission > 0) {
                await expertCommissionService.createCommission(
                  expertInfo.id,
                  expertInfo.name,
                  { id: newBillingId, ...billingData, createdAt: new Date(), updatedAt: new Date() } as any,
                  expertInfo.defaultCommission,
                  currentUser?.uid || "system"
                );
              }
            } catch (err) {
              console.error("Error creating expert commission on automatic procedure bill:", err);
            }
          }

          // 2) Log Polymorphic Referrer Commissions
          for (const r of processedReferrals) {
            if (r.commissionAmount <= 0) continue;
            const billingRecord = {
              id: newBillingId,
              ...billingData,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any;
            try {
              if (r.type === "referral-partner") {
                await referralCommissionService.createReferralCommission(
                  billingRecord,
                  { id: r.id, name: r.name, defaultCommission: r.commissionPercentage } as any,
                  r.commissionAmount,
                  currentUser?.uid || "system"
                );
              } else if (r.type === "doctor") {
                const refBillingRecord = { ...billingRecord, doctorId: r.id, doctorName: r.name };
                await doctorCommissionService.createCommission(refBillingRecord, r.commissionPercentage, currentUser?.uid || "system");
              } else if (r.type === "expert") {
                await expertCommissionService.createCommission(r.id, r.name, billingRecord, r.commissionPercentage, currentUser?.uid || "system");
              } else if (r.type === "staff") {
                await staffCommissionService.createRegistrationCommission(
                  r.id, r.name, billingRecord.clinicId, billingRecord.branchId, billingRecord.patientId, billingRecord.patientName,
                  appointmentTypeName, price, r.commissionAmount, r.commissionPercentage, currentUser?.uid || "system"
                );
              }
            } catch (err) {
              console.error(`Error logging polymorphic commission for ${r.name} (${r.type}):`, err);
            }
          }

          // Link new billing to appointment
          await appointmentService.updateAppointment(appt.id, {
            billingId: newBillingId,
            billingStatus: "unpaid",
            paymentStatus: "unpaid",
            updatedAt: new Date(),
          } as any);

          addToast({
            title: "Invoice Generated",
            description: `Generated appointment invoice for ${appointmentTypeName}.`,
            color: "success",
          });

          navigate(`/dashboard/appointments-billing/${newBillingId}`);
        } catch (genErr) {
          console.error("Failed to generate procedure billing on fallback:", genErr);
          navigate("/dashboard/appointments-billing");
        }
      }
    } catch (err) {
      console.error("Error settling billing:", err);
      navigate("/dashboard/appointments-billing");
    }
  };

  const getGuidedAction = (appt: Appointment) => {
    const stage = getPatientStage(appt);
    const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
    const hasExpert = appt.assignedExpertId && appt.assignedExpertId !== "unassigned";
    const hasAnyClinician = hasDoctor || hasExpert;
    const pendingBillId = appt.billingId || (appt as any).consultationBillingId;
    const consBill = pendingBillId
      ? billings.find(b => b.id === pendingBillId)
      : (hasAnyClinician ? billings.find(b => b.patientId === appt.patientId && b.items?.some((item: any) => item.appointmentTypeId === "consultation-fee" || item.appointmentTypeName?.includes("Consultation Fee"))) : null);
    const isConsBillPaid = consBill ? (consBill.status === "paid" || consBill.paymentStatus === "paid") : false;
    const isConsBillPending = consBill && !isConsBillPaid;

    if (isConsBillPending) {
      const isCons = consBill.items?.some((item: any) => item.appointmentTypeId === "consultation-fee" || item.appointmentTypeName?.includes("Consultation"));
      return {
        label: isCons ? "Settle Consultation Bill" : "Settle Billing Invoice",
        icon: <IoCardOutline className="w-4 h-4" />,
        colorClass: "bg-red-500 text-white hover:bg-red-600 animate-pulse",
        onClick: () => navigate(`/dashboard/appointments-billing/${consBill.id}`),
      };
    }

    switch (stage) {
      case "scheduled":
        return {
          label: "Check-In Patient",
          icon: <IoCheckmarkCircleOutline className="w-4 h-4" />,
          colorClass: "bg-primary text-white hover:bg-primary/90",
          onClick: () => handleCheckIn(appt.id),
        };
      case "lobby":
        return {
          label: "Record Triage Vitals",
          icon: <IoHeartOutline className="w-4 h-4" />,
          colorClass: "bg-teal-500 text-white hover:bg-teal-600",
          onClick: () => handleOpenTriage(appt),
        };
      case "triage-done":
        return {
          label: hasDoctor ? "Send to Doctor Cabin" : "Send to Expert Cabin",
          icon: <IoPlayOutline className="w-4 h-4" />,
          colorClass: "bg-indigo-500 text-white hover:bg-indigo-600 animate-pulse",
          onClick: () => handleSendToDoctor(appt.id),
        };
      case "doctor": {
        const hasPrescription = prescriptions.some(p => p.appointmentId === appt.id);
        if (hasPrescription) {
          return {
            label: hasExpert ? "Send to Expert Cabin" : "Complete Consultation",
            icon: <IoCheckmarkCircleOutline className="w-4 h-4" />,
            colorClass: "bg-primary text-white hover:bg-primary/90",
            onClick: () => handleCompleteConsultation(appt.id),
          };
        }
        return {
          label: "Write Prescription",
          icon: <IoDocumentTextOutline className="w-4 h-4" />,
          colorClass: "bg-amber-500 text-white hover:bg-amber-600 animate-pulse",
          onClick: () => navigate(`/dashboard/prescriptions/new?appointmentId=${appt.id}`),
        };
      }
      case "expert":
        return {
          label: "Record Procedure Log",
          icon: <IoCreateOutline className="w-4 h-4" />,
          colorClass: "bg-primary text-white hover:bg-primary/95",
          onClick: () => {
            setSelectedAppointment(appt);

            const apptTypeName = getApptTypeLabel(appt.appointmentTypeId);
            const apptType = appointmentTypes.find((t) => t.id === appt.appointmentTypeId);
            const apptPrice = apptType ? String(apptType.price || "") : "";

            setProcedure({
              procedureType: apptTypeName,
              energy: "",
              spotSize: "",
              pulseWidth: "",
              passes: "",
              area: "Full Face",
              fee: apptPrice,
              notes: "",
            });
            setIsProcedureModalOpen(true);

            if (clinicId && appt.patientId) {
              setLoadingHistory(true);
              PatientNoteEntriesService.getSectionNoteEntries(clinicId, appt.patientId, "laser-procedure")
                .then((entries) => {
                  setHistoricalProcedures(entries);
                })
                .catch((err) => {
                  console.error("Error loading patient procedure history:", err);
                })
                .finally(() => {
                  setLoadingHistory(false);
                });
            }
          },
        };
      case "billing":
        return {
          label: "Settle Billing Invoice",
          icon: <IoCardOutline className="w-4 h-4" />,
          colorClass: "bg-saffron-500 text-white hover:bg-saffron-600",
          onClick: () => handleSettleBilling(appt),
        };
      case "pharmacy":
        return {
          label: "Fulfill Prescription",
          icon: <IoReceiptOutline className="w-4 h-4" />,
          colorClass: "bg-purple-500 text-white hover:bg-purple-600 animate-pulse",
          onClick: () => navigate("/dashboard/pharmacy?tab=prescriptions"),
        };
      default:
        return {
          label: "Checkout Completed",
          icon: <IoCheckmarkCircleOutline className="w-4 h-4 text-green-500" />,
          colorClass: "bg-green-500/10 text-green-600 border border-green-500/20 cursor-default",
          onClick: () => { },
        };
    }
  };

  const getStageBadge = (stage: string, appt?: Appointment) => {
    if (appt) {
      const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
      const consBill = (appt as any).consultationBillingId
        ? billings.find(b => b.id === (appt as any).consultationBillingId)
        : (hasDoctor ? billings.find(b => b.patientId === appt.patientId && b.items?.some((item: any) => item.appointmentTypeId === "consultation-fee" || item.appointmentTypeName?.includes("Consultation Fee"))) : null);
      const isConsBillPaid = consBill ? (consBill.status === "paid" || consBill.paymentStatus === "paid") : false;
      const isConsBillPending = hasDoctor && consBill && !isConsBillPaid;

      if (isConsBillPending) {
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse">Consultation Fee Pending</span>;
      }
    }

    switch (stage) {
      case "scheduled":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-3 text-text-muted border border-border-base">Booking Today</span>;
      case "lobby":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">Waiting In Lobby</span>;
      case "triage-done":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Triage Finished</span>;
      case "doctor":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">In Doctor Cabin</span>;
      case "expert":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">In Expert Cabin</span>;
      case "billing":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-saffron-500/10 text-saffron-600 dark:text-saffron-400 border border-saffron-500/20">Billing Pending</span>;
      case "pharmacy":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">Pharmacy Pending</span>;
      default:
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">Completed</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>Front Office Dashboard</h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Live patient operational waitlist queue and lobby triage desk.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="clarity-btn clarity-btn-primary flex items-center gap-1.5"
            type="button"
            onClick={() => setIsQuickIntakeOpen(true)}
          >
            <IoAddOutline className="w-4 h-4" />
            New Intake Check-In
          </button>
          <button
            className="clarity-btn clarity-btn-ghost flex items-center gap-1.5"
            type="button"
            onClick={() => navigate("/dashboard/front-office/manage-visitors")}
          >
            <IoPeopleOutline className="w-4 h-4" />
            Visitors Log
          </button>
          <button
            className="clarity-btn bg-emerald-500 hover:bg-emerald-600 text-white border-transparent flex items-center gap-1.5"
            type="button"
            onClick={seedDemoDoctorAndExpert}
          >
            <IoAddOutline className="w-4 h-4" />
            Seed Doctor & Expert
          </button>
        </div>
      </div>

      {/* Stats Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        <StatCard
          colorClass="bg-surface-3 text-text-muted"
          icon={<IoCalendarOutline className="w-5 h-5" />}
          label={selectedDate.toDateString() === new Date().toDateString() ? "Today's Appointments" : `${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} Appointments`}
          value={appointments.length}
        />
        <StatCard
          colorClass="bg-teal-500/10 text-teal-600"
          icon={<IoPeopleOutline className="w-5 h-5" />}
          label="Waiting in Lobby"
          value={appointments.filter((a) => getPatientStage(a) === "lobby").length}
        />
        <StatCard
          colorClass="bg-indigo-500/10 text-indigo-600"
          icon={<IoHeartOutline className="w-5 h-5" />}
          label="Triage Completed"
          value={appointments.filter((a) => getPatientStage(a) === "triage-done").length}
        />
        <StatCard
          colorClass="bg-amber-500/10 text-amber-600"
          icon={<IoTimeOutline className="w-5 h-5" />}
          label="In Doctor Cabin"
          value={appointments.filter((a) => getPatientStage(a) === "doctor").length}
        />
        <StatCard
          colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          icon={<IoPeopleOutline className="w-5 h-5" />}
          label="In Expert Cabin"
          value={appointments.filter((a) => getPatientStage(a) === "expert").length}
        />
        <StatCard
          colorClass="bg-saffron-500/10 text-saffron-600"
          icon={<IoCardOutline className="w-5 h-5" />}
          label="Invoice Pending"
          value={appointments.filter((a) => getPatientStage(a) === "billing").length}
        />
        <StatCard
          colorClass="bg-purple-500/10 text-purple-600"
          icon={<IoReceiptOutline className="w-5 h-5" />}
          label="Pharmacy Pending"
          value={appointments.filter((a) => getPatientStage(a) === "pharmacy").length}
        />
      </div>

      {/* Date Navigator Bar */}
      {(() => {
        const today = new Date();
        const todayStr = today.toDateString();
        const selectedStr = selectedDate.toDateString();
        const isSelectedToday = selectedStr === todayStr;
        const dateLabel = isSelectedToday
          ? "Today"
          : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

        const goToPrev = () => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 1);
          setSelectedDate(d);
        };
        const goToNext = () => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + 1);
          setSelectedDate(d);
        };
        const goToToday = () => setSelectedDate(new Date());

        return (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface border border-border-base rounded px-4 py-2.5">
            <div className="flex items-center gap-2">
              <button
                className="h-7 w-7 flex items-center justify-center rounded border border-border-base hover:border-primary hover:text-primary text-text-muted transition-colors"
                title="Previous day"
                type="button"
                onClick={goToPrev}
              >
                &#8249;
              </button>
              <div className="text-center">
                <p className="text-[13px] font-bold text-text-main">{dateLabel}</p>
                <p className="text-[11px] text-text-muted">{selectedDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}</p>
              </div>
              <button
                className="h-7 w-7 flex items-center justify-center rounded border border-border-base hover:border-primary hover:text-primary text-text-muted transition-colors"
                title="Next day"
                type="button"
                onClick={goToNext}
              >
                &#8250;
              </button>
              {!isSelectedToday && (
                <button
                  className="text-[11px] font-bold text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded transition-colors"
                  type="button"
                  onClick={goToToday}
                >
                  Back to Today
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11.5px] font-semibold text-text-muted">Jump to date:</label>
              <input
                className="h-8 px-2 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary transition-colors"
                type="date"
                value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(new Date(e.target.value + "T00:00:00"));
                }}
              />
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isSelectedToday ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning-600"
                }`}>
                {isSelectedToday ? "● Live" : "📅 Archive"}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Live Queue Board and Tabs */}
      <div className="bg-surface border border-border-base rounded overflow-hidden shadow-none">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border-base bg-surface-2 p-1 gap-1 flex-wrap">
          {[
            { id: "lobby", name: " LOBBY QUEUE / WAITLIST", count: appointments.filter(a => ["scheduled", "lobby"].includes(getPatientStage(a))).length },
            { id: "triage", name: "🩺 TRIAGE WAITING", count: appointments.filter(a => getPatientStage(a) === "lobby").length },
            { id: "doctor", name: "👨‍⚕️ DOCTOR CABINS", count: appointments.filter(a => { const s = getPatientStage(a); const hasDoc = a.doctorId && a.doctorId !== "unassigned"; return s === "doctor" || (s === "triage-done" && hasDoc); }).length },
            { id: "expert", name: "👥 EXPERT CABINS", count: appointments.filter(a => { const s = getPatientStage(a); const hasDoc = a.doctorId && a.doctorId !== "unassigned"; return s === "expert" || (s === "triage-done" && !hasDoc); }).length },
            { id: "billing", name: "💳 BILLING COUNTER", count: appointments.filter(a => getPatientStage(a) === "billing").length },
            { id: "pharmacy", name: "💊 PHARMACY QUEUE", count: appointments.filter(a => getPatientStage(a) === "pharmacy").length },
            { id: "all", name: "📋 ALL WORKFLOW", count: appointments.length },
          ].filter(tab => {
            const isDoc = doctors.some((d) => d.email?.toLowerCase() === currentUser?.email?.toLowerCase());
            const isExp = experts.some((e) => e.email?.toLowerCase() === currentUser?.email?.toLowerCase());
            if (isDoc) {
              return ["doctor", "all"].includes(tab.id);
            }
            if (isExp) {
              return ["expert", "all"].includes(tab.id);
            }
            return true;
          }).map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-[12px] font-semibold rounded transition flex items-center gap-2 border border-transparent ${activeTab === tab.id
                ? "bg-surface text-primary shadow-sm border-border-base/50"
                : "text-text-muted hover:text-text-main hover:bg-surface-3/50"
                }`}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.name}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-surface-3 text-text-muted"
                }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Live List rendering */}
        <div className="p-4">
          {loading ? (
            <div className="py-20 text-center flex flex-col justify-center items-center gap-3">
              <Spinner size="lg" />
              <p className="text-[13.5px] font-medium text-text-muted">Loading live waitlist queue...</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <IoPeopleOutline className="w-12 h-12 text-text-muted/20 mb-3" />
              <p className="text-[14.5px] font-medium text-text-main">No patients in this stage</p>
              <p className="text-[13px] text-text-muted mt-1">There are no active patient records matching this operational queue filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((appt) => {
                const patientName = getPatientName(appt.patientId);
                const doctorName = getDoctorName(appt);
                const apptType = getApptTypeLabel(appt.appointmentTypeId);
                const time = appt.startTime ? `${formatTimeTo12Hour(appt.startTime)}` : "Time not set";
                const stage = getPatientStage(appt);
                const action = getGuidedAction(appt);
                const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
                const consBill = hasDoctor ? billings.find(b => b.patientId === appt.patientId && b.items?.some((item: any) => item.appointmentTypeId === "consultation-fee" || item.appointmentTypeName?.includes("Consultation Fee"))) : null;
                const isConsBillPaid = consBill ? (consBill.status === "paid" || consBill.paymentStatus === "paid") : false;
                const isConsBillPending = hasDoctor && consBill && !isConsBillPaid;

                return (
                  <div
                    key={appt.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-surface border border-border-base rounded hover:border-primary transition-colors relative"
                  >
                    <div className="flex items-start md:items-center flex-1 gap-4">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded bg-surface-2 border border-border-base text-text-muted flex items-center justify-center text-[12px] font-bold shrink-0">
                        {patientName.substring(0, 2).toUpperCase()}
                      </div>

                      {/* Patient / Encounter Details */}
                      <div className="flex-1 flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 w-full">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <Link
                                to={`/dashboard/patients/${appt.patientId}`}
                                className="text-[13.5px] font-bold text-primary hover:underline leading-none"
                              >
                                {patientName}
                              </Link>
                              {getStageBadge(stage, appt)}
                            </div>
                            <p className="text-[11.5px] text-text-muted">
                              Reg #{getPatientReg(appt.patientId)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-text-main leading-none mb-1">
                              {doctorName}
                            </p>
                            <p className="text-[11.5px] text-text-muted">
                              {getDoctorSpeciality(appt)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-text-main leading-none mb-1">
                              Today
                            </p>
                            <p className="text-[11.5px] text-text-muted">{time}</p>
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-text-main leading-none mb-1">
                              {apptType}
                            </p>
                            <p className="text-[11.5px] text-text-muted truncate">
                              {appt.reason || appt.notes || "General consultation"}
                            </p>
                          </div>
                        </div>

                        {/* High-Fidelity Progression Pipeline stepper */}
                        <div className="border-t border-border-base/40 pt-2.5 flex items-center gap-1 md:gap-1.5 w-full max-w-2xl">
                          {(() => {
                            const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
                            const hasExpert = appt.assignedExpertId && appt.assignedExpertId !== "unassigned";

                            const steps: string[] = ["Check-In", "Lobby Wait", "Triage Done"];
                            const stepStages: string[] = ["scheduled", "lobby", "triage-done"];

                            if (hasDoctor) {
                              steps.push("Doctor Cabin");
                              stepStages.push("doctor");
                            }
                            if (hasExpert) {
                              steps.push("Expert Cabin");
                              stepStages.push("expert");
                            }

                            steps.push("Billing Pending", "Pharmacy Queue");
                            stepStages.push("billing", "pharmacy");

                            const currentStageIdx = stepStages.indexOf(stage);

                            return steps.map((step, idx) => {
                              const isCompleted = stage === "completed" || (currentStageIdx > idx && currentStageIdx !== -1);
                              const isActive = currentStageIdx === idx;

                              let stepColor = "bg-surface-3 text-text-muted/40 border-transparent";
                              if (isCompleted) {
                                stepColor = "bg-green-500/10 text-green-600 border-green-500/20";
                              } else if (isActive) {
                                if (step === "Lobby Wait") {
                                  stepColor = "bg-teal-500/10 text-teal-600 border-teal-500/20 ring-1 ring-teal-500/10";
                                } else if (step === "Triage Done") {
                                  stepColor = "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 ring-1 ring-indigo-500/10";
                                } else if (step === "Doctor Cabin" || step === "Expert Cabin") {
                                  stepColor = "bg-amber-500/10 text-amber-600 border-amber-500/20 ring-1 ring-amber-500/10";
                                } else if (step === "Billing Pending") {
                                  stepColor = "bg-saffron-500/10 text-saffron-600 border-saffron-500/20 ring-1 ring-saffron-500/10";
                                } else if (step === "Pharmacy Queue") {
                                  stepColor = "bg-purple-500/10 text-purple-600 border-purple-500/20 ring-1 ring-purple-500/10";
                                } else {
                                  stepColor = "bg-primary/10 text-primary border-primary/20 ring-1 ring-primary/10";
                                }
                              }

                              return (
                                <React.Fragment key={step}>
                                  <div className={`flex-1 text-[9.5px] py-0.5 text-center font-bold rounded uppercase border tracking-wider transition-all duration-300 ${stepColor} truncate`}>
                                    {step}
                                  </div>
                                  {idx < steps.length - 1 && <span className="text-text-muted/30 text-[9px] font-bold shrink-0">&rarr;</span>}
                                </React.Fragment>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Guided Action Trigger Button */}
                    <div className="flex items-center gap-2 mt-4 md:mt-0 ml-0 md:ml-4 self-end md:self-auto border-t md:border-t-0 border-border-base pt-3 md:pt-0 w-full md:w-auto justify-end">
                      {stage === "lobby" && !isConsBillPending && (
                        <button
                          className="h-9 px-3 rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                          type="button"
                          onClick={() => handleSendToDoctor(appt.id)}
                        >
                          Skip Triage
                        </button>
                      )}
                      {(stage === "doctor" || stage === "expert") && (
                        <button
                          className="h-9 px-3 rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                          type="button"
                          onClick={() => handleCompleteConsultation(appt.id)}
                        >
                          {stage === "doctor"
                            ? (appt.assignedExpertId && appt.assignedExpertId !== "unassigned" ? "Send to Expert Cabin" : "Complete Consultation")
                            : "Complete (No Log)"}
                        </button>
                      )}
                      {stage === "billing" && (
                        <button
                          className="h-9 px-3 rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                          type="button"
                          onClick={() => handleCompleteCheckout(appt.id)}
                        >
                          Complete Checkout
                        </button>
                      )}
                      <button
                        className={`h-9 px-4 rounded text-[12.5px] font-semibold flex items-center gap-1.5 transition-colors outline-none ${action.colorClass}`}
                        type="button"
                        onClick={action.onClick}
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Render the triage vitals popup modal */}
      {renderTriageModal()}

      {/* Render the procedure log popup modal */}
      {renderProcedureModal()}

      {/* Render the quick intake walk-in modal */}
      {renderQuickIntakeModal()}
    </div>
  );
}
