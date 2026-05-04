import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoBusinessOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoWarningOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { medicineService } from "@/services/medicineService";
import { MedicineBrand } from "@/types/models";

interface BrandsTabProps {
  onStatsChange: () => void;
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
        className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-[rgb(var(--color-border))] shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-[rgb(var(--color-text))]">
              {title}
            </h3>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          {!disabled && (
            <button
              aria-label="Close modal"
              className="text-[rgb(var(--color-text-muted)/0.5)] hover:text-[rgb(var(--color-text-muted))] mt-0.5"
              type="button"
              onClick={onClose}
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[rgb(var(--color-border))] shrink-0">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function BrandsTab({
  onStatsChange,
  effectiveBranchId,
}: BrandsTabProps) {
  const { userData, clinicId } = useAuthContext();
  const [brands, setBrands] = useState<MedicineBrand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentBrand, setCurrentBrand] = useState<MedicineBrand | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<MedicineBrand | null>(
    null,
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    manufacturer: "",
  });

  const branchScopeId = effectiveBranchId ?? userData?.branchId ?? null;

  useEffect(() => {
    if (clinicId) {
      fetchBrands();
    }
  }, [clinicId, branchScopeId]);

  const fetchBrands = async () => {
    if (!clinicId) return;

    setIsLoading(true);
    try {
      const data = await medicineService.getMedicineBrandsByClinic(
        clinicId,
        branchScopeId || undefined,
      );

      setBrands(data);
    } catch (error) {
      console.error("Error fetching brands:", error);
      addToast({
        title: "Error",
        description: "Failed to load brands",
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
    setCurrentBrand(null);
    setFormData({
      name: "",
      description: "",
      manufacturer: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (brand: MedicineBrand) => {
    setCurrentBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description || "",
      manufacturer: brand.manufacturer || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      addToast({
        title: "Validation Error",
        description: "Brand name is required",
      });

      return;
    }

    // Check if brand name already exists (for new brands)
    if (
      !currentBrand &&
      brands.some(
        (brand) =>
          brand.name.toLowerCase() === formData.name.trim().toLowerCase(),
      )
    ) {
      addToast({
        title: "Validation Error",
        description: "A brand with this name already exists",
      });

      return;
    }

    if (!clinicId || !userData?.id) {
      addToast({
        title: "Error",
        description: "Missing required information. Please try again.",
      });

      return;
    }

    setIsLoading(true);
    try {
      const brandData: any = {
        name: formData.name.trim(),
        isActive: true,
        clinicId,
        branchId: branchScopeId || "",
        createdBy: userData.id,
      };

      // Only include optional fields if they have values
      if (formData.description.trim()) {
        brandData.description = formData.description.trim();
      }
      if (formData.manufacturer.trim()) {
        brandData.manufacturer = formData.manufacturer.trim();
      }

      if (currentBrand) {
        await medicineService.updateMedicineBrand(currentBrand.id, brandData);
        addToast({
          title: "Success",
          description: "Brand updated successfully",
        });
      } else {
        await medicineService.createMedicineBrand(brandData);
        addToast({
          title: "Success",
          description: "Brand created successfully",
        });
      }

      setIsModalOpen(false);
      fetchBrands();
      onStatsChange();
    } catch (error) {
      console.error("Error saving brand:", error);
      addToast({
        title: "Error",
        description: "Failed to save brand",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (brand: MedicineBrand) => {
    setIsLoading(true);
    try {
      await medicineService.updateMedicineBrand(brand.id, {
        isActive: !brand.isActive,
      });
      addToast({
        title: "Success",
        description: `Brand ${brand.isActive ? "deactivated" : "activated"} successfully`,
      });
      fetchBrands();
      onStatsChange();
    } catch (error) {
      console.error("Error toggling brand status:", error);
      addToast({
        title: "Error",
        description: "Failed to update brand status",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openDeleteModal = (brand: MedicineBrand) => {
    setBrandToDelete(brand);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!brandToDelete) return;

    setIsLoading(true);
    try {
      await medicineService.deleteMedicineBrand(brandToDelete.id);
      addToast({
        title: "Success",
        description: "Brand deleted successfully",
      });
      setIsDeleteModalOpen(false);
      setBrandToDelete(null);
      fetchBrands();
      onStatsChange();
    } catch (error) {
      console.error("Error deleting brand:", error);
      addToast({
        title: "Error",
        description: "Failed to delete brand",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBrands = brands.filter(
    (brand) =>
      brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading && brands.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-2 text-[rgb(var(--color-text-muted)/0.7)] text-[12.5px]">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading brands...</span>
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
            <IoSearchOutline className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted)/0.5)] w-4 h-4" />
            <input
              className="clarity-input with-left-icon h-8 w-full pr-2 text-[13px]"
              placeholder="Search brands..."
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
          <span>Add Brand</span>
        </button>
      </div>

      {/* Brands table */}
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded">
        <div className="p-4 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] flex items-center justify-between">
          <span className="text-[13px] text-[rgb(var(--color-text-muted)/0.7)]">
            {filteredBrands.length} brand
            {filteredBrands.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="flex flex-col items-center gap-2 text-[rgb(var(--color-text-muted)/0.7)] text-[12.5px]">
                <div className="h-5 w-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading brands...</span>
              </div>
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <IoBusinessOutline className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">
                  No brands found
                </p>
                <p className="text-[13px] text-text-muted mt-1">
                  Add a brand or adjust your search to see results.
                </p>
              </div>
            </div>
          ) : (
            <table className="clarity-table w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))]">
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Brand Name
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Manufacturer
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Description
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Created
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase w-36">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--color-border))]">
                {filteredBrands.map((brand) => (
                  <tr
                    key={brand.id}
                    className="hover:bg-[rgb(var(--color-surface-2))/0.5] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <IoBusinessOutline className="text-primary w-4 h-4" />
                        <span className="text-[13.5px] font-semibold text-[rgb(var(--color-text))]">
                          {brand.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {brand.manufacturer ? (
                        <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                          {brand.manufacturer}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-[rgb(var(--color-text-muted)/0.5)]">
                          No manufacturer
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {brand.description ? (
                        <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                          {brand.description}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-[rgb(var(--color-text-muted)/0.5)]">
                          No description
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          brand.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {brand.isActive ? (
                          <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                        ) : (
                          <IoCloseCircleOutline className="w-3.5 h-3.5" />
                        )}
                        {brand.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                        {brand.createdAt
                          ? brand.createdAt.toLocaleDateString()
                          : "N/A"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          aria-label="Edit brand"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                          title="Edit"
                          type="button"
                          onClick={() => openEditModal(brand)}
                        >
                          <IoCreateOutline className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          aria-label="Activate brand"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-colors ${
                            brand.isActive
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                          }`}
                          title={brand.isActive ? "Deactivate" : "Activate"}
                          type="button"
                          onClick={() => handleToggleStatus(brand)}
                        >
                          {brand.isActive ? (
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
                          aria-label="Delete brand"
                          className="inline-flex items-center justify-center w-7 h-7 rounded border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete"
                          type="button"
                          onClick={() => openDeleteModal(brand)}
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <ModalShell
          disabled={isLoading}
          footer={
            <>
              <button
                className="clarity-btn clarity-btn-ghost"
                disabled={isLoading}
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary"
                disabled={isLoading}
                type="button"
                onClick={handleSave}
              >
                {isLoading ? "Saving..." : "Save Brand"}
              </button>
            </>
          }
          size="lg"
          subtitle={
            <p className="text-[11.5px] text-[rgb(var(--color-text-muted)/0.5)]">
              Brand metadata for medicine grouping and reporting.
            </p>
          }
          title={currentBrand ? "Edit Brand" : "Add Brand"}
          onClose={() => setIsModalOpen(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                Brand Name <span className="text-danger">*</span>
              </label>
              <input
                required
                className="clarity-input h-8 w-full text-[13px] px-2"
                name="name"
                placeholder="Enter brand name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                Manufacturer
              </label>
              <input
                className="clarity-input h-8 w-full text-[13px] px-2"
                name="manufacturer"
                placeholder="Enter manufacturer name"
                value={formData.manufacturer}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                Description
              </label>
              <textarea
                className="clarity-input w-full text-[13px] px-2 py-2 min-h-[80px]"
                name="description"
                placeholder="Enter brand description"
                rows={3}
                value={formData.description}
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
                  setBrandToDelete(null);
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
                  {isLoading ? "Deleting..." : "Delete Brand"}
                </span>
              </button>
            </>
          }
          size="md"
          subtitle={
            <p className="text-[11.5px] text-[rgb(var(--color-text-muted)/0.7)]">
              You are about to delete{" "}
              <span className="font-semibold text-[rgb(var(--color-text))]">
                “{brandToDelete?.name}”
              </span>
              .
            </p>
          }
          title="Confirm Delete"
          onClose={() => setIsDeleteModalOpen(false)}
        >
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="flex items-start gap-2">
                <IoWarningOutline className="text-red-600 mt-0.5 flex-shrink-0 w-4 h-4" />
                <div className="text-[12.5px] text-red-700">
                  <p className="font-semibold mb-1">
                    This action cannot be undone.
                  </p>
                  <p>
                    The brand will be permanently removed. Medicines associated
                    with this brand may lose their brand information.
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
