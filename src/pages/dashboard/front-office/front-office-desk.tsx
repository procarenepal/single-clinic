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
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { PatientNoteEntriesService } from "@/services/patientNoteEntriesService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { expertService } from "@/services/expertService";
import { hrService } from "@/services/hrService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { Appointment, Patient, Doctor, AppointmentType, ReferralPartner, Expert, StaffMember } from "@/types/models";
import { Spinner } from "@/components/ui";
import { isToday } from "date-fns";
import { db } from "@/config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function FrontOfficeDesk() {
  const navigate = useNavigate();
  const { clinicId, currentUser, branchId } = useAuthContext();
  
  // Real-time queue data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [billings, setBillings] = useState<any[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  
  // App states
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"lobby" | "triage" | "doctor" | "billing" | "all">("lobby");
  
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

  // Quick walk-in intake modal state
  const [isQuickIntakeOpen, setIsQuickIntakeOpen] = useState(false);
  const [quickIntakeSaving, setQuickIntakeSaving] = useState(false);
  const [intakeMode, setIntakeMode] = useState<"new" | "existing">("new");
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [selectedExistingPatient, setSelectedExistingPatient] = useState<Patient | null>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [quickIntakeForm, setQuickIntakeForm] = useState({
    name: "",
    mobile: "",
    age: "",
    gender: "male",
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

  // Load supporting data
  useEffect(() => {
    if (!clinicId) return;

    let isActive = true;
    const loadStaticData = async () => {
      try {
        const [patientsData, doctorsData, apptTypesData, referralPartnersData, expertsData, staffData] = await Promise.all([
          patientService.getPatients(branchId || undefined),
          doctorService.getDoctors(branchId || undefined),
          appointmentTypeService.getAppointmentTypes(branchId || undefined),
          referralPartnerService.getReferralPartnersByClinic(clinicId || undefined, branchId || undefined),
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
        // Only keep today's appointments for the live lobby queue
        const todayAppts = data.filter((appt) => isToday(appt.appointmentDate));
        setAppointments(todayAppts);
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

    return () => {
      unsubscribeAppts?.();
      unsubscribeBillings?.();
    };
  }, [clinicId, branchId]);

  // Helpers to resolve names
  const getPatientName = (patientId: string) => 
    patients.find((p) => p.id === patientId)?.name || "Walk-In Patient";
  
  const getPatientReg = (patientId: string) => 
    patients.find((p) => p.id === patientId)?.regNumber || "N/A";
  
  const getDoctorName = (doctorId: string) => {
    const doc = doctors.find((d) => d.id === doctorId);
    if (doc) return `Dr. ${doc.name}`;
    const exp = experts.find((e) => e.id === doctorId);
    return exp ? exp.name : "General MD";
  };

  const getDoctorSpeciality = (doctorId: string) => {
    const doc = doctors.find((d) => d.id === doctorId);
    if (doc) return doc.speciality || "General Physician";
    const exp = experts.find((e) => e.id === doctorId);
    return exp ? exp.speciality || "Visiting Consultant" : "General Physician";
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

  // Dynamic state machine triggers
  const handleCheckIn = async (appointmentId: string) => {
    try {
      await appointmentService.updateAppointmentStatus(appointmentId, "confirmed");
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
      await appointmentService.updateAppointmentStatus(appointmentId, "in-progress");
      addToast({
        title: "Sent to Doctor Cabin",
        description: "Patient status updated to In Consultation.",
        color: "success",
      });
    } catch (err) {
      console.error("Error sending patient to doctor:", err);
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

  // Determine stage of patient based on appointment
  const getPatientStage = (appt: Appointment): "scheduled" | "lobby" | "triage-done" | "doctor" | "billing" | "completed" => {
    const status = appt.status?.toLowerCase();
    
    if (status === "scheduled") return "scheduled";
    if (status === "confirmed") {
      // Check if triage vitals note header prefix exists inside notes field
      if (appt.notes?.includes("[Triage Vitals Recorded]")) {
        return "triage-done";
      }
      return "lobby";
    }
    if (status === "in-progress") return "doctor";
    if (status === "completed") {
      // 1. Check if the billing record exists and is paid in our real-time billings list
      const billingRec = billings.find(b => 
        b.id === (appt as any).billingId || 
        (b.patientId === appt.patientId && isToday(b.invoiceDate instanceof Date ? b.invoiceDate : (b.invoiceDate?.toDate ? b.invoiceDate.toDate() : new Date(b.invoiceDate))))
      );
      
      if (billingRec && (billingRec.status === "paid" || billingRec.paymentStatus === "paid")) {
        return "completed";
      }

      // 2. Fallback to local properties if billing record hasn't synced/loaded yet
      if ((appt as any).billingStatus === "paid" || (appt as any).paymentStatus === "paid") {
        return "completed";
      }
      return "billing"; // Waiting for invoice/checkout
    }
    return "completed";
  };

  // Filter list by selected active tab
  const filteredAppointments = appointments.filter((appt) => {
    const stage = getPatientStage(appt);
    
    if (activeTab === "lobby") return stage === "scheduled" || stage === "lobby";
    if (activeTab === "triage") return stage === "lobby";
    if (activeTab === "doctor") return stage === "triage-done" || stage === "doctor";
    if (activeTab === "billing") return stage === "billing";
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
      const startTime24 = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const apptData = {
        patientId: patientIdToUse,
        doctorId: quickIntakeForm.doctorId || "unassigned",
        assignedExpertId: quickIntakeForm.assignedExpertId || undefined,
        appointmentTypeId: quickIntakeForm.appointmentTypeId || (appointmentTypes[0]?.id || "default"),
        appointmentDate: now,
        startTime: startTime24,
        endTime: undefined,
        status: "confirmed" as const, // Checked-In / Waiting in Lobby
        reason: quickIntakeForm.reason.trim() || "Walk-in General Checkup",
        clinicId: clinicId || "standalone",
        branchId: branchId || clinicId || "standalone",
        createdBy: currentUser?.uid || "",
      };

      await appointmentService.createAppointment(apptData);

      const patientDisplayName = intakeMode === "new" ? quickIntakeForm.name : selectedExistingPatient.name;

      addToast({
        title: "Quick Check-In Successful",
        description: `${patientDisplayName} is checked in successfully (Reg# ${regNumberToUse}).`,
        color: "success",
      });

      // Fetch fresh patient list so local names resolve immediately
      const updatedPatients = await patientService.getPatients(branchId || undefined);
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsQuickIntakeOpen(false)} />
        <div className="bg-surface rounded border border-border-base shadow-xl max-w-4xl w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[14.5px] text-text-main">
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
            <div className="p-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Column: Demographics & Intake Details */}
                <div className="space-y-4">
                  {/* Intake Mode Switcher */}
                  <div className="flex bg-surface-2 p-1 rounded-lg border border-border-base w-full mb-2">
                    <button
                      type="button"
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        intakeMode === "new"
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
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        intakeMode === "existing"
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
                          <input
                            required
                            className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                            placeholder="e.g. 98XXXXXXXX"
                            type="tel"
                            value={quickIntakeForm.mobile}
                            onChange={(e) => setQuickIntakeForm((prev) => ({ ...prev, mobile: e.target.value }))}
                          />
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

                      {/* Gender & Appointment Category */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="px-5 py-3.5 border-t border-border-base bg-surface-2 flex justify-end gap-3 rounded-b-lg">
              <button
                className="h-9 px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors"
                type="button"
                onClick={() => setIsQuickIntakeOpen(false)}
              >
                Cancel
              </button>
              <button
                className="h-9 px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                disabled={quickIntakeSaving}
                type="submit"
              >
                {quickIntakeSaving ? "Checking In..." : "Complete Check-In"}
              </button>
            </div>
          </form>
        </div>
      </div>,
      modalRoot
    );
  };

  const handleSettleBilling = async (appt: Appointment) => {
    // 1. If the appointment already has a cached billingId, navigate directly
    if ((appt as any).billingId) {
      navigate(`/dashboard/appointments-billing/${(appt as any).billingId}`);
      return;
    }

    // 2. Fetch the draft invoices for this patient to find the matching billing record
    try {
      if (!clinicId) return;
      const billings = await appointmentBillingService.getBillingByPatient(appt.patientId, clinicId);
      
      // Find the most recent draft billing record for this patient
      const draftBilling = billings.find(b => b.status === "draft");
      
      if (draftBilling) {
        navigate(`/dashboard/appointments-billing/${draftBilling.id}`);
      } else {
        // Fallback: if no draft found, find any invoice from today or fallback to general list
        const todayBilling = billings[0]; // sorted newest first
        if (todayBilling) {
          navigate(`/dashboard/appointments-billing/${todayBilling.id}`);
        } else {
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
          label: "Send to Doctor Cabin",
          icon: <IoPlayOutline className="w-4 h-4" />,
          colorClass: "bg-indigo-500 text-white hover:bg-indigo-600 animate-pulse",
          onClick: () => handleSendToDoctor(appt.id),
        };
      case "doctor":
        return {
          label: "Write Prescription",
          icon: <IoDocumentTextOutline className="w-4 h-4" />,
          colorClass: "bg-amber-500 text-white hover:bg-amber-600 animate-pulse",
          onClick: () => navigate(`/dashboard/prescriptions/new?appointmentId=${appt.id}`),
        };
      case "billing":
        return {
          label: "Settle Billing Invoice",
          icon: <IoCardOutline className="w-4 h-4" />,
          colorClass: "bg-saffron-500 text-white hover:bg-saffron-600",
          onClick: () => handleSettleBilling(appt),
        };
      default:
        return {
          label: "Checkout Completed",
          icon: <IoCheckmarkCircleOutline className="w-4 h-4 text-green-500" />,
          colorClass: "bg-green-500/10 text-green-600 border border-green-500/20 cursor-default",
          onClick: () => {},
        };
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case "scheduled":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-3 text-text-muted border border-border-base">Booking Today</span>;
      case "lobby":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">Waiting In Lobby</span>;
      case "triage-done":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Triage Finished</span>;
      case "doctor":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">In Doctor Cabin</span>;
      case "billing":
        return <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-saffron-500/10 text-saffron-600 dark:text-saffron-400 border border-saffron-500/20">Billing Pending</span>;
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
        </div>
      </div>

      {/* Stats Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          colorClass="bg-surface-3 text-text-muted"
          icon={<IoCalendarOutline className="w-5 h-5" />}
          label="Today's Appointments"
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
          colorClass="bg-saffron-500/10 text-saffron-600"
          icon={<IoCardOutline className="w-5 h-5" />}
          label="Invoice Pending"
          value={appointments.filter((a) => getPatientStage(a) === "billing").length}
        />
      </div>

      {/* Live Queue Board and Tabs */}
      <div className="bg-surface border border-border-base rounded overflow-hidden shadow-none">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border-base bg-surface-2 p-1 gap-1">
          {[
            { id: "lobby", name: " LOBBY QUEUE / WAITLIST", count: appointments.filter(a => ["scheduled", "lobby"].includes(getPatientStage(a))).length },
            { id: "triage", name: "🩺 TRIAGE WAITING", count: appointments.filter(a => getPatientStage(a) === "lobby").length },
            { id: "doctor", name: "👨‍⚕️ DOCTOR CABINS", count: appointments.filter(a => ["triage-done", "doctor"].includes(getPatientStage(a))).length },
            { id: "billing", name: "💳 BILLING COUNTER", count: appointments.filter(a => getPatientStage(a) === "billing").length },
            { id: "all", name: "📋 ALL TODAY'S WORKFLOW", count: appointments.length },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-[12px] font-semibold rounded transition flex items-center gap-2 border border-transparent ${
                activeTab === tab.id
                  ? "bg-surface text-primary shadow-sm border-border-base/50"
                  : "text-text-muted hover:text-text-main hover:bg-surface-3/50"
              }`}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.name}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-surface-3 text-text-muted"
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
                const doctorName = getDoctorName(appt.doctorId);
                const apptType = getApptTypeLabel(appt.appointmentTypeId);
                const time = appt.startTime ? `${formatTimeTo12Hour(appt.startTime)}` : "Time not set";
                const stage = getPatientStage(appt);
                const action = getGuidedAction(appt);

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
                              {getStageBadge(stage)}
                            </div>
                            <p className="text-[11.5px] text-text-muted">
                              Reg #{getPatientReg(appt.patientId)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-text-main leading-none mb-1">
                              Dr. {doctorName}
                            </p>
                            <p className="text-[11.5px] text-text-muted">
                              {getDoctorSpeciality(appt.doctorId)}
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
                          {["Check-In", "Lobby Wait", "Triage Done", "Consultation", "Billing Pending"].map((step, idx) => {
                            const stepStages = ["scheduled", "lobby", "triage-done", "doctor", "billing"];
                            const currentStageIdx = stepStages.indexOf(stage);
                            const isCompleted = currentStageIdx > idx;
                            const isActive = currentStageIdx === idx;

                            let stepColor = "bg-surface-3 text-text-muted/40 border-transparent";
                            if (isCompleted) {
                              stepColor = "bg-green-500/10 text-green-600 border-green-500/20";
                            } else if (isActive) {
                              if (step === "Lobby Wait") {
                                stepColor = "bg-teal-500/10 text-teal-600 border-teal-500/20 ring-1 ring-teal-500/10";
                              } else if (step === "Triage Done") {
                                stepColor = "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 ring-1 ring-indigo-500/10";
                              } else if (step === "Consultation") {
                                stepColor = "bg-amber-500/10 text-amber-600 border-amber-500/20 ring-1 ring-amber-500/10";
                              } else if (step === "Billing Pending") {
                                stepColor = "bg-saffron-500/10 text-saffron-600 border-saffron-500/20 ring-1 ring-saffron-500/10";
                              } else {
                                stepColor = "bg-primary/10 text-primary border-primary/20 ring-1 ring-primary/10";
                              }
                            }

                            return (
                              <React.Fragment key={step}>
                                <div className={`flex-1 text-[9.5px] py-0.5 text-center font-bold rounded uppercase border tracking-wider transition-all duration-300 ${stepColor} truncate`}>
                                  {step}
                                </div>
                                {idx < 4 && <span className="text-text-muted/30 text-[9px] font-bold shrink-0">&rarr;</span>}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Guided Action Trigger Button */}
                    <div className="flex items-center gap-3 mt-4 md:mt-0 ml-0 md:ml-4 self-end md:self-auto border-t md:border-t-0 border-border-base pt-3 md:pt-0 w-full md:w-auto justify-end">
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

      {/* Render the quick intake walk-in modal */}
      {renderQuickIntakeModal()}
    </div>
  );
}
