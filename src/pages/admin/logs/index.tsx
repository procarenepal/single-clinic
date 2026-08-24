import React, { useState, useEffect, useCallback } from "react";
import {
  IoSearchOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoTimeOutline,
  IoPersonOutline,
  IoBusinessOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoAlertCircleOutline,
  IoInformationCircleOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
} from "react-icons/io5";
import { format } from "date-fns";

import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Spinner,
} from "@/components/ui";
import { title } from "@/components/primitives";
import { auditLogService, AuditLogFilters } from "@/services/auditLogService";
import { AuditLog } from "@/types/models";
import { clinicService } from "@/services/clinicService";
import { Clinic } from "@/types/models";

const EVENT_TYPE_OPTIONS = [
  { key: "all", label: "All Events" },
  { key: "payment_recorded", label: "Payment Recorded" },
  { key: "invoice_created", label: "Invoice Created" },
  { key: "ird_synced", label: "IRD Sync Success" },
  { key: "ird_sync_failed", label: "IRD Sync Failed" },
  { key: "refund_issued", label: "Refund / Return" },
  { key: "role_created", label: "Role Created" },
  { key: "role_updated", label: "Role Updated" },
  { key: "role_deleted", label: "Role Deleted" },
  { key: "user_created", label: "User Created" },
  { key: "user_updated", label: "User Updated" },
  { key: "user_activated", label: "User Activated" },
  { key: "user_deactivated", label: "User Deactivated" },
  { key: "roles_assigned", label: "Roles Assigned" },
  { key: "roles_removed", label: "Roles Removed" },
  { key: "validation_failed", label: "Validation Failed" },
  { key: "operation_failed", label: "Operation Failed" },
];

