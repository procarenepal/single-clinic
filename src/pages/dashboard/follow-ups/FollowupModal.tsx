import type {
  PatientFollowup,
  Patient,
  FollowupInitStatus,
  FollowupUpdatedStatus,
  FollowupStatus,
  User,
  Expert,
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
  SelectSection,
  Chip,
} from "@heroui/react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import toast from "react-hot-toast";

import { useAuthContext } from "@/context/AuthContext";
import { useLoggedInClinicianName } from "@/hooks/useLoggedInClinicianName";
import { useClinicianNameMap } from "@/hooks/useClinicianNameMap";
import { resolveStaffDisplayName } from "@/services/core/clinicianDisplayCore";
import { expertService } from "@/services/expertService";
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
  const { clinicId, currentUser } = useAuthContext();
  // The real clinical-profile name for whoever is logged in, when they
  // have one — not the Auth account's own name, which can go stale (see
  // useLoggedInClinicianName). Every noteHistory/log entry and the
  // "Followed By" default below is a permanent attribution on the
  // patient's follow-up record, not just a label, so getting the name
  // right here matters more than on a screen that's merely displayed.
  // Empty-string fallback preserves this file's existing behaviour where
  // nothing resolves — callers below add their own visible "Staff"
  // fallback on top, matching what was there before.
  const loggedInClinicianName = useLoggedInClinicianName("");
  // "Followed By" picks from the clinic's whole staff list, so every
  // account needs the same real-name resolution, not just the logged-in
  // one — see clinicianDisplayCore for why a plain users.displayName
  // dropdown showed "Dr. Clinic Doctor" as an option.
  const clinicianNameMap = useClinicianNameMap(clinicId);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientHistory, setPatientHistory] = useState<any>(null);
  const [activeFollowupId, setActiveFollowupId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);

  useEffect(() => {
    if (isOpen && clinicId) {
      patientService.getPatientsByClinic(clinicId).then(setPatients);
      userService.getClinicUsers(clinicId).then(setUsers);
      expertService
        .getExpertsByClinic(clinicId)
        .then(setExperts)
        .catch(() => setExperts([]));
      setPatientHistory(null);
    }
  }, [isOpen, clinicId]);

  // Every active expert gets a place in "Followed By". Experts who already have
  // a login account are in `users` (under their real name), so only those with
  // no account are added here — matching by email, as the name map does.
  const expertsWithoutAccount = React.useMemo(() => {
    const accountEmails = new Set(
      users.map((u) => (u.email || "").trim().toLowerCase()).filter(Boolean),
    );

    return experts.filter(
      (x) =>
        x.isActive !== false &&
        !x.isDeleted &&
        !(x.email && accountEmails.has(x.email.trim().toLowerCase())),
    );
  }, [users, experts]);

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
    followedByUserId: "",
    followedByExpertId: "",
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
          followedBy: followup.followedBy || loggedInClinicianName,
          followedByUserId: followup.followedByExpertId
            ? ""
            : followup.followedByUserId || currentUser?.uid || "",
          followedByExpertId: followup.followedByExpertId || "",
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
          followedBy: loggedInClinicianName,
          followedByUserId: currentUser?.uid || "",
          followedByExpertId: "",
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

      if (field === "updatedStatus" && value) {
        next.overallStatus = "completed";
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
          user: loggedInClinicianName || "Staff",
        });
      }

      const payload: Omit<PatientFollowup, "id" | "createdAt" | "updatedAt"> = {
        clinicId: clinicId || "",
        branchId: "",
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
        // null (not undefined) so switching between a user and an expert
        // clears the other field instead of being dropped from the update.
        followedByUserId: (formData.followedByUserId || null) as any,
        followedByExpertId: (formData.followedByExpertId || null) as any,
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
              user: loggedInClinicianName || "Staff",
            };
          } else if (formData.session !== followup.session) {
            newLog = {
              date: new Date(),
              note: `Session updated to '${formData.session}'`,
              user: loggedInClinicianName || "Staff",
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
        base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] !max-w-[1100px]",
        header: "border-b border-[rgb(var(--color-border))] py-5 px-6",
        footer: "border-t border-[rgb(var(--color-border))] py-4 px-6",
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
                <h2 className="text-lg font-semibold text-[rgb(var(--color-text))]">
                  {followup ? "Edit Follow-up" : "Add New Follow-up"}
                </h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                  Track and manage patient follow-ups and treatment schedules.
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <h3 className="flex items-center gap-2 rounded-lg bg-[rgb(var(--color-surface-2))] px-3 py-2 text-[13px] font-semibold text-[rgb(var(--color-text))] before:h-4 before:w-1 before:rounded-full before:bg-primary before:content-['']">
                    Patient & Visit Info
                  </h3>
                  <div>
                    <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Patient Name <span className="text-danger">*</span>
                    </label>
                    <Autocomplete
                      radius="lg"
                      variant="bordered"
                      allowsCustomValue
                      inputValue={formData.patientName}
                      items={filteredPatients}
                      placeholder="Search or enter patient name"
                      selectedKey={formData.patientId || null}
                      size="md"
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
                    <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Mobile Number
                    </label>
                    <Input
                      radius="lg"
                      variant="bordered"
                      placeholder="Enter number"
                      size="md"
                      value={formData.patientMobile}
                      onChange={(e) =>
                        handleChange("patientMobile", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex gap-4">
                    {/* Category Selection */}
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Category
                      </label>
                      <Select
                        radius="lg"
                        variant="bordered"
                        selectedKeys={[formData.category]}
                        size="md"
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
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Visit Date
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        size="md"
                        type="date"
                        value={formData.visitDate}
                        onChange={(e) =>
                          handleChange("visitDate", e.target.value)
                        }
                      />
                    </div>
                    <div className="w-1/3">
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Session
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        placeholder="e.g. 1st, 2nd"
                        size="md"
                        value={formData.session}
                        onChange={(e) =>
                          handleChange("session", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  {patientHistory && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-[10px] border border-primary/10">
                      <h4 className="text-xs font-semibold text-primary mb-2">
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

                  <h3 className="flex items-center gap-2 rounded-lg bg-[rgb(var(--color-surface-2))] px-3 py-2 text-[13px] font-semibold text-[rgb(var(--color-text))] before:h-4 before:w-1 before:rounded-full before:bg-primary before:content-[''] mt-8">
                    Status & Tracking
                  </h3>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Initial Status
                      </label>
                      <Select
                        radius="lg"
                        variant="bordered"
                        selectedKeys={[formData.initStatus]}
                        size="md"
                        onChange={(e) =>
                          handleChange("initStatus", e.target.value)
                        }
                      >
                        <SelectItem key="good">Good</SelectItem>
                        <SelectItem key="neutral">Neutral</SelectItem>
                        <SelectItem key="wrong-no">Wrong Number</SelectItem>
                        <SelectItem key="no-answer">No Answer</SelectItem>
                        <SelectItem key="complain">Complain</SelectItem>
                        <SelectItem key="satisfy">Satisfy</SelectItem>
                        <SelectItem key="not-solved">Not Solved</SelectItem>
                        <SelectItem key="angry">Angry</SelectItem>
                        <SelectItem key="not-satisfy">Not Satisfy</SelectItem>
                        <SelectItem key="will-come">Will Visit For Followup</SelectItem>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Updated Status
                      </label>
                      <Select
                        radius="lg"
                        variant="bordered"
                        placeholder="Select status"
                        selectedKeys={
                          formData.updatedStatus ? [formData.updatedStatus] : []
                        }
                        size="md"
                        onChange={(e) =>
                          handleChange("updatedStatus", e.target.value)
                        }
                      >
                        <SelectItem key="good">Good</SelectItem>
                        <SelectItem key="solved">Solved</SelectItem>
                        <SelectItem key="neutral">Neutral</SelectItem>
                        <SelectItem key="wrong-no">Wrong Number</SelectItem>
                        <SelectItem key="no-answer">No Answer</SelectItem>
                        <SelectItem key="complain">Complain</SelectItem>
                        <SelectItem key="satisfy">Satisfy</SelectItem>
                        <SelectItem key="not-solved">Not Solved</SelectItem>
                        <SelectItem key="angry">Angry</SelectItem>
                        <SelectItem key="not-satisfy">Not Satisfy</SelectItem>
                        <SelectItem key="will-come">Will Visit For Followup</SelectItem>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Overall Status
                    </label>
                    {/* Grouped into Lifecycle (is this follow-up still open)
                        vs Outcome (how did the interaction actually go) —
                        overallStatus's 10 values conflate both concerns in
                        one flat list; this only changes how they're
                        presented, not the stored field/values themselves,
                        so nothing downstream that reads overallStatus needs
                        to change. */}
                    <Select
                      radius="lg"
                      variant="bordered"
                      selectedKeys={[formData.overallStatus]}
                      size="md"
                      onChange={(e) =>
                        handleChange("overallStatus", e.target.value)
                      }
                    >
                      <SelectSection showDivider title="Lifecycle">
                        <SelectItem key="pending">Pending</SelectItem>
                        <SelectItem key="completed">Completed</SelectItem>
                        <SelectItem key="cancelled">Cancelled</SelectItem>
                      </SelectSection>
                      <SelectSection title="Outcome (call result)">
                        <SelectItem key="satisfy">Satisfied</SelectItem>
                        <SelectItem key="not-satisfy">Not Satisfied</SelectItem>
                        <SelectItem key="will-come">Will Come</SelectItem>
                        <SelectItem key="complain">Complain</SelectItem>
                        <SelectItem key="angry">Angry</SelectItem>
                        <SelectItem key="no-answer">No Answer</SelectItem>
                        <SelectItem key="wrong-no">Wrong Number</SelectItem>
                      </SelectSection>
                    </Select>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Followed By
                    </label>
                    <Select
                      radius="lg"
                      variant="bordered"
                      placeholder="Select staff"
                      selectedKeys={
                        formData.followedByExpertId
                          ? [`expert:${formData.followedByExpertId}`]
                          : formData.followedByUserId
                            ? [formData.followedByUserId]
                            : []
                      }
                      size="md"
                      onChange={(e) => {
                        // Store the real user id (for reliable "my assigned
                        // follow-ups" queries later) alongside the display
                        // name (kept for existing UI rendering) — previously
                        // only the display-name string was stored, with no
                        // way to look this up by actual identity.
                        const pickedExpert = e.target.value.startsWith(
                          "expert:",
                        )
                          ? expertsWithoutAccount.find(
                              (x) => `expert:${x.id}` === e.target.value,
                            )
                          : undefined;

                        // An expert with no login account: no user id exists,
                        // so keep the expert id (and their name) instead.
                        if (pickedExpert) {
                          setFormData((prev) => ({
                            ...prev,
                            followedByUserId: "",
                            followedByExpertId: pickedExpert.id,
                            followedBy: pickedExpert.name,
                          }));

                          return;
                        }

                        const selectedUser = users.find(
                          (u) => u.id === e.target.value,
                        );

                        setFormData((prev) => ({
                          ...prev,
                          followedByUserId: e.target.value,
                          followedByExpertId: "",
                          followedBy: selectedUser
                            ? resolveStaffDisplayName(
                              selectedUser,
                              clinicianNameMap,
                            )
                            : "",
                        }));
                      }}
                    >
                      {[
                        ...users.map((u) => (
                          <SelectItem key={u.id}>
                            {resolveStaffDisplayName(u, clinicianNameMap)}
                          </SelectItem>
                        )),
                        ...expertsWithoutAccount.map((x) => (
                          <SelectItem
                            key={`expert:${x.id}`}
                            textValue={`${x.name} (Expert)`}
                          >
                            {x.name} (Expert)
                          </SelectItem>
                        )),
                      ]}
                    </Select>
                  </div>
                </div>

                <div className="space-y-5 md:border-l md:border-[rgb(var(--color-border))] md:pl-8">
                  <h3 className="flex items-center gap-2 rounded-lg bg-[rgb(var(--color-surface-2))] px-3 py-2 text-[13px] font-semibold text-[rgb(var(--color-text))] before:h-4 before:w-1 before:rounded-full before:bg-primary before:content-['']">
                    Follow-up Dates
                  </h3>
                  <div className="mb-4">
                    <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Next Follow-up Date
                    </label>
                    <Input
                      radius="lg"
                      variant="bordered"
                      size="md"
                      type="date"
                      value={formData.nextFollowupDate}
                      onChange={(e) =>
                        handleChange("nextFollowupDate", e.target.value)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        First Follow-up
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        size="md"
                        type="date"
                        value={formData.firstDate}
                        onChange={(e) =>
                          handleChange("firstDate", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Second Follow-up
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        size="md"
                        type="date"
                        value={formData.secondDate}
                        onChange={(e) =>
                          handleChange("secondDate", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Third Follow-up
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        size="md"
                        type="date"
                        value={formData.thirdDate}
                        onChange={(e) =>
                          handleChange("thirdDate", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Fourth Follow-up
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        size="md"
                        type="date"
                        value={formData.fourthDate}
                        onChange={(e) =>
                          handleChange("fourthDate", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Fifth Follow-up
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        size="md"
                        type="date"
                        value={formData.fifthDate}
                        onChange={(e) =>
                          handleChange("fifthDate", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <h3 className="flex items-center gap-2 rounded-lg bg-[rgb(var(--color-surface-2))] px-3 py-2 text-[13px] font-semibold text-[rgb(var(--color-text))] before:h-4 before:w-1 before:rounded-full before:bg-primary before:content-[''] mt-8">
                    Treatment Details
                  </h3>

                  {formData.category !== "pharmacy" && (
                    <div>
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        {formData.category === "pathology" ? "Lab Tests" : "Service / Procedures"}
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        placeholder={formData.category === "pathology" ? "e.g. CBC, Lipid Profile" : "e.g. PRP FACE, Consultation"}
                        size="md"
                        value={formData.service}
                        onChange={(e) => handleChange("service", e.target.value)}
                      />
                    </div>
                  )}

                  {(formData.category === "pharmacy" || formData.category === "general" || formData.category === "appointment") && (
                    <div>
                      <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                        Medicines / Products
                      </label>
                      <Input
                        radius="lg"
                        variant="bordered"
                        placeholder="e.g. Amoxicillin, TPS NIACINAMIDE 5%"
                        size="md"
                        value={formData.product}
                        onChange={(e) => handleChange("product", e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Add New Note
                    </label>
                    <div className="flex gap-2">
                      <Input
                        radius="lg"
                        variant="bordered"
                        placeholder="Enter new note here..."
                        size="md"
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
                                    user: loggedInClinicianName || "Staff",
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
                                  user: loggedInClinicianName || "Staff",
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
                      <h4 className="text-xs font-semibold text-primary mb-2">
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
                      <h3 className="text-[13px] font-semibold text-[rgb(var(--color-text))] mb-3">
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
                className="font-medium"
                variant="bordered"
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
