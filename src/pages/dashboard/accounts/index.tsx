import React, { useState, useEffect, useMemo } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoReceiptOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoCalendarOutline,
  IoEllipsisHorizontal,
  IoPrintOutline,
  IoDownloadOutline,
  IoBarChartOutline,
  IoCreateOutline,
  IoEyeOutline,
  IoBusinessOutline,
  IoPricetagsOutline,
  IoCallOutline,
  IoMailOutline,
  IoBanOutline,
  IoRefreshOutline,
  IoInformationCircleOutline,
  IoMedkitOutline,
  IoHardwareChipOutline,
  IoFlashOutline,
  IoPeopleOutline,
  IoHomeOutline,
  IoBriefcaseOutline,
} from "react-icons/io5";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);
import { format } from "date-fns";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Select, SelectItem } from "@/components/ui/select";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown";

import { printAccountBill } from "@/utils/accountPrinting";
import { toCsv } from "@/utils/csv";
import { clinicService } from "@/services/clinicService";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { accountService } from "@/services/accountService";
import { AccountBill, Vendor } from "@/types/models";

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "E-Sewa", "Khalti", "Cheque"];

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Salary bills feed HR payroll (HR writes them as PAY-… and reads them back), so
// they are not corrected from here.
const isPayrollBill = (bill: AccountBill) => bill.category === "salary";

// A bill is effective unless a correction has superseded it (IRD 6(ट)).
const isEffective = (bill: AccountBill) => bill.isEffective !== false;

const emptyBillForm = () => ({
  category: "other" as AccountBill["category"],
  itemName: "",
  vendorName: "",
  vendorId: "",
  billNumber: "",
  billDate: format(new Date(), "yyyy-MM-dd"),
  totalAmount: "",
  paidAmount: "",
  description: "",
  paymentStatus: "pending" as AccountBill["paymentStatus"],
  paymentMethod: "Cash",
});

