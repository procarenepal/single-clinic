/**
 * Expert Profile Page
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCallOutline,
  IoMailOutline,
  IoIdCardOutline,
  IoCreateOutline,
  IoStatsChartOutline,
  IoCalendarOutline,
  IoPeopleOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoFlagOutline,
  IoBusinessOutline,
  IoCopyOutline,
  IoCheckmarkOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { expertService } from "@/services/expertService";
import { expertCommissionService } from "@/services/expertCommissionService";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { Expert, ExpertCommission, Appointment, Patient } from "@/types/models";
import { addToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";

// Copy to clipboard helper component
const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
      color: "success",
    });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-surface-2 text-text-muted/40 hover:text-primary rounded transition-colors inline-flex items-center justify-center"
      title={`Copy ${label}`}
    >
      {copied ? (
        <IoCheckmarkOutline className="w-3.5 h-3.5 text-success" />
      ) : (
        <IoCopyOutline className="w-3.5 h-3.5" />
      )}
    </button>
  );
};

export default function ExpertProfilePage() {
  const { expertId } = useParams<{ expertId: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser } = useAuthContext();

  const [expert, setExpert] = useState<Expert | null>(null);
  const [commissions, setCommissions] = useState<ExpertCommission[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointmentTypeNames, setAppointmentTypeNames] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  
  const [selectedTab, setSelectedTab] = useState("overview");

  const [globalDateRange, setGlobalDateRange] = useState({
    start: "",
    end: "",
  });

  const [updatingTarget, setUpdatingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [earningsDateRange, setEarningsDateRange] = useState({ start: "", end: "" });

  const [commissionDateRange, setCommissionDateRange] = useState({
    start: "",
    end: "",
  });
  
  const [appointmentDateRange, setAppointmentDateRange] = useState({
    start: "",
    end: "",
  });
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState("all");
  
  const [patientDateRange, setPatientDateRange] = useState({
    start: "",
    end: "",
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] =
    useState<ExpertCommission | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (expertId && clinicId) loadExpertProfile();
  }, [expertId, clinicId]);

  useEffect(() => {
    if (expert) {
      setTargetInput(expert.monthlyTarget?.toString() || "");
    }
  }, [expert]);

  const loadExpertProfile = async () => {
    try {
      setLoading(true);
      const data = await expertService.getExpertById(expertId!);

      if (!data) {
        addToast({
          title: "Error",
          description: "Expert not found.",
          color: "danger",
        });
        navigate("/dashboard/experts");

        return;
      }
      setExpert(data);
      
      const loadTasks = [
        loadCommissions().catch(() => {}),
        loadAppointments().catch(() => {}),
        loadPatients().catch(() => {}),
      ];
      await Promise.allSettled(loadTasks);
    } catch {
      addToast({
        title: "Error",
        description: "Failed to load profile.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCommissions = async () => {
    if (!clinicId || !expertId) return;
    try {
      setCommissionsLoading(true);
      const data = await expertCommissionService.getCommissionsByExpert(
        expertId,
        clinicId,
      );

      setCommissions(data);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const loadAppointments = async () => {
    if (!expertId || !clinicId) return;
    try {
      setAppointmentsLoading(true);
      const data = await appointmentService.getAppointmentsByExpert(expertId);
      setAppointments(data);

      const types = await appointmentTypeService.getAppointmentTypes(clinicId);
      const typeMap: Record<string, string> = {};
      types.forEach((t) => {
        typeMap[t.id] = t.name;
      });
      setAppointmentTypeNames(typeMap);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const loadPatients = async () => {
    if (!expertId) return;
    try {
      setPatientsLoading(true);
      const data = await patientService.getPatientsByExpert(expertId);
      setPatients(data || []);
    } finally {
      setPatientsLoading(false);
    }
  };

  const filteredAppointments = [...appointments]
    .filter((apt) => {
      // Type Filter
      if (appointmentTypeFilter !== "all" && apt.appointmentTypeId !== appointmentTypeFilter) {
        return false;
      }
      
      // Global/Local Date Filter
      const startStr = globalDateRange.start || appointmentDateRange.start;
      const endStr = globalDateRange.end || appointmentDateRange.end;
      if (startStr && endStr) {
        const aptDate = new Date(apt.appointmentDate);
        const start = new Date(startStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endStr);
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
      const startStr = globalDateRange.start || patientDateRange.start;
      const endStr = globalDateRange.end || patientDateRange.end;
      if (startStr && endStr) {
        const patDate = new Date(pat.createdAt);
        const start = new Date(startStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endStr);
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

  const patientNames = patients.reduce((acc, p) => {
    acc[p.id] = p.name;
    return acc;
  }, {} as Record<string, string>);

  const filteredCommissions = [...commissions]
    .filter((comm) => {
      const startStr = globalDateRange.start || commissionDateRange.start;
      const endStr = globalDateRange.end || commissionDateRange.end;
      if (startStr && endStr) {
        const commDate = new Date(comm.createdAt);
        const start = new Date(startStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endStr);
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

  // Business and Target Calculations
  const getCommissionBusiness = (c: ExpertCommission) => {
    const percentage = c.commissionPercentage || 0;
    const amt = c.commissionAmount || 0;
    if (percentage > 0) {
      return (amt * 100) / percentage;
    }
    return c.totalInvoiceAmount || amt;
  };

  const thisMonthBusiness = commissions
    .filter((c) => {
      const date = new Date(c.date || c.createdAt);
      const now = new Date();
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear() &&
        c.status !== "cancelled"
      );
    })
    .reduce((sum, c) => sum + getCommissionBusiness(c), 0);

  const achievementBusiness = commissions
    .filter((c) => {
      if (c.status === "cancelled") return false;
      if (globalDateRange.start && globalDateRange.end) {
        const date = new Date(c.date || c.createdAt);
        const start = new Date(globalDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(globalDateRange.end);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
      } else {
        const date = new Date(c.date || c.createdAt);
        const now = new Date();
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }
    })
    .reduce((sum, c) => sum + getCommissionBusiness(c), 0);

  const filteredCommissionsForEarnings = commissions.filter((c) => {
    if (c.status === "cancelled") return false;
    const startStr = earningsDateRange.start;
    const endStr = earningsDateRange.end;
    if (startStr && endStr) {
      const date = new Date(c.date || c.createdAt);
      const start = new Date(startStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endStr);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    }
    return true;
  });

  const getSelectedRangeBusiness = () => {
    if (earningsDateRange.start && earningsDateRange.end) {
      return filteredCommissionsForEarnings.reduce((sum, c) => sum + getCommissionBusiness(c), 0);
    }
    return thisMonthBusiness;
  };

  const getSelectedRangeCommissionEarned = () => {
    if (earningsDateRange.start && earningsDateRange.end) {
      return filteredCommissionsForEarnings.reduce((sum, c) => sum + c.commissionAmount, 0);
    }
    return expert.totalCommissionEarned || 0;
  };

  const getSelectedRangeCommissionBalance = () => {
    if (earningsDateRange.start && earningsDateRange.end) {
      return filteredCommissionsForEarnings
        .filter(c => c.status === "pending")
        .reduce((sum, c) => sum + (c.commissionAmount - (c.paidAmount || 0)), 0);
    }
    return expert.totalCommissionBalance || 0;
  };

  // Stats for cards (responsive to global date range filter)
  const getFilteredAppointmentsForStats = () => {
    if (!globalDateRange.start || !globalDateRange.end) return appointments;
    const start = new Date(globalDateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(globalDateRange.end);
    end.setHours(23, 59, 59, 999);
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate >= start && aptDate <= end;
    });
  };

  const getFilteredPatientsForStats = () => {
    if (!globalDateRange.start || !globalDateRange.end) return patients;
    const start = new Date(globalDateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(globalDateRange.end);
    end.setHours(23, 59, 59, 999);
    return patients.filter((pat) => {
      const patDate = new Date(pat.createdAt);
      return patDate >= start && patDate <= end;
    });
  };

  const statsAppointments = getFilteredAppointmentsForStats();
  const statsPatients = getFilteredPatientsForStats();

  const totalAppointments = statsAppointments.length;
  const totalPatients = statsPatients.length;
  const upcomingAppointments = statsAppointments.filter((apt) => {
    try {
      return (
        new Date(apt.appointmentDate) > new Date() && apt.status === "scheduled"
      );
    } catch {
      return false;
    }
  }).length;
  const completedAppointments = statsAppointments.filter(
    (apt) => apt.status === "completed",
  ).length;

  const handleUpdateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(targetInput);
    if (isNaN(val) || val < 0) return;
    try {
      setUpdatingTarget(true);
      await expertService.updateExpert(expertId!, { monthlyTarget: val });
      setExpert((prev) => (prev ? { ...prev, monthlyTarget: val } : null));
      addToast({
        title: "Success",
        description: "Monthly target updated.",
        color: "success",
      });
    } catch {
      addToast({
        title: "Error",
        description: "Failed to update target.",
        color: "danger",
      });
    } finally {
      setUpdatingTarget(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCommission) return;
    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) return;

    try {
      setPaymentProcessing(true);
      await expertCommissionService.payCommission(
        selectedCommission.id,
        amount,
        paymentForm.method,
        paymentForm.reference,
        paymentForm.notes,
        currentUser?.uid,
      );
      addToast({
        title: "Success",
        description: "Payment recorded.",
        color: "success",
      });
      loadCommissions();
      setIsPaymentModalOpen(false);
    } catch {
      addToast({
        title: "Error",
        description: "Payment failed.",
        color: "danger",
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  if (loading)
    return (
      <div className="p-12 flex justify-center">
        <Spinner size="md" />
      </div>
    );
  if (!expert)
    return (
      <div className="p-12 text-center text-text-muted">Expert not found.</div>
    );

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="bordered" onClick={() => navigate(-1)}>
            <IoArrowBackOutline />
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Expert Profile
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              View and manage expert information
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            startContent={<IoCreateOutline />}
            variant="bordered"
            onClick={() => navigate(`/dashboard/experts/${expertId}/edit`)}
          >
            Edit
          </Button>
        </div>
      </div>

      {/* Global Date Range Picker */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface border border-border-base rounded-[10px] p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <IoCalendarOutline className="w-5 h-5 text-primary" />
          <span className="text-[13px] font-semibold text-text-main">Filter Profile by Date:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Quick presets */}
          <div className="flex items-center gap-1">
            {[
              {
                label: "Today",
                getRange: () => {
                  const d = new Date();
                  const formatted = d.toISOString().split("T")[0];
                  return { start: formatted, end: formatted };
                },
              },
              {
                label: "This Month",
                getRange: () => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
                  return { start, end };
                },
              },
              {
                label: "Last 30 Days",
                getRange: () => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - 30);
                  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
                },
              },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setGlobalDateRange(preset.getRange())}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-surface-2 hover:bg-primary/5 hover:text-primary border border-border-base transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            className="h-9 px-3 text-[13px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
            value={globalDateRange.start}
            onChange={(e) => setGlobalDateRange(p => ({ ...p, start: e.target.value }))}
          />
          <span className="text-[13px] text-text-muted font-medium">to</span>
          <input
            type="date"
            className="h-9 px-3 text-[13px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
            value={globalDateRange.end}
            onChange={(e) => setGlobalDateRange(p => ({ ...p, end: e.target.value }))}
          />
          {(globalDateRange.start || globalDateRange.end) && (
            <Button
              size="sm"
              variant="bordered"
              color="danger"
              onClick={() => setGlobalDateRange({ start: "", end: "" })}
            >
              Clear Range
            </Button>
          )}
        </div>
      </div>

      {/* Hero Overview */}
      <div className="bg-surface border border-border-base rounded-[10px] shadow-sm p-5 overflow-hidden relative group hover:shadow-md transition-all duration-300">
        {/* Production-grade background aesthetics */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-bl-full pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-gradient-to-tr from-indigo-500/5 via-transparent to-transparent rounded-tr-full pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-center gap-6 relative z-10 w-full">
          {/* Avatar and Main Info Column */}
          <div className="flex items-center gap-4 shrink-0 w-full lg:w-auto">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shrink-0 text-[22px] font-bold text-primary shadow-inner">
              {expert.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[17px] font-bold text-text-main">
                  {expert.name}
                </h2>
                <span
                  className="inline-flex items-center px-2 py-0.5 border rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                >
                  <span className="relative flex h-2 w-2 mr-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Active
                </span>
              </div>
              <p className="text-text-muted font-medium text-[13.5px] mt-0.5 capitalize">
                {expert.speciality}
              </p>
            </div>
          </div>

          {/* Details & Contact Columns */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {/* Badges Column */}
            <div className="flex flex-wrap gap-2 items-center justify-start lg:justify-center">
              <span
                className={`flex items-center gap-1.5 text-[12.5px] font-semibold px-2.5 py-1 rounded border ${
                  expert.expertType === "regular"
                    ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
                    : expert.expertType === "visiting"
                    ? "bg-teal-500/10 text-teal-600 border-teal-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
                }`}
              >
                <IoBusinessOutline className="w-3.5 h-3.5" />
                <span className="capitalize">{expert.expertType}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[12.5px] text-blue-600 font-semibold bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                <IoIdCardOutline className="w-3.5 h-3.5" />
                <span>License: {expert.licenseNumber}</span>
                <CopyButton text={expert.licenseNumber} label="License Number" />
              </span>
              <span className="flex items-center gap-1.5 text-[12.5px] text-indigo-600 font-semibold bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                <IoStatsChartOutline className="w-3.5 h-3.5" />
                Rate: {expert.defaultCommission}%
              </span>
            </div>

            {/* Contact Info Column */}
            <div className="flex flex-col gap-1.5 justify-center md:items-end">
              <span className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-main transition-colors">
                <IoCallOutline className="text-text-muted/50 w-3.5 h-3.5" />
                <span>{expert.phone}</span>
                <CopyButton text={expert.phone} label="Phone Number" />
              </span>
              {expert.email && (
                <span className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-main transition-colors">
                  <IoMailOutline className="text-text-muted/50 w-3.5 h-3.5" />
                  <span>{expert.email}</span>
                  <CopyButton text={expert.email} label="Email Address" />
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

      <div className="bg-surface border border-border-base rounded shadow-none overflow-hidden">
        <div className="flex border-b border-border-base bg-surface-2/30">
          {["overview", "appointments", "patients", "commissions", "target-setting"].map((t) => (
            <button
              key={t}
              className={`px-5 py-3 text-[13.5px] font-semibold capitalize transition-all ${selectedTab === t ? "border-b-2 border-primary text-primary bg-primary/5" : "text-text-muted hover:bg-surface-2 hover:text-text-main"}`}
              onClick={() => setSelectedTab(t)}
            >
              {t.replace("-", " ")}
            </button>
          ))}
        </div>
        <div className="p-6">
          {selectedTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[13.5px]">
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider border-b border-border-base pb-2 text-text-muted text-[11px]">
                  Professional details
                </h3>
                <div className="flex justify-between">
                  <span className="text-text-muted">Speciality</span>
                  <span className="font-semibold text-text-main">
                    {expert.speciality}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Type</span>
                  <span className="font-semibold capitalize text-text-main">
                    {expert.expertType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">License</span>
                  <span className="font-semibold text-text-main">
                    {expert.licenseNumber}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider border-b border-border-base pb-2 text-text-muted text-[11px]">
                  Earnings
                </h3>

                {/* Inline Date Filter */}
                <div className="flex flex-col gap-2 p-3 bg-surface-2/40 border border-border-base/50 rounded-lg mb-4">
                  <div className="text-[11px] font-semibold text-text-muted">Filter Earnings by Date:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="flex-1 h-8 px-2 text-[12px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={earningsDateRange.start}
                      onChange={(e) => setEarningsDateRange(p => ({ ...p, start: e.target.value }))}
                    />
                    <span className="text-[11px] text-text-muted">to</span>
                    <input
                      type="date"
                      className="flex-1 h-8 px-2 text-[12px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={earningsDateRange.end}
                      onChange={(e) => setEarningsDateRange(p => ({ ...p, end: e.target.value }))}
                    />
                    {(earningsDateRange.start || earningsDateRange.end) && (
                      <button
                        className="text-[11px] font-semibold text-red-500 hover:text-red-600 px-1"
                        onClick={() => setEarningsDateRange({ start: "", end: "" })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-text-muted">
                    {earningsDateRange.start && earningsDateRange.end ? "Filtered Business" : "This Month Business"}
                  </span>
                  <span className="font-bold text-primary">
                    NPR {getSelectedRangeBusiness().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">
                    {earningsDateRange.start && earningsDateRange.end ? "Filtered Commission" : "Lifetime Commission"}
                  </span>
                  <span className="font-semibold text-text-main">
                    NPR {getSelectedRangeCommissionEarned().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border-base/50 pt-2 mt-2">
                  <span className="text-text-muted font-medium">
                    {earningsDateRange.start && earningsDateRange.end ? "Filtered Balance" : "Commission Balance"}
                  </span>
                  <span className="font-bold text-success">
                    NPR {getSelectedRangeCommissionBalance().toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {selectedTab === "target-setting" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[16px] font-bold text-text-main">
                  Monthly Target Tracking
                </h3>
              </div>

              {/* Progress Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-border-base p-5 rounded-[10px] shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-green-500/10 text-green-600 rounded-full">
                    <IoStatsChartOutline className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[13px] text-text-muted font-medium">Achievement ({globalDateRange.start && globalDateRange.end ? "Filtered" : "This Month"})</p>
                    <p className="text-stat-sm text-green-600 font-bold mt-1">
                      NPR {achievementBusiness.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="bg-surface border border-border-base p-5 rounded-[10px] shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full">
                    <IoTimeOutline className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[13px] text-text-muted font-medium">Remaining Target</p>
                    <p className="text-stat-sm text-amber-600 font-bold mt-1">
                      NPR {Math.max((expert.monthlyTarget || 0) - achievementBusiness, 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="bg-surface border border-border-base p-5 rounded-[10px] shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-full">
                    <IoFlagOutline className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[13px] text-text-muted font-medium">Total Monthly Target</p>
                    <p className="text-stat-sm text-primary font-bold mt-1">
                      NPR {(expert.monthlyTarget || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-surface border border-border-base p-6 rounded-[10px] shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[14px] font-semibold text-text-main">Target Completion</span>
                  <span className="text-[14px] font-bold text-primary">
                    {expert.monthlyTarget && expert.monthlyTarget > 0
                      ? `${Math.round((achievementBusiness / expert.monthlyTarget) * 100)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="w-full bg-border-base rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${expert.monthlyTarget && expert.monthlyTarget > 0 ? Math.min((achievementBusiness / expert.monthlyTarget) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Set/Update Target Form */}
              <div className="bg-surface border border-border-base p-6 rounded-[10px] shadow-sm max-w-md">
                <h4 className="text-[15px] font-bold text-text-main mb-4">Update Monthly Target</h4>
                <form onSubmit={handleUpdateTarget} className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-[13px] text-text-muted font-semibold">NPR</span>
                    <input
                      type="number"
                      placeholder="Enter monthly target"
                      className="w-full h-10 pl-12 pr-3 text-[13.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      min="0"
                    />
                  </div>
                  <Button
                    type="submit"
                    color="primary"
                    isLoading={updatingTarget}
                    disabled={updatingTarget}
                  >
                    Save Target
                  </Button>
                </form>
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
                    onClick={() => loadAppointments()}
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
                          if (appointmentTypeNames[typeId]) return true;
                          if (typeId === "package-session") return true;
                          if (typeId.length !== 20) return true;
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
                  <p>No appointments found.</p>
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
                    onClick={() => loadPatients()}
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
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-[13.5px] text-text-main">
                          {patient.name}
                        </h4>
                        <div className="text-[12px] text-text-muted mt-0.5 space-x-1">
                          <span>Reg: {patient.regNumber}</span>
                          <span>•</span>
                          <span>
                            {patient.age}
                            {typeof patient.age === "number" ? "y" : ""}
                          </span>
                        </div>
                        <div className="text-[12.5px] font-medium text-text-main mt-1.5 flex items-center gap-1.5">
                          <IoCallOutline className="text-text-muted" />
                          {patient.mobile}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded">
                  <IoPeopleOutline className="text-stat mb-2 text-text-muted/30" />
                  <p>No patients found.</p>
                </div>
              )}
            </div>
          )}

          {selectedTab === "commissions" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-text-main">
                    Commission Records
                  </h3>
                  <Button
                    isLoading={commissionsLoading}
                    size="sm"
                    variant="bordered"
                    onClick={() => loadCommissions()}
                  >
                    Refresh
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
              
              {commissionsLoading ? (
                <Spinner size="sm" />
              ) : filteredCommissions.length === 0 ? (
                <p className="text-text-muted">No commissions found.</p>
              ) : (
                <div className="border border-border-base rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-2 text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Invoice</th>
                        <th className="p-3">Patient</th>
                        <th className="p-3">Service / Source</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-[13px] divide-y divide-border-base/50">
                      {filteredCommissions.map((c) => (
                        <tr key={c.id}>
                          <td className="p-3">#{c.invoiceNumber}</td>
                          <td className="p-3 font-medium text-text-main">
                            {c.patientName}
                          </td>
                          <td className="p-3 text-text-muted">
                            {(c.serviceNames || []).join(", ") ||
                              "Expert Consultation"}
                          </td>
                          <td className="p-3 font-semibold">
                            NPR {c.commissionAmount}
                          </td>
                          <td className="p-3">
                            <Chip
                              color={
                                c.status === "paid" ? "success" : "warning"
                              }
                              size="sm"
                              variant="flat"
                            >
                              {c.status}
                            </Chip>
                          </td>
                          <td className="p-3 text-right">
                            {c.status !== "paid" && (
                              <Button
                                color="primary"
                                size="sm"
                                variant="flat"
                                onClick={() => {
                                  setSelectedCommission(c);
                                  setPaymentForm({
                                    ...paymentForm,
                                    amount: (
                                      c.commissionAmount - (c.paidAmount || 0)
                                    ).toString(),
                                  });
                                  setIsPaymentModalOpen(true);
                                }}
                              >
                                Record Payment
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>Record Commission Payment</ModalHeader>
          <ModalBody className="p-5 flex flex-col gap-4">
            <Input
              fullWidth
              label="Amount to Pay"
              placeholder="0.00"
              startContent={
                <span className="text-text-muted text-[12px] font-semibold">
                  NPR
                </span>
              }
              type="number"
              value={paymentForm.amount}
              variant="bordered"
              onChange={(e: any) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={paymentProcessing}
              onClick={handlePaymentSubmit}
            >
              Save Payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