const STATUS_OPTIONS = [
  { key: "all", label: "All Statuses" },
  { key: "success", label: "Success" },
  { key: "failure", label: "Failure" },
  { key: "partial", label: "Partial" },
];

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [clinicFilter, setClinicFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Expanded log details
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Load clinics for filter
  useEffect(() => {
    const loadClinics = async () => {
      try {
        const allClinics = await clinicService.getAllClinics();

        setClinics(allClinics);
      } catch (error) {
        console.error("Error loading clinics:", error);
      }
    };

    loadClinics();
  }, []);

  // Load logs
  const loadLogs = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setLoading(true);
          setLastDoc(null);
          setHasMore(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);

        const filters: AuditLogFilters = {};

        if (eventTypeFilter !== "all") {
          filters.eventType = eventTypeFilter as AuditLog["eventType"];
        }

        if (clinicFilter !== "all") {
          filters.clinicId = clinicFilter;
        }

        if (statusFilter !== "all") {
          filters.status = statusFilter as AuditLog["status"];
        }

        if (searchQuery.trim()) {
          filters.searchQuery = searchQuery.trim();
        }

        if (startDate) {
          filters.startDate = new Date(startDate);
        }

        if (endDate) {
          const end = new Date(endDate);

          end.setHours(23, 59, 59, 999); // End of day
          filters.endDate = end;
        }

        const pagination = reset ? undefined : { lastDoc, pageSize: 50 };
        const result = await auditLogService.getLogs(filters, pagination);

        if (reset) {
          setLogs(result.logs);
        } else {
          setLogs((prev) => [...prev, ...result.logs]);
        }

        setLastDoc(result.lastDoc);
        setHasMore(result.logs.length === 50 && result.lastDoc !== null);
      } catch (err) {
        console.error("Error loading logs:", err);
        setError("Failed to load audit logs");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      eventTypeFilter,
      clinicFilter,
      statusFilter,
      searchQuery,
      startDate,
      endDate,
      lastDoc,
    ],
  );

  useEffect(() => {
    loadLogs(true);
  }, [eventTypeFilter, clinicFilter, statusFilter, startDate, endDate]);

  const handleSearch = () => {
    loadLogs(true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadLogs(false);
    }
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }

      return newSet;
    });
  };

  const getEventTypeColor = (
    eventType: AuditLog["eventType"],
  ): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    if (eventType === "payment_recorded" || eventType === "ird_synced") return "success";
    if (eventType === "invoice_created") return "primary";
    if (eventType === "ird_sync_failed" || eventType === "refund_issued") return "danger";
    if (eventType.includes("created")) return "success";
    if (eventType.includes("updated")) return "primary";
    if (eventType.includes("deleted") || eventType.includes("removed"))
      return "danger";
    if (eventType.includes("failed")) return "danger";
    if (eventType.includes("assigned") || eventType.includes("activated"))
      return "success";
    if (eventType.includes("deactivated")) return "warning";

    return "default";
  };

  const getEventTypeIcon = (eventType: AuditLog["eventType"]) => {
    if (eventType === "payment_recorded" || eventType === "ird_synced") return <IoCheckmarkCircleOutline className="text-success" />;
    if (eventType === "invoice_created") return <IoInformationCircleOutline className="text-primary" />;
    if (eventType === "ird_sync_failed" || eventType.includes("failed")) return <IoAlertCircleOutline className="text-danger" />;
    if (eventType.includes("created")) return <IoCheckmarkCircleOutline />;
    if (eventType.includes("updated")) return <IoInformationCircleOutline />;
    if (eventType.includes("deleted") || eventType.includes("removed"))
      return <IoCloseCircleOutline />;

    return <IoInformationCircleOutline />;
  };

  const formatEventType = (eventType: AuditLog["eventType"]): string => {
    return eventType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner label="Loading audit logs..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={title()}>Audit Logs</h1>
          <p className="text-default-500 mt-1">
            Track all role and user creation events and state changes
          </p>
        </div>
        <Button
          color="primary"
          isLoading={loading}
          startContent={<IoRefreshOutline />}
          variant="flat"
          onClick={() => loadLogs(true)}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex items-center gap-2">
          <IoFilterOutline />
          <span className="font-semibold">Filters</span>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label="Event Type"
              selectedKeys={[eventTypeFilter]}
              onChange={(e) =>
                setEventTypeFilter(
                  (e.target as HTMLSelectElement).value || "all",
                )
              }
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>

            <Select
              label="Clinic"
              selectedKeys={[clinicFilter]}
              onChange={(e) =>
                setClinicFilter((e.target as HTMLSelectElement).value || "all")
              }
            >
              <SelectItem key="all" value="all">
                All Clinics
              </SelectItem>
              {clinics.map((clinic) => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </SelectItem>
              ))}
            </Select>

            <Select
              label="Status"
              selectedKeys={[statusFilter]}
              onChange={(e) =>
                setStatusFilter((e.target as HTMLSelectElement).value || "all")
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>

            <Input
              label="Search"
              placeholder="Search by user, role, clinic..."
              startContent={<IoSearchOutline />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button
              color="primary"
              startContent={<IoSearchOutline />}
              onClick={handleSearch}
            >
              Apply Filters
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <span className="font-semibold">Logs ({logs.length})</span>
            {error && (
              <Chip color="danger" size="sm" variant="flat">
                {error}
              </Chip>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <IoInformationCircleOutline className="w-16 h-16 text-default-300 mx-auto mb-4" />
              <p className="text-default-500 mb-4">
                No logs found matching your filters or no audit events recorded yet.
              </p>
              <Button
                color="primary"
                variant="flat"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const cid = clinics[0]?.id || "main-clinic";
                    await auditLogService.createLog({
                      eventType: "payment_recorded",
                      performedBy: "cashier_01",
                      performedByName: "Front Desk Cashier",
                      performedByEmail: "cashier@procaresoft.com",
                      clinicId: cid,
                      status: "success",
                      details: {
                        invoiceNumber: "INV-2026-0001",
                        amountPaid: 2500,
                        paymentMethod: "Fonepay QR",
                        patientName: "Ram Sharma",
                      },
                    });
                    await auditLogService.createLog({
                      eventType: "ird_synced",
                      performedBy: "system",
                      performedByName: "IRD CBMS Service",
                      performedByEmail: "ird-sync@procaresoft.com",
                      clinicId: cid,
                      status: "success",
                      details: {
                        invoiceNumber: "INV-2026-0001",
                        responseCode: "200",
                        fiscalYear: "2083.84",
                        vatAmount: 287.61,
                      },
                    });
                    await auditLogService.createLog({
                      eventType: "invoice_created",
                      performedBy: "admin",
                      performedByName: "System Admin",
                      performedByEmail: "admin@procaresoft.com",
                      clinicId: cid,
                      status: "success",
                      details: {
                        invoiceNumber: "INV-2026-0001",
                        totalAmount: 2500,
                        itemsCount: 2,
                      },
                    });
                    await loadLogs(true);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Generate Demo Payment & Financial Logs
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                const clinic = clinics.find((c) => c.id === log.clinicId);

                return (
                  <Card key={log.id} className="border border-default-200">
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`text-lg ${getEventTypeColor(log.eventType) === "success" ? "text-success" : getEventTypeColor(log.eventType) === "danger" ? "text-danger" : "text-primary"}`}
                            >
                              {getEventTypeIcon(log.eventType)}
                            </div>
                            <Chip
                              color={getEventTypeColor(log.eventType)}
                              size="sm"
                              variant="flat"
                            >
                              {formatEventType(log.eventType)}
                            </Chip>
                            <Chip
                              color={
                                log.status === "success"
                                  ? "success"
                                  : log.status === "failure"
                                    ? "danger"
                                    : "warning"
                              }
                              size="sm"
                              variant="flat"
                            >
                              {log.status}
                            </Chip>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <IoTimeOutline className="text-default-400" />
                              <span className="text-default-600">
                                {format(log.timestamp, "MMM dd, yyyy HH:mm:ss")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <IoPersonOutline className="text-default-400" />
                              <span className="text-default-600">
                                {log.performedByName ||
                                  log.performedByEmail ||
                                  log.performedBy}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <IoBusinessOutline className="text-default-400" />
                              <span className="text-default-600">
                                {clinic?.name || log.clinicId}
                              </span>
                            </div>
                            {log.branchId && (
                              <div className="text-default-600">
                                Branch: {log.branchId}
                              </div>
                            )}
                          </div>

                          {log.errorMessage && (
                            <div className="mt-2 p-2 bg-danger/10 border border-danger/20 rounded">
                              <p className="text-sm text-danger">
                                <strong>Error:</strong> {log.errorMessage}
                              </p>
                            </div>
                          )}

                          {isExpanded && (
                            <div className="mt-4 p-4 bg-default-50 rounded-lg border border-default-200">
                              <h4 className="font-semibold mb-2">Details</h4>
                              <pre className="text-xs overflow-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>

                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => toggleLogExpansion(log.id)}
                        >
                          {isExpanded ? (
                            <IoChevronUpOutline />
                          ) : (
                            <IoChevronDownOutline />
                          )}
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    color="primary"
                    isLoading={loadingMore}
                    variant="flat"
                    onPress={handleLoadMore}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
