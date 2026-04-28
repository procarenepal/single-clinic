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
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { prescriptionService } from "@/services/prescriptionService";
import { branchService } from "@/services/branchService";

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

// ── Main Component ──────────────────────────────────────────────────────────
export default function EditPrescriptionPage() {
  const navigate = useNavigate();
  const { prescriptionId } = useParams<{ prescriptionId: string }>();
  const { clinicId, userData } = useAuthContext();
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
  const [notes, setNotes] = useState("");

  const [isPatientAutoFilled, setIsPatientAutoFilled] = useState(false);
  const [isDoctorAutoFilled, setIsDoctorAutoFilled] = useState(false);

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
        setNotes(prescriptionData.notes || "");

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
    if (!prescriptionId || !userData?.id) return;

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

      await prescriptionService.updatePrescription(prescriptionId, { notes });
      await prescriptionService.updatePrescriptionItems(
        prescriptionId,
        prescriptionItems,
      );

      addToast({
        title: "Success",
        description: "Prescription updated successfully",
        color: "success",
      });
      navigate(`/dashboard/prescriptions/${prescriptionId}`);
    } catch (error) {
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
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={title({ size: "lg" })}>Edit Prescription</h1>
        </div>
        <div className="bg-white border border-mountain-200 rounded p-12 flex items-center justify-center shadow-sm">
          <Spinner size="md" />
        </div>
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
              <h1 className={title({ size: "lg" })}>Edit Prescription</h1>
              <p className="text-[13.5px] text-mountain-500 mt-1">
                {accessError}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-mountain-200 rounded p-8 text-center text-mountain-600">
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
            <h1 className={title({ size: "lg" })}>Edit Prescription</h1>
            <p className="text-[13.5px] text-mountain-500 mt-1">
              Update prescription details
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
          </div>
        </div>

        {/* Add Medicine */}
        <div className="bg-white border border-mountain-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
            <h4 className="font-semibold text-[15px] text-mountain-900 leading-none">
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
              <CustomInput
                required
                label="Time"
                placeholder="e.g., morning, evening"
                value={time}
                onChange={(e: any) => setTime(e.target.value)}
              />
              <CustomInput
                required
                label="Interval"
                placeholder="e.g., once daily"
                value={intervalValue}
                onChange={(e: any) => setIntervalValue(e.target.value)}
              />
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

        {/* Medicines List */}
        <div className="bg-white border border-mountain-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
            <h4 className="font-semibold text-[15px] text-mountain-900 leading-none">
              Prescription Summary ({items.length})
            </h4>
          </div>
          {items.length === 0 ? (
            <div className="p-8 text-center text-[13.5px] text-mountain-500">
              No medicines added yet
            </div>
          ) : (
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
                      Time & Freq
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
                      <td className="px-5 py-3">
                        <span className="text-[13.5px] text-mountain-700 capitalize block leading-tight">
                          {item.time || "-"}
                        </span>
                        <span className="text-[11.5px] text-mountain-500 capitalize block">
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
        </div>

        {/* Notes */}
        <div className="bg-white border border-mountain-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
            <h4 className="font-semibold text-[15px] text-mountain-900 leading-none">
              Additional Notes
            </h4>
          </div>
          <div className="p-6">
            <CustomInput
              placeholder="Add any special instructions or notes..."
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
