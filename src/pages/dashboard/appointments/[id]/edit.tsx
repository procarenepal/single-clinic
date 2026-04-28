import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoSearchOutline,
  IoCloseOutline,
  IoCalendarOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { format } from "date-fns";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { branchService } from "@/services/branchService";
import { adToBS, bsToAD } from "@/utils/dateConverter";
import { Appointment, Patient, Doctor, AppointmentType } from "@/types/models";

// ── Custom UI Helpers (Clinic Clarity) ─────────────────────────────────────
function CustomSearchSelect({
  label,
  items,
  value,
  onChange,
  disabled,
  required,
  hint,
  placeholder,
}: {
  label: string;
  items: { id: string; primary: string; secondary?: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = (
    q
      ? items.filter((i) =>
        (i.primary + (i.secondary || ""))
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
        className={`flex items-center h-[38px] border border-mountain-200 rounded bg-white focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-100 ${disabled ? "bg-mountain-50" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-2.5 w-4 h-4 text-mountain-400 shrink-0" />
        <input
          className="flex-1 text-[13.5px] px-2 bg-transparent focus:outline-none text-mountain-800 placeholder:text-mountain-300 w-full outline-none"
          disabled={disabled}
          placeholder={placeholder || "Search…"}
          value={selected && !open ? selected.primary : q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && !disabled && (
          <button
            className="mr-2 text-mountain-400 hover:text-mountain-700"
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
      {hint && <p className="text-[11.5px] text-mountain-400">{hint}</p>}
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-mountain-200 rounded max-h-56 overflow-y-auto shadow-sm">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-mountain-400">
                No results
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`w-full text-left px-3 py-2 hover:bg-teal-50 border-b border-mountain-50 last:border-0 ${i.id === value ? "bg-teal-50/60" : ""}`}
                  type="button"
                  onClick={() => {
                    onChange(i.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <p className="text-[13.5px] text-mountain-800">{i.primary}</p>
                  {i.secondary && (
                    <p className="text-[11.5px] text-mountain-500 mt-0.5">
                      {i.secondary}
                    </p>
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
  endContent,
}: any) {
  return (
    <div className="flex flex-col gap-1.5 w-full relative">
      {label && (
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center h-[38px] border border-mountain-200 rounded bg-white focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-100 ${disabled || readOnly ? "bg-mountain-50" : ""}`}
      >
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
        {endContent && (
          <div className="px-3 border-l border-mountain-100 h-full flex items-center bg-mountain-50">
            {endContent}
          </div>
        )}
      </div>
      {description && (
        <p className="text-[11.5px] text-mountain-500">{description}</p>
      )}
    </div>
  );
}

export default function EditAppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser, userData, branchId } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertingDate, setConvertingDate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );

  // Form state
  const [formData, setFormData] = useState({
    patientId: "",
    registrationDate: "",
    appointmentDate: "",
    appointmentBS: "",
    startTime: "",
    endTime: "",
    doctorId: "",
    appointmentTypeId: "",
    status: "scheduled" as
      | "scheduled"
      | "confirmed"
      | "in-progress"
      | "completed"
      | "cancelled"
      | "no-show",
    reason: "",
    notes: "",
  });

  // Status options
  const statusOptions = [
    { id: "scheduled", name: "Scheduled" },
    { id: "confirmed", name: "Confirmed" },
    { id: "in-progress", name: "In Progress" },
    { id: "completed", name: "Completed" },
    { id: "cancelled", name: "Cancelled" },
    { id: "no-show", name: "No Show" },
  ];

  // Load appointment and related data
  useEffect(() => {
    const loadData = async () => {
      if (!id || !clinicId) return;

      setLoading(true);
      setError(null);

      try {
        // Get appointment details
        const appointmentData = await appointmentService.getAppointmentById(id);

        if (!appointmentData) {
          setError("Appointment not found");

          return;
        }

        // Check if appointment belongs to this clinic
        if (appointmentData.clinicId !== clinicId) {
          setError("Appointment not found");

          return;
        }

        // Enforce branch-level access for branch staff
        const userBranchId = branchId || userData?.branchId;

        if (
          userBranchId &&
          appointmentData.branchId &&
          appointmentData.branchId !== userBranchId
        ) {
          setError("Appointment not found");

          return;
        }

        setAppointment(appointmentData);

        // For individual clinics use clinic-wide queries (no branchId); for multi-branch use appointment's branch
        const isMultiBranch =
          await branchService.isMultiBranchEnabled(clinicId);
        const branchIdForData = isMultiBranch
          ? (appointmentData.branchId ?? undefined)
          : undefined;

        // Load all required data in parallel
        const [patientsData, doctorsData, appointmentTypesData] =
          await Promise.all([
            patientService.getPatientsByClinic(clinicId, branchIdForData),
            doctorService.getDoctorsByClinic(clinicId, branchIdForData),
            appointmentTypeService.getAppointmentTypesByClinic(
              clinicId,
              branchIdForData,
            ),
          ]);

        setPatients(patientsData);
        setDoctors(doctorsData);
        setAppointmentTypes(appointmentTypesData);

        // Initialize form data
        setFormData({
          patientId: appointmentData.patientId,
          registrationDate: format(
            appointmentData.registrationDate,
            "yyyy-MM-dd",
          ),
          appointmentDate: format(
            appointmentData.appointmentDate,
            "yyyy-MM-dd",
          ),
          appointmentBS: appointmentData.appointmentBS
            ? format(appointmentData.appointmentBS, "yyyy-MM-dd")
            : "",
          startTime: appointmentData.startTime || "",
          endTime: appointmentData.endTime || "",
          doctorId: appointmentData.doctorId,
          appointmentTypeId: appointmentData.appointmentTypeId,
          status: appointmentData.status,
          reason: appointmentData.reason || "",
          notes: appointmentData.notes || "",
        });
      } catch (err) {
        console.error("Error loading appointment data:", err);
        setError("Failed to load appointment data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, clinicId]);

  // Convert AD to BS date
  const convertADToBS = async (adDate: string) => {
    if (!adDate) return;

    setConvertingDate(true);
    try {
      const dateObj = new Date(adDate);
      const bsDate = adToBS(dateObj);

      setFormData((prev) => ({ ...prev, appointmentBS: bsDate.formatted }));
    } catch (error) {
      console.error("Date conversion error:", error);
      addToast({
        title: "Date Conversion Error",
        description: "Failed to convert date to Bikram Sambat",
        color: "warning",
      });
    } finally {
      setConvertingDate(false);
    }
  };

  // Convert BS to AD date
  const convertBSToAD = async (bsDate: string) => {
    if (!bsDate) return;

    setConvertingDate(true);
    try {
      const adDate = bsToAD(bsDate);

      setFormData((prev) => ({
        ...prev,
        appointmentDate: format(adDate, "yyyy-MM-dd"),
      }));
    } catch (error) {
      console.error("Date conversion error:", error);
      addToast({
        title: "Date Conversion Error",
        description: "Failed to convert date to A.D.",
        color: "warning",
      });
    } finally {
      setConvertingDate(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointment || !currentUser) return;

    setSaving(true);

    try {
      // Validate required fields
      if (
        !formData.patientId ||
        !formData.doctorId ||
        !formData.appointmentTypeId ||
        !formData.appointmentDate
      ) {
        addToast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          color: "danger",
        });

        return;
      }

      // Prepare update data
      const updateData: Partial<Appointment> = {
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        appointmentTypeId: formData.appointmentTypeId,
        appointmentDate: new Date(formData.appointmentDate),
        appointmentBS: formData.appointmentBS
          ? new Date(formData.appointmentBS)
          : undefined,
        registrationDate: new Date(formData.registrationDate),
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        status: formData.status,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
      };

      await appointmentService.updateAppointment(appointment.id, updateData);

      addToast({
        title: "Success",
        description: "Appointment updated successfully",
        color: "success",
      });

      navigate(`/dashboard/appointments/${appointment.id}`);
    } catch (error) {
      console.error("Error updating appointment:", error);
      addToast({
        title: "Error",
        description: "Failed to update appointment. Please try again.",
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
          <h1 className={title({ size: "lg" })}>Edit Appointment</h1>
          <p className="text-mountain-500 mt-1 text-[13.5px]">
            Loading appointment details…
          </p>
        </div>
        <div className="clarity-card bg-white border border-mountain-200 rounded p-12 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={title({ size: "lg" })}>Edit Appointment</h1>
          <p className="text-mountain-500 mt-1 text-[13.5px]">
            Error loading appointment
          </p>
        </div>
        <div className="clarity-card bg-white border border-rose-200 rounded p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 text-sm font-semibold">
              !
            </div>
            <div>
              <p className="text-[14px] font-semibold text-rose-700 mb-1">
                Unable to load this appointment
              </p>
              <p className="text-[13px] text-mountain-600">{error}</p>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="bordered"
                  onClick={() => navigate("/dashboard/appointments")}
                >
                  Back to Appointments
                </Button>
                <Button
                  color="primary"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-6 pb-12" onSubmit={handleSubmit}>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={title({ size: "lg" })}>Edit Appointment</h1>
          <p className="text-mountain-500 mt-1 text-[13.5px]">
            Update appointment details and status
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="bordered"
            onClick={() =>
              navigate(`/dashboard/appointments/${appointment.id}`)
            }
          >
            Cancel
          </Button>
          <Button color="primary" disabled={saving} type="submit">
            {saving ? "Updating..." : "Update Appointment"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2">
            <div className="clarity-card bg-white border border-mountain-200 rounded">
              <div className="px-5 py-3 border-b border-mountain-100 bg-mountain-50/60 flex items-center gap-2">
                <IoCalendarOutline className="w-4 h-4 text-teal-700" />
                <h3 className="text-[14px] font-semibold text-mountain-900">
                  Appointment Information
                </h3>
              </div>
              <div className="p-5 flex flex-col gap-6">
                {/* Patient Selection */}
                <CustomSearchSelect
                  required
                  items={patients.map((p) => ({
                    id: p.id,
                    primary: p.name,
                    secondary: `Reg# ${p.regNumber}`,
                  }))}
                  label="Patient"
                  placeholder="Search and select patient"
                  value={formData.patientId}
                  onChange={(id) =>
                    setFormData((prev) => ({ ...prev, patientId: id }))
                  }
                />

                {/* Doctor Selection */}
                <CustomSearchSelect
                  required
                  items={doctors.map((d) => ({
                    id: d.id,
                    primary: d.name,
                    secondary: d.speciality,
                  }))}
                  label="Doctor"
                  placeholder="Search and select doctor"
                  value={formData.doctorId}
                  onChange={(id) =>
                    setFormData((prev) => ({ ...prev, doctorId: id }))
                  }
                />

                {/* Appointment Type */}
                <CustomSearchSelect
                  required
                  items={appointmentTypes.map((t) => ({
                    id: t.id,
                    primary: t.name,
                    secondary: `NPR ${t.price.toLocaleString()}`,
                  }))}
                  label="Appointment Type"
                  placeholder="Search and select type"
                  value={formData.appointmentTypeId}
                  onChange={(id) =>
                    setFormData((prev) => ({ ...prev, appointmentTypeId: id }))
                  }
                />

                {/* Status */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-[13px] font-medium text-mountain-700">
                    Status<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="flex items-center h-[38px] border border-mountain-200 rounded bg-white focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-100">
                    <select
                      required
                      className="flex-1 w-full h-full bg-transparent px-3 text-[13.5px] text-mountain-800 outline-none"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          status: e.target.value as any,
                        }))
                      }
                    >
                      {statusOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Registration Date */}
                <CustomInput
                  required
                  label="Registration Date"
                  name="registrationDate"
                  type="date"
                  value={formData.registrationDate}
                  onChange={(e: any) =>
                    setFormData((prev) => ({
                      ...prev,
                      registrationDate: e.target.value,
                    }))
                  }
                />

                {/* Appointment Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CustomInput
                    required
                    description="Automatically converts to B.S. date"
                    label="Appointment Date (A.D.)"
                    name="appointmentDate"
                    type="date"
                    value={formData.appointmentDate}
                    onChange={(e: any) => {
                      const val = e.target.value;

                      setFormData((prev) => ({
                        ...prev,
                        appointmentDate: val,
                      }));
                      if (val) {
                        convertADToBS(val);
                      }
                    }}
                  />
                  <CustomInput
                    endContent={convertingDate ? <Spinner size="sm" /> : null}
                    label="Appointment Date (B.S.)"
                    name="appointmentBS"
                    type="date"
                    value={formData.appointmentBS}
                    onChange={(e: any) => {
                      const val = e.target.value;

                      setFormData((prev) => ({ ...prev, appointmentBS: val }));
                      if (val) {
                        convertBSToAD(val);
                      }
                    }}
                  />
                </div>

                {/* Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CustomInput
                    endContent={
                      <IoTimeOutline className="w-4 h-4 text-mountain-400" />
                    }
                    label="Start Time"
                    name="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e: any) =>
                      setFormData((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                  />
                  <CustomInput
                    endContent={
                      <IoTimeOutline className="w-4 h-4 text-mountain-400" />
                    }
                    label="End Time"
                    name="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e: any) =>
                      setFormData((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Reason */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-[13px] font-medium text-mountain-700">
                    Reason for Visit
                  </label>
                  <textarea
                    className="w-full text-[13.5px] px-3 py-2 bg-white border border-mountain-200 rounded min-h-[70px] focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-100 text-mountain-800 placeholder:text-mountain-400"
                    placeholder="Enter reason for the appointment"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-[13px] font-medium text-mountain-700">
                    Notes
                  </label>
                  <textarea
                    className="w-full text-[13.5px] px-3 py-2 bg-white border border-mountain-200 rounded min-h-[80px] focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-100 text-mountain-800 placeholder:text-mountain-400"
                    placeholder="Additional notes or instructions"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Side panel with current info */}
          <div>
            <div className="clarity-card bg-white border border-mountain-200 rounded">
              <div className="px-5 py-3 border-b border-mountain-100 bg-mountain-50/60">
                <h3 className="text-[14px] font-semibold text-mountain-900">
                  Current Information
                </h3>
              </div>
              <div className="p-5 flex flex-col gap-4 text-[13px] text-mountain-800">
                <div>
                  <h4 className="text-[12.5px] font-medium text-mountain-600 mb-1">
                    Original Date
                  </h4>
                  <p>{format(appointment.appointmentDate, "MMMM dd, yyyy")}</p>
                </div>

                {appointment.startTime && (
                  <div>
                    <h4 className="text-[12.5px] font-medium text-mountain-600 mb-1">
                      Original Time
                    </h4>
                    <p>
                      {appointment.startTime}
                      {appointment.endTime && ` - ${appointment.endTime}`}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-[12.5px] font-medium text-mountain-600 mb-1">
                    Current Status
                  </h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-teal-200 bg-teal-50 text-[11px] font-semibold text-teal-700 capitalize">
                    {appointment.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-[12.5px] font-medium text-mountain-600 mb-1">
                    Created
                  </h4>
                  <p>{format(appointment.createdAt, "MMM dd, yyyy")}</p>
                </div>

                <div>
                  <h4 className="text-[12.5px] font-medium text-mountain-600 mb-1">
                    Last Updated
                  </h4>
                  <p>{format(appointment.updatedAt, "MMM dd, yyyy")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
