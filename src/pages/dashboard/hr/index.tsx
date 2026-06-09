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
} from "react-icons/io5";
import {
  format,
  subDays,
  startOfDay,
  subMonths,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
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

import { FileUploadComponent } from "@/components/FileUploadComponent";
import {
  StaffMember,
  StaffAttendance,
  AccountBill,
  StaffCommission,
  ClinicHoliday,
} from "@/types/models";
import { expertService } from "@/services/expertService";
import { doctorService } from "@/services/doctorService";
import { staffCommissionService } from "@/services/staffCommissionService";
import { accountService } from "@/services/accountService";
import { hrService } from "@/services/hrService";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { printSalarySlip } from "@/utils/salaryPrinting";
import { clinicService } from "@/services/clinicService";

export default function HRPage() {
  const { clinicId, userData, branchId } = useAuthContext();
  const [activeTab, setActiveTab] = useState("directory");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [bills, setBills] = useState<AccountBill[]>([]);
  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);
  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState<{ name: string; date: string; type: "paid" | "unpaid" }>({ name: "", date: format(new Date(), "yyyy-MM-dd"), type: "paid" });
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
  }>({
    amount: 0,
    paymentMethod: "Cash",
    notes: "",
    selectedMonths: [format(new Date(), "MMMM yyyy")],
    paymentType: "regular",
    waivedDays: 0,
    includeCommission: false,
    incentive: 0,
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
  });

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
      });
    }
  }, [isStaffModalOpen]);

  const handleEditStaff = (staff: StaffMember) => {
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
    });
    setIsStaffModalOpen(true);
  };

  useEffect(() => {
    if (clinicId) {
      loadData();
    }
  }, [clinicId, branchId]);

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

  const staffPayrollSummary = useMemo(() => {
    return staff.map((s) => {
      const staffBills = bills.filter(
        (b) => b.category === "salary" && b.vendorName === s.name,
      );
      const totalPaid = staffBills.reduce((acc, b) => acc + b.paidAmount, 0);

      return {
        ...s,
        totalPaid,
        lastPayment:
          staffBills.length > 0
            ? staffBills.sort(
              (a, b) => b.billDate.getTime() - a.billDate.getTime(),
            )[0].billDate
            : null,
      };
    });
  }, [staff, bills]);

  const handlePrintPayrollSummary = () => {
    const printContent = document.getElementById("payroll-summary-report");

    if (!printContent) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Payroll Summary Report - ${clinicId}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { margin: 5px 0; color: #666; font-size: 14px; }
            .report-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f4f4f4; text-align: left; padding: 12px 10px; border: 1px solid #ddd; font-size: 11px; text-transform: uppercase; }
            td { padding: 10px; border: 1px solid #ddd; font-size: 12px; }
            .amount { text-align: right; font-family: monospace; font-weight: 600; }
            .total-row { background: #f9f9f9; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
            .signature-space { margin-top: 60px; display: flex; justify-content: space-between; }
            .sig-box { width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-size: 12px; }
            @media print {
              @page { margin: 2cm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Staff Payroll Summary</h1>
            <p>ProCareSoft Health Information System</p>
          </div>
          <div class="report-info">
            <span>Report Date: ${format(new Date(), "PPP")}</span>
            <span>Clinic ID: ${clinicId}</span>
          </div>
          ${printContent.innerHTML}
          <div class="signature-space">
            <div class="sig-box">Accountant Signature</div>
            <div class="sig-box">Manager/MD Signature</div>
          </div>
          <div class="footer">Generated via ProCareSoft HR Management Module</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
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
      const thirtyDaysAgo = subDays(new Date(), 30);
      const [staffData, attendanceData, billsData] = await Promise.all([
        hrService.getStaffByClinic(clinicId!, branchId || undefined),
        hrService.getAttendanceByRange(
          clinicId!,
          startOfDay(thirtyDaysAgo),
          new Date(),
          branchId || undefined,
        ),
        accountService.getBillsByClinic(clinicId!, branchId || undefined),
      ]);

      setStaff(staffData);
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
        const staffId = await hrService.createStaff(staffData);

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
      .filter((b) => b.category === "salary" && b.vendorName === selectedStaff.name)
      .filter((b) => months.some((m) => b.description?.includes(m)))
      .reduce((sum, b) => sum + b.paidAmount, 0);
  };

  const getLeaveDetails = (months: string[]) => {
    if (!selectedStaff || !attendance) {
      return { absentDays: 0, allowedLeaves: 0, unpaidLeaves: 0, dailyWage: 0, deductionAmount: 0 };
    }
    const allowedLeaves = selectedStaff.allowedLeavesPerMonth ?? 4;

    const absentDays = attendance.filter((a) => {
      const isAbsent = a.status === "absent";
      const isSelectedStaff = a.staffId === selectedStaff.id;
      const isSelectedMonth = months.includes(format(a.date, "MMMM yyyy"));
      // Only count explicitly-unpaid absences OR absences with no leaveType set (legacy) that exceed quota
      // If leaveType is set, use it directly; otherwise fall back to quota logic
      const isPaidHoliday = holidays.some(h => format(h.date, "yyyy-MM-dd") === format(a.date, "yyyy-MM-dd") && (h.type === "paid" || !h.type));
      return isAbsent && isSelectedStaff && isSelectedMonth && !isPaidHoliday;
    }).length;

    const totalAllowedLeaves = allowedLeaves * months.length;

    // For attendance records with explicit leaveType, count only unpaid ones.
    // For legacy records (no leaveType), fall back to quota-based logic.
    const explicitUnpaidAbsences = attendance.filter((a) => {
      const isAbsent = a.status === "absent";
      const isSelectedStaff = a.staffId === selectedStaff.id;
      const isSelectedMonth = months.includes(format(a.date, "MMMM yyyy"));
      const isPaidHoliday = holidays.some(h => format(h.date, "yyyy-MM-dd") === format(a.date, "yyyy-MM-dd") && (h.type === "paid" || !h.type));
      return isAbsent && isSelectedStaff && isSelectedMonth && !isPaidHoliday && a.leaveType === "unpaid";
    }).length;

    const legacyAbsences = attendance.filter((a) => {
      const isAbsent = a.status === "absent";
      const isSelectedStaff = a.staffId === selectedStaff.id;
      const isSelectedMonth = months.includes(format(a.date, "MMMM yyyy"));
      const isPaidHoliday = holidays.some(h => format(h.date, "yyyy-MM-dd") === format(a.date, "yyyy-MM-dd") && (h.type === "paid" || !h.type));
      return isAbsent && isSelectedStaff && isSelectedMonth && !isPaidHoliday && !a.leaveType;
    }).length;

    const legacyUnpaid = Math.max(0, legacyAbsences - totalAllowedLeaves);
    const unpaidLeaves = explicitUnpaidAbsences + legacyUnpaid;

    // Calculate precise daily wage based on exact days in the selected Nepali BS months
    const totalDaysInSelectedMonths = months.reduce((total, monthStr) => {
      const date = parse(monthStr, "MMMM yyyy", new Date());
      const nd = new NepaliDate(date);
      return total + NepaliDate.getDaysOfMonth(nd.getYear(), nd.getMonth());
    }, 0);

    const averageDaysInMonth = months.length > 0 ? totalDaysInSelectedMonths / months.length : 30;
    const dailyWage = (selectedStaff.salary || 0) / averageDaysInMonth;

    return {
      absentDays,
      allowedLeaves: totalAllowedLeaves,
      unpaidLeaves,
      dailyWage,
      deductionAmount: Math.round(unpaidLeaves * dailyWage),
    };
  };

  const calculateExpectedAmount = (months: string[], type: "regular" | "advance", waivedDays: number) => {
    if (type === "advance") return 0;
    const baseExpected = (selectedStaff?.salary || 0) * (months.length || 1);
    const previouslyPaid = getPreviouslyPaid(months);
    const leaveDetails = getLeaveDetails(months);
    const effectiveUnpaidLeaves = Math.max(0, leaveDetails.unpaidLeaves - waivedDays);
    const leaveDeductions = Math.round(effectiveUnpaidLeaves * leaveDetails.dailyWage);
    return Math.max(0, baseExpected - previouslyPaid - leaveDeductions);
  };

  const getIncentivesPaid = (staffName: string) => {
    return bills
      .filter(
        (b) =>
          b.category === "salary" &&
          b.vendorName === staffName,
      )
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

  const handleDisburseSalary = async () => {
    if (!selectedStaff) return;
    try {
      const pendingCommission = payrollForm.includeCommission
        ? (selectedStaff.totalCommissionBalance || 0)
        : 0;
      const incentiveAmt = Number(payrollForm.incentive) || 0;
      const totalPayout = Number(payrollForm.amount) + pendingCommission + incentiveAmt;

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
        description: `Salary for ${payrollForm.selectedMonths.join(", ")}${pendingCommission > 0 ? ` + Commission Rs. ${pendingCommission.toLocaleString()}` : ""}${incentiveAmt > 0 ? ` + Incentive Rs. ${incentiveAmt.toLocaleString()}` : ""}. ${payrollForm.notes}`,
        clinicId: clinicId!,
        branchId: branchId || "",
        createdBy: userData?.id || "",
      };

      await accountService.createBill(bill);

      // If commission is included, mark all pending commissions as paid
      if (payrollForm.includeCommission && pendingCommission > 0) {
        const pendingCommissions = staffCommissions.filter(c => c.status === "pending");
        await Promise.all(
          pendingCommissions.map(c =>
            staffCommissionService.payCommission(
              c.id,
              c.commissionAmount - (c.paidAmount || 0),
              payrollForm.paymentMethod,
              undefined,
              `Included in salary payment ${payrollForm.selectedMonths.join(", ")}`,
              userData?.id || "system",
            )
          )
        );
      }

      addToast({
        title: "Success",
        description: `Salary disbursed successfully.${pendingCommission > 0 ? ` Included Commission: Rs. ${pendingCommission.toLocaleString()}.` : ""}${incentiveAmt > 0 ? ` Included Incentive: Rs. ${incentiveAmt.toLocaleString()}.` : ""}`,
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
          (a.status === "present" || a.status === "on_break") &&
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

  const handlePrintSalarySlip = async (bill: AccountBill) => {
    if (!clinicId || !selectedStaff) return;
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
        console.error("Defensive catch: Failed to fetch print layout config", err);
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

      printSalarySlip(bill, selectedStaff, effectiveClinic as any, effectiveConfig);
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

  const markAbsent = async (member: StaffMember, leaveType: "paid" | "unpaid") => {
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
    const testStaff = staff.find(s => s.name.toUpperCase().includes("ALINA")) || staff[0];
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
      addToast({ title: "Error", description: "Failed to add test data", color: "danger" });
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
                                    format(new Date(), "yyyy-MM-dd")
                                );
                                const hasEndedShift = todayAtt && todayAtt.checkOut;
                                const isCurrentlyAbsent = todayAtt && todayAtt.status === "absent";

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
          <div className="flex justify-between items-end bg-[rgb(var(--color-surface-2))/0.3] p-4 rounded-xl border border-[rgb(var(--color-border))]">
            <div>
              <h3 className="text-[14px] font-bold text-primary tracking-tight">
                Financial Disbursement Summary
              </h3>
              <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                Comprehensive overview of staff salaries and payments.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                className="font-bold text-[11px]"
                color="primary"
                size="sm"
                startContent={<IoPrintOutline size={16} />}
                variant="flat"
                onPress={handlePrintPayrollSummary}
              >
                Print Full Report
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
        size="2xl"
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
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] min-h-[85vh]",
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-[0.15em] opacity-60 mb-1">
                          Absent Days
                        </p>
                        <p className="text-[16px] font-bold text-rose-500">
                          {
                            attendance.filter(
                              (a) =>
                                a.staffId === selectedStaff.id &&
                                a.status === "absent",
                            ).length
                          }{" "}
                          Days
                        </p>
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
                          Rs. {getIncentivesPaid(selectedStaff.name).toLocaleString()}
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
                      amount: calculateExpectedAmount([currentMonth], "regular", 0),
                      selectedMonths: [currentMonth],
                      notes: "",
                      waivedDays: 0,
                      includeCommission: false,
                      incentive: 0,
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
        onClose={() => { setIsAbsentModalOpen(false); setAbsentTarget(null); }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 border-b border-mountain-100 pb-3">
            <h2 className="text-[15px] font-bold text-mountain-900">Mark Absence</h2>
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
                  <p className="text-[13px] font-bold text-success">Paid Leave</p>
                  <p className="text-[11px] text-mountain-500 mt-0.5">
                    Counts against their monthly leave quota ({absentTarget?.allowedLeavesPerMonth ?? 4} days/mo). No extra salary deduction unless quota is exceeded.
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
                  <p className="text-[13px] font-bold text-rose-600">Unpaid Leave</p>
                  <p className="text-[11px] text-mountain-500 mt-0.5">
                    Salary will be deducted for this day regardless of remaining leave quota.
                  </p>
                </div>
              </button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              size="sm"
              className="font-semibold"
              onPress={() => { setIsAbsentModalOpen(false); setAbsentTarget(null); }}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Salary Payment Modal */}

      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
        }}
        isOpen={isPayModalOpen}
        size="2xl"
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
                        selectedKey={payrollForm.paymentType}
                        onSelectionChange={(key) => {
                          const type = key as "regular" | "advance";
                          setPayrollForm({
                            ...payrollForm,
                            paymentType: type,
                            amount: calculateExpectedAmount(payrollForm.selectedMonths, type, payrollForm.waivedDays),
                          });
                        }}
                        size="sm"
                        className="mb-2"
                        classNames={{
                          tabList: "bg-mountain-50 border border-mountain-200",
                          cursor: "bg-white shadow-sm",
                          tab: "font-semibold text-mountain-600",
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
                              amount: calculateExpectedAmount(selected, payrollForm.paymentType, payrollForm.waivedDays),
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
                          <span className="text-[12px] text-text-muted">Rs.</span>
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
                    <div>
                      <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">
                        Incentive (Rs.)
                      </label>
                      <Input
                        size="sm"
                        startContent={
                          <span className="text-[12px] text-text-muted">Rs.</span>
                        }
                        type="number"
                        placeholder="0"
                        value={payrollForm.incentive === 0 ? "" : payrollForm.incentive.toString()}
                        onChange={(e) =>
                          setPayrollForm({
                            ...payrollForm,
                            incentive: Number(e.target.value) || 0,
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
                        <SelectItem key="Bank Transfer">Bank Transfer</SelectItem>
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
                        <span className="text-mountain-600">Months Selected:</span>
                        <span className="font-semibold text-mountain-900">{payrollForm.selectedMonths.length}</span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-mountain-600">Expected Salary:</span>
                        <span className="font-semibold text-mountain-900">
                          Rs. {((selectedStaff?.salary || 0) * (payrollForm.selectedMonths.length || 1)).toLocaleString()}
                        </span>
                      </div>
                      {getLeaveDetails(payrollForm.selectedMonths).absentDays > 0 && (
                        <div className="flex justify-between text-[12px] text-mountain-600">
                          <span>Total Leaves Taken:</span>
                          <span className="font-semibold">{getLeaveDetails(payrollForm.selectedMonths).absentDays}</span>
                        </div>
                      )}
                      {getLeaveDetails(payrollForm.selectedMonths).deductionAmount > 0 && (
                        <div className="flex flex-col gap-1 text-[12px] text-rose-600">
                          <div className="flex justify-between">
                            <span>Leave Deductions:</span>
                            <span className={`font-semibold`}>
                              - Rs. {Math.round(Math.max(0, getLeaveDetails(payrollForm.selectedMonths).unpaidLeaves - payrollForm.waivedDays) * getLeaveDetails(payrollForm.selectedMonths).dailyWage).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-mountain-500 mt-1">
                            <span className="text-[10px]">Waive deductions (Days):</span>
                            <div className="flex items-center gap-2">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                className="h-6 w-6 min-w-0"
                                isDisabled={payrollForm.waivedDays <= 0}
                                onPress={() => {
                                  setPayrollForm(prev => ({
                                    ...prev,
                                    waivedDays: Math.max(0, prev.waivedDays - 1),
                                    amount: calculateExpectedAmount(prev.selectedMonths, prev.paymentType, Math.max(0, prev.waivedDays - 1))
                                  }));
                                }}
                              >
                                -
                              </Button>
                              <span className="font-bold w-4 text-center text-mountain-700">{payrollForm.waivedDays}</span>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                className="h-6 w-6 min-w-0"
                                isDisabled={payrollForm.waivedDays >= getLeaveDetails(payrollForm.selectedMonths).unpaidLeaves}
                                onPress={() => {
                                  setPayrollForm(prev => ({
                                    ...prev,
                                    waivedDays: Math.min(getLeaveDetails(prev.selectedMonths).unpaidLeaves, prev.waivedDays + 1),
                                    amount: calculateExpectedAmount(prev.selectedMonths, prev.paymentType, Math.min(getLeaveDetails(prev.selectedMonths).unpaidLeaves, prev.waivedDays + 1))
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
                            - Rs. {getPreviouslyPaid(payrollForm.selectedMonths).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[13px] font-bold pt-2">
                        <span className="text-mountain-900">Due Amount:</span>
                        <span className="text-amber-600">Rs. {calculateExpectedAmount(payrollForm.selectedMonths, "regular", payrollForm.waivedDays).toLocaleString()}</span>
                      </div>
                      {(selectedStaff?.totalCommissionBalance || 0) > 0 && (
                        <div className="flex flex-col gap-1 border border-violet-200 bg-violet-50 rounded-lg p-2 mt-1">
                          <div className="flex justify-between text-[12px] text-violet-700">
                            <span className="font-semibold">Pending Commission:</span>
                            <span className="font-bold">+ Rs. {(selectedStaff?.totalCommissionBalance || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              size="sm"
                              classNames={{ label: "text-[10px] text-mountain-600 font-medium" }}
                              isSelected={payrollForm.includeCommission}
                              onValueChange={(val) => setPayrollForm(prev => ({ ...prev, includeCommission: val }))}
                            >
                              Include commission in this payout
                            </Checkbox>
                          </div>
                        </div>
                      )}
                      {payrollForm.incentive > 0 && (
                        <div className="flex justify-between text-[12px] text-violet-700">
                          <span>Incentives Added:</span>
                          <span className="font-semibold">+ Rs. {payrollForm.incentive.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-mountain-200">
                        <span className="text-mountain-900">Total Payout:</span>
                        <span className="text-health-700">Rs. {(
                          payrollForm.amount +
                          (payrollForm.includeCommission ? (selectedStaff?.totalCommissionBalance || 0) : 0) +
                          payrollForm.incentive
                        ).toLocaleString()}</span>
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
        onClose={() => setIsHolidaysModalOpen(false)}
        size="md"
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
                    size="sm"
                    placeholder="e.g. Dashain"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
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
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-mountain-600 uppercase tracking-wider">Holiday Type:</span>
                  <div className="flex gap-1 ml-2">
                    <button
                      className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors ${newHoliday.type === "paid"
                        ? "bg-success/10 text-success border-success/30"
                        : "bg-mountain-100 text-mountain-400 border-mountain-200 hover:bg-mountain-200"
                        }`}
                      onClick={() => setNewHoliday({ ...newHoliday, type: "paid" })}
                    >
                      Paid Holiday
                    </button>
                    <button
                      className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors ${newHoliday.type === "unpaid"
                        ? "bg-rose-500/10 text-rose-600 border-rose-300"
                        : "bg-mountain-100 text-mountain-400 border-mountain-200 hover:bg-mountain-200"
                        }`}
                      onClick={() => setNewHoliday({ ...newHoliday, type: "unpaid" })}
                    >
                      Unpaid Holiday
                    </button>
                  </div>
                </div>
                <Button
                  color="primary"
                  className="font-semibold"
                  size="sm"
                  onPress={async () => {
                    if (!newHoliday.name || !newHoliday.date || !clinicId) return;
                    try {
                      setSaving(true);
                      await hrService.addHoliday(clinicId, newHoliday.name, new Date(newHoliday.date), newHoliday.type);
                      setNewHoliday({ name: "", date: format(new Date(), "yyyy-MM-dd"), type: "paid" });
                      const updated = await hrService.getHolidays(clinicId);
                      setHolidays(updated);
                    } catch (e) {
                      console.error("Error adding holiday:", e);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  isLoading={saving}
                >
                  Add Holiday
                </Button>
              </div>
              <p className="text-[10px] text-mountain-400">
                <strong>Paid Holiday:</strong> Staff absences are ignored — no deduction.<br />
                <strong>Unpaid Holiday:</strong> Day off but salary is deducted for that day.
              </p>
            </div>

            <div className="border border-mountain-200 rounded-lg overflow-hidden bg-mountain-50">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-mountain-100 border-b border-mountain-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-mountain-700">Date</th>
                    <th className="px-3 py-2 font-semibold text-mountain-700">Holiday</th>
                    <th className="px-3 py-2 font-semibold text-mountain-700">Type</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mountain-100 bg-white">
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-mountain-400">
                        No holidays added yet.
                      </td>
                    </tr>
                  ) : (
                    holidays
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((holiday) => (
                        <tr key={holiday.id} className="hover:bg-mountain-50 transition-colors">
                          <td className="px-3 py-2 font-medium text-mountain-900">
                            {format(holiday.date, "MMM dd, yyyy")}
                          </td>
                          <td className="px-3 py-2 text-mountain-600">
                            {holiday.name}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${(holiday.type === "unpaid")
                              ? "bg-rose-50 text-rose-600 border-rose-200"
                              : "bg-success/10 text-success border-success/20"
                              }`}>
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
                                  const updated = await hrService.getHolidays(clinicId);
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
