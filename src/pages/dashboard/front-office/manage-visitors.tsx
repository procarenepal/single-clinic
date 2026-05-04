import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoPersonOutline,
  IoCallOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoEllipsisVerticalOutline,
  IoTimeOutline,
  IoPeopleOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
} from "react-icons/io5";

import { useAuth } from "@/hooks/useAuth";
import { visitorService } from "@/services/visitorService";
import { Visitor } from "@/types/models";
import { addToast } from "@/components/ui/toast";
import { title } from "@/components/primitives";

export default function ManageVisitorsPage() {
  const { clinicId, userData, currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deletingVisitor, setDeletingVisitor] = useState<Visitor | null>(null);
  const itemsPerPage = 10;

  // Current date for default values
  const currentDate = new Date().toISOString().split("T")[0];

  const [visitorForm, setVisitorForm] = useState({
    purpose: "",
    name: "",
    phone: "",
    date: currentDate,
    notes: "",
  });

  // Load visitors when component mounts
  useEffect(() => {
    loadVisitors();
  }, [clinicId]);

  const loadVisitors = async () => {
    if (!clinicId) return;

    try {
      setLoading(true);
      const visitorsData = await visitorService.getVisitorsByClinic(clinicId);

      setVisitors(visitorsData);
    } catch (error) {
      console.error("Error loading visitors:", error);
      addToast({
        title: "Error",
        description: "Failed to load visitors. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!clinicId || !currentUser) return;

    // Get branchId from userData (fallback to clinicId if no specific branch)
    const branchId = userData?.branchId || clinicId;

    // Validation
    if (
      !visitorForm.purpose.trim() ||
      !visitorForm.name.trim() ||
      !visitorForm.phone.trim()
    ) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        color: "warning",
      });

      return;
    }

    try {
      setSubmitting(true);

      const visitorData = {
        ...visitorForm,
        date: new Date(visitorForm.date),
        branchId: branchId,
        createdBy: currentUser.uid,
      };

      if (isEditMode && selectedVisitor) {
        await visitorService.updateVisitor(selectedVisitor.id, visitorData);
        addToast({
          title: "Success",
          description: "Visitor updated successfully!",
          color: "success",
        });
      } else {
        await visitorService.createVisitor(clinicId, visitorData);
        addToast({
          title: "Success",
          description: "Visitor added successfully!",
          color: "success",
        });
      }

      // Reset form and close modal
      resetForm();
      setIsOpen(false);

      // Reload visitors
      await loadVisitors();
    } catch (error) {
      console.error("Error saving visitor:", error);
      addToast({
        title: "Error",
        description: "Failed to save visitor. Please try again.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit visitor
  const handleEditVisitor = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setIsEditMode(true);

    // Format phone number for editing - add +977 if not present
    let formattedPhone = visitor.phone;

    if (formattedPhone && !formattedPhone.startsWith("+977")) {
      formattedPhone = "+977" + formattedPhone.replace(/[^\d\s-]/g, "");
    }

    setVisitorForm({
      purpose: visitor.purpose,
      name: visitor.name,
      phone: formattedPhone,
      date: visitor.date.toISOString().split("T")[0],
      notes: visitor.notes || "",
    });
    setIsOpen(true);
  };

  // Handle delete visitor
  const handleDeleteVisitor = async (visitorId: string) => {
    try {
      setActionLoading(visitorId);
      await visitorService.deleteVisitor(visitorId);
      addToast({
        title: "Success",
        description: "Visitor deleted successfully!",
        color: "success",
      });
      await loadVisitors();
    } catch (error) {
      console.error("Error deleting visitor:", error);
      addToast({
        title: "Error",
        description: "Failed to delete visitor. Please try again.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
      setDeleteOpen(false);
      setDeletingVisitor(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setVisitorForm({
      purpose: "",
      name: "",
      phone: "",
      date: currentDate,
      notes: "",
    });
    setSelectedVisitor(null);
    setIsEditMode(false);
  };

  // Handle modal open for new visitor
  const handleNewVisitor = () => {
    resetForm();
    setIsOpen(true);
  };

  // Filter visitors based on search query
  const filteredVisitors = visitors.filter(
    (visitor) =>
      visitor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visitor.phone.includes(searchQuery) ||
      visitor.purpose.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Pagination
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredVisitors.length);
  const currentVisitors = filteredVisitors.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpenDropdownId(null);
      }
    }
    const doc = typeof window !== "undefined" ? window.document : null;

    if (!doc) return;
    doc.addEventListener("mousedown", handleClickOutside);

    return () => doc.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const weekStart = new Date();

    weekStart.setDate(weekStart.getDate() - 7);

    return {
      total: visitors.length,
      today: visitors.filter((v) => v.date.toDateString() === today).length,
      week: visitors.filter((v) => new Date(v.date) >= weekStart).length,
    };
  }, [visitors]);

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div className="clarity-page-header">
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>Manage Visitors</h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              Track and manage clinic visitors
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="clarity-btn clarity-btn-primary"
              type="button"
              onClick={handleNewVisitor}
            >
              <IoAddOutline aria-hidden className="w-4 h-4" />
              Add Visitor
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="clarity-stat">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-teal-100">
                <IoPeopleOutline
                  aria-hidden
                  className="text-teal-700 text-2xl"
                />
              </div>
            </div>
            <p className="clarity-stat-value text-center">{stats.total}</p>
            <p className="clarity-stat-label text-center">Total Visitors</p>
          </div>
          <div className="clarity-stat">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-health-100">
                <IoCalendarOutline
                  aria-hidden
                  className="text-health-700 text-2xl"
                />
              </div>
            </div>
            <p className="clarity-stat-value text-center">{stats.today}</p>
            <p className="clarity-stat-label text-center">Today's Visitors</p>
          </div>
          <div className="clarity-stat">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-saffron-100">
                <IoTimeOutline
                  aria-hidden
                  className="text-saffron-700 text-2xl"
                />
              </div>
            </div>
            <p className="clarity-stat-value text-center">{stats.week}</p>
            <p className="clarity-stat-label text-center">This Week</p>
          </div>
        </div>

        {/* Visitors Table */}
        <div className="clarity-card overflow-hidden">
          <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
            <div className="relative max-w-md">
              <IoSearchOutline
                aria-hidden
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
              />
              <input
                aria-label="Search visitors"
                className="clarity-input with-left-icon w-full"
                placeholder="Search by name, phone, or purpose..."
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="p-3">
            {loading ? (
              <div className="flex justify-center items-center py-12 text-[rgb(var(--color-text-muted))]">
                Loading visitors...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  aria-label="Visitors table"
                  className="clarity-table w-full"
                >
                  <thead>
                    <tr>
                      <th>Visitor</th>
                      <th>Contact</th>
                      <th>Purpose</th>
                      <th>Visit Date</th>
                      <th>Notes</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentVisitors.map((visitor) => (
                      <tr
                        key={visitor.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              aria-hidden
                              className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-semibold"
                            >
                              {(visitor.name?.[0] || "?").toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-[rgb(var(--color-text))]">
                                {visitor.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <IoCallOutline
                              aria-hidden
                              className="text-mountain-400"
                            />
                            <span className="text-sm text-[rgb(var(--color-text))]">
                              {visitor.phone}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-[rgb(var(--color-text))]">
                            {visitor.purpose}
                          </span>
                        </td>
                        <td className="text-sm">
                          {new Date(visitor.date)
                            .toISOString()
                            .split("T")[0]
                            .replace(/-/g, "/")}
                        </td>
                        <td className="max-w-xs">
                          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
                            {visitor.notes || "No notes"}
                          </p>
                        </td>
                        <td className="text-right">
                          <div
                            ref={
                              openDropdownId === visitor.id
                                ? dropdownRef
                                : undefined
                            }
                            className="relative inline-block"
                          >
                            <button
                              aria-expanded={openDropdownId === visitor.id}
                              aria-haspopup="true"
                              aria-label="Visitor actions"
                              className="clarity-btn clarity-btn-ghost h-8 w-8 p-0 justify-center"
                              disabled={actionLoading === visitor.id}
                              type="button"
                              onClick={() =>
                                setOpenDropdownId(
                                  openDropdownId === visitor.id
                                    ? null
                                    : visitor.id,
                                )
                              }
                            >
                              <IoEllipsisVerticalOutline
                                aria-hidden
                                className="w-4 h-4"
                              />
                            </button>
                            {openDropdownId === visitor.id && (
                              <div
                                className="absolute right-0 top-full mt-1 min-w-[160px] clarity-card py-1 z-10"
                                role="menu"
                              >
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                                  role="menuitem"
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleEditVisitor(visitor);
                                  }}
                                >
                                  <IoCreateOutline
                                    aria-hidden
                                    className="w-4 h-4 shrink-0"
                                  />{" "}
                                  Edit
                                </button>
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                                  role="menuitem"
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setDeletingVisitor(visitor);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  <IoTrashOutline
                                    aria-hidden
                                    className="w-4 h-4 shrink-0"
                                  />{" "}
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredVisitors.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <IoPersonOutline
                      aria-hidden
                      className="mx-auto text-mountain-300 text-6xl mb-4"
                    />
                    <p className="text-[rgb(var(--color-text-muted))]">
                      {searchQuery
                        ? "No visitors found matching your search."
                        : "No visitors found. Add your first visitor to get started."}
                    </p>
                    {!searchQuery && (
                      <button
                        className="clarity-btn clarity-btn-primary mt-4"
                        type="button"
                        onClick={handleNewVisitor}
                      >
                        Add First Visitor
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {filteredVisitors.length > 0 && (
            <div className="border-t border-[rgb(var(--color-border))] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                Showing {startIndex + 1} to {endIndex} of{" "}
                {filteredVisitors.length} visitors
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  aria-label="Previous page"
                  className="w-8 h-8 flex items-center justify-center rounded border border-mountain-300 text-mountain-600 disabled:opacity-30 disabled:cursor-not-allowed hover:border-teal-400 hover:text-teal-700 hover:bg-mountain-50 transition-all"
                  disabled={currentPage <= 1}
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                >
                  <IoChevronBackOutline className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-mountain-700 px-2 min-w-[100px] text-center">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  aria-label="Next page"
                  className="w-8 h-8 flex items-center justify-center rounded border border-mountain-300 text-mountain-600 disabled:opacity-30 disabled:cursor-not-allowed hover:border-teal-400 hover:text-teal-700 hover:bg-mountain-50 transition-all"
                  disabled={currentPage >= totalPages}
                  type="button"
                  onClick={() =>
                    handlePageChange(Math.min(totalPages, currentPage + 1))
                  }
                >
                  <IoChevronForwardOutline className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {isDeleteOpen && (
        <div
          aria-labelledby="delete-visitor-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setDeleteOpen(false);
              setDeletingVisitor(null);
            }}
          />
          <div className="clarity-panel w-full max-w-md p-4 relative z-10">
            <h3
              className="text-base font-semibold text-[rgb(var(--color-text))] mb-2"
              id="delete-visitor-title"
            >
              Delete Visitor
            </h3>
            <p className="text-sm text-[rgb(var(--color-text))] mb-4">
              Are you sure you want to delete{" "}
              <strong>{deletingVisitor?.name}</strong>? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="clarity-btn clarity-btn-ghost"
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletingVisitor(null);
                }}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-danger"
                disabled={!deletingVisitor}
                type="button"
                onClick={() =>
                  deletingVisitor && handleDeleteVisitor(deletingVisitor.id)
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Visitor Modal */}
      {isOpen && (
        <div
          aria-labelledby="visitor-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              if (!submitting) {
                setIsOpen(false);
                resetForm();
              }
            }}
          />
          <div className="clarity-panel w-full max-w-2xl p-4 relative z-10 max-h-[90vh] overflow-y-auto">
            <div className="mb-3">
              <h2
                className="text-base font-semibold text-[rgb(var(--color-text))]"
                id="visitor-modal-title"
              >
                {isEditMode ? "Edit Visitor" : "Add New Visitor"}
              </h2>
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                {isEditMode
                  ? "Update visitor information"
                  : "Enter visitor details"}
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Purpose
                  </label>
                  <div className="relative">
                    <IoDocumentTextOutline
                      aria-hidden
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                    />
                    <input
                      aria-required
                      required
                      className="clarity-input with-left-icon w-full"
                      placeholder="Enter purpose of visit"
                      value={visitorForm.purpose}
                      onChange={(e) =>
                        setVisitorForm((prev) => ({
                          ...prev,
                          purpose: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Visitor Name
                  </label>
                  <div className="relative">
                    <IoPersonOutline
                      aria-hidden
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                    />
                    <input
                      aria-required
                      required
                      className="clarity-input with-left-icon w-full"
                      placeholder="Enter visitor name"
                      value={visitorForm.name}
                      onChange={(e) =>
                        setVisitorForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <IoCallOutline
                      aria-hidden
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                    />
                    <input
                      aria-required
                      required
                      className="clarity-input with-left-icon w-full"
                      placeholder="Enter phone number (e.g., 9841234567)"
                      value={visitorForm.phone}
                      onChange={(e) => {
                        let formattedValue = e.target.value;

                        if (formattedValue.startsWith("+977"))
                          formattedValue = formattedValue.substring(4);
                        formattedValue = formattedValue.replace(
                          /[^\d\s-]/g,
                          "",
                        );
                        if (formattedValue.trim())
                          formattedValue = "+977" + formattedValue;
                        setVisitorForm((prev) => ({
                          ...prev,
                          phone: formattedValue,
                        }));
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Visit Date
                  </label>
                  <div className="relative">
                    <IoCalendarOutline
                      aria-hidden
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                    />
                    <input
                      aria-required
                      required
                      className="clarity-input with-left-icon w-full"
                      type="date"
                      value={visitorForm.date}
                      onChange={(e) =>
                        setVisitorForm((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                  Notes
                </label>
                <textarea
                  className="clarity-textarea w-full"
                  placeholder="Enter any additional notes (optional)"
                  rows={4}
                  value={visitorForm.notes}
                  onChange={(e) =>
                    setVisitorForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="clarity-btn clarity-btn-ghost"
                type="button"
                onClick={() => {
                  if (!submitting) {
                    setIsOpen(false);
                    resetForm();
                  }
                }}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary"
                disabled={submitting}
                type="button"
                onClick={handleSubmit}
              >
                {submitting
                  ? isEditMode
                    ? "Updating..."
                    : "Adding..."
                  : isEditMode
                    ? "Update Visitor"
                    : "Add Visitor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
