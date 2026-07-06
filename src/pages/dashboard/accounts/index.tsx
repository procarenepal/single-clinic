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
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";

import { printAccountBill } from "@/utils/accountPrinting";
import { clinicService } from "@/services/clinicService";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { accountService } from "@/services/accountService";
import { AccountBill, Vendor } from "@/types/models";

export default function AccountsPage() {
  const { clinicId, userData, branchId } = useAuthContext();
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

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<AccountBill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const [billForm, setBillForm] = useState({
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
  }, [clinicId, branchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [billsData, vendorsData] = await Promise.all([
        accountService.getBillsByClinic(clinicId!, branchId || undefined),
        accountService.getVendorsByClinic(clinicId!, branchId || undefined),
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

    setSaving(true);
    try {
      const total = parseFloat(billForm.totalAmount);
      const paid = parseFloat(billForm.paidAmount || "0");
      const due = total - paid;

      let status: AccountBill["paymentStatus"] = "pending";

      if (paid >= total) status = "paid";
      else if (paid > 0) status = "partial";

      await accountService.createBill({
        ...billForm,
        totalAmount: total,
        paidAmount: paid,
        dueAmount: due,
        paymentStatus: status,
        billDate: new Date(billForm.billDate),
        clinicId: clinicId!,
        branchId: branchId || "",
        createdBy: userData?.id || "",
      });

      addToast({
        title: "Success",
        description: "Purchase bill recorded successfully",
        color: "success",
      });
      setIsBillModalOpen(false);
      loadData();
      setBillForm({
        category: "other",
        itemName: "",
        vendorName: "",
        vendorId: "",
        billNumber: "",
        billDate: format(new Date(), "yyyy-MM-dd"),
        totalAmount: "",
        paidAmount: "",
        description: "",
        paymentStatus: "pending",
        paymentMethod: "Cash",
      });
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
      });

      addToast({
        title: "Success",
        description: `Recorded payment of Rs. ${amount.toLocaleString()}`,
        color: "success",
      });
      setIsPaymentModalOpen(false);
      setSelectedBill(null);
      setPaymentAmount("");
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

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name) return;

    setSaving(true);
    try {
      const id = await accountService.createVendor({
        ...vendorForm,
        isActive: true,
        clinicId: clinicId!,
        branchId: branchId || "",
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
          branchId: branchId || "",
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userData?.id || "",
        },
      ]);
      setBillForm((prev) => ({
        ...prev,
        vendorName: vendorForm.name,
        vendorId: id,
      }));
      setIsVendorModalOpen(false);
      setVendorForm({
        name: "",
        category: "General",
        phone: "",
        email: "",
        address: "",
      });
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

  const stats = {
    total: filteredBills.reduce((acc, b) => acc + b.totalAmount, 0),
    paid: filteredBills.reduce((acc, b) => acc + b.paidAmount, 0),
    due: filteredBills.reduce((acc, b) => acc + b.dueAmount, 0),
  };

  const chartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    filteredBills.forEach((b) => {
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
  }, [filteredBills]);

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
      (b.description || "").replace(/,/g, " "),
    ]);
    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
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
            onClick={() => setIsBillModalOpen(true)}
          >
            <IoAddOutline className="w-4 h-4" />
            Add New Bill
          </button>
        </div>
      </div>

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
              All time
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
                Based on current filters · {filteredBills.length} records
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
                  ? bills.length
                  : bills.filter((b) => b.paymentStatus === s).length}
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
                    className="hover:bg-[rgb(var(--color-surface-2))/0.3] transition-colors group"
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
                        {bill.dueAmount > 0 && (
                          <button
                            className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black hover:bg-primary hover:text-white transition-all uppercase tracking-tighter"
                            onClick={() => {
                              setSelectedBill(bill);
                              setPaymentAmount(bill.dueAmount.toString());
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
                        <button className="p-2 hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors text-[rgb(var(--color-text-muted))] hover:text-primary">
                          <IoEllipsisHorizontal className="w-5 h-5" />
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
      {/* Add Bill Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
          header: "border-b border-[rgb(var(--color-border))]",
          footer: "border-t border-[rgb(var(--color-border))]",
        }}
        isOpen={isBillModalOpen}
        size="2xl"
        onOpenChange={setIsBillModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleSaveBill}>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[rgb(var(--color-text))]">
                  Record Purchase Bill
                </h2>
                <p className="text-[12px] text-[rgb(var(--color-text-muted))] font-normal">
                  Enter details of the purchase or expense bill.
                </p>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Category
                    </label>
                    <Select
                      className="max-w-full"
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
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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
                        {vendors.map((v) => (
                          <SelectItem key={v.id}>{v.name}</SelectItem>
                        ))}
                      </Select>
                      <button
                        className="p-2 border border-[rgb(var(--color-border))] rounded-lg hover:bg-[rgb(var(--color-surface-2))] text-primary transition-colors"
                        type="button"
                        onClick={() => setIsVendorModalOpen(true)}
                      >
                        <IoAddOutline size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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
                        className="font-bold text-[10px] min-w-[50px] h-8 rounded-xl"
                        size="sm"
                        variant="flat"
                        onPress={generateBillNumber}
                      >
                        Auto
                      </Button>
                    </div>
                  </div>

                  {["equipment", "office_supply", "other"].includes(
                    billForm.category,
                  ) && (
                    <div className="col-span-2">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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

                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Description / Notes
                    </label>
                    <Textarea
                      minRows={2}
                      placeholder="Brief details about the purchase..."
                      size="sm"
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
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="text-[13px] font-bold px-6 shadow-lg shadow-primary/20"
                  color="primary"
                  isLoading={saving}
                  type="submit"
                >
                  Save Bill
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Add Vendor Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
        }}
        isOpen={isVendorModalOpen}
        size="md"
        onOpenChange={setIsVendorModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleSaveVendor}>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))]">
                  Add New Vendor
                </h2>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
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
                <Button size="sm" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  className="font-bold"
                  color="primary"
                  isLoading={saving}
                  size="sm"
                  type="submit"
                >
                  Add Vendor
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
      {/* Record Payment Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl",
        }}
        isOpen={isPaymentModalOpen}
        size="md"
        onOpenChange={setIsPaymentModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleRecordPayment}>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[17px] font-semibold text-primary tracking-tight">
                  Record payment
                </h2>
                <p className="text-[11.5px] text-[rgb(var(--color-text-muted))] font-medium">
                  Record a new payment for {selectedBill?.vendorName}
                </p>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div className="p-3 bg-[rgb(var(--color-surface-2))] rounded-xl border border-[rgb(var(--color-border))]">
                    <p className="text-[9px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1">
                      Current outstanding
                    </p>
                    <p className="text-[16px] font-semibold text-rose-500 tracking-tighter">
                      Rs. {selectedBill?.dueAmount.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Payment amount (Rs.)
                    </label>
                    <Input
                      classNames={{ inputWrapper: "rounded-xl" }}
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
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Payment method
                    </label>
                    <Select
                      className="max-w-full"
                      classNames={{ trigger: "rounded-xl" }}
                      defaultSelectedKeys={["Cash"]}
                      placeholder="Select method"
                      size="sm"
                    >
                      {[
                        "Cash",
                        "Bank Transfer",
                        "E-Sewa",
                        "Khalti",
                        "Cheque",
                      ].map((method) => (
                        <SelectItem key={method}>{method}</SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  className="font-semibold text-[12.5px] rounded-xl"
                  size="sm"
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-semibold text-[12.5px] rounded-xl px-6"
                  color="primary"
                  isLoading={saving}
                  size="sm"
                  type="submit"
                >
                  Record payment
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
