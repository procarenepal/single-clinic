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
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { medicineService } from "@/services/medicineService";
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
        className={`bg-white border border-mountain-200 rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-mountain-100 shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-[rgb(var(--color-text))]">
              {title}
            </h3>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          {!disabled && (
            <button
              aria-label="Close modal"
              className="text-mountain-400 hover:text-mountain-700 mt-0.5"
              type="button"
              onClick={onClose}
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-mountain-100 shrink-0">
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
      const supplier = suppliers.find((s) => s.id === formData.supplierId);

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

      if (editingRecord) {
        await medicineService.updateSupplierPurchaseRecord(
          editingRecord.id,
          purchaseRecordData,
        );
        addToast({
          title: "Success",
          description: "Purchase record updated successfully",
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
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "partial":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "overdue":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-mountain-50 text-mountain-600 border-mountain-200";
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
      <div className="bg-white border border-mountain-200 rounded p-3">
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
      <div className="bg-white border border-mountain-200 rounded">
        <div className="p-4 border-b border-mountain-100 bg-mountain-50/50 flex items-center justify-between">
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
                <tr className="bg-mountain-50/50 border-b border-mountain-200">
                  <th className="px-5 py-3 text-[11px] font-semibold text-mountain-600 tracking-[0.06em] uppercase">
                    Supplier
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-mountain-600 tracking-[0.06em] uppercase">
                    Purchase Date
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-mountain-600 tracking-[0.06em] uppercase">
                    Bill Number
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-mountain-600 tracking-[0.06em] uppercase">
                    Total Amount
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-mountain-600 tracking-[0.06em] uppercase">
                    Paid Amount
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-mountain-600 tracking-[0.06em] uppercase">
                    Due Amount
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-mountain-600 tracking-[0.06em] uppercase">
                    Payment Status
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-mountain-600 tracking-[0.06em] uppercase w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mountain-100">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-mountain-50/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span className="text-[13.5px] font-semibold text-mountain-900">
                        {record.supplierName}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <IoCalendarOutline className="text-mountain-400 w-4 h-4" />
                        <span className="text-[13px] text-mountain-700">
                          {record.purchaseDate.toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-[12.5px] text-mountain-700">
                        {record.billNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <IoCashOutline className="text-mountain-400 w-4 h-4" />
                        <span className="text-[13px] font-medium text-mountain-900">
                          ₹{record.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] font-medium text-teal-700">
                        ₹{record.paidAmount.toLocaleString()}
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
                        ₹{record.dueAmount.toLocaleString()}
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
                          aria-label="Edit purchase record"
                          className="inline-flex items-center justify-center w-7 h-7 rounded border border-mountain-200 text-mountain-500 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50 transition-colors"
                          title="Edit record"
                          type="button"
                          onClick={() => handleEdit(record)}
                        >
                          <IoCreateOutline className="w-4 h-4" />
                        </button>
                        <button
                          aria-label="Delete purchase record"
                          className="inline-flex items-center justify-center w-7 h-7 rounded border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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
                Supplier <span className="text-red-600">*</span>
              </label>
              <select
                disabled={saving}
                required
                className="clarity-input h-8 w-full text-[13px] px-2"
                value={formData.supplierId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    supplierId: e.target.value,
                  }))
                }
              >
                <option value="">Select a supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      billNumber: e.target.value,
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
                    ₹
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
                    ₹
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
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Due Amount
                </label>
                <div
                  className={`h-8 w-full text-[13px] px-2 flex items-center rounded border border-mountain-200 bg-mountain-50/50 ${
                    dueAmountDisplay > 0
                      ? "text-red-600 font-medium"
                      : "text-teal-700 font-medium"
                  }`}
                >
                  ₹{dueAmountDisplay.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <span className="text-[12.5px] text-mountain-600">
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
              <p className="text-[11.5px] text-mountain-500">
                Bill:{" "}
                <span className="font-semibold text-mountain-800">
                  {recordToDelete.billNumber}
                </span>
                {" · "}₹{recordToDelete.totalAmount.toLocaleString()}
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
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
              <IoWarningOutline className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-[13px] text-mountain-700">
              Are you sure you want to delete this purchase record?
            </p>
            {recordToDelete && (
              <div className="mt-3 p-3 bg-mountain-50 border border-mountain-200 rounded text-left">
                <p className="text-[13px] font-semibold text-mountain-900">
                  {recordToDelete.supplierName}
                </p>
                <p className="text-[12px] text-mountain-600">
                  Bill: {recordToDelete.billNumber}
                </p>
                <p className="text-[12px] text-mountain-600">
                  Amount: ₹{recordToDelete.totalAmount.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