export default function AccountsPage() {
  const { clinicId, userData } = useAuthContext();
  const [bills, setBills] = useState<AccountBill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showChart, setShowChart] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: format(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      "yyyy-MM-dd",
    ),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  const categories = [
    { id: "all", label: "All Bills" },
    { id: "medicine", label: "Medicines" },
    { id: "equipment", label: "Equipment" },
    { id: "utility", label: "Utilities" },
    { id: "salary", label: "Salaries" },
    { id: "rent", label: "Rent" },
    { id: "office_supply", label: "Office Supplies" },
    { id: "other", label: "Other" },
  ];

  // Fixed accounting categories (plan, memory, etc.) — "salary" in particular
  // is load-bearing: isPayrollBill() below checks the literal string to keep
  // payroll bills managed from HR instead of corrected here. Not an editable
  // catalogue, so the Categories tab is a reference view, not a CRUD one.
  const CATEGORY_META: Record<
    string,
    { label: string; icon: React.ReactNode; description: string }
  > = {
    medicine: {
      label: "Medicines",
      icon: <IoMedkitOutline className="w-5 h-5" />,
      description: "Pharmacy stock and medical consumables purchased for the clinic.",
    },
    equipment: {
      label: "Equipment",
      icon: <IoHardwareChipOutline className="w-5 h-5" />,
      description: "Clinical and office equipment, devices, and durable assets.",
    },
    utility: {
      label: "Utilities",
      icon: <IoFlashOutline className="w-5 h-5" />,
      description: "Electricity, water, internet, and other recurring utility bills.",
    },
    salary: {
      label: "Salaries",
      icon: <IoPeopleOutline className="w-5 h-5" />,
      description:
        "Staff payroll. Managed from HR, so these bills can't be corrected here.",
    },
    rent: {
      label: "Rent",
      icon: <IoHomeOutline className="w-5 h-5" />,
      description: "Premises and facility rent.",
    },
    office_supply: {
      label: "Office Supplies",
      icon: <IoBriefcaseOutline className="w-5 h-5" />,
      description: "Stationery and other day-to-day office consumables.",
    },
    other: {
      label: "Other",
      icon: <IoEllipsisHorizontal className="w-5 h-5" />,
      description: "Anything that doesn't fit the categories above.",
    },
  };

  const [activeTab, setActiveTab] = useState<
    "bills" | "vendors" | "categories"
  >("bills");
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  // Set while the vendor modal is editing an existing vendor instead of
  // adding one.
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<AccountBill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  // Set while the bill modal is correcting an existing bill instead of adding one.
  // The original is never edited: the correction is saved as a new bill.
  const [correctingBill, setCorrectingBill] = useState<AccountBill | null>(
    null,
  );
  const [correctionReason, setCorrectionReason] = useState("");
  // The bill whose details modal is open.
  const [detailBill, setDetailBill] = useState<AccountBill | null>(null);

  const [billForm, setBillForm] = useState(emptyBillForm);

  const openAddBill = () => {
    // Leaving correction mode starts from a blank form; otherwise an unsaved
    // draft from an earlier "Add" is kept, as before.
    if (correctingBill) {
      setCorrectingBill(null);
      setCorrectionReason("");
      setBillForm(emptyBillForm());
    }
    setIsBillModalOpen(true);
  };

  const openCorrectBill = (bill: AccountBill) => {
    setCorrectingBill(bill);
    setCorrectionReason("");
    setBillForm({
      category: bill.category,
      itemName: bill.itemName || "",
      vendorName: bill.vendorName,
      vendorId: bill.vendorId || "",
      billNumber: bill.billNumber,
      billDate: format(new Date(bill.billDate), "yyyy-MM-dd"),
      totalAmount: String(bill.totalAmount),
      paidAmount: String(bill.paidAmount),
      description: bill.description || "",
      paymentStatus: bill.paymentStatus,
      paymentMethod: bill.paymentMethod || "Cash",
    });
    setIsBillModalOpen(true);
  };

  const handleBillModalChange = (open: boolean) => {
    setIsBillModalOpen(open);
    // Cancelling a correction must not leave that bill's data in the Add form.
    if (!open && correctingBill) {
      setCorrectingBill(null);
      setCorrectionReason("");
      setBillForm(emptyBillForm());
    }
  };

  const generateBillNumber = () => {
    const prefix = "BLL";
    const date = format(new Date(), "yyyyMM");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newBillNumber = `${prefix}-${date}-${random}`;

    setBillForm((prev) => ({ ...prev, billNumber: newBillNumber }));
  };

  const [vendorForm, setVendorForm] = useState({
    name: "",
    category: "General",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    if (clinicId) {
      loadData();
    }
  }, [clinicId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [billsData, vendorsData] = await Promise.all([
        accountService.getBillsByClinic(clinicId!),
        accountService.getVendorsByClinic(clinicId!),
      ]);

      setBills(billsData);
      setVendors(vendorsData);
    } catch (error) {
      console.error("Error loading accounts data:", error);
      addToast({
        title: "Error",
        description: "Failed to load financial records",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billForm.vendorName || !billForm.totalAmount || !billForm.billNumber) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        color: "warning",
      });

      return;
    }

    const total = parseFloat(billForm.totalAmount);
    const paid = parseFloat(billForm.paidAmount || "0");

    if (correctingBill && !correctionReason.trim()) {
      addToast({
        title: "Reason required",
        description: "State why this bill is being corrected.",
        color: "warning",
      });

      return;
    }

    // Reject amounts that can only produce a wrong ledger (e.g. a negative due).
    if (!(total > 0) || !(paid >= 0) || paid > total) {
      addToast({
        title: "Invalid amount",
        description: !(total > 0)
          ? "Total amount must be greater than zero."
          : !(paid >= 0)
            ? "Paid amount cannot be negative."
            : "Paid amount cannot be more than the total.",
        color: "warning",
      });

      return;
    }

    setSaving(true);
    try {
      const due = total - paid;

      let status: AccountBill["paymentStatus"] = "pending";

      if (paid >= total) status = "paid";
      else if (paid > 0) status = "partial";

      const billData = {
        ...billForm,
        totalAmount: total,
        paidAmount: paid,
        dueAmount: due,
        paymentStatus: status,
        billDate: new Date(billForm.billDate),
      };

      if (correctingBill) {
        const unchanged =
          billData.category === correctingBill.category &&
          billData.itemName === (correctingBill.itemName || "") &&
          billData.vendorName === correctingBill.vendorName &&
          billData.billNumber === correctingBill.billNumber &&
          billData.totalAmount === correctingBill.totalAmount &&
          billData.paidAmount === correctingBill.paidAmount &&
          billData.description === (correctingBill.description || "") &&
          billData.paymentMethod === (correctingBill.paymentMethod || "Cash") &&
          billForm.billDate ===
            format(new Date(correctingBill.billDate), "yyyy-MM-dd");

        if (unchanged) {
          addToast({
            title: "Nothing changed",
            description: "Change at least one detail to record a correction.",
            color: "warning",
          });
          setSaving(false);

          return;
        }

        await accountService.correctBill(
          correctingBill,
          {
            ...billData,
            clinicId: correctingBill.clinicId,
            branchId: correctingBill.branchId ?? "",
            createdBy: userData?.id || "",
          },
          {
            reason: correctionReason.trim(),
            correctedBy: userData?.id || "",
            correctedByName: userData?.displayName,
          },
        );
      } else {
        await accountService.createBill({
          ...billData,
          clinicId: clinicId!,
          branchId: "",
          createdBy: userData?.id || "",
        });
      }

      addToast({
        title: "Success",
        description: correctingBill
          ? "Correction recorded. The original bill is kept and marked as corrected."
          : "Purchase bill recorded successfully",
        color: "success",
      });
      setIsBillModalOpen(false);
      setCorrectingBill(null);
      setCorrectionReason("");
      loadData();
      setBillForm(emptyBillForm());
    } catch (error) {
      console.error("Error saving bill:", error);
      addToast({
        title: "Error",
        description: "Failed to save bill record",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || !paymentAmount || parseFloat(paymentAmount) <= 0)
      return;

    const amount = parseFloat(paymentAmount);

    if (amount > selectedBill.dueAmount) {
      addToast({
        title: "Invalid Amount",
        description: "Payment cannot exceed due amount",
        color: "warning",
      });

      return;
    }

    setSaving(true);
    try {
      const newPaidAmount = selectedBill.paidAmount + amount;
      const newDueAmount = selectedBill.dueAmount - amount;
      const newStatus = newDueAmount <= 0 ? "paid" : "partial";

      await accountService.updateBill(selectedBill.id, {
        paidAmount: newPaidAmount,
        dueAmount: newDueAmount,
        paymentStatus: newStatus,
        payments: [
          ...(selectedBill.payments || []),
          {
            amount,
            method: paymentMethod,
            date: new Date(),
            recordedBy: userData?.id || "",
          },
        ],
      });

      addToast({
        title: "Success",
        description: `Recorded payment of Rs. ${amount.toLocaleString()}`,
        color: "success",
      });
      setIsPaymentModalOpen(false);
      setSelectedBill(null);
      setPaymentAmount("");
      setPaymentMethod("Cash");
      loadData();
    } catch (error) {
      console.error("Error recording payment:", error);
      addToast({
        title: "Error",
        description: "Failed to record payment",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintBill = async (bill: AccountBill) => {
    if (!clinicId) return;
    try {
      const [clinicData, printConfig] = await Promise.all([
        clinicService.getClinicById(clinicId),
        clinicService.getPrintLayoutConfig(clinicId),
      ]);

      if (!clinicData) throw new Error("Clinic data not found");

      const effectiveConfig =
        printConfig ||
        ({
          clinicId,
          primaryColor: "#7c3aed",
          fontSize: "medium",
          showAddress: true,
          showPhone: true,
          showEmail: true,
          headerHeight: "compact",
        } as any);

      printAccountBill(bill, clinicData, effectiveConfig);
    } catch (error) {
      console.error("Failed to print bill:", error);
      addToast({
        title: "Print Error",
        description: "Could not generate document",
        color: "danger",
      });
    }
  };

  const emptyVendorForm = () => ({
    name: "",
    category: "General",
    phone: "",
    email: "",
    address: "",
  });

  const openAddVendor = () => {
    setEditingVendor(null);
    setVendorForm(emptyVendorForm());
    setIsVendorModalOpen(true);
  };

  const openEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorForm({
      name: vendor.name,
      category: vendor.category || "General",
      phone: vendor.phone || "",
      email: vendor.email || "",
      address: vendor.address || "",
    });
    setIsVendorModalOpen(true);
  };

  const handleVendorModalChange = (open: boolean) => {
    setIsVendorModalOpen(open);
    if (!open) {
      setEditingVendor(null);
      setVendorForm(emptyVendorForm());
    }
  };

  const toggleVendorActive = async (vendor: Vendor) => {
    try {
      await accountService.updateVendor(vendor.id, {
        isActive: !vendor.isActive,
      });
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id ? { ...v, isActive: !v.isActive } : v,
        ),
      );
      addToast({
        title: "Success",
        description: vendor.isActive
          ? "Vendor deactivated"
          : "Vendor reactivated",
        color: "success",
      });
    } catch (error) {
      console.error("Error updating vendor status:", error);
      addToast({
        title: "Error",
        description: "Failed to update vendor",
        color: "danger",
      });
    }
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name) return;

    setSaving(true);
    try {
      if (editingVendor) {
        await accountService.updateVendor(editingVendor.id, {
          ...vendorForm,
        });
        setVendors((prev) =>
          prev.map((v) =>
            v.id === editingVendor.id
              ? { ...v, ...vendorForm, updatedAt: new Date() }
              : v,
          ),
        );
        addToast({
          title: "Success",
          description: "Vendor updated successfully",
          color: "success",
        });
      } else {
        const id = await accountService.createVendor({
          ...vendorForm,
          isActive: true,
          clinicId: clinicId!,
          branchId: "",
          createdBy: userData?.id || "",
        });

        addToast({
          title: "Success",
          description: "Vendor added successfully",
          color: "success",
        });
        setVendors((prev) => [
          ...prev,
          {
            ...vendorForm,
            id,
            isActive: true,
            clinicId: clinicId!,
            branchId: "",
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userData?.id || "",
          },
        ]);
        // Only auto-select into the bill form when the vendor was added from
        // inside an open Record Purchase Bill — the Vendors tab has no such
        // form to fill.
        if (isBillModalOpen) {
          setBillForm((prev) => ({
            ...prev,
            vendorName: vendorForm.name,
            vendorId: id,
          }));
        }
      }
      setIsVendorModalOpen(false);
      setEditingVendor(null);
      setVendorForm(emptyVendorForm());
    } catch (error) {
      console.error("Error saving vendor:", error);
      addToast({
        title: "Error",
        description: "Failed to save vendor",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(vendorSearchQuery.toLowerCase()),
  );

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.billNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || bill.category === activeCategory;
    const matchesStatus =
      statusFilter === "all" || bill.paymentStatus === statusFilter;

    let matchesDate = true;

    if (dateRange.start && dateRange.end) {
      const billDate = new Date(bill.billDate);
      const start = new Date(dateRange.start);

      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.end);

      end.setHours(23, 59, 59, 999);
      matchesDate = billDate >= start && billDate <= end;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesDate;
  });

  // A corrected bill stays in the table and the export, but its amounts are
  // replaced by the new bill, so it must not be counted twice.
  const effectiveBills = filteredBills.filter(isEffective);

  const stats = {
    total: effectiveBills.reduce((acc, b) => acc + b.totalAmount, 0),
    paid: effectiveBills.reduce((acc, b) => acc + b.paidAmount, 0),
    due: effectiveBills.reduce((acc, b) => acc + b.dueAmount, 0),
  };

  // Details modal: later payments, and what was already paid when the bill was
  // recorded (paid amount minus the later payments).
  const detailPayments = detailBill?.payments || [];
  const detailPaidAtEntry = detailBill
    ? Math.max(
        0,
        detailBill.paidAmount -
          detailPayments.reduce((s, p) => s + p.amount, 0),
      )
    : 0;

  const chartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    effectiveBills.forEach((b) => {
      const label = b.category
        .replace("_", " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      categoryTotals[label] = (categoryTotals[label] || 0) + b.totalAmount;
    });
    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const COLORS = [
      "#8b5cf6",
      "#06b6d4",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#ec4899",
      "#6366f1",
      "#84cc16",
    ];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: COLORS.slice(0, labels.length).map((c) => c + "cc"),
          borderColor: COLORS.slice(0, labels.length),
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    };
  }, [effectiveBills]);

  const handleExportCSV = () => {
    if (filteredBills.length === 0) {
      addToast({
        title: "No Data",
        description: "Nothing to export.",
        color: "warning",
      });

      return;
    }
    const headers = [
      "Bill #",
      "Vendor",
      "Category",
      "Total (Rs)",
      "Paid (Rs)",
      "Due (Rs)",
      "Status",
      "Date",
      "Description",
      "Record",
      "Correction reason",
    ];
    const rows = filteredBills.map((b) => [
      b.billNumber,
      b.vendorName,
      b.category,
      b.totalAmount,
      b.paidAmount,
      b.dueAmount,
      b.paymentStatus,
      format(new Date(b.billDate), "yyyy-MM-dd"),
      b.description || "",
      isEffective(b) ? "Effective" : "Corrected (superseded)",
      b.correction?.reason || "",
    ]);
    const csvContent = toCsv([headers, ...rows]);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `expenses_${dateRange.start || "all"}_to_${dateRange.end || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({
      title: "Exported",
      description: `${filteredBills.length} records downloaded.`,
      color: "success",
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[15.5px] font-semibold text-primary tracking-tight">
            Accounts & Expenses
          </h1>
          <p className="text-[10.5px] text-[rgb(var(--color-text-muted))] font-medium tracking-wider opacity-60">
            Manage purchase bills, utility payments, and vendor records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "bills" && (
            <>
              <button
                className="h-8 px-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] text-[11px] font-semibold flex items-center gap-2 transition-all hover:bg-[rgb(var(--color-surface))] tracking-tight"
                onClick={handleExportCSV}
              >
                <IoDownloadOutline className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                className={`h-8 px-3 rounded-xl border text-[11px] font-semibold flex items-center gap-2 transition-all tracking-tight ${
                  showChart
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-surface))]"
                }`}
                onClick={() => setShowChart((v) => !v)}
              >
                <IoBarChartOutline className="w-3.5 h-3.5" />
                {showChart ? "Hide Chart" : "View Chart"}
              </button>
              <button
                className="h-8 px-4 rounded-xl bg-primary text-white text-[11px] font-semibold flex items-center gap-2 transition-all active:scale-[0.98] tracking-tight shadow-sm shadow-primary/20"
                onClick={openAddBill}
              >
                <IoAddOutline className="w-4 h-4" />
                Add New Bill
              </button>
            </>
          )}
          {activeTab === "vendors" && (
            <button
              className="h-8 px-4 rounded-xl bg-primary text-white text-[11px] font-semibold flex items-center gap-2 transition-all active:scale-[0.98] tracking-tight shadow-sm shadow-primary/20"
              onClick={openAddVendor}
            >
              <IoAddOutline className="w-4 h-4" />
              Add New Vendor
            </button>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 border-b border-[rgb(var(--color-border))]">
        {(
          [
            { key: "bills", label: "Bills", icon: <IoReceiptOutline className="w-3.5 h-3.5" /> },
            { key: "vendors", label: "Vendors", icon: <IoBusinessOutline className="w-3.5 h-3.5" /> },
            { key: "categories", label: "Categories", icon: <IoPricetagsOutline className="w-3.5 h-3.5" /> },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2.5 text-[12.5px] font-semibold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
            }`}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
            {tab.key === "vendors" && (
              <span className="ml-0.5 text-[10px] opacity-60">
                ({vendors.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "bills" && (
      <>
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <IoReceiptOutline className="text-[20px]" />
          </div>
          <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">
            Total Expenses
          </p>
          <p className="text-[16px] font-semibold text-[rgb(var(--color-text))] tracking-tighter mt-0.5">
            Rs. {stats.total.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[8px] font-semibold bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] px-1.5 py-0.5 border border-[rgb(var(--color-border))] tracking-wider">
              Current filters
            </span>
          </div>
        </div>

        <div className="p-3 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] relative overflow-hidden group border-l-4 border-l-primary">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <IoCheckmarkCircleOutline className="text-[20px] text-primary" />
          </div>
          <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">
            Total Paid
          </p>
          <p className="text-[16px] font-semibold text-primary tracking-tighter mt-0.5">
            Rs. {stats.paid.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[8px] font-semibold text-primary tracking-wider italic opacity-60">
              Settled amount
            </span>
          </div>
        </div>

        <div className="p-3 border border-rose-500/20 bg-rose-500/5 relative overflow-hidden group border-l-4 border-l-rose-500">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <IoTimeOutline className="text-[20px] text-rose-500" />
          </div>
          <p className="text-[8.5px] font-semibold text-rose-500/70 tracking-[0.1em] uppercase">
            Pending Balance
          </p>
          <p className="text-[16px] font-semibold text-rose-500 tracking-tighter mt-0.5">
            Rs. {stats.due.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[8px] font-semibold bg-rose-500/10 text-rose-500 px-1.5 py-0.5 border border-rose-500/20 tracking-wider">
              Action required
            </span>
          </div>
        </div>
      </div>

      {/* Expense Breakdown Chart */}
      {showChart && (
        <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[13px] font-bold text-[rgb(var(--color-text))] tracking-tight">
                Expense Breakdown by Category
              </h3>
              <p className="text-[10px] text-[rgb(var(--color-text-muted))] mt-0.5">
                Based on current filters · {effectiveBills.length} records
              </p>
            </div>
          </div>
          {chartData.labels.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[rgb(var(--color-text-muted))] text-[13px]">
              No data to display
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 h-56">
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) =>
                            ` Rs. ${Number(ctx.raw).toLocaleString()}`,
                        },
                      },
                    },
                    scales: {
                      y: {
                        ticks: {
                          callback: (v) => `Rs. ${Number(v).toLocaleString()}`,
                          font: { size: 10 },
                        },
                        grid: { color: "rgba(0,0,0,0.05)" },
                      },
                      x: {
                        ticks: { font: { size: 10 } },
                        grid: { display: false },
                      },
                    },
                  }}
                />
              </div>
              <div className="h-52 flex items-center justify-center">
                <Doughnut
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: {
                          font: { size: 10 },
                          padding: 10,
                          boxWidth: 12,
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (ctx) =>
                            ` Rs. ${Number(ctx.raw).toLocaleString()}`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 bg-[rgb(var(--color-surface-2))/0.3] p-4 rounded-xl border border-[rgb(var(--color-border))]">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest">
            Status:
          </span>
          {(["all", "paid", "pending", "partial"] as const).map((s) => (
            <button
              key={s}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all capitalize ${
                statusFilter === s
                  ? s === "paid"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : s === "pending"
                      ? "bg-rose-500/20 text-rose-500 border border-rose-500/30"
                      : s === "partial"
                        ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                        : "bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] border border-[rgb(var(--color-border))]"
                  : "bg-transparent text-[rgb(var(--color-text-muted))] border border-transparent hover:border-[rgb(var(--color-border))]"
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All Status" : s}
              <span className="ml-1 text-[9px] opacity-60">
                (
                {s === "all"
                  ? bills.filter(isEffective).length
                  : bills.filter((b) => isEffective(b) && b.paymentStatus === s)
                      .length}
                )
              </span>
            </button>
          ))}
        </div>
        {/* Category pills + date range row */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  activeCategory === cat.id
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))] hover:text-primary hover:bg-primary/5"
                }`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            <IoCalendarOutline className="w-4 h-4 text-[rgb(var(--color-text-muted))]" />
            <span className="text-[11px] text-[rgb(var(--color-text-muted))] font-semibold">
              From
            </span>
            <input
              className="h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              max={dateRange.end || undefined}
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
            />
            <span className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium">
              to
            </span>
            <input
              className="h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              min={dateRange.start || undefined}
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
            />
            <button
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors border border-rose-500/20"
              onClick={() => setDateRange({ start: "", end: "" })}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full">
          <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] w-4 h-4" />
          <input
            className="w-full h-10 pl-10 pr-4 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            placeholder="Search bills or vendors..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[rgb(var(--color-surface-2))/0.5] border-b border-[rgb(var(--color-border))]">
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))]">
                  Bill details
                </th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))]">
                  Category
                </th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] text-right">
                  Amount
                </th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))]">
                  Status
                </th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))]">
                  Date
                </th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--color-border))/0.5]">
              {loading ? (
                <tr>
                  <td
                    className="px-5 py-20 text-center text-[rgb(var(--color-text-muted))]"
                    colSpan={6}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-[13px] font-medium animate-pulse">
                        Retrieving financial ledger...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td className="px-5 py-20 text-center" colSpan={6}>
                    <div className="flex flex-col items-center gap-2 grayscale opacity-50">
                      <IoReceiptOutline className="w-12 h-12" />
                      <p className="text-[14px] font-bold text-[rgb(var(--color-text))]">
                        No purchase bills found
                      </p>
                      <p className="text-[12px] text-[rgb(var(--color-text-muted))]">
                        Try adjusting your filters or search terms.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    className={`hover:bg-[rgb(var(--color-surface-2))/0.3] transition-colors group ${
                      isEffective(bill) ? "" : "opacity-60"
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <IoReceiptOutline className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[rgb(var(--color-text))] group-hover:text-primary transition-colors leading-tight">
                            {bill.vendorName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-[rgb(var(--color-text-muted))] font-medium tracking-tight">
                              #{bill.billNumber}
                            </span>
                            {bill.itemName && (
                              <>
                                <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                                  •
                                </span>
                                <span className="text-[10px] text-primary font-semibold tracking-tight">
                                  {bill.itemName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] border border-[rgb(var(--color-border))] tracking-tighter capitalize">
                        {bill.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-[13.5px] font-semibold text-[rgb(var(--color-text))]">
                        Rs. {bill.totalAmount.toLocaleString()}
                      </p>
                      {bill.dueAmount > 0 && (
                        <p className="text-[10px] font-medium text-rose-500 mt-0.5">
                          Due: Rs. {bill.dueAmount.toLocaleString()}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          bill.paymentStatus === "paid"
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : bill.paymentStatus === "partial"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            bill.paymentStatus === "paid"
                              ? "bg-primary"
                              : bill.paymentStatus === "partial"
                                ? "bg-amber-500"
                                : "bg-rose-500"
                          }`}
                        />
                        {bill.paymentStatus.charAt(0).toUpperCase() +
                          bill.paymentStatus.slice(1)}
                      </span>
                      {!isEffective(bill) && (
                        <span
                          className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] border border-[rgb(var(--color-border))]"
                          title={bill.correction?.reason}
                        >
                          Corrected
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-[rgb(var(--color-text-muted))]">
                        <IoCalendarOutline className="w-3.5 h-3.5" />
                        <span className="text-[12.5px]">
                          {format(new Date(bill.billDate), "MMM dd, yyyy")}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {bill.dueAmount > 0 && isEffective(bill) && (
                          <button
                            className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black hover:bg-primary hover:text-white transition-all uppercase tracking-tighter"
                            onClick={() => {
                              setSelectedBill(bill);
                              setPaymentAmount(bill.dueAmount.toString());
                              setPaymentMethod("Cash");
                              setIsPaymentModalOpen(true);
                            }}
                          >
                            Pay Due
                          </button>
                        )}
                        <button
                          className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-[rgb(var(--color-text-muted))] hover:text-primary"
                          title="Print Invoice"
                          onClick={() => handlePrintBill(bill)}
                        >
                          <IoPrintOutline className="w-4.5 h-4.5" />
                        </button>
                        <Dropdown placement="bottom-end">
                          <DropdownTrigger>
                            <button
                              aria-label="More actions"
                              className="p-2 hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors text-[rgb(var(--color-text-muted))] hover:text-primary"
                            >
                              <IoEllipsisHorizontal className="w-5 h-5" />
                            </button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Bill actions">
                            <DropdownItem
                              key="view"
                              startContent={
                                <IoEyeOutline className="w-4 h-4" />
                              }
                              onClick={() => setDetailBill(bill)}
                            >
                              View details
                            </DropdownItem>
                            <DropdownItem
                              key="correct"
                              description={
                                !isEffective(bill)
                                  ? "Already corrected"
                                  : isPayrollBill(bill)
                                    ? "Managed from HR payroll"
                                    : "Saves a new bill; the original is kept"
                              }
                              isDisabled={
                                isPayrollBill(bill) || !isEffective(bill)
                              }
                              startContent={
                                <IoCreateOutline className="w-4 h-4" />
                              }
                              onClick={() => openCorrectBill(bill)}
                            >
                              Correct bill
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {activeTab === "vendors" && (
        <div className="space-y-4">
          <div className="relative w-full max-w-md">
            <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
            <input
              className="w-full h-10 pl-10 pr-4 bg-surface border border-border-base rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              placeholder="Search vendors..."
              type="text"
              value={vendorSearchQuery}
              onChange={(e) => setVendorSearchQuery(e.target.value)}
            />
          </div>

          <div className="bg-surface border border-border-base rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-2/50 border-b border-border-base">
                    <th className="px-5 py-4 text-[11px] font-semibold text-text-muted">
                      Vendor
                    </th>
                    <th className="px-5 py-4 text-[11px] font-semibold text-text-muted">
                      Contact
                    </th>
                    <th className="px-5 py-4 text-[11px] font-semibold text-text-muted">
                      Address
                    </th>
                    <th className="px-5 py-4 text-[11px] font-semibold text-text-muted">
                      Status
                    </th>
                    <th className="px-5 py-4 text-[11px] font-semibold text-text-muted text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base">
                  {filteredVendors.length === 0 ? (
                    <tr>
                      <td
                        className="px-5 py-10 text-center text-text-muted text-[13px]"
                        colSpan={5}
                      >
                        {vendors.length === 0
                          ? "No vendors yet. Add one to get started."
                          : "No vendors match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((v) => (
                      <tr key={v.id}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-[13px] text-text-main">
                            {v.name}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-[12.5px] text-text-muted">
                          {v.phone && (
                            <div className="flex items-center gap-1.5">
                              <IoCallOutline className="w-3.5 h-3.5 shrink-0" />
                              {v.phone}
                            </div>
                          )}
                          {v.email && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <IoMailOutline className="w-3.5 h-3.5 shrink-0" />
                              {v.email}
                            </div>
                          )}
                          {!v.phone && !v.email && "—"}
                        </td>
                        <td className="px-5 py-3 text-[12.5px] text-text-muted">
                          {v.address || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              v.isActive !== false
                                ? "bg-primary/10 text-primary"
                                : "bg-surface-2 text-text-muted"
                            }`}
                          >
                            {v.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-text-muted hover:text-primary"
                              title="Edit vendor"
                              type="button"
                              onClick={() => openEditVendor(v)}
                            >
                              <IoCreateOutline className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 hover:bg-surface-2 rounded-lg transition-colors text-text-muted hover:text-rose-500"
                              title={
                                v.isActive !== false
                                  ? "Deactivate vendor"
                                  : "Reactivate vendor"
                              }
                              type="button"
                              onClick={() => toggleVendorActive(v)}
                            >
                              {v.isActive !== false ? (
                                <IoBanOutline className="w-4 h-4" />
                              ) : (
                                <IoRefreshOutline className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-surface-2 border border-border-base rounded-xl text-[12px] text-text-muted">
            <IoInformationCircleOutline className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              These categories are fixed to keep bill classification
              consistent for accounting and IRD reporting, and aren&apos;t
              user-editable. &ldquo;Salaries&rdquo; in particular is tied to
              payroll — those bills are managed from HR instead of here.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(CATEGORY_META).map(([id, meta]) => {
              const catBills = bills.filter(
                (b) => isEffective(b) && b.category === id,
              );
              const total = catBills.reduce(
                (sum, b) => sum + b.totalAmount,
                0,
              );

              return (
                <div
                  key={id}
                  className="p-4 border border-border-base bg-surface rounded-xl"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {meta.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-[13.5px] text-text-main">
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {catBills.length} bill
                        {catBills.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11.5px] text-text-muted mb-2">
                    {meta.description}
                  </p>
                  <p className="text-[15px] font-bold text-text-main">
                    Rs. {total.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Bill Modal */}
      <Modal
        isOpen={isBillModalOpen}
        size="2xl"
        onClose={() => handleBillModalChange(false)}
      >
        <ModalContent>
          <form onSubmit={handleSaveBill}>
            <ModalHeader>
              <div>
                <p className="text-[14px] font-bold text-text-main">
                  {correctingBill
                    ? "Correct Purchase Bill"
                    : "Record Purchase Bill"}
                </p>
                <p className="text-[11.5px] text-text-muted">
                  {correctingBill
                    ? `Correcting bill #${correctingBill.billNumber}. The original is kept and marked as corrected; this saves a new bill that replaces it.`
                    : "Enter details of the purchase or expense bill."}
                </p>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4 py-1">
                {correctingBill && (
                  <div className="col-span-2">
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                      Reason for correction *
                    </p>
                    <Textarea
                      aria-label="Reason for correction"
                      placeholder="e.g. Wrong amount entered, vendor reissued the bill..."
                      rows={2}
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                    />
                  </div>
                )}

                <div className="col-span-2 flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-wider -mb-1">
                  <IoReceiptOutline className="w-3.5 h-3.5" />
                  Bill identification
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Category
                  </label>
                  <Select
                    placeholder="Select category"
                    selectedKeys={[billForm.category]}
                    size="sm"
                    onChange={(e) =>
                      setBillForm({
                        ...billForm,
                        category: e.target.value as any,
                      })
                    }
                  >
                    {categories
                      .filter((c) => c.id !== "all")
                      .map((cat) => (
                        <SelectItem key={cat.id}>{cat.label}</SelectItem>
                      ))}
                  </Select>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Vendor / Supplier
                  </label>
                  <div className="flex gap-2">
                    <Select
                      className="flex-1"
                      placeholder="Select vendor"
                      selectedKeys={
                        billForm.vendorId ? [billForm.vendorId] : []
                      }
                      size="sm"
                      onChange={(e) => {
                        const v = vendors.find(
                          (vend) => vend.id === e.target.value,
                        );

                        setBillForm({
                          ...billForm,
                          vendorId: e.target.value,
                          vendorName: v?.name || "",
                        });
                      }}
                    >
                      {vendors
                        .filter((v) => v.isActive !== false)
                        .map((v) => (
                          <SelectItem key={v.id}>{v.name}</SelectItem>
                        ))}
                    </Select>
                    <Button
                      isIconOnly
                      color="primary"
                      size="sm"
                      title="Add a new vendor"
                      type="button"
                      variant="bordered"
                      onPress={openAddVendor}
                    >
                      <IoAddOutline size={18} />
                    </Button>
                  </div>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Bill Number
                  </label>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      placeholder="e.g. INV-2024-001"
                      size="sm"
                      value={billForm.billNumber}
                      onChange={(e) =>
                        setBillForm({
                          ...billForm,
                          billNumber: e.target.value,
                        })
                      }
                    />
                    <Button
                      className="font-bold text-[11px] shrink-0"
                      size="sm"
                      variant="flat"
                      type="button"
                      onPress={generateBillNumber}
                    >
                      Auto
                    </Button>
                  </div>
                </div>

                {["equipment", "office_supply", "other"].includes(
                  billForm.category,
                ) && (
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                      Item / Inventory Name
                    </label>
                    <Input
                      placeholder="e.g. Laptop, Mobile, Oxygen Cylinder, Calculator..."
                      size="sm"
                      value={billForm.itemName}
                      onChange={(e) =>
                        setBillForm({ ...billForm, itemName: e.target.value })
                      }
                    />
                  </div>
                )}

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Bill Date
                  </label>
                  <Input
                    size="sm"
                    type="date"
                    value={billForm.billDate}
                    onChange={(e) =>
                      setBillForm({ ...billForm, billDate: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-wider pt-2 -mb-1 border-t border-border-base">
                  <IoBarChartOutline className="w-3.5 h-3.5 mt-2" />
                  <span className="mt-2">Amounts</span>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Total Amount (Rs.)
                  </label>
                  <Input
                    placeholder="0.00"
                    size="sm"
                    startContent={
                      <span className="text-[12px] text-text-muted">Rs.</span>
                    }
                    type="number"
                    value={billForm.totalAmount}
                    onChange={(e) =>
                      setBillForm({
                        ...billForm,
                        totalAmount: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Paid Amount (Rs.)
                  </label>
                  <Input
                    placeholder="0.00"
                    size="sm"
                    startContent={
                      <span className="text-[12px] text-text-muted">Rs.</span>
                    }
                    type="number"
                    value={billForm.paidAmount}
                    onChange={(e) =>
                      setBillForm({ ...billForm, paidAmount: e.target.value })
                    }
                  />
                </div>

                {billForm.totalAmount && (
                  <div className="col-span-2 flex items-center justify-between rounded-md bg-surface-2 border border-border-base px-3 py-2">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Balance due
                    </span>
                    <span
                      className={`text-[14px] font-bold ${
                        (parseFloat(billForm.totalAmount) || 0) -
                          (parseFloat(billForm.paidAmount) || 0) >
                        0
                          ? "text-warning"
                          : "text-success"
                      }`}
                    >
                      Rs.{" "}
                      {(
                        (parseFloat(billForm.totalAmount) || 0) -
                        (parseFloat(billForm.paidAmount) || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Description / Notes
                  </label>
                  <Textarea
                    placeholder="Brief details about the purchase..."
                    rows={2}
                    value={billForm.description}
                    onChange={(e) =>
                      setBillForm({
                        ...billForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                className="text-[13px] font-bold"
                type="button"
                variant="light"
                onPress={() => handleBillModalChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="text-[13px] font-bold px-6 shadow-lg shadow-primary/20"
                color="primary"
                isLoading={saving}
                type="submit"
              >
                {correctingBill ? "Save Correction" : "Save Bill"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Add/Edit Vendor Modal */}
      <Modal
        isOpen={isVendorModalOpen}
        size="md"
        onClose={() => handleVendorModalChange(false)}
      >
        <ModalContent>
          <form onSubmit={handleSaveVendor}>
            <ModalHeader>
              <p className="text-[14px] font-bold text-text-main">
                {editingVendor ? "Edit Vendor" : "Add New Vendor"}
              </p>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4 py-1">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Vendor Name
                  </label>
                  <Input
                    placeholder="Full Name / Company Name"
                    size="sm"
                    value={vendorForm.name}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                      Phone
                    </label>
                    <Input
                      placeholder="Contact number"
                      size="sm"
                      value={vendorForm.phone}
                      onChange={(e) =>
                        setVendorForm({
                          ...vendorForm,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                      Email
                    </label>
                    <Input
                      placeholder="Email address"
                      size="sm"
                      type="email"
                      value={vendorForm.email}
                      onChange={(e) =>
                        setVendorForm({
                          ...vendorForm,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Address
                  </label>
                  <Input
                    placeholder="Office address"
                    size="sm"
                    value={vendorForm.address}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        address: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                size="sm"
                type="button"
                variant="light"
                onPress={() => handleVendorModalChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="font-bold"
                color="primary"
                isLoading={saving}
                size="sm"
                type="submit"
              >
                {editingVendor ? "Save Changes" : "Add Vendor"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        size="md"
        onClose={() => setIsPaymentModalOpen(false)}
      >
        <ModalContent>
          <form onSubmit={handleRecordPayment}>
            <ModalHeader>
              <div>
                <p className="text-[14px] font-bold text-text-main">
                  Record payment
                </p>
                <p className="text-[11.5px] text-text-muted">
                  Record a new payment for {selectedBill?.vendorName}
                </p>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4 py-1">
                <div className="p-3 bg-surface-2 rounded-md border border-border-base">
                  <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    Current outstanding
                  </p>
                  <p className="text-[16px] font-semibold text-danger tracking-tighter">
                    Rs. {selectedBill?.dueAmount.toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Payment amount (Rs.)
                  </label>
                  <Input
                    placeholder="0.00"
                    size="sm"
                    startContent={
                      <span className="text-[12px] text-text-muted">Rs.</span>
                    }
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 block">
                    Payment method
                  </label>
                  <Select
                    placeholder="Select method"
                    selectedKeys={[paymentMethod]}
                    size="sm"
                    onChange={(e) =>
                      e.target.value && setPaymentMethod(e.target.value)
                    }
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method}>{method}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                className="font-semibold text-[12.5px]"
                size="sm"
                type="button"
                variant="light"
                onPress={() => setIsPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="font-semibold text-[12.5px] px-6"
                color="primary"
                isLoading={saving}
                size="sm"
                type="submit"
              >
                Record payment
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Bill Details Modal */}
      <Modal
        isOpen={!!detailBill}
        scrollBehavior="inside"
        size="lg"
        onClose={() => setDetailBill(null)}
      >
        <ModalContent>
          {detailBill && (
            <>
              <ModalHeader>
                <div>
                  <p className="text-[14px] font-bold text-text-main">
                    {detailBill.vendorName}
                  </p>
                  <p className="text-[11.5px] text-text-muted">
                    Bill #{detailBill.billNumber}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4 py-1">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <DetailRow
                      label="Category"
                      value={titleCase(detailBill.category.replace("_", " "))}
                    />
                    <DetailRow label="Item" value={detailBill.itemName} />
                    <DetailRow
                      label="Bill date"
                      value={format(
                        new Date(detailBill.billDate),
                        "MMM dd, yyyy",
                      )}
                    />
                    <DetailRow
                      label="Status"
                      value={titleCase(detailBill.paymentStatus)}
                    />
                    <DetailRow
                      label="Total"
                      value={`Rs. ${detailBill.totalAmount.toLocaleString()}`}
                    />
                    <DetailRow
                      label="Paid"
                      value={`Rs. ${detailBill.paidAmount.toLocaleString()}`}
                    />
                    <DetailRow
                      label="Due"
                      value={`Rs. ${detailBill.dueAmount.toLocaleString()}`}
                    />
                    <DetailRow
                      label="Payment method"
                      value={detailBill.paymentMethod}
                    />
                    <div className="col-span-2">
                      <DetailRow
                        label="Description"
                        value={detailBill.description}
                      />
                    </div>
                  </dl>

                  {detailBill.correction && (
                    <div className="rounded-md border border-border-base bg-surface-2 p-3 text-[12px] space-y-0.5">
                      <p className="font-semibold text-text-main">
                        This bill was corrected and is no longer effective
                      </p>
                      <p className="text-text-muted">
                        Reason: {detailBill.correction.reason}
                      </p>
                      <p className="text-text-muted">
                        By {detailBill.correction.correctedByName || "—"} on{" "}
                        {format(
                          new Date(detailBill.correction.correctedAt),
                          "MMM dd, yyyy h:mm a",
                        )}
                      </p>
                      <p className="text-text-muted">
                        Replaced by bill #
                        {detailBill.correction.replacedByBillNumber}
                      </p>
                    </div>
                  )}
                  {detailBill.correctsBillId && (
                    <p className="text-[12px] text-text-muted">
                      This bill corrects bill #
                      {bills.find((b) => b.id === detailBill.correctsBillId)
                        ?.billNumber ?? "—"}
                      .
                    </p>
                  )}

                  <div>
                    <h3 className="text-[12px] font-semibold text-text-main mb-2">
                      Payment history
                    </h3>
                    {detailPaidAtEntry > 0 && (
                      <p className="text-[12px] text-text-muted mb-2">
                        Paid when the bill was recorded:{" "}
                        <span className="font-medium text-text-main">
                          Rs. {detailPaidAtEntry.toLocaleString()}
                        </span>
                      </p>
                    )}
                    {detailPayments.length === 0 ? (
                      <p className="text-[12px] text-text-muted">
                        No later payments recorded.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border-base border border-border-base rounded-md overflow-hidden">
                        {detailPayments.map((p, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]"
                          >
                            <span className="text-text-muted">
                              {format(new Date(p.date), "MMM dd, yyyy h:mm a")}
                              {p.method && ` · ${p.method}`}
                            </span>
                            <span className="font-semibold text-text-main">
                              Rs. {p.amount.toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  className="font-semibold text-[12.5px]"
                  size="sm"
                  variant="light"
                  onPress={() => setDetailBill(null)}
                >
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-[13px] text-text-main break-words whitespace-pre-wrap">
        {value || "—"}
      </dd>
    </div>
  );
}
