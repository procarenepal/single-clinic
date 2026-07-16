import type {
  PatientFollowup,
  Patient,
  FollowupInitStatus,
  FollowupUpdatedStatus,
  FollowupStatus,
  User,
} from "@/types/models";

import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
} from "@heroui/react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import toast from "react-hot-toast";

import { useAuthContext } from "@/context/AuthContext";
import { followupService } from "@/services/followupService";
import { patientService } from "@/services/patientService";
import { prescriptionService } from "@/services/prescriptionService";
import { userService } from "@/services/userService";

interface FollowupModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  followup: PatientFollowup | null;
  allowedCategories?: string[];
  defaultCategory?: string;
  onSaved: () => void;
}

export default function FollowupModal({
  isOpen,
  onOpenChange,
  followup,
  allowedCategories = ["all", "appointment", "pharmacy", "pathology", "general"],
  defaultCategory = "general",
  onSaved,
}: FollowupModalProps) {
  const { clinicId, branchId, currentUser } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientHistory, setPatientHistory] = useState<any>(null);
  const [activeFollowupId, setActiveFollowupId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (isOpen && clinicId) {
      patientService.getPatientsByClinic(clinicId).then(setPatients);
      userService.getClinicUsers(clinicId).then(setUsers);
      setPatientHistory(null);
    }
  }, [isOpen, clinicId]);

  const [formData, setFormData] = useState({
    patientId: "",
    patientName: "",
    patientMobile: "",
    visitDate: "",
    session: "",
    category: "general" as "general" | "appointment" | "pharmacy" | "pathology",
    initStatus: "good",
    updatedStatus: "",
    firstDate: "",
    secondDate: "",
    thirdDate: "",
    fourthDate: "",
    fifthDate: "",
    service: "",
    product: "",
    notes: "",
    overallStatus: "pending",
    logs: [] as any[],
    sessionStatuses: {} as Record<string, any>,
    nextFollowupDate: "",
    followedBy: "",
    noteHistory: [] as any[],
    newNote: "",
  });

  const filteredPatients = React.useMemo(() => {
    const query = (formData?.patientName || "").toLowerCase();

    return patients.filter((p: any) => {
      const name = (p.fullName || p.name || "").toLowerCase();
      const phone = p.mobile || p.phone || "";

      return name.includes(query) || phone.includes(query);
    });
  }, [patients, formData?.patientName]);

  useEffect(() => {
    if (isOpen) {
      if (followup) {
        setFormData({
          patientId: followup.patientId || "",
          patientName: followup.patientName || "",
          patientMobile: followup.patientMobile || "",
          category: followup.category || "general",
          visitDate: followup.visitDate
            ? new Date(followup.visitDate).toISOString().split("T")[0]
            : "",
          session: followup.session || "",
          initStatus:
            followup.sessionStatuses?.[followup.session || "1st"]?.initStatus ||
            (followup.session && followup.session !== "1st"
              ? "good"
              : followup.initStatus) ||
            "good",
          updatedStatus:
            followup.sessionStatuses?.[followup.session || "1st"]
              ?.updatedStatus ||
            (followup.session && followup.session !== "1st"
              ? ""
              : followup.updatedStatus) ||
            "",
          sessionStatuses: followup.sessionStatuses || {},
          firstDate: followup.followupDates?.first
            ? new Date(followup.followupDates.first).toISOString().split("T")[0]
            : "",
          secondDate: followup.followupDates?.second
            ? new Date(followup.followupDates.second)
              .toISOString()
              .split("T")[0]
            : "",
          thirdDate: followup.followupDates?.third
            ? new Date(followup.followupDates.third).toISOString().split("T")[0]
            : "",
          fourthDate: followup.followupDates?.fourth
            ? new Date(followup.followupDates.fourth)
              .toISOString()
              .split("T")[0]
            : "",
          fifthDate: followup.followupDates?.fifth
            ? new Date(followup.followupDates.fifth).toISOString().split("T")[0]
            : "",
          service: followup.service || "",
          product: followup.product || "",
          notes: followup.notes || "",
          overallStatus: followup.overallStatus || "pending",
          logs: followup.logs || [],
          nextFollowupDate: followup.nextFollowupDate
            ? new Date(followup.nextFollowupDate).toISOString().split("T")[0]
            : "",
          followedBy: followup.followedBy || currentUser?.displayName || "",
          noteHistory: followup.noteHistory || [],
          newNote: "",
        });
      } else {
        setActiveFollowupId(null);
        setFormData({
          patientId: "",
          patientName: "",
          patientMobile: "",
          category: (defaultCategory as any) || "general",
          visitDate: new Date().toISOString().split("T")[0],
          session: "1st",
          initStatus: "good",
          updatedStatus: "",
          firstDate: "",
          secondDate: "",
          thirdDate: "",
          fourthDate: "",
          fifthDate: "",
          service: "",
          product: "",
          notes: "",
          overallStatus: "pending",
          logs: [],
          sessionStatuses: {},
          nextFollowupDate: "",
          followedBy: currentUser?.displayName || "",
          noteHistory: [],
          newNote: "",
        });
        setPatientHistory(null);
      }
    }
  }, [isOpen, followup]);

  useEffect(() => {
    if (
      isOpen &&
      followup?.patientId &&
      patients.length > 0 &&
      !patientHistory
    ) {
      const pt = patients.find((p) => p.id === followup.patientId);

      if (pt) {
        const fetchHistory = async () => {
          try {
            const prescriptions =
              await prescriptionService.getPrescriptionsByPatient(pt.id);
            let latest: any = null;
            let items: any[] = [];

            if (prescriptions && prescriptions.length > 0) {
              prescriptions.sort(
                (a: any, b: any) =>
                  (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
              );
              latest = prescriptions[0];
              items = await prescriptionService.getPrescriptionItems(latest.id);
            }

            setPatientHistory({
              age: pt.age || "N/A",
              gender: pt.gender
                ? pt.gender.charAt(0).toUpperCase() + pt.gender.slice(1)
                : "N/A",
              diagnosis: latest?.diagnosis || latest?.treatmentPlan || "N/A",
              date: latest?.prescriptionDate
                ? new Date(latest.prescriptionDate).toLocaleDateString()
                : "No past visits",
              medicines: items.map((i: any) => i.medicineName).filter(Boolean),
              labTests:
                latest?.pathologyTests
                  ?.map((t: any) => t.testName)
                  .filter(Boolean) || [],
            });
          } catch (err) {
            console.error("Failed to load patient history in edit mode:", err);
          }
        };

        fetchHistory();
      }
    }
  }, [isOpen, followup, patients]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "session") {
        const sessionToUse = value || "1st";

        next.initStatus =
          prev.sessionStatuses?.[sessionToUse]?.initStatus ||
          (sessionToUse === "1st" ? prev.initStatus : "good");
        next.updatedStatus =
          prev.sessionStatuses?.[sessionToUse]?.updatedStatus ||
          (sessionToUse === "1st" ? prev.updatedStatus : "");
      }

      if (field === "initStatus" || field === "updatedStatus") {
        const currentSession = prev.session || "1st";
        const newSessionStatuses = { ...prev.sessionStatuses };

        if (!newSessionStatuses[currentSession])
          newSessionStatuses[currentSession] = {};
        newSessionStatuses[currentSession] = {
          ...newSessionStatuses[currentSession],
          [field]: value,
        };
        next.sessionStatuses = newSessionStatuses;
      }

      // Auto-update session based on latest date filled
      if (
        [
          "firstDate",
          "secondDate",
          "thirdDate",
          "fourthDate",
          "fifthDate",
        ].includes(field)
      ) {
        if (next.fifthDate) next.session = "5th";
        else if (next.fourthDate) next.session = "4th";
        else if (next.thirdDate) next.session = "3rd";
        else if (next.secondDate) next.session = "2nd";
        else if (next.firstDate) next.session = "1st";
      }

      return next;
    });
  };

  const parseDate = (d: string) => (d ? new Date(d) : undefined);

  const handleSave = async () => {
    if (!formData.patientName) {
      toast.error("Patient Name is required");

      return;
    }

    setLoading(true);
    try {
      let finalNoteHistory = [...formData.noteHistory];

      if (formData.newNote.trim()) {
        finalNoteHistory.push({
          date: new Date(),
          note: formData.newNote.trim(),
          user: currentUser?.displayName || "Staff",
        });
      }

      const payload: Omit<PatientFollowup, "id" | "createdAt" | "updatedAt"> = {
        clinicId: clinicId || "",
        branchId: branchId || "",
        patientId:
          followup?.patientId || formData.patientId || `walkin_${Date.now()}`,
        patientName: formData.patientName,
        patientMobile: formData.patientMobile,
        category: formData.category,
        visitDate: parseDate(formData.visitDate),
        session: formData.session,
        initStatus: formData.initStatus as FollowupInitStatus,
        updatedStatus: formData.updatedStatus as FollowupUpdatedStatus,
        sessionStatuses: formData.sessionStatuses,
        followupDates: {
          first: parseDate(formData.firstDate),
          second: parseDate(formData.secondDate),
          third: parseDate(formData.thirdDate),
          fourth: parseDate(formData.fourthDate),
          fifth: parseDate(formData.fifthDate),
        },
        service: formData.service,
        product: formData.product,
        notes: formData.notes,
        overallStatus: formData.overallStatus as FollowupStatus,
        createdBy: followup?.createdBy || currentUser?.uid || "",
        nextFollowupDate: parseDate(formData.nextFollowupDate),
        followedBy: formData.followedBy,
        noteHistory: finalNoteHistory,
      };

      if (followup || activeFollowupId) {
        const idToUpdate = followup
          ? followup.id
          : (activeFollowupId as string);

        // Auto-generate log if status or session changed
        let newLog = null;

        if (followup) {
          if (formData.updatedStatus !== followup.updatedStatus) {
            newLog = {
              date: new Date(),
              note: `Status changed to '${formData.updatedStatus || "None"}'`,
              user: currentUser?.displayName || "Staff",
            };
          } else if (formData.session !== followup.session) {
            newLog = {
              date: new Date(),
              note: `Session updated to '${formData.session}'`,
              user: currentUser?.displayName || "Staff",
            };
          }
        }

        if (newLog) {
          payload.logs = [...(followup?.logs || []), newLog];
        }

        await followupService.updateFollowup(idToUpdate, payload);
        toast.success("Follow-up updated successfully");
      } else {
        payload.createdBy = currentUser?.uid || "system";
        await followupService.createFollowup(payload);
        toast.success("Follow-up created successfully");
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving followup:", error);
      toast.error("Failed to save follow-up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
        header: "border-b border-[rgb(var(--color-border))] py-4",
        footer: "border-t border-[rgb(var(--color-border))] py-3",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="5xl"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>
              <div>
                <h2 className="text-[16px] font-bold text-primary">
                  {followup ? "Edit Follow-up" : "Add New Follow-up"}
                </h2>
                <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium">
                  Track and manage patient follow-ups and treatment schedules.
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-[rgb(var(--color-border))] pb-2">
                    Patient & Visit Info
                  </h3>
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Patient Name <span className="text-danger">*</span>
                    </label>
                    <Autocomplete
                      allowsCustomValue
                      inputValue={formData.patientName}
                      items={filteredPatients}
                      placeholder="Search or enter patient name"
                      selectedKey={formData.patientId || null}
                      size="sm"
                      onInputChange={(val) => handleChange("patientName", val)}
                      onSelectionChange={async (key) => {
                        if (!key) {
                          handleChange("patientId", "");
                          handleChange("patientName", "");
                          setPatientHistory(null);

                          return;
                        }
                        const pt = patients.find((p) => p.id === key);

                        if (pt) {
                          handleChange("patientId", pt.id);
                          handleChange(
                            "patientName",
                            (pt as any).fullName || (pt as any).name || "",
                          );
                          const mobileToUse =
                            (pt as any).mobile || (pt as any).phone || "";

                          if (mobileToUse)
                            handleChange("patientMobile", mobileToUse);

                          try {
                            // Check if they already have an active follow-up
                            if (!followup) {
                              const fList =
                                await followupService.getPatientFollowups(
                                  pt.id,
                                );
                              const existing = fList.find(
                                (f: any) => f.overallStatus === "pending",
                              );

                              if (existing) {
                                setActiveFollowupId(existing.id);
                                const safeDateStr = (d: any) =>
                                  d
                                    ? new Date(d).toISOString().split("T")[0]
                                    : "";

                                setFormData((prev) => ({
                                  ...prev,
                                  visitDate: existing.visitDate
                                    ? new Date(existing.visitDate)
                                      .toISOString()
                                      .split("T")[0]
                                    : prev.visitDate,
                                  session: existing.session || prev.session,
                                  initStatus:
                                    existing.initStatus || prev.initStatus,
                                  updatedStatus:
                                    existing.updatedStatus ||
                                    prev.updatedStatus,
                                  firstDate: safeDateStr(
                                    existing.followupDates?.first,
                                  ),
                                  secondDate: safeDateStr(
                                    existing.followupDates?.second,
                                  ),
                                  thirdDate: safeDateStr(
                                    existing.followupDates?.third,
                                  ),
                                  fourthDate: safeDateStr(
                                    existing.followupDates?.fourth,
                                  ),
                                  fifthDate: safeDateStr(
                                    existing.followupDates?.fifth,
                                  ),
                                  service: existing.service || prev.service,
                                  product: existing.product || prev.product,
                                  notes: existing.notes || prev.notes,
                                  overallStatus:
                                    existing.overallStatus || "pending",
                                  logs: existing.logs || [],
                                }));
                                toast.success(
                                  "Loaded existing active follow-up. You can now add the next follow-up date.",
                                );
                              } else {
                                setActiveFollowupId(null);
                              }
                            }

                            const prescriptions =
                              await prescriptionService.getPrescriptionsByPatient(
                                pt.id,
                              );
                            let latest: any = null;
                            let items: any[] = [];

                            if (prescriptions && prescriptions.length > 0) {
                              prescriptions.sort(
                                (a: any, b: any) =>
                                  (b.createdAt?.getTime() || 0) -
                                  (a.createdAt?.getTime() || 0),
                              );
                              latest = prescriptions[0];
                              items =
                                await prescriptionService.getPrescriptionItems(
                                  latest.id,
                                );
                            }

                            setPatientHistory({
                              age: pt.age || "N/A",
                              gender: pt.gender
                                ? pt.gender.charAt(0).toUpperCase() +
                                pt.gender.slice(1)
                                : "N/A",
                              diagnosis:
                                latest?.diagnosis ||
                                latest?.treatmentPlan ||
                                "N/A",
                              date: latest?.prescriptionDate
                                ? new Date(
                                  latest.prescriptionDate,
                                ).toLocaleDateString()
                                : "No past visits",
                              medicines: items
                                .map((i: any) => i.medicineName)
                                .filter(Boolean),
                              labTests:
                                latest?.pathologyTests
                                  ?.map((t: any) => t.testName)
                                  .filter(Boolean) || [],
                            });

                            // Auto-fill treatment details if empty and no existing followup loaded
                            if (latest && !activeFollowupId) {
                              const labText = latest.pathologyTests
                                ?.map((t: any) => t.testName)
                                .filter(Boolean)
                                .join(", ");
                              const procText = latest.treatmentPlan;
                              const diagText = latest.diagnosis;

                              const combinedService = [
                                diagText,
                                procText,
                                labText ? `Labs: ${labText}` : null,
                              ]
                                .filter(Boolean)
                                .join(" | ");

                              setFormData((prev) => ({
                                ...prev,
                                service: prev.service || combinedService || "",
                                product:
                                  prev.product ||
                                  (items.length > 0
                                    ? items
                                      .map((i: any) => i.medicineName)
                                      .join(", ")
                                    : ""),
                              }));
                            }
                          } catch (err) {
                            console.error(
                              "Failed to fetch prescription/followup details",
                              err,
                            );
                            setPatientHistory({
                              age: pt.age || "N/A",
                              gender: pt.gender || "N/A",
                              date: "No past visits",
                              diagnosis: "N/A",
                              medicines: [],
                              labTests: [],
                            });
                          }
                        }
                      }}
                    >
                      {(p: any) => (
                        <AutocompleteItem
                          key={p.id}
                          textValue={p.fullName || p.name || "Unknown"}
                        >
                          <div className="flex justify-between items-center">
                            <span>{p.fullName || p.name}</span>
                            <span className="text-xs text-default-400">
                              {p.mobile || p.phone} {p.age ? `• ${p.age}` : ""}
                            </span>
                          </div>
                        </AutocompleteItem>
                      )}
                    </Autocomplete>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Mobile Number
                    </label>
                    <Input
                      placeholder="Enter number"
                      size="sm"
                      value={formData.patientMobile}
                      onChange={(e) =>
                        handleChange("patientMobile", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex gap-4">
                    {/* Category Selection */}
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Category
                      </label>
                      <Select
                        selectedKeys={[formData.category]}
                        size="sm"
                        onChange={(e) =>
                          handleChange("category", e.target.value)
                        }
                      >
                        {(allowedCategories.includes("all") || allowedCategories.includes("general")) ? <SelectItem key="general">General</SelectItem> : <></>}
                        {(allowedCategories.includes("all") || allowedCategories.includes("appointment")) ? <SelectItem key="appointment">Appointment</SelectItem> : <></>}
                        {(allowedCategories.includes("all") || allowedCategories.includes("pharmacy")) ? <SelectItem key="pharmacy">Pharmacy</SelectItem> : <></>}
                        {(allowedCategories.includes("all") || allowedCategories.includes("pathology")) ? <SelectItem key="pathology">Pathology</SelectItem> : <></>}
                      </Select>
                    </div>
                    <div className="w-1/3">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Visit Date
                      </label>
                      <Input
                        size="sm"
                        type="date"
                        value={formData.visitDate}
                        onChange={(e) =>
                          handleChange("visitDate", e.target.value)
                        }
                      />
                    </div>
                    <div className="w-1/3">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Session
                      </label>
                      <Input
                        placeholder="e.g. 1st, 2nd"
                        size="sm"
                        value={formData.session}
                        onChange={(e) =>
                          handleChange("session", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  {patientHistory && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-[10px] border border-primary/10">
                      <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
                        Patient Overview & History
                      </h4>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-[12px] text-[rgb(var(--color-text-muted))]">
                            Age / Gender:
                          </span>
                          <span className="text-[12px] font-medium text-text-main">
                            {patientHistory.age} / {patientHistory.gender}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[12px] text-[rgb(var(--color-text-muted))]">
                            Last Visit Date:
                          </span>
                          <span className="text-[12px] font-medium text-text-main">
                            {patientHistory.date}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[12px] text-[rgb(var(--color-text-muted))]">
                            Service/Diagnosis:
                          </span>
                          <span className="text-[12px] font-medium text-text-main text-right">
                            {patientHistory.diagnosis}
                          </span>
                        </div>

                        {patientHistory.medicines &&
                          patientHistory.medicines.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[11px] text-[rgb(var(--color-text-muted))] block mb-1">
                                Medicines:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {patientHistory.medicines.map(
                                  (med: string, idx: number) => (
                                    <Chip
                                      key={idx}
                                      className="text-[10px] h-5 px-1"
                                      color="primary"
                                      size="sm"
                                      variant="flat"
                                    >
                                      {med}
                                    </Chip>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {patientHistory.labTests &&
                          patientHistory.labTests.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[11px] text-[rgb(var(--color-text-muted))] block mb-1">
                                Lab Tests:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {patientHistory.labTests.map(
                                  (test: string, idx: number) => (
                                    <Chip
                                      key={`lab_${idx}`}
                                      className="text-[10px] h-5 px-1"
                                      color="secondary"
                                      size="sm"
                                      variant="flat"
                                    >
                                      {test}
                                    </Chip>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-[rgb(var(--color-border))] pb-2 mt-6">
                    Status & Tracking
                  </h3>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Initial Status
                      </label>
                      <Select
                        selectedKeys={[formData.initStatus]}
                        size="sm"
                        onChange={(e) =>
                          handleChange("initStatus", e.target.value)
                        }
                      >
                        <SelectItem key="good">Good</SelectItem>
                        <SelectItem key="complain">Complain</SelectItem>
                        <SelectItem key="neutral">Neutral</SelectItem>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Updated Status
                      </label>
                      <Select
                        placeholder="Select status"
                        selectedKeys={
                          formData.updatedStatus ? [formData.updatedStatus] : []
                        }
                        size="sm"
                        onChange={(e) =>
                          handleChange("updatedStatus", e.target.value)
                        }
                      >
                        <SelectItem key="good">Good</SelectItem>
                        <SelectItem key="solved">Solved</SelectItem>
                        <SelectItem key="wrong-no">Wrong No.</SelectItem>
                        <SelectItem key="no-answer">No Answer</SelectItem>
                        <SelectItem key="neutral">Neutral</SelectItem>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Overall Status
                    </label>
                    <Select
                      selectedKeys={[formData.overallStatus]}
                      size="sm"
                      onChange={(e) =>
                        handleChange("overallStatus", e.target.value)
                      }
                    >
                      <SelectItem key="pending">Pending</SelectItem>
                      <SelectItem key="completed">Completed</SelectItem>
                      <SelectItem key="no-answer">No Answer</SelectItem>
                      <SelectItem key="wrong-no">Wrong Number</SelectItem>
                      <SelectItem key="cancelled">Cancelled</SelectItem>
                    </Select>
                  </div>
                  <div className="mt-4">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Followed By
                    </label>
                    <Select
                      placeholder="Select staff"
                      selectedKeys={
                        formData.followedBy ? [formData.followedBy] : []
                      }
                      size="sm"
                      onChange={(e) =>
                        handleChange("followedBy", e.target.value)
                      }
                    >
                      {users.map((u) => (
                        <SelectItem key={u.displayName || u.email || u.id}>
                          {u.displayName || u.email}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-[rgb(var(--color-border))] pb-2">
                    Follow-up Dates
                  </h3>
                  <div className="mb-4">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Next Follow-up Date
                    </label>
                    <Input
                      size="sm"
                      type="date"
                      value={formData.nextFollowupDate}
                      onChange={(e) =>
                        handleChange("nextFollowupDate", e.target.value)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        First Follow-up
                      </label>
                      <Input
                        size="sm"
                        type="date"
                        value={formData.firstDate}
                        onChange={(e) =>
                          handleChange("firstDate", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Second Follow-up
                      </label>
                      <Input
                        size="sm"
                        type="date"
                        value={formData.secondDate}
                        onChange={(e) =>
                          handleChange("secondDate", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Third Follow-up
                      </label>
                      <Input
                        size="sm"
                        type="date"
                        value={formData.thirdDate}
                        onChange={(e) =>
                          handleChange("thirdDate", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Fourth Follow-up
                      </label>
                      <Input
                        size="sm"
                        type="date"
                        value={formData.fourthDate}
                        onChange={(e) =>
                          handleChange("fourthDate", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Fifth Follow-up
                      </label>
                      <Input
                        size="sm"
                        type="date"
                        value={formData.fifthDate}
                        onChange={(e) =>
                          handleChange("fifthDate", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-[rgb(var(--color-border))] pb-2 mt-6">
                    Treatment Details
                  </h3>

                  {formData.category !== "pharmacy" && (
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        {formData.category === "pathology" ? "Lab Tests" : "Service / Procedures"}
                      </label>
                      <Input
                        placeholder={formData.category === "pathology" ? "e.g. CBC, Lipid Profile" : "e.g. PRP FACE, Consultation"}
                        size="sm"
                        value={formData.service}
                        onChange={(e) => handleChange("service", e.target.value)}
                      />
                    </div>
                  )}

                  {(formData.category === "pharmacy" || formData.category === "general" || formData.category === "appointment") && (
                    <div>
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                        Medicines / Products
                      </label>
                      <Input
                        placeholder="e.g. Amoxicillin, TPS NIACINAMIDE 5%"
                        size="sm"
                        value={formData.product}
                        onChange={(e) => handleChange("product", e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">
                      Add New Note
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter new note here..."
                        size="sm"
                        value={formData.newNote}
                        onChange={(e) =>
                          handleChange("newNote", e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (formData.newNote.trim()) {
                              setFormData((prev: any) => ({
                                ...prev,
                                noteHistory: [
                                  ...prev.noteHistory,
                                  {
                                    date: new Date(),
                                    note: prev.newNote.trim(),
                                    user: currentUser?.displayName || "Staff",
                                  },
                                ],
                                newNote: "",
                              }));
                            }
                          }
                        }}
                      />
                      <Button
                        color="primary"
                        size="sm"
                        onPress={() => {
                          if (formData.newNote.trim()) {
                            setFormData((prev: any) => ({
                              ...prev,
                              noteHistory: [
                                ...prev.noteHistory,
                                {
                                  date: new Date(),
                                  note: prev.newNote.trim(),
                                  user: currentUser?.displayName || "Staff",
                                },
                              ],
                              newNote: "",
                            }));
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  {formData.noteHistory && formData.noteHistory.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
                        Notes History
                      </h4>
                      <div className="space-y-2">
                        {formData.noteHistory.map((n: any, idx: number) => (
                          <div
                            key={idx}
                            className="text-[12px] bg-primary/5 p-2 rounded-lg border border-primary/10"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-semibold text-primary">
                                {n.user}
                              </span>
                              <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                                {new Date(n.date).toLocaleDateString()}{" "}
                                {new Date(n.date).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="text-text-main">{n.note}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.logs && formData.logs.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-[rgb(var(--color-border))]">
                      <h3 className="text-[12px] font-bold text-primary uppercase tracking-wider mb-3">
                        Action History
                      </h3>
                      <div className="space-y-3">
                        {formData.logs.map((log: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex gap-3 text-sm bg-primary/5 p-3 rounded-lg border border-primary/10"
                          >
                            <div className="text-[10px] whitespace-nowrap text-[rgb(var(--color-text-muted))] pt-0.5">
                              {new Date(log.date).toLocaleDateString()}
                            </div>
                            <div>
                              <p className="text-[12px] text-text-main leading-tight">
                                {log.note}
                              </p>
                              <p className="text-[10px] text-[rgb(var(--color-text-muted))] mt-0.5">
                                by {log.user || "Staff"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                className="font-semibold"
                color="danger"
                variant="light"
                onPress={onClose}
              >
                Cancel
              </Button>
              <Button
                className="font-semibold shadow-md"
                color="primary"
                isLoading={loading}
                onPress={handleSave}
              >
                Save Follow-up
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
