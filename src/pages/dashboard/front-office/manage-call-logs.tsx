import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoPersonOutline,
  IoCallOutline,
  IoCalendarOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoEllipsisVerticalOutline,
  IoArrowDownOutline,
  IoArrowUpOutline,
  IoPhonePortraitOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { callLogService } from "@/services/callLogService";
import { CallLog } from "@/types/models";
import { addToast } from "@/components/ui/toast";

const callTypeOptions = [
  { key: "incoming", label: "Incoming" },
  { key: "outgoing", label: "Outgoing" },
];

export default function ManageCallLogsPage() {
  const { clinicId, userData, currentUser } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCallType, setSelectedCallType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deletingCallLog, setDeletingCallLog] = useState<CallLog | null>(null);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Current date for default values
  const currentDate = new Date().toISOString().split("T")[0];
  const currentDateTime = new Date().toISOString().slice(0, 16);

  const [callLogForm, setCallLogForm] = useState({
    name: "",
    phone: "",
    receivedOn: currentDateTime,
    callType: "incoming" as "incoming" | "outgoing",
    notes: "",
  });

  // Load call logs when component mounts
  useEffect(() => {
    loadCallLogs();
    loadDefaultBranch();
  }, [clinicId]);

  const loadDefaultBranch = async () => {
    if (!clinicId) return;

    try {
      const { branchService } = await import("@/services/branchService");
      const mainBranch = await branchService.getMainBranch(clinicId);

      if (mainBranch) {
        setDefaultBranchId(mainBranch.id);
      }
    } catch (error) {
      console.error("Error loading default branch:", error);
      // If we can't get the main branch, we'll create a default one if needed
    }
  };

  const loadCallLogs = async () => {
    if (!clinicId) return;

    try {
      setLoading(true);
      const callLogsData = await callLogService.getCallLogsByClinic(clinicId);

      setCallLogs(callLogsData);
    } catch (error) {
      console.error("Error loading call logs:", error);
      addToast({
        title: "Error",
        description: "Failed to load call logs. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!clinicId || !currentUser) return;

    // Validation
    if (!callLogForm.name.trim() || !callLogForm.phone.trim()) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        color: "warning",
      });

      return;
    }

    // Get branchId from userData (fallback to clinicId if no specific branch)
    const branchIdToUse = userData?.branchId || defaultBranchId || clinicId;

    try {
      setSubmitting(true);

      if (isEditMode && selectedCallLog) {
        // For updates, don't include createdBy (it should remain unchanged)
        const updateData = {
          ...callLogForm,
          receivedOn: new Date(callLogForm.receivedOn),
          branchId: branchIdToUse,
        };

        await callLogService.updateCallLog(selectedCallLog.id, updateData);
        addToast({
          title: "Success",
          description: "Call log updated successfully!",
          color: "success",
        });
      } else {
        // For new records, include createdBy
        const callLogData = {
          ...callLogForm,
          receivedOn: new Date(callLogForm.receivedOn),
          branchId: branchIdToUse,
          createdBy: currentUser.uid,
        };

        await callLogService.createCallLog(clinicId, callLogData);
        addToast({
          title: "Success",
          description: "Call log added successfully!",
          color: "success",
        });
      }

      // Reset form and close modal
      resetForm();
      setIsOpen(false);

      // Reload call logs
      await loadCallLogs();
    } catch (error) {
      console.error("Error saving call log:", error);
      addToast({
        title: "Error",
        description: "Failed to save call log. Please try again.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit call log
  const handleEditCallLog = (callLog: CallLog) => {
    setSelectedCallLog(callLog);
    setIsEditMode(true);

    // Format phone number for editing - add +977 if not present
    let formattedPhone = callLog.phone;

    if (formattedPhone && !formattedPhone.startsWith("+977")) {
      formattedPhone = "+977" + formattedPhone.replace(/[^\d\s-]/g, "");
    }

    setCallLogForm({
      name: callLog.name,
      phone: formattedPhone,
      receivedOn: callLog.receivedOn.toISOString().slice(0, 16),
      callType: callLog.callType,
      notes: callLog.notes || "",
    });
    setIsOpen(true);
  };

  // Handle delete call log
  const handleDeleteCallLog = async (callLogId: string) => {
    try {
      setActionLoading(callLogId);
      await callLogService.deleteCallLog(callLogId);
      addToast({
        title: "Success",
        description: "Call log deleted successfully!",
        color: "success",
      });
      await loadCallLogs();
    } catch (error) {
      console.error("Error deleting call log:", error);
      addToast({
        title: "Error",
        description: "Failed to delete call log. Please try again.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
      setDeleteOpen(false);
      setDeletingCallLog(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setCallLogForm({
      name: "",
      phone: "",
      receivedOn: currentDateTime,
      callType: "incoming",
      notes: "",
    });
    setSelectedCallLog(null);
    setIsEditMode(false);
  };

  // Handle modal open for new call log
  const handleNewCallLog = () => {
    resetForm();
    setIsOpen(true);
  };

  // Filter call logs based on search query and call type
  const filteredCallLogs = callLogs.filter((callLog) => {
    const matchesSearch =
      callLog.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      callLog.phone.includes(searchQuery);
    const matchesType =
      selectedCallType === "all" || callLog.callType === selectedCallType;

    return matchesSearch && matchesType;
  });

  // Pagination
  const totalPages = Math.ceil(filteredCallLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredCallLogs.length);
  const currentCallLogs = filteredCallLogs.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCallType]);

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
    const incoming = callLogs.filter(
      (log) => log.callType === "incoming",
    ).length;
    const outgoing = callLogs.filter(
      (log) => log.callType === "outgoing",
    ).length;
    const todayStr = new Date().toDateString();
    const todays = callLogs.filter(
      (log) => log.receivedOn.toDateString() === todayStr,
    ).length;

    return { total: callLogs.length, incoming, outgoing, todays };
  }, [callLogs]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="clarity-page-header">
          <div>
            <h1 className="clarity-page-title">Manage Call Logs</h1>
            <p className="clarity-page-subtitle">
              Track and manage incoming and outgoing calls
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="clarity-btn clarity-btn-primary"
              type="button"
              onClick={handleNewCallLog}
            >
              <IoAddOutline aria-hidden className="w-4 h-4" />
              Add Call Log
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="clarity-stat">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-teal-100">
                <IoPhonePortraitOutline
                  aria-hidden
                  className="text-teal-700 text-2xl"
                />
              </div>
            </div>
            <p className="clarity-stat-value text-center">{stats.total}</p>
            <p className="clarity-stat-label text-center">Total Calls</p>
          </div>
          <div className="clarity-stat">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-health-100">
                <IoArrowDownOutline
                  aria-hidden
                  className="text-health-700 text-2xl"
                />
              </div>
            </div>
            <p className="clarity-stat-value text-center">{stats.incoming}</p>
            <p className="clarity-stat-label text-center">Incoming Calls</p>
          </div>
          <div className="clarity-stat">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-saffron-100">
                <IoArrowUpOutline
                  aria-hidden
                  className="text-saffron-700 text-2xl"
                />
              </div>
            </div>
            <p className="clarity-stat-value text-center">{stats.outgoing}</p>
            <p className="clarity-stat-label text-center">Outgoing Calls</p>
          </div>
          <div className="clarity-stat">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 rounded-full bg-mountain-100">
                <IoCalendarOutline
                  aria-hidden
                  className="text-mountain-700 text-2xl"
                />
              </div>
            </div>
            <p className="clarity-stat-value text-center">{stats.todays}</p>
            <p className="clarity-stat-label text-center">Today's Calls</p>
          </div>
        </div>

        {/* Call Logs Table */}
        <div className="clarity-card overflow-hidden">
          <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative max-w-md w-full">
                <IoSearchOutline
                  aria-hidden
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                />
                <input
                  aria-label="Search call logs"
                  className="clarity-input with-left-icon w-full"
                  placeholder="Search by name or phone..."
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="min-w-[220px] w-full sm:w-auto">
                <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                  Call Type
                </label>
                <select
                  aria-label="Filter by call type"
                  className="clarity-input w-full"
                  value={selectedCallType}
                  onChange={(e) => setSelectedCallType(e.target.value)}
                >
                  <option value="all">All Call Types</option>
                  <option value="incoming">Incoming Only</option>
                  <option value="outgoing">Outgoing Only</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-3">
            {loading ? (
              <div className="flex justify-center items-center py-12 text-[rgb(var(--color-text-muted))]">
                Loading call logs...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  aria-label="Call logs table"
                  className="clarity-table w-full"
                >
                  <thead>
                    <tr>
                      <th>Caller</th>
                      <th>Contact</th>
                      <th>Call Type</th>
                      <th>Received On</th>
                      <th>Notes</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCallLogs.map((callLog) => (
                      <tr
                        key={callLog.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              aria-hidden
                              className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-semibold"
                            >
                              {(callLog.name?.[0] || "?").toUpperCase()}
                            </div>
                            <div className="font-medium text-[rgb(var(--color-text))]">
                              {callLog.name}
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
                              {callLog.phone}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`clarity-badge inline-flex items-center gap-1 ${
                              callLog.callType === "incoming"
                                ? "bg-health-100 text-health-700"
                                : "bg-saffron-100 text-saffron-700"
                            }`}
                          >
                            {callLog.callType === "incoming" ? (
                              <IoArrowDownOutline
                                aria-hidden
                                className="w-3 h-3"
                              />
                            ) : (
                              <IoArrowUpOutline
                                aria-hidden
                                className="w-3 h-3"
                              />
                            )}
                            {callLog.callType.charAt(0).toUpperCase() +
                              callLog.callType.slice(1)}
                          </span>
                        </td>
                        <td className="text-sm">
                          <div>
                            {new Date(callLog.receivedOn)
                              .toISOString()
                              .split("T")[0]
                              .replace(/-/g, "/")}
                          </div>
                          <div className="text-xs text-[rgb(var(--color-text-muted))]">
                            {new Date(callLog.receivedOn).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )}
                          </div>
                        </td>
                        <td className="max-w-xs">
                          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
                            {callLog.notes || "No notes"}
                          </p>
                        </td>
                        <td className="text-right">
                          <div
                            ref={
                              openDropdownId === callLog.id
                                ? dropdownRef
                                : undefined
                            }
                            className="relative inline-block"
                          >
                            <button
                              aria-expanded={openDropdownId === callLog.id}
                              aria-haspopup="true"
                              aria-label="Call log actions"
                              className="clarity-btn clarity-btn-ghost h-8 w-8 p-0 justify-center"
                              disabled={actionLoading === callLog.id}
                              type="button"
                              onClick={() =>
                                setOpenDropdownId(
                                  openDropdownId === callLog.id
                                    ? null
                                    : callLog.id,
                                )
                              }
                            >
                              <IoEllipsisVerticalOutline
                                aria-hidden
                                className="w-4 h-4"
                              />
                            </button>
                            {openDropdownId === callLog.id && (
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
                                    handleEditCallLog(callLog);
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
                                    setDeletingCallLog(callLog);
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

                {filteredCallLogs.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <IoPhonePortraitOutline
                      aria-hidden
                      className="mx-auto text-mountain-300 text-6xl mb-4"
                    />
                    <p className="text-[rgb(var(--color-text-muted))]">
                      {searchQuery || selectedCallType !== "all"
                        ? "No call logs found matching your criteria."
                        : "No call logs found. Add your first call log to get started."}
                    </p>
                    {!searchQuery && selectedCallType === "all" && (
                      <button
                        className="clarity-btn clarity-btn-primary mt-4"
                        type="button"
                        onClick={handleNewCallLog}
                      >
                        Add First Call Log
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {filteredCallLogs.length > 0 && (
            <div className="border-t border-[rgb(var(--color-border))] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                Showing {startIndex + 1} to {endIndex} of{" "}
                {filteredCallLogs.length} call logs
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  aria-label="Previous page"
                  className="w-8 h-8 flex items-center justify-center rounded border border-mountain-300 text-mountain-600 disabled:opacity-30 disabled:cursor-not-allowed hover:border-teal-400 hover:text-teal-700 hover:bg-mountain-50 transition-all font-medium py-0"
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
                  className="w-8 h-8 flex items-center justify-center rounded border border-mountain-300 text-mountain-600 disabled:opacity-30 disabled:cursor-not-allowed hover:border-teal-400 hover:text-teal-700 hover:bg-mountain-50 transition-all font-medium py-0"
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
          aria-labelledby="delete-calllog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setDeleteOpen(false);
              setDeletingCallLog(null);
            }}
          />
          <div className="clarity-panel w-full max-w-md p-4 relative z-10">
            <h3
              className="text-base font-semibold text-[rgb(var(--color-text))] mb-2"
              id="delete-calllog-title"
            >
              Delete Call Log
            </h3>
            <p className="text-sm text-[rgb(var(--color-text))] mb-4">
              Are you sure you want to delete{" "}
              <strong>{deletingCallLog?.name}</strong>? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="clarity-btn clarity-btn-ghost"
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletingCallLog(null);
                }}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-danger"
                disabled={!deletingCallLog}
                type="button"
                onClick={() =>
                  deletingCallLog && handleDeleteCallLog(deletingCallLog.id)
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Call Log Modal */}
      {isOpen && (
        <div
          aria-labelledby="calllog-modal-title"
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
                id="calllog-modal-title"
              >
                {isEditMode ? "Edit Call Log" : "Add New Call Log"}
              </h2>
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                {isEditMode
                  ? "Update call log information"
                  : "Enter call details"}
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Caller Name
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
                      placeholder="Enter caller name"
                      value={callLogForm.name}
                      onChange={(e) =>
                        setCallLogForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
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
                      value={callLogForm.phone}
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
                        setCallLogForm((prev) => ({
                          ...prev,
                          phone: formattedValue,
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Received On
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
                      type="datetime-local"
                      value={callLogForm.receivedOn}
                      onChange={(e) =>
                        setCallLogForm((prev) => ({
                          ...prev,
                          receivedOn: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Call Type
                  </label>
                  <select
                    aria-label="Call type"
                    className="clarity-input w-full"
                    value={callLogForm.callType}
                    onChange={(e) =>
                      setCallLogForm((prev) => ({
                        ...prev,
                        callType: e.target.value as "incoming" | "outgoing",
                      }))
                    }
                  >
                    {callTypeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                  Notes
                </label>
                <textarea
                  className="clarity-textarea w-full"
                  placeholder="Enter call notes or summary (optional)"
                  rows={4}
                  value={callLogForm.notes}
                  onChange={(e) =>
                    setCallLogForm((prev) => ({
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
                    ? "Update Call Log"
                    : "Add Call Log"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
