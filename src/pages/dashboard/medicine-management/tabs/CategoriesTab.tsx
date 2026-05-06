import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoFlaskOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoWarningOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { medicineService } from "@/services/medicineService";
import { MedicineCategory } from "@/types/models";

interface CategoriesTabProps {
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

export default function CategoriesTab({
  onStatsChange,
  effectiveBranchId,
}: CategoriesTabProps) {
  const { userData, clinicId } = useAuthContext();
  const [categories, setCategories] = useState<MedicineCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentCategory, setCurrentCategory] =
    useState<MedicineCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] =
    useState<MedicineCategory | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const branchScopeId = effectiveBranchId ?? userData?.branchId ?? null;

  useEffect(() => {
    if (clinicId) {
      fetchCategories();
    }
  }, [clinicId, branchScopeId]);

  const fetchCategories = async () => {
    if (!clinicId) return;

    setIsLoading(true);
    try {
      const data = await medicineService.getMedicineCategoriesByClinic(
        clinicId,
        branchScopeId || undefined,
      );

      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
      addToast({
        title: "Error",
        description: "Failed to load categories",
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
    setCurrentCategory(null);
    setFormData({
      name: "",
      description: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (category: MedicineCategory) => {
    setCurrentCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      addToast({
        title: "Validation Error",
        description: "Category name is required",
      });

      return;
    }

    if (
      !currentCategory &&
      categories.some(
        (category) =>
          category.name.toLowerCase() === formData.name.trim().toLowerCase(),
      )
    ) {
      addToast({
        title: "Validation Error",
        description: "A category with this name already exists",
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
      const categoryData: any = {
        name: formData.name.trim(),
        isActive: true,
        clinicId,
        branchId: branchScopeId || "",
        createdBy: userData.id,
      };

      if (formData.description.trim()) {
        categoryData.description = formData.description.trim();
      }

      if (currentCategory) {
        await medicineService.updateMedicineCategory(
          currentCategory.id,
          categoryData,
        );
        addToast({
          title: "Success",
          description: "Category updated successfully",
        });
      } else {
        await medicineService.createMedicineCategory(categoryData);
        addToast({
          title: "Success",
          description: "Category created successfully",
        });
      }

      setIsModalOpen(false);
      fetchCategories();
      onStatsChange();
    } catch (error) {
      console.error("Error saving category:", error);
      addToast({
        title: "Error",
        description: "Failed to save category",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (category: MedicineCategory) => {
    setIsLoading(true);
    try {
      await medicineService.updateMedicineCategory(category.id, {
        isActive: !category.isActive,
      });
      addToast({
        title: "Success",
        description: `Category ${category.isActive ? "deactivated" : "activated"} successfully`,
      });
      fetchCategories();
      onStatsChange();
    } catch (error) {
      console.error("Error toggling category status:", error);
      addToast({
        title: "Error",
        description: "Failed to update category status",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openDeleteModal = (category: MedicineCategory) => {
    setCategoryToDelete(category);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    setIsLoading(true);
    try {
      await medicineService.deleteMedicineCategory(categoryToDelete.id);
      addToast({
        title: "Success",
        description: "Category deleted successfully",
      });
      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
      fetchCategories();
      onStatsChange();
    } catch (error) {
      console.error("Error deleting category:", error);
      addToast({
        title: "Error",
        description: "Failed to delete category",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading && categories.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-2 text-[rgb(var(--color-text-muted)/0.7)] text-[12.5px]">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading categories...</span>
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
              placeholder="Search categories..."
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
          <span>Add Category</span>
        </button>
      </div>

      {/* Categories table */}
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded">
        <div className="p-4 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] flex items-center justify-between">
          <span className="text-[13px] text-[rgb(var(--color-text-muted)/0.7)]">
            {filteredCategories.length} categor
            {filteredCategories.length !== 1 ? "ies" : "y"}
          </span>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="flex flex-col items-center gap-2 text-[rgb(var(--color-text-muted)/0.7)] text-[12.5px]">
                <div className="h-5 w-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading categories...</span>
              </div>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <IoFlaskOutline className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">
                  No categories found
                </p>
                <p className="text-[13px] text-text-muted mt-1">
                  Add a category or adjust your search to see results.
                </p>
              </div>
            </div>
          ) : (
            <table className="clarity-table w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))]">
                  <th className="px-5 py-3 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.06em] uppercase">
                    Category Name
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
                {filteredCategories.map((category) => (
                  <tr
                    key={category.id}
                    className="hover:bg-[rgb(var(--color-surface-2))/0.5] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <IoFlaskOutline className="text-primary w-4 h-4" />
                        <span className="text-[13.5px] font-semibold text-[rgb(var(--color-text))]">
                          {category.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {category.description ? (
                        <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                          {category.description}
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
                          category.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {category.isActive ? (
                          <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                        ) : (
                          <IoCloseCircleOutline className="w-3.5 h-3.5" />
                        )}
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                        {category.createdAt
                          ? category.createdAt.toLocaleDateString()
                          : "N/A"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          aria-label="Edit category"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                          title="Edit"
                          type="button"
                          onClick={() => openEditModal(category)}
                        >
                          <IoCreateOutline className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          aria-label={
                            category.isActive
                              ? "Deactivate category"
                              : "Activate category"
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-colors border ${
                            category.isActive
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          }`}
                          title={category.isActive ? "Deactivate" : "Activate"}
                          type="button"
                          onClick={() => handleToggleStatus(category)}
                        >
                          {category.isActive ? (
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
                          aria-label="Delete category"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                          title="Delete"
                          type="button"
                          onClick={() => openDeleteModal(category)}
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
                {isLoading ? "Saving..." : "Save Category"}
              </button>
            </>
          }
          size="lg"
          subtitle={
            <p className="text-[11.5px] text-[rgb(var(--color-text-muted)/0.5)]">
              Category metadata for medicine grouping.
            </p>
          }
          title={currentCategory ? "Edit Category" : "Add Category"}
          onClose={() => setIsModalOpen(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                Category Name <span className="text-danger">*</span>
              </label>
              <input
                required
                className="clarity-input h-8 w-full text-[13px] px-2"
                name="name"
                placeholder="Enter category name"
                value={formData.name}
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
                placeholder="Enter category description"
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
                  setCategoryToDelete(null);
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
                  {isLoading ? "Deleting..." : "Delete Category"}
                </span>
              </button>
            </>
          }
          size="md"
          subtitle={
            <p className="text-[11.5px] text-[rgb(var(--color-text-muted)/0.7)]">
              You are about to delete{" "}
              <span className="font-semibold text-[rgb(var(--color-text))]">
                "{categoryToDelete?.name}"
              </span>
              .
            </p>
          }
          title="Confirm Delete"
          onClose={() => setIsDeleteModalOpen(false)}
        >
          <div className="space-y-3">
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
              <div className="flex items-start gap-2">
                <IoWarningOutline className="text-red-500 mt-0.5 flex-shrink-0 w-4 h-4" />
                <div className="text-[12.5px] text-red-500">
                  <p className="font-semibold mb-1">
                    This action cannot be undone.
                  </p>
                  <p className="text-[rgb(var(--color-text-muted))]">
                    The category will be permanently removed. Medicines
                    associated with this category may lose their category
                    information.
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
