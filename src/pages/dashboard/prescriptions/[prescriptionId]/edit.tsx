/**
 * Edit Prescription Page — Clinic Clarity without HeroUI
 */
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { prescriptionService } from "@/services/prescriptionService";
import { branchService } from "@/services/branchService";
import { PatientNoteEntriesService } from "@/services/patientNoteEntriesService";

// ── Types ───────────────────────────────────────────────────────────────────
import { Patient, Doctor, Appointment } from "@/types/models";

interface EnrichedAppointment extends Appointment {
  patientName: string;
  doctorName: string;
  appointmentTypeName: string;
}

interface PrescriptionItemForm {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  duration: string;
  time: string;
  interval: string;
}

// ── Custom UI Helpers ────────────────────────────────────────────────────────
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

// ── Main Component ──────────────────────────────────────────────────────────
export default function EditPrescriptionPage() {
  const navigate = useNavigate();
  const { prescriptionId } = useParams<{ prescriptionId: string }>();
  const { clinicId, userData, currentUser } = useAuthContext();
  const effectiveBranchId = userData?.branchId ?? undefined;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<EnrichedAppointment[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [prescriptionBranchId, setPrescriptionBranchId] = useState<
    string | null
  >(null);
  const [isMultiBranch, setIsMultiBranch] = useState(false);

  // Form Fields
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");

  const [medicineId, setMedicineId] = useState("");
  const [dosage, setDosage] = useState("");
  const [duration, setDuration] = useState("");
  const [time, setTime] = useState("");
  const [intervalValue, setIntervalValue] = useState("");

  const [items, setItems] = useState<PrescriptionItemForm[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [history, setHistory] = useState("");
  const [examination, setExamination] = useState("");
  const [investigation, setInvestigation] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [notes, setNotes] = useState("");

  const [isPatientAutoFilled, setIsPatientAutoFilled] = useState(false);
  const [isDoctorAutoFilled, setIsDoctorAutoFilled] = useState(false);

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

  // Detect multi-branch for this clinic
  useEffect(() => {
    if (!clinicId) return;
    // If user is scoped to a branch, we know multi-branch is enabled
    if (userData?.branchId) {
      setIsMultiBranch(true);

      return;
    }
    branchService
      .isMultiBranchEnabled(clinicId)
      .then((multi) => setIsMultiBranch(multi))
      .catch(() => setIsMultiBranch(false));
  }, [clinicId, userData?.branchId]);

  useEffect(() => {
    const loadPrescriptionData = async () => {
      if (!prescriptionId || !clinicId) return;
      try {
        setInitialLoading(true);
        setAccessError(null);
        setPrescriptionBranchId(null);
        const prescriptionData =
          await prescriptionService.getPrescriptionById(prescriptionId);

        if (!prescriptionData) {
          addToast({
            title: "Error",
            description: "Prescription not found",
            color: "danger",
          });
          navigate("/dashboard/prescriptions");

          return;
        }
        if (
          effectiveBranchId != null &&
          prescriptionData.branchId !== effectiveBranchId
        ) {
          setAccessError("You don't have access to this prescription.");
          setInitialLoading(false);

          return;
        }
        setPrescriptionBranchId(prescriptionData.branchId);

        const prescriptionItems =
          await prescriptionService.getPrescriptionItems(prescriptionId);

        setPatientId(prescriptionData.patientId);
        setDoctorId(prescriptionData.doctorId);
        setAppointmentId(prescriptionData.appointmentId || "");
        setDiagnosis(prescriptionData.diagnosis || "");
        setNotes(prescriptionData.notes || "");
        setHistory(prescriptionData.history || "");
        setExamination(prescriptionData.examination || "");
        setInvestigation(prescriptionData.investigation || "");
        setTreatmentPlan(prescriptionData.treatmentPlan || "");

        const formItems: PrescriptionItemForm[] = prescriptionItems.map(
          (item) => ({
            id: item.id,
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            dosage: item.dosage,
            duration: item.duration,
            time: item.time,
            interval: item.frequency,
          }),
        );

        setItems(formItems);
      } catch (error) {
        addToast({
          title: "Error",
          description: "Failed to load prescription data",
          color: "danger",
        });
      } finally {
        setInitialLoading(false);
      }
    };

    loadPrescriptionData();
  }, [prescriptionId, clinicId, navigate, effectiveBranchId]);

  useEffect(() => {
    const loadData = async () => {
      if (!clinicId) return;
      // For multi-branch clinics we need the prescription's branch to scope data;
      // for individual clinics we always load clinic-wide data (no branch filter).
      if (isMultiBranch && prescriptionBranchId == null) return;
      try {
        setLoading(true);
        const branchIdArg = isMultiBranch
          ? (prescriptionBranchId ?? undefined)
          : undefined;
        const [
          patientsData,
          doctorsData,
          medicinesData,
          appointmentsData,
          appointmentTypesData,
        ] = await Promise.all([
          patientService.getPatientsByClinic(clinicId, branchIdArg),
          doctorService.getDoctorsByClinic(clinicId, branchIdArg),
          medicineService.getMedicinesByClinic(clinicId),
          appointmentService.getAppointmentsByClinic(clinicId, branchIdArg),
          appointmentTypeService.getAppointmentTypesByClinic(
            clinicId,
            branchIdArg,
          ),
        ]);

        setPatients(patientsData || []);
        setDoctors(doctorsData || []);
        setMedicines(medicinesData || []);

        const enrichedAppointments = (appointmentsData || []).map(
          (appointment) => {
            const patient = patientsData?.find(
              (p) => p.id === appointment.patientId,
            );
            const doctor = doctorsData?.find(
              (d) => d.id === appointment.doctorId,
            );
            const appointmentType = appointmentTypesData?.find(
              (at) => at.id === appointment.appointmentTypeId,
            );

            return {
              ...appointment,
              patientName: patient?.name || "Unknown Patient",
              doctorName: doctor?.name || "Unknown Doctor",
              appointmentTypeName: appointmentType?.name || "Unknown Type",
            } as EnrichedAppointment;
          },
        );

        setAppointments(enrichedAppointments);
      } catch (error) {
        addToast({
          title: "Error",
          description: "Failed to load form data",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clinicId, prescriptionBranchId, isMultiBranch]);

  const handleAppointmentChange = (selectedId: string) => {
    setAppointmentId(selectedId);
    setIsPatientAutoFilled(false);
    setIsDoctorAutoFilled(false);
    if (selectedId) {
      const selectedAppt = appointments.find((app) => app.id === selectedId);

      if (selectedAppt) {
        setPatientId(selectedAppt.patientId);
        setDoctorId(selectedAppt.doctorId);
        setIsPatientAutoFilled(true);
        setIsDoctorAutoFilled(true);
      }
    }
  };

  const formatAppointmentDate = (date: any) => {
    if (!date) return "";
    let dateObj: Date;

    if (date?.toDate) dateObj = date.toDate();
    else if (date?.seconds) dateObj = new Date(date.seconds * 1000);
    else if (date instanceof Date) dateObj = date;
    else return "";

    return `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${String(dateObj.getDate()).padStart(2, "0")}`;
  };

  const addMedicine = () => {
    if (!medicineId || !dosage || !duration || !time || !intervalValue) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all medicine details",
        color: "warning",
      });

      return;
    }

    const selectedMedicine = medicines.find((med) => med.id === medicineId);

    if (!selectedMedicine) {
      addToast({
        title: "Error",
        description: "Selected medicine not found",
        color: "danger",
      });

      return;
    }

    if (items.some((item) => item.medicineId === medicineId)) {
      addToast({
        title: "Duplicate",
        description: `${selectedMedicine.name} is already added.`,
        color: "warning",
      });

      return;
    }

    setItems([
      ...items,
      {
        id: Date.now().toString(),
        medicineId,
        medicineName: selectedMedicine.name,
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
      description: "Medicine added",
      color: "success",
    });
  };

  const removeMedicine = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
    addToast({
      title: "Success",
      description: "Medicine removed",
      color: "success",
    });
  };

  const handleUpdate = async () => {
    if (!patientId || !doctorId || items.length === 0) {
      addToast({
        title: "Validation Error",
        description: "Select patient, doctor, and add at least one medicine",
        color: "warning",
      });

      return;
    }
    const userId = userData?.id || currentUser?.uid;
    if (!prescriptionId || !userId) {
      console.warn("[handleUpdate] Missing required IDs:", { prescriptionId, userId });
      return;
    }

    try {
      setSaving(true);
      const prescriptionItems = items.map((item) => ({
        id: item.id.length > 13 ? item.id : undefined, // Check if it's our temp ID or Firestore ID
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        dosage: item.dosage,
        frequency: item.interval,
        duration: item.duration,
        time: item.time,
        instructions: "",
        quantity: 1,
      }));

      console.log("[handleUpdate] Starting update for prescription:", prescriptionId);
      await prescriptionService.updatePrescription(prescriptionId, {
        diagnosis,
        notes,
        history,
        examination,
        investigation,
        treatmentPlan,
      });
      console.log("[handleUpdate] Prescription doc updated");
      await prescriptionService.updatePrescriptionItems(
        prescriptionId,
        prescriptionItems,
      );
      console.log("[handleUpdate] Prescription items updated");

      addToast({
        title: "Success",
        description: "Prescription updated successfully",
        color: "success",
      });
      navigate(`/dashboard/prescriptions/${prescriptionId}`);
    } catch (error) {
      console.error("[handleUpdate] Error updating prescription:", error);
      addToast({
        title: "Error",
        description: "Failed to update prescription",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="p-2">
        <PageSkeleton />
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button
              startContent={<IoArrowBackOutline />}
              variant="bordered"
              onClick={() => navigate("/dashboard/prescriptions")}
            >
              Back to list
            </Button>
            <div>
              <h1 className={`${title({ size: "lg" })} text-primary`}>Edit Prescription</h1>
              <p className="text-[13.5px] text-text-muted mt-1">
                {accessError}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border-base rounded-[10px] p-8 text-center text-text-main/80">
          You don&apos;t have access to this prescription. It may belong to
          another branch.
        </div>
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
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>Edit Prescription</h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              Update prescription details
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
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
                items={appointments.map((a) => ({
                  id: a.id,
                  primary: `${a.patientName} - ${formatAppointmentDate(a.appointmentDate)}`,
                  secondary: `Dr. ${a.doctorName}`,
                }))}
                label="Related Appointment"
                placeholder="Search appointment..."
                value={appointmentId}
                onChange={handleAppointmentChange}
              />
              <SearchSelect
                required
                description={
                  isPatientAutoFilled ? "Auto-filled from appointment" : ""
                }
                disabled={!!appointmentId}
                items={patients.map((p) => ({
                  id: p.id,
                  primary: p.name,
                  secondary: p.mobile || p.phone,
                }))}
                label="Patient"
                placeholder="Search patient..."
                value={patientId}
                onChange={setPatientId}
              />
              <SearchSelect
                required
                description={
                  isDoctorAutoFilled ? "Auto-filled from appointment" : ""
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
                onChange={setDoctorId}
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

        {/* Add Medicine */}
        <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
          <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
            <h4 className="font-semibold text-[15px] text-text-main leading-none">
              Add Medicine
            </h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end relative z-[50]">
              <SearchSelect
                required
                items={medicines.map((m) => ({
                  id: m.id,
                  primary: m.name,
                  secondary: m.manufacturer,
                }))}
                label="Medicine"
                placeholder="Search medicine..."
                value={medicineId}
                onChange={setMedicineId}
              />
              <CustomInput
                required
                label="Dosage"
                placeholder="e.g., 500mg, 1 tablet"
                value={dosage}
                onChange={(e: any) => setDosage(e.target.value)}
              />
              <CustomInput
                required
                label="Duration"
                placeholder="e.g., 7 days"
                value={duration}
                onChange={(e: any) => setDuration(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <CustomInput
                  required
                  label="Interval"
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
                  required
                  label="Time"
                  placeholder="e.g., morning, evening"
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
                onClick={addMedicine}
              >
                Add Medicine
              </Button>
            </div>
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

            {/* 3. Investigation */}
            <div className="flex flex-col gap-2 p-4 bg-surface rounded-[12px] border border-border-base hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-border-base/50">
                <IoFlaskOutline className="text-primary w-4.5 h-4.5" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-text-main">INVESTIGATION</span>
              </div>
              <textarea
                className="w-full text-[13.5px] px-3 py-2 bg-transparent border-0 outline-none text-text-main placeholder:text-text-muted/50 min-h-[70px] resize-y"
                placeholder="Enter laboratory investigations, diagnostic imaging, or tests ordered..."
                value={investigation}
                onChange={(e) => setInvestigation(e.target.value)}
              />
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
          </div>
        </div>

        {/* Medicines List */}
        <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
          <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
            <h4 className="font-semibold text-[15px] text-text-main leading-none">
              Prescription Summary ({items.length})
            </h4>
          </div>
          {items.length === 0 ? (
            <div className="p-8 text-center text-[13.5px] text-text-muted">
              No medicines added yet
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-2 border-b border-border-base">
                    <th className="px-5 py-3 text-[13px] font-semibold text-text-main w-1/4">
                      Medicine
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-text-main w-1/6">
                      Dosage
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-text-main w-1/6">
                      Duration
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-text-main w-1/6">
                      Time & Freq
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-text-main w-24">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-2/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="text-[13.5px] font-medium text-text-main">
                          {item.medicineName}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-text-main">
                        {item.dosage || "-"}
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-text-main">
                        {item.duration || "-"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[13.5px] text-text-main capitalize block leading-tight">
                          {item.time || "-"}
                        </span>
                        <span className="text-[11.5px] text-text-muted capitalize block">
                          {item.interval || "-"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Button
                          isIconOnly
                          color="danger"
                          size="sm"
                          variant="bordered"
                          onClick={() => removeMedicine(item.id)}
                        >
                          <IoTrashOutline className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Save as Rx Template Section */}
          {items.length > 0 && (
            <div className="px-5 py-4 border-t border-border-base/50 bg-surface-2/30 flex flex-col sm:flex-row gap-3 items-end justify-between">
              <div className="flex flex-col gap-1.5 w-full max-w-sm">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Save these medicines as a template</span>
                <input
                  className="w-full text-[13px] px-3.5 py-1.5 bg-surface border border-border-base rounded-[10px] outline-none text-text-main placeholder:text-text-muted/60 focus:border-primary text-[13px]"
                  placeholder="e.g. Acute Tonsillitis Pack, Hypertension Plan"
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
          )}
        </div>

        {/* Treatment Plan Section */}
        <div className="bg-surface border border-border-base rounded-[10px] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border-base/50 bg-gradient-to-r from-primary/10 to-primary/5 flex items-center gap-2">
            <IoClipboardOutline className="w-5 h-5 text-primary" />
            <h4 className="font-bold text-[15.5px] text-text-main">
              Care & Treatment Plan
            </h4>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Treatment Plan */}
            <div className="flex flex-col gap-2 p-4 bg-surface rounded-[12px] border border-border-base hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-border-base/50">
                <IoClipboardOutline className="text-primary w-4.5 h-4.5" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-text-main">TREATMENT PLAN</span>
              </div>
              <textarea
                className="w-full text-[13.5px] px-3 py-2 bg-transparent border-0 outline-none text-text-main placeholder:text-text-muted/50 min-h-[70px] resize-y"
                placeholder="Enter non-drug treatments, general advice, dietary advice, follow-up parameters..."
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
              />
            </div>

            {/* Extra Notes */}
            <CustomInput
              label="Additional Notes and  Instructions"
              placeholder="Add any extra notes or pharmacy-specific instructions..."
              type="textarea"
              value={notes}
              onChange={(e: any) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="bordered"
            onClick={() =>
              navigate(`/dashboard/prescriptions/${prescriptionId}`)
            }
          >
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={items.length === 0 || !patientId || !doctorId || saving}
            isLoading={saving}
            startContent={!saving && <IoSaveOutline className="w-4 h-4" />}
            onClick={handleUpdate}
          >
            {saving ? "Updating..." : "Update Prescription"}
          </Button>
        </div>
      </div>
    </div>
  );
}
