/**
 * New Prescription Page — Clinic Clarity without HeroUI
 */
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IoTrashOutline,
  IoArrowBackOutline,
  IoAddOutline,
  IoSaveOutline,
  IoSearchOutline,
  IoCloseOutline,
  IoDocumentTextOutline,
  IoPulseOutline,
  IoFlaskOutline,
  IoMedicalOutline,
  IoClipboardOutline,
  IoThermometerOutline,
  IoHeartOutline,
  IoSpeedometerOutline,
  IoBodyOutline,
  IoSparklesOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { medicineService } from "@/services/medicineService";
import { appointmentService } from "@/services/appointmentService";
import { prescriptionService } from "@/services/prescriptionService";
import { branchService } from "@/services/branchService";
import { PatientNoteEntriesService } from "@/services/patientNoteEntriesService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { doctorCommissionService } from "@/services/doctorCommissionService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { referralCommissionService } from "@/services/referralCommissionService";
import { expertCommissionService } from "@/services/expertCommissionService";
import { staffCommissionService } from "@/services/staffCommissionService";
import { expertService } from "@/services/expertService";
import { pathologyService } from "@/services/pathologyService";
import { pathologyBillingService } from "@/services/pathologyBillingService";

// ── Types ───────────────────────────────────────────────────────────────────
interface PrescriptionItem {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  duration: string;
  time: string;
  interval: string;
}

interface PathologyTestSelection {
  id: string;
  testId: string;
  testName: string;
  price: number;
}

// ── Custom UI Components ─────────────────────────────────────────────────
function CustomInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  description,
  disabled,
  readOnly,
  className,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full relative ${className || ""}`}>
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border border-border-base rounded-[10px] min-h-[38px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 ${disabled || readOnly ? "bg-surface-2" : ""}`}
      >
        {type === "textarea" ? (
          <textarea
            className="flex-1 w-full text-[13.5px] px-3 py-2 bg-transparent outline-none text-text-main placeholder:text-text-muted/70 disabled:text-text-muted min-h-[80px]"
            disabled={disabled}
            name={name}
            placeholder={placeholder}
            readOnly={readOnly}
            required={required}
            value={value}
            onChange={onChange}
          />
        ) : (
          <input
            className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/70 disabled:text-text-muted"
            disabled={disabled}
            name={name}
            placeholder={placeholder}
            readOnly={readOnly}
            required={required}
            type={type}
            value={value}
            onChange={onChange}
          />
        )}
      </div>
      {description && (
        <p className="text-[11.5px] text-text-muted">{description}</p>
      )}
    </div>
  );
}

