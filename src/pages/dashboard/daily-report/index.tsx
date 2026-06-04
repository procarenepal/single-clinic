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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Divider } from "@/components/ui/divider";
import { Chip } from "@/components/ui/chip";
import { Spinner } from "@/components/ui/spinner";
import { addToast } from "@/components/ui/toast";
import { title } from "@/components/primitives";
import { useAuth } from "@/hooks/useAuth";
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
      return dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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
  const { clinicId, userData } = useAuth();
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
  const invoicesCreatedToday = reportData.billing.filter(b => isCreatedOnSelectedDate(b.date));

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
    paidInvoices: invoicesCreatedToday.filter((b) => b.paymentStatus === "paid").length,
    partialInvoices: invoicesCreatedToday.filter((b) => b.paymentStatus === "partial").length,
    unpaidInvoices: invoicesCreatedToday.filter((b) => b.paymentStatus === "unpaid").length,
    totalRevenue: invoicesCreatedToday.reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0,
    ),
    totalCashCollected: reportData.billing.reduce(
      (sum, b) => sum + (b.paidAmount || 0),
      0,
    ),
    totalDue: invoicesCreatedToday.reduce(
      (sum, b) => sum + (b.balanceAmount || 0),
      0,
    ),
  };

  // Branch-wise revenue breakdown: only when viewing all branches (no single branch selected)
  const branchRevenueBreakdown =
    isMultiBranch && isClinicAdmin && branches.length > 0 && !effectiveBranchId
      ? branches
          .map((branch) => {
            // DailyBillingSummary does not carry branchId; use total billing for the overview
            const branchBilling = reportData.billing.filter(b => isCreatedOnSelectedDate(b.date));
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
        {/* Page header — spec: clarity-page-header, clarity-page-title */}
        <div className="clarity-page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Daily Report
              {currentBranchName ? ` — ${currentBranchName}` : ""}
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
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
                  className="h-8 px-2.5 py-0 text-[12px] border border-mountain-200 rounded bg-white text-mountain-700 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 min-w-[140px] mb-[1px]"
                  value={selectedBranchId ?? ""}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                >
                  {/* Main branch = "All branches" in dropdown (aggregate view); other branches listed by name */}
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
            <div className="w-44 shrink-0">
              <Input
                label="Select Date"
                size="md"
                startContent={
                  <IoCalendarOutline className="text-mountain-400" size={18} />
                }
                type="date"
                value={selectedDate}
                onValueChange={setSelectedDate}
              />
            </div>
            <Button
              className="w-[140px]"
              color="success"
              disabled={loading || isExporting}
              isLoading={isExporting}
              size="md"
              startContent={<IoDownloadOutline size={18} />}
              variant="solid"
              onPress={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button
              className="w-[140px]"
              color="primary"
              disabled={loading || isExporting}
              isLoading={isExporting}
              size="md"
              startContent={<IoDocumentTextOutline size={18} />}
              variant="solid"
              onPress={handleExportPDF}
            >
              Export PDF
            </Button>
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
            {/* Summary Statistics — clarity-card, no shadow, KPI 22px per spec */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card
                isPressable
                className="clarity-card cursor-pointer border border-mountain-200"
                onPress={() => navigate("/dashboard/patients")}
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-mountain-400 mb-1">
                        New Patients
                      </p>
                      <p className="text-stat-sm text-mountain-900 leading-none">
                        {summaryStats.totalPatients}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-teal-100 text-teal-700">
                      <IoPeopleOutline size={22} />
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card
                isPressable
                className="clarity-card cursor-pointer border border-mountain-200"
                onPress={() =>
                  navigate(`/dashboard/appointments?date=${selectedDate}`)
                }
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-mountain-400 mb-1">
                        Appointments
                      </p>
                      <p className="text-stat-sm text-mountain-900 leading-none">
                        {summaryStats.totalAppointments}
                      </p>
                      <p className="text-[11px] text-mountain-500 font-medium mt-2">
                        <span className="text-health-600">{summaryStats.completedAppointments} completed</span> &bull; {summaryStats.cancelledAppointments} cancelled
                      </p>
                    </div>
                    <div className="p-2 rounded bg-health-100 text-health-700">
                      <IoMedicalOutline size={22} />
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card
                isPressable
                className="clarity-card cursor-pointer border border-mountain-200"
                onPress={() =>
                  navigate(
                    `/dashboard/appointments-billing?date=${selectedDate}`,
                  )
                }
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 pr-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-mountain-400 mb-1">
                        Total Revenue
                      </p>
                      <p className="text-stat-sm text-mountain-900 leading-none">
                        {formatCurrency(summaryStats.totalRevenue)}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-saffron-100 text-saffron-700 shrink-0">
                      <IoReceiptOutline size={22} />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 text-[10px]">
                    {summaryStats.totalCashCollected > 0 && (
                      <div className="flex justify-between text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100">
                        <span>Collected</span>
                        <span className="font-semibold">{formatCurrency(summaryStats.totalCashCollected)}</span>
                      </div>
                    )}
                    {summaryStats.totalDue > 0 && (
                      <div className="flex justify-between text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100">
                        <span>Due</span>
                        <span className="font-semibold">{formatCurrency(summaryStats.totalDue)}</span>
                      </div>
                    )}
                    {summaryStats.totalCashCollected === 0 && summaryStats.totalDue === 0 && (
                      <span className="text-[10px] text-mountain-400 italic block">No revenue data</span>
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card
                isPressable
                className="clarity-card cursor-pointer border border-mountain-200"
                onPress={() =>
                  navigate(
                    `/dashboard/appointments-billing?date=${selectedDate}`,
                  )
                }
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 pr-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-mountain-400 mb-1">
                        Total Invoices
                      </p>
                      <p className="text-stat-sm text-mountain-900 leading-none">
                        {summaryStats.totalInvoices}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-mountain-100 text-mountain-700 shrink-0">
                      <IoStatsChartOutline size={22} />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 text-[10px]">
                    {summaryStats.paidInvoices > 0 && (
                      <div className="flex justify-between text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100">
                        <span>Paid</span>
                        <span className="font-semibold">{summaryStats.paidInvoices}</span>
                      </div>
                    )}
                    {summaryStats.partialInvoices > 0 && (
                      <div className="flex justify-between text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                        <span>Partial</span>
                        <span className="font-semibold">{summaryStats.partialInvoices}</span>
                      </div>
                    )}
                    {summaryStats.unpaidInvoices > 0 && (
                      <div className="flex justify-between text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100">
                        <span>Unpaid</span>
                        <span className="font-semibold">{summaryStats.unpaidInvoices}</span>
                      </div>
                    )}
                    {summaryStats.totalInvoices === 0 && (
                      <span className="text-[10px] text-mountain-400 italic block">No invoices</span>
                    )}
                  </div>
                </CardBody>
              </Card>

              {/* Cash Collection Widget */}
              <Card
                isPressable
                className="clarity-card cursor-pointer border border-green-200 bg-green-50"
                onPress={() =>
                  navigate(
                    `/dashboard/appointments-billing?date=${selectedDate}`,
                  )
                }
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 pr-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-green-700 mb-1">
                        Cash Collection
                      </p>
                      <p className="text-stat-sm text-green-900 leading-none">
                        {formatCurrency(summaryStats.totalCashCollected)}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-green-200 text-green-800 shrink-0">
                      <IoWalletOutline size={22} />
                    </div>
                  </div>
                  
                  <div>
                    <span className="inline-block text-[9px] font-semibold text-green-800 bg-green-100 px-2 py-1 rounded border border-green-300 uppercase tracking-wider">
                      Actual Received
                    </span>
                  </div>
                </CardBody>
              </Card>
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
                              {formatTime(appointment.startTime, appointment.appointmentDate)}
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
