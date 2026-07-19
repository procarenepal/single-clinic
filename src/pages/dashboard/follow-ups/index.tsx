import type { PatientFollowup } from "@/types/models";

import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Select,
  SelectItem,
  useDisclosure,
  Tooltip,
  Tabs,
  Tab,
  Switch,
} from "@heroui/react";
import {
  IoSearchOutline,
  IoAddOutline,
  IoTrashOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
} from "react-icons/io5";
import { format } from "date-fns";
import toast from "react-hot-toast";

import FollowupModal from "./FollowupModal";

import { useAuthContext } from "@/context/AuthContext";
import { followupService } from "@/services/followupService";
import { rbacService } from "@/services/rbacService";

const renderServiceProduct = (item: PatientFollowup, filter: string) => {
  const showService = filter !== "pharmacy";
  const showProduct = filter !== "pathology";

  const services = showService && item.service
    ? item.service.split("|").map((s) => s.trim()).filter(Boolean).filter((s) => s.toLowerCase() !== "test" && s.toLowerCase() !== "testing")
    : [];
  
  const products = showProduct && item.product
    ? item.product.split(",").map((p) => p.trim()).filter(Boolean).filter((p) => p.toLowerCase() !== "test" && p.toLowerCase() !== "testing")
    : [];

  if (services.length === 0 && products.length === 0) {
    return <span className="text-text-muted">-</span>;
  }

  return (
    <ol className="list-decimal list-inside text-[10px] text-text-primary space-y-0.5">
      {services.map((s, i) => (
        <li key={`s-${i}`} className="truncate" title={s}>
          {s}
        </li>
      ))}
      {products.map((p, i) => (
        <li key={`p-${i}`} className="truncate text-text-muted" title={p}>
          {p}
        </li>
      ))}
    </ol>
  );
};

