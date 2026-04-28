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
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { medicineService } from "@/services/medicineService";
import { appointmentService } from "@/services/appointmentService";
import { prescriptionService } from "@/services/prescriptionService";
import { branchService } from "@/services/branchService";

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
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border border-mountain-200 rounded min-h-[38px] bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100 ${disabled || readOnly ? "bg-mountain-50" : ""}`}
      >
        {type === "textarea" ? (
          <textarea
            className="flex-1 w-full text-[13.5px] px-3 py-2 bg-transparent outline-none text-mountain-800 placeholder:text-mountain-400 disabled:text-mountain-500 min-h-[80px]"
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
            className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-mountain-800 placeholder:text-mountain-400 disabled:text-mountain-500"
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
        <p className="text-[11.5px] text-mountain-500">{description}</p>
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
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex flex-wrap items-center min-h-[38px] border border-mountain-200 rounded focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100 bg-white ${disabled ? "bg-mountain-50" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-3 w-4 h-4 text-mountain-400 shrink-0" />
        <input
          className="flex-1 text-[13.5px] px-2 py-1.5 bg-transparent focus:outline-none text-mountain-800 placeholder:text-mountain-400 w-full"
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
            className="mr-3 text-mountain-400 hover:text-mountain-700"
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
        <p className="text-[11.5px] text-mountain-500">{description}</p>
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
          <div className="absolute z-[60] top-full mt-1 left-0 right-0 bg-white border border-mountain-200 rounded shadow-lg max-h-60 overflow-y-auto w-full min-w-max">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-mountain-500 text-center">
                No results found
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`flex flex-col w-full text-left px-3 py-2 hover:bg-teal-50 border-b border-mountain-50 last:border-0 ${i.id === value ? "bg-teal-50/50" : ""}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(i.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <span className="text-[13.5px] font-medium text-mountain-800 leading-tight">
                    {i.primary}
                  </span>
                  {i.secondary && (
                    <span className="text-[11.5px] text-mountain-500 mt-0.5 leading-tight">
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
  const [notes, setNotes] = useState("");

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
      appointmentService.getAppointmentsByClinic(clinicId, branchIdForData),
    ])
      .then(([patientsData, doctorsData, medicinesData, appointmentsData]) => {
        setPatients(patientsData);
        setDoctors(doctorsData);
        setMedicines(medicinesData);
        const relevantAppointments = (appointmentsData as any[]).filter(
          (apt: any) =>
            apt.status === "completed" || apt.status === "in-progress",
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

  const handleSave = async () => {
    if (!patientId || !doctorId) {
      addToast({
        title: "Error",
        description: "Please select both patient and doctor.",
        color: "warning",
      });

      return;
    }
    if (items.length === 0) {
      addToast({
        title: "Error",
        description: "Please add at least one medicine.",
        color: "warning",
      });

      return;
    }

    setSaving(true);
    try {
      const currentUser = userData?.id || "unknown-user";
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
      }));

      const prescriptionData = {
        patientId,
        clinicId: clinicId!,
        branchId: effectiveBranchId ?? clinicId!,
        appointmentId: appointmentId ? appointmentId : undefined,
        doctorId,
        items: prescriptionItems,
        notes,
        prescribedBy: currentUser,
      };

      await prescriptionService.createPrescription(prescriptionData);

      addToast({
        title: "Success",
        description: appointmentId
          ? "Prescription saved and linked to appointment successfully."
          : "Prescription saved successfully.",
        color: "success",
      });
      navigate("/dashboard/prescriptions");
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
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={title({ size: "lg" })}>New Prescription</h1>
        </div>
        <div className="bg-white border border-mountain-200 rounded p-12 flex items-center justify-center shadow-sm">
          <Spinner size="md" />
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
            onClick={() => navigate("/dashboard/prescriptions")}
          >
            Back
          </Button>
          <div>
            <h1 className={title({ size: "lg" })}>New Prescription</h1>
            <p className="text-[13.5px] text-mountain-500 mt-1">
              Create a new prescription for your patient
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* General Information */}
        <div className="bg-white border border-mountain-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
            <h4 className="font-semibold text-[15px] text-mountain-900 leading-none">
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
          </div>
        </div>

        {/* Add Medicine Card */}
        <div className="bg-white border border-mountain-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
            <h4 className="font-semibold text-[15px] text-mountain-900 leading-none">
              Prescription Details
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
                onChange={(id) => setMedicineId(id)}
              />
              <CustomInput
                label="Dosage"
                placeholder="e.g., 500mg, 1 tablet"
                value={dosage}
                onChange={(e: any) => setDosage(e.target.value)}
              />
              <CustomInput
                label="Duration"
                placeholder="e.g., 7 days"
                value={duration}
                onChange={(e: any) => setDuration(e.target.value)}
              />
              <CustomInput
                label="Time"
                placeholder="e.g., morning, after meals"
                value={time}
                onChange={(e: any) => setTime(e.target.value)}
              />
              <CustomInput
                label="Interval"
                placeholder="e.g., once daily"
                value={intervalValue}
                onChange={(e: any) => setIntervalValue(e.target.value)}
              />
              <Button
                className="h-[38px] w-full"
                color="primary"
                startContent={<IoAddOutline className="w-4 h-4" />}
                onClick={addItem}
              >
                Add to Prescription
              </Button>
            </div>
          </div>
        </div>

        {/* Medicines Table */}
        {items.length > 0 && (
          <div className="bg-white border border-mountain-200 rounded shadow-sm">
            <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
              <h4 className="font-semibold text-[15px] text-mountain-900 leading-none">
                Prescription Summary ({items.length}{" "}
                {items.length === 1 ? "medicine" : "medicines"})
              </h4>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mountain-50 border-b border-mountain-200">
                    <th className="px-5 py-3 text-[13px] font-semibold text-mountain-700 w-1/4">
                      Medicine
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-mountain-700 w-1/6">
                      Dosage
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-mountain-700 w-1/6">
                      Duration
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-mountain-700 w-1/6">
                      Time
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-mountain-700 w-1/6">
                      Frequency
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold text-mountain-700 w-24">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mountain-100">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-mountain-50/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="text-[13.5px] font-medium text-mountain-900">
                          {item.medicineName}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-mountain-700">
                        {item.dosage || "-"}
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-mountain-700">
                        {item.duration || "-"}
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-mountain-700 capitalize">
                        {item.time || "-"}
                      </td>
                      <td className="px-5 py-3 text-[13.5px] text-mountain-700 capitalize">
                        {item.interval || "-"}
                      </td>
                      <td className="px-5 py-3">
                        <Button
                          isIconOnly
                          color="danger"
                          size="sm"
                          variant="bordered"
                          onClick={() => removeItem(item.id)}
                        >
                          <IoTrashOutline className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white border border-mountain-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
            <h4 className="font-semibold text-[15px] text-mountain-900 leading-none">
              Additional Notes & Instructions
            </h4>
          </div>
          <div className="p-6">
            <CustomInput
              placeholder="Add any special instructions, warnings, or notes..."
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
            onClick={() => navigate("/dashboard/prescriptions")}
          >
            Cancel
          </Button>
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