function SearchSelect({
  label,
  items,
  value,
  onChange,
  disabled,
  required,
  description,
  placeholder,
}: {
  label: string;
  items: { id: string; primary: string; secondary?: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
  description?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = (
    q
      ? items.filter((i) =>
        (i.primary + " " + (i.secondary || ""))
          .toLowerCase()
          .includes(q.toLowerCase()),
      )
      : items
  ).slice(0, 100);
  const selected = items.find((i) => i.id === value);

  return (
    <div className="flex flex-col gap-1.5 relative w-full">
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex flex-wrap items-center min-h-[38px] border border-border-base rounded-[10px] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-surface ${disabled ? "bg-surface-2" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-3 w-4 h-4 text-text-muted/70 shrink-0" />
        <input
          className="flex-1 text-[13.5px] px-2 py-1.5 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/70 w-full"
          disabled={disabled}
          placeholder={
            selected && !open ? selected.primary : placeholder || `Search…`
          }
          value={open ? q : selected ? selected.primary : ""}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && !disabled && (
          <button
            className="mr-3 text-text-muted/70 hover:text-text-main"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQ("");
            }}
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        )}
      </div>
      {description && (
        <p className="text-[11.5px] text-text-muted">{description}</p>
      )}
      {open && !disabled && (
        <>
          <div
            className="fixed inset-0 z-[50] bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute z-[60] top-full mt-1 left-0 right-0 bg-surface border border-border-base rounded-[10px] shadow-lg max-h-60 overflow-y-auto w-full min-w-max">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-text-muted text-center">
                No results found
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`flex flex-col w-full text-left px-3 py-2 hover:bg-primary/10 border-b border-border-base/30 last:border-0 ${i.id === value ? "bg-primary/5" : ""}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(i.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <span className="text-[13.5px] font-medium text-text-main leading-tight">
                    {i.primary}
                  </span>
                  {i.secondary && (
                    <span className="text-[11.5px] text-text-muted mt-0.5 leading-tight">
                      {i.secondary}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function NewPrescriptionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clinicId, userData } = useAuthContext();

  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);
  const [isMultiBranch, setIsMultiBranch] = useState(false);
  const effectiveBranchId =
    userData?.branchId ?? defaultBranchId ?? clinicId ?? null;
  // Only pass branchId for multi-branch clinics; individual clinics use clinic-wide queries
  const branchIdForData = isMultiBranch
    ? (userData?.branchId ?? defaultBranchId ?? undefined)
    : undefined;

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [availablePathologyTests, setAvailablePathologyTests] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");

  // Current Item Entry
  const [medicineId, setMedicineId] = useState("");
  const [dosage, setDosage] = useState("");
  const [duration, setDuration] = useState("");
  const [time, setTime] = useState("");
  const [intervalValue, setIntervalValue] = useState("");

  const [items, setItems] = useState<PrescriptionItem[]>([]);

  // Pathology Tests
  const [selectedPathologyTests, setSelectedPathologyTests] = useState<PathologyTestSelection[]>([]);
  const [pathologyTestId, setPathologyTestId] = useState("");

  const [diagnosis, setDiagnosis] = useState("");
  const [history, setHistory] = useState("");
  const [examination, setExamination] = useState("");
  const [investigation, setInvestigation] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [sendToPharmacy, setSendToPharmacy] = useState(true);
  const [sendToPathology, setSendToPathology] = useState(true);

  // Live Consultation Queue & Triage Auto-Import
  const todayStr = new Date().toDateString();
  const getIsToday = (aptDate: any) => {
    try {
      if (!aptDate) return false;
      let dObj = null;
      if (aptDate.seconds) dObj = new Date(aptDate.seconds * 1000);
      else if (aptDate instanceof Date) dObj = aptDate;
      else if (typeof aptDate === "string") dObj = new Date(aptDate);
      else if (aptDate.toDate) dObj = aptDate.toDate();
      
      return dObj && !isNaN(dObj.getTime()) && dObj.toDateString() === todayStr;
    } catch {
      return false;
    }
  };

  // Resolve logged-in doctor's own ID by matching email (null = admin/non-doctor sees all)
  const loggedInDoctorId = React.useMemo(() => {
    const isAdmin = userData?.role === "clinic-admin" || userData?.role === "system-owner";
    if (isAdmin) return null;
    const matched = doctors.find((d: any) => d.email?.toLowerCase() === userData?.email?.toLowerCase());
    return matched?.id ?? null;
  }, [doctors, userData]);

  const activeQueue = appointments.filter((apt) => {
    if (!getIsToday(apt.appointmentDate)) return false;
    if (apt.status !== "in-progress" && apt.status !== "confirmed") return false;

    // If logged-in user is a doctor, only show their assigned patients
    if (loggedInDoctorId && apt.doctorId !== loggedInDoctorId) return false;

    const hasDoctor = apt.doctorId && apt.doctorId !== "unassigned";
    if (hasDoctor) {
      const hasConsBill = apt.billingId || apt.consultationBillingStatus;
      if (hasConsBill) {
        const isPaid =
          apt.consultationBillingStatus === "paid" ||
          apt.billingStatus === "paid" ||
          apt.paymentStatus === "paid";
        if (!isPaid) return false;
      }
    }
    return true;
  });

  const handleStartConsultation = async (appt: any) => {
    setAppointmentId(appt.id);
    setPatientId(appt.patientId);
    setDoctorId(appt.doctorId);

    // If appointment is confirmed (Lobby/Triage), automatically mark as in-progress (Sent to Cabin)
    if (appt.status === "confirmed") {
      try {
        await appointmentService.updateAppointmentStatus(appt.id, "in-progress");
        addToast({
          title: "Session Started",
          description: "Patient status updated to In Cabin Consultation.",
          color: "success",
        });
      } catch (err) {
        console.error("Error starting consultation status change:", err);
      }
    }

    // Attempt to auto-import triage vitals if available
    try {
      if (!clinicId || !appt.patientId) return;
      const notesList = await PatientNoteEntriesService.getPatientNoteEntries(clinicId, appt.patientId);
      const triageNote = notesList?.find(
        (n: any) => n.sectionKey === "triage-vitals" || n.sectionLabel === "Triage Vitals"
      );

      if (triageNote) {
        const parsed = parseTriageVitals(triageNote.content);
        
        // Populate History with chief complaints
        if (parsed.complaints && parsed.complaints !== "None reported") {
          setHistory((prev) => {
            const prefix = prev ? `${prev}\n` : "";
            return `${prefix}Chief Complaints: ${parsed.complaints}`;
          });
        }

        // Populate Examination with vitals
        const vitalsStr = `Physical Vitals — BP: ${parsed.bp}, Temp: ${parsed.temp}, Pulse: ${parsed.pulse}, Weight: ${parsed.weight}, SpO2: ${parsed.spo2}`;
        setExamination((prev) => {
          const prefix = prev ? `${prev}\n` : "";
          return `${prefix}${vitalsStr}`;
        });

        addToast({
          title: "SOAP Auto-Populated",
          description: "Triage vitals and complaints loaded into SOAP record successfully.",
          color: "success",
        });
      } else {
        addToast({
          title: "SOAP Loaded",
          description: "Consultation opened. No triage vitals found for this patient.",
          color: "primary",
        });
      }
    } catch (e) {
      console.error("Error auto-populating triage notes:", e);
    }
  };

  // Quick Presets
  const frequencyPresets = ["OD", "BD", "TDS", "QID", "SOS"];
  const timePresets = ["Before Meal", "After Meal", "Empty Stomach", "At Bedtime"];

  const handleFrequencyChange = (val: string) => {
    setIntervalValue(val);
    const lower = val.toLowerCase().trim();

    // 1. Standard Latin Abbreviations
    if (lower === "qd" || lower === "q.d.") {
      setIntervalValue("once daily");
    } else if (lower === "bid" || lower === "b.i.d." || lower === "bd") {
      setIntervalValue("twice daily");
    } else if (lower === "tid" || lower === "t.i.d." || lower === "tds") {
      setIntervalValue("three times daily");
    } else if (lower === "qid" || lower === "q.i.d.") {
      setIntervalValue("four times daily");
    } else if (lower === "prn" || lower === "sos") {
      setIntervalValue("as needed (PRN)");
      setTime("when required");
    }

    // 2. Numeric dose shortcodes (e.g. 1-0-1, 1-1-1)
    else if (lower === "1-0-0") {
      setIntervalValue("once daily");
      setTime("morning, after meals");
    } else if (lower === "0-1-0") {
      setIntervalValue("once daily");
      setTime("afternoon, after meals");
    } else if (lower === "0-0-1") {
      setIntervalValue("once daily");
      setTime("night, after meals");
    } else if (lower === "1-0-1") {
      setIntervalValue("twice daily");
      setTime("morning & night, after meals");
    } else if (lower === "1-1-1") {
      setIntervalValue("three times daily");
      setTime("morning, afternoon & night, after meals");
    } else if (lower === "2-0-2") {
      setIntervalValue("twice daily (2 tabs each)");
      setTime("morning & night, after meals");
    }
  };

  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      if (!clinicId || !doctorId) {
        setTemplates([]);
        return;
      }
      try {
        const list = await prescriptionService.getTemplatesByDoctor(clinicId, doctorId);
        setTemplates(list || []);
      } catch (err) {
        console.error("Failed to load templates:", err);
      }
    };
    loadTemplates();
  }, [clinicId, doctorId]);

  const [patientNotes, setPatientNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    const fetchPatientNotes = async () => {
      if (!clinicId || !patientId) {
        setPatientNotes([]);
        return;
      }
      setLoadingNotes(true);
      try {
        const notesList = await PatientNoteEntriesService.getPatientNoteEntries(clinicId, patientId);
        setPatientNotes(notesList || []);
      } catch (err) {
        console.error("Failed to fetch patient note entries:", err);
      } finally {
        setLoadingNotes(false);
      }
    };
    fetchPatientNotes();
  }, [clinicId, patientId]);

  const parseTriageVitals = (content: string) => {
    const result = {
      bp: "Not recorded",
      temp: "Not recorded",
      pulse: "Not recorded",
      weight: "Not recorded",
      spo2: "Not recorded",
      complaints: "None reported"
    };

    if (!content) return result;

    try {
      const parts = content.split("\n");
      const vitalsLine = parts[0] || "";
      const complaintsLine = parts[1] || "";

      if (complaintsLine.includes("Chief Complaints:")) {
        result.complaints = complaintsLine.replace("Chief Complaints:", "").trim();
      }

      const vitalsParts = vitalsLine.split("|");
      vitalsParts.forEach(part => {
        const [label, val] = part.split(":");
        if (label && val) {
          const cleanLabel = label.trim().toLowerCase();
          const cleanVal = val.trim();
          if (cleanLabel === "bp") result.bp = cleanVal;
          if (cleanLabel === "temp") result.temp = cleanVal;
          if (cleanLabel === "pulse") result.pulse = cleanVal;
          if (cleanLabel === "weight") result.weight = cleanVal;
          if (cleanLabel === "spo2") result.spo2 = cleanVal;
        }
      });
    } catch (e) {
      console.error("Error parsing vitals content:", e);
    }

    return result;
  };

  // Find the most recent logged triage vitals note
  const todayVitalsNote = patientNotes.find(
    (n) => n.sectionKey === "triage-vitals" || n.sectionLabel === "Triage Vitals"
  );

  const handleImportTriage = () => {
    if (!todayVitalsNote) return;

    const parsed = parseTriageVitals(todayVitalsNote.content);
    
    // 1. Append complaints to History if present
    if (parsed.complaints && parsed.complaints !== "None reported") {
      setHistory((prev) => {
        const prefix = prev ? `${prev}\n` : "";
        return `${prefix}Chief Complaints: ${parsed.complaints}`;
      });
    }

    // 2. Append formatted vitals to Examination
    const vitalsStr = `Physical Vitals — BP: ${parsed.bp}, Temp: ${parsed.temp}, Pulse: ${parsed.pulse}, Weight: ${parsed.weight}, SpO2: ${parsed.spo2}`;
    setExamination((prev) => {
      const prefix = prev ? `${prev}\n` : "";
      return `${prefix}${vitalsStr}`;
    });

    addToast({
      title: "Vitals & Complaints Imported",
      description: "Successfully imported triage records into clinical SOAP record.",
      color: "success",
    });
  };

  const handleSaveTemplate = async () => {
    if (!clinicId || !doctorId) {
      addToast({
        title: "Error",
        description: "Please select both doctor and patient to save templates.",
        color: "warning",
      });
      return;
    }
    if (!templateName.trim()) {
      addToast({
        title: "Error",
        description: "Please enter a template name.",
        color: "warning",
      });
      return;
    }
    if (items.length === 0) {
      addToast({
        title: "Error",
        description: "Please add at least one medicine to save as a template.",
        color: "warning",
      });
      return;
    }

    setIsSavingTemplate(true);
    try {
      const templateData = {
        name: templateName.trim(),
        clinicId,
        doctorId,
        diagnosis,
        treatmentPlan,
        items: items.map((it) => ({
          medicineId: it.medicineId,
          medicineName: it.medicineName,
          dosage: it.dosage,
          frequency: it.interval,
          duration: it.duration,
          time: it.time,
        })),
      };

      await prescriptionService.createTemplate(templateData);

      addToast({
        title: "Success",
        description: `Template "${templateName}" saved successfully.`,
        color: "success",
      });

      setTemplateName("");
      const list = await prescriptionService.getTemplatesByDoctor(clinicId, doctorId);
      setTemplates(list || []);
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to save prescription template.",
        color: "danger",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    const selectedTpl = templates.find((t) => t.id === templateId);
    if (!selectedTpl) return;

    const mappedItems = selectedTpl.items.map((it: any) => ({
      id: crypto.randomUUID(),
      medicineId: it.medicineId,
      medicineName: it.medicineName,
      dosage: it.dosage,
      duration: it.duration,
      time: it.time,
      interval: it.frequency,
    }));

    setItems(mappedItems);

    if (selectedTpl.diagnosis) setDiagnosis(selectedTpl.diagnosis);
    if (selectedTpl.treatmentPlan) setTreatmentPlan(selectedTpl.treatmentPlan);

    addToast({
      title: "Success",
      description: `Template "${selectedTpl.name}" applied!`,
      color: "success",
    });
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await prescriptionService.deleteTemplate(templateId);
      addToast({
        title: "Success",
        description: "Template deleted successfully.",
        color: "success",
      });
      const list = await prescriptionService.getTemplatesByDoctor(clinicId, doctorId);
      setTemplates(list || []);
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to delete template.",
        color: "danger",
      });
    }
  };

  // Resolve default branch (branch user, then main branch when multi-branch, else clinicId)
  useEffect(() => {
    if (!clinicId) return;
    if (userData?.branchId) {
      setIsMultiBranch(true);
      setDefaultBranchId(userData.branchId);

      return;
    }
    branchService
      .isMultiBranchEnabled(clinicId)
      .then((multi) => {
        setIsMultiBranch(multi);
        if (multi) {
          return branchService
            .getMainBranch(clinicId)
            .then((b) => setDefaultBranchId(b?.id ?? clinicId));
        }
        setDefaultBranchId(clinicId);
      })
      .catch(() => setDefaultBranchId(clinicId));
  }, [clinicId, userData?.branchId]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([
      patientService.getPatientsByClinic(clinicId, branchIdForData),
      doctorService.getDoctorsByClinic(clinicId, branchIdForData),
      medicineService.getMedicinesByClinic(clinicId),
      pathologyService.getCategoriesByClinic(clinicId, branchIdForData),
      pathologyService.getTestTypesByClinic(clinicId, branchIdForData),
      appointmentService.getAppointmentsByClinic(clinicId, branchIdForData),
    ])
      .then(([patientsData, doctorsData, medicinesData, pathologyData, testTypesData, appointmentsData]) => {
        setPatients(patientsData);
        setDoctors(doctorsData);
        setMedicines(medicinesData);
        
        // Map prices to pathology tests
        const testsWithPrices = pathologyData.map((cat: any) => {
          const matchingPrice = testTypesData.find((tt: any) => tt.targetId === cat.id);
          return {
            ...cat,
            price: matchingPrice ? matchingPrice.price : 0
          };
        });
        setAvailablePathologyTests(testsWithPrices);
        const relevantAppointments = (appointmentsData as any[]).filter(
          (apt: any) =>
            apt.status === "completed" ||
            apt.status === "in-progress" ||
            apt.status === "confirmed",
        );

        setAppointments(relevantAppointments);

        const appointmentIdFromUrl = searchParams.get("appointmentId");

        if (appointmentIdFromUrl) {
          const matchedApt = (appointmentsData as any[]).find(
            (a: any) => a.id === appointmentIdFromUrl,
          );

          if (matchedApt) {
            setAppointmentId(appointmentIdFromUrl);
            setPatientId(matchedApt.patientId);
            setDoctorId(matchedApt.doctorId);
          }
        }
      })
      .catch((err) => {
        console.error("Error loading data:", err);
        addToast({
          title: "Error",
          description: "Failed to load required data. Please refresh.",
          color: "danger",
        });
      })
      .finally(() => setLoading(false));
  }, [clinicId, branchIdForData, searchParams]);

  useEffect(() => {
    if (appointmentId) {
      const selected = appointments.find((a) => a.id === appointmentId);

      if (selected) {
        setPatientId(selected.patientId);
        setDoctorId(selected.doctorId);
      }
    } else {
      const paramAptId = searchParams.get("appointmentId");

      if (!paramAptId) {
        setPatientId("");
        setDoctorId("");
      }
    }
  }, [appointmentId, appointments, searchParams]);

  const getFormattedDate = (aptDate: any) => {
    try {
      if (!aptDate) return "Unknown Date";
      let dObj = null;

      if (aptDate.seconds) dObj = new Date(aptDate.seconds * 1000);
      else if (aptDate instanceof Date) dObj = aptDate;
      else if (typeof aptDate === "string") dObj = new Date(aptDate);
      else if (aptDate.toDate) dObj = aptDate.toDate();

      if (dObj && !isNaN(dObj.getTime())) {
        return `${dObj.getFullYear()}/${String(dObj.getMonth() + 1).padStart(2, "0")}/${String(dObj.getDate()).padStart(2, "0")}`;
      }
    } catch (e) { }

    return "Invalid Date";
  };

  const addItem = () => {
    if (!medicineId) {
      addToast({
        title: "Error",
        description: "Please select a medicine.",
        color: "warning",
      });

      return;
    }
    if (items.some((i) => i.medicineId === medicineId)) {
      addToast({
        title: "Error",
        description: "Medicine already added.",
        color: "warning",
      });

      return;
    }
    const med = medicines.find((m) => m.id === medicineId);

    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        medicineId,
        medicineName: med?.name || "Unknown",
        dosage,
        duration,
        time,
        interval: intervalValue,
      },
    ]);

    setMedicineId("");
    setDosage("");
    setDuration("");
    setTime("");
    setIntervalValue("");

    addToast({
      title: "Success",
      description: "Medicine added to prescription.",
      color: "success",
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addPathologyTest = () => {
    if (!pathologyTestId) {
      addToast({ title: "Error", description: "Please select a pathology test.", color: "warning" });
      return;
    }
    if (selectedPathologyTests.some((t) => t.testId === pathologyTestId)) {
      addToast({ title: "Error", description: "Test already added.", color: "warning" });
      return;
    }
    const test = availablePathologyTests.find((t) => t.id === pathologyTestId);
    if (!test) return;

    setSelectedPathologyTests((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        testId: test.id,
        testName: test.name,
        price: test.price || 0,
      }
    ]);
    setPathologyTestId("");
    addToast({ title: "Success", description: "Pathology test added.", color: "success" });
  };

  const removePathologyTest = (id: string) => {
    setSelectedPathologyTests((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCompleteNoPrescription = async () => {
    if (!appointmentId) return;
    setSaving(true);
    try {
      const currentUser = userData?.id || "unknown-user";
      let billingId: string | undefined = undefined;
      let isDualRoute = false;

      try {
        const apt = appointments.find((a) => a.id === appointmentId);
        if (apt) {
          const pat = patients.find((p) => p.id === patientId);
          const docInfo = doctors.find((d) => d.id === doctorId);
          const hasDoctor = apt.doctorId && apt.doctorId !== "unassigned";
          const hasExpert = apt.assignedExpertId && apt.assignedExpertId !== "unassigned";
          if (hasDoctor && hasExpert && !apt.doctorConsultationCompleted) {
            isDualRoute = true;
          }

          let price = 500; // sensible GP fallback price in NPR
          let appointmentTypeName = "General Consultation";

          if (apt.appointmentTypeId) {
            const apptType = await appointmentTypeService.getAppointmentTypeById(apt.appointmentTypeId);
            if (apptType) {
              price = Number(apptType.price) || 500;
              appointmentTypeName = apptType.name || "General Consultation";
            }
          }

          // Resolve all referrers (polymorphic and multiple)
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
            appointmentTypeId: apt.appointmentTypeId || "manual-gp-fee",
            appointmentTypeName: appointmentTypeName,
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
            branchId: effectiveBranchId ?? clinicId!,
            patientId: patientId,
            patientName: pat?.name || "Unknown Patient",
            doctorId: doctorId,
            doctorName: docInfo?.name || "Unknown Doctor",
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
            createdBy: currentUser,
          };

          billingId = await appointmentBillingService.createBilling(billingData);

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
                currentUser
              );
            } catch (docCommErr) {
              console.error("Error creating consulting doctor commission:", docCommErr);
            }
          }

          // 1.5) Log Assigned Expert Commission
          const expertId = apt.assignedExpertId || pat?.assignedExpertId;
          if (expertId) {
            try {
              const expertInfo = await expertService.getExpertById(expertId);
              if (expertInfo && expertInfo.defaultCommission && expertInfo.defaultCommission > 0) {
                await expertCommissionService.createCommission(
                  expertInfo.id,
                  expertInfo.name,
                  {
                    id: billingId,
                    ...billingData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    } as any,
                    expertInfo.defaultCommission,
                    currentUser
                );
              }
            } catch (expCommErr) {
              console.error("Error creating assigned expert commission:", expCommErr);
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
                  currentUser
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
                  currentUser
                );
              } else if (r.type === "expert") {
                await expertCommissionService.createCommission(
                  r.id,
                  r.name,
                  billingRecord,
                  r.commissionPercentage,
                  currentUser
                );
              } else if (r.type === "staff") {
                await staffCommissionService.createRegistrationCommission(
                  r.id,
                  r.name,
                  billingRecord.clinicId,
                  billingRecord.branchId,
                  billingRecord.patientId,
                  billingRecord.patientName,
                  appointmentTypeName,
                  price,
                  r.commissionAmount,
                  r.commissionPercentage,
                  currentUser
                );
              }
            } catch (commErr) {
              console.error(`Error logging polymorphic commission for ${r.name} (${r.type}):`, commErr);
            }
          }
        }
      } catch (billingErr) {
        console.error("Error auto-generating billing draft for appointment type:", billingErr);
      }

      // Mark appointment as completed (or route to expert)
      await appointmentService.updateAppointment(appointmentId, {
        status: isDualRoute ? "in-progress" : "completed",
        ...(isDualRoute ? { doctorConsultationCompleted: true } : {}),
        billingId: billingId || null,
        billingStatus: billingId ? "unpaid" : "paid",
        paymentStatus: billingId ? "unpaid" : "paid",
        updatedAt: new Date(),
      } as any);

      addToast({
        title: isDualRoute ? "Consultation Handed Over" : "Consultation Completed",
        description: isDualRoute 
          ? "Doctor consultation completed. Patient routed to Expert Cabin."
          : "Patient consultation completed. Appointment type fee invoice created successfully.",
        color: "success",
      });
      navigate("/dashboard/prescriptions");
    } catch (err) {
      console.error("Error completing consultation:", err);
      addToast({
        title: "Error",
        description: "Failed to complete consultation.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!patientId || !doctorId) {
      addToast({
        title: "Error",
        description: "Please select both patient and doctor.",
        color: "warning",
      });

      return;
    }
    if (items.length === 0 && selectedPathologyTests.length === 0) {
      addToast({
        title: "Error",
        description: "Please add at least one medicine or pathology test.",
        color: "warning",
      });

      return;
    }

    setSaving(true);
    try {
      const currentUser = userData?.id || "unknown-user";
      let isDualRoute = false;
      const prescriptionItems = items.map((item) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        dosage: item.dosage,
        frequency: item.interval,
        duration: item.duration,
        time: item.time,
        instructions:
          notes ||
          `Take ${item.dosage} ${item.interval} ${item.time} for ${item.duration}`,
        quantity: 1,
        sendToPharmacy,
      }));

      const prescriptionData = {
        patientId,
        clinicId: clinicId!,
        branchId: effectiveBranchId ?? clinicId!,
        appointmentId: appointmentId ? appointmentId : undefined,
        doctorId,
        items: prescriptionItems,
        pathologyTests: selectedPathologyTests,
        diagnosis,
        notes,
        history,
        examination,
        investigation,
        treatmentPlan,
        prescribedBy: currentUser,
        sendToPharmacy,
        sendToPathology,
      };

      const newPrescriptionId = await prescriptionService.createPrescription(prescriptionData);

      // =================== PATHOLOGY AUTO-BILLING DRAFT ===================
      if (sendToPathology && selectedPathologyTests.length > 0) {
        try {
          const pat = patients.find((p) => p.id === patientId);
          const docInfo = doctors.find((d) => d.id === doctorId);

          const pathologyInvoiceNo = await pathologyBillingService.generateInvoiceNumber(clinicId!);

          const subtotal = selectedPathologyTests.reduce((sum, t) => sum + t.price, 0);

          const draftPathologyBilling = {
            invoiceNumber: pathologyInvoiceNo,
            clinicId: clinicId!,
            branchId: effectiveBranchId ?? clinicId!,
            patientId,
            patientName: pat?.name || "Unknown Patient",
            patientPhone: pat?.mobile || "",
            patientGender: pat?.gender || "",
            doctorId,
            doctorName: docInfo?.name || "Unknown Doctor",
            doctorType: (docInfo?.doctorType || "regular") as "regular" | "visitor",
            invoiceDate: new Date(),
            items: selectedPathologyTests.map((t) => ({
              id: crypto.randomUUID(),
              testId: t.testId,
              testName: t.testName,
              price: t.price,
              quantity: 1,
              amount: t.price,
            })),
            subtotal,
            itemDiscountAmount: 0,
            mainDiscountAmount: 0,
            discountType: "percent" as const,
            discountValue: 0,
            discountAmount: 0,
            taxPercentage: 0,
            taxAmount: 0,
            totalAmount: subtotal,
            status: "draft" as const,
            paymentStatus: "unpaid" as const,
            paidAmount: 0,
            balanceAmount: subtotal,
            createdBy: currentUser,
            notes: "Prescribed via Clinical Consultation",
          };

          await pathologyBillingService.createBilling(draftPathologyBilling as any);
        } catch (pathErr) {
          console.error("Error auto-generating pathology billing draft:", pathErr);
        }
      }

      // =================== PHASE 4: AUTOMATED SMART BILLING & COMMISSION LOGGING ===================
      if (appointmentId) {
        try {
          const apt = appointments.find((a) => a.id === appointmentId);
          const hasDoctor = apt?.doctorId && apt.doctorId !== "unassigned";
          const hasExpert = apt?.assignedExpertId && apt.assignedExpertId !== "unassigned";
          if (hasDoctor && hasExpert && !apt?.doctorConsultationCompleted) {
            isDualRoute = true;
          }
          await appointmentService.updateAppointment(appointmentId, {
            status: isDualRoute ? "in-progress" : "completed",
            ...(isDualRoute ? { doctorConsultationCompleted: true } : {}),
            updatedAt: new Date(),
          } as any);
        } catch (apptErr) {
          console.error("Error updating appointment status on prescription save:", apptErr);
        }
      }
      if (appointmentId) {
        try {
          const apt = appointments.find((a) => a.id === appointmentId);
          if (apt) {
            const pat = patients.find((p) => p.id === patientId);
            const docInfo = doctors.find((d) => d.id === doctorId);

            let price = 500; // sensible GP fallback price in NPR
            let appointmentTypeName = "General Consultation";

            if (apt.appointmentTypeId) {
              const apptType = await appointmentTypeService.getAppointmentTypeById(apt.appointmentTypeId);
              if (apptType) {
                price = Number(apptType.price) || 500;
                appointmentTypeName = apptType.name || "General Consultation";
              }
            }

            // Resolve all referrers (polymorphic and multiple)
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
              appointmentTypeId: apt.appointmentTypeId || "manual-gp-fee",
              appointmentTypeName: appointmentTypeName,
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
              branchId: effectiveBranchId ?? clinicId!,
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
              createdBy: currentUser,
            };

            const billingId = await appointmentBillingService.createBilling(billingData);

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
                  currentUser
                );
              } catch (docCommErr) {
                console.error("Error creating consulting doctor commission:", docCommErr);
              }
            }

            // 1.5) Log Assigned Expert Commission
            const expertId = apt.assignedExpertId || pat?.assignedExpertId;
            if (expertId) {
              try {
                const expertInfo = await expertService.getExpertById(expertId);
                if (expertInfo && expertInfo.defaultCommission && expertInfo.defaultCommission > 0) {
                  await expertCommissionService.createCommission(
                    expertInfo.id,
                    expertInfo.name,
                    {
                      id: billingId,
                      ...billingData,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    } as any,
                    expertInfo.defaultCommission,
                    currentUser
                  );
                  console.log(`Successfully logged Assigned Expert commission record for ${expertInfo.name}`);
                }
              } catch (expCommErr) {
                console.error("Error creating assigned expert commission:", expCommErr);
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
                  // External Referral Partner
                  await referralCommissionService.createReferralCommission(
                    billingRecord,
                    {
                      id: r.id,
                      name: r.name,
                      defaultCommission: r.commissionPercentage,
                    } as any,
                    r.commissionAmount,
                    currentUser
                  );
                  console.log(`Polymorphic: Logged partner commission record successfully for ${r.name}`);
                } else if (r.type === "doctor") {
                  // Internal Referring Doctor (different from the consulting doctor)
                  const refBillingRecord = {
                    ...billingRecord,
                    doctorId: r.id,
                    doctorName: r.name,
                  };
                  await doctorCommissionService.createCommission(
                    refBillingRecord,
                    r.commissionPercentage,
                    currentUser
                  );
                  console.log(`Polymorphic: Logged referring doctor commission record successfully for Dr. ${r.name}`);
                } else if (r.type === "expert") {
                  // External Expert
                  await expertCommissionService.createCommission(
                    r.id,
                    r.name,
                    billingRecord,
                    r.commissionPercentage,
                    currentUser
                  );
                  console.log(`Polymorphic: Logged expert commission record successfully for ${r.name}`);
                } else if (r.type === "staff") {
                  // Internal Staff Member
                  await staffCommissionService.createRegistrationCommission(
                    r.id,
                    r.name,
                    billingRecord.clinicId,
                    billingRecord.branchId,
                    billingRecord.patientId,
                    billingRecord.patientName,
                    appointmentTypeName,
                    price,
                    r.commissionAmount,
                    r.commissionPercentage,
                    currentUser
                  );
                  console.log(`Polymorphic: Logged referring staff commission record successfully for ${r.name}`);
                }
              } catch (commErr) {
                console.error(`Error logging polymorphic commission for ${r.name} (${r.type}):`, commErr);
              }
            }

            // Move appointment status to completed (or route to expert) so patient is waiting for payment checkout in billing queue
            await appointmentService.updateAppointment(appointmentId, {
              status: isDualRoute ? "in-progress" : "completed",
              ...(isDualRoute ? { doctorConsultationCompleted: true } : {}),
              billingId: billingId,
              updatedAt: new Date(),
            } as any);

            console.log("Phase 4: Smart billing draft created successfully.", billingId);
          }
        } catch (billingErr) {
          console.error("Phase 4: Error auto-generating billing draft:", billingErr);
        }
      }

      addToast({
        title: "Success",
        description: appointmentId
          ? (isDualRoute ? "Prescription saved. Patient routed to Expert Cabin." : "Prescription saved and appointment completed successfully.")
          : "Prescription saved successfully.",
        color: "success",
      });
      navigate(`/dashboard/prescriptions/${newPrescriptionId}`);
    } catch (error) {
      console.error("Error saving prescription:", error);
      addToast({
        title: "Error",
        description: "Failed to save prescription.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-2">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            startContent={<IoArrowBackOutline />}
            variant="bordered"
            onClick={() => navigate("/dashboard/prescriptions")}
          >
            Back
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>New Prescription</h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              Create a new prescription for your patient
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Doctor's Live Patient Queue Desk */}
        <div className="bg-surface border border-border-base rounded-[12px] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border-base bg-gradient-to-r from-indigo-500/10 via-primary/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                <IoPulseOutline className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-[15px] text-text-main leading-tight">
                  👨‍⚕️ Doctor's Live Consultation Waitlist
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Patients currently waiting in lobby or active in cabin for today.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-500/20 w-fit">
              {activeQueue.length} patient(s) waiting
            </span>
          </div>

          <div className="p-5">
            {activeQueue.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 mb-3 border border-green-500/20">
                  <IoSparklesOutline className="w-6 h-6 animate-bounce" />
                </div>
                <p className="text-[14px] font-bold text-text-main">🎉 Your Queue is Clear!</p>
                <p className="text-xs text-text-muted mt-1 max-w-sm">
                  There are no checked-in patients waiting in the lobby or active in any consulting cabins right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto pr-2.5">
                {activeQueue.map((appt) => {
                  const pat = patients.find((p) => p.id === appt.patientId);
                  const doc = doctors.find((d) => d.id === appt.doctorId);
                  const timeStr = appt.startTime ? `${appt.startTime}` : "No time";

                  // Format 12hr time
                  let formattedTime = timeStr;
                  try {
                    const [hours, minutes] = timeStr.split(":");
                    const hr = parseInt(hours, 10);
                    const ampm = hr >= 12 ? "PM" : "AM";
                    const hr12 = hr % 12 || 12;
                    formattedTime = `${hr12}:${minutes} ${ampm}`;
                  } catch {}

                  const isActiveSession = appointmentId === appt.id;

                  return (
                    <div
                      key={appt.id}
                      className={`p-4 rounded-[12px] border transition-all flex flex-col justify-between gap-3.5 shadow-sm relative ${
                        isActiveSession
                          ? "border-primary bg-primary/[0.03] ring-1 ring-primary/30"
                          : "border-border-base hover:border-indigo-500/40 bg-surface hover:shadow-md"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13.5px] font-bold text-text-main">
                              {pat?.name || "Unknown Patient"}
                            </span>
                            <span className="text-[10px] font-medium text-text-muted">
                              ({pat?.age || "N/A"} / {pat?.gender || "N/A"})
                            </span>
                          </div>
                          <span className="text-[11px] text-text-muted block mt-0.5">
                            Appt Time: <strong className="text-text-main">{formattedTime}</strong>
                          </span>
                        </div>
                        {appt.status === "in-progress" ? (
                          <span className="text-[9.5px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /> In Cabin
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                            Waiting
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-border-base/50 pt-3 mt-1 gap-2">
                        <div className="flex items-center gap-1.5">
                          {appt.notes?.includes("[Triage Vitals Recorded]") ? (
                            <span className="text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full border border-teal-500/20 flex items-center gap-1">
                              🩺 Vitals Recorded
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-surface-3 text-text-muted px-2 py-0.5 rounded-full border border-border-base">
                              No Vitals
                            </span>
                          )}
                        </div>

                        {isActiveSession ? (
                          <span className="text-[11px] font-semibold text-primary flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-[6px]">
                            ⚡ Active Session
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="px-3 py-1.5 text-[11px] font-bold bg-primary text-white hover:bg-primary/95 rounded-[8px] flex items-center gap-1 shadow-sm transition-all"
                            onClick={() => handleStartConsultation(appt)}
                          >
                            <IoSparklesOutline className="w-3.5 h-3.5" />
                            Start Consultation
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* General Information */}
        <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
          <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
            <h4 className="font-semibold text-[15px] text-text-main leading-none">
              General Information
            </h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-[60]">
              <SearchSelect
                items={appointments.map((a) => {
                  const p = patients.find((p) => p.id === a.patientId);
                  const d = doctors.find((d) => d.id === a.doctorId);
                  const dateStr = getFormattedDate(a.appointmentDate);

                  return {
                    id: a.id,
                    primary: `${p?.name || "Unknown"} - ${dateStr}`,
                    secondary: `Dr. ${d?.name || "Unknown"}`,
                  };
                })}
                label="Related Appointment"
                placeholder="Search appointment..."
                value={appointmentId}
                onChange={(id) => setAppointmentId(id)}
              />
              <SearchSelect
                required
                description={
                  appointmentId ? "Auto-filled from appointment" : ""
                }
                disabled={!!appointmentId}
                items={patients.map((p) => ({
                  id: p.id,
                  primary: p.name,
                  secondary: `Reg: ${p.regNumber}`,
                }))}
                label="Patient"
                placeholder="Search patient..."
                value={patientId}
                onChange={(id) => setPatientId(id)}
              />
              <SearchSelect
                required
                description={
                  appointmentId ? "Auto-filled from appointment" : ""
                }
                disabled={!!appointmentId}
                items={doctors.map((d) => ({
                  id: d.id,
                  primary: d.name,
                  secondary: d.speciality,
                }))}
                label="Doctor"
                placeholder="Search doctor..."
                value={doctorId}
                onChange={(id) => setDoctorId(id)}
              />
            </div>

            {/* Template Quick Selection */}
            {doctorId && templates.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border-base/40 flex flex-col gap-1.5 max-w-md relative z-[55]">
                <label className="text-[13px] font-semibold text-text-main flex items-center gap-1.5">
                  ⚡ Apply Saved Rx Template
                </label>
                <div className="flex items-center border border-border-base rounded-[10px] min-h-[38px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
                  <select
                    className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleApplyTemplate(e.target.value);
                        e.target.value = ""; // Reset
                      }
                    }}
                  >
                    <option value="">-- Click to choose a saved clinical set --</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.items.length} meds)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Latest Patient Notes & Triage Records */}
        {patientId && patientNotes.length > 0 && (
          <div className="bg-surface border border-border-base rounded-[10px] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border-base/50 bg-gradient-to-r from-teal-500/10 to-teal-500/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IoPulseOutline className="w-5 h-5 text-teal-600 animate-pulse" />
                <h4 className="font-bold text-[15px] text-text-main">
                  🏥 Latest Patient Progress Notes & Triage Vitals
                </h4>
              </div>
              <span className="text-[10.5px] font-bold bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full border border-teal-200">
                {patientNotes.length} recorded entry/ies
              </span>
            </div>

            <div className="p-6">
              <p className="text-[12.5px] text-text-muted mb-4 leading-relaxed">
                Nurses or junior clinical staff have documented the following observations for this patient. Click **"Import"** to instantly populate the matching assessment field below without retyping.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-2">
                {patientNotes.slice(0, 6).map((note) => (
                  <div key={note.id} className="p-4 bg-surface rounded-[12px] border border-border-base/60 hover:border-teal-500/30 transition-all flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex justify-between items-center gap-2 pb-2 border-b border-border-base/40 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100">
                          {note.sectionLabel || "Note"}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          {note.createdAt instanceof Date ? note.createdAt.toLocaleDateString() : "Just now"}
                        </span>
                      </div>
                      <p className="text-[13px] text-text-main line-clamp-4 italic">
                        "{note.content}"
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border-base/40">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9.5px] font-bold text-text-muted mr-1">IMPORT INTO:</span>
                        <button
                          type="button"
                          className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-[6px] hover:bg-primary hover:text-white transition-all"
                          onClick={() => {
                            setHistory((prev) => prev ? `${prev}\n${note.content}` : note.content);
                            addToast({ title: "Imported into History", color: "success" });
                          }}
                        >
                          History
                        </button>
                        <button
                          type="button"
                          className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-[6px] hover:bg-primary hover:text-white transition-all"
                          onClick={() => {
                            setExamination((prev) => prev ? `${prev}\n${note.content}` : note.content);
                            addToast({ title: "Imported into Examination", color: "success" });
                          }}
                        >
                          Examination
                        </button>
                        <button
                          type="button"
                          className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-[6px] hover:bg-primary hover:text-white transition-all"
                          onClick={() => {
                            setDiagnosis((prev) => prev ? `${prev}\n${note.content}` : note.content);
                            addToast({ title: "Imported into Diagnosis", color: "success" });
                          }}
                        >
                          Diagnosis
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Clinical Assessment Dossier (SOAP) */}
        <div className="bg-surface border border-border-base rounded-[10px] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border-base/50 bg-gradient-to-r from-primary/10 to-primary/5 flex items-center gap-2">
            <IoDocumentTextOutline className="w-5 h-5 text-primary" />
            <h4 className="font-bold text-[15.5px] text-text-main">
              Clinical Assessment & Case Record
            </h4>
          </div>

          <div className="p-6 space-y-6">
            {/* Today's Triage Vitals loaded card */}
            {todayVitalsNote && (() => {
              const parsed = parseTriageVitals(todayVitalsNote.content);
              return (
                <div className="p-4 bg-gradient-to-r from-teal-500/10 to-teal-500/5 border border-teal-500/30 rounded-[12px] shadow-sm animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-teal-500/15">
                    <div className="flex items-center gap-2">
                      <IoPulseOutline className="w-5 h-5 text-teal-600 animate-pulse" />
                      <div>
                        <h5 className="text-[13.5px] font-bold text-teal-950 dark:text-teal-200 leading-none">
                          🩺 Today's Lobby Triage Vitals Active
                        </h5>
                        <p className="text-[11px] text-teal-800 dark:text-teal-300 mt-1">
                          Recorded today by Front Office Desk
                        </p>
                      </div>
                    </div>
                    <button
                      className="px-3 py-1.5 text-[11.5px] font-bold bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 rounded-[8px] flex items-center gap-1.5 shadow-sm transition-all outline-none"
                      type="button"
                      onClick={handleImportTriage}
                    >
                      <IoSparklesOutline className="w-3.5 h-3.5" />
                      Auto-Import Vitals to SOAP
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                    {/* BP */}
                    <div className="p-2.5 bg-surface rounded-[8px] border border-teal-500/10 flex items-center gap-2">
                      <IoHeartOutline className="text-red-500 w-4 h-4 shrink-0" />
                      <div>
                        <span className="block text-[9.5px] text-text-muted font-semibold uppercase">BP</span>
                        <span className="text-[12.5px] font-bold text-text-main leading-tight">{parsed.bp}</span>
                      </div>
                    </div>
                    {/* Temp */}
                    <div className="p-2.5 bg-surface rounded-[8px] border border-teal-500/10 flex items-center gap-2">
                      <IoThermometerOutline className="text-saffron-500 w-4 h-4 shrink-0" />
                      <div>
                        <span className="block text-[9.5px] text-text-muted font-semibold uppercase">Temp</span>
                        <span className="text-[12.5px] font-bold text-text-main leading-tight">{parsed.temp}</span>
                      </div>
                    </div>
                    {/* Pulse */}
                    <div className="p-2.5 bg-surface rounded-[8px] border border-teal-500/10 flex items-center gap-2">
                      <IoPulseOutline className="text-teal-500 w-4 h-4 shrink-0" />
                      <div>
                        <span className="block text-[9.5px] text-text-muted font-semibold uppercase">Pulse</span>
                        <span className="text-[12.5px] font-bold text-text-main leading-tight">{parsed.pulse}</span>
                      </div>
                    </div>
                    {/* Weight */}
                    <div className="p-2.5 bg-surface rounded-[8px] border border-teal-500/10 flex items-center gap-2">
                      <IoBodyOutline className="text-sky-500 w-4 h-4 shrink-0" />
                      <div>
                        <span className="block text-[9.5px] text-text-muted font-semibold uppercase">Weight</span>
                        <span className="text-[12.5px] font-bold text-text-main leading-tight">{parsed.weight}</span>
                      </div>
                    </div>
                    {/* SpO2 */}
                    <div className="p-2.5 bg-surface rounded-[8px] border border-teal-500/10 flex items-center gap-2 col-span-2 sm:col-span-1">
                      <IoSpeedometerOutline className="text-indigo-500 w-4 h-4 shrink-0" />
                      <div>
                        <span className="block text-[9.5px] text-text-muted font-semibold uppercase">SpO2</span>
                        <span className="text-[12.5px] font-bold text-text-main leading-tight">{parsed.spo2}</span>
                      </div>
                    </div>
                  </div>

                  {parsed.complaints && parsed.complaints !== "None reported" && (
                    <div className="mt-3 p-2.5 bg-surface/50 rounded-[8px] border border-teal-500/10">
                      <span className="block text-[9.5px] text-text-muted font-semibold uppercase mb-1">Chief Complaints</span>
                      <p className="text-[12.5px] text-text-main font-medium italic">
                        "{parsed.complaints}"
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 1. History */}
            <div className="flex flex-col gap-2 p-4 bg-surface rounded-[12px] border border-border-base hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-border-base/50">
                <IoDocumentTextOutline className="text-primary w-4.5 h-4.5" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-text-main">HISTORY</span>
              </div>
              <textarea
                className="w-full text-[13.5px] px-3 py-2 bg-transparent border-0 outline-none text-text-main placeholder:text-text-muted/50 min-h-[70px] resize-y"
                placeholder="Enter patient chief complaints, history of present illness, and past medical history..."
                value={history}
                onChange={(e) => setHistory(e.target.value)}
              />
            </div>

            {/* 2. Examination */}
            <div className="flex flex-col gap-2 p-4 bg-surface rounded-[12px] border border-border-base hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-border-base/50">
                <IoPulseOutline className="text-primary w-4.5 h-4.5" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-text-main">EXAMINATION</span>
              </div>
              <textarea
                className="w-full text-[13.5px] px-3 py-2 bg-transparent border-0 outline-none text-text-main placeholder:text-text-muted/50 min-h-[70px] resize-y"
                placeholder="Enter general physical examination, systemic examination findings, and vitals..."
                value={examination}
                onChange={(e) => setExamination(e.target.value)}
              />
            </div>

            {/* 3. Investigation & Pathology */}
            <div className="flex flex-col gap-5 p-5 bg-surface rounded-[12px] border border-border-base hover:border-primary/40 transition-colors relative z-[45]">
              <div className="flex items-center justify-between pb-2 border-b border-border-base/50">
                <div className="flex items-center gap-2">
                  <IoFlaskOutline className="text-primary w-4.5 h-4.5" />
                  <span className="text-[12px] font-bold uppercase tracking-wider text-text-main">INVESTIGATION & PATHOLOGY</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full relative z-[50]">
                    <SearchSelect
                      label="Search and Assign Pathology Test"
                      items={availablePathologyTests.map((t) => ({
                        id: t.id,
                        primary: t.name,
                        secondary: `NPR ${t.price || 0}`,
                      }))}
                      placeholder="e.g. Complete Blood Count (CBC)..."
                      value={pathologyTestId}
                      onChange={setPathologyTestId}
                    />
                  </div>
                  <Button
                    className="w-full sm:w-[130px] h-[42px] px-6 bg-primary hover:bg-primary-hover text-white shadow-sm font-medium rounded-[8px]"
                    startContent={<IoAddOutline className="w-4 h-4" />}
                    onClick={addPathologyTest}
                  >
                    Add Test
                  </Button>
                </div>

                {selectedPathologyTests.length > 0 ? (
                  <div className="border border-border-base rounded-[10px] overflow-hidden bg-surface mt-2 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead className="bg-surface-2/60 border-b border-border-base">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-text-muted">Test Name</th>
                            <th className="px-4 py-3 font-semibold text-text-muted text-right">Standard Charge</th>
                            <th className="px-4 py-3 w-[60px]"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-base/50">
                          {selectedPathologyTests.map((test) => (
                            <tr key={test.id} className="hover:bg-primary/5 transition-colors group">
                              <td className="px-4 py-3.5 font-medium text-text-main">{test.testName}</td>
                              <td className="px-4 py-3.5 text-text-muted text-right">NPR {test.price}</td>
                              <td className="px-4 py-3.5 text-right">
                                <button
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Remove test"
                                  type="button"
                                  onClick={() => removePathologyTest(test.id)}
                                >
                                  <IoTrashOutline className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="p-3.5 bg-primary/5 border-t border-border-base flex justify-between items-center">
                      <span className="text-[12px] text-primary font-medium px-2">
                        Total Tests: {selectedPathologyTests.length}
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer bg-surface px-3 py-1.5 rounded-[6px] border border-primary/20 hover:border-primary/50 transition-colors shadow-sm">
                        <input
                          checked={sendToPathology}
                          className="w-3.5 h-3.5 rounded border-primary/30 text-primary focus:ring-primary/20 cursor-pointer"
                          type="checkbox"
                          onChange={(e) => setSendToPathology(e.target.checked)}
                        />
                        <span className="text-[12px] font-semibold text-primary">
                          Auto-Send to Pathology (Draft Bill)
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 mt-2 border border-dashed border-border-base rounded-[10px] bg-surface-2/30 text-center">
                    <IoFlaskOutline className="w-8 h-8 text-text-muted/40 mb-2" />
                    <p className="text-[13px] text-text-muted font-medium">
                      No pathology tests assigned.
                    </p>
                    <p className="text-[11px] text-text-muted/70 mt-1">
                      Search and add tests to generate a lab request.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-2">
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-2 block">Clinical Notes</span>
                <textarea
                  className="w-full text-[13.5px] px-3 py-2 bg-transparent border border-border-base rounded-[8px] outline-none text-text-main placeholder:text-text-muted/50 min-h-[70px] resize-y focus:border-primary/50 transition-colors shadow-sm"
                  placeholder="Enter additional laboratory investigations, diagnostic imaging, or free-text notes..."
                  value={investigation}
                  onChange={(e) => setInvestigation(e.target.value)}
                />
              </div>
            </div>

            {/* 4. Diagnosis */}
            <div className="flex flex-col gap-2 p-4 bg-surface rounded-[12px] border border-border-base hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-border-base/50">
                <IoMedicalOutline className="text-primary w-4.5 h-4.5" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-text-main">DIAGNOSIS</span>
              </div>
              <textarea
                className="w-full text-[13.5px] px-3 py-2 bg-transparent border-0 outline-none text-text-main placeholder:text-text-muted/50 min-h-[70px] resize-y"
                placeholder="Enter clinical assessment, differential or final diagnosis..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            {/* 5. Prescription Details (PLAN) */}
            <div className="flex flex-col gap-4 p-5 bg-surface rounded-[12px] border border-border-base hover:border-primary/40 transition-colors relative z-[50]">
              <div className="flex items-center gap-2 pb-2 border-b border-border-base/50">
                <IoClipboardOutline className="text-primary w-4.5 h-4.5" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-text-main">PRESCRIPTION DETAILS (PLAN)</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                <SearchSelect
                  required
                  items={medicines.map((m) => ({
                    id: m.id,
                    primary: m.name,
                    secondary: m.genericName ? `${m.genericName} (${m.manufacturer || 'Unknown'})` : m.manufacturer,
                  }))}
                  label="Medicine"
                  placeholder="Search medicine..."
                  value={medicineId}
                  onChange={(id) => setMedicineId(id)}
                />
                <div className="flex flex-col gap-2">
                  <CustomInput
                    label="Dosage"
                    placeholder="e.g., 500mg, 1 tablet"
                    value={dosage}
                    onChange={(e: any) => setDosage(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1">
                    {["1 tab", "2 tabs", "5ml", "10ml", "1 drop", "2 drops", "Apply thinly"].map((preset) => (
                      <button
                        key={preset}
                        className={`px-2 py-0.5 text-[10px] font-semibold border rounded-[6px] transition-colors ${dosage === preset ? "bg-primary text-white border-primary" : "bg-surface-2 text-text-muted border-border-base hover:border-primary hover:text-primary"}`}
                        type="button"
                        onClick={() => setDosage(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <CustomInput
                    label="Duration"
                    placeholder="e.g., 7 days"
                    value={duration}
                    onChange={(e: any) => setDuration(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1">
                    {["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "Continuous"].map((preset) => (
                      <button
                        key={preset}
                        className={`px-2 py-0.5 text-[10px] font-semibold border rounded-[6px] transition-colors ${duration === preset ? "bg-primary text-white border-primary" : "bg-surface-2 text-text-muted border-border-base hover:border-primary hover:text-primary"}`}
                        type="button"
                        onClick={() => setDuration(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <CustomInput
                    label="Frequency"
                    placeholder="e.g., 1-0-1, BD, once daily"
                    value={intervalValue}
                    onChange={(e: any) => handleFrequencyChange(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1">
                    {frequencyPresets.map((preset) => (
                      <button
                        key={preset}
                        className={`px-2 py-0.5 text-[10px] font-semibold border rounded-[6px] transition-colors ${intervalValue === preset ? "bg-primary text-white border-primary" : "bg-surface-2 text-text-muted border-border-base hover:border-primary hover:text-primary"}`}
                        type="button"
                        onClick={() => handleFrequencyChange(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <CustomInput
                    label="Time"
                    placeholder="e.g., morning, after meals"
                    value={time}
                    onChange={(e: any) => setTime(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1">
                    {timePresets.map((preset) => (
                      <button
                        key={preset}
                        className={`px-2 py-0.5 text-[10px] font-semibold border rounded-[6px] transition-colors ${time === preset ? "bg-primary text-white border-primary" : "bg-surface-2 text-text-muted border-border-base hover:border-primary hover:text-primary"}`}
                        type="button"
                        onClick={() => setTime(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  className="h-[38px] w-full"
                  color="primary"
                  startContent={<IoAddOutline className="w-4 h-4" />}
                  onClick={addItem}
                >
                  Add to Prescription
                </Button>
              </div>

              {/* Medicines Summary Table (renders inside the Plan container) */}
              {items.length > 0 && (
                <div className="mt-4 border border-border-base rounded-[10px] overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-surface-2 border-b border-border-base">
                    <h5 className="font-semibold text-[13px] text-text-main leading-none">
                      Prescription Summary ({items.length} {items.length === 1 ? "medicine" : "medicines"})
                    </h5>
                  </div>
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-2 border-b border-border-base">
                          <th className="px-4 py-2.5 text-[12px] font-semibold text-text-main w-1/4">Medicine</th>
                          <th className="px-4 py-2.5 text-[12px] font-semibold text-text-main w-1/6">Dosage</th>
                          <th className="px-4 py-2.5 text-[12px] font-semibold text-text-main w-1/6">Duration</th>
                          <th className="px-4 py-2.5 text-[12px] font-semibold text-text-main w-1/6">Time</th>
                          <th className="px-4 py-2.5 text-[12px] font-semibold text-text-main w-1/6">Frequency</th>
                          <th className="px-4 py-2.5 text-[12px] font-semibold text-text-main w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-base">
                        {items.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-2/30 transition-colors">
                            <td className="px-4 py-2.5 text-[13px] font-medium text-text-main">{item.medicineName}</td>
                            <td className="px-4 py-2.5 text-[13px] text-text-main">{item.dosage || "-"}</td>
                            <td className="px-4 py-2.5 text-[13px] text-text-main">{item.duration || "-"}</td>
                            <td className="px-4 py-2.5 text-[13px] text-text-main capitalize">{item.time || "-"}</td>
                            <td className="px-4 py-2.5 text-[13px] text-text-main capitalize">{item.interval || "-"}</td>
                            <td className="px-4 py-2.5">
                              <Button
                                isIconOnly
                                color="danger"
                                size="sm"
                                variant="bordered"
                                onClick={() => removeItem(item.id)}
                              >
                                <IoTrashOutline className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Save as Rx Template Section */}
                  <div className="px-4 py-3 border-t border-border-base/50 bg-surface-2/30 flex flex-col sm:flex-row gap-3 items-end justify-between">
                    <div className="flex flex-col gap-1 w-full max-w-xs">
                      <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider">Save these medicines as a template</span>
                      <input
                        className="w-full text-[12.5px] px-3 py-1.5 bg-surface border border-border-base rounded-[8px] outline-none text-text-main placeholder:text-text-muted/60 focus:border-primary"
                        placeholder="e.g. Acute Tonsillitis Pack"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                      />
                    </div>
                    <Button
                      color="secondary"
                      disabled={!templateName.trim() || isSavingTemplate}
                      isLoading={isSavingTemplate}
                      size="sm"
                      onClick={handleSaveTemplate}
                    >
                      Save as Rx Template
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Pharmacy notes & Checkbox */}
            <div className="pt-4 border-t border-border-base/50 space-y-4">
              <CustomInput
                label="Additional Notes and  Instructions"
                placeholder="Add any extra notes or pharmacy-specific instructions..."
                type="textarea"
                value={notes}
                onChange={(e: any) => setNotes(e.target.value)}
              />
              <div className="flex items-center gap-3 bg-primary/5 p-4 rounded-[12px] border border-primary/20">
                <input
                  checked={sendToPharmacy}
                  className="w-4 h-4 accent-primary cursor-pointer"
                  id="sendToPharmacy"
                  type="checkbox"
                  onChange={(e) => setSendToPharmacy(e.target.checked)}
                />
                <label className="flex flex-col cursor-pointer" htmlFor="sendToPharmacy">
                  <span className="text-[13.5px] font-semibold text-primary">Send to Pharmacy</span>
                  <span className="text-[11.5px] text-text-muted">The pharmacy will receive this prescription instantly for fulfillment.</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="bordered"
            onClick={() => navigate("/dashboard/prescriptions")}
          >
            Cancel
          </Button>
          {appointmentId && (
            <Button
              color="success"
              variant="flat"
              disabled={saving}
              onClick={handleCompleteNoPrescription}
            >
              Complete Consultation (No Rx)
            </Button>
          )}
          <Button
            color="primary"
            disabled={items.length === 0 || !patientId || !doctorId || saving}
            isLoading={saving}
            startContent={!saving && <IoSaveOutline className="w-4 h-4" />}
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Save Prescription"}
          </Button>
        </div>
      </div>
    </div>
  );
}
