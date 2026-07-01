/**
 * Doctor Profile Page — Clinic Clarity without HeroUI
 */
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCallOutline,
  IoMailOutline,
  IoIdCardOutline,
  IoBusinessOutline,
  IoCalendarOutline,
  IoPeopleOutline,
  IoCreateOutline,
  IoStatsChartOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoWalletOutline,
  IoCashOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { doctorService } from "@/services/doctorService";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorCommissionService } from "@/services/doctorCommissionService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { Doctor, Appointment, Patient, DoctorCommission } from "@/types/models";
import { addToast } from "@/components/ui/toast";

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
  startContent,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full`}>
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border border-border-base rounded min-h-[38px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10`}
      >
        {startContent && (
          <div className="pl-3 pr-2 text-text-muted/60 font-medium text-[13px]">
            {startContent}
          </div>
        )}
        <input
          className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/40"
          name={name}
          placeholder={placeholder}
          required={required}
          type={type}
          value={value}
          onChange={onChange}
        />
      </div>
      {description && (
        <p className={`text-[11.5px] text-text-muted`}>{description}</p>
      )}
    </div>
  );
}

function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full`}>
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        className={`w-full min-h-[38px] bg-surface border border-border-base text-text-main text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-shadow`}
        required={required}
        value={value}
        onChange={onChange}
      >
        {placeholder && (
          <option disabled hidden value="">
            {placeholder}
          </option>
        )}
        {options.map((opt: any) => (
          <option
            key={opt.value}
            className="bg-surface text-text-main"
            value={opt.value}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ModalShell({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  isDismissable = true,
  hideCloseButton = false,
}: any) {
  if (!isOpen) return null;
  const sizeClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };
  const maxWidth = sizeClasses[size] || "max-w-md";

  const modalRoot = document.body;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={() => isDismissable && onClose()}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`bg-surface border border-border-base rounded-[10px] shadow-2xl w-full ${maxWidth} pointer-events-auto flex flex-col max-h-[90vh]`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-base/50">
            <h3 className="text-[15px] font-bold text-text-main leading-none">
              {title}
            </h3>
            {!hideCloseButton && (
              <button
                className="text-text-muted/60 hover:text-text-main transition-colors"
                onClick={onClose}
              >
                <IoCloseOutline className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto">{children}</div>
        </div>
      </div>
    </>,
    modalRoot,
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function DoctorProfilePage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser } = useAuth();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [appointmentTypeNames, setAppointmentTypeNames] = useState<Record<string, string>>({});
  const [commissions, setCommissions] = useState<DoctorCommission[]>([]);
  const [commissionStats, setCommissionStats] = useState({
    totalCommission: 0,
    paidCommission: 0,
    pendingCommission: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
  });

  const [loading, setLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  const [selectedTab, setSelectedTab] = useState("overview");
  
  // Appointment Filters
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState("all");
  const [appointmentDateRange, setAppointmentDateRange] = useState({
    start: "",
    end: "",
  });
  
  // Patient Filters
  const [patientDateRange, setPatientDateRange] = useState({
    start: "",
    end: "",
  });
  
  // Commission Filters
  const [commissionDateRange, setCommissionDateRange] = useState({
    start: "",
    end: "",
  });

  const [selectedCommission, setSelectedCommission] =
    useState<DoctorCommission | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    if (doctorId && clinicId) loadDoctorProfile();
  }, [doctorId, clinicId]);

  const loadDoctorProfile = async () => {
    if (!doctorId) return;
    try {
      setLoading(true);
      const doctorData = await doctorService.getDoctorById(doctorId);

      if (!doctorData) {
        addToast({
          title: "Error",
          description: "Doctor not found.",
          color: "danger",
        });
        navigate("/dashboard/doctors");

        return;
      }
      setDoctor(doctorData);

      const loadTasks = [
        loadAppointments(doctorId).catch(() => {}),
        loadPatients(doctorId).catch(() => {}),
        loadCommissions(doctorId).catch(() => {}),
      ];

      await Promise.allSettled(loadTasks);
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to load doctor profile.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async (doctorId: string) => {
    try {
      setAppointmentsLoading(true);
      const appointmentsData =
        await appointmentService.getAppointmentsByDoctor(doctorId);

      setAppointments(appointmentsData || []);

      if (appointmentsData && appointmentsData.length > 0) {
        const uniquePatientIds = [
          ...new Set(appointmentsData.map((apt) => apt.patientId)),
        ];
        const patientNamePromises = uniquePatientIds.map(async (patientId) => {
          try {
            const patient = await patientService.getPatientById(patientId);

            return { patientId, name: patient?.name || "Unknown Patient" };
          } catch {
            return { patientId, name: "Unknown Patient" };
          }
        });
        const patientNameResults =
          await Promise.allSettled(patientNamePromises);
        const patientNamesMap: Record<string, string> = {};

        patientNameResults.forEach((result) => {
          if (result.status === "fulfilled")
            patientNamesMap[result.value.patientId] = result.value.name;
        });
        setPatientNames(patientNamesMap);
        
        // Fetch appointment types for names
        if (clinicId) {
          const types = await appointmentTypeService.getAppointmentTypes(clinicId);
          const typeNamesMap: Record<string, string> = {};
          types.forEach(t => {
            typeNamesMap[t.id] = t.name;
          });
          setAppointmentTypeNames(typeNamesMap);
        }
      }
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const loadPatients = async (doctorId: string) => {
    try {
      setPatientsLoading(true);
      let patientsData: Patient[] | null = null;

      if (clinicId) {
        patientsData = await patientService.getPatientsByDoctor(
          clinicId,
          doctorId,
        );
      }
      if (!patientsData || patientsData.length === 0) {
        const appointmentsData =
          await appointmentService.getAppointmentsByDoctor(doctorId);

        if (appointmentsData && appointmentsData.length > 0) {
          const patientIds = [
            ...new Set(appointmentsData.map((apt) => apt.patientId)),
          ];
          const patientPromises = patientIds.map((pid) =>
            patientService.getPatientById(pid),
          );
          const patientResults = await Promise.allSettled(patientPromises);

          patientsData = patientResults
            .filter((r) => r.status === "fulfilled" && r.value !== null)
            .map((r) => (r as PromiseFulfilledResult<Patient>).value);
        }
      }
      setPatients(patientsData || []);
    } finally {
      setPatientsLoading(false);
    }
  };

  const loadCommissions = async (doctorId: string) => {
    if (!clinicId) return;
    try {
      setCommissionsLoading(true);
      const [commissionsData, statsData] = await Promise.all([
        doctorCommissionService.getCommissionsByDoctor(doctorId, clinicId),
        doctorCommissionService.getCommissionStats(doctorId, clinicId),
      ]);

      setCommissions(commissionsData);
      setCommissionStats(statsData);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    setSelectedTab(key);
    if (key === "commission" && doctorId) loadCommissions(doctorId);
  };

  const handlePaymentOpen = (commission: DoctorCommission) => {
    setSelectedCommission(commission);
    setPaymentForm({
      amount: (
        commission.commissionAmount - (commission.paidAmount || 0)
      ).toString(),
      method: "cash",
      reference: "",
      notes: "",
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCommission || !clinicId) return;
    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) {
      addToast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        color: "warning",
      });

      return;
    }
    const remainingAmount =
      selectedCommission.commissionAmount -
      (selectedCommission.paidAmount || 0);

    if (amount > remainingAmount) {
      addToast({
        title: "Excessive Amount",
        description: "Payment cannot exceed remaining amount.",
        color: "warning",
      });

      return;
    }

    try {
      setPaymentProcessing(true);
      await doctorCommissionService.payCommission(
        selectedCommission.id,
        amount,
        paymentForm.method,
        paymentForm.reference || undefined,
        paymentForm.notes || undefined,
        currentUser?.uid,
      );
      addToast({
        title: "Payment Recorded",
        description: `Recorded NPR ${amount.toLocaleString()}`,
        color: "success",
      });
      await loadCommissions(doctorId!);
      setIsPaymentModalOpen(false);
      setSelectedCommission(null);
    } catch {
      addToast({
        title: "Payment Error",
        description: "Failed to record payment.",
        color: "danger",
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => `NPR ${amount.toLocaleString()}`;

  const getCommissionStatusColor = (status: string) => {
    if (status === "paid")
      return "bg-primary/10 text-primary border-primary/20";
    if (status === "pending")
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    if (status === "cancelled")
      return "bg-red-500/10 text-red-600 border-red-500/20";

    return "bg-surface-2 text-text-muted border-border-base";
  };

  const totalAppointments = appointments.length;
  const totalPatients = patients.length;
  const upcomingAppointments = appointments.filter((apt) => {
    try {
      return (
        new Date(apt.appointmentDate) > new Date() && apt.status === "scheduled"
      );
    } catch {
      return false;
    }
  }).length;
  const completedAppointments = appointments.filter(
    (apt) => apt.status === "completed",
  ).length;

  const filteredAppointments = [...appointments]
    .filter((apt) => {
      // Type Filter (using appointmentTypeId now)
      if (appointmentTypeFilter !== "all" && apt.appointmentTypeId !== appointmentTypeFilter) {
        return false;
      }
      
      // Date Filter
      if (appointmentDateRange.start && appointmentDateRange.end) {
        const aptDate = new Date(apt.appointmentDate);
        const start = new Date(appointmentDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(appointmentDateRange.end);
        end.setHours(23, 59, 59, 999);
        if (aptDate < start || aptDate > end) {
          return false;
        }
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.appointmentDate).getTime() -
        new Date(a.appointmentDate).getTime(),
    );
    
  const filteredPatients = [...patients]
    .filter((pat) => {
      if (patientDateRange.start && patientDateRange.end) {
        const patDate = new Date(pat.createdAt);
        const start = new Date(patientDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(patientDateRange.end);
        end.setHours(23, 59, 59, 999);
        if (patDate < start || patDate > end) {
          return false;
        }
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    
  const filteredCommissions = [...commissions]
    .filter((comm) => {
      if (commissionDateRange.start && commissionDateRange.end) {
        const commDate = new Date(comm.createdAt);
        const start = new Date(commissionDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(commissionDateRange.end);
        end.setHours(23, 59, 59, 999);
        if (commDate < start || commDate > end) {
          return false;
        }
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const formatSpeciality = (speciality: string) =>
    speciality
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  if (loading) {
    return (
      <div className="p-2">
        <PageSkeleton />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-surface border border-border-base rounded-[10px] shadow-sm">
        <IoWarningOutline className="text-text-muted/30 text-stat mb-4" />
        <p className="text-text-muted font-medium">Doctor not found.</p>
        <Button className="mt-6" color="primary" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="bordered" onClick={() => navigate(-1)}>
            <IoArrowBackOutline className="w-4 h-4" />
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Doctor Profile
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              View and manage information
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            startContent={<IoCreateOutline className="w-4 h-4" />}
            variant="bordered"
            onClick={() => navigate(`/dashboard/doctors/${doctorId}/edit`)}
          >
            Edit Profile
          </Button>
          <Button
            color="primary"
            startContent={<IoCalendarOutline className="w-4 h-4" />}
            onClick={() =>
              navigate(`/dashboard/appointments?doctorId=${doctorId}`)
            }
          >
            View Appointments
          </Button>
        </div>
      </div>

      {/* Hero Overview */}
      <div className="bg-surface border border-border-base rounded-[10px] shadow-sm p-6 overflow-hidden relative">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10 w-full">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 text-stat font-bold text-primary">
            {doctor.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center md:justify-start">
              <h2 className="text-page-title font-bold text-text-main">
                {doctor.name}
              </h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 border rounded-full text-[12px] font-semibold tracking-wide uppercase ${doctor.isActive ? "bg-primary/10 text-primary border-primary/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}
              >
                <span
                  className={`w-2 h-2 rounded-full mr-1.5 shrink-0 ${doctor.isActive ? "bg-primary" : "bg-red-500"}`}
                />
                {doctor.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-text-muted font-medium text-[15px] mt-1.5">
              {formatSpeciality(doctor.speciality)}
            </p>
            <div className="flex flex-wrap gap-4 mt-4 justify-center md:justify-start">
              <span className="flex items-center gap-1.5 text-[13.5px] text-text-main font-medium bg-surface-2 px-3 py-1.5 rounded border border-border-base/50">
                <IoBusinessOutline className="text-primary" />
                <span className="capitalize">{doctor.doctorType}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[13.5px] text-text-main font-medium bg-surface-2 px-3 py-1.5 rounded border border-border-base/50">
                <IoIdCardOutline className="text-primary" />
                NMC: {doctor.nmcNumber}
              </span>
              <span className="flex items-center gap-1.5 text-[13.5px] text-text-main font-medium bg-surface-2 px-3 py-1.5 rounded border border-border-base/50">
                <IoStatsChartOutline className="text-primary" />
                Rate: {doctor.defaultCommission}%
              </span>
            </div>
            <div className="flex flex-wrap gap-6 mt-4 justify-center md:justify-start">
              <span className="flex items-center gap-2 text-[13.5px] text-text-muted">
                <IoCallOutline className="text-text-muted/40" />
                {doctor.phone}
              </span>
              {doctor.email && (
                <span className="flex items-center gap-2 text-[13.5px] text-text-muted">
                  <IoMailOutline className="text-text-muted/40" />
                  {doctor.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fast Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Patients",
            val: totalPatients,
            icon: <IoPeopleOutline className="w-6 h-6 text-indigo-500" />,
            bg: "bg-indigo-500/5 border-indigo-500/20",
          },
          {
            label: "Total Appt.",
            val: totalAppointments,
            icon: <IoCalendarOutline className="w-6 h-6 text-primary" />,
            bg: "bg-primary/5 border-primary/20",
          },
          {
            label: "Upcoming Appt.",
            val: upcomingAppointments,
            icon: <IoTimeOutline className="w-6 h-6 text-amber-500" />,
            bg: "bg-amber-500/5 border-amber-500/20",
          },
          {
            label: "Completed Appt.",
            val: completedAppointments,
            icon: (
              <IoCheckmarkCircleOutline className="w-6 h-6 text-green-500" />
            ),
            bg: "bg-green-500/5 border-green-500/20",
          },
        ].map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 p-5 rounded-[10px] shadow-sm border bg-surface ${s.bg}`}
          >
            <div className="p-3 bg-surface border border-border-base rounded-full shadow-sm">
              {s.icon}
            </div>
            <div>
              <p className="text-stat-sm text-text-main leading-none">
                {s.val}
              </p>
              <p className="text-[13px] text-text-muted font-medium mt-1">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Data Tabs Container */}
      <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
        <div className="flex border-b border-border-base/50 overflow-x-auto">
          {[
            { key: "overview", label: "Overview" },
            { key: "appointments", label: "Appointments" },
            { key: "patients", label: "Patients" },
            { key: "commission", label: "Commission" },
          ].map((t) => (
            <button
              key={t.key}
              className={`px-5 py-4 text-[14px] font-semibold whitespace-nowrap transition-colors border-b-2 ${
                selectedTab === t.key
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-text-muted hover:text-text-main hover:bg-surface-2"
              }`}
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* TABS CONTENT */}
          {selectedTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-[15px] font-bold text-text-main uppercase tracking-wider mb-4 border-b border-border-base pb-2">
                  Professional details
                </h3>
                <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                  <span className="text-text-muted">Speciality</span>
                  <span className="font-semibold text-text-main">
                    {formatSpeciality(doctor.speciality)}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                  <span className="text-text-muted">Type</span>
                  <span className="font-semibold capitalize text-text-main">
                    {doctor.doctorType}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                  <span className="text-text-muted">NMC License</span>
                  <span className="font-semibold text-text-main">
                    {doctor.nmcNumber}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                  <span className="text-text-muted">Consultation Charge</span>
                  <span className="font-semibold text-text-main">
                    {doctor.consultationCharge !== undefined
                      ? `NPR ${doctor.consultationCharge.toLocaleString()}`
                      : "N NPR"}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] pb-2">
                  <span className="text-text-muted">Default Commission</span>
                  <span className="font-semibold text-text-main">
                    {doctor.defaultCommission}%
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[15px] font-bold text-text-main uppercase tracking-wider mb-4 border-b border-border-base pb-2">
                  System
                </h3>
                <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                  <span className="text-text-muted">Created At</span>
                  <span className="font-semibold text-text-main">
                    {doctor.createdAt.toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] pb-2">
                  <span className="text-text-muted">Last Modified</span>
                  <span className="font-semibold text-text-main">
                    {doctor.updatedAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {selectedTab === "appointments" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-text-main">
                    Appointments
                  </h3>
                  <Button
                    isLoading={appointmentsLoading}
                    size="sm"
                    variant="bordered"
                    onClick={() => loadAppointments(doctorId!)}
                  >
                    Refresh
                  </Button>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-surface-2/50 p-3 rounded-lg border border-border-base">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Type:</span>
                    <select
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={appointmentTypeFilter}
                      onChange={(e) => setAppointmentTypeFilter(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      {[...new Set(appointments.map(a => a.appointmentTypeId).filter(Boolean))]
                        .filter(typeId => {
                          // Keep if it exists in the active appointment types map
                          if (appointmentTypeNames[typeId]) return true;
                          // Keep system types
                          if (typeId === "package-session") return true;
                          // If it's a legacy string like 'initial', 'followup', keep it.
                          // Usually Firestore IDs are exactly 20 characters long.
                          if (typeId.length !== 20) return true;
                          // Otherwise, it's a deleted ID. Don't show it in the dropdown.
                          return false;
                        })
                        .map(typeId => {
                          let displayName = appointmentTypeNames[typeId];
                          if (!displayName) {
                            if (typeId === "package-session") displayName = "Package Session";
                            else {
                              const apt = appointments.find(a => a.appointmentTypeId === typeId);
                              if (apt && apt.appointmentType && apt.appointmentType !== typeId) {
                                displayName = apt.appointmentType.charAt(0).toUpperCase() + apt.appointmentType.slice(1).replace("-", " ");
                              } else {
                                displayName = typeId; // fallback
                              }
                            }
                          }
                          return (
                            <option key={typeId} value={typeId}>{displayName}</option>
                          );
                      })}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="w-4 h-4 text-text-muted" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Date:</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={appointmentDateRange.start}
                      onChange={(e) => setAppointmentDateRange(p => ({ ...p, start: e.target.value }))}
                    />
                    <span className="text-[11px] text-text-muted font-medium">to</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={appointmentDateRange.end}
                      onChange={(e) => setAppointmentDateRange(p => ({ ...p, end: e.target.value }))}
                    />
                    {(appointmentDateRange.start || appointmentDateRange.end || appointmentTypeFilter !== "all") && (
                      <button
                        className="text-[11px] font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-500/10 transition-colors ml-2"
                        onClick={() => {
                          setAppointmentDateRange({ start: "", end: "" });
                          setAppointmentTypeFilter("all");
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {filteredAppointments.length > 0 ? (
                <div className="overflow-x-auto border border-border-base rounded-[10px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border-base">
                        <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                          Patient
                        </th>
                        <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                          Date/Time
                        </th>
                        <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                          Type & Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base/50">
                      {filteredAppointments.map((appointment) => (
                        <tr
                          key={appointment.id}
                          className="hover:bg-surface-2/30"
                        >
                          <td className="px-5 py-3">
                            <div className="font-medium text-[13.5px] text-text-main">
                              {patientNames[appointment.patientId] || "Unknown"}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-[13px] text-text-muted">
                            {appointment.appointmentDate.toLocaleDateString()}{" "}
                            at {appointment.startTime || "N/A"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex px-2 py-0.5 border rounded text-[11px] font-bold tracking-wide uppercase ${
                                  appointment.status === "completed"
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : appointment.status === "scheduled"
                                      ? "bg-primary/10 text-primary border-primary/20"
                                      : appointment.status === "cancelled"
                                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                }`}
                              >
                                {appointment.status}
                              </span>
                              <span className="text-[12px] text-text-muted">
                                {appointmentTypeNames[appointment.appointmentTypeId] || appointment.appointmentType || "Consultation"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded">
                  <IoCalendarOutline className="text-stat mb-2 text-text-muted/30" />
                  <p>No appointments created.</p>
                </div>
              )}
            </div>
          )}

          {selectedTab === "patients" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-text-main">
                    Patients
                  </h3>
                  <Button
                    isLoading={patientsLoading}
                    size="sm"
                    variant="bordered"
                    onClick={() => loadPatients(doctorId!)}
                  >
                    Refresh
                  </Button>
                </div>
                
                {/* Patient Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-surface-2/50 p-3 rounded-lg border border-border-base">
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="w-4 h-4 text-text-muted" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Date:</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={patientDateRange.start}
                      onChange={(e) => setPatientDateRange(p => ({ ...p, start: e.target.value }))}
                    />
                    <span className="text-[11px] text-text-muted font-medium">to</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={patientDateRange.end}
                      onChange={(e) => setPatientDateRange(p => ({ ...p, end: e.target.value }))}
                    />
                    {(patientDateRange.start || patientDateRange.end) && (
                      <button
                        className="text-[11px] font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-500/10 transition-colors ml-2"
                        onClick={() => setPatientDateRange({ start: "", end: "" })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {filteredPatients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="p-4 border border-border-base rounded-[10px] hover:border-primary/50 transition-colors flex items-start gap-4 shadow-sm bg-surface"
                    >
                      <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded flex items-center justify-center font-bold">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-[14px] text-text-main leading-tight">
                          {patient.name}
                        </p>
                        <p className="text-[12px] text-text-muted mt-1">
                          Reg: {patient.regNumber} • {patient.age}y
                        </p>
                        <p className="text-[12.5px] text-text-main font-medium mt-0.5">
                          {patient.mobile || patient.phone}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded-[10px]">
                  <IoPeopleOutline className="text-stat mb-2 text-text-muted/30" />
                  <p>No patients linked.</p>
                </div>
              )}
            </div>
          )}

          {selectedTab === "commission" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    val: formatCurrency(commissionStats.totalCommission),
                    label: "Total Commission",
                    color: "text-blue-500",
                  },
                  {
                    val: formatCurrency(commissionStats.paidCommission),
                    label: "Paid Commission",
                    color: "text-green-500",
                  },
                  {
                    val: formatCurrency(commissionStats.pendingCommission),
                    label: "Pending Commission",
                    color: "text-amber-500",
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="p-5 text-center border border-border-base rounded-[10px] shadow-sm bg-surface-2/50"
                  >
                    <p className={`text-stat-sm leading-none ${s.color}`}>
                      {s.val}
                    </p>
                    <p className="text-[13px] text-text-muted font-medium mt-1">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-text-main">
                    Commission Records
                  </h3>
                  <Button
                    isLoading={commissionsLoading}
                    size="sm"
                    variant="bordered"
                    onClick={() => loadCommissions(doctorId!)}
                  >
                    Refresh Data
                  </Button>
                </div>
                
                {/* Commission Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-surface-2/50 p-3 rounded-lg border border-border-base">
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="w-4 h-4 text-text-muted" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Date:</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={commissionDateRange.start}
                      onChange={(e) => setCommissionDateRange(p => ({ ...p, start: e.target.value }))}
                    />
                    <span className="text-[11px] text-text-muted font-medium">to</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={commissionDateRange.end}
                      onChange={(e) => setCommissionDateRange(p => ({ ...p, end: e.target.value }))}
                    />
                    {(commissionDateRange.start || commissionDateRange.end) && (
                      <button
                        className="text-[11px] font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-500/10 transition-colors ml-2"
                        onClick={() => setCommissionDateRange({ start: "", end: "" })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {filteredCommissions.length > 0 ? (
                <div className="space-y-3">
                  {filteredCommissions.map((commission) => (
                    <div
                      key={commission.id}
                      className="p-4 border border-border-base rounded-[10px] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface shadow-sm hover:border-primary/50"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-[15px] font-mono text-text-main">
                            {commission.invoiceNumber}
                          </span>
                          <span
                            className={`inline-flex px-2 py-0.5 border rounded text-[11px] font-bold tracking-wide uppercase ${getCommissionStatusColor(commission.status)}`}
                          >
                            {commission.status}
                          </span>
                        </div>
                        <p className="text-[13.5px] font-medium text-text-main">
                          {commission.patientName} -{" "}
                          {(commission.serviceNames || []).join(", ")}
                        </p>
                        <p className="text-[12px] text-text-muted mt-1">
                          Rate: {commission.commissionPercentage}% • Invoiced:{" "}
                          {formatCurrency(commission.totalInvoiceAmount)}
                        </p>
                      </div>
                      <div className="text-left md:text-right flex flex-col md:items-end gap-2">
                        <div>
                          <p className="text-[18px] font-bold text-text-main leading-none">
                            {formatCurrency(commission.commissionAmount)}
                          </p>
                          {commission.status === "pending" && (
                            <p className="text-[12px] text-amber-500 font-medium mt-1">
                              Pending:{" "}
                              {formatCurrency(
                                commission.commissionAmount -
                                  (commission.paidAmount || 0),
                              )}
                            </p>
                          )}
                        </div>
                        {commission.status === "pending" && (
                          <Button
                            color="success"
                            size="sm"
                            startContent={<IoCashOutline />}
                            onClick={() => handlePaymentOpen(commission)}
                          >
                            Pay Ext.
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded-[10px]">
                  <IoWalletOutline className="text-stat mb-2 text-text-muted/30" />
                  <p>No commissions attached yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ModalShell
        hideCloseButton={paymentProcessing}
        isDismissable={!paymentProcessing}
        isOpen={isPaymentModalOpen}
        title="Pay Commission"
        onClose={() => setIsPaymentModalOpen(false)}
      >
        <div className="p-6">
          {selectedCommission && (
            <div className="mb-6 p-4 bg-surface-2 border border-border-base rounded-[10px] text-[13.5px]">
              <p>
                <span className="text-text-muted">Invoice:</span>{" "}
                <span className="font-semibold text-text-main">
                  {selectedCommission.invoiceNumber}
                </span>
              </p>
              <p>
                <span className="text-text-muted">Rate:</span>{" "}
                <span className="font-semibold text-text-main">
                  {selectedCommission.commissionPercentage}%
                </span>
              </p>
              <p className="mt-2 text-[15px]">
                <span className="text-text-muted">Pending Amount:</span>{" "}
                <span className="font-bold text-amber-500">
                  {formatCurrency(
                    selectedCommission.commissionAmount -
                      (selectedCommission.paidAmount || 0),
                  )}
                </span>
              </p>
            </div>
          )}

          <div className="space-y-4">
            <CustomInput
              required
              label="Payment Amount"
              startContent="NPR"
              type="number"
              value={paymentForm.amount}
              onChange={(e: any) =>
                setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
              }
            />
            <CustomSelect
              required
              label="Payment Method"
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank_transfer", label: "Bank Transfer" },
                { value: "cheque", label: "Cheque" },
              ]}
              value={paymentForm.method}
              onChange={(e: any) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  method: e.target.value,
                  reference: "",
                }))
              }
            />
            {(paymentForm.method === "bank_transfer" ||
              paymentForm.method === "cheque") && (
              <CustomInput
                label="Reference / Transaction ID"
                value={paymentForm.reference}
                onChange={(e: any) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    reference: e.target.value,
                  }))
                }
              />
            )}
            <CustomInput
              label="Notes (Optional)"
              value={paymentForm.notes}
              onChange={(e: any) =>
                setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border-base/50">
              <Button
                disabled={paymentProcessing}
                variant="bordered"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                color="success"
                disabled={
                  !paymentForm.amount || parseFloat(paymentForm.amount) <= 0
                }
                isLoading={paymentProcessing}
                onClick={handlePaymentSubmit}
              >
                Submit Payment
              </Button>
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
