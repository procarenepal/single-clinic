import React, { useState, useEffect, useMemo } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoPeopleOutline,
  IoCalendarOutline,
  IoWalletOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoMailOutline,
  IoCallOutline,
  IoCreateOutline,
  IoDocumentsOutline,
  IoTrashOutline,
  IoLeafOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
  IoAlertCircleOutline,
  IoShieldCheckmarkOutline,
  IoHourglassOutline,
  IoStatsChartOutline,
  IoSettingsOutline,
} from "react-icons/io5";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);
import {
  format,
  startOfDay,
  subMonths,
  startOfMonth,
  endOfMonth,
  parse,
} from "date-fns";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
// @ts-ignore
import NepaliDate from "nepali-datetime";
import { Card, CardBody } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { Input, Textarea } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { Switch } from "@heroui/switch";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { IoPrintOutline } from "react-icons/io5";

import { LeaveSettingsTab } from "./components/LeaveSettingsTab";

import { FileUploadComponent } from "@/components/FileUploadComponent";
import {
  StaffMember,
  StaffAttendance,
  AccountBill,
  StaffCommission,
  ClinicHoliday,
  LeaveRequest,
  LeaveBalance,
  StaffLeaveAssignment,
  LeaveType,
} from "@/types/models";
import { expertService } from "@/services/expertService";
import { doctorService } from "@/services/doctorService";
import { staffCommissionService } from "@/services/staffCommissionService";
import { accountService } from "@/services/accountService";
import { hrService } from "@/services/hrService";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { printSalarySlip } from "@/utils/salaryPrinting";
import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";
import { clinicService } from "@/services/clinicService";
import { leaveRequestService } from "@/services/leaveRequestService";
import { leaveTypeService } from "@/services/leaveTypeService";

