import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoReceiptOutline,
  IoCalendarOutline,
  IoCashOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoWarningOutline,
  IoTimeOutline,
  IoCloseOutline,
  IoPrintOutline,
  IoDocumentTextOutline,
  IoCopyOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { medicineService } from "@/services/medicineService";
import { clinicService } from "@/services/clinicService";
import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";
import { Supplier, SupplierPurchaseRecord } from "@/types/models";

interface PurchaseRecordFormData {
  supplierId: string;
  purchaseDate: string;
  billNumber: string;
  totalAmount: string;
  paidAmount: string;
  paymentDone: boolean;
  notes: string;
}

interface PurchaseRecordsTabProps {
  onStatsChange?: () => void;
  /**
   * Effective branch scope for this view.
   * For branch users this matches their fixed branchId.
   * For clinic admins this is the branch selected on the parent page.
   */
  effectiveBranchId?: string | null;
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "lg",
  disabled,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  size?: "md" | "lg" | "xl";
  disabled?: boolean;
}) {
  const widthMap: Record<NonNullable<typeof size>, string> = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
  };

  React.useEffect(() => {
    const el = (document.getElementById("dashboard-scroll-container") ??
      document.body) as HTMLElement;
    const prev = el.style.overflow;

    el.style.overflow = "hidden";

    return () => {
      el.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 overflow-hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose();
      }}
    >
      <div
        className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded shadow-2xl w-full ${widthMap[size]} flex flex-col max-h-[90vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-[rgb(var(--color-border))/0.5] shrink-0 bg-[rgb(var(--color-surface-2))/0.3]">
          <div>
            <h3 className="text-[14px] font-semibold text-[rgb(var(--color-text))]">
              {title}
            </h3>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          {!disabled && (
            <button
              aria-label="Close modal"
              className="text-[rgb(var(--color-text-muted)/0.6)] hover:text-[rgb(var(--color-text))] mt-0.5 transition-colors"
              type="button"
              onClick={onClose}
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[rgb(var(--color-border))/0.5] shrink-0 bg-[rgb(var(--color-surface-2))/0.3]">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function PurchaseRecordsTab({
  onStatsChange,
  effectiveBranchId,
}: PurchaseRecordsTabProps) {
  const { userData, clinicId, branchId } = useAuthContext();
  const [purchaseRecords, setPurchaseRecords] = useState<
    SupplierPurchaseRecord[]
  >([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<SupplierPurchaseRecord | null>(null);
  const [recordToDelete, setRecordToDelete] =
    useState<SupplierPurchaseRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<PurchaseRecordFormData>({
    supplierId: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    billNumber: "",
    totalAmount: "",
    paidAmount: "",
    paymentDone: false,
    notes: "",
  });

  const branchScopeId =
    effectiveBranchId ?? userData?.branchId ?? branchId ?? null;

  useEffect(() => {
    if (clinicId) {
      loadPurchaseRecords();
      loadSuppliers();
    }
  }, [clinicId, branchScopeId]);

  // Auto-populate existing bill total when a match is detected during entry
  useEffect(() => {
    if (!editingRecord && formData.billNumber && formData.supplierId) {
      const match = purchaseRecords.find(
        (r) =>
          r.billNumber.trim().toLowerCase() ===
            formData.billNumber.trim().toLowerCase() &&
          r.supplierId === formData.supplierId,
      );

      if (match) {
        setFormData((prev) => ({
          ...prev,
          totalAmount: match.totalAmount.toString(),
        }));
      }
    }
  }, [formData.billNumber, formData.supplierId]);

  const loadPurchaseRecords = async () => {
    if (!clinicId) return;

    setIsLoading(true);
    try {
      const records = await medicineService.getSupplierPurchaseRecords(
        clinicId,
        branchScopeId || undefined,
      );

      setPurchaseRecords(records);
    } catch (error) {
      console.error("Error loading purchase records:", error);
      addToast({
        title: "Error",
        description: "Failed to load purchase records",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuppliers = async () => {
    if (!clinicId) return;

    try {
      const suppliersData = await medicineService.getSuppliersByClinic(
        clinicId,
        branchScopeId || undefined,
      );

      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Error loading suppliers:", error);
      addToast({
        title: "Error",
        description: "Failed to load suppliers",
      });
    }
  };

  const handleSubmit = async () => {
    if (!clinicId || !userData?.id) return;

    if (
      !formData.supplierId ||
      !formData.billNumber ||
      (parseFloat(formData.totalAmount) || 0) <= 0
    ) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields",
      });

      return;
    }

    setSaving(true);
    try {
      const supplier = suppliers.map((s) => s).find((s) => s.id === formData.supplierId);

      if (!supplier) {
        throw new Error("Selected supplier not found");
      }

      const totalAmount = parseFloat(formData.totalAmount) || 0;
      const paidAmount = parseFloat(formData.paidAmount) || 0;
      const dueAmount = totalAmount - paidAmount;
      const paymentStatus: "paid" | "pending" | "partial" | "overdue" =
        paidAmount >= totalAmount
          ? "paid"
          : paidAmount > 0
            ? "partial"
            : "pending";

      const purchaseRecordData: Omit<
        SupplierPurchaseRecord,
        "id" | "createdAt" | "updatedAt"
      > = {
        supplierId: formData.supplierId,
        supplierName: supplier.name,
        purchaseDate: new Date(formData.purchaseDate),
        billNumber: formData.billNumber,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        dueAmount: dueAmount,
        paymentStatus: paymentStatus,
        paymentDone: formData.paymentDone,
        notes: formData.notes,
        clinicId: clinicId,
        branchId: branchScopeId || "",
        createdBy: userData.id,
      };

      // Smart-Merge Logic: Check if a record with this bill number and supplier already exists
      const existingMatch = !editingRecord ? purchaseRecords.find(
        (r) =>
          r.billNumber.trim().toLowerCase() === formData.billNumber.trim().toLowerCase() &&
          r.supplierId === formData.supplierId
      ) : null;

      if (editingRecord || existingMatch) {
        const targetId = editingRecord?.id || existingMatch?.id;
        if (!targetId) throw new Error("Target record ID not found");

        await medicineService.updateSupplierPurchaseRecord(
          targetId,
          purchaseRecordData,
        );
        addToast({
          title: "Success",
          description: existingMatch 
            ? `Existing bill ${formData.billNumber} updated successfully`
            : "Purchase record updated successfully",
        });
      } else {
        await medicineService.createSupplierPurchaseRecord(purchaseRecordData);
        addToast({
          title: "Success",
          description: "Purchase record created successfully",
        });
      }

      await loadPurchaseRecords();
      handleCloseModal();
      onStatsChange?.();
    } catch (error) {
      console.error("Error saving purchase record:", error);
      addToast({
        title: "Error",
        description: editingRecord
          ? "Failed to update purchase record"
          : "Failed to create purchase record",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: SupplierPurchaseRecord) => {
    setEditingRecord(record);
    setFormData({
      supplierId: record.supplierId,
      purchaseDate: record.purchaseDate.toISOString().split("T")[0],
      billNumber: record.billNumber,
      totalAmount: record.totalAmount.toString(),
      paidAmount: record.paidAmount.toString(),
      paymentDone: record.paymentDone,
      notes: record.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;

    setSaving(true);
    try {
      await medicineService.deleteSupplierPurchaseRecord(recordToDelete.id);

      addToast({
        title: "Success",
        description: "Purchase record deleted successfully",
      });

      await loadPurchaseRecords();
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
      onStatsChange?.();
    } catch (error) {
      console.error("Error deleting purchase record:", error);
      addToast({
        title: "Error",
        description: "Failed to delete purchase record",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (record: SupplierPurchaseRecord) => {
    try {
      const clinic = clinicId ? await clinicService.getClinicById(clinicId) : null;
      const printConfig = clinicId ? await clinicService.getPrintLayoutConfig(clinicId) : null;
      
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      const brandingCSS = printConfig ? getPrintBrandingCSS(printConfig) : "";
      const headerHTML = printConfig ? getPrintHeaderHTML(printConfig, clinic) : "";
      const footerHTML = printConfig ? getPrintFooterHTML(printConfig) : "";

      const itemsHtml = record.items?.map((item, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 10px; font-size: 12px;">${idx + 1}</td>
          <td style="padding: 12px 10px; font-size: 12px;">
            <div style="font-weight: 500; color: #1e293b;">${item.name}</div>
          </td>
          <td style="padding: 12px 10px; font-size: 12px; text-align: center; color: #475569;">${item.qty}</td>
          <td style="padding: 12px 10px; font-size: 12px; text-align: right; color: #475569;">${item.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td style="padding: 12px 10px; font-size: 12px; text-align: center; color: #475569;">${item.vatPercentage}%</td>
          <td style="padding: 12px 10px; font-size: 12px; text-align: right; font-weight: 500; color: #1e293b;">${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join("") || `
        <tr>
          <td colspan="6" style="padding: 30px; text-align: center; color: #94a3b8; font-style: italic;">No item details available for this record.</td>
        </tr>
      `;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Purchase Invoice - ${record.billNumber}</title>
          <style>
            ${brandingCSS}
            
            /* High-Density Invoice Styles */
            .invoice-body { padding: 10px 40px; background: white; position: relative; }
            .invoice-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1.5px solid #f1f5f9; }
            .invoice-title-box h2 { margin: 0; color: #1e293b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .invoice-title-box p { margin: 2px 0 0 0; color: #64748b; font-size: 12px; font-weight: 500; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 25px; }
            .info-box h3 { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.08em; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
            .info-box p { margin: 4px 0; font-size: 12.5px; color: #1e293b; line-height: 1.3; }
            .info-box strong { font-weight: 500; color: #0f172a; }
            
            .table-container { width: 100%; margin-bottom: 25px; border: 1px solid #f1f5f9; border-radius: 6px; overflow: hidden; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f8fafc; padding: 10px 10px; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; text-align: left; border-bottom: 1.5px solid #f1f5f9; }
            
            .summary-container { display: flex; justify-content: flex-end; margin-bottom: 40px; }
            .summary-box { width: 300px; background: #f8fafc; padding: 15px 20px; border-radius: 8px; border: 1px solid #f1f5f9; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12.5px; color: #475569; }
            .summary-row.grand-total { border-top: 1.5px solid #e2e8f0; margin-top: 10px; padding-top: 12px; font-weight: 600; font-size: 17px; color: ${printConfig?.primaryColor || '#0d9488'}; }
            
            @media print {
              @page { margin: 0; size: auto; }
              .invoice-body { padding: 10px 40px; }
              body { margin: 0; padding: 0; overflow: hidden; }
              html, body { height: 100%; }
            }
          </style>
        </head>
        <body>
          ${headerHTML}
          
          <div class="invoice-body">
            <div class="invoice-top-bar">
              <div class="invoice-title-box">
                <h2>Purchase Invoice</h2>
                <p>Bill No: <span style="font-family: monospace; font-size: 13px; font-weight: 500;">${record.billNumber}</span></p>
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Purchase Date</p>
                <p style="margin: 2px 0 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${record.purchaseDate.toLocaleDateString()}</p>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-box">
                <h3>Supplier Source</h3>
                <p><span style="font-weight: 500;">${record.supplierName}</span></p>
                <p style="color: #64748b; font-size: 11px;">Verified stock entry record.</p>
              </div>
              <div class="info-box">
                <h3>Payment Lifecycle</h3>
                <p>Status: <span style="display: inline-block; padding: 1px 8px; border-radius: 3px; background: ${record.paymentStatus === 'paid' ? '#ecfdf5' : '#fef2f2'}; text-transform: uppercase; font-weight: 600; font-size: 10px; color: ${record.paymentStatus === 'paid' ? '#059669' : '#e11d48'}; border: 1px solid ${record.paymentStatus === 'paid' ? '#d1fae5' : '#fee2e2'};">${record.paymentStatus}</span></p>
                <p>Clearing: <span style="font-weight: 500;">${record.paymentDone ? 'Fully Cleared' : 'Balance Pending'}</span></p>
              </div>
            </div>

            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="width: 40px; text-align: center;">#</th>
                    <th>Medicine Description</th>
                    <th style="text-align: center; width: 80px;">Qty</th>
                    <th style="text-align: right; width: 120px;">Unit Cost</th>
                    <th style="text-align: center; width: 80px;">VAT</th>
                    <th style="text-align: right; width: 130px;">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml.replace(/padding: 12px 10px/g, 'padding: 8px 10px')}
                </tbody>
              </table>
            </div>

            <div class="summary-container">
              <div class="summary-box">
                <div class="summary-row">
                  <span>Subtotal</span>
                  <span style="font-weight: 500;">NPR ${record.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="summary-row">
                  <span>Paid Amount</span>
                  <span style="color: #059669; font-weight: 500;">NPR ${record.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="summary-row">
                  <span>Due Amount</span>
                  <span style="color: ${record.dueAmount > 0 ? '#e11d48' : '#475569'}; font-weight: 500;">NPR ${record.dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="summary-row grand-total">
                  <span>Invoice Total</span>
                  <span>NPR ${record.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          ${footerHTML}

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error("Error printing invoice:", error);
      addToast({
        title: "Print Error",
        description: "Failed to generate professional print view.",
        color: "danger"
      });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setFormData({
      supplierId: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      billNumber: "",
      totalAmount: "",
      paidAmount: "",
      paymentDone: false,
      notes: "",
    });
  };

  const openDeleteModal = (record: SupplierPurchaseRecord) => {
    setRecordToDelete(record);
    setIsDeleteModalOpen(true);
  };

  const filteredRecords = purchaseRecords.filter(
    (record) =>
      record.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.billNumber.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getPaymentStatusBadgeClass = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-health-500/10 text-health-500 border-health-500/20";
      case "partial":
        return "bg-saffron-500/10 text-saffron-500 border-saffron-500/20";
      case "overdue":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      default:
        return "bg-[rgb(var(--color-surface-3))] text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))]";
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <IoCheckmarkCircleOutline className="w-3 h-3" />;
      case "partial":
        return <IoWarningOutline className="w-3 h-3" />;
      case "overdue":
        return <IoCloseCircleOutline className="w-3 h-3" />;
      default:
        return <IoTimeOutline className="w-3 h-3" />;
    }
  };

  const currentTotalAmount = parseFloat(formData.totalAmount) || 0;
  const currentPaidAmount = parseFloat(formData.paidAmount) || 0;
  const dueAmountDisplay = currentTotalAmount - currentPaidAmount;

  if (isLoading && purchaseRecords.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-2 text-mountain-500 text-[12.5px]">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading purchase records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={title({ size: "md", color: "primary" })}>
            Purchase Records
          </h2>
          <p className="text-[12.5px] text-text-muted mt-1">
            Track purchases from suppliers with payment information
          </p>
        </div>
        <button
          className="clarity-btn clarity-btn-primary inline-flex items-center gap-1.5"
          type="button"
          onClick={() => {
            handleCloseModal();
            setFormData({
              supplierId: "",
              purchaseDate: new Date().toISOString().split("T")[0],
              billNumber: "",
              totalAmount: "",
              paidAmount: "",
              paymentDone: false,
              notes: "",
            });
            setEditingRecord(null);
            setIsModalOpen(true);
          }}
        >
          <IoAddOutline className="w-4 h-4" />
          <span>Add Purchase Record</span>
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded p-3 shadow-sm">
        <div className="relative flex items-center max-w-md">
          <IoSearchOutline className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-mountain-400 w-4 h-4" />
          <input
            className="clarity-input with-left-icon h-8 w-full pr-2 text-[13px]"
            placeholder="Search by supplier name or bill number..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Purchase Records Table */}
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded shadow-sm">
        <div className="p-4 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3] flex items-center justify-between">
          <span className="text-[13px] text-mountain-500">
            {filteredRecords.length} record
            {filteredRecords.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="flex flex-col items-center gap-2 text-mountain-500 text-[12.5px]">
                <div className="h-5 w-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading purchase records...</span>
              </div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <IoReceiptOutline className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">
                  No purchase records found
                </p>
                <p className="text-[13px] text-text-muted mt-1">
                  {searchQuery
                    ? "No records match your search criteria."
                    : "Start by adding your first purchase record."}
                </p>
              </div>
            </div>
          ) : (
            <table className="clarity-table w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[rgb(var(--color-surface-2))/0.5] border-b border-[rgb(var(--color-border))]">
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Supplier
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Purchase Date
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Bill Number
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Total Amount
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Paid Amount
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Due Amount
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Payment Status
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--color-border))]">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-[rgb(var(--color-primary)/0.05)] transition-colors border-b border-[rgb(var(--color-border))/0.5]"
                  >
                    <td className="px-5 py-3">
                      <span className="text-[13.5px] font-semibold text-[rgb(var(--color-text))]">
                        {record.supplierName}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <IoCalendarOutline className="text-[rgb(var(--color-text-muted)/0.7)] w-4 h-4" />
                        <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                          {record.purchaseDate.toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 group/copy">
                        <span className="font-mono text-[12.5px] text-[rgb(var(--color-text-muted))]">
                          {record.billNumber}
                        </span>
                        <button
                          className="opacity-0 group-hover/copy:opacity-100 p-1 rounded hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] transition-all"
                          title="Copy Bill Number"
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(record.billNumber);
                            addToast({
                              title: "Copied",
                              description: "Bill number copied to clipboard",
                              color: "success"
                            });
                          }}
                        >
                          <IoCopyOutline className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] font-medium text-[rgb(var(--color-text))]">
                        Rs.{record.totalAmount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] font-medium text-teal-700">
                        Rs.{record.paidAmount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-[13px] font-medium ${
                          record.dueAmount > 0
                            ? "text-red-600"
                            : "text-teal-700"
                        }`}
                      >
                        Rs.{record.dueAmount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`clarity-badge inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11.5px] font-medium border ${getPaymentStatusBadgeClass(record.paymentStatus)}`}
                      >
                        {getPaymentStatusIcon(record.paymentStatus)}
                        {record.paymentStatus.charAt(0).toUpperCase() +
                          record.paymentStatus.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          aria-label="Print invoice"
                          className="inline-flex items-center justify-center w-7 h-7 rounded border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors"
                          title="Print Invoice"
                          type="button"
                          onClick={() => handlePrint(record)}
                        >
                          <IoPrintOutline className="w-4 h-4" />
                        </button>
                        <button
                          aria-label="Edit purchase record"
                          className="inline-flex items-center justify-center w-7 h-7 rounded border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50 transition-colors"
                          title="Edit record"
                          type="button"
                          onClick={() => handleEdit(record)}
                        >
                          <IoCreateOutline className="w-4 h-4" />
                        </button>
                        <button
                          aria-label="Delete purchase record"
                          className="inline-flex items-center justify-center w-7 h-7 rounded border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                          title="Delete record"
                          type="button"
                          onClick={() => openDeleteModal(record)}
                        >
                          <IoTrashOutline className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Purchase Record Modal */}
      {isModalOpen && (
        <ModalShell
          disabled={saving}
          footer={
            <>
              <button
                className="clarity-btn clarity-btn-ghost"
                disabled={saving}
                type="button"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary"
                disabled={saving}
                type="button"
                onClick={handleSubmit}
              >
                {saving ? "Saving..." : editingRecord ? "Update" : "Add"}{" "}
                Purchase Record
              </button>
            </>
          }
          size="lg"
          subtitle={
            <p className="text-[11.5px] text-mountain-400">
              Supplier, bill details and payment information.
            </p>
          }
          title={editingRecord ? "Edit Purchase Record" : "Add Purchase Record"}
          onClose={handleCloseModal}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-default-700 mb-1.5 block">
                Bill Number <span className="text-red-600">*</span>
              </label>
              <input
                className="clarity-input h-8 w-full text-[13px] px-2"
                disabled={saving}
                placeholder="Enter bill number"
                type="text"
                value={formData.billNumber}
                onChange={(e) => {
                  const newBillNo = e.target.value;
                  setFormData((prev) => {
                    const updated = { ...prev, billNumber: newBillNo };
                    
                    // Global lookup by Bill Number to auto-populate Supplier and financial data
                    if (!editingRecord && newBillNo.trim()) {
                      const match = purchaseRecords.find(
                        r => r.billNumber.trim().toLowerCase() === newBillNo.trim().toLowerCase()
                      );
                      if (match) {
                        updated.supplierId = match.supplierId;
                        updated.totalAmount = match.totalAmount.toString();
                        updated.paidAmount = match.paidAmount.toString();
                        updated.notes = match.notes || "";
                        updated.paymentDone = match.paymentDone;
                      }
                    }
                    return updated;
                  });
                }}
              />
              {!editingRecord && formData.billNumber && purchaseRecords.some(r => r.billNumber.trim().toLowerCase() === formData.billNumber.trim().toLowerCase()) && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-teal-600 font-medium bg-teal-50 px-2 py-1 rounded border border-teal-100">
                  <IoCheckmarkCircleOutline className="w-3 h-3" />
                  <span>Existing bill found. Supplier and data auto-loaded.</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Supplier <span className="text-red-600">*</span>
                </label>
                <select
                  disabled={saving}
                  required
                  className="clarity-input h-8 w-full text-[13px] px-2"
                  value={formData.supplierId}
                  onChange={(e) => {
                    const newSupplierId = e.target.value;
                    setFormData((prev) => {
                      const updated = { ...prev, supplierId: newSupplierId };
                      
                      // Check for existing match to auto-populate if bill already entered
                      if (!editingRecord && prev.billNumber.trim() && newSupplierId) {
                        const match = purchaseRecords.find(
                          r => r.billNumber.trim().toLowerCase() === prev.billNumber.trim().toLowerCase() && 
                          r.supplierId === newSupplierId
                        );
                        if (match) {
                          updated.totalAmount = match.totalAmount.toString();
                          updated.paidAmount = match.paidAmount.toString();
                          updated.notes = match.notes || "";
                          updated.paymentDone = match.paymentDone;
                        }
                      }
                      return updated;
                    });
                  }}
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Purchase Date <span className="text-red-600">*</span>
                </label>
                <input
                  className="clarity-input h-8 w-full text-[13px] px-2"
                  disabled={saving}
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      purchaseDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Total Amount <span className="text-red-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-2 text-[13px] text-mountain-500 pointer-events-none">
                    Rs.
                  </span>
                  <input
                    className="clarity-input with-prefix h-8 w-full text-[13px] pr-2"
                    disabled={saving}
                    min={0}
                    placeholder="Enter total amount"
                    step={0.01}
                    type="number"
                    value={formData.totalAmount}
                    onChange={(e) => {
                      const totalAmount = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        totalAmount,
                        paymentDone: (parseFloat(prev.paidAmount) || 0) >= (parseFloat(totalAmount) || 0) && (parseFloat(totalAmount) || 0) > 0,
                      }));
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Paid Amount
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-2 text-[13px] text-mountain-500 pointer-events-none">
                    Rs.
                  </span>
                  <input
                    className="clarity-input with-prefix h-8 w-full text-[13px] pr-2"
                    disabled={saving}
                    min={0}
                    placeholder="Enter paid amount"
                    step={0.01}
                    type="number"
                    value={formData.paidAmount}
                    onChange={(e) => {
                      const paidAmount = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        paidAmount,
                        paymentDone: (parseFloat(paidAmount) || 0) >= (parseFloat(prev.totalAmount) || 0) && (parseFloat(prev.totalAmount) || 0) > 0,
                      }));
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-default-700">
                    Due Amount
                  </label>
                  {dueAmountDisplay > 0 && (
                    <button
                      className="text-[10px] font-bold text-teal-600 hover:text-teal-700 uppercase tracking-wider bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 transition-all hover:bg-teal-100"
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          paidAmount: prev.totalAmount,
                          paymentDone: true
                        }));
                      }}
                    >
                      CLEAR BALANCE
                    </button>
                  )}
                </div>
                <div
                  className={`h-8 w-full text-[13px] px-2 flex items-center rounded border border-mountain-200 bg-mountain-50/50 ${
                    dueAmountDisplay > 0
                      ? "text-red-600 font-medium"
                      : "text-teal-700 font-medium"
                  }`}
                >
                  Rs.{dueAmountDisplay.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-7">
                <span className="text-[12.5px] text-[rgb(var(--color-text-muted))]">
                  Payment Done:
                </span>
                <span
                  className={`clarity-badge inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium border ${
                    formData.paymentDone
                      ? "bg-teal-50 text-teal-700 border-teal-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {formData.paymentDone ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-default-700 mb-1.5 block">
                Notes
              </label>
              <input
                className="clarity-input h-8 w-full text-[13px] px-2"
                disabled={saving}
                placeholder="Additional notes (optional)"
                type="text"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>
        </ModalShell>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <ModalShell
          disabled={saving}
          footer={
            <>
              <button
                className="clarity-btn clarity-btn-ghost"
                disabled={saving}
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setRecordToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary bg-rose-600 hover:bg-rose-700 border-rose-600"
                disabled={saving}
                type="button"
                onClick={handleDelete}
              >
                <span className="inline-flex items-center gap-1.5">
                  <IoTrashOutline className="w-4 h-4" />
                  {saving ? "Deleting..." : "Delete"}
                </span>
              </button>
            </>
          }
          size="md"
          subtitle={
            recordToDelete && (
              <p className="text-[11.5px] text-[rgb(var(--color-text-muted))]">
                Bill:{" "}
                <span className="font-semibold text-[rgb(var(--color-text))]">
                  {recordToDelete.billNumber}
                </span>
                {" · "}Rs.{recordToDelete.totalAmount.toLocaleString()}
              </p>
            )
          }
          title="Delete Purchase Record"
          onClose={() => {
            if (!saving) {
              setIsDeleteModalOpen(false);
              setRecordToDelete(null);
            }
          }}
        >
          <div className="space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <IoWarningOutline className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
              Are you sure you want to delete this purchase record?
            </p>
            {recordToDelete && (
              <div className="mt-3 p-3 bg-[rgb(var(--color-surface-2))/0.3] border border-[rgb(var(--color-border))] rounded text-left">
                <p className="text-[13px] font-semibold text-[rgb(var(--color-text))]">
                  {recordToDelete.supplierName}
                </p>
                <p className="text-[12px] text-[rgb(var(--color-text-muted))]">
                  Bill: {recordToDelete.billNumber}
                </p>
                <p className="text-[12px] text-[rgb(var(--color-text-muted))]">
                  Amount: Rs.{recordToDelete.totalAmount.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
