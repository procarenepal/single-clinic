import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoDocumentTextOutline,
  IoDownloadOutline,
  IoCalendarOutline,
  IoPeopleOutline,
  IoMedicalOutline,
  IoReceiptOutline,
  IoStatsChartOutline,
  IoWalletOutline,
} from "react-icons/io5";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Chip } from "@/components/ui/chip";
import { Spinner } from "@/components/ui/spinner";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import {
  dailyReportService,
  DailyReportData,
} from "@/services/dailyReportService";
import {
  exportDailyReportToExcel,
  exportDailyReportToPDF,
} from "@/utils/reportExports";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { branchService } from "@/services/branchService";
import { Patient, Doctor, AppointmentType, Branch } from "@/types/models";

// Helper function to format date
const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${month}/${day}/${year}`;
};

// Helper function to format time
const formatTime = (time: string | undefined, dateObj?: Date): string => {
  if (!time) {
    if (dateObj) {
      return dateObj.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    return "N/A";
  }
  const [hours, minutes] = time.split(":");

  if (!hours || !minutes) return time;
  const hour24 = parseInt(hours, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? "PM" : "AM";

  return `${hour12}:${minutes} ${ampm}`;
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return `NPR ${Math.round(amount).toLocaleString("en-US")}`;
};

export default function DailyReportPage() {
  const { clinicId, userData } = useAuthContext();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<DailyReportData>({
    patients: [],
    appointments: [],
    billing: [],
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [isExporting, setIsExporting] = useState(false);

  // Branch scope: user's branch or clinic-admin's selection
  const userBranchId = userData?.branchId ?? null;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isMultiBranch, setIsMultiBranch] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const isClinicAdmin =
    userData?.role === "system-owner" || userData?.role === "clinic-admin";
  const effectiveBranchId = userBranchId ?? selectedBranchId ?? undefined;
  const currentBranchName = effectiveBranchId
    ? branches.find((b) => b.id === effectiveBranchId)?.name
    : undefined;

  // Resolve current doctor ID if the user is a doctor
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId || !userData?.email) return;
    if (isClinicAdmin) return;

    (async () => {
      try {
        const doc = await doctorService.getDoctorByEmail(userData.email!);

        if (doc) setCurrentDoctorId(doc.id);
      } catch {
        // non-critical
      }
    })();
  }, [clinicId, userData?.email, isClinicAdmin]);

  // Load supporting data (patients, doctors, appointment types) for display; scope by branch when set
  useEffect(() => {
    const loadSupportingData = async () => {
      if (!clinicId) return;

      try {
        const [patientsData, doctorsData, appointmentTypesData] =
          await Promise.all([
            patientService.getPatientsByClinic(clinicId, effectiveBranchId),
            doctorService.getDoctorsByClinic(clinicId, effectiveBranchId),
            appointmentTypeService.getActiveAppointmentTypesByClinic(clinicId),
          ]);

        setPatients(patientsData);
        setDoctors(doctorsData);
        setAppointmentTypes(appointmentTypesData);
      } catch (error) {
        console.error("Error loading supporting data:", error);
      }
    };

    loadSupportingData();
  }, [clinicId, effectiveBranchId]);

  // Load branches for multi-branch clinic admins (no fixed branch)
  useEffect(() => {
    const loadBranches = async () => {
      if (!clinicId || !isClinicAdmin) return;

      try {
        const multiBranchEnabled =
          await branchService.isMultiBranchEnabled(clinicId);

        setIsMultiBranch(multiBranchEnabled);

        if (multiBranchEnabled) {
          const branchesData = await branchService.getClinicBranches(
            clinicId,
            false,
          );

          setBranches(branchesData);
        }
      } catch (error) {
        console.error("Error loading branches:", error);
      }
    };

    loadBranches();
  }, [clinicId, isClinicAdmin]);

  // Load daily report data when date or branch changes
  useEffect(() => {
    const loadReportData = async () => {
      if (!clinicId || !selectedDate) return;

      setLoading(true);
      try {
        const date = new Date(selectedDate);
        const data = await dailyReportService.getDailyReportData(
          clinicId,
          date,
          effectiveBranchId,
        );

        // Filter data if the user is a doctor
        if (!isClinicAdmin && currentDoctorId) {
          data.appointments = data.appointments.filter(
            (a) => a.doctorId === currentDoctorId,
          );
          data.patients = data.patients.filter(
            (p) => p.doctorId === currentDoctorId,
          );
          // Only show appointment billing for this doctor
          data.billing = data.billing.filter(
            (b) =>
              b.type === "appointment" &&
              doctors.find((d) => d.name === b.doctorName)?.id ===
                currentDoctorId,
          );
        }

        setReportData(data);
      } catch (error) {
        console.error("Error loading daily report data:", error);
        addToast({
          title: "Error",
          description: "Failed to load daily report data. Please try again.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [
    clinicId,
    selectedDate,
    effectiveBranchId,
    isClinicAdmin,
    currentDoctorId,
    doctors,
  ]);

  // Helper functions to get names
  const getPatientNameById = (patientId: string): string => {
    const patient = patients.find((p) => p.id === patientId);

    return patient ? patient.name : "Unknown Patient";
  };

  const getDoctorNameById = (doctorId: string): string => {
    const doctor = doctors.find((d) => d.id === doctorId);

    return doctor ? doctor.name : "Unknown Doctor";
  };

  const getAppointmentTypeNameById = (appointmentTypeId: string): string => {
    const appointmentType = appointmentTypes.find(
      (at) => at.id === appointmentTypeId,
    );

    return appointmentType ? appointmentType.name : "Unknown Type";
  };

  // Helper to check if an invoice was created on the selected date
  const isCreatedOnSelectedDate = (dateObj: Date | string) => {
    const d = new Date(dateObj);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}` === selectedDate;
  };

  // Calculate summary statistics
  const invoicesCreatedToday = reportData.billing.filter((b) =>
    isCreatedOnSelectedDate(b.date),
  );

  const summaryStats = {
    totalPatients: reportData.patients.length,
    totalAppointments: reportData.appointments.length,
    scheduledAppointments: reportData.appointments.filter(
      (a) => a.status === "scheduled",
    ).length,
    completedAppointments: reportData.appointments.filter(
      (a) => a.status === "completed",
    ).length,
    cancelledAppointments: reportData.appointments.filter(
      (a) => a.status === "cancelled",
    ).length,
    totalInvoices: invoicesCreatedToday.length,
    paidInvoices: invoicesCreatedToday.filter((b) => b.paymentStatus === "paid")
      .length,
    partialInvoices: invoicesCreatedToday.filter(
      (b) => b.paymentStatus === "partial",
    ).length,
    unpaidInvoices: invoicesCreatedToday.filter(
      (b) => b.paymentStatus === "unpaid",
    ).length,
    totalRevenue: invoicesCreatedToday.reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0,
    ),
    totalRevenueCollected: invoicesCreatedToday.reduce(
      (sum, b) => sum + (b.paidAmount || 0),
      0,
    ),
    totalCashCollected: invoicesCreatedToday.reduce(
      (sum, b) => sum + (b.paidAmount || 0),
      0,
    ),
    totalDue: invoicesCreatedToday.reduce(
      (sum, b) => sum + (b.balanceAmount || 0),
      0,
    ),
    clinicalRevenue: invoicesCreatedToday
      .filter((b) => b.type === "appointment")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    clinicalRevenueCollected: invoicesCreatedToday
      .filter((b) => b.type === "appointment")
      .reduce((sum, b) => sum + (b.paidAmount || 0), 0),
    clinicalCashCollected: invoicesCreatedToday
      .filter((b) => b.type === "appointment")
      .reduce((sum, b) => sum + (b.paidAmount || 0), 0),
    clinicalDue: invoicesCreatedToday
      .filter((b) => b.type === "appointment")
      .reduce((sum, b) => sum + (b.balanceAmount || 0), 0),
  };

  // Branch-wise revenue breakdown: only when viewing all branches (no single branch selected)
  const branchRevenueBreakdown =
    isMultiBranch && isClinicAdmin && branches.length > 0 && !effectiveBranchId
      ? branches
          .map((branch) => {
            // DailyBillingSummary does not carry branchId; use total billing for the overview
            const branchBilling = reportData.billing.filter((b) =>
              isCreatedOnSelectedDate(b.date),
            );
            const revenue = branchBilling.reduce(
              (sum, b) => sum + (b.totalAmount || 0),
              0,
            );
            const invoiceCount = branchBilling.length;

            return {
              branchId: branch.id,
              branchName: branch.name,
              branchCode: branch.code,
              isMainBranch: branch.isMainBranch,
              revenue,
              invoiceCount,
            };
          })
          .filter((b) => b.revenue > 0 || b.invoiceCount > 0)
      : [];

  // Handle export (pass branchName when report is branch-scoped)
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const date = new Date(selectedDate);

      exportDailyReportToExcel(
        reportData,
        date,
        undefined,
        currentBranchName,
        patients,
        doctors,
        appointmentTypes,
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const date = new Date(selectedDate);

      exportDailyReportToPDF(
        reportData,
        date,
        undefined,
        currentBranchName,
        patients,
        doctors,
        appointmentTypes,
      );
    } catch (error) {
      console.error("Error exporting to PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "scheduled":
        return "primary";
      case "completed":
        return "success";
      case "cancelled":
        return "danger";
      case "no-show":
        return "warning";
      case "in-progress":
        return "secondary";
      default:
        return "default";
    }
  };

  // Get payment status color
  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "success";
      case "partial":
        return "warning";
      case "unpaid":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-base pb-4">
          <div>
            <h1 className="text-[18px] font-bold text-text-main">
              Daily Report
              {currentBranchName ? ` — ${currentBranchName}` : ""}
            </h1>
            <p className="text-[12px] text-text-muted mt-0.5">
              View and export daily statistics for patients, appointments, and
              finance
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {isMultiBranch &&
              isClinicAdmin &&
              !userBranchId &&
              branches.length > 0 && (
                <select
                  className="h-8 px-2.5 py-0 text-[11.5px] border border-border-base rounded-md bg-surface text-text-main focus:outline-none focus:border-primary min-w-[140px]"
                  value={selectedBranchId ?? ""}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                >
                  <option value="">All branches</option>
                  {branches
                    .filter((b) => !b.isMainBranch)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              )}
            <div className="w-40 shrink-0 flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider pl-0.5">
                Date Filter
              </span>
              <div className="relative">
                <IoCalendarOutline className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  className="w-full h-8 pl-8 pr-2.5 text-[11.5px] bg-surface border border-border-base rounded-md text-text-main focus:outline-none focus:border-primary transition-colors"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
            <button
              className="h-8 px-3 rounded-md text-[11.5px] font-semibold bg-success text-white hover:bg-success/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              disabled={loading || isExporting}
              onClick={handleExportExcel}
            >
              <IoDownloadOutline className="w-3.5 h-3.5" />
              {isExporting ? "Exporting..." : "Excel"}
            </button>
            <button
              className="h-8 px-3 rounded-md text-[11.5px] font-semibold bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              disabled={loading || isExporting}
              onClick={handleExportPDF}
            >
              <IoDocumentTextOutline className="w-3.5 h-3.5" />
              {isExporting ? "Exporting..." : "PDF"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner
              color="primary"
              label="Loading daily report..."
              size="lg"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {/* New Patients */}
              <div
                className="bg-surface border border-border-base rounded-md p-3.5 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-sm min-h-[90px]"
                onClick={() => navigate("/dashboard/patients")}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">
                      New Patients
                    </p>
                    <p className="text-[16px] font-bold text-text-main leading-none">
                      {summaryStats.totalPatients}
                    </p>
                  </div>
                  <div className="bg-surface-2 p-1.5 rounded flex items-center justify-center">
                    <IoPeopleOutline className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </div>

              {/* Appointments */}
              <div
                className="bg-surface border border-border-base rounded-md p-3.5 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-sm min-h-[90px]"
                onClick={() =>
                  navigate(`/dashboard/appointments?date=${selectedDate}`)
                }
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">
                      Appointments
                    </p>
                    <p className="text-[16px] font-bold text-text-main leading-none">
                      {summaryStats.totalAppointments}
                    </p>
                  </div>
                  <div className="bg-surface-2 p-1.5 rounded flex items-center justify-center">
                    <IoMedicalOutline className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <p className="text-[9.5px] font-medium text-text-muted flex gap-2">
                  <span className="text-emerald-600 font-semibold">
                    {summaryStats.completedAppointments} completed
                  </span>
                  <span>{summaryStats.cancelledAppointments} cancelled</span>
                </p>
              </div>

              {/* Total Revenue */}
              <div
                className="bg-surface border border-border-base rounded-md p-3.5 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-sm min-h-[90px]"
                onClick={() =>
                  navigate(
                    `/dashboard/appointments-billing?date=${selectedDate}`,
                  )
                }
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">
                      Total Revenue
                    </p>
                    <p className="text-[15px] font-bold text-text-main leading-none">
                      {formatCurrency(summaryStats.totalRevenue)}
                    </p>
                  </div>
                  <div className="bg-surface-2 p-1.5 rounded flex items-center justify-center">
                    <IoReceiptOutline className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="space-y-1 text-[9.5px]">
                  {summaryStats.totalRevenueCollected > 0 && (
                    <div className="flex justify-between items-center bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-medium">
                      <span>Collected</span>
                      <span>
                        {formatCurrency(summaryStats.totalRevenueCollected)}
                      </span>
                    </div>
                  )}
                  {summaryStats.totalDue > 0 && (
                    <div className="flex justify-between items-center bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded font-medium">
                      <span>Due</span>
                      <span>{formatCurrency(summaryStats.totalDue)}</span>
                    </div>
                  )}
                  {summaryStats.totalRevenueCollected === 0 &&
                    summaryStats.totalDue === 0 && (
                      <span className="text-text-muted opacity-60">
                        No revenue data
                      </span>
                    )}
                </div>
              </div>

              {/* Clinical Revenue (Appt & Procedure) */}
              <div
                className="bg-surface border border-border-base rounded-md p-3.5 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-sm min-h-[90px]"
                onClick={() =>
                  navigate(
                    `/dashboard/appointments-billing?date=${selectedDate}`,
                  )
                }
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p
                      className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1"
                      title="Revenue from appointments and procedures (excluding pharmacy and pathology)"
                    >
                      Clinical Revenue
                    </p>
                    <p className="text-[15px] font-bold text-text-main leading-none">
                      {formatCurrency(summaryStats.clinicalRevenue)}
                    </p>
                  </div>
                  <div className="bg-surface-2 p-1.5 rounded flex items-center justify-center">
                    <IoDocumentTextOutline className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="space-y-1 text-[9.5px]">
                  {summaryStats.clinicalRevenueCollected > 0 && (
                    <div className="flex justify-between items-center bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-medium">
                      <span>Collected</span>
                      <span>
                        {formatCurrency(summaryStats.clinicalRevenueCollected)}
                      </span>
                    </div>
                  )}
                  {summaryStats.clinicalDue > 0 && (
                    <div className="flex justify-between items-center bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded font-medium">
                      <span>Due</span>
                      <span>{formatCurrency(summaryStats.clinicalDue)}</span>
                    </div>
                  )}
                  {summaryStats.clinicalRevenueCollected === 0 &&
                    summaryStats.clinicalDue === 0 && (
                      <span className="text-text-muted opacity-60">
                        No revenue data
                      </span>
                    )}
                </div>
              </div>

              {/* Total Invoices */}
              <div
                className="bg-surface border border-border-base rounded-md p-3.5 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-sm min-h-[90px]"
                onClick={() =>
                  navigate(
                    `/dashboard/appointments-billing?date=${selectedDate}`,
                  )
                }
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted mb-1">
                      Total Invoices
                    </p>
                    <p className="text-[16px] font-bold text-text-main leading-none">
                      {summaryStats.totalInvoices}
                    </p>
                  </div>
                  <div className="bg-surface-2 p-1.5 rounded flex items-center justify-center">
                    <IoStatsChartOutline className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="space-y-1 text-[9.5px]">
                  {summaryStats.paidInvoices > 0 && (
                    <div className="flex justify-between items-center bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-medium">
                      <span>Paid</span>
                      <span>{summaryStats.paidInvoices}</span>
                    </div>
                  )}
                  {summaryStats.partialInvoices > 0 && (
                    <div className="flex justify-between items-center bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded font-medium">
                      <span>Partial</span>
                      <span>{summaryStats.partialInvoices}</span>
                    </div>
                  )}
                  {summaryStats.unpaidInvoices > 0 && (
                    <div className="flex justify-between items-center bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded font-medium">
                      <span>Unpaid</span>
                      <span>{summaryStats.unpaidInvoices}</span>
                    </div>
                  )}
                  {summaryStats.totalInvoices === 0 && (
                    <span className="text-text-muted opacity-60">
                      No invoices
                    </span>
                  )}
                </div>
              </div>

              {/* Cash Collection Widget */}
              <div
                className="bg-emerald-50 border border-emerald-200/50 rounded-md p-3.5 flex flex-col justify-between cursor-pointer hover:border-emerald-300 transition-colors shadow-sm min-h-[90px]"
                onClick={() =>
                  navigate(
                    `/dashboard/appointments-billing?date=${selectedDate}`,
                  )
                }
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                      Cash Collection
                    </p>
                    <p className="text-[16px] font-bold text-emerald-900 leading-none">
                      {formatCurrency(summaryStats.totalCashCollected)}
                    </p>
                  </div>
                  <div className="bg-emerald-100 p-1.5 rounded flex items-center justify-center">
                    <IoWalletOutline className="w-4 h-4 text-emerald-700" />
                  </div>
                </div>
                <div>
                  <span className="inline-flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded uppercase tracking-widest">
                    Actual Received
                  </span>
                </div>
              </div>
            </div>

            {/* Branch-wise Revenue Breakdown — only when viewing all branches */}
            {isMultiBranch &&
              isClinicAdmin &&
              !effectiveBranchId &&
              branches.length > 0 && (
                <Card className="clarity-card border border-mountain-200">
                  <CardHeader className="px-3 py-2 border-b border-mountain-100">
                    <div className="flex items-center gap-2">
                      <IoReceiptOutline
                        className="text-mountain-500"
                        size={18}
                      />
                      <h3 className="text-[13px] font-semibold text-mountain-900">
                        Branch-wise Revenue Breakdown
                      </h3>
                    </div>
                  </CardHeader>
                  <Divider className="border-mountain-100" />
                  <CardBody className="p-3">
                    {branchRevenueBreakdown.length === 0 ? (
                      <div className="text-center py-8 text-mountain-500 text-[13px]">
                        No revenue recorded across branches on{" "}
                        {formatDate(selectedDate)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {branchRevenueBreakdown.map((branch) => (
                          <Card
                            key={branch.branchId}
                            className="clarity-card border border-mountain-200 bg-slate-50/50"
                          >
                            <CardBody className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[13px] font-semibold text-mountain-900">
                                      {branch.branchName}
                                    </p>
                                    {branch.isMainBranch && (
                                      <Chip
                                        color="primary"
                                        size="sm"
                                        variant="flat"
                                      >
                                        Main
                                      </Chip>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-mountain-400 mt-0.5">
                                    Code: {branch.branchCode}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[15px] font-bold text-health-600">
                                    {formatCurrency(branch.revenue)}
                                  </p>
                                  <p className="text-[11px] text-mountain-500">
                                    {branch.invoiceCount} invoice
                                    {branch.invoiceCount !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>
                            </CardBody>
                          </Card>
                        ))}
                      </div>
                    )}
                    {branchRevenueBreakdown.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-mountain-100">
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-semibold text-mountain-900">
                            Total Revenue (All Branches)
                          </p>
                          <p className="text-[15px] font-bold text-saffron-600">
                            {formatCurrency(summaryStats.totalRevenue)}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              )}

            {/* Patients Section — clarity-card, clarity-table */}
            <Card className="clarity-card border border-mountain-200">
              <CardHeader className="px-3 py-2 border-b border-mountain-100">
                <div className="flex items-center gap-2">
                  <IoPeopleOutline className="text-mountain-500" size={18} />
                  <h3 className="text-[13px] font-semibold text-mountain-900">
                    New Patients ({reportData.patients.length})
                  </h3>
                </div>
              </CardHeader>
              <Divider className="border-mountain-100" />
              <CardBody className="p-0">
                {reportData.patients.length === 0 ? (
                  <div className="text-center py-8 text-mountain-500 text-[13px]">
                    No patients registered on {formatDate(selectedDate)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="clarity-table min-w-full w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Name
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Reg Number
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Mobile
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Email
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Registration Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.patients.map((patient) => (
                          <tr
                            key={patient.id}
                            className="border-b border-mountain-100 hover:bg-slate-50"
                          >
                            <td className="py-1.5 px-3 text-[13px] text-mountain-900">
                              {patient.name}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {patient.regNumber || "N/A"}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {patient.mobile || "N/A"}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {patient.email || "N/A"}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {formatDate(patient.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Appointments Section — clarity-card, clarity-table */}
            <Card className="clarity-card border border-mountain-200">
              <CardHeader className="px-3 py-2 border-b border-mountain-100">
                <div className="flex items-center gap-2">
                  <IoMedicalOutline className="text-mountain-500" size={18} />
                  <h3 className="text-[13px] font-semibold text-mountain-900">
                    Appointments ({reportData.appointments.length})
                  </h3>
                </div>
              </CardHeader>
              <Divider className="border-mountain-100" />
              <CardBody className="p-0">
                {reportData.appointments.length === 0 ? (
                  <div className="text-center py-8 text-mountain-500 text-[13px]">
                    No appointments scheduled for {formatDate(selectedDate)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="clarity-table min-w-full w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Time
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Patient
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Doctor
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Status
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Type
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.appointments.map((appointment) => (
                          <tr
                            key={appointment.id}
                            className="border-b border-mountain-100 hover:bg-slate-50"
                          >
                            <td className="py-1.5 px-3 text-[13px] text-mountain-900">
                              {formatTime(
                                appointment.startTime,
                                appointment.appointmentDate,
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {getPatientNameById(appointment.patientId)}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {getDoctorNameById(appointment.doctorId)}
                            </td>
                            <td className="py-1.5 px-3">
                              <Chip
                                color={getStatusColor(appointment.status)}
                                size="sm"
                                variant="flat"
                              >
                                {appointment.status}
                              </Chip>
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {getAppointmentTypeNameById(
                                appointment.appointmentTypeId,
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {appointment.reason || "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Finance Section — clarity-card, clarity-table */}
            <Card className="clarity-card border border-mountain-200">
              <CardHeader className="px-3 py-2 border-b border-mountain-100">
                <div className="flex items-center gap-2">
                  <IoReceiptOutline className="text-mountain-500" size={18} />
                  <h3 className="text-[13px] font-semibold text-mountain-900">
                    Finance - Invoices ({reportData.billing.length})
                  </h3>
                </div>
              </CardHeader>
              <Divider className="border-mountain-100" />
              <CardBody className="p-0">
                {reportData.billing.length === 0 ? (
                  <div className="text-center py-8 text-mountain-500 text-[13px]">
                    No invoices generated on {formatDate(selectedDate)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="clarity-table min-w-full w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Invoice Number
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Patient
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Doctor
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Total Amount
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Payment Status
                          </th>
                          <th className="text-left py-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-mountain-500">
                            Invoice Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.billing.map((billing) => (
                          <tr
                            key={billing.id}
                            className="border-b border-mountain-100 hover:bg-slate-50"
                          >
                            <td className="py-1.5 px-3 text-[13px] font-medium text-mountain-900">
                              {billing.invoiceNumber}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {billing.patientName || "N/A"}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {billing.doctorName || "N/A"}
                            </td>
                            <td className="py-1.5 px-3 text-[13px] font-semibold text-mountain-900">
                              {formatCurrency(billing.totalAmount || 0)}
                            </td>
                            <td className="py-1.5 px-3">
                              <Chip
                                color={getPaymentStatusColor(
                                  billing.paymentStatus,
                                )}
                                size="sm"
                                variant="flat"
                              >
                                {billing.paymentStatus}
                              </Chip>
                            </td>
                            <td className="py-1.5 px-3 text-[13px] text-mountain-700">
                              {formatDate(billing.date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
