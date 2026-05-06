import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoPeopleOutline,
  IoCallOutline,
  IoMailOutline,
  IoLocationOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoWarningOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { medicineService } from "@/services/medicineService";
import { Supplier } from "@/types/models";

interface SupplierFormData {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  licenseNumber: string;
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
        className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh]`}
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

interface SuppliersTabProps {
  /**
   * Effective branch scope for this view.
   * For branch users this matches their fixed branchId.
   * For clinic admins this is the branch selected on the parent page.
   */
  effectiveBranchId?: string | null;
}

export default function SuppliersTab({ effectiveBranchId }: SuppliersTabProps) {
  const { userData, clinicId, branchId } = useAuthContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    licenseNumber: "",
  });

  const branchScopeId =
    effectiveBranchId ?? userData?.branchId ?? branchId ?? null;

  useEffect(() => {
    if (clinicId) {
      loadSuppliers();
    }
  }, [clinicId, branchScopeId]);

  const loadSuppliers = async () => {
    if (!clinicId) return;

    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      licenseNumber: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      licenseNumber: supplier.licenseNumber || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      addToast({
        title: "Validation Error",
        description: "Please enter the supplier name",
      });

      return;
    }

    if (!clinicId || !userData?.id) return;

    setSaving(true);
    try {
      const supplierData: any = {
        name: formData.name.trim(),
        clinicId,
        branchId: branchScopeId || "",
        isActive: true,
        createdBy: userData.id,
      };

      if (formData.phone.trim()) supplierData.phone = formData.phone.trim();
      if (formData.contactPerson.trim())
        supplierData.contactPerson = formData.contactPerson.trim();
      if (formData.email.trim()) supplierData.email = formData.email.trim();
      if (formData.address.trim())
        supplierData.address = formData.address.trim();
      if (formData.licenseNumber.trim())
        supplierData.licenseNumber = formData.licenseNumber.trim();

      if (editingSupplier) {
        await medicineService.updateSupplier(editingSupplier.id, supplierData);
        addToast({
          title: "Success",
          description: "Supplier updated successfully",
        });
      } else {
        await medicineService.createSupplier(supplierData);
        addToast({
          title: "Success",
          description: "Supplier created successfully",
        });
      }

      setIsModalOpen(false);
      loadSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
      addToast({
        title: "Error",
        description: "Failed to save supplier",
      });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;

    setIsLoading(true);
    try {
      await medicineService.deleteSupplier(supplierToDelete.id);
      addToast({
        title: "Success",
        description: "Supplier deleted successfully",
      });
      setIsDeleteModalOpen(false);
      setSupplierToDelete(null);
      loadSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      addToast({
        title: "Error",
        description: "Failed to delete supplier",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    setIsLoading(true);
    try {
      await medicineService.updateSupplier(supplier.id, {
        isActive: !supplier.isActive,
      });
      addToast({
        title: "Success",
        description: `Supplier ${supplier.isActive ? "deactivated" : "activated"} successfully`,
      });
      loadSuppliers();
    } catch (error) {
      console.error("Error toggling supplier status:", error);
      addToast({
        title: "Error",
        description: "Failed to update supplier status",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contactPerson
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      supplier.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading && suppliers.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-2 text-[rgb(var(--color-text-muted))] text-[12.5px]">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading suppliers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:max-w-md">
          <div className="relative flex items-center">
            <IoSearchOutline className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-mountain-400 w-4 h-4" />
            <input
              className="clarity-input with-left-icon h-8 w-full pr-2 text-[13px]"
              placeholder="Search suppliers..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <button
          className="clarity-btn clarity-btn-primary inline-flex items-center gap-1.5"
          type="button"
          onClick={openAddModal}
        >
          <IoAddOutline className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Suppliers Table */}
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded">
        <div className="p-4 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))]/50 flex items-center justify-between">
          <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
            {filteredSuppliers.length} supplier
            {filteredSuppliers.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="flex flex-col items-center gap-2 text-[rgb(var(--color-text-muted))] text-[12.5px]">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading suppliers...</span>
              </div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <IoPeopleOutline className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">
                  No suppliers found
                </p>
                <p className="text-[13px] text-[rgb(var(--color-text-muted))] mt-1">
                  Add a supplier or adjust your search to see results.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))]">
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Supplier Name
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Contact Person
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Contact Info
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Address
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    License
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase w-44">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--color-border))]">
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="hover:bg-[rgb(var(--color-surface-2))]/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <IoPeopleOutline className="text-primary w-4 h-4" />
                        <span className="text-[13.5px] font-semibold text-[rgb(var(--color-text))]">
                          {supplier.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {supplier.contactPerson ? (
                        <span className="text-[13px] text-[rgb(var(--color-text))]">
                          {supplier.contactPerson}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-[rgb(var(--color-text-muted))]">
                          No contact person
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[12.5px] text-[rgb(var(--color-text-muted))]">
                          <IoCallOutline className="w-3 h-3" />
                          <span>{supplier.phone || "—"}</span>
                        </div>
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-[12.5px] text-[rgb(var(--color-text-muted))]">
                            <IoMailOutline className="w-3 h-3" />
                            <span>{supplier.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {supplier.address ? (
                        <div className="flex items-start gap-1 text-[12.5px] text-[rgb(var(--color-text-muted))]">
                          <IoLocationOutline className="mt-0.5 flex-shrink-0 w-3 h-3" />
                          <span className="line-clamp-2">
                            {supplier.address}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[12.5px] text-[rgb(var(--color-text-muted))]">
                          No address
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {supplier.licenseNumber ? (
                        <span className="text-[13px] text-[rgb(var(--color-text))]">
                          {supplier.licenseNumber}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-[rgb(var(--color-text-muted))]">
                          No license
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          supplier.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {supplier.isActive ? (
                          <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                        ) : (
                          <IoCloseCircleOutline className="w-3.5 h-3.5" />
                        )}
                        {supplier.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        <button
                          aria-label="Edit supplier"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                          title="Edit"
                          type="button"
                          onClick={() => openEditModal(supplier)}
                        >
                          <IoCreateOutline className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          aria-label={
                            supplier.isActive
                              ? "Deactivate supplier"
                              : "Activate supplier"
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-semibold border transition-colors ${
                            supplier.isActive
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          }`}
                          title={supplier.isActive ? "Deactivate" : "Activate"}
                          type="button"
                          onClick={() => handleToggleStatus(supplier)}
                        >
                          {supplier.isActive ? (
                            <>
                              <IoCloseCircleOutline className="w-3.5 h-3.5" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                              <span>Activate</span>
                            </>
                          )}
                        </button>
                        <button
                          aria-label="Delete supplier"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                          title="Delete"
                          type="button"
                          onClick={() => openDeleteModal(supplier)}
                        >
                          <IoTrashOutline className="w-3.5 h-3.5" />
                          <span>Delete</span>
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

      {/* Add/Edit Supplier Modal */}
      {isModalOpen && (
        <ModalShell
          disabled={saving}
          footer={
            <>
              <button
                className="clarity-btn clarity-btn-ghost"
                disabled={saving}
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary"
                disabled={saving}
                type="button"
                onClick={handleSave}
              >
                {saving ? "Saving..." : "Save Supplier"}
              </button>
            </>
          }
          size="lg"
          subtitle={
            <p className="text-[11.5px] text-mountain-400">
              Supplier contact and license information.
            </p>
          }
          title={editingSupplier ? "Edit Supplier" : "Add Supplier"}
          onClose={() => setIsModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Supplier Name <span className="text-danger">*</span>
                </label>
                <input
                  required
                  className="clarity-input h-8 w-full text-[13px] px-2"
                  name="name"
                  placeholder="Enter supplier name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Contact Person
                </label>
                <input
                  className="clarity-input h-8 w-full text-[13px] px-2"
                  name="contactPerson"
                  placeholder="Enter contact person name"
                  value={formData.contactPerson}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Phone Number
                </label>
                <input
                  className="clarity-input h-8 w-full text-[13px] px-2"
                  name="phone"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Email
                </label>
                <input
                  className="clarity-input h-8 w-full text-[13px] px-2"
                  name="email"
                  placeholder="Enter email address"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  License Number
                </label>
                <input
                  className="clarity-input h-8 w-full text-[13px] px-2"
                  name="licenseNumber"
                  placeholder="Enter supplier license number"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-default-700 mb-1.5 block">
                Address
              </label>
              <textarea
                className="clarity-input w-full text-[13px] px-2 py-2 min-h-[80px]"
                name="address"
                placeholder="Enter supplier address"
                rows={3}
                value={formData.address}
                onChange={handleChange}
              />
            </div>
          </div>
        </ModalShell>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <ModalShell
          disabled={isLoading}
          footer={
            <>
              <button
                className="clarity-btn clarity-btn-ghost"
                disabled={isLoading}
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSupplierToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary bg-rose-600 hover:bg-rose-700 border-rose-600"
                disabled={isLoading}
                type="button"
                onClick={handleDelete}
              >
                <span className="inline-flex items-center gap-1.5">
                  <IoTrashOutline className="w-4 h-4" />
                  {isLoading ? "Deleting..." : "Delete Supplier"}
                </span>
              </button>
            </>
          }
          size="md"
          subtitle={
            <p className="text-[11.5px] text-mountain-500">
              You are about to delete{" "}
              <span className="font-semibold text-mountain-800">
                "{supplierToDelete?.name}"
              </span>
              .
            </p>
          }
          title="Confirm Delete"
          onClose={() => setIsDeleteModalOpen(false)}
        >
          <div className="space-y-3">
            <div className="bg-rose-500/10 border border-rose-500/20 rounded p-3">
              <div className="flex items-start gap-2">
                <IoWarningOutline className="text-rose-400 mt-0.5 flex-shrink-0 w-4 h-4" />
                <div className="text-[12.5px] text-rose-400">
                  <p className="font-semibold mb-1">
                    This action cannot be undone.
                  </p>
                  <p className="text-[rgb(var(--color-text-muted))]">
                    The supplier will be permanently removed. Purchase orders or
                    medicine records associated with this supplier may lose
                    their supplier information.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