export default function FollowupsPage() {
  const { currentUser, clinicId, branchId } = useAuthContext();
  const [followups, setFollowups] = useState<PatientFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isGrouped, setIsGrouped] = useState(true);
  const [expandedPatients, setExpandedPatients] = useState<Record<string, boolean>>({});

  const togglePatientExpand = (patientKey: string) => {
    setExpandedPatients((prev) => ({
      ...prev,
      [patientKey]: !prev[patientKey],
    }));
  };

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedFollowup, setSelectedFollowup] =
    useState<PatientFollowup | null>(null);

  const [allowedCategories, setAllowedCategories] = useState<string[]>([
    "all",
    "appointment",
    "pharmacy",
    "pathology",
    "general",
  ]);

  useEffect(() => {
    loadFollowups();
  }, [clinicId, branchId]);

  useEffect(() => {
    if (clinicId && currentUser?.uid) {
      const fetchRoles = async () => {
        if (
          currentUser.role === "system-owner" ||
          currentUser.role === "clinic-admin"
        ) {
          setAllowedCategories([
            "all",
            "appointment",
            "pharmacy",
            "pathology",
            "general",
          ]);
          return;
        }

        try {
          const assignments = await rbacService.getUserRoleAssignments(
            currentUser.uid,
            clinicId
          );
          const roles = await Promise.all(
            assignments.map((a) => rbacService.getRoleById(a.roleId))
          );
          const roleNames = roles
            .filter((r) => r)
            .map((r) => r!.name.toLowerCase());

          let cats: string[] = [];
          if (
            roleNames.some(
              (r) =>
                r.includes("admin") ||
                r.includes("manager") ||
                r.includes("doctor")
            )
          ) {
            cats = ["all", "appointment", "pharmacy", "pathology", "general"];
          } else {
            if (roleNames.some((r) => r.includes("pharmac"))) {
              cats.push("pharmacy");
            }
            if (roleNames.some((r) => r.includes("patholog") || r.includes("lab"))) {
              cats.push("pathology");
            }
            if (roleNames.some((r) => r.includes("reception") || r.includes("front"))) {
              cats.push("appointment", "general");
            }
            if (cats.length === 0) {
              cats = ["all", "appointment", "pharmacy", "pathology", "general"]; // Fallback if no specific role matched
            } else if (cats.length > 1) {
              cats = ["all", ...cats];
            }
          }

          setAllowedCategories(cats);
          if (!cats.includes(categoryFilter) && cats.length > 0) {
            setCategoryFilter(cats[0]);
          }
        } catch (err) {
          console.error("Error fetching user roles for followups:", err);
        }
      };

      fetchRoles();
    }
  }, [clinicId, currentUser]);

  const loadFollowups = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const data = await followupService.getFollowups(
        clinicId,
        branchId || undefined,
      );

      setFollowups(data);
    } catch (error) {
      console.error("Error loading followups:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFollowups = useMemo(() => {
    return followups.filter((f) => {
      const matchesSearch =
        f.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.patientMobile.includes(searchQuery);

      const matchesStatus =
        statusFilter === "all" || f.overallStatus === statusFilter;

      const cat = f.category || "general";

      // If "all" is selected, only show allowed categories
      const matchesCategory =
        categoryFilter === "all"
          ? allowedCategories.includes(cat) || allowedCategories.includes("all")
          : cat === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [followups, searchQuery, statusFilter, categoryFilter, allowedCategories]);

  const groupedFollowups = useMemo(() => {
    const groups: Record<
      string,
      {
        patientName: string;
        patientMobile: string;
        items: PatientFollowup[];
      }
    > = {};

    filteredFollowups.forEach((f) => {
      const key = f.patientMobile || f.patientName;
      if (!groups[key]) {
        groups[key] = {
          patientName: f.patientName,
          patientMobile: f.patientMobile,
          items: [],
        };
      }
      groups[key].items.push(f);
    });

    return Object.values(groups).sort((a, b) => {
      const aLatest = Math.max(
        ...a.items.map((item) =>
          item.visitDate ? new Date(item.visitDate).getTime() : 0
        )
      );
      const bLatest = Math.max(
        ...b.items.map((item) =>
          item.visitDate ? new Date(item.visitDate).getTime() : 0
        )
      );
      return bLatest - aLatest;
    });
  }, [filteredFollowups]);

  const handleEdit = (followup: PatientFollowup) => {
    setSelectedFollowup(followup);
    onOpen();
  };

  const handleAddNew = () => {
    setSelectedFollowup(null);
    onOpen();
  };

  const handleSaved = () => {
    loadFollowups();
  };

  const handleInlineUpdate = async (
    item: PatientFollowup,
    field: "session" | "initStatus" | "updatedStatus" | "category",
    value: string,
  ) => {
    const currentSession = item.session || "1st";
    const sessionToUse = field === "session" ? value : currentSession;

    let currentValue;

    if (field === "session" || field === "category") {
      currentValue = item[field];
    } else {
      if (sessionToUse === "1st") {
        currentValue = item.sessionStatuses?.["1st"]?.[field] || item[field];
      } else {
        currentValue = item.sessionStatuses?.[sessionToUse]?.[field];
      }
    }

    if (!value || currentValue === value) return;

    const payload: Partial<PatientFollowup> = { [field]: value };
    const newSessionStatuses = { ...(item.sessionStatuses || {}) };

    if (field !== "session" && field !== "category") {
      if (!newSessionStatuses[sessionToUse])
        newSessionStatuses[sessionToUse] = {};
      newSessionStatuses[sessionToUse] = {
        ...newSessionStatuses[sessionToUse],
        [field]: value,
      };
      payload.sessionStatuses = newSessionStatuses;
    }

    // Auto-generate log for status/session change
    const newLog = {
      date: new Date(),
      note: `${field === "session" ? "Session" : field === "category" ? "Category" : field === "initStatus" ? "Initial Status" : "Updated Status"} changed to '${value}'`,
      user: currentUser?.displayName || "Staff",
    };

    payload.logs = [...(item.logs || []), newLog];

    // Optimistic update
    setFollowups((prev) =>
      prev.map((f) =>
        f.id === item.id ? { ...f, ...payload, logs: payload.logs } : f,
      ),
    );

    try {
      await followupService.updateFollowup(item.id, payload);
    } catch (err) {
      console.error("Failed inline update", err);
      toast.error("Failed to update status");
      loadFollowups(); // revert on fail
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this follow-up record? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await followupService.deleteFollowup(id);
      toast.success("Follow-up deleted successfully");
      loadFollowups();
    } catch (err) {
      toast.error("Failed to delete follow-up");
      console.error(err);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return "-";

    return format(date, "yyyy/MM/dd");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "primary"; // Blue matching Excel
      case "solved":
      case "completed":
        return "success"; // Green matching Excel
      case "complain":
      case "cancelled":
        return "danger"; // Red matching Excel
      case "wrong-no":
        return "secondary"; // Purple matching Excel
      case "no-answer":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Patient Follow-ups
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Track and manage patient follow-up schedules and statuses
          </p>
        </div>
        <Button
          color="primary"
          endContent={<IoAddOutline className="w-5 h-5" />}
          onClick={handleAddNew}
        >
          New Follow-up
        </Button>
      </div>

      <div className="mb-6">
        <Tabs
          classNames={{
            tabList:
              "gap-6 w-full relative rounded-none p-0 border-b border-border-base",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-0 h-12",
            tabContent: "group-data-[selected=true]:text-primary",
          }}
          color="primary"
          selectedKey={categoryFilter}
          variant="underlined"
          onSelectionChange={(key) => setCategoryFilter(key as string)}
        >
          {allowedCategories.includes("all") && (
            <Tab key="all" title="All Follow-ups" />
          )}
          {allowedCategories.includes("appointment") && (
            <Tab key="appointment" title="Appointments" />
          )}
          {allowedCategories.includes("pharmacy") && (
            <Tab key="pharmacy" title="Pharmacy" />
          )}
          {allowedCategories.includes("pathology") && (
            <Tab key="pathology" title="Pathology" />
          )}
          {allowedCategories.includes("general") && (
            <Tab key="general" title="General" />
          )}
        </Tabs>
      </div>

      <div className="bg-surface-1 rounded-xl shadow-sm border border-border-base overflow-hidden">
        <div className="p-4 border-b border-border-base flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Input
              isClearable
              className="w-full sm:max-w-xs"
              placeholder="Search by name or number..."
              startContent={<IoSearchOutline className="text-default-300" />}
              value={searchQuery}
              onClear={() => setSearchQuery("")}
              onValueChange={setSearchQuery}
            />
            <Select
              className="w-full sm:max-w-xs"
              defaultSelectedKeys={["all"]}
              placeholder="Filter by status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
              <SelectItem key="completed">Completed</SelectItem>
              <SelectItem key="no-answer">No Answer</SelectItem>
              <SelectItem key="wrong-no">Wrong Number</SelectItem>
              <SelectItem key="cancelled">Cancelled</SelectItem>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              isSelected={isGrouped}
              onValueChange={setIsGrouped}
              size="sm"
            >
              Group by Patient
            </Switch>
          </div>
        </div>

        {isGrouped ? (
          <div className="p-4 space-y-4">
            {groupedFollowups.length === 0 && !loading ? (
              <div className="text-center text-text-muted py-8">
                No follow-ups found
              </div>
            ) : (
              groupedFollowups.map((group) => {
                const key = group.patientMobile || group.patientName;
                const isExpanded = expandedPatients[key] ?? (groupedFollowups.length === 1);

                // Calculate status counts
                const pendingCount = group.items.filter(item => item.overallStatus === "pending").length;
                const completedCount = group.items.filter(item => item.overallStatus === "completed").length;

                // Find next upcoming follow-up date
                const nextDates = group.items
                  .map(item => item.nextFollowupDate ? new Date(item.nextFollowupDate) : null)
                  .filter((d): d is Date => d !== null);
                const nextFollowup = nextDates.length > 0
                  ? new Date(Math.min(...nextDates.map(d => d.getTime())))
                  : null;

                return (
                  <div
                    key={key}
                    className={`border rounded-xl overflow-hidden bg-surface shadow-sm transition-all duration-200 ${isExpanded
                      ? "border-l-4 border-l-primary border-y-border-base border-r-border-base"
                      : "border-l-4 border-l-transparent border-y-border-base border-r-border-base"
                      }`}
                  >
                    {/* Patient Header Section */}
                    <div
                      className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-surface-2 transition-colors select-none"
                      onClick={() => togglePatientExpand(key)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {group.patientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-medium text-text-primary text-[13px]">
                            {group.patientName}
                          </h3>
                          <p className="text-xs text-text-muted">
                            {group.patientMobile || "No Mobile"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {group.items.length} {group.items.length === 1 ? "Follow-up" : "Follow-ups"}
                          </span>

                          {pendingCount > 0 && (
                            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning uppercase">
                              {pendingCount} Pending
                            </span>
                          )}

                          {completedCount > 0 && (
                            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success uppercase">
                              {completedCount} Done
                            </span>
                          )}

                          {nextFollowup && (
                            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                              Next: {formatDate(nextFollowup)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <IoChevronDownOutline
                            className={`w-5 h-5 text-text-muted transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""
                              }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Patient Expanded Details Section */}
                    {isExpanded && (
                      <div className="border-t border-border-base bg-surface-1 p-3 overflow-x-auto">
                        <Table
                          isCompact
                          aria-label={`Follow-ups for ${group.patientName}`}
                          classNames={{
                            wrapper: "shadow-none p-0 rounded-none bg-transparent",
                            th: "bg-surface-2 text-text-muted font-bold text-[10px] px-2 whitespace-nowrap",
                            td: "border-b border-border-light text-[11px] px-2 py-2 bg-transparent",
                          }}
                        >
                          <TableHeader>
                            <TableColumn>DATE</TableColumn>
                            <TableColumn>SESSION</TableColumn>
                            <TableColumn>INIT STATUS</TableColumn>
                            <TableColumn>UPD. STATUS</TableColumn>
                            <TableColumn>NEXT FOLLOWUP</TableColumn>
                            <TableColumn>NOTES</TableColumn>
                            <TableColumn>
                              {categoryFilter === "pharmacy"
                                ? "MEDICINES"
                                : categoryFilter === "pathology"
                                  ? "LAB TESTS"
                                  : categoryFilter === "appointment"
                                    ? "SERVICES / MEDS"
                                    : "SERVICE/LABS/MEDS"}
                            </TableColumn>
                            <TableColumn align="end">ACTIONS</TableColumn>
                          </TableHeader>
                          <TableBody items={group.items}>
                            {(item) => (
                              <TableRow key={item.id}>
                                <TableCell>{formatDate(item.visitDate)}</TableCell>
                                <TableCell>
                                  <Select
                                    aria-label="Select session"
                                    className="min-w-[70px]"
                                    classNames={{
                                      trigger:
                                        "h-6 min-h-0 shadow-none border border-border-light bg-surface",
                                      value: "text-[11px]",
                                    }}
                                    selectedKeys={item.session ? [item.session] : []}
                                    size="sm"
                                    onChange={(e) =>
                                      handleInlineUpdate(item, "session", e.target.value)
                                    }
                                  >
                                    {["1st", "2nd", "3rd", "4th", "5th"].map((s) => (
                                      <SelectItem key={s}>{s}</SelectItem>
                                    ))}
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const currentSession = item.session || "1st";
                                    const initStatus =
                                      item.sessionStatuses?.[currentSession]?.initStatus ||
                                      (currentSession === "1st" ? item.initStatus : "good");

                                    return (
                                      <Select
                                        aria-label="Init Status"
                                        className="min-w-[100px]"
                                        classNames={{
                                          trigger: "h-6 min-h-0 shadow-none rounded-full",
                                          value: "text-[10px] font-bold uppercase",
                                        }}
                                        color={getStatusColor(initStatus) as any}
                                        selectedKeys={initStatus ? [initStatus] : []}
                                        size="sm"
                                        variant="flat"
                                        onChange={(e) =>
                                          handleInlineUpdate(
                                            item,
                                            "initStatus",
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <SelectItem key="good">GOOD</SelectItem>
                                        <SelectItem key="complain">COMPLAIN</SelectItem>
                                        <SelectItem key="neutral">NEUTRAL</SelectItem>
                                      </Select>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const currentSession = item.session || "1st";
                                    const updStatus =
                                      item.sessionStatuses?.[currentSession]?.updatedStatus ||
                                      (currentSession === "1st" ? item.updatedStatus : "");

                                    return (
                                      <div className="relative flex items-center">
                                        <Select
                                          aria-label="Updated Status"
                                          className="min-w-[110px]"
                                          classNames={{
                                            trigger: "h-6 min-h-0 shadow-none rounded-full",
                                            value: "text-[10px] font-bold uppercase",
                                          }}
                                          color={
                                            updStatus
                                              ? (getStatusColor(updStatus) as any)
                                              : "default"
                                          }
                                          placeholder="Select"
                                          selectedKeys={updStatus ? [updStatus] : []}
                                          size="sm"
                                          variant="flat"
                                          onChange={(e) =>
                                            handleInlineUpdate(
                                              item,
                                              "updatedStatus",
                                              e.target.value,
                                            )
                                          }
                                        >
                                          <SelectItem key="good">GOOD</SelectItem>
                                          <SelectItem key="solved">SOLVED</SelectItem>
                                          <SelectItem key="wrong-no">WRONG NO.</SelectItem>
                                          <SelectItem key="no-answer">NO ANSWER</SelectItem>
                                          <SelectItem key="neutral">NEUTRAL</SelectItem>
                                        </Select>
                                        {item.logs && item.logs.length > 0 && (
                                          <Tooltip
                                            className="bg-surface border border-border-light shadow-lg"
                                            content={
                                              <div className="px-1 py-2 max-w-[250px]">
                                                <div className="text-[11px] font-bold mb-2 uppercase tracking-wider text-primary">
                                                  Action History
                                                </div>
                                                <div className="space-y-2">
                                                  {item.logs.map((log: any, idx: number) => (
                                                    <div
                                                      key={idx}
                                                      className="text-[10px] leading-tight flex gap-2"
                                                    >
                                                      <span className="text-text-muted whitespace-nowrap">
                                                        {new Date(
                                                          log.date,
                                                        ).toLocaleDateString()}
                                                      </span>
                                                      <span className="text-text-main font-medium">
                                                        {log.note}
                                                      </span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            }
                                            placement="top"
                                          >
                                            <div className="absolute right-[-8px] top-[-8px] cursor-help bg-primary text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] font-bold shadow-sm">
                                              i
                                            </div>
                                          </Tooltip>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium text-[11px] text-primary">
                                      {formatDate(item.nextFollowupDate)}
                                    </span>
                                    {item.followedBy && (
                                      <span className="text-[9px] text-text-muted">
                                        By: {item.followedBy}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[150px] max-h-[60px] overflow-y-auto pr-1">
                                    {item.noteHistory && item.noteHistory.length > 0 ? (
                                      <ol className="list-decimal list-inside text-[10px] text-text-main space-y-0.5">
                                        {item.noteHistory.map((n: any, idx: number) => (
                                          <li key={idx} className="truncate" title={n.note}>
                                            {n.note}
                                          </li>
                                        ))}
                                      </ol>
                                    ) : (
                                      <span className="text-[10px] text-text-muted">-</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[150px] max-h-[60px] overflow-y-auto">
                                    {renderServiceProduct(item, categoryFilter)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      color="primary"
                                      size="sm"
                                      variant="flat"
                                      onClick={() => handleEdit(item)}
                                    >
                                      Update
                                    </Button>
                                    <Button
                                      isIconOnly
                                      color="danger"
                                      size="sm"
                                      variant="light"
                                      onClick={() => handleDelete(item.id)}
                                    >
                                      <IoTrashOutline size={16} />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              isCompact
              aria-label="Follow-ups table"
              bottomContent={
                filteredFollowups.length === 0 && !loading ? (
                  <div className="text-center text-text-muted py-8">
                    No follow-ups found
                  </div>
                ) : null
              }
              classNames={{
                wrapper: "min-h-[400px] shadow-none p-0 rounded-none",
                th: "bg-surface-2 text-text-muted font-bold text-[10px] px-2 whitespace-nowrap",
                td: "border-b border-border-light text-[11px] px-2 py-2",
              }}
            >
              <TableHeader>
                <TableColumn>PATIENT</TableColumn>
                <TableColumn>DATE</TableColumn>
                <TableColumn>SESSION</TableColumn>
                <TableColumn>INIT STATUS</TableColumn>
                <TableColumn>UPD. STATUS</TableColumn>
                <TableColumn>NEXT FOLLOWUP</TableColumn>
                <TableColumn>NOTES</TableColumn>
                <TableColumn>
                  {categoryFilter === "pharmacy"
                    ? "MEDICINES"
                    : categoryFilter === "pathology"
                      ? "LAB TESTS"
                      : categoryFilter === "appointment"
                        ? "SERVICES / MEDS"
                        : "SERVICE/LABS/MEDS"}
                </TableColumn>
                <TableColumn align="end">ACTIONS</TableColumn>
              </TableHeader>
              <TableBody isLoading={loading} items={filteredFollowups}>
                {(item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-text-primary whitespace-nowrap">
                          {item.patientName}
                        </p>
                        <p className="text-xs text-text-muted">
                          {item.patientMobile}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.visitDate)}</TableCell>
                    <TableCell>
                      <Select
                        aria-label="Select session"
                        className="min-w-[70px]"
                        classNames={{
                          trigger:
                            "h-6 min-h-0 shadow-none border border-border-light bg-surface",
                          value: "text-[11px]",
                        }}
                        selectedKeys={item.session ? [item.session] : []}
                        size="sm"
                        onChange={(e) =>
                          handleInlineUpdate(item, "session", e.target.value)
                        }
                      >
                        {["1st", "2nd", "3rd", "4th", "5th"].map((s) => (
                          <SelectItem key={s}>{s}</SelectItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const currentSession = item.session || "1st";
                        const initStatus =
                          item.sessionStatuses?.[currentSession]?.initStatus ||
                          (currentSession === "1st" ? item.initStatus : "good");

                        return (
                          <Select
                            aria-label="Init Status"
                            className="min-w-[100px]"
                            classNames={{
                              trigger: "h-6 min-h-0 shadow-none rounded-full",
                              value: "text-[10px] font-bold uppercase",
                            }}
                            color={getStatusColor(initStatus) as any}
                            selectedKeys={initStatus ? [initStatus] : []}
                            size="sm"
                            variant="flat"
                            onChange={(e) =>
                              handleInlineUpdate(
                                item,
                                "initStatus",
                                e.target.value,
                              )
                            }
                          >
                            <SelectItem key="good">GOOD</SelectItem>
                            <SelectItem key="complain">COMPLAIN</SelectItem>
                            <SelectItem key="neutral">NEUTRAL</SelectItem>
                          </Select>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const currentSession = item.session || "1st";
                        const updStatus =
                          item.sessionStatuses?.[currentSession]?.updatedStatus ||
                          (currentSession === "1st" ? item.updatedStatus : "");

                        return (
                          <div className="relative flex items-center">
                            <Select
                              aria-label="Updated Status"
                              className="min-w-[110px]"
                              classNames={{
                                trigger: "h-6 min-h-0 shadow-none rounded-full",
                                value: "text-[10px] font-bold uppercase",
                              }}
                              color={
                                updStatus
                                  ? (getStatusColor(updStatus) as any)
                                  : "default"
                              }
                              placeholder="Select"
                              selectedKeys={updStatus ? [updStatus] : []}
                              size="sm"
                              variant="flat"
                              onChange={(e) =>
                                handleInlineUpdate(
                                  item,
                                  "updatedStatus",
                                  e.target.value,
                                )
                              }
                            >
                              <SelectItem key="good">GOOD</SelectItem>
                              <SelectItem key="solved">SOLVED</SelectItem>
                              <SelectItem key="wrong-no">WRONG NO.</SelectItem>
                              <SelectItem key="no-answer">NO ANSWER</SelectItem>
                              <SelectItem key="neutral">NEUTRAL</SelectItem>
                            </Select>
                            {item.logs && item.logs.length > 0 && (
                              <Tooltip
                                className="bg-surface border border-border-light shadow-lg"
                                content={
                                  <div className="px-1 py-2 max-w-[250px]">
                                    <div className="text-[11px] font-bold mb-2 uppercase tracking-wider text-primary">
                                      Action History
                                    </div>
                                    <div className="space-y-2">
                                      {item.logs.map((log: any, idx: number) => (
                                        <div
                                          key={idx}
                                          className="text-[10px] leading-tight flex gap-2"
                                        >
                                          <span className="text-text-muted whitespace-nowrap">
                                            {new Date(
                                              log.date,
                                            ).toLocaleDateString()}
                                          </span>
                                          <span className="text-text-main font-medium">
                                            {log.note}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                }
                                placement="top"
                              >
                                <div className="absolute right-[-8px] top-[-8px] cursor-help bg-primary text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] font-bold shadow-sm">
                                  i
                                </div>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-[11px] text-primary">
                          {formatDate(item.nextFollowupDate)}
                        </span>
                        {item.followedBy && (
                          <span className="text-[9px] text-text-muted">
                            By: {item.followedBy}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] max-h-[60px] overflow-y-auto pr-1">
                        {item.noteHistory && item.noteHistory.length > 0 ? (
                          <ol className="list-decimal list-inside text-[10px] text-text-main space-y-0.5">
                            {item.noteHistory.map((n: any, idx: number) => (
                              <li key={idx} className="truncate" title={n.note}>
                                {n.note}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <span className="text-[10px] text-text-muted">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] max-h-[60px] overflow-y-auto">
                        {renderServiceProduct(item, categoryFilter)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          color="primary"
                          size="sm"
                          variant="flat"
                          onClick={() => handleEdit(item)}
                        >
                          Update
                        </Button>
                        <Button
                          isIconOnly
                          color="danger"
                          size="sm"
                          variant="light"
                          onClick={() => handleDelete(item.id)}
                        >
                          <IoTrashOutline size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <FollowupModal
        allowedCategories={allowedCategories}
        defaultCategory={
          categoryFilter === "all"
            ? allowedCategories[0] === "all" && allowedCategories.length > 1
              ? allowedCategories[1]
              : allowedCategories[0] === "all"
                ? "general"
                : allowedCategories[0]
            : categoryFilter
        }
        followup={selectedFollowup}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onSaved={handleSaved}
      />
    </div>
  );
}