export default function HRPage() {
  const { clinicId, userData, branchId } = useAuthContext();
  const [activeTab, setActiveTab] = useState("directory");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [bills, setBills] = useState<AccountBill[]>([]);
  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);

  // Leave Management state
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leaveFilter, setLeaveFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [leaveSearch, setLeaveSearch] = useState("");
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingLeave, setReviewingLeave] = useState<LeaveRequest | null>(
    null,
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    staffId: "",
    leaveType: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState<{
    name: string;
    date: string;
    type: "paid" | "unpaid";
  }>({ name: "", date: format(new Date(), "yyyy-MM-dd"), type: "paid" });
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false);
  const [absentTarget, setAbsentTarget] = useState<StaffMember | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payrollForm, setPayrollForm] = useState<{
    amount: number;
    paymentMethod: string;
    notes: string;
    selectedMonths: string[];
    paymentType: "regular" | "advance";
    waivedDays: number;
    includeCommission: boolean;
    incentive: number;
    customBonus: number;
    customBonusNotes: string;
    customDeduction: number;
    customDeductionNotes: string;
    applyTax: boolean;
    taxPercentage: number;
  }>({
    amount: 0,
    paymentMethod: "Cash",
    notes: "",
    selectedMonths: [format(new Date(), "MMMM yyyy")],
    paymentType: "regular",
    waivedDays: 0,
    includeCommission: false,
    incentive: 0,
    customBonus: 0,
    customBonusNotes: "",
    customDeduction: 0,
    customDeductionNotes: "",
    applyTax: false,
    taxPercentage: 1,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffCommissions, setStaffCommissions] = useState<StaffCommission[]>(
    [],
  );
  const [payingCommission, setPayingCommission] = useState(false);
  const [isCommissionPayModalOpen, setIsCommissionPayModalOpen] =
    useState(false);
  const [selectedCommission, setSelectedCommission] =
    useState<StaffCommission | null>(null);
  const [commissionPayForm, setCommissionPayForm] = useState({
    amount: 0,
    paymentMethod: "Cash",
    notes: "",
    reference: "",
  });

  const [isPayrollReportModalOpen, setIsPayrollReportModalOpen] =
    useState(false);
  const [reportDateRange, setReportDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [payrollReportFilter, setPayrollReportFilter] = useState("all"); // 'all', 'paid', 'unpaid'

  const availableMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(new Date(), 8 - i);

      return format(date, "MMMM yyyy");
    });
  }, []);

  const [staffForm, setStaffForm] = useState({
    id: "",
    name: "",
    role: "Staff",
    age: "",
    email: "",
    phone: "",
    salary: "",
    joiningDate: format(new Date(), "yyyy-MM-dd"),
    status: "active" as StaffMember["status"],
    address: "",
    photoUrl: "",
    performanceNotes: "",
    taskCompletionScore: "85",
    shiftStartTime: "09:00",
    shiftEndTime: "17:00",
    defaultCommission: "0",
    // Login account fields
    createAccount: false,
    password: "",
    adminPassword: "",
    assignments: [] as StaffLeaveAssignment[],
  });

  const [globalLeaveTypes, setGlobalLeaveTypes] = useState<LeaveType[]>([]);

  useEffect(() => {
    if (!isStaffModalOpen) {
      setStaffForm({
        id: "",
        name: "",
        role: "Staff",
        age: "",
        email: "",
        phone: "",
        salary: "",
        joiningDate: format(new Date(), "yyyy-MM-dd"),
        status: "active",
        address: "",
        photoUrl: "",
        performanceNotes: "",
        taskCompletionScore: "85",
        shiftStartTime: "09:00",
        shiftEndTime: "17:00",
        defaultCommission: "0",
        createAccount: false,
        password: "",
        adminPassword: "",
        assignments: [],
      });
    }
  }, [isStaffModalOpen]);

  const handleEditStaff = async (staff: StaffMember) => {
    let assignments: StaffLeaveAssignment[] = [];

    try {
      const currentYear = new Date().getFullYear();
      const balance = await leaveRequestService.getOrCreateBalance(
        staff.id,
        staff.name,
        clinicId!,
        currentYear,
      );

      assignments = balance.assignments || [];
    } catch (e) {
      console.error("Failed to load staff leave assignments:", e);
    }

    setStaffForm({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      age: staff.age.toString(),
      email: staff.email,
      phone: staff.phone,
      salary: staff.salary.toString(),
      joiningDate: format(new Date(staff.joiningDate), "yyyy-MM-dd"),
      status: staff.status,
      address: staff.address || "",
      photoUrl: staff.photoUrl || "",
      performanceNotes: staff.performanceNotes || "",
      taskCompletionScore: (staff.taskCompletionScore || 85).toString(),
      shiftStartTime: staff.shiftStartTime || "09:00",
      shiftEndTime: staff.shiftEndTime || "17:00",
      defaultCommission: (staff.defaultCommission || 0).toString(),
      createAccount: false,
      password: "",
      adminPassword: "",
      assignments,
    });
    setIsStaffModalOpen(true);
  };

  useEffect(() => {
    if (clinicId) {
      loadData();
      loadLeaves();
    }
  }, [clinicId, branchId]);

  useEffect(() => {
    if (activeTab === "leaves" && clinicId) {
      loadLeaves();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedStaff && clinicId && isDetailModalOpen) {
      loadStaffCommissions(selectedStaff.id);
    }
  }, [selectedStaff, clinicId, isDetailModalOpen]);

  const loadStaffCommissions = async (staffId: string) => {
    try {
      const data = await staffCommissionService.getCommissionsByStaff(
        staffId,
        clinicId!,
      );

      setStaffCommissions(data);
    } catch (error) {
      console.error("Error loading staff commissions:", error);
    }
  };

  const payrollChartData = useMemo(() => {
    const labels = [];
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);

      labels.push(format(d, "MMM yyyy"));

      const monthStart = startOfMonth(d);
      const monthEnd = endOfMonth(d);
      const sum = bills
        .filter(
          (b) =>
            b.category === "salary" &&
            b.billDate >= monthStart &&
            b.billDate <= monthEnd,
        )
        .reduce((a, b) => a + b.paidAmount, 0);

      data.push(sum);
    }

    return {
      labels,
      datasets: [
        {
          label: "Total Salary Disbursed (Rs.)",
          data,
          backgroundColor: "rgba(99, 102, 241, 0.8)",
          borderRadius: 4,
        },
      ],
    };
  }, [bills]);

  const staffPayrollSummary = useMemo(() => {
    const startDate = new Date(reportDateRange.start);

    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(reportDateRange.end);

    endDate.setHours(23, 59, 59, 999);

    return staff
      .map((s) => {
        const staffBills = bills.filter(
          (b) =>
            b.category === "salary" &&
            b.vendorName === s.name &&
            b.billDate >= startDate &&
            b.billDate <= endDate,
        );
        const totalPaid = staffBills.reduce((acc, b) => acc + b.paidAmount, 0);

        const sortedBills = staffBills.sort(
          (a, b) => b.billDate.getTime() - a.billDate.getTime(),
        );

        return {
          ...s,
          totalPaid,
          lastPayment: sortedBills.length > 0 ? sortedBills[0].billDate : null,
          lastBill: sortedBills.length > 0 ? sortedBills[0] : null,
        };
      })
      .filter((s) => {
        if (payrollReportFilter === "paid") return s.totalPaid > 0;
        if (payrollReportFilter === "unpaid") return s.totalPaid === 0;

        return true;
      });
  }, [staff, bills, reportDateRange, payrollReportFilter]);

  const handlePrintPayrollSummary = async () => {
    const printContent = document.getElementById("payroll-summary-report");

    if (!printContent || !clinicId) return;

    // Validate date range
    if (!reportDateRange.start || !reportDateRange.end) {
      addToast({
        title: "Date Range Required",
        description:
          "Please select a valid start and end date before printing.",
        color: "warning",
      });

      return;
    }
    const startDateVal = new Date(reportDateRange.start);
    const endDateVal = new Date(reportDateRange.end);

    if (isNaN(startDateVal.getTime()) || isNaN(endDateVal.getTime())) {
      addToast({
        title: "Invalid Date Range",
        description:
          "The selected dates are invalid. Please re-select and try again.",
        color: "danger",
      });

      return;
    }
    if (staffPayrollSummary.length === 0) {
      addToast({
        title: "No Data to Print",
        description:
          "No payroll records found for the selected date range and filter.",
        color: "warning",
      });

      return;
    }

    let clinicData = null;
    let printConfig = null;

    try {
      clinicData = await clinicService.getClinicById(clinicId);
    } catch (err) {
      console.error("Failed to fetch clinic data", err);
    }

    try {
      printConfig = await clinicService.getPrintLayoutConfig(clinicId);
    } catch (err) {
      console.error("Failed to fetch print layout config", err);
    }

    const effectiveClinic = clinicData || {
      id: clinicId,
      name: "Clinic",
      phone: "",
      email: "",
      address: "",
    };

    const effectiveConfig =
      printConfig ||
      ({
        clinicId,
        primaryColor: "#0ea5e9",
        fontSize: "medium",
        showAddress: true,
        showPhone: true,
        showEmail: true,
        headerHeight: "compact",
      } as any);

    const primaryColor = effectiveConfig.primaryColor || "#0ea5e9";

    const printWindow = window.open("", "_blank");

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Payroll Summary Report</title>
          <style>
            ${getPrintBrandingCSS(effectiveConfig)}
            body { 
              font-family: 'Inter', -apple-system, sans-serif !important; 
              padding: 40px; 
              background: white; 
              color: #0f172a; 
            }
            .report-container {
              max-width: 1000px;
              margin: 0 auto;
            }
            .report-title-section {
              text-align: center;
              margin: 20px 0 30px 0;
            }
            .report-title-section h2 {
              font-family: 'Outfit', sans-serif !important;
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.2em;
              color: #0f172a;
              margin: 0;
              display: inline-block;
              border-bottom: 3px solid ${primaryColor};
              padding-bottom: 6px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
              background: #f8fafc;
              padding: 20px 30px;
              border-radius: 4px;
              border: 1px solid #e2e8f0;
              position: relative;
            }
            .info-grid::before {
              content: '';
              position: absolute;
              left: 0;
              top: 0;
              bottom: 0;
              width: 4px;
              background: ${primaryColor};
              opacity: 0.3;
            }
            .info-item {
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            .info-label {
              font-size: 9px;
              font-weight: 800;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.12em;
            }
            .info-value {
              font-family: 'Outfit', sans-serif !important;
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
            }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 40px; }
            th { 
              background: ${primaryColor}; 
              text-align: left; 
              padding: 12px 15px; 
              font-size: 10px; 
              font-weight: 800; 
              text-transform: uppercase; 
              color: white; 
              letter-spacing: 0.15em; 
            }
            td { 
              padding: 15px 15px; 
              border-bottom: 1px solid #f1f5f9; 
              font-size: 12px; 
              color: #334155; 
              font-weight: 500; 
            }
            .amount, th[style*="text-align: right"] { text-align: right; }
            td[style*="text-align: right"] { text-align: right; font-family: 'Outfit', sans-serif !important; font-weight: 700; }
            .total-row { background: #f8fafc; font-weight: 800; border-top: 2px solid ${primaryColor}; }
            .total-row td { font-size: 14px; font-weight: 800; color: #0f172a; }
            .signature-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 150px;
              margin-top: 60px;
              padding: 0 40px;
            }
            .signature-box {
              border-top: 2px solid #e2e8f0;
              padding-top: 15px;
              text-align: center;
              font-size: 9.5px;
              font-weight: 800;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.15em;
            }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tbody tr { page-break-inside: avoid; }
            .total-row { page-break-inside: avoid; }
            .signature-section { page-break-inside: avoid; }
            .info-grid { page-break-inside: avoid; }
            @media print {
              @page { margin: 1.5cm; }
              body { background: white; padding: 0; }
              .no-print { display: none; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              tbody tr { page-break-inside: avoid; }
              th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .total-row { page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .signature-section { page-break-inside: avoid; margin-top: 40px; }
              .report-container { max-width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            ${getPrintHeaderHTML(effectiveConfig, effectiveClinic as any)}
            
            <div class="report-title-section">
              <h2>Staff Payroll Summary</h2>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Report Period</span>
                <span class="info-value">${format(new Date(reportDateRange.start), "MMM dd, yyyy")} - ${format(new Date(reportDateRange.end), "MMM dd, yyyy")}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Staff Filter</span>
                <span class="info-value">${payrollReportFilter === "all" ? "All Staff" : payrollReportFilter === "paid" ? "Paid Only" : "Unpaid Only"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Generated On</span>
                <span class="info-value">${format(new Date(), "PPP")}</span>
              </div>
            </div>

            ${printContent.innerHTML}
            
            <div class="signature-section">
              <div class="signature-box">Accountant / HR Authorization</div>
              <div class="signature-box">Manager / MD Authorization</div>
            </div>
            
            ${getPrintFooterHTML(effectiveConfig)}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => { 
                window.print();
                setTimeout(() => { window.close(); }, 500);
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const fiveYearsAgo = new Date();

      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const [staffData, attendanceData, billsData, typesData] =
        await Promise.all([
          hrService.getStaffByClinic(clinicId!, branchId || undefined),
          hrService.getAttendanceByRange(
            clinicId!,
            startOfDay(fiveYearsAgo),
            new Date(),
            branchId || undefined,
          ),
          accountService.getBillsByClinic(clinicId!, branchId || undefined),
          leaveTypeService.getLeaveTypes(clinicId!),
        ]);

      setStaff(staffData);
      setGlobalLeaveTypes(typesData);
      setAttendance(attendanceData);
      setBills(billsData);
    } catch (error) {
      console.error("Error loading HR data:", error);
      addToast({
        title: "Error",
        description: "Failed to load staff records",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLeaves = async () => {
    if (!clinicId) return;
    setLeavesLoading(true);
    try {
      const [requests, balances] = await Promise.all([
        leaveRequestService.getLeavesByClinic(clinicId!, branchId || undefined),
        leaveRequestService.getAllBalancesForClinic(
          clinicId!,
          new Date().getFullYear(),
        ),
      ]);

      setLeaveRequests(requests);
      setLeaveBalances(balances);
    } catch (error) {
      console.error("Error loading leave data:", error);
      addToast({
        title: "Error",
        description: "Failed to load leave records",
        color: "danger",
      });
    } finally {
      setLeavesLoading(false);
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetStaff = staff.find((s) => s.id === leaveForm.staffId);

    if (!targetStaff || !leaveForm.reason) {
      addToast({
        title: "Validation Error",
        description: "Select a staff member and provide a reason.",
        color: "warning",
      });

      return;
    }
    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);

    if (end < start) {
      addToast({
        title: "Invalid Dates",
        description: "End date must be on or after start date.",
        color: "warning",
      });

      return;
    }
    const totalDays =
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

    setLeaveSubmitting(true);
    try {
      await leaveRequestService.createLeaveRequest({
        staffId: targetStaff.id,
        staffName: targetStaff.name,
        staffRole: targetStaff.role,
        clinicId: clinicId!,
        branchId: branchId || "",
        leaveType: leaveForm.leaveType,
        isPaid:
          globalLeaveTypes.find((t) => t.id === leaveForm.leaveType)?.isPaid ??
          false,
        startDate: start,
        endDate: end,
        totalDays,
        reason: leaveForm.reason,
      });
      addToast({
        title: "Leave Submitted",
        description: `${totalDays}-day leave request created for ${targetStaff.name}.`,
        color: "success",
      });
      setIsLeaveModalOpen(false);
      setLeaveForm({
        staffId: "",
        leaveType: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
        reason: "",
      });
      loadLeaves();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to submit leave request.",
        color: "danger",
      });
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleApproveLeave = async () => {
    if (!reviewingLeave || !userData) return;
    setReviewLoading(true);
    try {
      await leaveRequestService.approveLeave(
        reviewingLeave.id,
        userData.id || "",
        userData.displayName || "Admin",
        reviewNotes,
      );
      addToast({
        title: "Leave Approved",
        description: `${reviewingLeave.staffName}'s leave has been approved.`,
        color: "success",
      });
      setIsReviewModalOpen(false);
      setReviewNotes("");
      loadLeaves();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to approve leave.",
        color: "danger",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleRejectLeave = async () => {
    if (!reviewingLeave || !reviewNotes.trim()) {
      addToast({
        title: "Note Required",
        description: "Please provide a reason for rejection.",
        color: "warning",
      });

      return;
    }
    if (!userData) return;
    setReviewLoading(true);
    try {
      await leaveRequestService.rejectLeave(
        reviewingLeave.id,
        userData.id || "",
        userData.displayName || "Admin",
        reviewNotes,
      );
      addToast({
        title: "Leave Rejected",
        description: `${reviewingLeave.staffName}'s request has been rejected.`,
        color: "warning",
      });
      setIsReviewModalOpen(false);
      setReviewNotes("");
      loadLeaves();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to reject leave.",
        color: "danger",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    try {
      await leaveRequestService.cancelLeave(leaveId);
      addToast({
        title: "Cancelled",
        description: "Leave request has been cancelled.",
        color: "success",
      });
      loadLeaves();
    } catch {
      addToast({
        title: "Error",
        description: "Failed to cancel leave.",
        color: "danger",
      });
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name || !staffForm.role || !staffForm.salary) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        color: "warning",
      });

      return;
    }

    setSaving(true);
    try {
      const staffData = {
        ...staffForm,
        age: parseInt(staffForm.age) || 0,
        salary: parseFloat(staffForm.salary),
        joiningDate: new Date(staffForm.joiningDate),
        taskCompletionScore: parseInt(staffForm.taskCompletionScore) || 85,
        performanceNotes: staffForm.performanceNotes,
        shiftStartTime: staffForm.shiftStartTime,
        shiftEndTime: staffForm.shiftEndTime,
        defaultCommission: parseFloat(staffForm.defaultCommission) || 0,
        clinicId: clinicId!,
        branchId: branchId || "",
        createdBy: userData?.id || "",
      };

      let newStaffId = "";

      if (staffForm.id) {
        await hrService.updateStaff(staffForm.id, staffData);

        // Sync updates to doctor/expert if applicable
        if (staffForm.role === "Doctor") {
          const docMatch = await doctorService.getDoctorByEmail(
            staffForm.email,
            clinicId!,
          );

          if (docMatch) {
            await doctorService.updateDoctor(docMatch.id, {
              name: staffForm.name,
              defaultCommission: parseFloat(staffForm.defaultCommission) || 0,
              phone: staffForm.phone,
            });
          }
        } else if (staffForm.role === "Expert") {
          const expertsList = await expertService.getExpertsByClinic(clinicId!);
          const expMatch = expertsList.find(
            (e) => e.email?.toLowerCase() === staffForm.email.toLowerCase(),
          );

          if (expMatch) {
            await expertService.updateExpert(expMatch.id, {
              name: staffForm.name,
              defaultCommission: parseFloat(staffForm.defaultCommission) || 0,
              phone: staffForm.phone,
            });
          }
        }

        addToast({
          title: "Success",
          description: "Staff record updated successfully",
          color: "success",
        });
      } else {
        newStaffId = await hrService.createStaff(staffData);

        // Sync creation to doctor/expert collections
        if (staffForm.role === "Doctor") {
          await doctorService.createDoctor({
            name: staffForm.name,
            doctorType: "regular",
            defaultCommission: parseFloat(staffForm.defaultCommission) || 0,
            speciality: "Dermatology",
            phone: staffForm.phone,
            email: staffForm.email.toLowerCase(),
            nmcNumber: "NMC-Pending",
            clinicId: clinicId!,
            branchId: branchId || clinicId!,
            isActive: true,
            createdBy: userData?.id || "",
          });
        } else if (staffForm.role === "Expert") {
          await expertService.createExpert({
            name: staffForm.name,
            expertType: "regular",
            defaultCommission: parseFloat(staffForm.defaultCommission) || 0,
            speciality: "Skin & Laser Therapy Specialist",
            phone: staffForm.phone,
            email: staffForm.email.toLowerCase(),
            licenseNumber: "LIC-Pending",
            clinicId: clinicId!,
            branchId: branchId || clinicId!,
            isActive: true,
            createdBy: userData?.id || "",
          });
        }

        // If createAccount is checked, also create a login user
        if (staffForm.createAccount) {
          if (!staffForm.password || !staffForm.adminPassword) {
            throw new Error(
              "Password and Admin confirmation are required for account creation.",
            );
          }

          const { userService } = await import("@/services/userService");

          await userService.createUser(
            staffForm.email,
            staffForm.password,
            {
              displayName: staffForm.name,
              role: staffForm.role === "Admin" ? "clinic-admin" : "staff",
              clinicId: clinicId!,
              branchId: branchId || "",
            },
            staffForm.adminPassword,
          );
          addToast({
            title: "Account Created",
            description: "Login credentials have been set up.",
            color: "success",
          });
        }

        addToast({
          title: "Success",
          description: "Staff member registered successfully",
          color: "success",
        });
      }

      // Sync leave assignments
      try {
        const finalStaffId = staffForm.id || newStaffId;
        const currentYear = new Date().getFullYear();

        if (finalStaffId) {
          const balance = await leaveRequestService.getOrCreateBalance(
            finalStaffId,
            staffForm.name,
            clinicId!,
            currentYear,
          );

          await leaveRequestService.updateBalance(balance.id, {
            assignments: staffForm.assignments,
          });
        }
      } catch (err) {
        console.error("Failed to sync leave assignments:", err);
      }

      setIsStaffModalOpen(false);
      loadData();
      setStaffForm({
        id: "",
        name: "",
        role: "Staff",
        age: "",
        email: "",
        phone: "",
        salary: "",
        joiningDate: format(new Date(), "yyyy-MM-dd"),
        status: "active",
        address: "",
        photoUrl: "",
        performanceNotes: "",
        taskCompletionScore: "85",
        shiftStartTime: "09:00",
        shiftEndTime: "17:00",
        defaultCommission: "0",
        createAccount: false,
        password: "",
        adminPassword: "",
        assignments: [],
      });
    } catch (error) {
      console.error("Error saving staff:", error);
      addToast({
        title: "Error",
        description: "Failed to save staff record",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const getPreviouslyPaid = (months: string[]) => {
    if (!selectedStaff || !bills) return 0;

    return bills
      .filter(
        (b) => b.category === "salary" && b.vendorName === selectedStaff.name,
      )
      .filter((b) => months.some((m) => b.description?.includes(m)))
      .reduce((sum, b) => sum + b.paidAmount, 0);
  };

  const getLeaveDetails = (months: string[]) => {
    if (!selectedStaff) {
      return {
        absentDays: 0,
        absentDates: [],
        unpaidLeaves: 0,
        dailyWage: 0,
        deductionAmount: 0,
      };
    }

    // Get all approved leave requests for the selected staff member
    const approvedLeaves = leaveRequests.filter(
      (l) => l.staffId === selectedStaff.id && l.status === "approved",
    );

    let absentDatesList: string[] = [];
    let unpaidLeavesCount = 0;

    for (const req of approvedLeaves) {
      // Loop through each day of the leave request
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      let current = new Date(start);

      while (current <= end) {
        const monthStr = format(current, "MMMM yyyy");

        if (months.includes(monthStr)) {
          // Skip if it's a paid holiday
          const isPaidHoliday = holidays.some(
            (h) =>
              format(h.date, "yyyy-MM-dd") === format(current, "yyyy-MM-dd") &&
              (h.type === "paid" || !h.type),
          );

          if (!isPaidHoliday) {
            absentDatesList.push(format(current, "MMM dd"));
            if (!req.isPaid) {
              unpaidLeavesCount++;
            }
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Catch any unexcused absences (marked absent in attendance log, but no approved leave request)
    const unexcusedAbsences = attendance.filter((a) => {
      const isAbsent = a.status === "absent";
      const isSelectedStaff = a.staffId === selectedStaff.id;
      const isSelectedMonth = months.includes(format(a.date, "MMMM yyyy"));
      const isPaidHoliday = holidays.some(
        (h) =>
          format(h.date, "yyyy-MM-dd") === format(a.date, "yyyy-MM-dd") &&
          (h.type === "paid" || !h.type),
      );

      const coveredByLeave = approvedLeaves.some((req) => {
        const reqStart = new Date(req.startDate);
        const reqEnd = new Date(req.endDate);

        reqStart.setHours(0, 0, 0, 0);
        reqEnd.setHours(23, 59, 59, 999);

        return a.date >= reqStart && a.date <= reqEnd;
      });

      return (
        isAbsent &&
        isSelectedStaff &&
        isSelectedMonth &&
        !isPaidHoliday &&
        !coveredByLeave
      );
    });

    for (const a of unexcusedAbsences) {
      absentDatesList.push(format(a.date, "MMM dd"));
      unpaidLeavesCount++;
    }

    // Calculate precise daily wage based on exact days in the selected Nepali BS months
    const totalDaysInSelectedMonths = months.reduce((total, monthStr) => {
      const date = parse(monthStr, "MMMM yyyy", new Date());
      const nd = new NepaliDate(date);

      return total + NepaliDate.getDaysOfMonth(nd.getYear(), nd.getMonth());
    }, 0);

    const averageDaysInMonth =
      months.length > 0 ? totalDaysInSelectedMonths / months.length : 30;
    const dailyWage = (selectedStaff.salary || 0) / averageDaysInMonth;

    return {
      absentDays: absentDatesList.length,
      absentDates: absentDatesList,
      unpaidLeaves: unpaidLeavesCount,
      dailyWage,
      deductionAmount: Math.round(unpaidLeavesCount * dailyWage),
    };
  };

  const calculateExpectedAmount = (
    months: string[],
    type: "regular" | "advance",
    waivedDays: number,
  ) => {
    if (type === "advance") return 0;
    const baseExpected = (selectedStaff?.salary || 0) * (months.length || 1);
    const previouslyPaid = getPreviouslyPaid(months);
    const leaveDetails = getLeaveDetails(months);
    const effectiveUnpaidLeaves = Math.max(
      0,
      leaveDetails.unpaidLeaves - waivedDays,
    );
    const leaveDeductions = Math.round(
      effectiveUnpaidLeaves * leaveDetails.dailyWage,
    );

    return Math.max(0, baseExpected - previouslyPaid - leaveDeductions);
  };

  const getIncentivesPaid = (staffName: string) => {
    return bills
      .filter((b) => b.category === "salary" && b.vendorName === staffName)
      .reduce((acc, b) => {
        const desc = b.description || "";
        const match = desc.match(/Incentive\s+Rs\.?\s*([\d,]+)/i);

        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ""));

          if (!isNaN(val)) return acc + val;
        }

        return acc;
      }, 0);
  };

  const getTaxPaid = (staffName: string) => {
    return bills
      .filter((b) => b.category === "salary" && b.vendorName === staffName)
      .reduce((acc, b) => {
        const desc = b.description || "";
        const match = desc.match(/Tax\s+Rs\.?\s*([\d,]+)/i);

        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ""));

          if (!isNaN(val)) return acc + val;
        }

        return acc;
      }, 0);
  };

  const handleDisburseSalary = async () => {
    if (!selectedStaff) return;
    try {
      const baseExpected =
        (selectedStaff.salary || 0) * (payrollForm.selectedMonths.length || 1);
      const previouslyPaid = getPreviouslyPaid(payrollForm.selectedMonths);

      if (
        payrollForm.paymentType === "regular" &&
        previouslyPaid >= baseExpected
      ) {
        addToast({
          title: "Already Paid",
          description:
            "The salary for the selected month(s) has already been fully paid.",
          color: "warning",
        });

        return;
      }

      const pendingCommission = payrollForm.includeCommission
        ? selectedStaff.totalCommissionBalance || 0
        : 0;
      const incentiveAmt = Number(payrollForm.incentive) || 0;
      const customBonusAmt = Number(payrollForm.customBonus) || 0;
      const customDeductionAmt = Number(payrollForm.customDeduction) || 0;

      const subTotal =
        Number(payrollForm.amount) +
        pendingCommission +
        incentiveAmt +
        customBonusAmt;
      const taxAmt = payrollForm.applyTax
        ? Math.round(
            Number(payrollForm.amount) * (payrollForm.taxPercentage / 100),
          )
        : 0;
      const totalPayout = subTotal - taxAmt - customDeductionAmt;

      const isAdvance =
        payrollForm.paymentType === "advance" ||
        payrollForm.selectedMonths.some((monthStr) => {
          const d = parse(monthStr, "MMMM yyyy", new Date());
          const now = new Date();

          return (
            d.getFullYear() > now.getFullYear() ||
            (d.getFullYear() === now.getFullYear() &&
              d.getMonth() > now.getMonth())
          );
        });

      const bill: Omit<AccountBill, "id" | "createdAt" | "updatedAt"> = {
        category: "salary",
        vendorName: selectedStaff.name,
        billNumber: `PAY-${Date.now().toString().slice(-6)}`,
        billDate: new Date(),
        totalAmount: totalPayout,
        paidAmount: totalPayout,
        dueAmount: 0,
        paymentStatus: "paid",
        paymentMethod: payrollForm.paymentMethod,
        description: `${isAdvance ? "Advance Salary" : "Salary"} for ${payrollForm.selectedMonths.join(", ")}${pendingCommission > 0 ? ` + Commission Rs. ${pendingCommission.toLocaleString()}` : ""}${incentiveAmt > 0 ? ` + Incentive Rs. ${incentiveAmt.toLocaleString()}` : ""}${customBonusAmt > 0 ? ` + Bonus Rs. ${customBonusAmt.toLocaleString()} (${payrollForm.customBonusNotes})` : ""}${taxAmt > 0 ? ` - Tax Rs. ${taxAmt.toLocaleString()}` : ""}${customDeductionAmt > 0 ? ` - Deduction Rs. ${customDeductionAmt.toLocaleString()} (${payrollForm.customDeductionNotes})` : ""}. ${payrollForm.notes}`,
        clinicId: clinicId!,
        branchId: branchId || "",
        createdBy: userData?.id || "",
      };

      await accountService.createBill(bill);

      // If commission is included, mark all pending commissions as paid
      if (payrollForm.includeCommission && pendingCommission > 0) {
        const pendingCommissions = staffCommissions.filter(
          (c) => c.status === "pending",
        );

        await Promise.all(
          pendingCommissions.map((c) =>
            staffCommissionService.payCommission(
              c.id,
              c.commissionAmount - (c.paidAmount || 0),
              payrollForm.paymentMethod,
              undefined,
              `Included in salary payment ${payrollForm.selectedMonths.join(", ")}`,
              userData?.id || "system",
            ),
          ),
        );
      }

      addToast({
        title: "Success",
        description: `Salary disbursed successfully.${pendingCommission > 0 ? ` Included Commission: Rs. ${pendingCommission.toLocaleString()}.` : ""}${incentiveAmt > 0 ? ` Included Incentive: Rs. ${incentiveAmt.toLocaleString()}.` : ""}${payrollForm.applyTax ? ` Deducted Tax: Rs. ${Math.round(Number(payrollForm.amount) * (payrollForm.taxPercentage / 100)).toLocaleString()}.` : ""}`,
        color: "success",
      });
      setIsPayModalOpen(false);
      loadData();
      if (selectedStaff) loadStaffCommissions(selectedStaff.id);
    } catch (error) {
      console.error("Failed to disburse salary:", error);
      addToast({
        title: "Error",
        description: "Failed to disburse salary",
        color: "danger",
      });
    }
  };

  const handlePayStaffCommission = async () => {
    if (!selectedCommission || !selectedStaff) return;
    setPayingCommission(true);
    try {
      await staffCommissionService.payCommission(
        selectedCommission.id,
        commissionPayForm.amount,
        commissionPayForm.paymentMethod,
        commissionPayForm.reference,
        commissionPayForm.notes,
        userData?.id || "",
      );
      addToast({
        title: "Success",
        description: "Commission paid successfully",
        color: "success",
      });
      setIsCommissionPayModalOpen(false);
      loadStaffCommissions(selectedStaff.id);
      loadData(); // Refresh staff list to update balances
    } catch (error) {
      console.error("Failed to pay commission:", error);
      addToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to pay commission",
        color: "danger",
      });
    } finally {
      setPayingCommission(false);
    }
  };

  const handleClockOut = async (member: StaffMember) => {
    try {
      const activeAttendance = attendance.find(
        (a) =>
          a.staffId === member.id &&
          a.status !== "absent" &&
          format(a.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
      );

      if (!activeAttendance) return;

      await hrService.updateAttendance(activeAttendance.id, {
        checkOut: new Date(),
      });
      loadData();
      addToast({
        title: "Clocked Out",
        description: `${member.name} has clocked out`,
        color: "success",
      });
    } catch (error) {
      console.error("Failed to clock out:", error);
      addToast({
        title: "Error",
        description: "Failed to clock out",
        color: "danger",
      });
    }
  };

  const handlePrintSalarySlip = async (
    bill: AccountBill,
    staff?: StaffMember,
  ) => {
    const targetStaff = staff || selectedStaff;

    if (!clinicId || !targetStaff) return;
    try {
      let clinicData = null;
      let printConfig = null;

      try {
        clinicData = await clinicService.getClinicById(clinicId);
      } catch (err) {
        console.error("Defensive catch: Failed to fetch clinic data", err);
      }

      try {
        printConfig = await clinicService.getPrintLayoutConfig(clinicId);
      } catch (err) {
        console.error(
          "Defensive catch: Failed to fetch print layout config",
          err,
        );
      }

      const effectiveClinic = clinicData || {
        id: clinicId,
        name: "HSC Laser Hospital",
        phone: "",
        email: "",
        address: "",
      };

      // Use default config if none exists
      const effectiveConfig =
        printConfig ||
        ({
          clinicId,
          primaryColor: "#0ea5e9",
          fontSize: "medium",
          showAddress: true,
          showPhone: true,
          showEmail: true,
          headerHeight: "compact",
        } as any);

      printSalarySlip(
        bill,
        targetStaff,
        effectiveClinic as any,
        effectiveConfig,
      );
    } catch (error) {
      console.error("Failed to print salary slip:", error);
      addToast({
        title: "Print Error",
        description: "Could not generate salary slip",
        color: "danger",
      });
    }
  };

  const toggleBreak = async (member: StaffMember) => {
    try {
      const todayAttendance = attendance.find(
        (a) =>
          a.staffId === member.id &&
          format(a.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
      );

      if (!todayAttendance) return;

      const isCurrentlyOnBreak = todayAttendance.status === "on_break";
      const newStatus = isCurrentlyOnBreak ? "present" : "on_break";

      await hrService.updateAttendance(todayAttendance.id, {
        status: newStatus,
      });
      loadData();
      addToast({
        title: isCurrentlyOnBreak ? "Back to Duty" : "Break Started",
        description: `${member.name} is now ${isCurrentlyOnBreak ? "back on duty" : "on break"}`,
        color: isCurrentlyOnBreak ? "success" : "warning",
      });
    } catch (error) {
      console.error("Failed to toggle break:", error);
    }
  };

  const markAbsent = async (
    member: StaffMember,
    leaveType: "paid" | "unpaid",
  ) => {
    if (!clinicId) return;

    try {
      const now = new Date();

      await hrService.markAttendance({
        staffId: member.id,
        staffName: member.name,
        date: now,
        checkIn: null,
        checkOut: null,
        status: "absent",
        leaveType,
        clinicId: clinicId,
        branchId: branchId || "",
      });
      loadData();
      addToast({
        title: "Attendance Marked",
        description: `${member.name} marked as ${leaveType === "paid" ? "Paid Leave" : "Unpaid Leave (absent)"}`,
        color: leaveType === "paid" ? "success" : "warning",
      });
    } catch (error) {
      console.error("Failed to mark absent:", error);
      addToast({
        title: "Error",
        description: "Failed to mark absent",
        color: "danger",
      });
    }
  };

  const injectTestAbsences = async () => {
    if (!clinicId || staff.length === 0) return;
    const testStaff =
      staff.find((s) => s.name.toUpperCase().includes("ALINA")) || staff[0];

    try {
      setLoading(true);
      const now = new Date();

      for (let i = 1; i <= 6; i++) {
        const pastDate = new Date();

        pastDate.setDate(now.getDate() - i);

        await hrService.markAttendance({
          staffId: testStaff.id,
          staffName: testStaff.name,
          date: pastDate,
          checkIn: null,
          checkOut: null,
          status: "absent",
          clinicId: clinicId,
          branchId: branchId || "",
        });
      }
      addToast({
        title: "Test Data Added",
        description: `Added 6 absences for ${testStaff.name} to test deductions!`,
        color: "success",
      });
      loadData();
    } catch (e) {
      console.error(e);
      addToast({
        title: "Error",
        description: "Failed to add test data",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const markPresent = async (member: StaffMember) => {
    if (!clinicId) {
      addToast({
        title: "Error",
        description: "Clinic ID missing. Please refresh.",
        color: "danger",
      });

      return;
    }

    try {
      const now = new Date();
      let status: "present" | "late" = "present";
      let lateByMinutes = 0;

      if (member.shiftStartTime) {
        const [shiftH, shiftM] = member.shiftStartTime.split(":").map(Number);
        const shiftTimeToday = new Date(now);

        shiftTimeToday.setHours(shiftH, shiftM, 0, 0);

        // 10 minutes grace period
        if (now.getTime() > shiftTimeToday.getTime() + 10 * 60 * 1000) {
          status = "late";
          lateByMinutes = Math.round(
            (now.getTime() - shiftTimeToday.getTime()) / (1000 * 60),
          );
        }
      }

      await hrService.markAttendance({
        staffId: member.id,
        staffName: member.name,
        date: new Date(),
        checkIn: now,
        checkOut: null,
        status: status,
        lateByMinutes: lateByMinutes,
        clinicId: clinicId,
        branchId: branchId || "",
      });
      loadData();
      addToast({
        title: "Attendance Marked",
        description: `${member.name} marked as present`,
        color: "success",
      });
    } catch (error) {
      console.error("Failed to mark attendance:", error);
      addToast({
        title: "Error",
        description: "Failed to mark attendance",
        color: "danger",
      });
    }
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const stats = {
    total: staff.length,
    present: attendance.filter(
      (a) =>
        (a.status === "present" ||
          a.status === "on_break" ||
          a.status === "late") &&
        !a.checkOut &&
        format(a.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
    ).length,
    payroll: staff.reduce((acc, s) => acc + s.salary, 0),
  };

  const formatDuration = (start: Date | null, end: Date | null) => {
    if (!start || !end) return "---";
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[15.5px] font-semibold text-primary tracking-tight">
            HR Management
          </h1>
          <p className="text-[10.5px] text-[rgb(var(--color-text-muted))] font-medium">
            Manage records, attendance, and payroll.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            className="bg-white border border-mountain-200 text-mountain-700 font-medium h-7 px-3 text-[11px]"
            radius="sm"
            startContent={<IoCalendarOutline />}
            onPress={() => setIsHolidaysModalOpen(true)}
          >
            Manage Holidays
          </Button>
          <Button
            className="font-semibold h-7 px-3 text-[11px] bg-amber-500 text-white"
            radius="sm"
            onPress={injectTestAbsences}
          >
            Inject Test Absences
          </Button>
          <Button
            className="font-semibold h-7 px-3 text-[11px]"
            color="primary"
            radius="sm"
            startContent={<IoAddOutline />}
            onPress={() => setIsStaffModalOpen(true)}
          >
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* HR Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
          shadow="none"
        >
          <CardBody className="p-3 flex flex-row items-center justify-between">
            <div>
              <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">
                Total Staff
              </p>
              <h3 className="text-[16px] font-semibold text-[rgb(var(--color-text))] tracking-tight">
                {stats.total} Members
              </h3>
              <div className="mt-1">
                <span className="text-[8.5px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 tracking-wider">
                  Directory
                </span>
              </div>
            </div>
            <IoPeopleOutline className="text-[28px] text-[rgb(var(--color-text-muted))] opacity-10" />
          </CardBody>
        </Card>

        <Card
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
          shadow="none"
        >
          <CardBody className="p-3 flex flex-row items-center justify-between">
            <div>
              <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">
                Present Today
              </p>
              <h3 className="text-[16px] font-semibold text-primary tracking-tight">
                {stats.present} Active
              </h3>
              <p className="text-[8.5px] text-[rgb(var(--color-text-muted))] mt-1 font-semibold flex items-center gap-1 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-success rounded-full" />
                Real-time
              </p>
            </div>
            <IoCheckmarkCircleOutline className="text-[28px] text-[rgb(var(--color-text-muted))] opacity-10" />
          </CardBody>
        </Card>

        <Card
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
          shadow="none"
        >
          <CardBody className="p-3 flex flex-row items-center justify-between">
            <div>
              <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">
                Monthly Payroll
              </p>
              <h3 className="text-[16px] font-semibold text-[rgb(var(--color-text))] tracking-tight">
                Rs. {stats.payroll.toLocaleString()}
              </h3>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[8.5px] font-semibold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 tracking-wider">
                  Liability
                </span>
                <Button
                  isIconOnly
                  className="h-5 w-5 min-w-0"
                  size="sm"
                  title="Print Summary"
                  variant="light"
                  onPress={handlePrintPayrollSummary}
                >
                  <IoPrintOutline className="text-amber-500" size={12} />
                </Button>
              </div>
            </div>
            <IoWalletOutline className="text-[28px] text-[rgb(var(--color-text-muted))] opacity-10" />
          </CardBody>
        </Card>
      </div>

      {/* Tab Selection */}
      <div className="mb-6">
        <Tabs
          classNames={{
            tabList:
              "gap-6 w-full relative rounded-none p-0 border-b border-[rgb(var(--color-border))]",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-0 h-12",
            tabContent:
              "group-data-[selected=true]:text-primary font-semibold text-[14px]",
          }}
          selectedKey={activeTab}
          variant="underlined"
          onSelectionChange={(key) => setActiveTab(key as string)}
        >
          <Tab
            key="directory"
            title={
              <div className="flex items-center gap-2">
                <IoPeopleOutline size={18} />
                <span>Staff Directory</span>
              </div>
            }
          />
          <Tab
            key="attendance"
            title={
              <div className="flex items-center gap-2">
                <IoTimeOutline size={18} />
                <span>Attendance Logs</span>
              </div>
            }
          />
          <Tab
            key="payroll_reports"
            title={
              <div className="flex items-center gap-2">
                <IoDocumentsOutline size={18} />
                <span>Payroll Reports</span>
              </div>
            }
          />
          <Tab
            key="leaves"
            title={
              <div className="flex items-center gap-2">
                <IoLeafOutline size={18} />
                <span>Leave Management</span>
                {leaveRequests.filter((l) => l.status === "pending").length >
                  0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-500 text-white">
                    {leaveRequests.filter((l) => l.status === "pending").length}
                  </span>
                )}
              </div>
            }
          />
          <Tab
            key="leave_settings"
            title={
              <div className="flex items-center gap-2">
                <IoSettingsOutline size={18} />
                <span>Leave Settings</span>
              </div>
            }
          />
        </Tabs>
      </div>

      {activeTab === "directory" && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[rgb(var(--color-surface-2))/0.3] p-4 rounded-xl border border-[rgb(var(--color-border))]">
            <div className="relative w-full md:w-96">
              <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] w-4 h-4" />
              <input
                className="w-full h-10 pl-10 pr-4 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                placeholder="Search by name, role or email..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Staff Registry Table */}
          <div className="mt-4">
            {loading ? (
              <div className="py-20 text-center">
                <Spinner label="Loading staff registry..." />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-[rgb(var(--color-border))] rounded-xl grayscale opacity-50">
                <IoPeopleOutline className="w-12 h-12 mx-auto mb-2" />
                <p className="text-[14px] font-bold">No staff records found</p>
              </div>
            ) : (
              <Card
                className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
                shadow="none"
              >
                <Table
                  aria-label="Staff registry"
                  classNames={{
                    th: "bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] font-semibold text-[11px]",
                    td: "text-[13px] py-3 border-b border-[rgb(var(--color-border))]/50",
                  }}
                  shadow="none"
                >
                  <TableHeader>
                    <TableColumn>Staff Member</TableColumn>
                    <TableColumn>Contact Details</TableColumn>
                    <TableColumn>Monthly Salary</TableColumn>
                    <TableColumn>Joining Date</TableColumn>
                    <TableColumn>Current Status</TableColumn>
                    <TableColumn align="center">Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((member, index) => {
                      const isPresent = attendance.some(
                        (a) =>
                          a.staffId === member.id &&
                          (a.status === "present" ||
                            a.status === "late" ||
                            a.status === "on_break") &&
                          format(a.date, "yyyy-MM-dd") ===
                            format(new Date(), "yyyy-MM-dd"),
                      );

                      return (
                        <TableRow
                          key={member.id || `staff-${index}`}
                          className="hover:bg-[rgb(var(--color-surface-2))/0.3] transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] flex items-center justify-center overflow-hidden shrink-0">
                                {member.photoUrl ? (
                                  <img
                                    alt=""
                                    className="w-full h-full object-cover"
                                    src={member.photoUrl}
                                  />
                                ) : (
                                  <span className="text-[14px] font-black text-primary/40">
                                    {member.name.charAt(0)}
                                  </span>
                                )}
                              </div>
                              <div
                                className="cursor-pointer group"
                                onClick={() => {
                                  setSelectedStaff(member);
                                  setIsDetailModalOpen(true);
                                }}
                              >
                                <h3 className="text-[14px] font-semibold text-[rgb(var(--color-text))] group-hover:text-primary transition-colors">
                                  {member.name}
                                </h3>
                                <p className="text-[10px] font-semibold text-primary tracking-tighter">
                                  {member.role}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--color-text))] font-medium">
                                <IoCallOutline className="w-3 h-3 text-[rgb(var(--color-text-muted))]" />
                                {member.phone}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--color-text-muted))]">
                                <IoMailOutline className="w-3 h-3" />
                                {member.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-semibold text-[rgb(var(--color-text))]">
                              <IoWalletOutline className="w-3.5 h-3.5 text-primary" />
                              Rs. {member.salary.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-[12px] text-[rgb(var(--color-text-muted))]">
                              <IoCalendarOutline className="w-3.5 h-3.5" />
                              {format(
                                new Date(member.joiningDate),
                                "MMM dd, yyyy",
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const todayAttendance = attendance.find(
                                (a) =>
                                  a.staffId === member.id &&
                                  format(a.date, "yyyy-MM-dd") ===
                                    format(new Date(), "yyyy-MM-dd"),
                              );

                              let statusLabel = "Off duty";
                              let statusColor =
                                "bg-default-100 text-default-400 border-default-200";

                              if (todayAttendance) {
                                if (
                                  todayAttendance.status === "present" ||
                                  todayAttendance.status === "late"
                                ) {
                                  if (todayAttendance.checkOut) {
                                    statusLabel = "Completed";
                                    statusColor =
                                      "bg-default-100 text-default-400 border-default-200";
                                  } else {
                                    statusLabel =
                                      todayAttendance.status === "late"
                                        ? "Late"
                                        : "On Duty";
                                    statusColor =
                                      todayAttendance.status === "late"
                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                        : "bg-success/10 text-success border-success/20";
                                  }
                                } else if (
                                  todayAttendance.status === "on_break"
                                ) {
                                  statusLabel = "On break";
                                  statusColor =
                                    "bg-warning/10 text-warning border-warning/20";
                                } else if (
                                  todayAttendance.status === "absent"
                                ) {
                                  statusLabel = "Absent";
                                  statusColor =
                                    "bg-rose-500/10 text-rose-500 border-rose-500/20";
                                }
                              } else if (member.status === "on_leave") {
                                statusLabel = "On leave";
                                statusColor =
                                  "bg-amber-500/10 text-amber-500 border-amber-500/20";
                              } else if (member.status === "in_surgery") {
                                statusLabel = "In Surgery";
                                statusColor =
                                  "bg-primary/10 text-primary border-primary/20";
                              }

                              return (
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wider uppercase ${statusColor}`}
                                >
                                  {statusLabel}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell align="center">
                            <div className="flex items-center gap-1 justify-center">
                              {isPresent &&
                                !attendance.find(
                                  (a) =>
                                    a.staffId === member.id &&
                                    format(a.date, "yyyy-MM-dd") ===
                                      format(new Date(), "yyyy-MM-dd"),
                                )?.checkOut && (
                                  <Button
                                    className="font-semibold text-[10px] h-7 px-2 min-w-0"
                                    color="warning"
                                    size="sm"
                                    variant="flat"
                                    onPress={() => toggleBreak(member)}
                                  >
                                    {attendance.find(
                                      (a) =>
                                        a.staffId === member.id &&
                                        format(a.date, "yyyy-MM-dd") ===
                                          format(new Date(), "yyyy-MM-dd"),
                                    )?.status === "on_break"
                                      ? "Resume"
                                      : "Break"}
                                  </Button>
                                )}
                              {(() => {
                                const todayAtt = attendance.find(
                                  (a) =>
                                    a.staffId === member.id &&
                                    format(a.date, "yyyy-MM-dd") ===
                                      format(new Date(), "yyyy-MM-dd"),
                                );
                                const hasEndedShift =
                                  todayAtt && todayAtt.checkOut;
                                const isCurrentlyAbsent =
                                  todayAtt && todayAtt.status === "absent";

                                if (hasEndedShift) {
                                  return (
                                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest py-1 px-3 bg-primary/5 rounded">
                                      Shift Ended
                                    </span>
                                  );
                                }

                                return (
                                  <div className="flex gap-2">
                                    <Button
                                      className="font-semibold text-[10px] h-7 px-3"
                                      color={isPresent ? "danger" : "primary"}
                                      size="sm"
                                      variant="flat"
                                      onPress={() =>
                                        isPresent
                                          ? handleClockOut(member)
                                          : markPresent(member)
                                      }
                                    >
                                      {isPresent ? "Clock Out" : "Mark Present"}
                                    </Button>
                                    {!isPresent && !isCurrentlyAbsent && (
                                      <Button
                                        className="font-semibold text-[10px] h-7 px-3"
                                        color="danger"
                                        size="sm"
                                        variant="flat"
                                        onPress={() => {
                                          setAbsentTarget(member);
                                          setIsAbsentModalOpen(true);
                                        }}
                                      >
                                        Absent
                                      </Button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </>
      )}

      {activeTab === "attendance" && (
        <div className="space-y-4">
          {/* Monthly Attendance Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card
              className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
              shadow="none"
            >
              <CardBody className="p-3">
                <p className="text-[8px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest opacity-60">
                  Avg. Working Hours
                </p>
                <h4 className="text-[15px] font-bold text-primary">
                  {(
                    attendance
                      .filter((a) => a.totalHours)
                      .reduce((acc, a) => acc + (a.totalHours || 0), 0) /
                    (attendance.filter((a) => a.totalHours).length || 1)
                  ).toFixed(1)}
                  h / day
                </h4>
              </CardBody>
            </Card>
            <Card
              className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
              shadow="none"
            >
              <CardBody className="p-3">
                <p className="text-[8px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest opacity-60">
                  Late Arrivals
                </p>
                <h4 className="text-[15px] font-bold text-amber-500">
                  {attendance.filter((a) => a.status === "late").length}{" "}
                  Sessions
                </h4>
              </CardBody>
            </Card>
            <Card
              className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
              shadow="none"
            >
              <CardBody className="p-3">
                <p className="text-[8px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest opacity-60">
                  On Break Now
                </p>
                <h4 className="text-[15px] font-bold text-primary">
                  {
                    attendance.filter(
                      (a) =>
                        a.status === "on_break" &&
                        format(a.date, "yyyy-MM-dd") ===
                          format(new Date(), "yyyy-MM-dd"),
                    ).length
                  }{" "}
                  Members
                </h4>
              </CardBody>
            </Card>
            <Card
              className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
              shadow="none"
            >
              <CardBody className="p-3">
                <p className="text-[8px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest opacity-60">
                  Monthly Absents
                </p>
                <h4 className="text-[15px] font-bold text-rose-500">
                  {attendance.filter((a) => a.status === "absent").length} Days
                </h4>
              </CardBody>
            </Card>
          </div>

          <Card
            className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
            shadow="none"
          >
            <Table
              aria-label="Attendance logs"
              classNames={{
                th: "bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] font-semibold text-[11px]",
                td: "text-[13px] py-4 border-b border-[rgb(var(--color-border))]/50",
              }}
            >
              <TableHeader>
                <TableColumn>Staff Member</TableColumn>
                <TableColumn>Date</TableColumn>
                <TableColumn>Check In</TableColumn>
                <TableColumn>Check Out</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn align="center">Duration</TableColumn>
              </TableHeader>
              <TableBody emptyContent={"No attendance records found."}>
                {attendance
                  .sort((a, b) => b.date.getTime() - a.date.getTime())
                  .map((record, index) => (
                    <TableRow key={record.id || `attn-log-${index}`}>
                      <TableCell>
                        <div className="font-semibold">{record.staffName}</div>
                      </TableCell>
                      <TableCell>
                        {format(record.date, "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-success font-semibold">
                          <IoTimeOutline size={14} />
                          {record.checkIn
                            ? format(record.checkIn, "hh:mm a")
                            : "---"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-rose-500 font-semibold">
                          <IoTimeOutline size={14} />
                          {record.checkOut
                            ? format(record.checkOut, "hh:mm a")
                            : "Still In"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${!record.checkOut ? (record.status === "on_break" ? "bg-warning/10 text-warning" : "bg-success/10 text-success") : "bg-default-100 text-default-400"}`}
                        >
                          {!record.checkOut
                            ? record.status === "on_break"
                              ? "On Break"
                              : record.status === "late"
                                ? "Late"
                                : "On Duty"
                            : "Completed"}
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <div className="font-semibold text-primary whitespace-nowrap">
                          {formatDuration(record.checkIn, record.checkOut)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {activeTab === "payroll_reports" && (
        <div className="py-6 space-y-6">
          <Card
            className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
            shadow="none"
          >
            <CardBody className="p-6">
              <h3 className="text-[14px] font-bold text-[rgb(var(--color-text))] tracking-tight mb-4">
                Payroll Expense Trend (Last 6 Months)
              </h3>
              <div className="h-64 w-full">
                <Bar
                  data={payrollChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { color: "rgba(0,0,0,0.05)" },
                      },
                      x: {
                        grid: { display: false },
                      },
                    },
                  }}
                />
              </div>
            </CardBody>
          </Card>

          <div className="flex justify-between items-end bg-[rgb(var(--color-surface-2))/0.3] p-4 rounded-xl border border-[rgb(var(--color-border))]">
            <div>
              <h3 className="text-[14px] font-bold text-primary tracking-tight">
                Financial Disbursement Summary
              </h3>
              <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                Comprehensive overview of staff salaries and payments.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Input
                  className="w-32"
                  max={reportDateRange.end}
                  size="sm"
                  type="date"
                  value={reportDateRange.start}
                  onChange={(e) =>
                    setReportDateRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }))
                  }
                />
                <span className="text-[11px] text-[rgb(var(--color-text-muted))]">
                  to
                </span>
                <Input
                  className="w-32"
                  min={reportDateRange.start}
                  size="sm"
                  type="date"
                  value={reportDateRange.end}
                  onChange={(e) =>
                    setReportDateRange((prev) => ({
                      ...prev,
                      end: e.target.value,
                    }))
                  }
                />
              </div>
              <Select
                aria-label="Filter by payment status"
                className="w-32"
                selectedKeys={[payrollReportFilter]}
                size="sm"
                onSelectionChange={(keys) =>
                  setPayrollReportFilter(Array.from(keys)[0] as string)
                }
              >
                <SelectItem key="all">All Staff</SelectItem>
                <SelectItem key="paid">Paid</SelectItem>
                <SelectItem key="unpaid">Unpaid</SelectItem>
              </Select>
              <Button
                className="font-bold text-[11px]"
                color="primary"
                size="sm"
                startContent={<IoPrintOutline size={16} />}
                variant="flat"
                onPress={handlePrintPayrollSummary}
              >
                Print Report
              </Button>
            </div>
          </div>

          <div className="border border-[rgb(var(--color-border))] rounded-xl overflow-hidden bg-[rgb(var(--color-surface))]">
            <Table aria-label="Payroll summary table" shadow="none">
              <TableHeader>
                <TableColumn>Staff Member</TableColumn>
                <TableColumn>Role</TableColumn>
                <TableColumn align="end">Base Salary</TableColumn>
                <TableColumn align="end">Total Paid (To Date)</TableColumn>
                <TableColumn>Last Payment</TableColumn>
                <TableColumn align="center">Status</TableColumn>
                <TableColumn align="center">Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No payroll data available">
                {[
                  ...staffPayrollSummary.map((summary, index) => (
                    <TableRow
                      key={
                        summary.id
                          ? `summary-member-${summary.id}`
                          : `summary-index-${index}`
                      }
                      className="hover:bg-[rgb(var(--color-surface-2))/0.3] transition-colors"
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-[13px]">
                            {summary.name}
                          </span>
                          <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                            {summary.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] px-2 py-0.5 bg-[rgb(var(--color-surface-2))] rounded font-medium">
                          {summary.role}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-[12px]">
                          Rs. {summary.salary.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono text-[13px] font-bold text-success">
                          Rs. {summary.totalPaid.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px]">
                          {summary.lastPayment
                            ? format(
                                new Date(summary.lastPayment),
                                "MMM dd, yyyy",
                              )
                            : "Never"}
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${summary.status === "active" ? "bg-success/10 text-success" : "bg-rose-500/10 text-rose-500"}`}
                        >
                          {summary.status}
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        {summary.lastBill ? (
                          <Button
                            isIconOnly
                            className="h-7 w-7"
                            color="primary"
                            size="sm"
                            title="Print Latest Payslip"
                            variant="light"
                            onPress={() =>
                              handlePrintSalarySlip(summary.lastBill, summary)
                            }
                          >
                            <IoPrintOutline size={16} />
                          </Button>
                        ) : (
                          <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                            N/A
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )),
                  ...(staffPayrollSummary.length > 0
                    ? [
                        <TableRow
                          key="total-payroll-summary-row"
                          className="bg-primary/5 font-bold"
                        >
                          <TableCell>TOTAL SYSTEM PAYROLL</TableCell>
                          <TableCell>{""}</TableCell>
                          <TableCell align="right">
                            Rs.{" "}
                            {staffPayrollSummary
                              .reduce((acc, s) => acc + s.salary, 0)
                              .toLocaleString()}
                          </TableCell>
                          <TableCell align="right" className="text-primary">
                            Rs.{" "}
                            {staffPayrollSummary
                              .reduce((acc, s) => acc + s.totalPaid, 0)
                              .toLocaleString()}
                          </TableCell>
                          <TableCell>{""}</TableCell>
                          <TableCell>{""}</TableCell>
                          <TableCell>{""}</TableCell>
                        </TableRow>,
                      ]
                    : []),
                ]}
              </TableBody>
            </Table>
          </div>

          {/* Hidden component for printing */}
          <div className="hidden" id="payroll-summary-report">
            <table>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Role</th>
                  <th style={{ textAlign: "right" }}>Base Salary</th>
                  <th style={{ textAlign: "right" }}>Total Paid</th>
                  <th>Joining Date</th>
                  <th>Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {staffPayrollSummary.map((summary) => (
                  <tr key={summary.id}>
                    <td>{summary.name}</td>
                    <td>{summary.role}</td>
                    <td className="amount">
                      Rs. {summary.salary.toLocaleString()}
                    </td>
                    <td className="amount">
                      Rs. {summary.totalPaid.toLocaleString()}
                    </td>
                    <td>{format(new Date(summary.joiningDate), "PPP")}</td>
                    <td>
                      {summary.lastPayment
                        ? format(new Date(summary.lastPayment), "PPP")
                        : "N/A"}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={2}>TOTAL DISBURSEMENTS</td>
                  <td className="amount">
                    Rs.{" "}
                    {staffPayrollSummary
                      .reduce((acc, s) => acc + s.salary, 0)
                      .toLocaleString()}
                  </td>
                  <td className="amount">
                    Rs.{" "}
                    {staffPayrollSummary
                      .reduce((acc, s) => acc + s.totalPaid, 0)
                      .toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ⚙️ LEAVE SETTINGS TAB ⚙️ */}
      {activeTab === "leave_settings" && (
        <div className="py-6">
          <LeaveSettingsTab />
        </div>
      )}

      {/* 🌴 LEAVE MANAGEMENT TAB 🌴 */}
      {activeTab === "leaves" && (
        <div className="space-y-5">
          {/* Top action bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-[rgb(var(--color-surface-2))/0.3] p-4 rounded-xl border border-[rgb(var(--color-border))]">
            <div>
              <h3 className="text-[14px] font-bold text-[rgb(var(--color-text))] tracking-tight">
                Leave Requests
              </h3>
              <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                Manage and review staff leave applications for{" "}
                {new Date().getFullYear()}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Status filter pills */}
              {(["all", "pending", "approved", "rejected"] as const).map(
                (f) => (
                  <button
                    key={f}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-full border capitalize transition-all ${
                      leaveFilter === f
                        ? "bg-primary text-white border-primary"
                        : "bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))] hover:border-primary hover:text-primary"
                    }`}
                    onClick={() => setLeaveFilter(f)}
                  >
                    {f === "all"
                      ? "All"
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== "all" && (
                      <span className="ml-1 opacity-70">
                        ({leaveRequests.filter((l) => l.status === f).length})
                      </span>
                    )}
                  </button>
                ),
              )}
              <div className="relative">
                <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[rgb(var(--color-text-muted))]" />
                <input
                  className="h-8 pl-8 pr-3 text-[12px] rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] outline-none focus:ring-1 focus:ring-primary/20 w-44"
                  placeholder="Search staff..."
                  value={leaveSearch}
                  onChange={(e) => setLeaveSearch(e.target.value)}
                />
              </div>
              <Button
                className="font-semibold text-[11px] h-8 px-3"
                color="primary"
                size="sm"
                startContent={<IoAddOutline />}
                onPress={() => setIsLeaveModalOpen(true)}
              >
                New Request
              </Button>
            </div>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Pending Review",
                value: leaveRequests.filter((l) => l.status === "pending")
                  .length,
                color: "text-amber-500",
                bg: "bg-amber-500/10",
                icon: (
                  <IoHourglassOutline className="text-amber-500 text-[22px] opacity-20" />
                ),
              },
              {
                label: "Approved",
                value: leaveRequests.filter((l) => l.status === "approved")
                  .length,
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
                icon: (
                  <IoShieldCheckmarkOutline className="text-emerald-500 text-[22px] opacity-20" />
                ),
              },
              {
                label: "Rejected",
                value: leaveRequests.filter((l) => l.status === "rejected")
                  .length,
                color: "text-rose-500",
                bg: "bg-rose-500/10",
                icon: (
                  <IoCloseOutline className="text-rose-500 text-[22px] opacity-20" />
                ),
              },
              {
                label: "Total Days Taken",
                value: leaveRequests
                  .filter((l) => l.status === "approved")
                  .reduce((s, l) => s + l.totalDays, 0),
                color: "text-primary",
                bg: "bg-primary/10",
                icon: (
                  <IoStatsChartOutline className="text-primary text-[22px] opacity-20" />
                ),
              },
            ].map((kpi) => (
              <Card
                key={kpi.label}
                className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
                shadow="none"
              >
                <CardBody className="p-3 flex flex-row items-center justify-between">
                  <div>
                    <p className="text-[8px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest opacity-60">
                      {kpi.label}
                    </p>
                    <h4 className={`text-[18px] font-bold ${kpi.color}`}>
                      {kpi.value}
                    </h4>
                  </div>
                  {kpi.icon}
                </CardBody>
              </Card>
            ))}
          </div>

          {/* Leave Requests Table */}
          {leavesLoading ? (
            <div className="py-20 text-center">
              <Spinner label="Loading leave requests..." />
            </div>
          ) : (
            <Card
              className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
              shadow="none"
            >
              <Table
                aria-label="Leave requests table"
                classNames={{
                  th: "bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] font-semibold text-[11px]",
                  td: "text-[12.5px] py-3 border-b border-[rgb(var(--color-border))]/40",
                }}
                shadow="none"
              >
                <TableHeader>
                  <TableColumn>Staff Member</TableColumn>
                  <TableColumn>Leave Type</TableColumn>
                  <TableColumn>Duration</TableColumn>
                  <TableColumn>Days</TableColumn>
                  <TableColumn>Reason</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn align="center">Actions</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No leave requests found.">
                  {leaveRequests
                    .filter((l) => {
                      const matchFilter =
                        leaveFilter === "all" || l.status === leaveFilter;
                      const matchSearch =
                        !leaveSearch ||
                        l.staffName
                          .toLowerCase()
                          .includes(leaveSearch.toLowerCase());

                      return matchFilter && matchSearch;
                    })
                    .map((leave, i) => {
                      const typeConfig: Record<
                        string,
                        { label: string; cls: string }
                      > = {
                        annual: {
                          label: "Annual",
                          cls: "bg-blue-500/10 text-blue-600 border-blue-500/20",
                        },
                        sick: {
                          label: "Sick",
                          cls: "bg-rose-500/10 text-rose-500 border-rose-500/20",
                        },
                        casual: {
                          label: "Casual",
                          cls: "bg-violet-500/10 text-violet-600 border-violet-500/20",
                        },
                        unpaid: {
                          label: "Unpaid",
                          cls: "bg-slate-400/10 text-slate-500 border-slate-400/20",
                        },
                        maternity: {
                          label: "Maternity",
                          cls: "bg-pink-500/10 text-pink-600 border-pink-500/20",
                        },
                        emergency: {
                          label: "Emergency",
                          cls: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                        },
                      };
                      const statusConfig: Record<
                        string,
                        { label: string; cls: string }
                      > = {
                        pending: {
                          label: "Pending",
                          cls: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                        },
                        approved: {
                          label: "Approved",
                          cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                        },
                        rejected: {
                          label: "Rejected",
                          cls: "bg-rose-500/10 text-rose-500 border-rose-500/20",
                        },
                        cancelled: {
                          label: "Cancelled",
                          cls: "bg-slate-400/10 text-slate-500 border-slate-400/20",
                        },
                      };
                      const actualLeaveType = globalLeaveTypes.find(
                        (t) => t.id === leave.leaveType,
                      );
                      const tc = actualLeaveType
                        ? {
                            label: actualLeaveType.name,
                            cls: actualLeaveType.isPaid
                              ? "bg-mountain-100 text-mountain-800 border-mountain-200"
                              : "bg-rose-50 text-rose-600 border-rose-200",
                          }
                        : typeConfig[leave.leaveType] || {
                            label: leave.leaveType,
                            cls: "bg-default-100 text-default-500",
                          };
                      const sc = statusConfig[leave.status] || {
                        label: leave.status,
                        cls: "bg-default-100 text-default-500",
                      };

                      return (
                        <TableRow
                          key={leave.id || `leave-${i}`}
                          className="hover:bg-[rgb(var(--color-surface-2))/0.3] transition-colors"
                        >
                          <TableCell>
                            <div className="font-semibold text-[rgb(var(--color-text))]">
                              {leave.staffName}
                            </div>
                            <div className="text-[10px] text-[rgb(var(--color-text-muted))]">
                              {leave.staffRole}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tc.cls}`}
                            >
                              {tc.label}
                            </span>
                            {leave.isPaid && (
                              <span className="ml-1 text-[9px] text-emerald-500 font-semibold">
                                Paid
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-[11px]">
                              {format(new Date(leave.startDate), "MMM dd")} →{" "}
                              {format(new Date(leave.endDate), "MMM dd, yyyy")}
                            </div>
                            <div className="text-[10px] text-[rgb(var(--color-text-muted))]">
                              Submitted{" "}
                              {format(new Date(leave.createdAt), "MMM dd")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-primary">
                              {leave.totalDays}d
                            </span>
                          </TableCell>
                          <TableCell>
                            <p
                              className="text-[11.5px] text-[rgb(var(--color-text-muted))] max-w-[180px] truncate"
                              title={leave.reason}
                            >
                              {leave.reason}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.cls}`}
                            >
                              {sc.label}
                            </span>
                            {leave.status !== "pending" &&
                              leave.reviewerName && (
                                <p className="text-[9px] text-[rgb(var(--color-text-muted))] mt-0.5">
                                  by {leave.reviewerName}
                                </p>
                              )}
                          </TableCell>
                          <TableCell align="center">
                            <div className="flex items-center gap-1 justify-center">
                              {leave.status === "pending" && (
                                <>
                                  <Button
                                    className="h-7 px-2 text-[10px] font-bold"
                                    color="success"
                                    size="sm"
                                    startContent={
                                      <IoCheckmarkOutline size={12} />
                                    }
                                    variant="flat"
                                    onPress={() => {
                                      setReviewingLeave(leave);
                                      setReviewNotes("");
                                      setIsReviewModalOpen(true);
                                    }}
                                  >
                                    Review
                                  </Button>
                                  <Button
                                    className="h-7 px-2 text-[10px] font-bold"
                                    color="danger"
                                    size="sm"
                                    variant="light"
                                    onPress={() => handleCancelLeave(leave.id)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              )}
                              {leave.status !== "pending" &&
                                leave.reviewNotes && (
                                  <span
                                    className="cursor-help text-[rgb(var(--color-text-muted))]"
                                    title={leave.reviewNotes}
                                  >
                                    <IoAlertCircleOutline size={15} />
                                  </span>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Leave Balance Grid */}
          {leaveBalances.length > 0 && (
            <div>
              <h3 className="text-[13px] font-bold text-[rgb(var(--color-text))] mb-3 mt-2 flex items-center gap-2">
                <IoStatsChartOutline className="text-primary" />
                Staff Leave Balances — {new Date().getFullYear()}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {leaveBalances.map((bal) => {
                  return (
                    <Card
                      key={bal.id}
                      className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
                      shadow="none"
                    >
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-[13px] font-bold text-[rgb(var(--color-text))]">
                              {bal.staffName}
                            </p>
                            <p className="text-[10px] text-[rgb(var(--color-text-muted))] uppercase tracking-wider">
                              {bal.year} Quota
                            </p>
                          </div>
                          {bal.unpaidUsed > 0 && (
                            <div className="px-2 py-0.5 rounded bg-rose-50 border border-rose-100 text-[10px] font-bold text-rose-600">
                              {bal.unpaidUsed} Unpaid Used
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          {bal.assignments && bal.assignments.length > 0 ? (
                            bal.assignments
                              .filter((a: any) => a.isActive)
                              .map((item: any) => {
                                const remaining = Math.max(
                                  0,
                                  item.assignedDays - item.usedDays,
                                );

                                return (
                                  <div key={item.leaveTypeId}>
                                    <div className="flex justify-between text-[10px] font-semibold text-[rgb(var(--color-text-muted))] mb-1">
                                      <span className="capitalize">
                                        {globalLeaveTypes.find(
                                          (lt) => lt.id === item.leaveTypeId,
                                        )?.name || item.leaveTypeId}
                                      </span>
                                      <span>
                                        {remaining} / {item.assignedDays}{" "}
                                        remaining
                                      </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-[rgb(var(--color-surface-2))] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all"
                                        style={{
                                          width: `${Math.min(100, (item.usedDays / item.assignedDays) * 100)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })
                          ) : (
                            <div className="text-[11px] text-[rgb(var(--color-text-muted))] italic">
                              No leave types assigned.
                            </div>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── New Leave Request Modal ── */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
          header: "border-b border-[rgb(var(--color-border))] py-4",
          footer: "border-t border-[rgb(var(--color-border))] py-3",
        }}
        isOpen={isLeaveModalOpen}
        size="3xl"
        onOpenChange={setIsLeaveModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleSubmitLeave}>
              <ModalHeader>
                <div className="flex flex-col">
                  <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))] tracking-tight">
                    New Leave Request
                  </h2>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-normal">
                    Submit a leave application on behalf of a staff member.
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Side: Form Inputs */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Staff Member
                      </label>
                      <Select
                        aria-label="Select staff"
                        placeholder="Select staff member"
                        selectedKeys={
                          leaveForm.staffId
                            ? new Set([leaveForm.staffId])
                            : new Set()
                        }
                        size="sm"
                        onSelectionChange={(keys) =>
                          setLeaveForm({
                            ...leaveForm,
                            staffId: Array.from(keys)[0] as string,
                          })
                        }
                      >
                        {staff.map((s) => (
                          <SelectItem key={s.id} textValue={s.name}>
                            {s.name} — {s.role}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Leave Type
                      </label>
                      <Select
                        aria-label="Leave type"
                        placeholder="Select leave type"
                        selectedKeys={
                          leaveForm.leaveType
                            ? new Set([leaveForm.leaveType])
                            : new Set()
                        }
                        size="sm"
                        onSelectionChange={(keys) =>
                          setLeaveForm({
                            ...leaveForm,
                            leaveType: Array.from(keys)[0] as string,
                          })
                        }
                      >
                        {globalLeaveTypes.map((type) => (
                          <SelectItem key={type.id} textValue={type.name}>
                            {type.name} {type.isPaid ? "(Paid)" : "(Unpaid)"}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                          From
                        </label>
                        <Input
                          size="sm"
                          type="date"
                          value={leaveForm.startDate}
                          onChange={(e) =>
                            setLeaveForm({
                              ...leaveForm,
                              startDate: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                          To
                        </label>
                        <Input
                          min={leaveForm.startDate}
                          size="sm"
                          type="date"
                          value={leaveForm.endDate}
                          onChange={(e) =>
                            setLeaveForm({
                              ...leaveForm,
                              endDate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Reason
                      </label>
                      <Textarea
                        minRows={3}
                        placeholder="Provide reason for leave..."
                        size="sm"
                        value={leaveForm.reason}
                        onChange={(e) =>
                          setLeaveForm({ ...leaveForm, reason: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {/* Right Side: Summary Box */}
                  <div className="bg-mountain-50 border border-mountain-100 rounded-xl p-5 flex flex-col h-full shadow-sm">
                    <h3 className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-4 border-b border-mountain-200 pb-2">
                      Leave Summary
                    </h3>

                    <div className="space-y-4">
                      {/* Duration Info */}
                      {leaveForm.startDate && leaveForm.endDate ? (
                        <div className="flex justify-between text-[12px] pb-3 border-b border-mountain-100">
                          <span className="text-mountain-600">
                            Total Duration:
                          </span>
                          <span className="font-semibold text-primary">
                            {Math.round(
                              (new Date(leaveForm.endDate).getTime() -
                                new Date(leaveForm.startDate).getTime()) /
                                86400000,
                            ) + 1}{" "}
                            Day(s)
                          </span>
                        </div>
                      ) : null}

                      {/* Quota Info */}
                      {leaveForm.staffId && leaveForm.leaveType ? (
                        <div className="flex flex-col gap-2">
                          {(() => {
                            const type = globalLeaveTypes.find(
                              (t) => t.id === leaveForm.leaveType,
                            );

                            if (!type?.isPaid) {
                              return (
                                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                                  <p className="text-[11px] text-rose-600 font-medium">
                                    Unpaid leave - unlimited, but salary will be
                                    deducted per day absent.
                                  </p>
                                </div>
                              );
                            }

                            const currentYear = new Date(
                              leaveForm.startDate,
                            ).getFullYear();
                            const balance = leaveBalances.find(
                              (b) =>
                                b.staffId === leaveForm.staffId &&
                                b.year === currentYear,
                            );
                            const assignment = balance?.assignments?.find(
                              (a) => a.leaveTypeId === leaveForm.leaveType,
                            );

                            if (!assignment || !assignment.isActive) {
                              return (
                                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-[11px]">
                                  <span className="text-danger font-medium">
                                    Staff is not assigned to this leave type.
                                  </span>
                                </div>
                              );
                            }

                            const remaining = Math.max(
                              0,
                              assignment.assignedDays - assignment.usedDays,
                            );

                            return (
                              <div className="flex flex-col gap-3">
                                <div className="flex justify-between text-[12px]">
                                  <span className="text-mountain-600">
                                    Annual Quota:
                                  </span>
                                  <span className="font-semibold text-mountain-900">
                                    {assignment.assignedDays} Days
                                  </span>
                                </div>
                                <div className="flex justify-between text-[12px]">
                                  <span className="text-mountain-600">
                                    Already Taken:
                                  </span>
                                  <span className="font-semibold text-danger">
                                    {assignment.usedDays} Days
                                  </span>
                                </div>
                                <div className="flex justify-between text-[13px] pt-2 border-t border-mountain-100 font-bold">
                                  <span className="text-mountain-800">
                                    Remaining Balance:
                                  </span>
                                  <span className="text-success">
                                    {remaining} Days
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-[11px] text-mountain-400 italic text-center mt-4">
                          Select a staff member and leave type to view quota
                          details.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button size="sm" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  className="font-bold"
                  color="primary"
                  isLoading={leaveSubmitting}
                  size="sm"
                  type="submit"
                >
                  Submit Request
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* ── Manager Review Modal ── */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
          header: "border-b border-[rgb(var(--color-border))] py-4",
          footer: "border-t border-[rgb(var(--color-border))] py-3",
        }}
        isOpen={isReviewModalOpen}
        size="lg"
        onOpenChange={setIsReviewModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <div>
                  <h2 className="text-[16px] font-bold text-primary">
                    Review Leave Request
                  </h2>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                    Approve or reject this application.
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-5 space-y-4">
                {reviewingLeave && (
                  <div className="bg-[rgb(var(--color-surface-2))/0.5] p-4 rounded-xl border border-[rgb(var(--color-border))] space-y-2">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-[rgb(var(--color-text))]">
                          {reviewingLeave.staffName}
                        </p>
                        <p className="text-[10px] text-[rgb(var(--color-text-muted))]">
                          {reviewingLeave.staffRole}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-primary">
                        {reviewingLeave.totalDays} day(s)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[rgb(var(--color-text-muted))]">
                          Type:{" "}
                        </span>
                        <span className="font-semibold capitalize">
                          {globalLeaveTypes.find(
                            (lt) => lt.id === reviewingLeave.leaveType,
                          )?.name || reviewingLeave.leaveType}
                        </span>
                        {reviewingLeave.isPaid && (
                          <span className="ml-1 text-emerald-500">(Paid)</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[rgb(var(--color-text-muted))]">
                          Period:{" "}
                        </span>
                        <span className="font-semibold">
                          {format(new Date(reviewingLeave.startDate), "MMM dd")}{" "}
                          –{" "}
                          {format(
                            new Date(reviewingLeave.endDate),
                            "MMM dd, yyyy",
                          )}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[rgb(var(--color-text-muted))] uppercase font-bold">
                        Reason
                      </span>
                      <p className="text-[12px] mt-0.5 text-[rgb(var(--color-text))]">
                        {reviewingLeave.reason}
                      </p>
                    </div>
                  </div>
                )}
                {reviewingLeave && (
                  <div className="bg-mountain-50 p-4 rounded-xl border border-mountain-100 mt-4">
                    <h3 className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-3 border-b border-mountain-200 pb-2">
                      Staff Leave Balance (
                      {new Date(reviewingLeave.startDate).getFullYear()})
                    </h3>
                    <div className="space-y-3">
                      {(() => {
                        const currentYear = new Date(
                          reviewingLeave.startDate,
                        ).getFullYear();
                        const balance = leaveBalances.find(
                          (b) =>
                            b.staffId === reviewingLeave.staffId &&
                            b.year === currentYear,
                        );

                        if (
                          !balance ||
                          !balance.assignments ||
                          balance.assignments.length === 0
                        ) {
                          return (
                            <p className="text-[11px] text-mountain-400 italic">
                              No leave types assigned to this staff member for{" "}
                              {currentYear}.
                            </p>
                          );
                        }

                        return balance.assignments
                          .filter((a) => a.isActive)
                          .map((assignment) => {
                            const remaining = Math.max(
                              0,
                              assignment.assignedDays - assignment.usedDays,
                            );
                            const isCurrentType =
                              assignment.leaveTypeId ===
                              reviewingLeave.leaveType;
                            const leaveTypeObj = globalLeaveTypes.find(
                              (lt) => lt.id === assignment.leaveTypeId,
                            );

                            return (
                              <div
                                key={assignment.leaveTypeId}
                                className={`p-2 rounded-lg border ${
                                  isCurrentType
                                    ? "bg-primary/5 border-primary/20"
                                    : "bg-white border-mountain-100"
                                }`}
                              >
                                <div className="flex justify-between items-center text-[11px] mb-1">
                                  <span className="font-semibold text-mountain-800">
                                    {leaveTypeObj?.name ||
                                      assignment.leaveTypeId}
                                    {isCurrentType && (
                                      <span className="ml-2 text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                        Requested
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-mountain-600">
                                    {remaining} / {assignment.assignedDays} Days
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-mountain-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${isCurrentType ? "bg-primary" : "bg-mountain-300"}`}
                                    style={{
                                      width: `${Math.min(100, (assignment.usedDays / assignment.assignedDays) * 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          });
                      })()}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                    Manager Note{" "}
                    <span className="text-rose-400">
                      (required for rejection)
                    </span>
                  </label>
                  <Textarea
                    minRows={2}
                    placeholder="Add a note (e.g. Approved. Please arrange handover.)"
                    size="sm"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button size="sm" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button
                  className="font-bold"
                  color="danger"
                  isLoading={reviewLoading}
                  size="sm"
                  startContent={<IoCloseOutline />}
                  variant="flat"
                  onPress={handleRejectLeave}
                >
                  Reject
                </Button>
                <Button
                  className="font-bold"
                  color="success"
                  isLoading={reviewLoading}
                  size="sm"
                  startContent={<IoCheckmarkOutline />}
                  onPress={handleApproveLeave}
                >
                  Approve
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Add Staff Modal */}

      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
          header:
            "border-b border-[rgb(var(--color-border))] py-4 bg-[rgb(var(--color-surface))]",
          footer:
            "border-t border-[rgb(var(--color-border))] py-4 bg-[rgb(var(--color-surface))]",
          closeButton: "hover:bg-default-100 active:bg-default-200",
        }}
        isOpen={isStaffModalOpen}
        scrollBehavior="outside"
        size="5xl"
        onOpenChange={setIsStaffModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleSaveStaff}>
              <ModalHeader>
                <div className="flex flex-col">
                  <h2 className="text-[17px] font-semibold text-primary tracking-tight">
                    {staffForm.id ? "Edit Staff Profile" : "Register new staff"}
                  </h2>
                  <p className="text-[11.5px] text-[rgb(var(--color-text-muted))] font-medium">
                    {staffForm.id
                      ? "Update employee records and performance metrics."
                      : "Add a new employee to your clinic's HR system."}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-6 md:col-span-4">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Full Name
                    </label>
                    <Input
                      placeholder="e.g. John Doe"
                      size="sm"
                      value={staffForm.name}
                      onChange={(e) =>
                        setStaffForm({ ...staffForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Job Role
                    </label>
                    <Select
                      placeholder="Select role"
                      selectedKeys={[staffForm.role]}
                      size="sm"
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;

                        setStaffForm({ ...staffForm, role: selectedKey });
                      }}
                    >
                      <SelectItem key="Doctor">Doctor</SelectItem>
                      <SelectItem key="Pharmacist">Pharmacist</SelectItem>
                      <SelectItem key="Nurse">Nurse</SelectItem>
                      <SelectItem key="Receptionist">Receptionist</SelectItem>
                      <SelectItem key="Lab Technician">
                        Lab Technician
                      </SelectItem>
                      <SelectItem key="Admin">Admin / Manager</SelectItem>
                      <SelectItem key="Staff">General Staff</SelectItem>
                    </Select>
                  </div>

                  <div className="col-span-6 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Age
                    </label>
                    <Input
                      placeholder="Age"
                      size="sm"
                      type="number"
                      value={staffForm.age}
                      onChange={(e) =>
                        setStaffForm({ ...staffForm, age: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Phone Number
                    </label>
                    <Input
                      placeholder="Contact number"
                      size="sm"
                      value={staffForm.phone}
                      onChange={(e) =>
                        setStaffForm({ ...staffForm, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Email Address
                    </label>
                    <Input
                      placeholder="Email address"
                      size="sm"
                      type="email"
                      value={staffForm.email}
                      onChange={(e) =>
                        setStaffForm({ ...staffForm, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Monthly Salary (Rs.)
                    </label>
                    <Input
                      placeholder="0.00"
                      size="sm"
                      startContent={
                        <span className="text-[12px] text-text-muted">Rs.</span>
                      }
                      type="number"
                      value={staffForm.salary}
                      onChange={(e) =>
                        setStaffForm({ ...staffForm, salary: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1.5 block">
                      Default Commission (%)
                    </label>
                    <Input
                      endContent={
                        <span className="text-[12px] text-text-muted">%</span>
                      }
                      placeholder="0"
                      size="sm"
                      type="number"
                      value={staffForm.defaultCommission}
                      onChange={(e) =>
                        setStaffForm({
                          ...staffForm,
                          defaultCommission: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Joining Date
                    </label>
                    <Input
                      size="sm"
                      type="date"
                      value={staffForm.joiningDate}
                      onChange={(e) =>
                        setStaffForm({
                          ...staffForm,
                          joiningDate: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Residential Address
                    </label>
                    <Input
                      placeholder="Residential address"
                      size="sm"
                      value={staffForm.address}
                      onChange={(e) =>
                        setStaffForm({ ...staffForm, address: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Staff Photo
                    </label>
                    <FileUploadComponent
                      currentFile={
                        staffForm.photoUrl
                          ? {
                              id: "",
                              name: "Profile Photo",
                              url: staffForm.photoUrl,
                              type: "image/jpeg",
                            }
                          : undefined
                      }
                      uploadType="image"
                      onUploadComplete={(result) =>
                        setStaffForm({ ...staffForm, photoUrl: result.fileUrl })
                      }
                    />
                  </div>

                  <div className="col-span-6">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Internal Performance Dossier Notes
                    </label>
                    <Textarea
                      minRows={2}
                      placeholder="e.g. High performance doctor, specializes in surgical support..."
                      size="sm"
                      value={staffForm.performanceNotes}
                      onChange={(e) =>
                        setStaffForm({
                          ...staffForm,
                          performanceNotes: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Shift Starts
                    </label>
                    <Input
                      size="sm"
                      type="time"
                      value={staffForm.shiftStartTime}
                      onChange={(e) =>
                        setStaffForm({
                          ...staffForm,
                          shiftStartTime: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Shift Ends
                    </label>
                    <Input
                      size="sm"
                      type="time"
                      value={staffForm.shiftEndTime}
                      onChange={(e) =>
                        setStaffForm({
                          ...staffForm,
                          shiftEndTime: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Task Completion %
                    </label>
                    <Input
                      endContent={
                        <span className="text-[12px] text-text-muted">%</span>
                      }
                      placeholder="85"
                      size="sm"
                      type="number"
                      value={staffForm.taskCompletionScore}
                      onChange={(e) =>
                        setStaffForm({
                          ...staffForm,
                          taskCompletionScore: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Leave Assignments */}
                  <div className="col-span-6 mt-4 pt-4 border-t border-[rgb(var(--color-border))]">
                    <div className="flex items-center gap-2 mb-4">
                      <IoLeafOutline className="text-gray-500" size={16} />
                      <h3 className="text-[13px] font-bold text-gray-800 uppercase tracking-wider">
                        Leave Assignments
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {globalLeaveTypes.map((type) => {
                        const existing = staffForm.assignments.find(
                          (a) => a.leaveTypeId === type.id,
                        );
                        const isAssigned = existing ? existing.isActive : false;
                        const assignedDays = existing
                          ? existing.assignedDays
                          : type.defaultDays;

                        return (
                          <div
                            key={type.id}
                            className={`p-3 border rounded-xl flex flex-col gap-2 transition-colors ${isAssigned ? "border-primary/30 bg-primary/5" : "border-gray-200 bg-gray-50/50"}`}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2.5 h-2.5 rounded-full ${type.color}`}
                                />
                                <span className="text-[12px] font-bold text-gray-700">
                                  {type.name}
                                </span>
                              </div>
                              <Switch
                                isSelected={isAssigned}
                                size="sm"
                                onValueChange={(val) => {
                                  setStaffForm((prev) => {
                                    const filtered = prev.assignments.filter(
                                      (a) => a.leaveTypeId !== type.id,
                                    );

                                    if (val) {
                                      filtered.push({
                                        leaveTypeId: type.id,
                                        assignedDays: type.defaultDays,
                                        usedDays: existing
                                          ? existing.usedDays
                                          : 0,
                                        isActive: true,
                                      });
                                    } else if (
                                      existing &&
                                      existing.usedDays > 0
                                    ) {
                                      filtered.push({
                                        ...existing,
                                        isActive: false,
                                      });
                                    }

                                    return { ...prev, assignments: filtered };
                                  });
                                }}
                              />
                            </div>

                            <div
                              className={`flex items-center gap-2 ${!isAssigned && "opacity-50 pointer-events-none"}`}
                            >
                              <span className="text-[10px] text-gray-500 flex-1">
                                Days / Year:
                              </span>
                              <Input
                                className="w-20"
                                size="sm"
                                type="number"
                                value={assignedDays.toString()}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;

                                  setStaffForm((prev) => {
                                    const next = [...prev.assignments];
                                    const idx = next.findIndex(
                                      (a) => a.leaveTypeId === type.id,
                                    );

                                    if (idx >= 0) {
                                      next[idx].assignedDays = val;
                                    } else {
                                      next.push({
                                        leaveTypeId: type.id,
                                        assignedDays: val,
                                        usedDays: 0,
                                        isActive: true,
                                      });
                                    }

                                    return { ...prev, assignments: next };
                                  });
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!staffForm.id && (
                    <div className="col-span-6 mt-4 space-y-4 pt-4 border-t border-[rgb(var(--color-border))]">
                      <div className="flex items-center gap-2">
                        <input
                          checked={staffForm.createAccount}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          id="createAccount"
                          type="checkbox"
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              createAccount: e.target.checked,
                            })
                          }
                        />
                        <label
                          className="text-[13px] font-bold text-primary cursor-pointer"
                          htmlFor="createAccount"
                        >
                          Create login account for this staff member
                        </label>
                      </div>

                      {staffForm.createAccount && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="col-span-2 md:col-span-1">
                            <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                              Login Password
                            </label>
                            <Input
                              placeholder="Set staff password"
                              size="sm"
                              type="password"
                              value={staffForm.password}
                              onChange={(e) =>
                                setStaffForm({
                                  ...staffForm,
                                  password: e.target.value,
                                })
                              }
                            />
                            <p className="text-[9px] text-[rgb(var(--color-text-muted))] mt-1">
                              Minimum 6 characters
                            </p>
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className="text-[11px] font-bold text-health-600 uppercase tracking-wider mb-1.5 block">
                              Verify Admin Password
                            </label>
                            <Input
                              placeholder="Your current password"
                              size="sm"
                              type="password"
                              value={staffForm.adminPassword}
                              onChange={(e) =>
                                setStaffForm({
                                  ...staffForm,
                                  adminPassword: e.target.value,
                                })
                              }
                            />
                            <p className="text-[9px] text-health-600 mt-1">
                              Required to confirm this action
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  className="font-semibold text-[13px]"
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-semibold text-[13px] px-8"
                  color="primary"
                  isLoading={saving}
                  type="submit"
                >
                  {staffForm.id ? "Update Record" : "Register staff"}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
      {/* Staff Detail Modal */}
      <Modal
        backdrop="blur"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] min-h-[85vh] !max-w-[1200px]",
          header:
            "border-b border-[rgb(var(--color-border))] py-5 bg-[rgb(var(--color-surface))]",
          footer:
            "border-t border-[rgb(var(--color-border))] py-4 bg-[rgb(var(--color-surface))]",
        }}
        isOpen={isDetailModalOpen}
        scrollBehavior="inside"
        size="5xl"
        onOpenChange={setIsDetailModalOpen}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <div className="flex items-center justify-between w-full pr-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] flex items-center justify-center overflow-hidden">
                      {selectedStaff?.photoUrl ? (
                        <img
                          alt=""
                          className="w-full h-full object-cover"
                          src={selectedStaff.photoUrl}
                        />
                      ) : (
                        <span className="text-[24px] font-black text-primary/40">
                          {selectedStaff?.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-[15px] font-bold text-[rgb(var(--color-text))] tracking-tight">
                        {selectedStaff?.name}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[8.5px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20 uppercase tracking-widest">
                          {selectedStaff?.role}
                        </span>
                        <span
                          className={`text-[8.5px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${selectedStaff?.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"}`}
                        >
                          {selectedStaff?.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mr-4">
                    <Button
                      className="font-bold text-[10px] uppercase tracking-widest h-7"
                      color="primary"
                      size="sm"
                      startContent={<IoCreateOutline />}
                      variant="flat"
                      onPress={() => {
                        if (selectedStaff) {
                          handleEditStaff(selectedStaff);
                        }
                      }}
                    >
                      Edit Profile
                    </Button>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody className="py-6">
                {selectedStaff && (
                  <div className="space-y-6">
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-[0.15em] opacity-60 mb-1">
                          Present Days
                        </p>
                        <p className="text-[16px] font-bold text-primary">
                          {
                            attendance.filter(
                              (a) =>
                                a.staffId === selectedStaff.id &&
                                (a.status === "present" || a.status === "late"),
                            ).length
                          }{" "}
                          Days
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/30 col-span-2 md:col-span-2">
                        <p className="text-[8.5px] font-semibold text-rose-500 uppercase tracking-[0.15em] opacity-80 mb-1">
                          Total Leaves (Since Joining)
                        </p>
                        {(() => {
                          // Generate array of all months from joining date to current month
                          const joiningDate = new Date(
                            selectedStaff.joiningDate,
                          );
                          const currentDate = new Date();
                          const monthsToCalculate = [];

                          let current = new Date(
                            joiningDate.getFullYear(),
                            joiningDate.getMonth(),
                            1,
                          );

                          while (current <= currentDate) {
                            monthsToCalculate.push(
                              format(current, "MMMM yyyy"),
                            );
                            current.setMonth(current.getMonth() + 1);
                          }

                          // Fallback if somehow empty
                          if (monthsToCalculate.length === 0)
                            monthsToCalculate.push(
                              format(currentDate, "MMMM yyyy"),
                            );

                          const stats = getLeaveDetails(monthsToCalculate);

                          return (
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                <div className="flex items-end gap-1.5">
                                  <p className="text-[16px] font-bold text-rose-600">
                                    {stats.absentDays}
                                  </p>
                                  <p className="text-[10px] font-semibold text-rose-600/70 pb-0.5">
                                    Total Taken
                                  </p>
                                </div>
                              </div>

                              <div className="h-6 w-px bg-rose-200/50" />

                              <div className="flex flex-col">
                                <div className="flex items-end gap-1.5">
                                  <p className="text-[16px] font-bold text-mountain-600">
                                    {stats.unpaidLeaves}
                                  </p>
                                  <p className="text-[10px] font-semibold text-mountain-500 pb-0.5">
                                    Unpaid Leaves
                                  </p>
                                </div>
                                <p className="text-[9px] text-mountain-400 mt-0.5">
                                  All-time history
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-[0.15em] opacity-60 mb-1">
                          Total Paid
                        </p>
                        <p className="text-[16px] font-bold text-[rgb(var(--color-text))]">
                          Rs.{" "}
                          {bills
                            .filter(
                              (b) =>
                                b.category === "salary" &&
                                b.vendorName === selectedStaff.name,
                            )
                            .reduce((acc, b) => acc + b.paidAmount, 0)
                            .toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-[0.15em] opacity-60 mb-1">
                          Total Incentives
                        </p>
                        <p className="text-[16px] font-bold text-violet-600">
                          Rs.{" "}
                          {getIncentivesPaid(
                            selectedStaff.name,
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-[0.15em] opacity-60 mb-1">
                          Current Salary
                        </p>
                        <p className="text-[16px] font-bold text-[rgb(var(--color-text))]">
                          Rs. {selectedStaff.salary.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-[0.15em] opacity-60 mb-1">
                          Total Tax Paid
                        </p>
                        <p className="text-[16px] font-bold text-rose-500">
                          Rs. {getTaxPaid(selectedStaff.name).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Tabs
                      classNames={{
                        tabList: "gap-6",
                        tabContent: "font-bold text-[13px]",
                      }}
                      variant="underlined"
                    >
                      <Tab key="overview" title="Professional Overview">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                          <div className="space-y-4">
                            <h3 className="text-[11px] font-bold text-[rgb(var(--color-text))] uppercase tracking-widest border-b border-[rgb(var(--color-border))] pb-2 mb-4">
                              Contact Dossier
                            </h3>
                            <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                              <div>
                                <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                                  Direct Phone
                                </p>
                                <p className="text-[13.5px] font-medium text-[rgb(var(--color-text))]">
                                  {selectedStaff.phone}
                                </p>
                              </div>
                              <div>
                                <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                                  Email Address
                                </p>
                                <p className="text-[13.5px] font-medium text-[rgb(var(--color-text))]">
                                  {selectedStaff.email}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                                  Residential Address
                                </p>
                                <p className="text-[13.5px] font-medium text-[rgb(var(--color-text))]">
                                  {selectedStaff.address || "Not documented"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-[11px] font-bold text-[rgb(var(--color-text))] uppercase tracking-widest border-b border-[rgb(var(--color-border))] pb-2 mb-4">
                              Employment Registry
                            </h3>
                            <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                              <div>
                                <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                                  Joining Date
                                </p>
                                <p className="text-[13.5px] font-medium text-[rgb(var(--color-text))]">
                                  {format(
                                    new Date(selectedStaff.joiningDate),
                                    "MMM dd, yyyy",
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                                  Employee Age
                                </p>
                                <p className="text-[13.5px] font-medium text-[rgb(var(--color-text))]">
                                  {selectedStaff.age} Yrs
                                </p>
                              </div>
                              <div>
                                <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                                  Total Work Hours
                                </p>
                                <p className="text-[13.5px] font-bold text-primary">
                                  {attendance
                                    .filter(
                                      (a) => a.staffId === selectedStaff.id,
                                    )
                                    .reduce(
                                      (acc, a) => acc + (a.totalHours || 0),
                                      0,
                                    )
                                    .toFixed(1)}{" "}
                                  hrs
                                </p>
                              </div>
                              <div>
                                <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                                  System ID
                                </p>
                                <p className="text-[12px] font-mono text-[rgb(var(--color-text-muted))]">
                                  {selectedStaff.id.substring(0, 12)}...
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Tab>
                      <Tab key="performance" title="Performance & Notes">
                        <div className="py-4 space-y-4">
                          {(() => {
                            const staffAttendance = attendance.filter(
                              (a) => a.staffId === selectedStaff.id,
                            );
                            const lateCount = staffAttendance.filter(
                              (a) =>
                                a.status === "late" ||
                                (a.lateByMinutes && a.lateByMinutes > 0),
                            ).length;
                            const totalSessions = staffAttendance.length || 1;
                            const punctualityScore = Math.max(
                              0,
                              Math.round(
                                ((totalSessions - lateCount) / totalSessions) *
                                  100,
                              ),
                            );

                            const taskScore =
                              selectedStaff.taskCompletionScore || 85;

                            return (
                              <>
                                <div className="p-4 rounded-xl border border-primary/10 bg-primary/5">
                                  <h4 className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2">
                                    Internal Dossier Notes
                                  </h4>
                                  <p className="text-[12.5px] text-[rgb(var(--color-text))] leading-relaxed italic">
                                    {selectedStaff.performanceNotes ||
                                      `"High performance staff member. Specializes in ${selectedStaff.role === "Doctor" ? "clinical diagnostics" : "operational support"} and patient care."`}
                                  </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <Card
                                    className="bg-[rgb(var(--color-surface-2))/0.3] border border-[rgb(var(--color-border))]"
                                    shadow="none"
                                  >
                                    <CardBody className="p-3">
                                      <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-tighter mb-1">
                                        Punctuality Score
                                      </p>
                                      <div className="h-1.5 w-full bg-default-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${punctualityScore > 90 ? "bg-success" : "bg-warning"} transition-all`}
                                          style={{
                                            width: `${punctualityScore}%`,
                                          }}
                                        />
                                      </div>
                                      <div className="flex justify-between items-center mt-1">
                                        <p className="text-[9px] text-[rgb(var(--color-text-muted))] uppercase font-bold">
                                          {lateCount} Late Sessions
                                        </p>
                                        <p
                                          className={`text-[10px] font-bold ${punctualityScore > 90 ? "text-success" : "text-warning"}`}
                                        >
                                          {punctualityScore}%{" "}
                                          {punctualityScore > 90
                                            ? "Excellent"
                                            : "Good"}
                                        </p>
                                      </div>
                                    </CardBody>
                                  </Card>
                                  <Card
                                    className="bg-[rgb(var(--color-surface-2))/0.3] border border-[rgb(var(--color-border))]"
                                    shadow="none"
                                  >
                                    <CardBody className="p-3">
                                      <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-tighter mb-1">
                                        Task Completion
                                      </p>
                                      <div className="h-1.5 w-full bg-default-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-primary transition-all"
                                          style={{ width: `${taskScore}%` }}
                                        />
                                      </div>
                                      <p className="text-[10px] mt-1 font-bold text-primary text-right">
                                        {taskScore}%{" "}
                                        {taskScore >= 90
                                          ? "Exceptional"
                                          : taskScore >= 75
                                            ? "Very Good"
                                            : taskScore >= 50
                                              ? "Average"
                                              : "Needs Improvement"}
                                      </p>
                                    </CardBody>
                                  </Card>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </Tab>
                      <Tab key="attendance" title="Attendance History">
                        <div className="py-4">
                          <Table
                            aria-label="Attendance history"
                            classNames={{
                              th: "text-[10px] uppercase",
                              td: "text-[12px]",
                            }}
                            shadow="none"
                          >
                            <TableHeader>
                              <TableColumn>Date</TableColumn>
                              <TableColumn>Check In</TableColumn>
                              <TableColumn>Check Out</TableColumn>
                              <TableColumn>Status</TableColumn>
                              <TableColumn align="center">
                                Total Duration
                              </TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No attendance records documented">
                              {attendance
                                .filter((a) => a.staffId === selectedStaff.id)
                                .sort(
                                  (a, b) => b.date.getTime() - a.date.getTime(),
                                )
                                .map((record, index) => (
                                  <TableRow key={record.id || `attn-${index}`}>
                                    <TableCell>
                                      {format(record.date, "MMM dd, yyyy")}
                                    </TableCell>
                                    <TableCell>
                                      {record.checkIn
                                        ? format(record.checkIn, "hh:mm a")
                                        : "---"}
                                    </TableCell>
                                    <TableCell>
                                      {record.checkOut
                                        ? format(record.checkOut, "hh:mm a")
                                        : "---"}
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${record.status === "present" || record.status === "late" ? (record.checkOut ? "bg-primary/10 text-primary" : record.status === "late" ? "bg-amber-500/10 text-amber-500" : "bg-success/10 text-success") : "bg-rose-500/10 text-rose-500"}`}
                                      >
                                        {record.status === "present" ||
                                        record.status === "late"
                                          ? record.checkOut
                                            ? "Completed"
                                            : record.status === "late"
                                              ? "Late"
                                              : "On Duty"
                                          : record.status}
                                      </span>
                                    </TableCell>
                                    <TableCell
                                      align="center"
                                      className="font-bold text-primary"
                                    >
                                      {formatDuration(
                                        record.checkIn,
                                        record.checkOut,
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      </Tab>
                      <Tab key="payroll" title="Salary History">
                        <div className="py-4">
                          <Table
                            aria-label="Salary history"
                            classNames={{
                              th: "text-[10px] uppercase",
                              td: "text-[12px]",
                            }}
                            shadow="none"
                          >
                            <TableHeader>
                              <TableColumn>Bill #</TableColumn>
                              <TableColumn>Payment Date</TableColumn>
                              <TableColumn>Description</TableColumn>
                              <TableColumn>Amount Paid</TableColumn>
                              <TableColumn>Method</TableColumn>
                              <TableColumn>Status</TableColumn>
                              <TableColumn align="center">Actions</TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No salary payments found">
                              {bills
                                .filter(
                                  (b) =>
                                    b.category === "salary" &&
                                    b.vendorName === selectedStaff.name,
                                )
                                .sort(
                                  (a, b) =>
                                    b.billDate.getTime() - a.billDate.getTime(),
                                )
                                .map((bill, index) => (
                                  <TableRow key={bill.id || `bill-${index}`}>
                                    <TableCell className="font-mono">
                                      {bill.billNumber}
                                    </TableCell>
                                    <TableCell>
                                      {format(bill.billDate, "MMM dd, yyyy")}
                                    </TableCell>
                                    <TableCell className="text-[11.5px] text-[rgb(var(--color-text-muted))] max-w-[200px] truncate">
                                      {bill.description}
                                    </TableCell>
                                    <TableCell className="font-bold text-success">
                                      Rs. {bill.paidAmount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="capitalize">
                                      {bill.paymentMethod || "Cash"}
                                    </TableCell>
                                    <TableCell>
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-success/10 text-success">
                                        Paid
                                      </span>
                                    </TableCell>
                                    <TableCell align="center">
                                      <Button
                                        isIconOnly
                                        className="h-7 w-7"
                                        color="primary"
                                        size="sm"
                                        variant="light"
                                        onPress={() =>
                                          handlePrintSalarySlip(bill)
                                        }
                                      >
                                        <IoPrintOutline size={16} />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      </Tab>
                      <Tab key="tax" title="Tax Records">
                        <div className="py-4">
                          <Table
                            aria-label="Tax history"
                            classNames={{
                              th: "text-[10px] uppercase",
                              td: "text-[12px]",
                            }}
                            shadow="none"
                          >
                            <TableHeader>
                              <TableColumn>Bill #</TableColumn>
                              <TableColumn>Payment Date</TableColumn>
                              <TableColumn>Description</TableColumn>
                              <TableColumn>Tax Deducted</TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No tax records found">
                              {bills
                                .filter(
                                  (b) =>
                                    b.category === "salary" &&
                                    b.vendorName === selectedStaff.name &&
                                    b.description?.match(
                                      /Tax\s+Rs\.?\s*([\d,]+)/i,
                                    ),
                                )
                                .sort(
                                  (a, b) =>
                                    b.billDate.getTime() - a.billDate.getTime(),
                                )
                                .map((bill, index) => {
                                  const match = bill.description?.match(
                                    /Tax\s+Rs\.?\s*([\d,]+)/i,
                                  );
                                  const taxAmount = match
                                    ? parseFloat(match[1].replace(/,/g, ""))
                                    : 0;

                                  return (
                                    <TableRow key={bill.id || `tax-${index}`}>
                                      <TableCell className="font-mono">
                                        {bill.billNumber}
                                      </TableCell>
                                      <TableCell>
                                        {format(bill.billDate, "MMM dd, yyyy")}
                                      </TableCell>
                                      <TableCell className="text-[11.5px] text-[rgb(var(--color-text-muted))] max-w-[200px] truncate">
                                        {bill.description}
                                      </TableCell>
                                      <TableCell className="font-bold text-rose-500">
                                        Rs. {taxAmount.toLocaleString()}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      </Tab>
                      <Tab
                        key="commissions"
                        title={
                          <div className="flex items-center gap-2">
                            <span>Referral Commissions</span>
                            {(selectedStaff.totalCommissionBalance || 0) >
                              0 && (
                              <span className="bg-primary text-white text-[9px] px-1.5 py-0.5 rounded-full">
                                Pending
                              </span>
                            )}
                          </div>
                        }
                      >
                        <div className="py-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <Card
                              className="bg-primary/5 border border-primary/20"
                              shadow="none"
                            >
                              <CardBody className="p-4 flex flex-row items-center justify-between">
                                <div>
                                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest opacity-70 mb-1">
                                    Total Commission Earned
                                  </p>
                                  <h4 className="text-[20px] font-bold text-primary">
                                    Rs.{" "}
                                    {(
                                      selectedStaff.totalCommissionEarned || 0
                                    ).toLocaleString()}
                                  </h4>
                                </div>
                              </CardBody>
                            </Card>
                            <Card
                              className="bg-success/5 border border-success/20"
                              shadow="none"
                            >
                              <CardBody className="p-4 flex flex-row items-center justify-between">
                                <div>
                                  <p className="text-[10px] font-bold text-success uppercase tracking-widest opacity-70 mb-1">
                                    Current Pending Balance
                                  </p>
                                  <h4 className="text-[20px] font-bold text-success">
                                    Rs.{" "}
                                    {(
                                      selectedStaff.totalCommissionBalance || 0
                                    ).toLocaleString()}
                                  </h4>
                                </div>
                              </CardBody>
                            </Card>
                          </div>

                          <Table
                            aria-label="Referral commissions"
                            classNames={{
                              th: "text-[10px] uppercase",
                              td: "text-[12px]",
                            }}
                            shadow="none"
                          >
                            <TableHeader>
                              <TableColumn>Date</TableColumn>
                              <TableColumn>Patient</TableColumn>
                              <TableColumn>Service</TableColumn>
                              <TableColumn>Commission</TableColumn>
                              <TableColumn>Amount</TableColumn>
                              <TableColumn>Status</TableColumn>
                              <TableColumn align="center">Action</TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No referral commissions documented">
                              {staffCommissions.map((comm, index) => (
                                <TableRow key={comm.id || `comm-${index}`}>
                                  <TableCell>
                                    {format(
                                      new Date(comm.appointmentDate),
                                      "MMM dd, yyyy",
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-semibold">
                                      {comm.patientName}
                                    </div>
                                    <div className="text-[10px] text-text-muted">
                                      {comm.invoiceNumber}
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-[150px] truncate">
                                    {comm.serviceNames.join(", ")}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium text-primary">
                                      {comm.commissionPercentage}%
                                    </div>
                                    <div className="text-[10px] text-text-muted">
                                      of Rs.{" "}
                                      {comm.totalInvoiceAmount.toLocaleString()}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-bold">
                                    Rs. {comm.commissionAmount.toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${comm.status === "paid" ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-500"}`}
                                    >
                                      {comm.status}
                                    </span>
                                  </TableCell>
                                  <TableCell align="center">
                                    {comm.status === "pending" && (
                                      <Button
                                        className="h-7 text-[10px] font-bold"
                                        color="primary"
                                        size="sm"
                                        variant="flat"
                                        onPress={() => {
                                          setSelectedCommission(comm);
                                          setCommissionPayForm({
                                            amount:
                                              comm.commissionAmount -
                                              (comm.paidAmount || 0),
                                            paymentMethod: "Cash",
                                            notes: `Commission for patient: ${comm.patientName}`,
                                            reference: "",
                                          });
                                          setIsCommissionPayModalOpen(true);
                                        }}
                                      >
                                        Pay
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </Tab>
                    </Tabs>
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="justify-between">
                <Button
                  className="font-bold"
                  color="primary"
                  onPress={() => {
                    const currentMonth = format(new Date(), "MMMM yyyy");

                    setPayrollForm({
                      ...payrollForm,
                      amount: calculateExpectedAmount(
                        [currentMonth],
                        "regular",
                        0,
                      ),
                      selectedMonths: [currentMonth],
                      notes: "",
                      waivedDays: 0,
                      includeCommission: false,
                      incentive: 0,
                      applyTax: false,
                      taxPercentage: 1,
                    });
                    setIsPayModalOpen(true);
                  }}
                >
                  Pay Salary
                </Button>
                <Button
                  className="font-bold"
                  color="danger"
                  size="sm"
                  variant="flat"
                  onPress={() => setIsDetailModalOpen(false)}
                >
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Absent Leave Type Modal */}
      <Modal
        classNames={{ base: "bg-white border border-mountain-200 shadow-xl" }}
        isOpen={isAbsentModalOpen}
        size="sm"
        onClose={() => {
          setIsAbsentModalOpen(false);
          setAbsentTarget(null);
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 border-b border-mountain-100 pb-3">
            <h2 className="text-[15px] font-bold text-mountain-900">
              Mark Absence
            </h2>
            <p className="text-[12px] text-mountain-500 font-normal">
              {absentTarget?.name} — Select leave type
            </p>
          </ModalHeader>
          <ModalBody className="py-5">
            <div className="flex flex-col gap-3">
              <button
                className="flex items-start gap-3 p-3 rounded-lg border-2 border-success/30 bg-success/5 hover:bg-success/10 transition-colors text-left"
                onClick={async () => {
                  if (!absentTarget) return;
                  setIsAbsentModalOpen(false);
                  await markAbsent(absentTarget, "paid");
                  setAbsentTarget(null);
                }}
              >
                <span className="mt-0.5 text-success text-xl">✓</span>
                <div>
                  <p className="text-[13px] font-bold text-success">
                    Paid Leave
                  </p>
                  <p className="text-[11px] text-mountain-500 mt-0.5">
                    Counts against their monthly leave quota (
                    {absentTarget?.allowedLeavesPerMonth ?? 4} days/mo). No
                    extra salary deduction unless quota is exceeded.
                  </p>
                </div>
              </button>
              <button
                className="flex items-start gap-3 p-3 rounded-lg border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors text-left"
                onClick={async () => {
                  if (!absentTarget) return;
                  setIsAbsentModalOpen(false);
                  await markAbsent(absentTarget, "unpaid");
                  setAbsentTarget(null);
                }}
              >
                <span className="mt-0.5 text-rose-600 text-xl">✗</span>
                <div>
                  <p className="text-[13px] font-bold text-rose-600">
                    Unpaid Leave
                  </p>
                  <p className="text-[11px] text-mountain-500 mt-0.5">
                    Salary will be deducted for this day regardless of remaining
                    leave quota.
                  </p>
                </div>
              </button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="font-semibold"
              size="sm"
              variant="flat"
              onPress={() => {
                setIsAbsentModalOpen(false);
                setAbsentTarget(null);
              }}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Salary Payment Modal */}

      <Modal
        backdrop="blur"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] min-h-[550px]",
        }}
        isOpen={isPayModalOpen}
        size="5xl"
        onOpenChange={setIsPayModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <div className="flex flex-col">
                  <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))] tracking-tight">
                    Confirm Payment
                  </h2>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-normal">
                    Recording salary for {selectedStaff?.name}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Side: Form Inputs */}
                  <div className="space-y-4">
                    <div>
                      <Tabs
                        className="mb-2"
                        classNames={{
                          tabList: "bg-mountain-50 border border-mountain-200",
                          cursor: "bg-white shadow-sm",
                          tab: "font-semibold text-mountain-600",
                        }}
                        selectedKey={payrollForm.paymentType}
                        size="sm"
                        onSelectionChange={(key) => {
                          const type = key as "regular" | "advance";

                          setPayrollForm({
                            ...payrollForm,
                            paymentType: type,
                            amount: calculateExpectedAmount(
                              payrollForm.selectedMonths,
                              type,
                              payrollForm.waivedDays,
                            ),
                          });
                        }}
                      >
                        <Tab key="regular" title="Regular Salary" />
                        <Tab key="advance" title="Advance Payment" />
                      </Tabs>

                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                          Salary Month(s)
                        </label>
                        <Select
                          aria-label="Salary Month(s)"
                          classNames={{ trigger: "h-10" }}
                          placeholder="Select months"
                          selectedKeys={new Set(payrollForm.selectedMonths)}
                          selectionMode="multiple"
                          size="sm"
                          onSelectionChange={(keys) => {
                            const selected = Array.from(keys) as string[];

                            setPayrollForm({
                              ...payrollForm,
                              selectedMonths: selected,
                              amount: calculateExpectedAmount(
                                selected,
                                payrollForm.paymentType,
                                payrollForm.waivedDays,
                              ),
                            });
                          }}
                        >
                          {availableMonths.map((month) => (
                            <SelectItem key={month}>{month}</SelectItem>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                        Amount (Rs.)
                      </label>
                      <Input
                        size="sm"
                        startContent={
                          <span className="text-[12px] text-text-muted">
                            Rs.
                          </span>
                        }
                        type="number"
                        value={payrollForm.amount.toString()}
                        onChange={(e) =>
                          setPayrollForm({
                            ...payrollForm,
                            amount: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    {payrollForm.paymentType !== "advance" && (
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                            Incentive (Rs.)
                          </label>
                          <Input
                            placeholder="0"
                            size="sm"
                            startContent={
                              <span className="text-[12px] text-text-muted">
                                Rs.
                              </span>
                            }
                            type="number"
                            value={
                              payrollForm.incentive === 0
                                ? ""
                                : payrollForm.incentive.toString()
                            }
                            onChange={(e) =>
                              setPayrollForm({
                                ...payrollForm,
                                incentive: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                              Custom Bonus (Rs.)
                            </label>
                            <Input
                              placeholder="0"
                              size="sm"
                              startContent={
                                <span className="text-[12px] text-text-muted">
                                  Rs.
                                </span>
                              }
                              type="number"
                              value={
                                payrollForm.customBonus === 0
                                  ? ""
                                  : payrollForm.customBonus.toString()
                              }
                              onChange={(e) =>
                                setPayrollForm({
                                  ...payrollForm,
                                  customBonus: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                              Bonus Reason
                            </label>
                            <Input
                              placeholder="e.g. Overtime"
                              size="sm"
                              value={payrollForm.customBonusNotes}
                              onChange={(e) =>
                                setPayrollForm({
                                  ...payrollForm,
                                  customBonusNotes: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                              Custom Deduction (Rs.)
                            </label>
                            <Input
                              placeholder="0"
                              size="sm"
                              startContent={
                                <span className="text-[12px] text-text-muted">
                                  Rs.
                                </span>
                              }
                              type="number"
                              value={
                                payrollForm.customDeduction === 0
                                  ? ""
                                  : payrollForm.customDeduction.toString()
                              }
                              onChange={(e) =>
                                setPayrollForm({
                                  ...payrollForm,
                                  customDeduction: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                              Deduction Reason
                            </label>
                            <Input
                              placeholder="e.g. Uniform"
                              size="sm"
                              value={payrollForm.customDeductionNotes}
                              onChange={(e) =>
                                setPayrollForm({
                                  ...payrollForm,
                                  customDeductionNotes: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 border border-rose-100 bg-rose-50/50 p-2.5 rounded-lg">
                          <Checkbox
                            classNames={{
                              label: "text-[11px] text-rose-700 font-semibold",
                            }}
                            isSelected={payrollForm.applyTax}
                            size="sm"
                            onValueChange={(val) =>
                              setPayrollForm((prev) => ({
                                ...prev,
                                applyTax: val,
                              }))
                            }
                          >
                            Apply Tax Deduction
                          </Checkbox>

                          {payrollForm.applyTax && (
                            <div className="pl-6 pt-1">
                              <label className="text-[10px] font-bold text-rose-600/70 uppercase tracking-widest mb-1 block">
                                Tax Percentage (%)
                              </label>
                              <Input
                                classNames={{
                                  input:
                                    "text-[13px] font-semibold text-rose-700",
                                  innerWrapper: "bg-transparent",
                                  inputWrapper:
                                    "border-rose-200 hover:border-rose-300 focus-within:border-rose-400 bg-white",
                                }}
                                placeholder="1"
                                size="sm"
                                type="number"
                                value={payrollForm.taxPercentage.toString()}
                                variant="bordered"
                                onChange={(e) =>
                                  setPayrollForm({
                                    ...payrollForm,
                                    taxPercentage: Number(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                        Payment Method
                      </label>
                      <Select
                        aria-label="Payment Method"
                        selectedKeys={[payrollForm.paymentMethod]}
                        size="sm"
                        onSelectionChange={(keys) =>
                          setPayrollForm({
                            ...payrollForm,
                            paymentMethod: Array.from(keys)[0] as string,
                          })
                        }
                      >
                        <SelectItem key="Cash">Cash</SelectItem>
                        <SelectItem key="Bank Transfer">
                          Bank Transfer
                        </SelectItem>
                        <SelectItem key="Cheque">Cheque</SelectItem>
                        <SelectItem key="E-Sewa">E-Sewa / Khalti</SelectItem>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                        Notes
                      </label>
                      <Textarea
                        placeholder="e.g. Paid for May month including bonus"
                        size="sm"
                        value={payrollForm.notes}
                        onChange={(e) =>
                          setPayrollForm({
                            ...payrollForm,
                            notes: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Right Side: Summary Pane */}
                  <div className="bg-mountain-50 border border-mountain-200 rounded-xl p-4 flex flex-col justify-center">
                    <h3 className="text-[11px] font-bold text-mountain-600 uppercase tracking-widest mb-3 border-b border-mountain-200 pb-2">
                      Payment Summary
                    </h3>
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-mountain-600">
                          Months Selected:
                        </span>
                        <span className="font-semibold text-mountain-900">
                          {payrollForm.selectedMonths.length}
                        </span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-mountain-600">
                          Expected Salary:
                        </span>
                        <span className="font-semibold text-mountain-900">
                          Rs.{" "}
                          {(
                            (selectedStaff?.salary || 0) *
                            (payrollForm.selectedMonths.length || 1)
                          ).toLocaleString()}
                        </span>
                      </div>
                      {getLeaveDetails(payrollForm.selectedMonths).absentDays >
                        0 && (
                        <div className="flex flex-col gap-2 border-t border-b border-mountain-200/50 py-2 my-2">
                          <div className="flex justify-between text-[12px] text-mountain-700 font-semibold">
                            <span>Total Leave Breakdown:</span>
                            <span>
                              {
                                getLeaveDetails(payrollForm.selectedMonths)
                                  .absentDays
                              }{" "}
                              Days Taken
                            </span>
                          </div>

                          <div className="flex flex-col gap-1 pl-2 border-l-2 border-mountain-200">
                            {getLeaveDetails(payrollForm.selectedMonths)
                              .unpaidLeaves > 0 && (
                              <div className="flex justify-between text-[11px] text-rose-500">
                                <span>Unpaid Leaves:</span>
                                <span>
                                  {
                                    getLeaveDetails(payrollForm.selectedMonths)
                                      .unpaidLeaves
                                  }{" "}
                                  Days
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="text-[9px] text-mountain-400 text-right leading-tight self-end mt-1 italic">
                            Dates:{" "}
                            {getLeaveDetails(
                              payrollForm.selectedMonths,
                            ).absentDates.join(", ")}
                          </div>
                        </div>
                      )}
                      {getLeaveDetails(payrollForm.selectedMonths)
                        .deductionAmount > 0 && (
                        <div className="flex flex-col gap-1 text-[12px] text-rose-600 bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                          <div className="flex justify-between">
                            <span className="font-semibold">
                              Leave Salary Deduction:
                            </span>
                            <span className={`font-bold`}>
                              - Rs.{" "}
                              {Math.round(
                                Math.max(
                                  0,
                                  getLeaveDetails(payrollForm.selectedMonths)
                                    .unpaidLeaves - payrollForm.waivedDays,
                                ) *
                                  getLeaveDetails(payrollForm.selectedMonths)
                                    .dailyWage,
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[10px] text-rose-500/80 text-right">
                            (
                            {Math.max(
                              0,
                              getLeaveDetails(payrollForm.selectedMonths)
                                .unpaidLeaves - payrollForm.waivedDays,
                            )}{" "}
                            unpaid days @ Rs.{" "}
                            {Math.round(
                              getLeaveDetails(payrollForm.selectedMonths)
                                .dailyWage,
                            ).toLocaleString()}
                            /day)
                          </div>
                          <div className="flex items-center justify-between text-mountain-500 mt-1">
                            <span className="text-[10px]">
                              Waive deductions (Days):
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                isIconOnly
                                className="h-6 w-6 min-w-0"
                                isDisabled={payrollForm.waivedDays <= 0}
                                size="sm"
                                variant="flat"
                                onPress={() => {
                                  setPayrollForm((prev) => ({
                                    ...prev,
                                    waivedDays: Math.max(
                                      0,
                                      prev.waivedDays - 1,
                                    ),
                                    amount: calculateExpectedAmount(
                                      prev.selectedMonths,
                                      prev.paymentType,
                                      Math.max(0, prev.waivedDays - 1),
                                    ),
                                  }));
                                }}
                              >
                                -
                              </Button>
                              <span className="font-bold w-4 text-center text-mountain-700">
                                {payrollForm.waivedDays}
                              </span>
                              <Button
                                isIconOnly
                                className="h-6 w-6 min-w-0"
                                isDisabled={
                                  payrollForm.waivedDays >=
                                  getLeaveDetails(payrollForm.selectedMonths)
                                    .unpaidLeaves
                                }
                                size="sm"
                                variant="flat"
                                onPress={() => {
                                  setPayrollForm((prev) => ({
                                    ...prev,
                                    waivedDays: Math.min(
                                      getLeaveDetails(prev.selectedMonths)
                                        .unpaidLeaves,
                                      prev.waivedDays + 1,
                                    ),
                                    amount: calculateExpectedAmount(
                                      prev.selectedMonths,
                                      prev.paymentType,
                                      Math.min(
                                        getLeaveDetails(prev.selectedMonths)
                                          .unpaidLeaves,
                                        prev.waivedDays + 1,
                                      ),
                                    ),
                                  }));
                                }}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {getPreviouslyPaid(payrollForm.selectedMonths) > 0 && (
                        <div className="flex justify-between text-[12px] text-health-600">
                          <span>Previously Paid (Advance):</span>
                          <span className="font-semibold">
                            - Rs.{" "}
                            {getPreviouslyPaid(
                              payrollForm.selectedMonths,
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[13px] font-bold pt-2">
                        <span className="text-mountain-900">Due Amount:</span>
                        <span className="text-amber-600">
                          Rs.{" "}
                          {calculateExpectedAmount(
                            payrollForm.selectedMonths,
                            "regular",
                            payrollForm.waivedDays,
                          ).toLocaleString()}
                        </span>
                      </div>
                      {(selectedStaff?.totalCommissionBalance || 0) > 0 && (
                        <div className="flex flex-col gap-1 border border-violet-200 bg-violet-50 rounded-lg p-2 mt-1">
                          <div className="flex justify-between text-[12px] text-violet-700">
                            <span className="font-semibold">
                              Pending Commission:
                            </span>
                            <span className="font-bold">
                              + Rs.{" "}
                              {(
                                selectedStaff?.totalCommissionBalance || 0
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              classNames={{
                                label:
                                  "text-[10px] text-mountain-600 font-medium",
                              }}
                              isSelected={payrollForm.includeCommission}
                              size="sm"
                              onValueChange={(val) =>
                                setPayrollForm((prev) => ({
                                  ...prev,
                                  includeCommission: val,
                                }))
                              }
                            >
                              Include commission in this payout
                            </Checkbox>
                          </div>
                        </div>
                      )}
                      {payrollForm.incentive > 0 && (
                        <div className="flex justify-between text-[12px] text-violet-700">
                          <span>Incentives Added:</span>
                          <span className="font-semibold">
                            + Rs. {payrollForm.incentive.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {payrollForm.customBonus > 0 && (
                        <div className="flex justify-between text-[12px] text-violet-700">
                          <span>
                            Bonus ({payrollForm.customBonusNotes || "Custom"}):
                          </span>
                          <span className="font-semibold">
                            + Rs. {payrollForm.customBonus.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {payrollForm.applyTax && (
                        <div className="flex justify-between text-[12px] text-rose-600">
                          <span>
                            Tax Deducted ({payrollForm.taxPercentage}% of Base):
                          </span>
                          <span className="font-semibold">
                            - Rs.{" "}
                            {Math.round(
                              payrollForm.amount *
                                (payrollForm.taxPercentage / 100),
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {payrollForm.customDeduction > 0 && (
                        <div className="flex justify-between text-[12px] text-rose-600">
                          <span>
                            Deduction (
                            {payrollForm.customDeductionNotes || "Custom"}):
                          </span>
                          <span className="font-semibold">
                            - Rs. {payrollForm.customDeduction.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-mountain-200">
                        <span className="text-mountain-900">Total Payout:</span>
                        <span className="text-health-700">
                          Rs.{" "}
                          {(() => {
                            const subT =
                              payrollForm.amount +
                              (payrollForm.includeCommission
                                ? selectedStaff?.totalCommissionBalance || 0
                                : 0) +
                              payrollForm.incentive +
                              payrollForm.customBonus;
                            const taxAmt = payrollForm.applyTax
                              ? Math.round(
                                  payrollForm.amount *
                                    (payrollForm.taxPercentage / 100),
                                )
                              : 0;

                            return (
                              subT -
                              taxAmt -
                              payrollForm.customDeduction
                            ).toLocaleString();
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  className="font-bold text-[11px]"
                  color="default"
                  size="sm"
                  variant="flat"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-bold text-[11px]"
                  color="primary"
                  isLoading={saving}
                  size="sm"
                  onPress={handleDisburseSalary}
                >
                  Confirm & Pay
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Commission Payout Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
        }}
        isOpen={isCommissionPayModalOpen}
        size="md"
        onOpenChange={setIsCommissionPayModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <div className="flex flex-col">
                  <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))] tracking-tight">
                    Pay Referral Commission
                  </h2>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-normal">
                    Recording commission payment for {selectedStaff?.name}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                      Amount to Pay (Rs.)
                    </label>
                    <Input
                      size="sm"
                      startContent={
                        <span className="text-[12px] text-text-muted">Rs.</span>
                      }
                      type="number"
                      value={commissionPayForm.amount.toString()}
                      onChange={(e) =>
                        setCommissionPayForm({
                          ...commissionPayForm,
                          amount: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                      Payment Method
                    </label>
                    <Select
                      aria-label="Payment Method"
                      selectedKeys={[commissionPayForm.paymentMethod]}
                      size="sm"
                      onSelectionChange={(keys) =>
                        setCommissionPayForm({
                          ...commissionPayForm,
                          paymentMethod: Array.from(keys)[0] as string,
                        })
                      }
                    >
                      <SelectItem key="Cash">Cash</SelectItem>
                      <SelectItem key="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem key="Cheque">Cheque</SelectItem>
                      <SelectItem key="E-Sewa">E-Sewa / Khalti</SelectItem>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                      Reference (Optional)
                    </label>
                    <Input
                      placeholder="Transaction ID / Cheque #"
                      size="sm"
                      value={commissionPayForm.reference}
                      onChange={(e) =>
                        setCommissionPayForm({
                          ...commissionPayForm,
                          reference: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                      Notes
                    </label>
                    <Textarea
                      placeholder="Add any internal notes..."
                      size="sm"
                      value={commissionPayForm.notes}
                      onChange={(e) =>
                        setCommissionPayForm({
                          ...commissionPayForm,
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  className="font-bold"
                  size="sm"
                  variant="flat"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-bold"
                  color="primary"
                  isLoading={payingCommission}
                  size="sm"
                  onPress={handlePayStaffCommission}
                >
                  Confirm Payment
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Yearly Holidays Modal */}
      <Modal
        classNames={{
          wrapper: "z-[10000]",
          backdrop: "z-[9999]",
          base: "bg-white border border-mountain-200 shadow-xl",
        }}
        isOpen={isHolidaysModalOpen}
        size="2xl"
        onClose={() => setIsHolidaysModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 border-b border-mountain-100 pb-3">
            <h2 className="text-[16px] font-bold text-mountain-900 leading-tight">
              Manage Yearly Holidays
            </h2>
            <p className="text-[12px] text-mountain-500 font-medium">
              Staff absences on these dates won't deduct from their salary
            </p>
          </ModalHeader>
          <ModalBody className="py-4">
            <div className="flex flex-col gap-3 mb-4 p-3 bg-mountain-50 rounded-lg border border-mountain-200">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-mountain-600 uppercase tracking-wider mb-1 block">
                    Holiday Name
                  </label>
                  <Input
                    placeholder="e.g. Dashain"
                    size="sm"
                    value={newHoliday.name}
                    onChange={(e) =>
                      setNewHoliday({ ...newHoliday, name: e.target.value })
                    }
                  />
                </div>
                <div className="w-[140px]">
                  <label className="text-[11px] font-bold text-mountain-600 uppercase tracking-wider mb-1 block">
                    Date
                  </label>
                  <Input
                    size="sm"
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) =>
                      setNewHoliday({ ...newHoliday, date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-mountain-600 uppercase tracking-wider">
                    Holiday Type:
                  </span>
                  <div className="flex gap-1 ml-2">
                    <button
                      className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors ${
                        newHoliday.type === "paid"
                          ? "bg-success/10 text-success border-success/30"
                          : "bg-mountain-100 text-mountain-400 border-mountain-200 hover:bg-mountain-200"
                      }`}
                      onClick={() =>
                        setNewHoliday({ ...newHoliday, type: "paid" })
                      }
                    >
                      Paid Holiday
                    </button>
                    <button
                      className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors ${
                        newHoliday.type === "unpaid"
                          ? "bg-rose-500/10 text-rose-600 border-rose-300"
                          : "bg-mountain-100 text-mountain-400 border-mountain-200 hover:bg-mountain-200"
                      }`}
                      onClick={() =>
                        setNewHoliday({ ...newHoliday, type: "unpaid" })
                      }
                    >
                      Unpaid Holiday
                    </button>
                  </div>
                </div>
                <Button
                  className="font-semibold"
                  color="primary"
                  isLoading={saving}
                  size="sm"
                  onPress={async () => {
                    if (!newHoliday.name || !newHoliday.date || !clinicId)
                      return;
                    try {
                      setSaving(true);
                      await hrService.addHoliday(
                        clinicId,
                        newHoliday.name,
                        new Date(newHoliday.date),
                        newHoliday.type,
                      );
                      setNewHoliday({
                        name: "",
                        date: format(new Date(), "yyyy-MM-dd"),
                        type: "paid",
                      });
                      const updated = await hrService.getHolidays(clinicId);

                      setHolidays(updated);
                    } catch (e) {
                      console.error("Error adding holiday:", e);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Add Holiday
                </Button>
              </div>
              <p className="text-[10px] text-mountain-400">
                <strong>Paid Holiday:</strong> Staff absences are ignored — no
                deduction.
                <br />
                <strong>Unpaid Holiday:</strong> Day off but salary is deducted
                for that day.
              </p>
            </div>

            <div className="border border-mountain-200 rounded-lg overflow-hidden bg-mountain-50">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-mountain-100 border-b border-mountain-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-mountain-700">
                      Date
                    </th>
                    <th className="px-3 py-2 font-semibold text-mountain-700">
                      Holiday
                    </th>
                    <th className="px-3 py-2 font-semibold text-mountain-700">
                      Type
                    </th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-mountain-100 bg-white">
                  {holidays.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-mountain-400"
                        colSpan={3}
                      >
                        No holidays added yet.
                      </td>
                    </tr>
                  ) : (
                    holidays
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      )
                      .map((holiday) => (
                        <tr
                          key={holiday.id}
                          className="hover:bg-mountain-50 transition-colors"
                        >
                          <td className="px-3 py-2 font-medium text-mountain-900">
                            {format(holiday.date, "MMM dd, yyyy")}
                          </td>
                          <td className="px-3 py-2 text-mountain-600">
                            {holiday.name}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                holiday.type === "unpaid"
                                  ? "bg-rose-50 text-rose-600 border-rose-200"
                                  : "bg-success/10 text-success border-success/20"
                              }`}
                            >
                              {holiday.type === "unpaid" ? "Unpaid" : "Paid"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              className="p-1.5 text-mountain-400 hover:text-danger hover:bg-danger-50 rounded-md transition-colors"
                              onClick={async () => {
                                if (!holiday.id || !clinicId) return;
                                try {
                                  await hrService.deleteHoliday(holiday.id);
                                  const updated =
                                    await hrService.getHolidays(clinicId);

                                  setHolidays(updated);
                                } catch (e) {
                                  console.error("Error deleting holiday:", e);
                                }
                              }}
                            >
                              <IoTrashOutline size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="font-semibold text-mountain-700 bg-white border border-mountain-200"
              onPress={() => setIsHolidaysModalOpen(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
