import React, { useState, useEffect, useCallback } from "react";
import {
  ClockIcon,
  UserIcon,
  StethoscopeIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
} from "lucide-react";

import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { smsService, SMSLog } from "@/services/sendMessageService";

const ViewSMSLogsTab: React.FC = () => {
  const { clinicId } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SMSLog[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [recipientTypeFilter, setRecipientTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const maxRetries = 3;
  const retryDelay = 2000;
  const pageSizeOptions = [5, 10, 20, 50, 100];

  const validateSMSLog = (log: any): log is SMSLog =>
    log &&
    typeof log.id === "string" &&
    typeof log.message === "string" &&
    typeof log.status === "string" &&
    typeof log.type === "string" &&
    log.createdAt instanceof Date;

  const loadLogs = useCallback(
    async (isRetry = false) => {
      if (!clinicId) {
        setError("Clinic ID is not available");
        setLoading(false);

        return;
      }
      if (!isRetry) {
        setLoading(true);
        setError(null);
      } else {
        setRefreshing(true);
      }
      try {
        const logsData = await smsService.getSMSLogs(clinicId, undefined, 200);
        const validLogs = logsData.filter(validateSMSLog);

        setLogs(validLogs);
        setFilteredLogs(validLogs);
        setLastFetchTime(new Date());
        setError(null);
        setRetryCount(0);
        setHasCompletedInitialLoad(true);
        if (validLogs.length === 0 && !isRetry) {
          addToast({
            title: "No SMS Logs",
            description:
              "No SMS logs found for this clinic. Logs will appear here after sending messages.",
            color: "default",
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";

        setError(errorMessage);
        if (retryCount < maxRetries && !isRetry) {
          setRetryCount((prev) => prev + 1);
          setTimeout(() => loadLogs(true), retryDelay);
          addToast({
            title: "Retrying...",
            description: `Failed to load SMS logs. Retrying (${retryCount + 1}/${maxRetries})...`,
            color: "warning",
          });
        } else {
          setHasCompletedInitialLoad(true);
          addToast({
            title: "Error Loading SMS Logs",
            description: `Failed to load SMS logs: ${errorMessage}. Please try refreshing manually.`,
            color: "danger",
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [clinicId, retryCount],
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    try {
      let filtered = [...logs];

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();

        filtered = filtered.filter(
          (log) =>
            log.patientName?.toLowerCase().includes(query) ||
            log.doctorName?.toLowerCase().includes(query) ||
            log.patientPhone?.includes(searchQuery) ||
            log.doctorPhone?.includes(searchQuery) ||
            log.message?.toLowerCase().includes(query),
        );
      }
      if (statusFilter !== "all")
        filtered = filtered.filter((log) => log.status === statusFilter);
      if (typeFilter !== "all")
        filtered = filtered.filter((log) => log.type === typeFilter);
      if (recipientTypeFilter !== "all")
        filtered = filtered.filter(
          (log) => log.recipientType === recipientTypeFilter,
        );
      if (dateFilter !== "all") {
        const now = new Date();
        const filterDate = new Date();

        switch (dateFilter) {
          case "today":
            filterDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(
              (log) => new Date(log.createdAt) >= filterDate,
            );
            break;
          case "week":
            filterDate.setDate(now.getDate() - 7);
            filtered = filtered.filter(
              (log) => new Date(log.createdAt) >= filterDate,
            );
            break;
          case "month":
            filterDate.setMonth(now.getMonth() - 1);
            filtered = filtered.filter(
              (log) => new Date(log.createdAt) >= filterDate,
            );
            break;
        }
      }
      setFilteredLogs(filtered);
      const newTotalPages = Math.ceil(filtered.length / itemsPerPage);

      if (currentPage > newTotalPages && newTotalPages > 0)
        setCurrentPage(newTotalPages);
      else if (newTotalPages === 0) setCurrentPage(1);
    } catch {
      addToast({
        title: "Filter Error",
        description: "Error applying filters. Showing all logs.",
        color: "warning",
      });
      setFilteredLogs(logs);
    }
  }, [
    logs,
    searchQuery,
    statusFilter,
    typeFilter,
    recipientTypeFilter,
    dateFilter,
    itemsPerPage,
    currentPage,
  ]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setRecipientTypeFilter("all");
    setDateFilter("all");
  };

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      await loadLogs();
      addToast({
        title: "Refreshed",
        description: "SMS logs have been refreshed successfully.",
        color: "success",
      });
    } catch {
      addToast({
        title: "Refresh Failed",
        description: "Failed to refresh SMS logs. Please try again.",
        color: "danger",
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadLogs]);

  const getStatistics = useCallback(() => {
    try {
      return {
        total: filteredLogs.length,
        sent: filteredLogs.filter((log) => log.status === "sent").length,
        failed: filteredLogs.filter((log) => log.status === "failed").length,
        pending: filteredLogs.filter((log) => log.status === "pending").length,
        reminders: filteredLogs.filter((log) => log.type === "reminder").length,
        manual: filteredLogs.filter((log) => log.type === "manual").length,
      };
    } catch {
      return {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        reminders: 0,
        manual: 0,
      };
    }
  }, [filteredLogs]);

  const stats = getStatistics();

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-health-100 text-health-700";
      case "failed":
        return "bg-rose-100 text-rose-700";
      case "pending":
        return "bg-saffron-100 text-saffron-700";
      default:
        return "bg-mountain-100 text-mountain-700";
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "reminder":
        return "bg-teal-100 text-teal-700";
      case "manual":
        return "bg-mountain-100 text-mountain-700";
      case "template":
        return "bg-mountain-100 text-mountain-600";
      case "appointment":
        return "bg-health-100 text-health-700";
      default:
        return "bg-mountain-100 text-mountain-600";
    }
  };

  const getRecipientBadgeClass = (recipientType?: string) => {
    switch (recipientType) {
      case "patient":
        return "bg-health-100 text-health-700";
      case "doctor":
        return "bg-teal-100 text-teal-700";
      case "general":
        return "bg-mountain-100 text-mountain-600";
      default:
        return "bg-mountain-100 text-mountain-600";
    }
  };

  const getRecipientIcon = (recipientType?: string) => {
    switch (recipientType) {
      case "patient":
        return <UserIcon aria-hidden size={14} />;
      case "doctor":
        return <StethoscopeIcon aria-hidden size={14} />;
      default:
        return <MessageSquareIcon aria-hidden size={14} />;
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case "reminder":
        return "Scheduled appointment reminder";
      case "manual":
        return "Manually sent message";
      case "template":
        return "Template-based message";
      case "appointment":
        return "Appointment-related message";
      default:
        return "SMS message";
    }
  };

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredLogs.length);
  const currentLogs = filteredLogs.slice(startIndex, endIndex);
  const paginationInfo = {
    showing: currentLogs.length,
    start: filteredLogs.length > 0 ? startIndex + 1 : 0,
    end: endIndex,
    total: filteredLogs.length,
    totalPages,
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    const currentFirstItem = (currentPage - 1) * itemsPerPage + 1;

    setCurrentPage(Math.max(1, Math.ceil(currentFirstItem / newSize)));
  };

  useEffect(() => {
    const doc = typeof window !== "undefined" ? window.document : null;

    if (!doc) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      if (totalPages <= 1) return;
      switch (event.key) {
        case "ArrowLeft":
          if (event.ctrlKey && currentPage > 1) {
            event.preventDefault();
            handlePageChange(currentPage - 1);
          }
          break;
        case "ArrowRight":
          if (event.ctrlKey && currentPage < totalPages) {
            event.preventDefault();
            handlePageChange(currentPage + 1);
          }
          break;
        case "Home":
          if (event.ctrlKey) {
            event.preventDefault();
            handlePageChange(1);
          }
          break;
        case "End":
          if (event.ctrlKey) {
            event.preventDefault();
            handlePageChange(totalPages);
          }
          break;
      }
    };

    doc.addEventListener("keydown", handleKeyDown);

    return () => doc.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages]);

  if (loading && !refreshing) {
    return (
      <div className="flex justify-center items-center py-12 text-[rgb(var(--color-text-muted))]">
        Loading...
      </div>
    );
  }

  if (
    error &&
    !loading &&
    !refreshing &&
    logs.length === 0 &&
    hasCompletedInitialLoad
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <AlertTriangleIcon
          aria-hidden
          className="w-12 h-12 text-rose-600 mb-4"
        />
        <h3 className="text-base font-semibold text-rose-600 mb-2">
          Failed to Load SMS Logs
        </h3>
        <p className="text-sm text-[rgb(var(--color-text-muted))] text-center mb-4 max-w-md">
          {error}
        </p>
        <div className="flex gap-2">
          <button
            className="clarity-btn clarity-btn-primary"
            disabled={refreshing}
            type="button"
            onClick={handleRefresh}
          >
            <RefreshCwIcon aria-hidden className="w-4 h-4" />
            {retryCount > 0 ? `Retry (${retryCount}/3)` : "Retry"}
          </button>
          {retryCount >= 3 && (
            <button
              className="clarity-btn clarity-btn-ghost"
              type="button"
              onClick={() => {
                setError(null);
                setRetryCount(0);
                setLogs([]);
                setFilteredLogs([]);
              }}
            >
              Reset
            </button>
          )}
        </div>
        {lastFetchTime && (
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-2">
            Last successful fetch:{" "}
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(lastFetchTime)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {refreshing && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-[rgb(var(--color-border))]">
            <RefreshCwIcon
              aria-hidden
              className="w-4 h-4 animate-spin text-teal-700"
            />
            <span className="text-sm text-[rgb(var(--color-text))]">
              Refreshing data...
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { value: stats.total, label: "Total SMS", cls: "text-teal-700" },
          { value: stats.sent, label: "Sent", cls: "text-health-600" },
          { value: stats.pending, label: "Pending", cls: "text-saffron-600" },
          { value: stats.failed, label: "Failed", cls: "text-rose-600" },
          { value: stats.reminders, label: "Reminders", cls: "text-teal-600" },
          { value: stats.manual, label: "Manual", cls: "text-mountain-700" },
        ].map((s) => (
          <div key={s.label} className="clarity-card p-3 text-center">
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            View and filter SMS history ({filteredLogs.length} of {logs.length}{" "}
            logs)
          </p>
          {filteredLogs.length > 0 && (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              Showing {paginationInfo.start}-{paginationInfo.end} of{" "}
              {paginationInfo.total} results
              {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {filteredLogs.length > 5 && (
            <div>
              <label className="block text-xs text-[rgb(var(--color-text-muted))] mb-0.5">
                Per page
              </label>
              <select
                aria-label="Items per page"
                className="clarity-input w-24"
                value={itemsPerPage}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
              >
                {pageSizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            className="clarity-btn clarity-btn-primary"
            disabled={loading || refreshing}
            type="button"
            onClick={handleRefresh}
          >
            <RefreshCwIcon
              aria-hidden
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
            Search
          </label>
          <div className="relative">
            <input
              aria-label="Search logs"
              className="clarity-input w-full"
              placeholder="Search logs..."
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
                type="button"
                onClick={() => setSearchQuery("")}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
            Status
          </label>
          <select
            aria-label="Status filter"
            className="clarity-input w-full"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
            Type
          </label>
          <select
            aria-label="Type filter"
            className="clarity-input w-full"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="reminder">Reminder</option>
            <option value="manual">Manual</option>
            <option value="template">Template</option>
            <option value="appointment">Appointment</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
            Recipient
          </label>
          <select
            aria-label="Recipient filter"
            className="clarity-input w-full"
            value={recipientTypeFilter}
            onChange={(e) => setRecipientTypeFilter(e.target.value)}
          >
            <option value="all">All Recipients</option>
            <option value="patient">Patients</option>
            <option value="doctor">Doctors</option>
            <option value="general">General</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
            Date Range
          </label>
          <select
            aria-label="Date filter"
            className="clarity-input w-full"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            className="clarity-btn clarity-btn-ghost"
            type="button"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {currentLogs.length === 0 ? (
        <div className="text-center py-12">
          {logs.length === 0 ? (
            <div>
              <p className="text-[rgb(var(--color-text-muted))] mb-2">
                No SMS logs found for this clinic
              </p>
              <p className="text-sm text-[rgb(var(--color-text-muted))] mb-4">
                SMS logs will appear here after you send messages using the Send
                SMS tab
              </p>
              <button
                className="clarity-btn clarity-btn-primary"
                disabled={loading || refreshing}
                type="button"
                onClick={handleRefresh}
              >
                <RefreshCwIcon
                  aria-hidden
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing…" : "Refresh to check for new logs"}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[rgb(var(--color-text-muted))]">
                No SMS logs match your current filters
              </p>
              <button
                className="clarity-btn clarity-btn-ghost mt-2"
                type="button"
                onClick={clearFilters}
              >
                Clear filters to see all logs
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentLogs.map((log) => (
            <div key={log.id} className="clarity-card p-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span
                      className={`clarity-badge ${getStatusBadgeClass(log.status)} inline-flex items-center gap-1`}
                    >
                      {log.status === "pending" && (
                        <ClockIcon aria-hidden size={12} />
                      )}
                      {log.status.toUpperCase()}
                    </span>
                    <span
                      className={`clarity-badge ${getTypeBadgeClass(log.type)}`}
                    >
                      {log.type.toUpperCase()}
                    </span>
                    {log.recipientType && (
                      <span
                        className={`clarity-badge ${getRecipientBadgeClass(log.recipientType)} inline-flex items-center gap-1`}
                      >
                        {getRecipientIcon(log.recipientType)}
                        {log.recipientType.toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm text-[rgb(var(--color-text-muted))]">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[rgb(var(--color-text))]">
                          {log.patientName ||
                            log.doctorName ||
                            "Unknown Recipient"}
                        </span>
                        <span className="text-sm text-[rgb(var(--color-text-muted))]">
                          {log.patientPhone || log.doctorPhone || "No phone"}
                        </span>
                      </div>
                      <span className="text-xs text-[rgb(var(--color-text-muted))]">
                        {getTypeDescription(log.type)}
                      </span>
                    </div>
                    <div className="text-sm bg-[rgb(var(--color-surface-2))] p-3 rounded border border-[rgb(var(--color-border))]">
                      {log.message}
                    </div>
                    {log.errorMessage && (
                      <div className="text-sm bg-rose-50 text-rose-700 p-2 rounded border border-rose-200">
                        <span className="font-medium">Error: </span>
                        {log.errorMessage}
                      </div>
                    )}
                    {log.templateId && (
                      <div className="text-xs text-[rgb(var(--color-text-muted))]">
                        Template ID: {log.templateId}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-[rgb(var(--color-border))]">
          <div className="text-sm text-[rgb(var(--color-text-muted))]">
            Showing {paginationInfo.start}-{paginationInfo.end} of{" "}
            {paginationInfo.total} results
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="clarity-btn clarity-btn-ghost"
              disabled={currentPage === 1}
              type="button"
              onClick={() => handlePageChange(1)}
            >
              First
            </button>
            <button
              className="clarity-btn clarity-btn-ghost"
              disabled={currentPage === 1}
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
            >
              Previous
            </button>
            <span className="text-sm text-[rgb(var(--color-text-muted))] px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="clarity-btn clarity-btn-ghost"
              disabled={currentPage === totalPages}
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next
            </button>
            <button
              className="clarity-btn clarity-btn-ghost"
              disabled={currentPage === totalPages}
              type="button"
              onClick={() => handlePageChange(totalPages)}
            >
              Last
            </button>
          </div>
          {totalPages > 10 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-[rgb(var(--color-text-muted))]">
                Go to:
              </span>
              <input
                aria-label="Go to page"
                className="clarity-input w-16"
                max={totalPages}
                min={1}
                type="number"
                value={currentPage}
                onChange={(e) => {
                  const p = parseInt(e.target.value);

                  if (p >= 1 && p <= totalPages) handlePageChange(p);
                }}
              />
            </div>
          )}
          <div className="text-xs text-[rgb(var(--color-text-muted))]">
            {itemsPerPage} per page • {totalPages} pages
            {totalPages > 1 && (
              <span className="hidden sm:inline ml-1">
                • Use Ctrl+← → for navigation
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewSMSLogsTab;
