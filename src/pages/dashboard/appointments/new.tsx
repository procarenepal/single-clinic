import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle as CheckCircleIcon } from "lucide-react";
import {
  IoSearchOutline,
  IoCloseOutline,
  IoCalendarOutline,
  IoTimeOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { patientService } from "@/services/patientService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { doctorService } from "@/services/doctorService";
import { appointmentService } from "@/services/appointmentService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { expertService } from "@/services/expertService";
import { branchService } from "@/services/branchService";
import {
  scheduleAppointmentReminder,
  scheduleDoctorAppointmentReminder,
} from "@/services/sendMessageService";
import {
  adToBSApi,
  bsToADApi,
  formatDateWithoutTimezone,
  validateBSDateFormat,
  validateADDate,
  debounce,
} from "@/utils/dateConverterApi";
import { Appointment, Patient, AppointmentType, Doctor, Expert } from "@/types/models";
import { IoAddOutline, IoTrashOutline } from "react-icons/io5";

export type ClinicianType = "doctor" | "expert";

export interface AppointmentRow {
  id: string;
  clinicianType: ClinicianType;
  clinicianId: string;
  appointmentTypeId: string;
  startTime: string;
  endTime: string;
}

// Define the ConversionProgress type
interface ConversionProgress {
  isConverting: boolean;
  progress: number;
  message: string;
}

// ── Custom UI Helpers ────────────────────────────────────────────────────────
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
  onChange: (id: string, primary: string) => void;
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
    <div className="flex flex-col gap-1.5 relative">
      {(label || required) && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex flex-wrap items-center min-h-[38px] border border-border-base rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-surface transition-all ${disabled ? "bg-surface-2 opacity-70 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-3 w-4 h-4 text-text-muted shrink-0" />
        <input
          className="flex-1 text-[13.5px] px-2 py-1.5 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/60 w-full disabled:cursor-not-allowed"
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
            className="mr-3 text-text-muted hover:text-text-main transition-colors"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "");
              setQ("");
            }}
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[11.5px] font-medium text-text-muted mt-1">{hint}</p>
      )}
      {open && !disabled && (
        <>
          <div
            className="fixed inset-0 z-10 border-0 m-0 p-0 shadow-none bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border-base rounded-xl shadow-lg shadow-black/5 max-h-64 overflow-y-auto custom-scrollbar glass-morphism overflow-hidden">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-text-muted text-center font-medium">
                No results
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`flex flex-col w-full text-left px-3 py-2.5 hover:bg-surface-2 border-b border-border-base/50 last:border-0 transition-colors ${i.id === value ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(i.id, i.primary);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <span className="text-[13.5px] font-bold text-text-main leading-tight group-hover:text-primary transition-colors">
                    {i.primary}
                  </span>
                  {i.secondary && (
                    <span className="text-[11px] font-medium text-text-muted mt-0.5 leading-tight">
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
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border border-border-base rounded-xl min-h-[38px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all ${disabled || readOnly ? "bg-surface-2 opacity-70 cursor-not-allowed" : ""}`}
      >
        <input
          className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/60 disabled:cursor-not-allowed"
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
          <div className="px-3 border-l border-border-base h-full flex items-center bg-surface-2 rounded-r-xl">
            {endContent}
          </div>
        )}
      </div>
      {description && (
        <p className="text-[11.5px] font-medium text-text-muted mt-1">
          {description}
        </p>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function NewAppointmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clinicId, currentUser, userData } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [loadingData, setLoadingData] = useState(true);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);
  const [isMultiBranch, setIsMultiBranch] = useState(false);

  // Date conversion state
  const [dateConversionState, setDateConversionState] = useState({
    isConverting: false,
    progress: 0,
    message: "",
    field: "" as "appointmentDate" | "appointmentBS" | "",
    lastConversion: {
      source: "" as "api" | "local",
      apiUsed: "",
      timestamp: 0,
    },
  });

  const debouncedConversion = useCallback(
    debounce(
      async (
        value: string,
        field: string,
        conversionType: "ad-to-bs" | "bs-to-ad",
      ) => {
        if (!value.trim()) {
          setDateConversionState((prev) => ({
            ...prev,
            isConverting: false,
            field: "",
            progress: 0,
            message: "",
          }));

          return;
        }
        setDateConversionState((prev) => ({
          ...prev,
          isConverting: true,
          field: field as any,
          progress: 0,
          message: "Starting conversion...",
        }));

        try {
          const onProgress = (progress: ConversionProgress) => {
            setDateConversionState((prev) => ({
              ...prev,
              progress: progress.progress,
              message: progress.message,
              isConverting: progress.isConverting,
            }));
          };

          if (conversionType === "ad-to-bs") {
            const selectedDate = new Date(value);
            const validation = validateADDate(selectedDate);

            if (!validation.isValid) {
              setDateConversionState((prev) => ({
                ...prev,
                isConverting: false,
                message: validation.error || "Invalid date",
                field: "",
              }));

              return;
            }
            const bsResult = await adToBSApi(selectedDate, onProgress);

            if (field === "appointmentDate") {
              setAppointmentInfo((prev) => ({
                ...prev,
                appointmentBS: bsResult.formatted,
              }));
            }
            setDateConversionState((prev) => ({
              ...prev,
              isConverting: false,
              field: "",
              progress: 100,
              message: "Conversion completed successfully",
              lastConversion: {
                source: bsResult.source,
                apiUsed: bsResult.apiUsed || "",
                timestamp: Date.now(),
              },
            }));
          } else {
            const validation = validateBSDateFormat(value);

            if (!validation.isValid) {
              setDateConversionState((prev) => ({
                ...prev,
                isConverting: false,
                message: validation.error || "Invalid BS date format",
                field: "",
              }));

              return;
            }
            const adDate = await bsToADApi(value, onProgress);
            const formattedAdDate = formatDateWithoutTimezone(adDate);

            if (field === "appointmentBS") {
              setAppointmentInfo((prev) => ({
                ...prev,
                appointmentDate: formattedAdDate,
              }));
            }
            setDateConversionState((prev) => ({
              ...prev,
              isConverting: false,
              field: "",
              progress: 100,
              message: "Conversion completed successfully",
              lastConversion: {
                source: "api",
                apiUsed: "API Service",
                timestamp: Date.now(),
              },
            }));
          }
        } catch (error) {
          console.error("Date conversion error:", error);
          setDateConversionState((prev) => ({
            ...prev,
            isConverting: false,
            field: "",
            progress: 0,
            message:
              error instanceof Error ? error.message : "Conversion failed",
          }));
          addToast({
            title: "Date Conversion Error",
            description:
              error instanceof Error
                ? error.message
                : "Failed to convert date.",
            color: "danger",
          });
        }
      },
      500,
    ),
    [],
  );

  const [existingAppointments, setExistingAppointments] = useState<
    Appointment[]
  >([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  const currentDate = new Date();
  const formattedDate = currentDate.toISOString().split("T")[0];
  const preSelectedPatientId = searchParams.get("patientId");

  const [appointmentInfo, setAppointmentInfo] = useState({
    patientId: preSelectedPatientId || "",
    registrationDate: formattedDate,
    appointmentDate: "",
    appointmentBS: "",
    reason: "",
    notes: "",
  });

  const [appointmentRows, setAppointmentRows] = useState<AppointmentRow[]>([
    {
      id: crypto.randomUUID(),
      clinicianType: "doctor",
      clinicianId: "",
      appointmentTypeId: "",
      startTime: "",
      endTime: "",
    },
  ]);

  const [patientSearchInput, setPatientSearchInput] = useState("");

  // Resolve default branch for this appointment (branch users, then main branch, then clinic fallback)
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
            .then((b) => b && setDefaultBranchId(b.id));
        }
        setDefaultBranchId(clinicId);
      })
      .catch(() => setDefaultBranchId(clinicId));
  }, [clinicId, userData?.branchId]);

  // Only pass branchId for multi-branch clinics; individual clinics use clinic-wide queries (no branchId filter)
  const branchIdForData = isMultiBranch
    ? (defaultBranchId ?? undefined)
    : undefined;

  useEffect(() => {
    const loadData = async () => {
      if (!clinicId) return;
      // For multi-branch we need defaultBranchId before loading; for individual clinic we can load with just clinicId
      if (isMultiBranch && !defaultBranchId) return;
      try {
        setLoadingData(true);
        const patientsData = await patientService.getPatientsByClinic(
          clinicId,
          branchIdForData,
        );

        setPatients(patientsData);

        const doctorsData = await doctorService.getDoctorsByClinic(
          clinicId,
          branchIdForData,
        );

        setDoctors(doctorsData.filter((doctor) => doctor.isActive));

        const expertsData = await expertService.getExpertsByClinic(
          clinicId,
          branchIdForData,
        );

        setExperts(expertsData.filter((expert) => expert.isActive));

        const appointmentTypesData =
          await appointmentTypeService.getActiveAppointmentTypesByClinic(
            clinicId,
            branchIdForData,
          );

        setAppointmentTypes(appointmentTypesData);
      } catch (error) {
        addToast({
          title: "Error",
          description: "Failed to load clinic data",
          color: "danger",
        });
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [clinicId, defaultBranchId, isMultiBranch, branchIdForData]);

  useEffect(() => {
    if (appointmentInfo.patientId && patients.length > 0) {
      const selectedPatient = patients.find(
        (p) => p.id === appointmentInfo.patientId,
      );

      if (selectedPatient) {
        setPatientSearchInput(
          `${selectedPatient.name} (${selectedPatient.regNumber})`,
        );
      }
    } else if (!appointmentInfo.patientId) {
      setPatientSearchInput("");
    }
  }, [appointmentInfo.patientId, patients]);

  useEffect(() => {
    const loadAppointmentsForDate = async () => {
      if (!appointmentInfo.appointmentDate || !clinicId) {
        setExistingAppointments([]);

        return;
      }
      try {
        setLoadingAppointments(true);
        const selectedDate = new Date(appointmentInfo.appointmentDate);
        const appointments = await appointmentService.getAppointmentsByDate(
          selectedDate,
          clinicId,
          defaultBranchId || userData?.branchId,
        );

        setExistingAppointments(appointments);
      } catch (error) {
        addToast({
          title: "Error",
          description: "Failed to load existing appointments",
          color: "warning",
        });
      } finally {
        setLoadingAppointments(false);
      }
    };

    loadAppointmentsForDate();
  }, [
    appointmentInfo.appointmentDate,
    clinicId,
    defaultBranchId,
    userData?.branchId,
  ]);

  const handleAppointmentInfoChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    setAppointmentInfo((prev) => ({ ...prev, [name]: value }));

    if (name === "appointmentDate" && value) {
      debouncedConversion(value, "appointmentDate", "ad-to-bs");
    } else if (name === "appointmentBS" && value) {
      debouncedConversion(value, "appointmentBS", "bs-to-ad");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!clinicId) {
        addToast({
          title: "Error",
          description: "No clinic information found.",
          color: "danger",
        });

        return;
      }
      if (!appointmentInfo.patientId) {
        addToast({
          title: "Error",
          description: "Please select a patient.",
          color: "danger",
        });
        return;
      }
      if (!appointmentInfo.appointmentDate) {
        addToast({
          title: "Error",
          description: "Please select a date.",
          color: "danger",
        });
        return;
      }
      if (appointmentRows.length === 0) {
        addToast({
          title: "Error",
          description: "Please add at least one appointment.",
          color: "danger",
        });
        return;
      }

      for (let i = 0; i < appointmentRows.length; i++) {
        const row = appointmentRows[i];

        if (!row.clinicianId) {
          addToast({
            title: "Validation Error",
            description: `Please select a clinician for appointment #${i + 1}.`,
            color: "danger",
          });

          return;
        }
        if (!row.appointmentTypeId) {
          addToast({
            title: "Validation Error",
            description: `Please select an appointment type for appointment #${i + 1}.`,
            color: "danger",
          });

          return;
        }
      }

      // Generate Invoice first if we have billable items
      const selPat = patients.find((p) => p.id === appointmentInfo.patientId);

      let invoiceNo = "";
      let newBillingId = "";
      const billingItems: any[] = [];
      let totalAmount = 0;

      for (const row of appointmentRows) {
        const selApptType = appointmentTypes.find(
          (t) => t.id === row.appointmentTypeId,
        );

        if (selApptType && selApptType.price >= 0) {
          const isDoctor = row.clinicianType === "doctor";
          const selDoc = doctors.find((d) => d.id === row.clinicianId);
          const selExp = experts.find((e) => e.id === row.clinicianId);
          const clinicianToBill = isDoctor ? selDoc : selExp;
          const clinicianName = clinicianToBill
            ? clinicianToBill.name
            : "Clinic";
          const clinicianCommission = clinicianToBill?.defaultCommission || 0;

          billingItems.push({
            id: crypto.randomUUID(),
            appointmentTypeId: selApptType.id,
            appointmentTypeName: selApptType.name,
            price: Number(selApptType.price),
            quantity: 1,
            commission: clinicianCommission,
            doctorId: row.clinicianId,
            doctorName: clinicianName,
            amount: Number(selApptType.price),
          });
          totalAmount += Number(selApptType.price);
        }
      }

      if (billingItems.length > 0) {
        invoiceNo =
          await appointmentBillingService.generateInvoiceNumber(clinicId);
        const processedReferrals: any[] = [];

        if (selPat?.referrals && Array.isArray(selPat.referrals)) {
          for (const ref of selPat.referrals) {
            processedReferrals.push({
              type: ref.type,
              id: ref.id,
              name: ref.name,
              commissionPercentage: ref.commissionPercentage || 0,
              commissionAmount:
                (totalAmount * (ref.commissionPercentage || 0)) / 100,
            });
          }
        }

        const primaryPartner = processedReferrals.find(
          (r) => r.type === "referral-partner",
        );

        const firstClinicianItem = billingItems[0];

        const billingData = {
          invoiceNumber: invoiceNo,
          clinicId: clinicId,
          branchId: defaultBranchId || userData?.branchId || clinicId,
          patientId: selPat?.id || appointmentInfo.patientId,
          patientName: selPat?.name || "Unknown Patient",
          doctorId: firstClinicianItem.doctorId,
          doctorName: firstClinicianItem.doctorName,
          doctorType:
            appointmentRows[0].clinicianType === "doctor"
              ? "regular"
              : "regular",
          referralPartnerId: primaryPartner
            ? primaryPartner.id
            : selPat?.referralPartnerId || undefined,
          referralCommissionAmount: primaryPartner
            ? primaryPartner.commissionAmount
            : undefined,
          referrals: processedReferrals,
          invoiceDate: new Date(),
          items: billingItems,
          subtotal: totalAmount,
          itemDiscountAmount: 0,
          mainDiscountAmount: 0,
          discountType: "percent" as const,
          discountValue: 0,
          discountAmount: 0,
          taxPercentage: 0,
          taxAmount: 0,
          totalAmount: totalAmount,
          status: "draft" as const,
          paymentStatus: "unpaid" as const,
          paidAmount: 0,
          balanceAmount: totalAmount,
          createdBy: currentUser?.uid || "system",
        };

        newBillingId = await appointmentBillingService.createBilling(
          billingData as any,
        );
      }

      // Create appointments
      for (const row of appointmentRows) {
        const appointmentData: Partial<Appointment> = {
          patientId: appointmentInfo.patientId,
          clinicId: clinicId,
          branchId: defaultBranchId || userData?.branchId || clinicId,
          doctorId:
            row.clinicianType === "doctor" ? row.clinicianId : "unassigned",
          assignedExpertId:
            row.clinicianType === "expert" ? row.clinicianId : undefined,
          appointmentDate: new Date(appointmentInfo.appointmentDate),
          appointmentTypeId: row.appointmentTypeId,
          status: "scheduled",
          registrationDate: new Date(appointmentInfo.registrationDate),
          createdBy: currentUser?.uid || "",
        };

        if (row.startTime) appointmentData.startTime = row.startTime;
        if (row.endTime) appointmentData.endTime = row.endTime;
        if (appointmentInfo.reason && appointmentInfo.reason.trim())
          appointmentData.reason = appointmentInfo.reason.trim();
        if (appointmentInfo.notes && appointmentInfo.notes.trim())
          appointmentData.notes = appointmentInfo.notes.trim();

        if (newBillingId) {
          appointmentData.billingId = newBillingId;
          appointmentData.billingStatus = "unpaid";
          appointmentData.paymentStatus = "unpaid";
        }

        const appointmentId =
          await appointmentService.createAppointment(appointmentData);

        if (row.startTime) {
          try {
            await scheduleAppointmentReminder({
              id: appointmentId,
              appointmentDate: appointmentData.appointmentDate as any,
              patientId: appointmentData.patientId as any,
              doctorId: appointmentData.doctorId as any,
              clinicId: appointmentData.clinicId as any,
              branchId: appointmentData.branchId as any,
              appointmentTypeId: appointmentData.appointmentTypeId as any,
              startTime: row.startTime,
            });
          } catch (e) {
            console.error("Error patient reminder:", e);
          }
          if (row.clinicianType === "doctor") {
            try {
              await scheduleDoctorAppointmentReminder({
                id: appointmentId,
                appointmentDate: appointmentData.appointmentDate as any,
                patientId: appointmentData.patientId as any,
                doctorId: appointmentData.doctorId as any,
                clinicId: appointmentData.clinicId as any,
                branchId: appointmentData.branchId as any,
                appointmentTypeId: appointmentData.appointmentTypeId as any,
                startTime: row.startTime,
              });
            } catch (e) {
              console.error("Error doctor reminder:", e);
            }
          }
        }
      }

      addToast({
        title: "Success",
        description: "Appointment scheduled successfully!",
        color: "success",
      });
      navigate("/dashboard/appointments");
    } catch (error) {
      console.error("Error creating appointment:", error);
      addToast({
        title: "Error",
        description: "Failed to schedule appointment.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPatientNameById = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);

    return patient
      ? `${patient.name} (${patient.regNumber})`
      : "Unknown Patient";
  };
  const getDoctorNameById = (doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId);

    return doctor ? `${doctor.name} (${doctor.speciality})` : "Unknown Doctor";
  };
  const getAppointmentTypeNameById = (appointmentTypeId: string) => {
    const appointmentType = appointmentTypes.find(
      (at) => at.id === appointmentTypeId,
    );

    return appointmentType ? appointmentType.name : "Unknown Type";
  };
  const formatTime = (time: string) => {
    if (!time) return "";
    try {
      const [hours, minutes] = time.split(":");
      const date = new Date();

      date.setHours(parseInt(hours), parseInt(minutes));

      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return time;
    }
  };
  const getStatusColor = (status: string) => {
    const S_COLORS: Record<string, string> = {
      confirmed: "bg-health-100 text-health-700 border-health-200",
      scheduled: "bg-teal-100 text-teal-700 border-teal-200",
      "in-progress": "bg-saffron-100 text-saffron-700 border-saffron-200",
      completed: "bg-health-100 text-health-700 border-health-200",
      cancelled: "bg-red-100 text-red-700 border-red-200",
      "no-show": "bg-red-100 text-red-700 border-red-200",
      default: "bg-mountain-100 text-mountain-600 border-mountain-200",
    };

    return S_COLORS[status?.toLowerCase()] || S_COLORS.default;
  };

  if (loadingData) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={title({ size: "sm" })}>Schedule New Appointment</h1>
          <p className="text-text-muted mt-1 text-[13.5px] font-medium">
            Create a new appointment for a patient
          </p>
        </div>
        <div className="bg-surface border border-border-base rounded-2xl p-12 flex items-center justify-center shadow-sm">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={title({ size: "sm" })}>Schedule New Appointment</h1>
            <p className="text-text-muted mt-1 text-[13.5px] font-medium">
              Create a new appointment for a patient
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="bordered"
              onClick={() => navigate("/dashboard/appointments")}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              disabled={
                loading ||
                !appointmentInfo.patientId ||
                !appointmentInfo.appointmentDate ||
                appointmentRows.length === 0 ||
                appointmentRows.some((row) => !row.clinicianId || !row.appointmentTypeId)
              }
              type="submit"
            >
              {loading ? "Scheduling..." : "Schedule Appointment"}
            </Button>
          </div>
        </div>

        {/* Global Visit Details */}
        <div className="bg-surface border border-border-base rounded-2xl shadow-sm overflow-visible">
          <div className="px-5 py-4 border-b border-border-base bg-surface-2/50 rounded-t-2xl">
            <h4 className="font-semibold text-[15px] text-text-main flex items-center gap-2">
              <IoCalendarOutline className="w-5 h-5 text-primary" />
              Visit Details
            </h4>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <CustomInput
              disabled
              readOnly
              label="Registration Date"
              name="registrationDate"
              type="date"
              value={appointmentInfo.registrationDate}
            />

            <div className="relative">
              <CustomInput
                required
                description="Automatically converts to BS Date"
                disabled={
                  dateConversionState.isConverting &&
                  dateConversionState.field === "appointmentDate"
                }
                endContent={
                  dateConversionState.isConverting &&
                  dateConversionState.field === "appointmentDate" && (
                    <div className="flex items-center gap-2">
                      <Spinner size="sm" />
                    </div>
                  )
                }
                label="Appointment Date *"
                name="appointmentDate"
                type="date"
                value={appointmentInfo.appointmentDate}
                onChange={handleAppointmentInfoChange}
              />
            </div>

            <div className="relative">
              <CustomInput
                description="Automatically converts to AD Date"
                disabled={
                  dateConversionState.isConverting &&
                  dateConversionState.field === "appointmentBS"
                }
                endContent={
                  dateConversionState.isConverting &&
                    dateConversionState.field === "appointmentBS" ? (
                    <Spinner size="sm" />
                  ) : appointmentInfo.appointmentBS &&
                    dateConversionState.lastConversion.timestamp > 0 ? (
                    <CheckCircleIcon className="w-4 h-4 text-health-600" />
                  ) : null
                }
                label="Appointment B.S"
                name="appointmentBS"
                placeholder="YYYY/MM/DD"
                type="text"
                value={appointmentInfo.appointmentBS}
                onChange={handleAppointmentInfoChange}
              />
            </div>

            <CustomSearchSelect
              required
              items={patients.map((p) => ({
                id: p.id,
                primary: p.name,
                secondary: `Reg# ${p.regNumber}`,
              }))}
              label="Patient"
              placeholder="Search and select patient"
              value={appointmentInfo.patientId}
              onChange={(id, primary) => {
                setAppointmentInfo((p) => ({ ...p, patientId: id }));
                setPatientSearchInput(primary);
              }}
            />
          </div>
        </div>

        {/* Dynamic Appointment Rows */}
        <div className="bg-surface border border-border-base rounded-2xl shadow-sm overflow-visible">
          <div className="px-5 py-4 border-b border-border-base bg-surface-2/50 rounded-t-2xl flex justify-between items-center">
            <h4 className="font-semibold text-[15px] text-text-main flex items-center gap-2">
              <IoAddOutline className="w-5 h-5 text-primary" />
              Clinician Assignments
            </h4>
            <Button
              size="sm"
              variant="bordered"
              type="button"
              onClick={() => {
                setAppointmentRows((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    clinicianType: "doctor",
                    clinicianId: "",
                    appointmentTypeId: "",
                    startTime: "",
                    endTime: "",
                  },
                ]);
              }}
            >
              + Add Clinician
            </Button>
          </div>

          <div className="p-6 flex flex-col gap-6">
            {appointmentRows.map((row, index) => (
              <div
                key={row.id}
                className="relative p-5 border border-border-base rounded-xl bg-surface-2/30 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4"
              >
                {/* Remove button if more than 1 */}
                {appointmentRows.length > 1 && (
                  <button
                    type="button"
                    className="absolute -top-3 -right-3 w-7 h-7 bg-red-100 text-red-600 rounded-full flex items-center justify-center border border-red-200 hover:bg-red-200 transition-colors z-10"
                    onClick={() => {
                      setAppointmentRows((prev) =>
                        prev.filter((r) => r.id !== row.id),
                      );
                    }}
                  >
                    <IoTrashOutline className="w-4 h-4" />
                  </button>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-text-main">
                    Clinician Type
                  </label>
                  <select
                    className="flex-1 w-full text-[13.5px] px-3 py-1.5 h-[38px] bg-surface border border-border-base rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    value={row.clinicianType}
                    onChange={(e) => {
                      const newType = e.target.value as "doctor" | "expert";
                      setAppointmentRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? { ...r, clinicianType: newType, clinicianId: "" }
                            : r,
                        ),
                      );
                    }}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div className="xl:col-span-1">
                  <CustomSearchSelect
                    required
                    items={
                      row.clinicianType === "doctor"
                        ? doctors
                          .filter((_d: any) => _d.isActive !== false)
                          .map((d) => ({
                            id: d.id,
                            primary: d.name,
                            secondary: d.speciality,
                          }))
                        : experts
                          .filter((_e: any) => _e.isActive !== false)
                          .map((e) => ({
                            id: e.id,
                            primary: e.name,
                            secondary: e.speciality || "Expert",
                          }))
                    }
                    label={`Select ${row.clinicianType === "doctor" ? "Doctor" : "Expert"} *`}
                    placeholder={`Search ${row.clinicianType}...`}
                    value={row.clinicianId}
                    onChange={(id) => {
                      setAppointmentRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, clinicianId: id } : r,
                        ),
                      );
                    }}
                  />
                </div>

                <div className="xl:col-span-1">
                  <CustomSearchSelect
                    required
                    items={appointmentTypes.map((t) => ({
                      id: t.id,
                      primary: t.name,
                      secondary: `NPR ${t.price.toLocaleString()}`,
                    }))}
                    label="Appointment Type *"
                    placeholder="Search type..."
                    value={row.appointmentTypeId}
                    onChange={(id) => {
                      setAppointmentRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, appointmentTypeId: id } : r,
                        ),
                      );
                    }}
                  />
                </div>

                <CustomInput
                  label="Start Time"
                  name={`startTime-${row.id}`}
                  type="time"
                  value={row.startTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setAppointmentRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id ? { ...r, startTime: e.target.value } : r,
                      ),
                    );
                  }}
                />

                <CustomInput
                  label="End Time"
                  name={`endTime-${row.id}`}
                  type="time"
                  value={row.endTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setAppointmentRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id ? { ...r, endTime: e.target.value } : r,
                      ),
                    );
                  }}
                />
              </div>
            ))}

            <div className="mt-2 flex flex-col gap-1.5 w-full">
              <label className="text-[13px] font-medium text-text-main">
                Reason for Visit
              </label>
              <textarea
                className="w-full text-[13.5px] px-3 py-2.5 bg-surface border border-border-base rounded-xl min-h-[80px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main placeholder:text-text-muted/60 transition-all custom-scrollbar"
                name="reason"
                placeholder="Brief description of why the patient is visiting..."
                value={appointmentInfo.reason}
                onChange={handleAppointmentInfoChange}
              />
            </div>

            <div className="mt-2 flex flex-col gap-1.5 w-full">
              <label className="text-[13px] font-medium text-text-main">
                Notes (Optional)
              </label>
              <textarea
                className="w-full text-[13.5px] px-3 py-2.5 bg-surface border border-border-base rounded-xl min-h-[80px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main placeholder:text-text-muted/60 transition-all custom-scrollbar"
                name="notes"
                placeholder="Any additional information..."
                value={appointmentInfo.notes}
                onChange={handleAppointmentInfoChange}
              />
            </div>
          </div>
        </div>

        {/* Existing Appointments Section */}
        {appointmentInfo.appointmentDate && (
          <div className="bg-surface border border-border-base rounded-2xl shadow-sm overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-border-base bg-surface-2/50 flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-[15px] text-text-main flex items-center gap-2">
                  <IoTimeOutline className="w-5 h-5 text-primary" />
                  Existing Appointments
                </h4>
                <p className="text-[12.5px] font-medium text-text-muted mt-0.5">
                  Scheduled for{" "}
                  {new Date(appointmentInfo.appointmentDate).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </p>
              </div>
              {loadingAppointments && <Spinner size="sm" />}
            </div>

            <div className="p-0">
              {loadingAppointments ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="md" />
                </div>
              ) : existingAppointments.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center">
                  <div className="w-12 h-12 mb-3 rounded-full bg-surface-2 border border-border-base flex items-center justify-center text-text-muted">
                    <IoCalendarOutline className="w-6 h-6" />
                  </div>
                  <h3 className="text-[14.5px] font-bold text-text-main mb-1">
                    No appointments scheduled
                  </h3>
                  <p className="text-[13px] font-medium text-text-muted">
                    The schedule is clear for this date.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2/50 border-b border-border-base">
                        <th className="py-2.5 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          Patient
                        </th>
                        <th className="py-2.5 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          Doctor
                        </th>
                        <th className="py-2.5 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          Time
                        </th>
                        <th className="py-2.5 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          Type
                        </th>
                        <th className="py-2.5 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base/50">
                      {existingAppointments.map((app) => {
                        const patName = getPatientNameById(app.patientId);
                        const initials =
                          patName
                            .replace(/[^A-Za-z ]/g, "")
                            .split(" ")
                            .filter((x) => x)
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase() || "?";

                        return (
                          <tr
                            key={app.id}
                            className="hover:bg-surface-2/30 transition-colors"
                          >
                            <td className="py-3 px-5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg border border-border-base bg-surface-2 text-text-muted flex items-center justify-center text-[11px] font-bold">
                                  {initials}
                                </div>
                                <span className="text-[13.5px] font-bold text-text-main">
                                  {patName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-5 whitespace-nowrap text-[13px] font-medium text-text-muted">
                              {getDoctorNameById(app.doctorId)}
                            </td>
                            <td className="py-3 px-5 whitespace-nowrap text-[13px] font-medium text-text-main">
                              {app.startTime ? (
                                formatTime(app.startTime)
                              ) : (
                                <span className="text-text-muted/50 italic">
                                  Not set
                                </span>
                              )}
                              {app.startTime &&
                                app.endTime &&
                                ` - ${formatTime(app.endTime)}`}
                            </td>
                            <td className="py-3 px-5 whitespace-nowrap text-[13px] font-medium text-text-muted">
                              {getAppointmentTypeNameById(
                                app.appointmentTypeId,
                              )}
                            </td>
                            <td className="py-3 px-5 whitespace-nowrap">
                              <span
                                className={`text-[10.5px] font-semibold px-2 py-0.5 rounded border capitalize ${getStatusColor(app.status)}`}
                              >
                                {app.status || "Scheduled"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
