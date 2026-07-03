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
  Chip,
  Select,
  SelectItem,
  useDisclosure,
  Tooltip,
} from "@heroui/react";
import { IoSearchOutline, IoAddOutline, IoTrashOutline } from "react-icons/io5";
import { format } from "date-fns";
import toast from "react-hot-toast";

import { useAuthContext } from "@/context/AuthContext";
import { followupService } from "@/services/followupService";
import type { PatientFollowup } from "@/types/models";
import FollowupModal from "./FollowupModal";

export default function FollowupsPage() {
  const { currentUser, clinicId, branchId } = useAuthContext();
  const [followups, setFollowups] = useState<PatientFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedFollowup, setSelectedFollowup] = useState<PatientFollowup | null>(null);

  useEffect(() => {
    loadFollowups();
  }, [clinicId, branchId]);

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

      return matchesSearch && matchesStatus;
    });
  }, [followups, searchQuery, statusFilter]);

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

  const handleInlineUpdate = async (item: PatientFollowup, field: "session" | "initStatus" | "updatedStatus", value: string) => {
    const currentSession = item.session || "1st";
    const sessionToUse = field === "session" ? value : currentSession;
    
    let currentValue;
    if (field === "session") {
      currentValue = item.session;
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

    if (field !== "session") {
       if (!newSessionStatuses[sessionToUse]) newSessionStatuses[sessionToUse] = {};
       newSessionStatuses[sessionToUse] = { ...newSessionStatuses[sessionToUse], [field]: value };
       payload.sessionStatuses = newSessionStatuses;
    }

    // Auto-generate log for status/session change
    const newLog = {
      date: new Date(),
      note: `${field === "session" ? "Session" : field === "initStatus" ? "Initial Status" : "Updated Status"} changed to '${value}'`,
      user: currentUser?.displayName || "Staff"
    };
    payload.logs = [...(item.logs || []), newLog];

    // Optimistic update
    setFollowups(prev => prev.map(f => f.id === item.id ? { ...f, ...payload, logs: payload.logs } : f));
    
    try {
      await followupService.updateFollowup(item.id, payload);
    } catch (err) {
      console.error("Failed inline update", err);
      toast.error("Failed to update status");
      loadFollowups(); // revert on fail
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this follow-up record? This action cannot be undone.")) {
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

      <div className="bg-surface-1 rounded-xl shadow-sm border border-border-base overflow-hidden">
        <div className="p-4 border-b border-border-base flex flex-col sm:flex-row gap-4">
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

        <div className="overflow-x-auto">
          <Table
            aria-label="Follow-ups table"
            isCompact
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
              <TableColumn>1ST FU</TableColumn>
              <TableColumn>2ND FU</TableColumn>
              <TableColumn>3RD FU</TableColumn>
              <TableColumn>4TH FU</TableColumn>
              <TableColumn>5TH FU</TableColumn>
              <TableColumn>SERVICE/LABS/MEDS</TableColumn>
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
                      size="sm"
                      aria-label="Select session"
                      selectedKeys={item.session ? [item.session] : []}
                      className="min-w-[70px]"
                      classNames={{ trigger: "h-6 min-h-0 shadow-none border border-border-light bg-surface", value: "text-[11px]" }}
                      onChange={(e) => handleInlineUpdate(item, "session", e.target.value)}
                    >
                      {["1st", "2nd", "3rd", "4th", "5th"].map(s => <SelectItem key={s}>{s}</SelectItem>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const currentSession = item.session || "1st";
                      const initStatus = item.sessionStatuses?.[currentSession]?.initStatus || (currentSession === "1st" ? item.initStatus : "good");
                      return (
                        <Select
                          size="sm"
                          aria-label="Init Status"
                          color={getStatusColor(initStatus) as any}
                          variant="flat"
                          className="min-w-[100px]"
                          selectedKeys={initStatus ? [initStatus] : []}
                          classNames={{ trigger: "h-6 min-h-0 shadow-none rounded-full", value: "text-[10px] font-bold uppercase" }}
                          onChange={(e) => handleInlineUpdate(item, "initStatus", e.target.value)}
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
                      const updStatus = item.sessionStatuses?.[currentSession]?.updatedStatus || (currentSession === "1st" ? item.updatedStatus : "");
                      return (
                        <div className="relative flex items-center">
                          <Select
                            size="sm"
                            aria-label="Updated Status"
                            placeholder="Select"
                            className="min-w-[110px]"
                            color={updStatus ? getStatusColor(updStatus) as any : "default"}
                            variant="flat"
                            selectedKeys={updStatus ? [updStatus] : []}
                            classNames={{ trigger: "h-6 min-h-0 shadow-none rounded-full", value: "text-[10px] font-bold uppercase" }}
                            onChange={(e) => handleInlineUpdate(item, "updatedStatus", e.target.value)}
                          >
                        <SelectItem key="good">GOOD</SelectItem>
                        <SelectItem key="solved">SOLVED</SelectItem>
                        <SelectItem key="wrong-no">WRONG NO.</SelectItem>
                        <SelectItem key="no-answer">NO ANSWER</SelectItem>
                        <SelectItem key="neutral">NEUTRAL</SelectItem>
                      </Select>
                      {item.logs && item.logs.length > 0 && (
                        <Tooltip
                          content={
                            <div className="px-1 py-2 max-w-[250px]">
                              <div className="text-[11px] font-bold mb-2 uppercase tracking-wider text-primary">Action History</div>
                              <div className="space-y-2">
                                {item.logs.map((log: any, idx: number) => (
                                  <div key={idx} className="text-[10px] leading-tight flex gap-2">
                                    <span className="text-text-muted whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</span>
                                    <span className="text-text-main font-medium">{log.note}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          }
                          placement="top"
                          className="bg-surface border border-border-light shadow-lg"
                        >
                          <div className="absolute right-[-8px] top-[-8px] cursor-help bg-primary text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] font-bold shadow-sm">i</div>
                        </Tooltip>
                      )}
                    </div>
                  );
                })()}
              </TableCell>
                  <TableCell>{formatDate(item.followupDates.first)}</TableCell>
                  <TableCell>{formatDate(item.followupDates.second)}</TableCell>
                  <TableCell>{formatDate(item.followupDates.third)}</TableCell>
                  <TableCell>{formatDate(item.followupDates.fourth)}</TableCell>
                  <TableCell>{formatDate(item.followupDates.fifth)}</TableCell>
                  <TableCell>
                    <div className="max-w-[150px]">
                      {item.service && (
                        <p className="text-[10px] font-medium text-text-primary truncate" title={item.service}>
                          S: {item.service}
                        </p>
                      )}
                      {item.product && (
                        <p className="text-[10px] text-text-muted truncate" title={item.product}>
                          P: {item.product}
                        </p>
                      )}
                      {!item.service && !item.product && "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onClick={() => handleEdit(item)}
                      >
                        Update
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
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
      </div>

      <FollowupModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        followup={selectedFollowup}
        onSaved={handleSaved}
      />
    </div>
  );
}
