import React, { useState, useEffect } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoFilterOutline,
  IoReceiptOutline,
  IoCashOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoCalendarOutline,
  IoCloudUploadOutline,
  IoEllipsisHorizontal,
  IoPrintOutline,
} from "react-icons/io5";

import { printAccountBill } from "@/utils/accountPrinting";
import { clinicService } from "@/services/clinicService";

import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { accountService } from "@/services/accountService";
import { AccountBill, Vendor } from "@/types/models";
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
import { Spinner as HeroSpinner } from "@heroui/spinner";

export default function AccountsPage() {
  const { clinicId, userData, branchId } = useAuthContext();
  const [bills, setBills] = useState<AccountBill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

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
    setBillForm(prev => ({ ...prev, billNumber: newBillNumber }));
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
      addToast({ title: "Error", description: "Failed to load financial records", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billForm.vendorName || !billForm.totalAmount || !billForm.billNumber) {
      addToast({ title: "Validation Error", description: "Please fill in all required fields", color: "warning" });
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

      addToast({ title: "Success", description: "Purchase bill recorded successfully", color: "success" });
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
      addToast({ title: "Error", description: "Failed to save bill record", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || !paymentAmount || parseFloat(paymentAmount) <= 0) return;

    const amount = parseFloat(paymentAmount);
    if (amount > selectedBill.dueAmount) {
      addToast({ title: "Invalid Amount", description: "Payment cannot exceed due amount", color: "warning" });
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

      addToast({ title: "Success", description: `Recorded payment of Rs. ${amount.toLocaleString()}`, color: "success" });
      setIsPaymentModalOpen(false);
      setSelectedBill(null);
      setPaymentAmount("");
      loadData();
    } catch (error) {
      console.error("Error recording payment:", error);
      addToast({ title: "Error", description: "Failed to record payment", color: "danger" });
    } finally {
      setSaving(false);
    }
  };


  const handlePrintBill = async (bill: AccountBill) => {
    if (!clinicId) return;
    try {
      const [clinicData, printConfig] = await Promise.all([
        clinicService.getClinicById(clinicId),
        clinicService.getPrintLayoutConfig(clinicId)
      ]);

      if (!clinicData) throw new Error("Clinic data not found");
      
      const effectiveConfig = printConfig || {
        clinicId,
        primaryColor: "#7c3aed",
        fontSize: "medium",
        showAddress: true,
        showPhone: true,
        showEmail: true,
        headerHeight: "compact"
      } as any;

      printAccountBill(bill, clinicData, effectiveConfig);
    } catch (error) {
      console.error("Failed to print bill:", error);
      addToast({ title: "Print Error", description: "Could not generate document", color: "danger" });
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

      addToast({ title: "Success", description: "Vendor added successfully", color: "success" });
      setVendors(prev => [...prev, { ...vendorForm, id, isActive: true, clinicId: clinicId!, branchId: branchId || "", createdAt: new Date(), updatedAt: new Date(), createdBy: userData?.id || "" }]);
      setBillForm(prev => ({ ...prev, vendorName: vendorForm.name, vendorId: id }));
      setIsVendorModalOpen(false);
      setVendorForm({ name: "", category: "General", phone: "", email: "", address: "" });
    } catch (error) {
      console.error("Error saving vendor:", error);
      addToast({ title: "Error", description: "Failed to save vendor", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         bill.billNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || bill.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: bills.reduce((acc, b) => acc + b.totalAmount, 0),
    paid: bills.reduce((acc, b) => acc + b.paidAmount, 0),
    due: bills.reduce((acc, b) => acc + b.dueAmount, 0),
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[15.5px] font-semibold text-primary tracking-tight">Accounts & Expenses</h1>
          <p className="text-[10.5px] text-[rgb(var(--color-text-muted))] font-medium tracking-wider opacity-60">Manage purchase bills, utility payments, and vendor records.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] text-[11px] font-semibold flex items-center gap-2 transition-all hover:bg-[rgb(var(--color-surface))] tracking-tight">
            <IoCloudUploadOutline className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button 
            onClick={() => setIsBillModalOpen(true)}
            className="h-8 px-4 rounded-xl bg-primary text-white text-[11px] font-semibold flex items-center gap-2 transition-all active:scale-[0.98] tracking-tight shadow-sm shadow-primary/20"
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
          <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">Total Expenses</p>
          <p className="text-[16px] font-semibold text-[rgb(var(--color-text))] tracking-tighter mt-0.5">Rs. {stats.total.toLocaleString()}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[8px] font-semibold bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] px-1.5 py-0.5 border border-[rgb(var(--color-border))] tracking-wider">All time</span>
          </div>
        </div>

        <div className="p-3 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] relative overflow-hidden group border-l-4 border-l-primary">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <IoCheckmarkCircleOutline className="text-[20px] text-primary" />
          </div>
          <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">Total Paid</p>
          <p className="text-[16px] font-semibold text-primary tracking-tighter mt-0.5">Rs. {stats.paid.toLocaleString()}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[8px] font-semibold text-primary tracking-wider italic opacity-60">Settled amount</span>
          </div>
        </div>

        <div className="p-3 border border-rose-500/20 bg-rose-500/5 relative overflow-hidden group border-l-4 border-l-rose-500">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <IoTimeOutline className="text-[20px] text-rose-500" />
          </div>
          <p className="text-[8.5px] font-semibold text-rose-500/70 tracking-[0.1em] uppercase">Pending Balance</p>
          <p className="text-[16px] font-semibold text-rose-500 tracking-tighter mt-0.5">Rs. {stats.due.toLocaleString()}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[8px] font-semibold bg-rose-500/10 text-rose-500 px-1.5 py-0.5 border border-rose-500/20 tracking-wider">Action required</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[rgb(var(--color-surface-2))/0.3] p-4 rounded-xl border border-[rgb(var(--color-border))]">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                activeCategory === cat.id
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))] hover:text-primary hover:bg-primary/5"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] w-4 h-4" />
          <input
            type="text"
            placeholder="Search bills or vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[rgb(var(--color-surface-2))/0.5] border-b border-[rgb(var(--color-border))]">
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))]">Bill details</th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))]">Category</th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] text-right">Amount</th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))]">Status</th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))]">Date</th>
                <th className="px-5 py-4 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--color-border))/0.5]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center text-[rgb(var(--color-text-muted))]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[13px] font-medium animate-pulse">Retrieving financial ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 grayscale opacity-50">
                      <IoReceiptOutline className="w-12 h-12" />
                      <p className="text-[14px] font-bold text-[rgb(var(--color-text))]">No purchase bills found</p>
                      <p className="text-[12px] text-[rgb(var(--color-text-muted))]">Try adjusting your filters or search terms.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-[rgb(var(--color-surface-2))/0.3] transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <IoReceiptOutline className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[rgb(var(--color-text))] group-hover:text-primary transition-colors leading-tight">{bill.vendorName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-[rgb(var(--color-text-muted))] font-medium tracking-tight">#{bill.billNumber}</span>
                            {bill.itemName && (
                              <>
                                <span className="text-[10px] text-[rgb(var(--color-text-muted))]">•</span>
                                <span className="text-[10px] text-primary font-semibold tracking-tight">{bill.itemName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] border border-[rgb(var(--color-border))] tracking-tighter capitalize">
                        {bill.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-[13.5px] font-semibold text-[rgb(var(--color-text))]">Rs. {bill.totalAmount.toLocaleString()}</p>
                      {bill.dueAmount > 0 && (
                        <p className="text-[10px] font-medium text-rose-500 mt-0.5">Due: Rs. {bill.dueAmount.toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                        bill.paymentStatus === 'paid' 
                          ? 'bg-primary/10 text-primary border border-primary/20' 
                          : bill.paymentStatus === 'partial'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          bill.paymentStatus === 'paid' ? 'bg-primary' : bill.paymentStatus === 'partial' ? 'bg-amber-500' : 'bg-rose-500'
                        }`}></div>
                        {bill.paymentStatus.charAt(0).toUpperCase() + bill.paymentStatus.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-[rgb(var(--color-text-muted))]">
                        <IoCalendarOutline className="w-3.5 h-3.5" />
                        <span className="text-[12.5px]">{format(new Date(bill.billDate), 'MMM dd, yyyy')}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {bill.dueAmount > 0 && (
                          <button 
                            onClick={() => {
                              setSelectedBill(bill);
                              setPaymentAmount(bill.dueAmount.toString());
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black hover:bg-primary hover:text-white transition-all uppercase tracking-tighter"
                          >
                            Pay Due
                          </button>
                        )}
                        <button 
                          onClick={() => handlePrintBill(bill)}
                          className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-[rgb(var(--color-text-muted))] hover:text-primary"
                          title="Print Invoice"
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
        isOpen={isBillModalOpen} 
        onOpenChange={setIsBillModalOpen}
        size="2xl"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
          header: "border-b border-[rgb(var(--color-border))]",
          footer: "border-t border-[rgb(var(--color-border))]",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleSaveBill}>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[18px] font-bold text-[rgb(var(--color-text))]">Record Purchase Bill</h2>
                <p className="text-[12px] text-[rgb(var(--color-text-muted))] font-normal">Enter details of the purchase or expense bill.</p>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Category</label>
                    <Select
                      placeholder="Select category"
                      selectedKeys={[billForm.category]}
                      onChange={(e) => setBillForm({ ...billForm, category: e.target.value as any })}
                      className="max-w-full"
                      size="sm"
                    >
                      {categories.filter(c => c.id !== 'all').map((cat) => (
                        <SelectItem key={cat.id}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Vendor / Supplier</label>
                    <div className="flex gap-2">
                      <Select
                        placeholder="Select vendor"
                        selectedKeys={billForm.vendorId ? [billForm.vendorId] : []}
                        onChange={(e) => {
                          const v = vendors.find(vend => vend.id === e.target.value);
                          setBillForm({ ...billForm, vendorId: e.target.value, vendorName: v?.name || "" });
                        }}
                        className="flex-1"
                        size="sm"
                      >
                        {vendors.map((v) => (
                          <SelectItem key={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </Select>
                      <button 
                        type="button"
                        onClick={() => setIsVendorModalOpen(true)}
                        className="p-2 border border-[rgb(var(--color-border))] rounded-lg hover:bg-[rgb(var(--color-surface-2))] text-primary transition-colors"
                      >
                        <IoAddOutline size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Bill Number</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. INV-2024-001"
                        value={billForm.billNumber}
                        onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })}
                        size="sm"
                        className="flex-1"
                      />
                      <Button 
                        size="sm" 
                        variant="flat" 
                        onPress={generateBillNumber}
                        className="font-bold text-[10px] min-w-[50px] h-8 rounded-xl"
                      >
                        Auto
                      </Button>
                    </div>
                  </div>

                  {["equipment", "office_supply", "other"].includes(billForm.category) && (
                    <div className="col-span-2">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Item / Inventory Name</label>
                      <Input
                        placeholder="e.g. Laptop, Mobile, Oxygen Cylinder, Calculator..."
                        value={billForm.itemName}
                        onChange={(e) => setBillForm({ ...billForm, itemName: e.target.value })}
                        size="sm"
                      />
                    </div>
                  )}

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Bill Date</label>
                    <Input
                      type="date"
                      value={billForm.billDate}
                      onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
                      size="sm"
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Total Amount (Rs.)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={billForm.totalAmount}
                      onChange={(e) => setBillForm({ ...billForm, totalAmount: e.target.value })}
                      size="sm"
                      startContent={<span className="text-[12px] text-text-muted">Rs.</span>}
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Paid Amount (Rs.)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={billForm.paidAmount}
                      onChange={(e) => setBillForm({ ...billForm, paidAmount: e.target.value })}
                      size="sm"
                      startContent={<span className="text-[12px] text-text-muted">Rs.</span>}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Description / Notes</label>
                    <Textarea
                      placeholder="Brief details about the purchase..."
                      value={billForm.description}
                      onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
                      size="sm"
                      minRows={2}
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} className="text-[13px] font-bold">Cancel</Button>
                <Button 
                  color="primary" 
                  type="submit" 
                  isLoading={saving}
                  className="text-[13px] font-bold px-6 shadow-lg shadow-primary/20"
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
        isOpen={isVendorModalOpen} 
        onOpenChange={setIsVendorModalOpen}
        size="md"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleSaveVendor}>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))]">Add New Vendor</h2>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Vendor Name</label>
                    <Input
                      placeholder="Full Name / Company Name"
                      value={vendorForm.name}
                      onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                      size="sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Phone</label>
                      <Input
                        placeholder="Contact number"
                        value={vendorForm.phone}
                        onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                        size="sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Email</label>
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={vendorForm.email}
                        onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                        size="sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Address</label>
                    <Input
                      placeholder="Office address"
                      value={vendorForm.address}
                      onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                      size="sm"
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} size="sm">Cancel</Button>
                <Button color="primary" type="submit" isLoading={saving} size="sm" className="font-bold">Add Vendor</Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
      {/* Record Payment Modal */}
      <Modal 
        isOpen={isPaymentModalOpen} 
        onOpenChange={setIsPaymentModalOpen}
        size="md"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleRecordPayment}>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[17px] font-semibold text-primary tracking-tight">Record payment</h2>
                <p className="text-[11.5px] text-[rgb(var(--color-text-muted))] font-medium">Record a new payment for {selectedBill?.vendorName}</p>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div className="p-3 bg-[rgb(var(--color-surface-2))] rounded-xl border border-[rgb(var(--color-border))]">
                    <p className="text-[9px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1">Current outstanding</p>
                    <p className="text-[16px] font-semibold text-rose-500 tracking-tighter">Rs. {selectedBill?.dueAmount.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] mb-1.5 block">Payment amount (Rs.)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      size="sm"
                      classNames={{ inputWrapper: "rounded-xl" }}
                      startContent={<span className="text-[12px] text-text-muted">Rs.</span>}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] mb-1.5 block">Payment method</label>
                    <Select
                      placeholder="Select method"
                      defaultSelectedKeys={["Cash"]}
                      className="max-w-full"
                      size="sm"
                      classNames={{ trigger: "rounded-xl" }}
                    >
                      {["Cash", "Bank Transfer", "E-Sewa", "Khalti", "Cheque"].map((method) => (
                        <SelectItem key={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} size="sm" className="font-semibold text-[12.5px] rounded-xl">Cancel</Button>
                <Button 
                  color="primary" 
                  type="submit" 
                  isLoading={saving} 
                  size="sm" 
                  className="font-semibold text-[12.5px] rounded-xl px-6"
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
