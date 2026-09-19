import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  IoPeopleOutline,
  IoTimeOutline,
  IoAddOutline,
  IoCalendarOutline,
  IoCheckmarkCircleOutline,
  IoPlayOutline,
  IoCardOutline,
  IoHeartOutline,
  IoCreateOutline,
  IoReceiptOutline,
  IoSearchOutline,
  IoCloseOutline,
  IoKeypadOutline,
  IoPulseOutline,
} from "react-icons/io5";
import {
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  doc,
  Timestamp,
} from "firebase/firestore";

import { TriageModal } from "./TriageModal";
import { RoutingModal } from "./RoutingModal";
import { ProcedureModal } from "./ProcedureModal";
import {
  QuickIntakeModal,
  getClinicianTypeDefaults,
} from "./QuickIntakeModal";
import { QueueList } from "./QueueList";

import { title } from "@/components/primitives";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { appointmentService } from "@/services/appointmentService";
import { ReasonConfirmModal } from "@/components/ui/ReasonConfirmModal";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { PatientNoteEntriesService } from "@/services/patientNoteEntriesService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { expertService } from "@/services/expertService";
import { hrService } from "@/services/hrService";
import {
  appointmentBillingService,
  isBillingLocked,
} from "@/services/appointmentBillingService";
import { packageService } from "@/services/packageService";
import { walletService } from "@/services/walletService";
import { patientPackageService } from "@/services/patientPackageService";
import {
  Appointment,
  Patient,
  Doctor,
  AppointmentType,
  ReferralPartner,
  Expert,
  StaffMember,
  TreatmentPackage,
  PatientPackage,
  AppointmentBillingSettings,
} from "@/types/models";
import { Spinner, Checkbox } from "@/components/ui";
import { db } from "@/config/firebase";
import { NotificationService } from "@/services/notificationService";
import { sendCheckInSMS } from "@/services/sendMessageService";
import SellPackageModal from "@/components/packages/SellPackageModal";

// Last-resort billing fallbacks used only when a doctor has no
// consultationCharge set on their profile, or an appointment type has no
// price configured — real data-entry gaps, not intended defaults. Kept as
// named constants (rather than bare numbers) so they're easy to find, and
// every use logs a warning so the gap doesn't go unnoticed indefinitely.
const FALLBACK_CONSULTATION_FEE = 700;
const FALLBACK_GENERAL_FEE = 500;

// Exclusive (single-patient-at-a-time) cabin/room names — must match the
// "OPD Rooms" and "Cabins & Laser" optgroup values in RoutingModal.tsx
// exactly. "Other Areas" (Lobby, Triage Area, Billing Counter, Pharmacy)
// are deliberately excluded — those are shared spaces by design, not
// exclusive rooms, so multiple patients being "in" one isn't a conflict.
const EXCLUSIVE_CABIN_NAMES = new Set([
  "OPD Room 1",
  "OPD Room 2",
  "OPD Room 3",
  "Laser Room 1",
  "Laser Room 2",
  "PRP Cabin A",
  "PRP Cabin B",
  "Facial Therapy Room",
]);

interface ProcessedReferral {
  type: "referral-partner" | "doctor" | "expert" | "staff";
  id: string;
  name: string;
  commissionPercentage: number;
  commissionAmount: number;
}

/**
 * Resolves a patient's referral/commission ledger against a given invoice
 * base amount — polymorphic multi-referral list first (current schema),
 * falling back to the legacy single `referralPartnerId` field. Shared by
 * every place that auto-generates an invoice for a patient
 * (createConsultationBill, handleSettleBilling's fallback) — was previously
 * duplicated near-verbatim in both, which is exactly how the SellPackageModal
 * tax/PAN gap slipped through undetected earlier this session.
 */
async function resolvePatientReferrals(
  pat: Patient | undefined,
  baseAmount: number,
): Promise<{
  processedReferrals: ProcessedReferral[];
  refPartnerId: string | undefined;
  refCommissionAmt: number | undefined;
}> {
  const processedReferrals: ProcessedReferral[] = [];

  if (pat?.referrals && Array.isArray(pat.referrals) && pat.referrals.length > 0) {
    for (const ref of pat.referrals) {
      const pct = ref.commissionPercentage || 0;
      const amt = (baseAmount * pct) / 100;

      processedReferrals.push({
        type: ref.type,
        id: ref.id,
        name: ref.name,
        commissionPercentage: pct,
        commissionAmount: amt,
      });
    }
  } else if (pat?.referralPartnerId) {
    // Backward compatibility fallback: single referral partner ID
    try {
      const partner = await referralPartnerService.getReferralPartnerById(
        pat.referralPartnerId,
      );

      if (partner) {
        const pct = partner.defaultCommission || 0;
        const amt = (baseAmount * pct) / 100;

        processedReferrals.push({
          type: "referral-partner",
          id: partner.id,
          name: partner.name,
          commissionPercentage: pct,
          commissionAmount: amt,
        });
      }
    } catch (err) {
      console.error(
        "Error fetching fallback referral partner for automated billing:",
        err,
      );
    }
  }

  // Keep primary partner values for legacy schema columns
  const primaryPartner = processedReferrals.find(
    (r) => r.type === "referral-partner",
  );
  const refPartnerId = primaryPartner
    ? primaryPartner.id
    : pat?.referralPartnerId || undefined;
  const refCommissionAmt = primaryPartner
    ? primaryPartner.commissionAmount
    : undefined;

  return { processedReferrals, refPartnerId, refCommissionAmt };
}

export default function FrontOfficeDesk() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Guards rapid double-clicks on queue action buttons (none of which have
  // per-row disabled/loading state today) from firing a handler twice
  // concurrently — a real risk for handlers that write invoices or change
  // appointment status. Keyed by an action-specific string, not just the
  // appointment id, so unrelated actions on the same appointment can't
  // block each other.
  const inFlightActionsRef = useRef<Set<string>>(new Set());
  // Mirrors inFlightActionsRef into React state so buttons can actually show
  // a disabled/loading state while an action is in flight — the ref alone
  // guarded against double-firing but was invisible to the UI, so a slow
  // Firestore round-trip looked like nothing happened and invited a second
  // click. isActionPending() below is what components read.
  const [inFlightActions, setInFlightActions] = useState<Set<string>>(
    new Set(),
  );
  // Find a patient by name/reg-number regardless of which tab/stage they're
  // currently in — the tab pills alone can't answer "where is this patient
  // right now" on a busy day with people spread across every stage.
  const [boardSearchQuery, setBoardSearchQuery] = useState("");
  const runGuarded = async (key: string, action: () => Promise<void>) => {
    if (inFlightActionsRef.current.has(key)) return;
    inFlightActionsRef.current.add(key);
    setInFlightActions(new Set(inFlightActionsRef.current));
    try {
      await action();
    } finally {
      inFlightActionsRef.current.delete(key);
      setInFlightActions(new Set(inFlightActionsRef.current));
    }
  };
  const isActionPending = (key: string) => inFlightActions.has(key);
  const { clinicId, currentUser, userData, hasPagePermissionByPath } =
    useAuthContext();
  const branchId = clinicId ?? null;
  const isAdmin = userData?.role === "clinic-admin";
  const [hasFullFrontOfficeAccess, setHasFullFrontOfficeAccess] =
    useState(isAdmin);

  useEffect(() => {
    if (!isAdmin) {
      hasPagePermissionByPath("/dashboard/front-office/manage-visitors")
        .then((hasAccess) => setHasFullFrontOfficeAccess(hasAccess))
        .catch(console.error);
    } else {
      setHasFullFrontOfficeAccess(true);
    }
  }, [isAdmin, hasPagePermissionByPath]);

  // Real-time queue data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [billings, setBillings] = useState<any[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [packages, setPackages] = useState<TreatmentPackage[]>([]);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>(
    [],
  );
  const [experts, setExperts] = useState<Expert[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [billingSettings, setBillingSettings] =
    useState<AppointmentBillingSettings | null>(null);

  // App states
  const [loading, setLoading] = useState(true);
  type FrontOfficeTab =
    | "urgent"
    | "lobby"
    | "triage"
    | "doctor"
    | "expert"
    | "billing"
    | "pharmacy"
    | "all";
  const validTabs: FrontOfficeTab[] = [
    "urgent",
    "lobby",
    "triage",
    "doctor",
    "expert",
    "billing",
    "pharmacy",
    "all",
  ];
  const [activeTab, setActiveTab] = useState<FrontOfficeTab>(() => {
    const requestedTab = searchParams.get("tab");

    return requestedTab && validTabs.includes(requestedTab as FrontOfficeTab)
      ? (requestedTab as FrontOfficeTab)
      : "lobby";
  });

  // Resolved IDs for the currently logged-in doctor or expert
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);
  const [currentExpertId, setCurrentExpertId] = useState<string | null>(null);

  // "Send Back to Lobby" — undo mis-routing/premature triage. Only ever
  // offered for pre-billing stages (triage-done/doctor/expert); reversing
  // anything past billing would mean touching an already-created (possibly
  // IRD-synced) invoice, a different problem solved via Credit Note.
  const [sendBackAppt, setSendBackAppt] = useState<Appointment | null>(null);
  const [isSendingBack, setIsSendingBack] = useState(false);

  const handleSendBackToLobby = async (appt: Appointment, reason: string) => {
    setIsSendingBack(true);
    try {
      // At the lobby stage itself, "sending back" means fully undoing
      // check-in (back to Scheduled) — everywhere later in the flow it
      // means clearing routing/triage state back to Lobby, as before.
      const isUndoingCheckIn = getPatientStage(appt) === "lobby";
      const targetStatus = isUndoingCheckIn ? "scheduled" : "confirmed";

      await appointmentService.updateAppointment(appt.id, {
        status: targetStatus,
        doctorId: "unassigned",
        assignedExpertId: "unassigned",
        doctorConsultationCompleted: false,
        cabinName: "",
        notes: isUndoingCheckIn
          ? `[Check-In Undone] ${reason}`
          : `[Sent Back to Lobby] ${reason}`,
        updatedAt: new Date(),
      });
      addToast({
        title: isUndoingCheckIn ? "Check-In Undone" : "Patient Sent Back to Lobby",
        description: isUndoingCheckIn
          ? "Patient returned to Scheduled."
          : "Routing and triage state have been cleared.",
        color: "success",
      });
      setSendBackAppt(null);
    } catch (err) {
      console.error("Error sending patient back to lobby:", err);
      addToast({
        title: "Failed to Send Back",
        description:
          err instanceof Error
            ? err.message
            : "Could not update the patient's status. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSendingBack(false);
    }
  };

  // "On Hold" — patient temporarily stepped out mid-visit. Purely a
  // flow-tracking flag; doesn't touch status/routing/billing at all, so
  // toggling it can never interfere with any of the write paths above.
  const [holdAppt, setHoldAppt] = useState<Appointment | null>(null);
  const [isTogglingHold, setIsTogglingHold] = useState(false);

  const handleToggleHold = (appt: Appointment, reason: string) =>
    runGuarded(`toggle-hold-${appt.id}`, async () => {
      setIsTogglingHold(true);
      try {
        const turningOn = !appt.onHold;
        // Audit trail: who put this patient on hold/resumed them and why —
        // previously this state change left zero trace of the acting user,
        // unlike Send Back to Lobby and routing, which already append a
        // notes marker.
        const priorNotes = appt.notes || "";
        const marker = turningOn
          ? `[Hold Started by ${currentUser?.uid || "unknown"}] ${reason || "No reason given"}`
          : `[Hold Resumed by ${currentUser?.uid || "unknown"}]`;

        await appointmentService.updateAppointment(appt.id, {
          onHold: turningOn,
          onHoldReason: turningOn ? reason : "",
          notes: priorNotes ? `${priorNotes}\n${marker}` : marker,
          updatedAt: new Date(),
        } as any);
        addToast({
          title: turningOn ? "Patient On Hold" : "Hold Resumed",
          description: turningOn
            ? "Wait time is paused and this patient won't trigger the 30-minute alert."
            : "Wait time is counting normally again.",
          color: "success",
        });
        setHoldAppt(null);
      } catch (err) {
        console.error("Error toggling patient hold state:", err);
        addToast({
          title: "Failed to Update Hold Status",
          description:
            err instanceof Error
              ? err.message
              : "Could not update the patient's status. Please try again.",
          color: "danger",
        });
      } finally {
        setIsTogglingHold(false);
      }
    });

  // Starting a hold needs a documented reason (ReasonConfirmModal, opened
  // via setHoldAppt below); resuming doesn't — it's a plain immediate
  // toggle, matching how "undo"-style actions elsewhere only require a
  // reason for the state-changing direction, not for reverting it.
  const handleHoldButtonClick = (appt: Appointment) => {
    if (appt.onHold) {
      handleToggleHold(appt, "");
    } else {
      setHoldAppt(appt);
    }
  };

  // Mark a scheduled patient who never showed up — a routine, frequent,
  // low-stakes action, so deliberately single-click (no mandatory-reason
  // modal, unlike Send Back/Hold) rather than adding friction to something
  // staff may do many times a day. Doesn't touch billing/routing; nothing
  // was created yet at the "scheduled" stage for this to conflict with.
  const handleMarkNoShow = (appt: Appointment) =>
    runGuarded(`mark-no-show-${appt.id}`, async () => {
      try {
        const priorNotes = appt.notes || "";
        const marker = `[Marked No-Show by ${currentUser?.uid || "unknown"}]`;

        await appointmentService.updateAppointmentStatus(appt.id, "no-show");
        await appointmentService.updateAppointment(appt.id, {
          notes: priorNotes ? `${priorNotes}\n${marker}` : marker,
          updatedAt: new Date(),
        } as any);
        addToast({
          title: "Marked No-Show",
          description: `${getPatientName(appt.patientId)} did not check in for their appointment.`,
          color: "warning",
        });
      } catch (err) {
        console.error("Error marking appointment as no-show:", err);
        addToast({
          title: "Failed to Mark No-Show",
          description:
            err instanceof Error
              ? err.message
              : "Could not update the appointment. Please try again.",
          color: "danger",
        });
      }
    });

  // Undo path for a mistaken no-show — previously "no-show" was a dead-end
  // status with no way back to "scheduled" anywhere in the UI.
  const handleReinstateNoShow = (appt: Appointment) =>
    runGuarded(`reinstate-no-show-${appt.id}`, async () => {
      try {
        const priorNotes = appt.notes || "";
        const marker = `[Reinstated to Scheduled by ${currentUser?.uid || "unknown"}]`;

        await appointmentService.updateAppointmentStatus(appt.id, "scheduled");
        await appointmentService.updateAppointment(appt.id, {
          notes: priorNotes ? `${priorNotes}\n${marker}` : marker,
          updatedAt: new Date(),
        } as any);
        addToast({
          title: "Reinstated",
          description: `${getPatientName(appt.patientId)} is back on the schedule.`,
          color: "success",
        });
      } catch (err) {
        console.error("Error reinstating no-show appointment:", err);
        addToast({
          title: "Failed to Reinstate",
          description:
            err instanceof Error
              ? err.message
              : "Could not update the appointment. Please try again.",
          color: "danger",
        });
      }
    });

  // Manual urgent flag — for a clinically-urgent walk-in that hasn't
  // necessarily waited long enough to trip the automatic >30min urgent
  // escalation. Single click both ways (no reason required), same as
  // resuming a hold: it's a visibility flag, not a state transition that
  // touches routing/billing, so there's nothing to undo/reconcile.
  const handleToggleUrgent = (appt: Appointment) =>
    runGuarded(`toggle-urgent-${appt.patientId}`, async () => {
      try {
        // A visit can have multiple sibling appointments (one per assigned
        // clinician). The urgent badge in the queue header reflects the
        // patient as a whole (true if ANY sibling is flagged), so the
        // toggle must act on that same basis and update every sibling
        // together — otherwise flagging/clearing just the one appointment
        // passed in can leave the header badge permanently stuck on (a
        // second sibling still flagged) or desynced from what the button
        // itself displays.
        const siblingAppts = appointments.filter(
          (a) => a.patientId === appt.patientId,
        );
        const next = !siblingAppts.some((a) => a.isUrgent);

        // A batched write is all-or-nothing — previously this used
        // Promise.all, so a mid-flight network failure on one sibling could
        // leave others updated and others not, permanently desyncing the
        // header badge from the individual rows with no indication of
        // which ones actually changed.
        const batch = writeBatch(db);

        for (const a of siblingAppts) {
          batch.update(doc(db, "appointments", a.id), {
            isUrgent: next,
            updatedAt: Timestamp.now(),
          });
        }
        await batch.commit();

        addToast({
          title: next ? "Marked Urgent" : "Urgent Flag Cleared",
          description: next
            ? `${getPatientName(appt.patientId)} is now flagged urgent and shown in the Urgent tab.`
            : `${getPatientName(appt.patientId)} is no longer flagged urgent.`,
          color: next ? "warning" : "success",
        });
      } catch (err) {
        console.error("Error toggling urgent flag:", err);
        addToast({
          title: "Failed to Update Urgent Flag",
          description:
            err instanceof Error
              ? err.message
              : "Could not update the patient's status. Please try again.",
          color: "danger",
        });
      }
    });

  // Doctor/Expert duty status — who's actually at the clinic right now vs.
  // off-duty. `doctors`/`experts` are loaded once (not a live subscription
  // like appointments/billings), so a toggle updates local state directly
  // rather than waiting on a re-fetch.
  const [isDutyPanelOpen, setIsDutyPanelOpen] = useState(false);
  const [togglingDutyId, setTogglingDutyId] = useState<string | null>(null);

  const handleToggleDoctorDuty = async (doctor: Doctor) => {
    const nextIsOnDuty = !(doctor.isOnDuty ?? true);

    setTogglingDutyId(doctor.id);
    try {
      await doctorService.updateDoctor(doctor.id, { isOnDuty: nextIsOnDuty });
      setDoctors((prev) =>
        prev.map((d) =>
          d.id === doctor.id ? { ...d, isOnDuty: nextIsOnDuty } : d,
        ),
      );
    } catch (err) {
      console.error("Error toggling doctor duty status:", err);
      addToast({
        title: "Failed to Update Status",
        description:
          err instanceof Error
            ? err.message
            : "Could not update this doctor's duty status.",
        color: "danger",
      });
    } finally {
      setTogglingDutyId(null);
    }
  };

  const handleToggleExpertDuty = async (expert: Expert) => {
    const nextIsOnDuty = !(expert.isOnDuty ?? true);

    setTogglingDutyId(expert.id);
    try {
      await expertService.updateExpert(expert.id, { isOnDuty: nextIsOnDuty });
      setExperts((prev) =>
        prev.map((e) =>
          e.id === expert.id ? { ...e, isOnDuty: nextIsOnDuty } : e,
        ),
      );
    } catch (err) {
      console.error("Error toggling expert duty status:", err);
      addToast({
        title: "Failed to Update Status",
        description:
          err instanceof Error
            ? err.message
            : "Could not update this expert's duty status.",
        color: "danger",
      });
    } finally {
      setTogglingDutyId(null);
    }
  };

  // Auto-switch active tab based on resolved doctor/expert role, and resolve their IDs
  useEffect(() => {
    const matchedDoc = doctors.find(
      (d) => d.email?.toLowerCase() === currentUser?.email?.toLowerCase(),
    );
    const matchedExp = experts.find(
      (e) => e.email?.toLowerCase() === currentUser?.email?.toLowerCase(),
    );

    if (matchedDoc) {
      setCurrentDoctorId(matchedDoc.id);
    } else {
      setCurrentDoctorId(null);
    }

    if (matchedExp) {
      setCurrentExpertId(matchedExp.id);
    } else {
      setCurrentExpertId(null);
    }

    // An explicit `?tab=` (e.g. returning from settling a billing invoice)
    // takes priority over the role-based default — don't clobber a
    // deliberate return navigation.
    if (searchParams.get("tab")) return;

    if (matchedDoc && matchedExp) {
      setActiveTab("all"); // If both, maybe show all workflow
    } else if (matchedDoc) {
      setActiveTab("doctor");
    } else if (matchedExp) {
      setActiveTab("expert");
    }
  }, [doctors, experts, currentUser?.email, searchParams]);

  // Triage modal state
  const [isTriageModalOpen, setIsTriageModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [triageSaving, setTriageSaving] = useState(false);
  const [vitals, setVitals] = useState({
    bpSystolic: "",
    bpDiastolic: "",
    pulse: "",
    temp: "",
    weight: "",
    spo2: "",
    complaints: "",
  });

  // Routing modal state for cabin/room assignment
  const [isRoutingModalOpen, setIsRoutingModalOpen] = useState(false);
  const [routingAppointment, setRoutingAppointment] =
    useState<Appointment | null>(null);
  const [routingCabin, setRoutingCabin] = useState("");
  const [routingTarget, setRoutingTarget] = useState<
    "doctor" | "expert" | "default"
  >("default");
  const [routingAddCommission, setRoutingAddCommission] = useState(false);
  const [routingDoctorId, setRoutingDoctorId] = useState("");
  const [routingExpertId, setRoutingExpertId] = useState("");
  const [routingChargeConsultation, setRoutingChargeConsultation] =
    useState(false);
  const [routingApplyTax, setRoutingApplyTax] = useState(false);
  const [routingDiscountType, setRoutingDiscountType] = useState<
    "flat" | "percent"
  >("percent");
  const [routingDiscountValue, setRoutingDiscountValue] = useState(0);

  // Procedure log modal state
  const [isProcedureModalOpen, setIsProcedureModalOpen] = useState(false);
  const [procedureSaving, setProcedureSaving] = useState(false);
  const [historicalProcedures, setHistoricalProcedures] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [modalActivePackages, setModalActivePackages] = useState<
    PatientPackage[]
  >([]);

  // State for Finalising Procedure from Front Office Desk
  const [apptToFinalise, setApptToFinalise] = useState<Appointment | null>(
    null,
  );
  const [isFinalisingProcedure, setIsFinalisingProcedure] = useState(false);
  const [finaliseSelectedItems, setFinaliseSelectedItems] = useState<string[]>(
    [],
  );
  const [itemExperts, setItemExperts] = useState<Record<string, string>>({});
  // Discount/tax entered for THIS finalization action — applied to whichever
  // invoice branch handleFinaliseProcedure actually writes to (patch an
  // existing unlocked invoice, or create a fresh one), reusing the same
  // taxEngine-backed calculateInvoiceTotals already used everywhere else in
  // the app. Defaults mirror the main "Create Invoice" form: no discount,
  // tax on only if the clinic has tax enabled by default.
  const [finaliseDiscountType, setFinaliseDiscountType] = useState<
    "flat" | "percent"
  >("percent");
  const [finaliseDiscountValue, setFinaliseDiscountValue] = useState(0);
  const [finaliseApplyTax, setFinaliseApplyTax] = useState(false);

  useEffect(() => {
    if (apptToFinalise) {
      const rec = (apptToFinalise as any).recommendedProcedure;

      if (rec?.items && Array.isArray(rec.items)) {
        setFinaliseSelectedItems(rec.items.map((i: any) => i.id));
        const initialExperts: Record<string, string> = {};

        rec.items.forEach((i: any) => {
          initialExperts[i.id] = "";
        });
        setItemExperts(initialExperts);
      }
      setFinaliseDiscountType("percent");
      setFinaliseDiscountValue(0);
      setFinaliseApplyTax(false);
    } else {
      setItemExperts({});
    }
  }, [apptToFinalise]);

  const [procedure, setProcedure] = useState({
    procedureType: "CO2 Laser Resurfacing",
    energy: "",
    spotSize: "",
    pulseWidth: "",
    passes: "",
    area: "Full Face",
    fee: "",
    notes: "",
  });

  // Quick walk-in intake modal state
  const [isQuickIntakeOpen, setIsQuickIntakeOpen] = useState(false);
  const [quickIntakeSaving, setQuickIntakeSaving] = useState(false);
  const [intakeMode, setIntakeMode] = useState<"new" | "existing">("new");
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [selectedExistingPatient, setSelectedExistingPatient] =
    useState<Patient | null>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isSellPackageModalOpen, setIsSellPackageModalOpen] = useState(false);
  const [activePatientPackages, setActivePatientPackages] = useState<
    PatientPackage[]
  >([]);

  // Fetch active patient packages when existing patient is selected
  useEffect(() => {
    if (intakeMode === "existing" && selectedExistingPatient && clinicId) {
      patientPackageService
        .getPatientPackages(selectedExistingPatient.id, clinicId)
        .then((data) => {
          setActivePatientPackages(
            data.filter(
              (p) => p.status !== "expired" && p.status !== "completed",
            ),
          );
        })
        .catch(console.error);
    } else {
      setActivePatientPackages([]);
    }
  }, [intakeMode, selectedExistingPatient, clinicId]);

  // Date filter for the queue
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;

      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Alt + N for Quick Check-In
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleOpenQuickIntake();

        return;
      }

      // Ignore modifiers for tab switching
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

      // Tab switching 1-6
      switch (e.key) {
        case "1":
          setActiveTab("lobby");
          break;
        case "2":
          setActiveTab("triage");
          break;
        case "3":
          setActiveTab("doctor");
          break;
        case "4":
          setActiveTab("expert");
          break;
        case "5":
          setActiveTab("billing");
          break;
        case "6":
          setActiveTab("pharmacy");
          break;
        case "`":
          setActiveTab("all");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [quickIntakeForm, setQuickIntakeForm] = useState({
    name: "",
    mobile: "",
    patientPanVat: "",
    age: "",
    gender: "male",
    appointmentDate: new Date().toISOString().split("T")[0],
    doctorId: "",
    assignedExpertId: "",
    appointmentTypeId: "",
    reason: "",
    referralPartnerId: "",
    referrals: [] as Array<{
      type: "referral-partner" | "doctor" | "expert" | "staff";
      id: string;
      name: string;
      commissionPercentage: number;
      referredById?: string;
      referredByName?: string;
    }>,
    paymentMethod: "cash",
    paymentReference: "",
    generateConsultationBill: true,
    applyTax: true,
    discountType: "percent" as "flat" | "percent",
    discountValue: 0,
    startSessionInstantly: false,
    sendDirectlyToCabin: false,
    addDoctorCommission: true,
    addExpertCommission: true,
    clinicians: [
      {
        id: crypto.randomUUID(),
        clinicianType: "doctor" as "doctor" | "expert",
        clinicianId: "",
        appointmentTypeId: "",
        chargeConsultation: true,
        addCommission: true,
      },
    ],
  });

  const handleOpenQuickIntake = () => {
    // Doctor-type defaults (charge fee, no commission, "Doctor Consultation"
    // category matched by name) — same helper used when adding/retyping a
    // clinician row in QuickIntakeModal, so the very first row is
    // consistent with every row added after it.
    const doctorDefaults = getClinicianTypeDefaults("doctor", appointmentTypes);

    // Reset the form strictly every time the modal is opened. doctorId/
    // clinicianId deliberately start blank — auto-picking doctors[0] here
    // used to silently pre-select whatever doctor happened to be first in
    // the list, which staff could easily miss and submit against the wrong
    // clinician.
    setQuickIntakeForm({
      name: "",
      mobile: "",
      patientPanVat: "",
      age: "",
      gender: "male",
      appointmentDate: new Date().toISOString().split("T")[0],
      doctorId: "",
      assignedExpertId: "unassigned",
      appointmentTypeId: doctorDefaults.appointmentTypeId,
      reason: "",
      referralPartnerId: "",
      referrals: [],
      paymentMethod: "cash",
      paymentReference: "",
      generateConsultationBill: true,
      applyTax: false,
      discountType: "percent",
      discountValue: 0,
      startSessionInstantly: false,
      sendDirectlyToCabin: false,
      addDoctorCommission: true,
      addExpertCommission: true,
      clinicians: [
        {
          id: crypto.randomUUID(),
          clinicianType: "doctor",
          clinicianId: "",
          ...doctorDefaults,
        },
      ],
    });

    setIntakeMode("new");
    setPatientSearchQuery("");
    setSelectedExistingPatient(null);
    setIsQuickIntakeOpen(true);
  };

  // Mobile duplicate state
  const [mobileStatus, setMobileStatus] = useState<
    "idle" | "checking" | "duplicate" | "clear"
  >("idle");

  useEffect(() => {
    const mobile = quickIntakeForm.mobile.trim();

    if (!mobile || mobile.length < 10 || !clinicId) {
      setMobileStatus("idle");

      return;
    }

    setMobileStatus("checking");
    const timeoutId = setTimeout(async () => {
      try {
        const exists = await patientService.checkMobileExists(mobile, clinicId);

        setMobileStatus(exists ? "duplicate" : "clear");
      } catch {
        setMobileStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [quickIntakeForm.mobile, clinicId]);

  // Load supporting data
  useEffect(() => {
    if (!clinicId) return;

    let isActive = true;
    const loadStaticData = async () => {
      try {
        const [
          patientsData,
          doctorsData,
          apptTypesData,
          pkgsData,
          referralPartnersData,
          expertsData,
          staffData,
          billingSettingsData,
        ] = await Promise.all([
          patientService.getPatients(clinicId),
          doctorService.getDoctors(clinicId),
          appointmentTypeService.getAppointmentTypesByClinic(
            clinicId,
          ),
          packageService.getPackagesByClinic(clinicId),
          referralPartnerService.getReferralPartnersByClinic(
            clinicId,
          ),
          expertService.getExpertsByClinic(
            clinicId || undefined,
          ),
          hrService.getStaffByClinic(clinicId!),
          appointmentBillingService
            .getBillingSettings(clinicId)
            .catch(() => null),
        ]);

        if (isActive) {
          setPatients(patientsData);
          setDoctors(doctorsData);
          setAppointmentTypes(apptTypesData);
          setPackages(pkgsData);
          setReferralPartners(referralPartnersData);
          setExperts(expertsData || []);
          setStaff(staffData || []);
          setBillingSettings(billingSettingsData);

          // Pre-select first doctor and first appointment type for quick walk-in intake
          if (doctorsData.length > 0) {
            setQuickIntakeForm((prev) => ({
              ...prev,
              doctorId: doctorsData[0].id,
            }));
          }
          if (apptTypesData.length > 0) {
            // Find consultation type, fallback to first available
            const consultationType = apptTypesData.find(
              (t) =>
                t.id === "consultation-fee" ||
                t.name.toLowerCase().includes("consultation"),
            );

            setQuickIntakeForm((prev) => ({
              ...prev,
              appointmentTypeId: consultationType
                ? consultationType.id
                : apptTypesData[0].id,
            }));
          }
        }
      } catch (err) {
        console.error("Error loading supporting front-office data:", err);
        if (isActive) {
          addToast({
            title: "Failed to Load Front Office Data",
            description:
              "Could not load patients, doctors, or clinic settings. Please refresh the page.",
            color: "danger",
          });
        }
      }
    };

    loadStaticData();

    return () => {
      isActive = false;
    };
  }, [clinicId, branchId]);

  // Live Sync Appointments & Billings
  useEffect(() => {
    if (!clinicId) return;

    setLoading(true);

    // Subscribe to Appointments
    const unsubscribeAppts = appointmentService.subscribeToClinicAppointments(
      clinicId,
      (data) => {
        // Filter by selected date
        const filtered = data.filter((appt) => {
          const d = appt.appointmentDate;

          return (
            d.getFullYear() === selectedDate.getFullYear() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getDate() === selectedDate.getDate()
          );
        });

        // Defensive de-dupe by id — a single Firestore snapshot can't
        // contain the same doc twice, but two overlapping listeners can
        // momentarily coexist across a re-subscribe (e.g. a fast clinicId
        // change or a React 18 dev-mode double-mount), each independently
        // calling this handler. Without this, React logs a duplicate-key
        // warning and can misrender/duplicate rows in the queue.
        const seen = new Set<string>();
        const deduped = filtered.filter((appt) => {
          if (seen.has(appt.id)) return false;
          seen.add(appt.id);

          return true;
        });

        setAppointments(deduped);
      },
      (err) => {
        console.error("Live appointments subscription error:", err);
        addToast({
          title: "Live Updates Interrupted",
          description:
            "Lost connection to the live patient queue — the board may be showing stale data. Please refresh.",
          color: "danger",
        });
      },
    );

    // Subscribe to Billings in real-time
    const billingCollection = collection(db, "appointmentBilling");
    const qBilling = query(billingCollection, where("clinicId", "==", clinicId));

    const unsubscribeBillings = onSnapshot(
      qBilling,
      (snapshot) => {
        const records: any[] = [];

        snapshot.forEach((docSnap) => {
          records.push({ id: docSnap.id, ...docSnap.data() });
        });
        setBillings(records);
        setLoading(false);
      },
      (err) => {
        console.error("Live billings subscription error:", err);
        setLoading(false);
        addToast({
          title: "Live Updates Interrupted",
          description:
            "Lost connection to live billing data — invoice status shown may be stale. Please refresh.",
          color: "danger",
        });
      },
    );

    // Subscribe to Prescriptions in real-time
    const prescriptionCollection = collection(db, "prescriptions");
    const qPrescription = query(
      prescriptionCollection,
      where("clinicId", "==", clinicId),
    );

    const unsubscribePrescriptions = onSnapshot(
      qPrescription,
      (snapshot) => {
        const records: any[] = [];

        snapshot.forEach((docSnap) => {
          records.push({ id: docSnap.id, ...docSnap.data() });
        });
        setPrescriptions(records);
      },
      (err) => {
        console.error("Live prescriptions subscription error:", err);
        addToast({
          title: "Live Updates Interrupted",
          description:
            "Lost connection to live prescription data — the Pharmacy stage indicator may be stale.",
          color: "warning",
        });
      },
    );

    return () => {
      unsubscribeAppts?.();
      unsubscribeBillings?.();
      unsubscribePrescriptions?.();
    };
  }, [clinicId, branchId, selectedDate]);

  // Helpers to resolve names
  const getPatientName = (patientId: string) =>
    patients.find((p) => p.id === patientId)?.name || "Walk-In Patient";

  const getPatientReg = (patientId: string) =>
    patients.find((p) => p.id === patientId)?.regNumber || "N/A";

  const getDoctorName = (appt: Appointment) => {
    const stage = getPatientStage(appt);
    const doc = doctors.find((d) => d.id === appt.doctorId);
    const exp =
      appt.assignedExpertId && appt.assignedExpertId !== "unassigned"
        ? experts.find((e) => e.id === appt.assignedExpertId)
        : null;

    if (doc && exp) {
      if (stage === "doctor") {
        return doc.name.startsWith("Dr.") ? doc.name : `Dr. ${doc.name}`;
      } else if (stage === "expert") {
        return exp.name;
      } else {
        const docFormatted = doc.name.startsWith("Dr.")
          ? doc.name
          : `Dr. ${doc.name}`;

        return `${docFormatted} / ${exp.name}`;
      }
    }

    if (exp) return exp.name;
    if (doc) return doc.name.startsWith("Dr.") ? doc.name : `Dr. ${doc.name}`;

    const fallbackExp = experts.find((e) => e.id === appt.doctorId);

    if (fallbackExp) return fallbackExp.name;

    return appt.doctorId === "unassigned"
      ? "Expert Cabin"
      : "Dr. Dermatologist";
  };

  const getDoctorSpeciality = (appt: Appointment) => {
    const stage = getPatientStage(appt);
    const doc = doctors.find((d) => d.id === appt.doctorId);
    const exp =
      appt.assignedExpertId && appt.assignedExpertId !== "unassigned"
        ? experts.find((e) => e.id === appt.assignedExpertId)
        : null;

    if (doc && exp) {
      if (stage === "doctor") {
        return doc.speciality || "Dermatology";
      } else if (stage === "expert") {
        return exp.speciality || "Skin & Laser Consultant";
      } else {
        return `${doc.speciality || "Dermatology"} & ${exp.speciality || "Laser Consultant"}`;
      }
    }

    if (exp) return exp.speciality || "Skin & Laser Consultant";
    if (doc) return doc.speciality || "Dermatology";

    const fallbackExp = experts.find((e) => e.id === appt.doctorId);

    if (fallbackExp) return fallbackExp.speciality || "Skin & Laser Consultant";

    return appt.doctorId === "unassigned"
      ? "Skin & Laser Consultant"
      : "Dermatologist";
  };

  const getApptTypeLabel = (typeId: string) =>
    appointmentTypes.find((t) => t.id === typeId)?.name || "General Checkup";

  const formatTimeTo12Hour = (time24: string): string => {
    if (!time24) return "Not set";
    try {
      const [hours, minutes] = time24.split(":");
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;

      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return time24;
    }
  };

  const createConsultationBill = async (
    patientId: string,
    doctorId: string,
    appointmentId: string,
    reason: string,
    addClinicianCommission: boolean = true,
    appointmentTypeId?: string,
    generateConsultationFee: boolean = true,
    cliniciansList?: any[],
    // Per-invoice override for whether tax applies — defaults to the
    // clinic-wide setting when the caller doesn't have its own checkbox
    // for this yet, so existing call sites keep working unchanged.
    applyTax?: boolean,
    // Optional discount for this consultation invoice — previously
    // hardcoded to 0/none with no way for any caller to supply one.
    // Undefined/0 preserves today's no-discount behavior for existing
    // call sites.
    discountType?: "flat" | "percent",
    discountValue?: number,
  ) => {
    if (!clinicId) return;

    try {
      const appt = appointments.find((a) => a.id === appointmentId);

      if (appt && appt.consultationBillingId) {
        // A cancelled invoice must not block re-billing — without this
        // check, a cancelled consultation invoice permanently "occupies"
        // consultationBillingId and every future routing attempt with
        // "Charge Consultation Fee" checked would silently reopen the
        // dead cancelled invoice instead of ever creating a fresh charge.
        try {
          const existingBilling = await appointmentBillingService.getBillingById(
            appt.consultationBillingId,
          );

          if (existingBilling && existingBilling.status !== "cancelled") {
            return appt.consultationBillingId;
          }
        } catch (err) {
          console.error(
            "Error checking existing consultation billing status:",
            err,
          );
          addToast({
            title: "Could Not Verify Existing Invoice",
            description:
              "Reusing the existing consultation invoice without confirming it isn't cancelled — please double-check billing for this patient.",
            color: "warning",
          });

          // Can't confirm the existing invoice is safe to replace — fail
          // safe and reuse it rather than risk creating a duplicate.
          return appt.consultationBillingId;
        }
      }
      let pat = patients.find((p) => p.id === patientId);

      if (!pat && patientId) {
        try {
          pat = (await patientService.getPatientById(patientId)) || undefined;
        } catch (err) {
          console.error("Error loading patient for consultation billing:", err);
        }
      }

      let totalInvoiceAmount = 0;
      const items: any[] = [];
      // Tracks whether any item this loop builds is a package-session
      // commission-only item (price 0 — patient already paid for the
      // package — but still commission-bearing for the performing
      // clinician). When true, the invoice is deliberately NOT
      // auto-marked "paid" at creation (even though its total is 0) so
      // that the explicit recordPayment(..., 0, "package") call below
      // triggers the normal "commission generated when the invoice is
      // paid" pipeline, instead of silently earning no commission.
      let hasPackageSessionCommissionItem = false;

      // Only the Quick Intake modal's real "Charge Fee" checkboxes (one per
      // clinician row) reach here as a genuine multi-item cliniciansList —
      // every other call site (check-in, routing) builds the single-item
      // fallback below with chargeConsultation hardcoded from its own
      // caller, not a real per-row toggle. The checkbox is only made
      // authoritative for the real list, so single-item call sites keep
      // their exact existing behavior (see the "Charge Fee" bug note below).
      const isMultiClinicianList = Boolean(
        cliniciansList && cliniciansList.length > 0,
      );
      const cliniciansToProcess = isMultiClinicianList
        ? cliniciansList!
        : [
          {
            clinicianId: doctorId,
            appointmentTypeId: appointmentTypeId,
            addCommission: addClinicianCommission,
            chargeConsultation: generateConsultationFee,
          },
        ];

      for (const cl of cliniciansToProcess) {
        if (!cl.clinicianId || cl.clinicianId === "unassigned") continue;

        let docInfo = doctors.find((d) => d.id === cl.clinicianId);
        let expInfo = experts.find((e) => e.id === cl.clinicianId);
        let isExpert = false;

        if (!docInfo && !expInfo) {
          try {
            docInfo =
              (await doctorService.getDoctorById(cl.clinicianId)) || undefined;
            if (!docInfo) {
              expInfo =
                (await expertService.getExpertById(cl.clinicianId)) ||
                undefined;
            }
          } catch (err) {
            console.error("Error loading clinician:", err);
          }
        }
        if (expInfo) isExpert = true;

        let clConsultationPrice = 0;

        if (cl.chargeConsultation) {
          if (docInfo) {
            if (docInfo.consultationCharge !== undefined) {
              clConsultationPrice = Number(docInfo.consultationCharge);
            } else {
              console.warn(
                `Doctor "${docInfo.name}" (${docInfo.id}) has no consultationCharge set — falling back to NPR ${FALLBACK_CONSULTATION_FEE}. Set a real fee on their profile.`,
              );
              clConsultationPrice = FALLBACK_CONSULTATION_FEE;
            }
          }
        }

        let clApptTypeItem: any = null;
        let isApptTypeConsultation = false;

        // Consuming a session from a previously-sold package: the patient
        // already paid at time of sale, so this never adds to what they
        // owe (price stays 0) — but the assigned doctor/expert performing
        // the session still earns commission, computed on the package's
        // per-session value (price ÷ totalSessions), same as any other
        // commission-bearing item.
        if (
          cl.appointmentTypeId &&
          cl.appointmentTypeId.startsWith("consume_pkg_") &&
          (docInfo || expInfo)
        ) {
          const patientPkgId = cl.appointmentTypeId.replace(
            "consume_pkg_",
            "",
          );
          const patientPkg =
            activePatientPackages.find((p) => p.id === patientPkgId) ||
            (await patientPackageService.getPatientPackageById(patientPkgId));
          const pkg = patientPkg
            ? packages.find((p) => p.id === patientPkg.packageId)
            : undefined;

          if (pkg) {
            const sessionCount =
              patientPkg?.totalSessions || pkg.totalSessions || 1;
            const perSessionValue = pkg.price > 0 ? pkg.price / sessionCount : 0;
            const commissionPct =
              cl.addCommission
                ? (isExpert
                  ? expInfo?.defaultCommission
                  : docInfo?.defaultCommission) || 0
                : 0;

            if (commissionPct > 0 && perSessionValue > 0) {
              clApptTypeItem = {
                id: crypto.randomUUID(),
                appointmentTypeId: cl.appointmentTypeId,
                appointmentTypeName: `Package Session — ${pkg.name}`,
                price: 0,
                quantity: 1,
                commission: commissionPct,
                doctorId: cl.clinicianId,
                doctorName: isExpert
                  ? expInfo?.name || "Expert"
                  : docInfo?.name || "GP",
                amount: perSessionValue,
              };
              hasPackageSessionCommissionItem = true;
            }
          } else {
            console.warn(
              `Could not resolve package for session consumption (patientPackageId=${patientPkgId}) — no commission item created.`,
            );
          }
        } else if (
          cl.appointmentTypeId &&
          cl.appointmentTypeId !== "default" &&
          cl.appointmentTypeId !== "consultation-fee" &&
          !cl.appointmentTypeId.startsWith("pkg_") &&
          !cl.appointmentTypeId.startsWith("consume_")
        ) {
          const apptType = appointmentTypes.find(
            (t) => t.id === cl.appointmentTypeId,
          );

          if (apptType && apptType.price > 0) {
            const nameLower = apptType.name.toLowerCase();

            isApptTypeConsultation = nameLower.includes("consult");

            // Bug fix: previously the "Charge Fee" checkbox only had any
            // effect when the category name literally contained "consult"
            // — for every other category (e.g. a procedure), whether it
            // billed was decided solely by the appointment type's own
            // billAtFrontDesk flag, completely ignoring what staff checked
            // or unchecked in the Quick Intake modal. For the real
            // multi-clinician list, the checkbox is now the sole, honest
            // answer to "does this row get billed" — no silent fallback.
            let shouldCharge = isMultiClinicianList
              ? Boolean(cl.chargeConsultation)
              : apptType.billAtFrontDesk ||
              nameLower.includes("hair analy") ||
              nameLower.includes("skin analy") ||
              isApptTypeConsultation;

            if (
              !isMultiClinicianList &&
              isApptTypeConsultation &&
              !cl.chargeConsultation
            ) {
              shouldCharge = false;
            }

            if (shouldCharge) {
              let finalPrice = Number(apptType.price);

              if (
                isApptTypeConsultation &&
                cl.chargeConsultation &&
                docInfo?.consultationCharge !== undefined
              ) {
                finalPrice = Number(docInfo.consultationCharge);
              }

              clApptTypeItem = {
                id: crypto.randomUUID(),
                appointmentTypeId: apptType.id,
                appointmentTypeName: apptType.name,
                price: finalPrice,
                quantity: 1,
                commission:
                  cl.addCommission && apptType.calculateCommission !== false
                    ? (isExpert
                      ? expInfo?.defaultCommission
                      : docInfo?.defaultCommission) || 0
                    : 0,
                doctorId: cl.clinicianId,
                doctorName: isExpert
                  ? expInfo?.name || "Expert"
                  : docInfo?.name || "GP",
                amount: finalPrice,
              };
              totalInvoiceAmount += finalPrice;
            }
          }
        }

        if (clConsultationPrice > 0 && !clApptTypeItem) {
          totalInvoiceAmount += clConsultationPrice;
          items.push({
            id: crypto.randomUUID(),
            appointmentTypeId: "consultation-fee",
            appointmentTypeName: `Doctor Consultation Fee - ${docInfo?.name
              ? docInfo.name.startsWith("Dr.")
                ? docInfo.name
                : `Dr. ${docInfo.name}`
              : "Dr. GP"
              }`,
            price: clConsultationPrice,
            quantity: 1,
            commission: cl.addCommission ? docInfo?.defaultCommission || 0 : 0,
            doctorId: cl.clinicianId,
            doctorName: docInfo?.name || "Unknown Doctor",
            amount: clConsultationPrice,
          });
        }

        if (clApptTypeItem) {
          items.push(clApptTypeItem);
        }
      }

      if (items.length === 0) {
        return null;
      }

      // Items are already built above in the array loop

      // Apply the clinic's real tax settings instead of always billing
      // untaxed — this invoice is created and IRD-synced immediately
      // (see appointmentBillingService.createBilling), so it must be
      // correct from the start, not "fixed later". `applyTax` (when the
      // caller passes one) is a per-invoice override from the caller's own
      // checkbox; defaults to OFF (not the clinic-wide setting) when the
      // caller has no checkbox of its own, per the "tax off by default"
      // policy applied everywhere in this session.
      //
      // Computed BEFORE resolving referral commissions (below) so referrer
      // payouts are based on the same discount-adjusted, pre-tax amount the
      // performing clinician's own commission already uses (doctorCommissionService/
      // expertCommissionService) — previously this ran after, on the raw
      // gross sum, so a referrer's cut could be computed on a bigger base
      // than the performer's cut on the identical invoice.
      const shouldApplyTax = applyTax !== undefined ? applyTax : false;
      const taxPercentage = shouldApplyTax
        ? billingSettings?.defaultTaxPercentage || 0
        : 0;
      const totals = appointmentBillingService.calculateInvoiceTotals(
        items,
        discountType || "percent",
        discountValue || 0,
        taxPercentage,
      );

      // 2. Resolve all referrers (polymorphic and multiple)
      const referralCommissionBase = totals.taxableAmount + totals.exemptAmount;
      const { processedReferrals, refPartnerId, refCommissionAmt } =
        await resolvePatientReferrals(pat, referralCommissionBase);

      const billingData = {
        invoiceNumber: "", // resolved by the Java backend; overwritten in createBilling
        clinicId: clinicId!,
        branchId: branchId || clinicId!,
        patientId: patientId,
        patientName: pat?.name || "Unknown Patient",
        patientPanVat: pat?.patientPanVat || undefined,
        doctorId: doctorId || "unassigned",
        doctorName: "Multiple/System",
        doctorType: "regular" as const,
        appointmentId: appointmentId,
        referralPartnerId: refPartnerId,
        referralCommissionAmount:
          refCommissionAmt && refCommissionAmt > 0
            ? refCommissionAmt
            : undefined,
        referrals: processedReferrals, // Save complete polymorph referral ledger on invoice
        invoiceDate: new Date(),
        items: items,
        subtotal: totals.subtotal,
        itemDiscountAmount: totals.itemDiscountAmount,
        mainDiscountAmount: totals.mainDiscountAmount,
        discountType: discountType || ("percent" as const),
        discountValue: discountValue || 0,
        discountAmount: totals.totalDiscount,
        taxPercentage,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        // A zero-total package-session-commission item is deliberately
        // NOT auto-marked "paid" here — commission is only ever generated
        // by recordPayment() on a genuine unpaid→paid transition (see the
        // explicit recordPayment call below), so auto-paid-at-creation
        // would silently skip commission for the performing clinician.
        status:
          totals.totalAmount === 0 && !hasPackageSessionCommissionItem
            ? ("paid" as const)
            : ("draft" as const),
        paymentStatus:
          totals.totalAmount === 0 && !hasPackageSessionCommissionItem
            ? ("paid" as const)
            : ("unpaid" as const),
        paidAmount: 0,
        balanceAmount: totals.totalAmount,
        createdBy: currentUser?.uid || "system",
      };

      const { id: billingId } =
        await appointmentBillingService.createBilling(billingData);

      if (hasPackageSessionCommissionItem) {
        try {
          await appointmentBillingService.recordPayment(
            billingId,
            0,
            "package",
            undefined,
            "Package session — covered by pre-paid package, no additional charge.",
          );
        } catch (payErr) {
          console.error(
            "Error recording zero-amount payment for package session commission:",
            payErr,
          );
        }
      }

      // Link billing record to the appointment in Firestore
      await appointmentService.updateAppointment(appointmentId, {
        consultationBillingId: billingId,
        consultationBillingStatus: totals.totalAmount === 0 ? "paid" : "unpaid",
        billingId: null,
        billingStatus: "unpaid",
        paymentStatus: totals.totalAmount === 0 ? "paid" : "unpaid",
        updatedAt: new Date(),
      } as any);

      // Log commissions
      // Commission generation has been safely migrated to the `recordPayment` flow
      // in appointments-billing.tsx so that they are strictly generated when the invoice is paid.

      console.log(
        "Doctor Consultation Bill automatically generated:",
        billingId,
      );

      return billingId;
    } catch (err) {
      console.error("Error automatically generating consultation bill:", err);
      throw err;
    }
  };

  // Dynamic state machine triggers
  const handleCheckIn = async (appointmentId: string) =>
    runGuarded(`check-in-${appointmentId}`, async () => {
      try {
        const appt = appointments.find((a) => a.id === appointmentId);

        if (!appt) {
          throw new Error("Appointment not found");
        }

        await appointmentService.updateAppointmentStatus(
          appointmentId,
          "confirmed",
        );

        // Generate consultation bill if doctor is assigned AND no bill exists yet
        const hasExistingBill =
          !!appt.billingId || !!(appt as any).consultationBillingId;

        if (appt.doctorId && appt.doctorId !== "unassigned" && !hasExistingBill) {
          await createConsultationBill(
            appt.patientId,
            appt.doctorId,
            appointmentId,
            appt.reason || "General consultation",
            true,
          );
        }

        // Trigger Check-In SMS in background without blocking UI
        sendCheckInSMS(
          appt.patientId,
          appt.clinicId || clinicId || "standalone",
          appointmentId,
          appt.branchId || branchId || undefined,
        ).catch((err) => console.error("Auto check-in SMS failed:", err));

        addToast({
          title: "Checked In Successfully",
          description: "Patient has been marked as Arrived and placed in Lobby.",
          color: "success",
        });
      } catch (err) {
        console.error("Error checking in patient:", err);
        addToast({
          title: "Check-in Failed",
          description: "Could not update status. Please try again.",
          color: "danger",
        });
      }
    });

  // Finds the doctor from this patient's most recent OTHER appointment that
  // actually had a real doctor assigned — used to pre-fill routing for a
  // repeat patient who wasn't given a doctor at intake, so staff aren't
  // forced to re-pick from scratch every visit. `appointments` already holds
  // the clinic's full history (subscribeToClinicAppointments is unfiltered
  // by date), so this is a pure client-side lookup, no extra Firestore read.
  const getLastSeenDoctorId = (
    patientId: string,
    excludeAppointmentId: string,
  ): string | null => {
    const priorVisits = appointments
      .filter(
        (a) =>
          a.patientId === patientId &&
          a.id !== excludeAppointmentId &&
          a.doctorId &&
          a.doctorId !== "unassigned",
      )
      .sort(
        (a, b) =>
          new Date(b.appointmentDate).getTime() -
          new Date(a.appointmentDate).getTime(),
      );

    return priorVisits[0]?.doctorId || null;
  };

  const handleSendToDoctor = (appointmentId: string) => {
    const appt = appointments.find((a) => a.id === appointmentId);

    if (!appt) return;
    const alreadyAssigned =
      appt.doctorId && appt.doctorId !== "unassigned" ? appt.doctorId : null;
    const lastSeenDoctorId = alreadyAssigned
      ? null
      : getLastSeenDoctorId(appt.patientId, appt.id);

    setRoutingAppointment(appt);
    setRoutingCabin(appt.cabinName || "");
    setRoutingDoctorId(alreadyAssigned || lastSeenDoctorId || "");
    setRoutingChargeConsultation(false);
    setRoutingApplyTax(false);
    setRoutingAddCommission(false);
    setRoutingTarget("doctor");
    setIsRoutingModalOpen(true);

    if (lastSeenDoctorId) {
      const docName =
        doctors.find((d) => d.id === lastSeenDoctorId)?.name || "their usual doctor";

      addToast({
        title: "Pre-filled Last-Seen Doctor",
        description: `Defaulted to ${docName} from this patient's last visit — change it below if this visit is different.`,
        color: "primary",
      });
    }
  };

  const handleSendToExpert = (appointmentId: string) => {
    const appt = appointments.find((a) => a.id === appointmentId);

    if (!appt) return;
    setRoutingAppointment(appt);
    setRoutingCabin(appt.cabinName || "");
    setRoutingExpertId(
      appt.assignedExpertId && appt.assignedExpertId !== "unassigned"
        ? appt.assignedExpertId
        : "",
    );
    setRoutingAddCommission(false);
    setRoutingChargeConsultation(false);
    setRoutingApplyTax(false);
    setRoutingTarget("expert");
    setIsRoutingModalOpen(true);
  };

  const handleConfirmRoute = async () => {
    if (!routingAppointment) return;

    return runGuarded(`confirm-route-${routingAppointment.id}`, async () => {
      try {
        // A patient is one physical person. When multiple clinicians are
        // assigned to a single visit (e.g. a doctor consult + an expert
        // procedure), each gets its own, fully independent appointment
        // record — nothing otherwise stops both from being routed
        // "in-progress" into two different cabins at once, which would
        // claim the same patient is physically in two rooms simultaneously.
        // Block routing a second appointment while a sibling appointment
        // for the same patient is already active in a doctor/expert cabin.
        const otherActiveAppt = appointments.find(
          (a) =>
            a.patientId === routingAppointment.patientId &&
            a.id !== routingAppointment.id &&
            (getPatientStage(a) === "doctor" ||
              getPatientStage(a) === "expert"),
        );

        if (otherActiveAppt) {
          addToast({
            title: "Patient Already With a Clinician",
            description: `${getPatientName(routingAppointment.patientId)} is currently in ${otherActiveAppt.cabinName || "a cabin"} with ${getDoctorName(otherActiveAppt)}. Complete or send back that visit before routing this one.`,
            color: "warning",
          });

          return;
        }

        // Defense in depth — the cabin <select>'s disabled options already
        // prevent picking an occupied room, but re-check here in case of a
        // stale render (another patient routed there between opening this
        // modal and confirming).
        if (routingCabin && occupiedCabins[routingCabin]) {
          addToast({
            title: "Cabin Already Occupied",
            description: `${routingCabin} is currently occupied by ${occupiedCabins[routingCabin]}. Please choose a different room.`,
            color: "danger",
          });

          return;
        }

        const updateData: any = {
          status: "in-progress",
          cabinName: routingCabin,
          updatedAt: new Date(),
        };

        if (routingTarget === "doctor") {
          if (!routingDoctorId || routingDoctorId === "unassigned") {
            addToast({
              title: "Doctor Required",
              description: "Please select a doctor to route the patient to.",
              color: "warning",
            });

            return;
          }
          updateData.doctorId = routingDoctorId;
          updateData.doctorConsultationCompleted = false;

          // Append-only: a prior "[Routed to: Expert]" marker (if any) is left
          // in place so notes keep the full routing history instead of only
          // ever reflecting the most recent route.
          let updatedNotes = routingAppointment.notes || "";

          if (!updatedNotes.includes("[Routed to: Doctor]")) {
            updatedNotes = (updatedNotes + " [Routed to: Doctor]").trim();
          }
          updateData.notes = updatedNotes;
        }

        if (routingTarget === "expert") {
          if (!routingExpertId || routingExpertId === "unassigned") {
            addToast({
              title: "Expert Required",
              description: "Please select an expert to route the patient to.",
              color: "warning",
            });

            return;
          }
          updateData.assignedExpertId = routingExpertId;
          updateData.status = "in-progress";

          if (
            routingAppointment.doctorId &&
            routingAppointment.doctorId !== "unassigned"
          ) {
            updateData.doctorConsultationCompleted = true;

            // Append-only — see the "routed to: Doctor" branch above for why.
            let updatedNotes = routingAppointment.notes || "";

            if (!updatedNotes.includes("[Routed to: Expert]")) {
              updatedNotes = (updatedNotes + " [Routed to: Expert]").trim();
            }
            updateData.notes = updatedNotes;
          }
        }

        await appointmentService.updateAppointment(
          routingAppointment.id,
          updateData,
        );

        let createdBillingId = "";

        if (routingTarget === "doctor" && routingChargeConsultation) {
          createdBillingId =
            (await createConsultationBill(
              routingAppointment.patientId,
              routingDoctorId,
              routingAppointment.id,
              routingAppointment.reason || "General consultation",
              routingAddCommission,
              routingAppointment.appointmentTypeId,
              true,
              undefined,
              routingApplyTax,
              routingDiscountType,
              routingDiscountValue,
            )) || "";
        }

        addToast({
          title:
            routingTarget === "expert"
              ? `Sent to Expert Cabin`
              : `Sent to Doctor Cabin`,
          description: `Patient routed to ${routingCabin || "unassigned Room/Cabin"}.`,
          color: "success",
        });
        setIsRoutingModalOpen(false);
        setRoutingAppointment(null);
        setRoutingTarget("default");
        setRoutingExpertId("");
        setRoutingDoctorId("");

        if (
          routingTarget === "doctor" &&
          routingChargeConsultation &&
          createdBillingId
        ) {
          navigate(
            `/dashboard/appointments-billing/${createdBillingId}?from=front-office&tab=${activeTab}`,
          );
        }
      } catch (err) {
        console.error("Error routing patient:", err);
        addToast({
          title: "Routing Failed",
          description:
            err instanceof Error
              ? err.message
              : "Failed to update cabin routing.",
          color: "danger",
        });
      }
    });
  };

  const handleAssignCabin = async (
    appointmentId: string,
    cabinName: string,
  ) => {
    try {
      // This direct cabin-edit path previously had no occupancy check at
      // all (unlike handleConfirmRoute), so staff could manually place a
      // patient into a room another patient was already routed to — apply
      // the same exclusive-cabin conflict check here.
      if (cabinName && EXCLUSIVE_CABIN_NAMES.has(cabinName)) {
        const conflictingAppt = appointments.find(
          (a) =>
            a.id !== appointmentId &&
            a.status === "in-progress" &&
            a.cabinName === cabinName,
        );

        if (conflictingAppt) {
          addToast({
            title: "Room/Cabin Occupied",
            description: `${cabinName} is currently occupied by ${getPatientName(conflictingAppt.patientId)}. Please choose a different room.`,
            color: "warning",
          });

          return;
        }
      }

      // Audit trail: who (re)assigned the cabin — this direct edit path
      // previously left zero trace, unlike Send Back to Lobby/routing.
      const targetAppt = appointments.find((a) => a.id === appointmentId);
      const priorNotes = targetAppt?.notes || "";
      const marker = `[Cabin set to "${cabinName || "Unassigned"}" by ${currentUser?.uid || "unknown"}]`;

      await appointmentService.updateAppointment(appointmentId, {
        cabinName: cabinName,
        notes: priorNotes ? `${priorNotes}\n${marker}` : marker,
        updatedAt: new Date(),
      } as any);
      addToast({
        title: "Room/Cabin Updated",
        description: `Patient cabin updated to: ${cabinName || "Unassigned"}.`,
        color: "success",
      });
    } catch (err) {
      console.error("Error assigning cabin:", err);
      addToast({
        title: "Assignment Failed",
        description:
          err instanceof Error
            ? err.message
            : "Could not update Room/Cabin. Please try again.",
        color: "danger",
      });
    }
  };

  const ensureBookedAppointmentTypeBilled = async (
    appt: Appointment,
    completingAsExpert: boolean,
  ) => {
    if (!clinicId) return null;

    const billingId = appt.consultationBillingId || appt.billingId;

    if (!billingId) return null;

    try {
      const billing = await appointmentBillingService.getBillingById(billingId);

      if (!billing) return null;

      // Get the price of the booked appointment type first to check if it's a consultation
      const apptType = appointmentTypes.find(
        (t) => t.id === appt.appointmentTypeId,
      );

      if (!apptType) return null;

      const isApptTypeConsultation = apptType.name
        .toLowerCase()
        .includes("consult");

      // Check if the booked appointment type is already in the billing items
      const hasBookedItem = billing.items?.some(
        (item: any) =>
          item.appointmentTypeId === appt.appointmentTypeId ||
          (isApptTypeConsultation &&
            item.appointmentTypeId === "consultation-fee"),
      );

      if (hasBookedItem) {
        return billing.paymentStatus || "unpaid";
      }

      // This invoice may already be IRD-synced (sync happens at creation,
      // not at a later "Finalize") — updateBilling would throw rather than
      // silently patch a locked invoice's items. Check up front so the
      // front-desk user gets a clear reason instead of nothing happening.
      if (isBillingLocked(billing)) {
        addToast({
          title: "Invoice Already Locked",
          description: `${apptType.name} could not be added — this invoice is already IRD-synced. Create a separate invoice for this charge from Appointment Billing.`,
          color: "warning",
        });

        return billing.paymentStatus || "unpaid";
      }

      const price = Number(apptType.price) || 0;

      if (price <= 0) return null;

      // Previously inferred purely from assignedExpertId being set — always
      // true once an expert was assigned, even when the DOCTOR is the one
      // force-completing early (e.g. "Send to Billing" at the doctor
      // stage). completingAsExpert reflects who is actually closing out
      // right now, so this fallback line item attributes to the correct
      // clinician instead of always crediting the expert.
      const isExpert =
        completingAsExpert &&
        !!(appt.assignedExpertId && appt.assignedExpertId !== "unassigned");
      const clinicianId = isExpert
        ? appt.assignedExpertId
        : appt.doctorId || "unassigned";
      const docInfo =
        doctors.find((d) => d.id === clinicianId) ||
        experts.find((e) => e.id === clinicianId);

      const newItem = {
        id: crypto.randomUUID(),
        appointmentTypeId: appt.appointmentTypeId,
        appointmentTypeName: apptType.name || "Procedure/Service Fee",
        price: price,
        quantity: 1,
        commission: (docInfo as any)?.defaultCommission || 0,
        doctorId: clinicianId,
        doctorName: docInfo?.name || "Clinician",
        amount: price,
      };

      const updatedItems = [...(billing.items || []), newItem];
      const totals = appointmentBillingService.calculateInvoiceTotals(
        updatedItems,
        billing.discountType || "percent",
        billing.discountValue || 0,
        billing.taxPercentage || 0,
      );

      const newPaid = billing.paidAmount || 0;
      const newTotal = totals.totalAmount;
      const newBalance = newTotal - newPaid;
      const newPaymentStatus =
        newPaid >= newTotal ? "paid" : newPaid > 0 ? "partial" : "unpaid";
      const newStatus = newPaymentStatus === "paid" ? "paid" : "draft";

      await appointmentBillingService.updateBilling(billingId, {
        items: updatedItems,
        subtotal: totals.subtotal,
        itemDiscountAmount: totals.itemDiscountAmount,
        mainDiscountAmount: totals.mainDiscountAmount,
        discountAmount: totals.totalDiscount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        balanceAmount: newBalance,
        paymentStatus: newPaymentStatus,
        status: newStatus,
      });

      return newPaymentStatus;
    } catch (err) {
      console.error("Error ensuring booked appointment type is billed:", err);

      return null;
    }
  };

  const handleCompleteConsultation = async (
    appointmentId: string,
    forceComplete: boolean = false,
  ) =>
    runGuarded(`complete-consultation-${appointmentId}`, async () => {
      try {
        const appt = appointments.find((a) => a.id === appointmentId);

        if (!appt) return;
        const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
        const hasExpert =
          appt.assignedExpertId && appt.assignedExpertId !== "unassigned";

        if (
          hasDoctor &&
          hasExpert &&
          !appt.doctorConsultationCompleted &&
          !forceComplete
        ) {
          // Complete the Doctor part and route to Expert
          await appointmentService.updateAppointment(appointmentId, {
            doctorConsultationCompleted: true,
            updatedAt: new Date(),
          } as any);

          if (clinicId && appt.assignedExpertId) {
            const patObj = patients.find((p) => p.id === appt.patientId);
            const patName = patObj ? patObj.name : "Patient";
            const docObj = doctors.find((d) => d.id === appt.doctorId);
            const docName = docObj ? docObj.name : "Clinician";

            NotificationService.sendNotification(clinicId, {
              title: "New Procedure Referral",
              message: `Patient ${patName} has been routed to your cabin by Dr. ${docName} for procedure.`,
              type: "expert_queue",
              targetRole: "expert",
              targetUserId: appt.assignedExpertId,
            });
          }

          addToast({
            title: "Consultation Completed",
            description:
              "Doctor consultation completed. Routing patient to Expert Cabin.",
            color: "success",
          });
        } else {
          // Standard completion (no expert, or expert consultation completed)
          let billingStatus = appt.billingStatus || "unpaid";
          let paymentStatus = appt.paymentStatus || "unpaid";

          const newPS = await ensureBookedAppointmentTypeBilled(
            appt,
            appt.doctorConsultationCompleted === true,
          );

          if (newPS) {
            billingStatus = newPS;
            paymentStatus = newPS;
          }

          await appointmentService.updateAppointment(appointmentId, {
            status: "completed",
            doctorConsultationCompleted: true,
            billingStatus,
            paymentStatus,
            updatedAt: new Date(),
          } as any);

          if (appt.patientPackageId && clinicId) {
            try {
              await patientPackageService.consumeSession(appt.patientPackageId, {
                appointmentId: appt.id,
                clinicianId: currentUser?.uid,
                clinicianName:
                  (userData as any)?.name ||
                  currentUser?.displayName ||
                  "Unknown Clinician",
              });
              addToast({
                title: "Session Consumed",
                description: "1 package session was automatically deducted.",
                color: "success",
              });
            } catch (err) {
              console.error("Error consuming session", err);
              addToast({
                title: "Package Session Not Deducted",
                description:
                  err instanceof Error
                    ? err.message
                    : "The consultation was completed, but the package session could not be deducted. Check the patient's package manually.",
                color: "warning",
              });
            }
          }

          if (clinicId) {
            const patObj = patients.find((p) => p.id === appt.patientId);
            const patName = patObj ? patObj.name : "Patient";

            NotificationService.sendNotification(clinicId, {
              title: "Consultation Completed",
              message: `Consultation for patient ${patName} is completed. Ready for billing settlement.`,
              type: "billing_queue",
              targetRole: "front-office",
            });
          }

          addToast({
            title: "Consultation Completed",
            description: "Patient consultation marked as complete.",
            color: "success",
          });
        }
      } catch (err) {
        console.error("Error completing consultation:", err);
        addToast({
          title: "Error",
          description: "Failed to complete consultation.",
          color: "danger",
        });
      }
    });

  const handleCompleteCheckout = async (appointmentId: string) =>
    runGuarded(`complete-checkout-${appointmentId}`, async () => {
      try {
        const appt = appointments.find((a) => a.id === appointmentId);

        if (!appt) return;

        // 1. Enforce workflow gating to verify clinical documentation
        const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
        const hasExpert =
          appt.assignedExpertId && appt.assignedExpertId !== "unassigned";

        const isTriageCompleted = appt.notes?.includes(
          "[Triage Vitals Recorded]",
        );

        let isConsultationCompleted = true;

        if (hasDoctor) {
          isConsultationCompleted = appt.doctorConsultationCompleted === true;
        }

        // If there's an expert, we should also ensure they've completed it if it's dual-assigned
        // However, usually doctorConsultationCompleted covers it, or the fact it reached billing stage.

        if (!isTriageCompleted && hasDoctor) {
          addToast({
            title: "Incomplete Clinical Documentation",
            description:
              "Cannot complete checkout. Patient triage vitals have not been recorded.",
            color: "danger",
          });

          return;
        }

        if (hasDoctor && !isConsultationCompleted) {
          addToast({
            title: "Incomplete Clinical Documentation",
            description:
              "Cannot complete checkout. Doctor consultation has not been marked as completed.",
            color: "danger",
          });

          return;
        }

        // Check state integrity to prevent premature settlement. An
        // appointment can carry TWO independent billing links —
        // consultationBillingId (doctor fee, set by createConsultationBill)
        // and billingId (a separate procedure/appointment-type charge, set
        // by ensureBookedAppointmentTypeBilled) — each updated by a
        // different code path. Previously only ONE was checked here
        // (whichever billingId happened to be truthy, or the single
        // appt.billingStatus mirror field), so a patient with a paid
        // consultation fee but an unpaid procedure charge (or vice versa)
        // could be checked out with real money still owed on the OTHER
        // invoice. Every linked bill that actually exists must be
        // paid/zero before checkout proceeds.
        const linkedBillIds = Array.from(
          new Set(
            [appt.billingId, (appt as any).consultationBillingId].filter(
              (id): id is string => Boolean(id),
            ),
          ),
        );

        let hasOutstandingBalance: boolean;

        if (linkedBillIds.length > 0) {
          hasOutstandingBalance = linkedBillIds.some((id) => {
            const matchingBill = billings.find((b) => b.id === id);

            if (!matchingBill) return false; // can't find it — don't block on missing data
            if (matchingBill.totalAmount <= 0) return false;

            return !(
              matchingBill.status === "paid" ||
              matchingBill.paymentStatus === "paid"
            );
          });
        } else {
          // No linked bill at all — fall back to the appointment's own
          // mirrored status fields (e.g. a legacy record).
          hasOutstandingBalance = !(
            appt.billingStatus === "paid" || appt.paymentStatus === "paid"
          );
        }

        if (hasOutstandingBalance) {
          addToast({
            title: "Premature Settlement",
            description:
              "Cannot complete checkout. Outstanding balance exists on this appointment — record payment first.",
            color: "warning",
          });
          // Actually block — this toast previously described a rule that
          // was never enforced, letting a patient be checked out (and
          // getPatientStage/downstream UI treat the visit as fully done)
          // while still owing money, with no re-flag anywhere afterward.
          return;
        }

        await appointmentService.updateAppointment(appointmentId, {
          checkoutCompleted: true,
          updatedAt: new Date(),
        } as any);

        if (appt?.patientPackageId && clinicId) {
          try {
            await patientPackageService.consumeSession(appt.patientPackageId, {
              appointmentId: appt.id,
              clinicianId: currentUser?.uid,
              clinicianName:
                (userData as any)?.name ||
                currentUser?.displayName ||
                "System/Front Desk",
            });
          } catch (err) {
            console.error("Error consuming session during checkout:", err);
            addToast({
              title: "Package Session Not Deducted",
              description:
                err instanceof Error
                  ? err.message
                  : "Checkout completed, but the package session could not be deducted. Check the patient's package manually.",
              color: "warning",
            });
          }
        }
        addToast({
          title: "Checkout Completed",
          description: "Patient checkout finalized successfully.",
          color: "success",
        });
      } catch (err) {
        console.error("Error completing checkout:", err);
        addToast({
          title: "Error",
          description: "Failed to complete checkout.",
          color: "danger",
        });
      }
    });

  const handleOpenTriage = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setVitals({
      bpSystolic: "",
      bpDiastolic: "",
      pulse: "",
      temp: "",
      weight: "",
      spo2: "",
      complaints: "",
    });
    setIsTriageModalOpen(true);
  };

  const handleOpenProcedure = (appt: Appointment) => {
    setSelectedAppointment(appt);

    const apptTypeName = getApptTypeLabel(appt.appointmentTypeId);
    const apptType = appointmentTypes.find(
      (t) => t.id === appt.appointmentTypeId,
    );

    const recommended = (appt as any).recommendedProcedure;
    let initialType = apptTypeName;
    let initialArea = "Full Face";

    // Check if the booked appointment type is a consultation or front-desk-billed type
    // that was already charged. If so, start fee at 0 — the expert has no procedure to add.
    const isBookedTypeAlreadyBilled = (() => {
      if (!apptType) return false;
      const nameLower = apptType.name.toLowerCase();

      return (
        apptType.billAtFrontDesk ||
        nameLower.includes("consult") ||
        nameLower.includes("hair analy") ||
        nameLower.includes("skin analy")
      );
    })();

    let initialFee = isBookedTypeAlreadyBilled
      ? ""
      : apptType
        ? String(apptType.price || "")
        : "";

    if (recommended) {
      initialType = recommended.name || initialType;
      initialFee =
        recommended.fee !== undefined && recommended.fee > 0
          ? String(recommended.fee)
          : initialFee;
      initialArea = recommended.area || initialArea;
    }

    setProcedure({
      procedureType: initialType,
      energy: "",
      spotSize: "",
      pulseWidth: "",
      passes: "",
      area: initialArea,
      fee: initialFee,
      notes: "",
    });
    setIsProcedureModalOpen(true);

    if (clinicId && appt.patientId) {
      setLoadingHistory(true);
      PatientNoteEntriesService.getSectionNoteEntries(
        clinicId,
        appt.patientId,
        "laser-procedure",
      )
        .then((entries) => {
          setHistoricalProcedures(entries);
        })
        .catch((err) => {
          console.error("Error loading patient procedure history:", err);
        })
        .finally(() => {
          setLoadingHistory(false);
        });

      patientPackageService
        .getPatientPackages(appt.patientId, clinicId)
        .then((data) => {
          setModalActivePackages(
            data.filter(
              (p) => p.status !== "expired" && p.status !== "completed",
            ),
          );
        })
        .catch(console.error);
    }
  };

  const handleSaveTriage = async (
    e?: React.FormEvent,
    routeTarget?: "doctor" | "expert",
  ) => {
    if (e) e.preventDefault();
    if (!selectedAppointment || !clinicId) return;

    setTriageSaving(true);
    try {
      // Format a clean, highly readable medical vitals string
      const formattedBP =
        vitals.bpSystolic && vitals.bpDiastolic
          ? `${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg`
          : "Not recorded";
      const formattedTemp = vitals.temp ? `${vitals.temp} °F` : "Not recorded";
      const formattedPulse = vitals.pulse
        ? `${vitals.pulse} bpm`
        : "Not recorded";
      const formattedWeight = vitals.weight
        ? `${vitals.weight} kg`
        : "Not recorded";
      const formattedSpO2 = vitals.spo2 ? `${vitals.spo2}%` : "Not recorded";
      const formattedComplaints = vitals.complaints.trim() || "None reported";

      const vitalsLog = `BP: ${formattedBP} | Temp: ${formattedTemp} | Pulse: ${formattedPulse} | Weight: ${formattedWeight} | SpO2: ${formattedSpO2}\nChief Complaints: ${formattedComplaints}`;

      // 1. Save directly into patient Note Entries (sectionKey = "triage-vitals")
      await PatientNoteEntriesService.saveNoteEntry(
        clinicId,
        selectedAppointment.patientId,
        "triage-vitals",
        "Triage Vitals",
        vitalsLog,
        currentUser?.uid || "front-desk",
      );

      // 2. Add metadata record directly on the appointment to state triage is
      // completed. Append-only — a prior routing/send-back-to-lobby marker
      // (e.g. "[Routed to: Doctor]", "[Sent Back to Lobby] ...") must not be
      // silently erased by triage the way a flat overwrite previously did.
      const priorNotes = selectedAppointment.notes || "";
      const triageNoteLine = `[Triage Vitals Recorded] BP: ${formattedBP}, Temp: ${formattedTemp}\nComplaints: ${formattedComplaints}`;
      const updateData: any = {
        notes: priorNotes ? `${priorNotes}\n${triageNoteLine}` : triageNoteLine,
        updatedAt: new Date(),
      };

      // Only actually route to in-progress if a clinician for that target is
      // really assigned — otherwise this appointment silently lands on the
      // Expert (or Doctor) tab with nobody actually responsible for it.
      const hasAssignedClinicianForTarget =
        routeTarget === "doctor"
          ? Boolean(
              selectedAppointment.doctorId &&
                selectedAppointment.doctorId !== "unassigned",
            )
          : routeTarget === "expert"
            ? Boolean(
                (selectedAppointment as any).assignedExpertId &&
                  (selectedAppointment as any).assignedExpertId !== "unassigned",
              )
            : false;

      if (routeTarget && hasAssignedClinicianForTarget) {
        updateData.status = "in-progress";
        // Fallback to assigned cabin if it's already selected
        updateData.cabinName = selectedAppointment.cabinName || "";
        if (
          routeTarget === "expert" &&
          selectedAppointment.doctorId &&
          selectedAppointment.doctorId !== "unassigned"
        ) {
          updateData.doctorConsultationCompleted = true;
        }
      } else if (routeTarget && !hasAssignedClinicianForTarget) {
        addToast({
          title: "No Clinician Assigned",
          description: `Vitals were saved, but the patient was NOT routed — no ${routeTarget} is assigned to this appointment yet.`,
          color: "warning",
        });
      }

      await appointmentService.updateAppointment(
        selectedAppointment.id,
        updateData,
      );

      // Trigger notification for Doctor that Triage is done and patient is ready
      if (clinicId) {
        const patObj = patients.find(
          (p) => p.id === selectedAppointment.patientId,
        );
        const patName = patObj ? patObj.name : "Patient";

        if (
          selectedAppointment.doctorId &&
          selectedAppointment.doctorId !== "unassigned"
        ) {
          NotificationService.sendNotification(clinicId, {
            title: "Patient Vitals Recorded",
            message: `Vitals for patient ${patName} have been recorded. They are now waiting in your cabin.`,
            type: "doctor_queue",
            targetRole: "doctor",
            targetUserId: selectedAppointment.doctorId,
          });
        }
      }

      addToast({
        title: "Triage Vitals Saved",
        description: routeTarget
          ? `Vitals recorded and patient routed to ${routeTarget === "doctor" ? "Doctor" : "Expert"} cabin.`
          : "Vitals recorded successfully. Patient is ready for doctor cabin.",
        color: "success",
      });

      setIsTriageModalOpen(false);
      setSelectedAppointment(null);
    } catch (err) {
      console.error("Error saving triage vitals:", err);
      addToast({
        title: "Error Saving Triage",
        description: "Failed to record vitals to database.",
        color: "danger",
      });
    } finally {
      setTriageSaving(false);
    }
  };

  const handleSaveProcedure = async (
    e: React.FormEvent | null,
    target: "doctor" | "billing" | "expert" = "billing",
  ) => {
    if (e) e.preventDefault();
    if (!selectedAppointment || !clinicId) return;

    // selectedAppointment is a snapshot captured when this modal opened —
    // on a routing round-trip (doctor->expert->doctor etc.) a newer
    // recommendedProcedure may already be live in Firestore by the time
    // this saves. Read off the realtime-synced appointments array instead
    // so the "preserve existing recommendation" fallbacks below don't
    // silently write a stale value back over a newer one.
    const currentAppt =
      appointments.find((a) => a.id === selectedAppointment.id) ||
      selectedAppointment;

    setProcedureSaving(true);
    try {
      const currentUserId = currentUser?.uid || "expert";

      let packageIdToConsume = selectedAppointment.patientPackageId;
      let actualProcedureName = procedure.procedureType;

      if (procedure.procedureType.startsWith("consume_pkg_")) {
        packageIdToConsume = procedure.procedureType.replace(
          "consume_pkg_",
          "",
        );
        const pkg = modalActivePackages.find(
          (p) => p.id === packageIdToConsume,
        );

        actualProcedureName = pkg ? pkg.packageName : "Package Session";
      }

      const clinicianName =
        (userData as any)?.name || currentUser?.displayName || "Clinician";
      const settingsStr = `Energy: ${procedure.energy || "N/A"} J/cm² | Spot: ${procedure.spotSize || "N/A"} mm | Pulse: ${procedure.pulseWidth || "N/A"} ms | Passes: ${procedure.passes || "N/A"}`;
      const procedureNoteContent = `Procedure: ${actualProcedureName}\nArea: ${procedure.area || "N/A"}\nLaser Settings: ${settingsStr}\nClinical Notes: ${procedure.notes || "None"}\nCharge: ${procedure.fee ? `${procedure.fee} NPR` : "Free/Included"}\nWritten By: ${clinicianName}`;

      // Save directly into patient Note Entries (sectionKey = "laser-procedure")
      await PatientNoteEntriesService.saveNoteEntry(
        clinicId,
        selectedAppointment.patientId,
        "laser-procedure",
        "Laser & Procedure Log",
        procedureNoteContent,
        currentUserId,
      );

      // If fee > 0, store as recommended procedure instead of billing immediately
      const feeNum = Number(procedure.fee);
      let newPaymentStatus: "unpaid" | "partial" | "paid" =
        selectedAppointment.paymentStatus || "unpaid";

      let recommendedProcedureData: any = null;

      if (feeNum > 0) {
        const apptTypeLabel = getApptTypeLabel(
          selectedAppointment.appointmentTypeId,
        );
        // De-duped — apptTypeLabel is always already present in
        // appointmentTypes (it's derived from that same list), so without
        // this a procedure matching the appointment's own booked type would
        // appear twice here and get billed twice (found via a real invoice
        // with the same line item duplicated).
        const allPossibleNames = Array.from(
          new Set([
            ...(apptTypeLabel ? [apptTypeLabel] : []),
            ...modalActivePackages.map((p) => `consume_pkg_${p.id}`),
            ...appointmentTypes.map((t) => t.name),
            "Other",
          ]),
        );

        const getProcedureList = (typeStr: string): string[] => {
          if (!typeStr) return [];
          const sortedOptions = [...allPossibleNames].sort(
            (a, b) => b.length - a.length,
          );
          const selected: string[] = [];
          let remaining = typeStr;

          for (const option of sortedOptions) {
            if (!option) continue;
            const idx = remaining.indexOf(option);

            if (idx !== -1) {
              selected.push(option);
              remaining =
                remaining.substring(0, idx) +
                remaining.substring(idx + option.length);
            }
          }

          return allPossibleNames.filter((id) => selected.includes(id));
        };

        const procList = getProcedureList(actualProcedureName);
        const itemsList: any[] = [];
        let calculatedFee = 0;

        procList.forEach((procName) => {
          if (procName.startsWith("consume_pkg_")) return;
          const matchingType = appointmentTypes.find(
            (t) => t.name === procName,
          );

          if (matchingType) {
            let wasAlreadyBilled = false;

            if (selectedAppointment.appointmentTypeId === matchingType.id) {
              const nameLower = matchingType.name.toLowerCase();
              const isConsult = nameLower.includes("consult");

              if (
                matchingType.billAtFrontDesk ||
                nameLower.includes("hair analy") ||
                nameLower.includes("skin analy") ||
                isConsult
              ) {
                wasAlreadyBilled = true;
              }
            }
            if (!wasAlreadyBilled) {
              itemsList.push({
                name: procName,
                fee: Number(matchingType.price || 0),
                id: matchingType.id,
              });
              calculatedFee += Number(matchingType.price || 0);
            }
          }
        });

        // If the expert manually added extra fee on top of valid (non-already-billed) items,
        // add an adjustment line. But if itemsList is empty because ALL items were already billed
        // (e.g. only "Doctor Consultation" was selected), do NOT create a ghost custom item.
        if (itemsList.length > 0 && calculatedFee !== feeNum) {
          const adjustmentDiff = feeNum - calculatedFee;

          if (adjustmentDiff > 0) {
            itemsList.push({
              name: `${actualProcedureName} (Additional Fee)`,
              fee: adjustmentDiff,
              id: "custom",
            });
          }
        }

        // If nothing is billable (all already-billed types), treat as fee=0 — no procedure to add
        if (itemsList.length === 0) {
          // No real procedure items; fall through to the feeNum=0 path below
          recommendedProcedureData =
            (currentAppt as any).recommendedProcedure || null;
          // skip the rest of the feeNum>0 block
        } else {
          const newItems = itemsList;

          const existingRec = (currentAppt as any).recommendedProcedure;

          if (
            existingRec &&
            existingRec.items &&
            Array.isArray(existingRec.items)
          ) {
            // Merge items, avoiding duplicates
            const mergedItems = [...existingRec.items];

            newItems.forEach((newItem) => {
              const exists = mergedItems.some(
                (existingItem: any) =>
                  (newItem.id !== "custom" && existingItem.id === newItem.id) ||
                  (newItem.id === "custom" &&
                    existingItem.name === newItem.name),
              );

              if (!exists) {
                mergedItems.push(newItem);
              }
            });

            recommendedProcedureData = {
              name: mergedItems.map((i: any) => i.name).join(", "),
              fee: mergedItems.reduce((sum: number, i: any) => sum + i.fee, 0),
              area: procedure.area || existingRec.area || "N/A",
              items: mergedItems,
            };
          } else {
            recommendedProcedureData = {
              name: actualProcedureName,
              fee: feeNum,
              area: procedure.area || "N/A",
              items: newItems,
            };
          }
        } // end: itemsList.length > 0 else block
      } else {
        // If the expert logged settings but did not specify a fee, preserve the doctor's recommended procedure
        recommendedProcedureData =
          (currentAppt as any).recommendedProcedure || null;
      }
      // End of procedure check

      if (target === "doctor") {
        await appointmentService.updateAppointment(selectedAppointment.id, {
          recommendedProcedure: recommendedProcedureData,
          patientPackageId: packageIdToConsume,
          updatedAt: new Date(),
        } as any);

        if (packageIdToConsume && clinicId) {
          try {
            await patientPackageService.consumeSession(packageIdToConsume, {
              appointmentId: selectedAppointment.id,
              clinicianId: currentUser?.uid,
              clinicianName:
                (userData as any)?.name ||
                currentUser?.displayName ||
                "Unknown Clinician",
            });
            addToast({
              title: "Session Consumed",
              description: "1 package session was automatically deducted.",
              color: "success",
            });
          } catch (err) {
            console.error("Error consuming session", err);
            addToast({
              title: "Package Session Not Deducted",
              description:
                err instanceof Error
                  ? err.message
                  : "The procedure was logged, but the package session could not be deducted. Check the patient's package manually.",
              color: "warning",
            });
          }
        }

        addToast({
          title: "Procedure Log Saved",
          description:
            "Procedure logged successfully. Please select a doctor to route to.",
          color: "success",
        });

        setIsProcedureModalOpen(false);
        setRoutingAppointment(selectedAppointment);
        setRoutingCabin(selectedAppointment.cabinName || "");
        setRoutingDoctorId(
          selectedAppointment.doctorId &&
            selectedAppointment.doctorId !== "unassigned"
            ? selectedAppointment.doctorId
            : "",
        );
        setRoutingChargeConsultation(false);
        setRoutingApplyTax(false);
        setRoutingAddCommission(false);
        setRoutingTarget("doctor");
        setIsRoutingModalOpen(true);

        setSelectedAppointment(null);
        setHistoricalProcedures([]);
        setModalActivePackages([]);
        setProcedure({
          procedureType: "CO2 Laser Resurfacing",
          energy: "",
          spotSize: "",
          pulseWidth: "",
          passes: "",
          area: "Full Face",
          fee: "",
          notes: "",
        });

        return;
      }

      // Mark appointment status based on target route
      let newStatus = target === "billing" ? "completed" : "in-progress";
      let updatedNotes = selectedAppointment.notes || "";
      let doctorConsultationCompleted =
        target === "billing"
          ? true
          : selectedAppointment.doctorConsultationCompleted;

      if (target === "expert") {
        // Append-only, not destructive — see handleConfirmRoute for the
        // same reasoning: notes should keep the full routing history.
        if (!updatedNotes.includes("[Routed to: Expert]")) {
          updatedNotes = (updatedNotes + " [Routed to: Expert]").trim();
        }
        doctorConsultationCompleted = true; // Complete the doctor portion so it goes to expert cabin
      }

      await appointmentService.updateAppointment(selectedAppointment.id, {
        status: newStatus as any,
        notes: updatedNotes,
        doctorConsultationCompleted: doctorConsultationCompleted,
        billingStatus: newPaymentStatus,
        paymentStatus: newPaymentStatus,
        patientPackageId: packageIdToConsume,
        recommendedProcedure: recommendedProcedureData,
        updatedAt: new Date(),
      } as any);

      if (packageIdToConsume && clinicId) {
        try {
          await patientPackageService.consumeSession(packageIdToConsume, {
            appointmentId: selectedAppointment.id,
            clinicianId: currentUser?.uid,
            clinicianName:
              (userData as any)?.name ||
              currentUser?.displayName ||
              "Unknown Clinician",
          });
          addToast({
            title: "Session Consumed",
            description: "1 package session was automatically deducted.",
            color: "success",
          });
        } catch (err) {
          console.error("Error consuming session", err);
          addToast({
            title: "Package Session Not Deducted",
            description:
              err instanceof Error
                ? err.message
                : "Routing completed, but the package session could not be deducted. Check the patient's package manually.",
            color: "warning",
          });
        }
      }

      // Trigger notification based on routing target
      if (clinicId) {
        const patObj = patients.find(
          (p) => p.id === selectedAppointment.patientId,
        );
        const patName = patObj ? patObj.name : "Patient";

        if (target === "billing") {
          NotificationService.sendNotification(clinicId, {
            title: "Procedure Log Recorded",
            message: `Procedure log for patient ${patName} has been recorded. Ready for billing settlement.`,
            type: "billing_queue",
            targetRole: "front-office",
          });
        } else if (target === "expert") {
          NotificationService.sendNotification(clinicId, {
            title: "Patient Sent to Expert",
            message: `Patient ${patName} has been routed to the expert cabin.`,
            type: "expert_queue",
            targetRole: "expert",
            targetUserId: selectedAppointment.assignedExpertId,
          });
        }
      }

      addToast({
        title: "Procedure Log Saved",
        description:
          target === "billing"
            ? "Laser & Procedure details logged successfully. Patient is routed to Billing Counter."
            : "Procedure logged successfully. Patient routed to the Expert.",
        color: "success",
      });

      setIsProcedureModalOpen(false);
      setSelectedAppointment(null);
      setHistoricalProcedures([]);
      setModalActivePackages([]);
      setProcedure({
        procedureType: "CO2 Laser Resurfacing",
        energy: "",
        spotSize: "",
        pulseWidth: "",
        passes: "",
        area: "Full Face",
        fee: "",
        notes: "",
      });
    } catch (err) {
      console.error("Error saving procedure log:", err);
      addToast({
        title: "Error Saving Log",
        description: "Failed to record procedure log to database.",
        color: "danger",
      });
    } finally {
      setProcedureSaving(false);
    }
  };

  // Determine stage of patient based on appointment
  const getPatientStage = (
    appt: Appointment,
  ):
    | "scheduled"
    | "lobby"
    | "triage-done"
    | "doctor"
    | "expert"
    | "billing"
    | "pharmacy"
    | "no-show"
    | "completed" => {
    const status = appt.status?.toLowerCase();

    // Previously fell through every branch to the default "completed" case
    // below — a no-show appointment rendered identically to a genuinely
    // completed visit anywhere the UI groups/filters by stage.
    if (status === "no-show") return "no-show";
    if (status === "scheduled") return "scheduled";
    if (status === "confirmed") {
      // Check if triage vitals note header prefix exists inside notes field
      if (appt.notes?.includes("[Triage Vitals Recorded]")) {
        return "triage-done";
      }

      return "lobby";
    }
    if (status === "in-progress") {
      const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
      const hasExpert =
        appt.assignedExpertId && appt.assignedExpertId !== "unassigned";

      if (hasDoctor && hasExpert) {
        return appt.doctorConsultationCompleted ? "expert" : "doctor";
      }

      return hasDoctor ? "doctor" : "expert";
    }
    if (status === "completed") {
      let isCheckedOut =
        appt.checkoutCompleted === true ||
        appt.notes?.includes("[Checkout Completed]") ||
        appt.billingStatus === "paid" ||
        appt.paymentStatus === "paid";

      if ((appt as any).recommendedProcedure) {
        isCheckedOut = false;
      }

      if (isCheckedOut) {
        // Check if there is an active prescription sent to pharmacy
        const hasPendingPrescription = prescriptions.some(
          (p) =>
            (p.appointmentId === appt.id || p.patientId === appt.patientId) &&
            p.sendToPharmacy === true &&
            p.status === "active",
        );

        if (hasPendingPrescription) {
          return "pharmacy";
        }

        return "completed";
      }

      return "billing"; // Waiting for invoice/checkout
    }

    return "completed";
  };

  // Which exclusive cabins are currently occupied, and by whom — used to
  // warn/block routing a second patient into the same physical room while
  // someone else is already there. Excludes the patient currently being
  // routed (re-confirming their own current cabin isn't a conflict).
  const occupiedCabins: Record<string, string> = {};

  for (const a of appointments) {
    if (
      a.status === "in-progress" &&
      a.cabinName &&
      EXCLUSIVE_CABIN_NAMES.has(a.cabinName) &&
      a.id !== routingAppointment?.id
    ) {
      occupiedCabins[a.cabinName] = getPatientName(a.patientId);
    }
  }

  // Filter list by selected active tab (or, when a search query is typed,
  // find the patient across ALL stages — the whole point of searching is
  // to find someone regardless of which tab they happen to be in right
  // now, not to further narrow an already-selected tab).
  const filteredAppointments = appointments.filter((appt) => {
    const stage = getPatientStage(appt);
    const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";


    // If logged-in user has clinician profiles, only show their own patients
    if (currentDoctorId || currentExpertId) {
      const isMyDoctorPatient =
        currentDoctorId && appt.doctorId === currentDoctorId;
      const isMyExpertPatient =
        currentExpertId && appt.assignedExpertId === currentExpertId;

      if (currentDoctorId && currentExpertId) {
        if (!isMyDoctorPatient && !isMyExpertPatient) return false;
      } else if (currentDoctorId) {
        if (!isMyDoctorPatient) return false;
      } else if (currentExpertId) {
        if (!isMyExpertPatient) return false;
      }
    }

    const consBill = (appt as any).consultationBillingId
      ? billings.find((b) => b.id === (appt as any).consultationBillingId)
      : null;
    const isConsBillPaid = consBill
      ? consBill.status === "paid" || consBill.paymentStatus === "paid"
      : false;
    const isConsBillPending = consBill && !isConsBillPaid;

    if (activeTab === "urgent") {
      if (appt.isUrgent) return true;
      if (stage === "billing") return true;
      if (stage === "lobby" || stage === "scheduled") {
        if (consBill && !isConsBillPaid) return true;
      }
      if (
        !appt.onHold &&
        appt.createdAt &&
        (stage === "lobby" ||
          stage === "triage-done" ||
          stage === "doctor" ||
          stage === "expert")
      ) {
        const dObj = (appt.createdAt as any).seconds
          ? new Date((appt.createdAt as any).seconds * 1000)
          : new Date(appt.createdAt);

        if (
          !isNaN(dObj.getTime()) &&
          Math.floor((new Date().getTime() - dObj.getTime()) / 60000) > 30
        ) {
          return true;
        }
      }

      return false;
    }

    if (boardSearchQuery.trim()) {
      const q = boardSearchQuery.trim().toLowerCase();
      const name = getPatientName(appt.patientId).toLowerCase();
      const reg = getPatientReg(appt.patientId).toLowerCase();

      // Also exclude fully completed/checked-out visits from search — a
      // finished visit isn't something staff are trying to "find" on a
      // live board the same way an active one is.
      return (
        stage !== "completed" && (name.includes(q) || reg.includes(q))
      );
    }

    if (activeTab === "lobby")
      return stage === "scheduled" || (stage === "lobby" && isConsBillPending);
    if (activeTab === "triage") return stage === "lobby" && !isConsBillPending;
    if (activeTab === "doctor")
      return stage === "doctor" || (stage === "triage-done" && hasDoctor);
    if (activeTab === "expert")
      return stage === "expert" || (stage === "triage-done" && !hasDoctor);
    if (activeTab === "billing") return stage === "billing";
    if (activeTab === "pharmacy") return stage === "pharmacy";

    return true; // All
  });

  const StatCard = ({
    icon,
    label,
    value,
    colorClass,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    colorClass: string;
  }) => (
    <div className="bg-surface border border-border-base p-4 rounded flex items-center gap-4 hover:border-primary/50 transition-colors">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[12px] font-medium text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text-main mt-0.5">{value}</p>
      </div>
    </div>
  );

  const getTriageClass = (
    type: "bp" | "temp" | "pulse" | "spo2",
    valStr: string,
  ) => {
    const val = parseFloat(valStr);

    if (isNaN(val)) return "border-border-base focus:border-primary";

    if (type === "temp" && val > 99.5)
      return "border-saffron-500 focus:border-saffron-500 bg-saffron-50/10 text-saffron-600";
    if (type === "pulse" && (val < 60 || val > 100))
      return "border-saffron-500 focus:border-saffron-500 bg-saffron-50/10 text-saffron-600";
    if (type === "spo2" && val < 95)
      return "border-red-500 focus:border-red-500 bg-red-50/10 text-red-600";

    return "border-border-base focus:border-primary bg-surface text-text-main";
  };

  const renderRoutingModal = () => {
    // Whichever consultation bill is already tied to this appointment (if
    // any) — used so RoutingModal can hide "Charge Consultation Fee" when
    // it's already settled for the doctor currently selected, and show it
    // again if staff pick a different doctor who hasn't been billed yet.
    const routingExistingConsultationBill = routingAppointment
      ? billings.find(
        (b) =>
          b.id ===
          ((routingAppointment as any).consultationBillingId ||
            (routingAppointment as any).billingId),
      )
      : null;
    const routingConsultationBillPaid = routingExistingConsultationBill
      ? routingExistingConsultationBill.status === "paid" ||
      routingExistingConsultationBill.paymentStatus === "paid"
      : false;
    const routingConsultationBillDoctorId =
      routingExistingConsultationBill?.doctorId;

    return (
      <RoutingModal
        appointment={routingAppointment}
        clinicianName={
          routingAppointment ? getDoctorName(routingAppointment) : ""
        }
        doctors={doctors}
        experts={experts}
        isOpen={isRoutingModalOpen}
        occupiedCabins={occupiedCabins}
        routingConsultationBillDoctorId={routingConsultationBillDoctorId}
        routingConsultationBillPaid={routingConsultationBillPaid}
        patientName={
          routingAppointment ? getPatientName(routingAppointment.patientId) : ""
        }
        routingAddCommission={routingAddCommission}
        routingApplyTax={routingApplyTax}
        routingCabin={routingCabin}
        routingChargeConsultation={routingChargeConsultation}
        routingDiscountType={routingDiscountType}
        routingDiscountValue={routingDiscountValue}
        routingDoctorId={routingDoctorId}
        routingExpertId={routingExpertId}
        routingTarget={routingTarget}
        setRoutingAddCommission={setRoutingAddCommission}
        setRoutingApplyTax={setRoutingApplyTax}
        setRoutingCabin={setRoutingCabin}
        setRoutingChargeConsultation={setRoutingChargeConsultation}
        setRoutingDiscountType={setRoutingDiscountType}
        setRoutingDiscountValue={setRoutingDiscountValue}
        setRoutingDoctorId={setRoutingDoctorId}
        setRoutingExpertId={setRoutingExpertId}
        onClose={() => {
          setIsRoutingModalOpen(false);
          setRoutingExpertId("");
          setRoutingDoctorId("");
          setRoutingDiscountType("percent");
          setRoutingDiscountValue(0);
        }}
        onConfirm={handleConfirmRoute}
      />
    );
  };

  const renderTriageModal = () => {
    const patientAppts = selectedAppointment
      ? appointments.filter(
        (a) => a.patientId === selectedAppointment.patientId,
      )
      : [];
    const hasDoctor = patientAppts.some(
      (a) => a.doctorId && a.doctorId !== "unassigned",
    );
    const hasExpert = patientAppts.some(
      (a) => a.assignedExpertId && a.assignedExpertId !== "unassigned",
    );

    return (
      <TriageModal
        appointment={selectedAppointment}
        hasDoctor={hasDoctor}
        hasExpert={hasExpert}
        isOpen={isTriageModalOpen}
        patientName={
          selectedAppointment
            ? getPatientName(selectedAppointment.patientId)
            : ""
        }
        saving={triageSaving}
        setVitals={setVitals}
        vitals={vitals}
        onClose={() => setIsTriageModalOpen(false)}
        onSave={(e, target) => handleSaveTriage(e as any, target)}
      />
    );
  };

  const renderProcedureModal = () => {
    return (
      <ProcedureModal
        appointment={selectedAppointment}
        appointmentTypes={appointmentTypes}
        getApptTypeLabel={getApptTypeLabel}
        hasExpert={
          selectedAppointment
            ? !!selectedAppointment.assignedExpertId &&
            selectedAppointment.assignedExpertId !== "unassigned"
            : false
        }
        historicalProcedures={historicalProcedures}
        isDoctorCabin={
          selectedAppointment
            ? getPatientStage(selectedAppointment) === "doctor" ||
            !!currentDoctorId
            : false
        }
        isOpen={isProcedureModalOpen}
        loadingHistory={loadingHistory}
        modalActivePackages={modalActivePackages}
        patientName={
          selectedAppointment
            ? getPatientName(selectedAppointment.patientId)
            : ""
        }
        procedure={procedure}
        procedureSaving={procedureSaving}
        setProcedure={setProcedure}
        onClose={() => {
          setIsProcedureModalOpen(false);
          setHistoricalProcedures([]);
        }}
        onSave={(e, target) => handleSaveProcedure(e as any, target)}
      />
    );
  };

  const addReferrerRow = () => {
    setQuickIntakeForm((prev) => {
      const firstRp = referralPartners[0];
      const newRef = {
        type: "referral-partner" as const,
        id: firstRp?.id || "",
        name: firstRp?.name || "",
        commissionPercentage: firstRp?.defaultCommission || 0,
        referredById: "",
        referredByName: "",
      };

      return {
        ...prev,
        referrals: [...prev.referrals, newRef],
      };
    });
  };

  const updateReferrerRow = (index: number, key: string, value: any) => {
    setQuickIntakeForm((prev) => {
      const updated = [...prev.referrals];
      const current = { ...updated[index] };

      if (key === "type") {
        current.type = value;
        if (value === "referral-partner") {
          const first = referralPartners[0];

          current.id = first?.id || "";
          current.name = first?.name || "";
          current.commissionPercentage = first?.defaultCommission || 0;
        } else if (value === "doctor") {
          const first = doctors[0];

          current.id = first?.id || "";
          current.name = first?.name || "";
          current.commissionPercentage = first?.defaultCommission || 0;
        } else if (value === "expert") {
          const first = experts[0];

          current.id = first?.id || "";
          current.name = first?.name || "";
          current.commissionPercentage = first?.defaultCommission || 0;
        } else if (value === "staff") {
          const first = staff[0];

          current.id = first?.id || "";
          current.name = first?.name || "";
          current.commissionPercentage = first?.defaultCommission || 0;
        }
      } else if (key === "id") {
        current.id = value;
        if (current.type === "referral-partner") {
          const match = referralPartners.find((rp) => rp.id === value);

          current.name = match?.name || "";
          current.commissionPercentage = match?.defaultCommission || 0;
        } else if (current.type === "doctor") {
          const match = doctors.find((d) => d.id === value);

          current.name = match?.name || "";
          current.commissionPercentage = match?.defaultCommission || 0;
        } else if (current.type === "expert") {
          const match = experts.find((e) => e.id === value);

          current.name = match?.name || "";
          current.commissionPercentage = match?.defaultCommission || 0;
        } else if (current.type === "staff") {
          const match = staff.find((s) => s.id === value);

          current.name = match?.name || "";
          current.commissionPercentage = match?.defaultCommission || 0;
        }
      } else if (key === "commissionPercentage") {
        current.commissionPercentage = Number(value) || 0;
      } else if (key === "referredById") {
        current.referredById = value;
        const matchDoc = doctors.find((d) => d.id === value);
        const matchExp = experts.find((e) => e.id === value);

        current.referredByName = matchDoc
          ? `Dr. ${matchDoc.name}`
          : matchExp?.name || "";
      }

      updated[index] = current;

      return { ...prev, referrals: updated };
    });
  };

  const removeReferrerRow = (index: number) => {
    setQuickIntakeForm((prev) => ({
      ...prev,
      referrals: prev.referrals.filter((_, i) => i !== index),
    }));
  };

  const handleQuickIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Re-entrancy guard: setQuickIntakeSaving(true) below doesn't disable
    // the submit button until React's next render, so a fast double-click
    // (or a double-fired submit event) can otherwise slip a second call in
    // before the button visually disables — creating a duplicate patient/
    // appointment/bill. Bail immediately if a submit is already in flight.
    if (quickIntakeSaving) return;

    const firstClinician = quickIntakeForm.clinicians?.[0] || {
      clinicianType: "doctor",
      clinicianId: "",
      appointmentTypeId: quickIntakeForm.appointmentTypeId, // Fallback if missing
      chargeConsultation: false,
      addCommission: false,
    };

    const validClinicianRows = (quickIntakeForm.clinicians || []).filter(
      (c: any) => c.clinicianId && c.clinicianId !== "unassigned",
    );
    const doctorRows = validClinicianRows.filter(
      (c: any) => c.clinicianType === "doctor",
    );
    const expertRows = validClinicianRows.filter(
      (c: any) => c.clinicianType === "expert",
    );
    // Exactly one doctor + one expert assigned to this visit — consolidate
    // onto a single sequential appointment (doctor stage first, then
    // expert) instead of two independent sibling appointments, so a patient
    // can never be routed into two physical cabins at once (see the same
    // invariant enforced in handleConfirmRoute for the remaining
    // multi-appointment cases). Any other combination (2 doctors, 2
    // experts, 3+ rows) keeps today's sibling-appointment-per-row behavior.
    const isSingleDoctorSingleExpert =
      validClinicianRows.length === 2 &&
      doctorRows.length === 1 &&
      expertRows.length === 1;

    let mappedDoctorId: string;
    let mappedExpertId: string;
    let addDocComm: boolean;
    let addExpComm: boolean;
    let genConsBill: boolean;
    let mappedApptTypeId: string;

    if (isSingleDoctorSingleExpert) {
      const doctorRow = doctorRows[0];
      const expertRow = expertRows[0];

      mappedDoctorId = doctorRow.clinicianId;
      mappedExpertId = expertRow.clinicianId;
      addDocComm = doctorRow.addCommission || false;
      addExpComm = expertRow.addCommission || false;
      // Either row wanting a charge is enough to open the billing gate —
      // each row's own chargeConsultation still controls whether ITS own
      // line item actually gets added, inside createConsultationBill's
      // per-clinician loop. Previously this only ever read clinicians[0],
      // so a checked box on the second row was silently ignored.
      genConsBill = Boolean(
        doctorRow.chargeConsultation || expertRow.chargeConsultation,
      );
      mappedApptTypeId =
        doctorRow.appointmentTypeId || quickIntakeForm.appointmentTypeId;
    } else {
      mappedDoctorId =
        firstClinician.clinicianType === "doctor"
          ? firstClinician.clinicianId
          : "unassigned";
      mappedExpertId =
        firstClinician.clinicianType === "expert"
          ? firstClinician.clinicianId
          : "";
      addDocComm =
        firstClinician.clinicianType === "doctor"
          ? firstClinician.addCommission
          : false;
      addExpComm =
        firstClinician.clinicianType === "expert"
          ? firstClinician.addCommission
          : false;
      genConsBill = firstClinician.chargeConsultation || false;
      mappedApptTypeId =
        firstClinician.appointmentTypeId || quickIntakeForm.appointmentTypeId;
    }

    // We mutate the form object purely for the rest of the existing function logic to read from it
    quickIntakeForm.doctorId = mappedDoctorId;
    quickIntakeForm.assignedExpertId = mappedExpertId;
    quickIntakeForm.appointmentTypeId = mappedApptTypeId;
    quickIntakeForm.addDoctorCommission = addDocComm;
    quickIntakeForm.addExpertCommission = addExpComm;
    quickIntakeForm.generateConsultationBill = genConsBill;

    const hasDoctor =
      !!quickIntakeForm.doctorId && quickIntakeForm.doctorId !== "unassigned";
    const hasExpert =
      !!quickIntakeForm.assignedExpertId &&
      quickIntakeForm.assignedExpertId !== "unassigned";
    const hasReferral = quickIntakeForm.referrals.length > 0;

    if (intakeMode === "new") {
      if (
        !quickIntakeForm.name ||
        !quickIntakeForm.mobile ||
        !quickIntakeForm.age
      ) {
        addToast({
          title: "Validation Error",
          description:
            "Please fill in all patient profile fields (Name, Mobile, Age).",
          color: "danger",
        });

        return;
      }

      if (mobileStatus === "checking") {
        addToast({
          title: "Please Wait",
          description:
            "Still checking whether this mobile number is already registered.",
          color: "warning",
        });

        return;
      }

      if (mobileStatus === "duplicate") {
        addToast({
          title: "Duplicate Patient",
          description:
            "A patient with this mobile number already exists. Search for them instead of creating a new profile.",
          color: "danger",
        });

        return;
      }
    } else {
      if (!selectedExistingPatient) {
        addToast({
          title: "Validation Error",
          description:
            "Please select an existing patient from the search results.",
          color: "danger",
        });

        return;
      }
    }

    const isPackageSale = quickIntakeForm.appointmentTypeId.startsWith("pkg_");
    const packageId = isPackageSale
      ? quickIntakeForm.appointmentTypeId.replace("pkg_", "")
      : null;
    const pkg = packages.find((p) => p.id === packageId);

    if (isPackageSale && !pkg) {
      addToast({
        title: "Validation Error",
        description: "Selected package not found.",
        color: "danger",
      });

      return;
    }

    if (!hasDoctor && !hasExpert && !hasReferral && !isPackageSale) {
      addToast({
        title: "Validation Error",
        description:
          "Please assign either a consulting Doctor, an Expert, or at least one Referral Source.",
        color: "danger",
      });

      return;
    }

    const totalReferralSplit = quickIntakeForm.referrals.reduce(
      (sum: number, ref: any) => sum + (Number(ref.commissionPercentage) || 0),
      0,
    );

    if (totalReferralSplit > 100) {
      addToast({
        title: "Invalid Commission Split",
        description: `Referral Split % totals ${totalReferralSplit}%, which exceeds 100%. Adjust the values before continuing.`,
        color: "danger",
      });

      return;
    }

    setQuickIntakeSaving(true);
    try {
      let patientIdToUse = "";
      let regNumberToUse = "";
      let patientNameToUse = "";
      let patientPanVatToUse: string | undefined;

      if (intakeMode === "new") {
        // Check uniqueness of mobile first
        if (quickIntakeForm.mobile.trim() && clinicId) {
          const mobileExists = await patientService.checkMobileExists(
            quickIntakeForm.mobile.trim(),
            clinicId,
          );

          if (mobileExists) {
            addToast({
              title: "Duplicate Mobile",
              description: "A patient with this mobile number already exists.",
              color: "danger",
            });
            setQuickIntakeSaving(false);

            return;
          }
        }

        // 1) Generate next reg number
        const nextReg = await patientService.getNextRegistrationNumber(
          clinicId || undefined,
        );

        regNumberToUse = nextReg;

        // 2) Create patient
        const firstPartner = quickIntakeForm.referrals.find(
          (r) => r.type === "referral-partner",
        );
        const refPartnerId = firstPartner
          ? firstPartner.id
          : quickIntakeForm.referralPartnerId || undefined;

        const newPatientId = await patientService.createPatient({
          name: quickIntakeForm.name.trim(),
          mobile: quickIntakeForm.mobile.trim(),
          patientPanVat: quickIntakeForm.patientPanVat.trim() || undefined,
          age: quickIntakeForm.age.trim(),
          gender: quickIntakeForm.gender as "male" | "female" | "other",
          regNumber: nextReg,
          address: "Clinic Walk-in",
          clinicId: clinicId || "standalone",
          branchId: branchId || clinicId || "standalone",
          referralPartnerId: refPartnerId,
          referrals: quickIntakeForm.referrals,
          doctorId: quickIntakeForm.doctorId || "unassigned",
          assignedExpertId: quickIntakeForm.assignedExpertId || undefined,
        });

        patientIdToUse = newPatientId;
        patientNameToUse = quickIntakeForm.name.trim();
        patientPanVatToUse = quickIntakeForm.patientPanVat.trim() || undefined;
        const newPatient = {
          id: newPatientId,
          name: quickIntakeForm.name.trim(),
          mobile: quickIntakeForm.mobile.trim(),
          patientPanVat: quickIntakeForm.patientPanVat.trim() || undefined,
          age: quickIntakeForm.age.trim(),
          gender: quickIntakeForm.gender as "male" | "female" | "other",
          regNumber: nextReg,
          address: "Clinic Walk-in",
          clinicId: clinicId || "standalone",
          branchId: branchId || clinicId || "standalone",
          referralPartnerId: refPartnerId,
          referrals: quickIntakeForm.referrals,
          doctorId: quickIntakeForm.doctorId || "unassigned",
          assignedExpertId: quickIntakeForm.assignedExpertId || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Patient;

        setPatients((prev) => [...prev, newPatient]);
      } else {
        // Use the existing patient
        patientIdToUse = selectedExistingPatient.id;
        regNumberToUse = selectedExistingPatient.regNumber || "N/A";
        patientNameToUse = selectedExistingPatient.name;
        patientPanVatToUse = selectedExistingPatient.patientPanVat;

        // Optionally update existing patient's doctor, referrals or expert in background if changed
        const updateData: any = {};

        if (quickIntakeForm.doctorId)
          updateData.doctorId = quickIntakeForm.doctorId;
        if (quickIntakeForm.assignedExpertId)
          updateData.assignedExpertId = quickIntakeForm.assignedExpertId;
        if (quickIntakeForm.referrals.length > 0) {
          updateData.referrals = quickIntakeForm.referrals;
          const firstPartner = quickIntakeForm.referrals.find(
            (r) => r.type === "referral-partner",
          );

          if (firstPartner) updateData.referralPartnerId = firstPartner.id;
        }

        if (Object.keys(updateData).length > 0) {
          await patientService.updatePatient(
            selectedExistingPatient.id,
            updateData,
          );
        }
      }

      if (isPackageSale && pkg) {
        // 1. Create the Billing record (invoice number resolved by the Java backend)
        const billingItem = {
          id: crypto.randomUUID(),
          appointmentTypeId: "package-sale",
          appointmentTypeName: `Package: ${pkg.name}`,
          price: pkg.price,
          quantity: 1,
          commission: 0,
          doctorId: "unassigned",
          doctorName: "Clinic",
          amount: pkg.price,
        };

        const pkgTaxPercentage = quickIntakeForm.applyTax
          ? billingSettings?.defaultTaxPercentage || 0
          : 0;
        const pkgTotals = appointmentBillingService.calculateInvoiceTotals(
          [billingItem],
          "percent",
          0,
          pkgTaxPercentage,
        );

        const billingData = {
          invoiceNumber: "", // resolved by the Java backend; overwritten in createBilling
          clinicId: clinicId!,
          branchId: branchId || clinicId!,
          patientId: patientIdToUse,
          patientName: patientNameToUse,
          patientPanVat: patientPanVatToUse,
          doctorId: "unassigned",
          doctorName: "Clinic",
          doctorType: "regular" as const,
          invoiceDate: new Date(),
          items: [billingItem],
          subtotal: pkgTotals.subtotal,
          itemDiscountAmount: 0,
          mainDiscountAmount: 0,
          discountType: "percent" as const,
          discountValue: 0,
          discountAmount: pkgTotals.totalDiscount,
          taxPercentage: pkgTaxPercentage,
          taxAmount: pkgTotals.taxAmount,
          totalAmount: pkgTotals.totalAmount,
          status: "draft" as const,
          paymentStatus: "unpaid" as const,
          paidAmount: 0,
          balanceAmount: pkgTotals.totalAmount,
          createdBy: currentUser?.uid || "system",
        };

        const { id: billingId } =
          await appointmentBillingService.createBilling(billingData);

        // 3. Record Payment (if price > 0)
        if (pkg.price > 0) {
          await appointmentBillingService.recordPayment(
            billingId,
            pkg.price,
            quickIntakeForm.paymentMethod,
            quickIntakeForm.paymentReference,
            `Purchased ${pkg.name}`,
          );
        }

        // 4. Add Funds to Wallet
        if (pkg.walletCreditAmount > 0) {
          await walletService.addFunds(
            patientIdToUse,
            clinicId!,
            pkg.walletCreditAmount,
            quickIntakeForm.paymentMethod,
            `Package Credit: ${pkg.name}`,
            currentUser?.uid || "system",
          );
        }

        // 5. Create visual session tracker if it has total sessions
        let patientPkgId: string | undefined = undefined;

        if (pkg.totalSessions && pkg.totalSessions > 0) {
          let expiresAt: Date | undefined = undefined;

          if (pkg.validityDays && pkg.validityDays > 0) {
            const expirationDate = new Date();

            expirationDate.setDate(expirationDate.getDate() + pkg.validityDays);
            expiresAt = expirationDate;
          }

          patientPkgId = await patientPackageService.createPatientPackage({
            patientId: patientIdToUse,
            packageId: pkg.id,
            packageName: pkg.name,
            clinicId: clinicId!,
            branchId: branchId || clinicId!,
            totalSessions: pkg.totalSessions,
            usedSessions: 0,
            status: "active",
            expiresAt: expiresAt,
            createdBy: currentUser?.uid || "system",
          });
        }

        if (quickIntakeForm.startSessionInstantly) {
          const now = new Date();
          const startTime24 = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          const sessionReason =
            quickIntakeForm.reason.trim() || `Session 1 of ${pkg.name}`;

          const newApptId = await appointmentService.createAppointment({
            patientId: patientIdToUse,
            doctorId: quickIntakeForm.doctorId || "unassigned",
            assignedExpertId: quickIntakeForm.assignedExpertId || undefined,
            appointmentTypeId: "package-session",
            patientPackageId: patientPkgId,
            appointmentDate: now,
            startTime: startTime24,
            status: "confirmed", // Puts patient directly in the Lobby Queue
            reason: sessionReason,
            clinicId: clinicId!,
            branchId: branchId || clinicId!,
            createdBy: currentUser?.uid || "system",
            billingId: billingId,
            billingStatus: "paid",
            paymentStatus: "paid",
          } as any);

          if (patientPkgId) {
            await patientPackageService.startSession(patientPkgId, newApptId);
          }

          // Trigger Check-In SMS in background without blocking UI
          sendCheckInSMS(
            patientIdToUse,
            clinicId!,
            newApptId,
            branchId || undefined,
          ).catch((err) =>
            console.error("Auto check-in SMS failed for package session:", err),
          );

          // Generate consultation bill if a clinician is assigned and option is checked
          const hasDoctor =
            quickIntakeForm.doctorId &&
            quickIntakeForm.doctorId !== "unassigned";
          const hasExpert =
            quickIntakeForm.assignedExpertId &&
            quickIntakeForm.assignedExpertId !== "unassigned";

          if (
            quickIntakeForm.generateConsultationBill &&
            (hasDoctor || hasExpert)
          ) {
            const clinicianIdToBill = hasDoctor
              ? quickIntakeForm.doctorId
              : quickIntakeForm.assignedExpertId;
            const addCommissionFlag = hasDoctor
              ? quickIntakeForm.addDoctorCommission
              : quickIntakeForm.addExpertCommission;

            try {
              await createConsultationBill(
                patientIdToUse,
                clinicianIdToBill,
                newApptId,
                sessionReason,
                addCommissionFlag,
                "package-session",
                true,
                quickIntakeForm.clinicians,
                quickIntakeForm.applyTax,
                quickIntakeForm.discountType,
                quickIntakeForm.discountValue,
              );
            } catch (billErr) {
              console.error(
                "Error generating consultation bill for package session:",
                billErr,
              );
            }
          }
        }

        addToast({
          title: "Package Sold!",
          description: `Successfully sold ${pkg.name} to ${patientNameToUse} and credited wallet.`,
          color: "success",
        });
      } else {
        // Create Appointment
        const now = new Date();
        let appointmentDate = now;

        if (quickIntakeForm.appointmentDate) {
          appointmentDate = new Date(quickIntakeForm.appointmentDate);
          if (appointmentDate.toDateString() === now.toDateString()) {
            appointmentDate = now;
          }
        }

        const startTime24 = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const isTodayAppt =
          appointmentDate.toDateString() === now.toDateString();

        const hasAssignedDoctor =
          quickIntakeForm.doctorId && quickIntakeForm.doctorId !== "unassigned";
        const hasAssignedExpert = !!quickIntakeForm.assignedExpertId;

        let targetStatus: any = isTodayAppt ? "confirmed" : "scheduled";

        // "doctor"/"expert" are stage LABELS computed by getPatientStage
        // from status + doctorId/assignedExpertId — they are not valid
        // Appointment.status values. Writing them directly here used to
        // make getPatientStage fall through every case and misclassify the
        // appointment as "completed", making a not-yet-seen patient
        // silently vanish from every active queue tab. The only valid
        // status for "already with a clinician" is "in-progress".
        if (isTodayAppt && quickIntakeForm.sendDirectlyToCabin) {
          if (hasAssignedDoctor || hasAssignedExpert) {
            targetStatus = "in-progress";
          }
        }

        const apptData = {
          patientId: patientIdToUse,
          doctorId: quickIntakeForm.doctorId || "unassigned",
          assignedExpertId: quickIntakeForm.assignedExpertId || undefined,
          appointmentTypeId: quickIntakeForm.appointmentTypeId.startsWith(
            "consume_pkg_",
          )
            ? "package-session"
            : quickIntakeForm.appointmentTypeId ||
            appointmentTypes[0]?.id ||
            "default",
          patientPackageId: quickIntakeForm.appointmentTypeId.startsWith(
            "consume_pkg_",
          )
            ? quickIntakeForm.appointmentTypeId.replace("consume_pkg_", "")
            : undefined,
          appointmentDate: appointmentDate,
          startTime: isTodayAppt ? startTime24 : undefined,
          status: targetStatus,
          reason: quickIntakeForm.reason.trim() || "Walk-in General Checkup",
          clinicId: clinicId || "standalone",
          branchId: branchId || clinicId || "standalone",
          createdBy: currentUser?.uid || "",
          ...(quickIntakeForm.appointmentTypeId.startsWith("consume_pkg_") && {
            billingStatus: "paid" as const,
            paymentStatus: "paid" as const,
          }),
          // Consolidated doctor+expert visit: this one appointment carries
          // both clinicians, sequenced the same way mid-visit routing
          // already does (see handleConfirmRoute) — doctorConsultationCompleted
          // starts false so getPatientStage resolves to "doctor" first,
          // never "expert", regardless of which row was listed first.
          ...(isSingleDoctorSingleExpert && {
            doctorConsultationCompleted: false,
          }),
        };

        const newApptId = await appointmentService.createAppointment(apptData);

        if (quickIntakeForm.appointmentTypeId.startsWith("consume_pkg_")) {
          const patientPkgId = quickIntakeForm.appointmentTypeId.replace(
            "consume_pkg_",
            "",
          );

          await patientPackageService.startSession(patientPkgId, newApptId);
        }

        // Generate consultation bill if a clinician is assigned and option is checked
        const hasDoctor =
          quickIntakeForm.doctorId && quickIntakeForm.doctorId !== "unassigned";
        const hasExpert =
          quickIntakeForm.assignedExpertId &&
          quickIntakeForm.assignedExpertId !== "unassigned";

        const isPackage =
          quickIntakeForm.appointmentTypeId.startsWith("pkg_") ||
          quickIntakeForm.appointmentTypeId.startsWith("consume_");
        const apptTypeObj = appointmentTypes.find(
          (t) => t.id === quickIntakeForm.appointmentTypeId,
        );
        const hasApptFee =
          !isPackage && apptTypeObj && Number(apptTypeObj.price) > 0;

        const shouldGenerateConsFee =
          quickIntakeForm.generateConsultationBill && (hasDoctor || hasExpert);

        let primaryBillId: string | null = null;

        if (shouldGenerateConsFee || hasApptFee) {
          const clinicianIdToBill = hasDoctor
            ? quickIntakeForm.doctorId
            : hasExpert
              ? quickIntakeForm.assignedExpertId
              : "unassigned";
          const addCommissionFlag = hasDoctor
            ? quickIntakeForm.addDoctorCommission
            : quickIntakeForm.addExpertCommission;

          try {
            primaryBillId = await createConsultationBill(
              patientIdToUse,
              clinicianIdToBill,
              newApptId,
              quickIntakeForm.reason.trim() || "Walk-in General Checkup",
              addCommissionFlag,
              quickIntakeForm.appointmentTypeId,
              shouldGenerateConsFee,
              quickIntakeForm.clinicians,
              quickIntakeForm.applyTax,
              quickIntakeForm.discountType,
              quickIntakeForm.discountValue,
            );
          } catch (billErr) {
            console.error(
              "Error generating quick intake consultation bill:",
              billErr,
            );
          }
        }

        const patientDisplayName =
          intakeMode === "new"
            ? quickIntakeForm.name
            : selectedExistingPatient.name;

        // Trigger real-time notifications for the assigned Doctor and Expert
        if (clinicId) {
          if (
            quickIntakeForm.doctorId &&
            quickIntakeForm.doctorId !== "unassigned"
          ) {
            const docObj = doctors.find(
              (d) => d.id === quickIntakeForm.doctorId,
            );
            const docName = docObj ? docObj.name : "Clinician";

            NotificationService.sendNotification(clinicId, {
              title: "New Patient Checked In",
              message: `Patient ${patientDisplayName} is checked in for consultation with Dr. ${docName}.`,
              type: "triage",
              targetRole: "doctor",
              targetUserId: quickIntakeForm.doctorId,
            });
          }
          if (
            quickIntakeForm.assignedExpertId &&
            quickIntakeForm.assignedExpertId !== "unassigned"
          ) {
            const expObj = experts.find(
              (e) => e.id === quickIntakeForm.assignedExpertId,
            );
            const expName = expObj ? expObj.name : "Expert";

            NotificationService.sendNotification(clinicId, {
              title: "New Patient Checked In",
              message: `Patient ${patientDisplayName} is checked in directly for procedure with Expert ${expName}.`,
              type: "triage",
              targetRole: "expert",
              targetUserId: quickIntakeForm.assignedExpertId,
            });
          }
        }

        if (["confirmed", "in-progress"].includes(targetStatus)) {
          sendCheckInSMS(
            patientIdToUse,
            clinicId || "standalone",
            newApptId,
            branchId || undefined,
          ).catch((err) => console.error("Auto check-in SMS failed:", err));
        }

        if (
          quickIntakeForm.clinicians &&
          quickIntakeForm.clinicians.length > 1 &&
          !isSingleDoctorSingleExpert
        ) {
          for (let i = 1; i < quickIntakeForm.clinicians.length; i++) {
            const extraClin = quickIntakeForm.clinicians[i];

            if (
              !extraClin.clinicianId ||
              extraClin.clinicianId === "unassigned"
            )
              continue;

            const extraDocId =
              extraClin.clinicianType === "doctor"
                ? extraClin.clinicianId
                : "unassigned";
            const extraExpId =
              extraClin.clinicianType === "expert"
                ? extraClin.clinicianId
                : undefined;

            const extraApptData = {
              ...apptData,
              doctorId: extraDocId,
              assignedExpertId: extraExpId,
              appointmentTypeId:
                extraClin.appointmentTypeId || apptData.appointmentTypeId,
              consultationBillingId: primaryBillId || undefined,
              // Never let an extra clinician's sibling appointment inherit
              // the primary's "in-progress" (send-directly-to-cabin) status
              // — a patient can only be actively with one clinician/in one
              // cabin at a time (see the same invariant enforced at
              // routing time in handleConfirmRoute). This sibling starts
              // in the normal lobby queue and gets routed in its own turn.
              status:
                apptData.status === "in-progress" ? "confirmed" : apptData.status,
            };

            const extraApptId =
              await appointmentService.createAppointment(extraApptData);
            // Skip creating a separate bill since all clinicians were included in the primary bill.
          }
        }

        addToast({
          title: "Quick Check-In Successful",
          description: `${patientDisplayName} is checked in successfully (Reg# ${regNumberToUse}).`,
          color: "success",
        });
      }

      // Fetch fresh patient list so local names resolve immediately
      const updatedPatients = await patientService.getPatients(clinicId);

      setPatients(updatedPatients);

      // Reset and close
      setIsQuickIntakeOpen(false);
      setIntakeMode("new");
      setPatientSearchQuery("");
      setSelectedExistingPatient(null);
      setIsSearchDropdownOpen(false);
      const resetDoctorDefaults = getClinicianTypeDefaults(
        "doctor",
        appointmentTypes,
      );

      setQuickIntakeForm({
        name: "",
        mobile: "",
        patientPanVat: "",
        age: "",
        gender: "male",
        appointmentDate: new Date().toISOString().split("T")[0],
        doctorId: "",
        assignedExpertId: "",
        appointmentTypeId: resetDoctorDefaults.appointmentTypeId,
        reason: "",
        referralPartnerId: "",
        referrals: [],
        paymentMethod: "cash",
        paymentReference: "",
        generateConsultationBill: true,
        applyTax: false,
        discountType: "percent",
        discountValue: 0,
        addDoctorCommission: true,
        addExpertCommission: true,
        startSessionInstantly: false,
        sendDirectlyToCabin: false,
        clinicians: [
          {
            id: crypto.randomUUID(),
            clinicianType: "doctor",
            clinicianId: "",
            ...resetDoctorDefaults,
          },
        ],
      });
    } catch (err) {
      console.error("Error creating walk-in intake:", err);
      addToast({
        title: "Registration Failed",
        description: "Failed to perform walk-in patient intake check-in.",
        color: "danger",
      });
    } finally {
      setQuickIntakeSaving(false);
    }
  };

  const renderQuickIntakeModal = () => {
    return (
      <QuickIntakeModal
        activePatientPackages={activePatientPackages}
        addReferrerRow={addReferrerRow}
        appointmentTypes={appointmentTypes}
        doctors={doctors}
        experts={experts}
        intakeMode={intakeMode}
        isOpen={isQuickIntakeOpen}
        isSearchDropdownOpen={isSearchDropdownOpen}
        mobileStatus={mobileStatus}
        packages={packages}
        patientSearchQuery={patientSearchQuery}
        patients={patients}
        quickIntakeForm={quickIntakeForm}
        quickIntakeSaving={quickIntakeSaving}
        referralPartners={referralPartners}
        removeReferrerRow={removeReferrerRow}
        selectedExistingPatient={selectedExistingPatient}
        setIntakeMode={setIntakeMode}
        setIsSearchDropdownOpen={setIsSearchDropdownOpen}
        setPatientSearchQuery={setPatientSearchQuery}
        setQuickIntakeForm={setQuickIntakeForm}
        setSelectedExistingPatient={setSelectedExistingPatient}
        staff={staff}
        updateReferrerRow={updateReferrerRow}
        onClose={() => setIsQuickIntakeOpen(false)}
        onSubmit={handleQuickIntakeSubmit}
      />
    );
  };

  const handleFinaliseProcedure = async (accept: boolean) => {
    if (!apptToFinalise || !clinicId) return;
    setIsFinalisingProcedure(true);

    try {
      const rec = (apptToFinalise as any).recommendedProcedure;

      // Determine the clinician who performed the procedure
      const isExpert =
        apptToFinalise.assignedExpertId &&
        apptToFinalise.assignedExpertId !== "unassigned";
      const clinicianId = isExpert
        ? apptToFinalise.assignedExpertId
        : apptToFinalise.doctorId || "unassigned";
      const docInfo = doctors.find((d) => d.id === clinicianId);
      const expInfo = experts.find((e) => e.id === clinicianId);
      const clinician = docInfo || expInfo;
      const clinicianName = clinician?.name || "Clinician";
      const defaultComm = clinician?.defaultCommission || 0;
      // Set when the invoice we'd normally patch turns out to be IRD-locked
      // — instead of a dead-end toast, we fall through to the same "create
      // a fresh draft invoice" logic used when there's no invoice at all,
      // so staff get a working invoice for this procedure in one step
      // instead of having to build one manually elsewhere.
      let followUpAfterLock = false;

      if (accept && rec && rec.fee > 0) {
        let procedureItemsToAdd: any[] = [];
        let totalFee = 0;

        if (
          rec.items &&
          Array.isArray(rec.items) &&
          finaliseSelectedItems.length > 0
        ) {
          const billedItems = rec.items.filter((i: any) =>
            finaliseSelectedItems.includes(i.id),
          );

          procedureItemsToAdd = billedItems.map((i: any) => {
            const assignedExpertId = itemExperts[i.id];
            let itemClinicianId = clinicianId;
            let itemClinicianName = clinicianName;
            let itemComm = defaultComm;

            if (assignedExpertId) {
              const cl =
                experts.find((e) => e.id === assignedExpertId) ||
                doctors.find((d) => d.id === assignedExpertId);

              if (cl) {
                itemClinicianId = cl.id;
                itemClinicianName = cl.name;
                itemComm = cl.defaultCommission || 0;
              }
            }

            const pType = appointmentTypes.find((t) => t.id === i.id);

            if (pType && pType.calculateCommission === false) {
              itemComm = 0;
            }

            return {
              id: crypto.randomUUID(),
              appointmentTypeId:
                apptToFinalise.appointmentTypeId || "procedure-fee",
              appointmentTypeName: `${i.name} (Procedure Fee)`,
              price: i.fee,
              quantity: 1,
              commission: itemComm,
              doctorId: itemClinicianId,
              doctorName: itemClinicianName,
              discountValue: 0,
              discountType: "percent" as const,
              discountAmount: 0,
              amount: i.fee,
            };
          });
          totalFee = billedItems.reduce(
            (sum: number, i: any) => sum + i.fee,
            0,
          );
        } else {
          let procComm = defaultComm;

          if (rec.items && rec.items.length === 1) {
            const pType = appointmentTypes.find(
              (t) => t.id === rec.items[0].id,
            );

            if (pType && pType.calculateCommission === false) {
              procComm = 0;
            }
          } else {
            // If multiple or unknown, try to match by name
            const pType = appointmentTypes.find((t) => t.name === rec.name);

            if (pType && pType.calculateCommission === false) {
              procComm = 0;
            }
          }

          procedureItemsToAdd = [
            {
              id: crypto.randomUUID(),
              appointmentTypeId:
                apptToFinalise.appointmentTypeId || "procedure-fee",
              appointmentTypeName: `${rec.name} (Procedure Fee)`,
              price: rec.fee,
              quantity: 1,
              commission: procComm,
              doctorId: clinicianId,
              doctorName: clinicianName,
              discountValue: 0,
              discountType: "percent" as const,
              discountAmount: 0,
              amount: rec.fee,
            },
          ];
          totalFee = rec.fee;
        }

        let billingId =
          apptToFinalise.consultationBillingId || apptToFinalise.billingId;

        if (billingId) {
          const billing =
            await appointmentBillingService.getBillingById(billingId);

          if (billing && isBillingLocked(billing)) {
            // This invoice may already be IRD-synced (sync happens at
            // creation, not at a later "Finalize") — updateBilling would
            // throw rather than silently patch a locked invoice's items.
            followUpAfterLock = true;
            billingId = null;
          } else if (billing) {
            const updatedItems = [
              ...(billing.items || []),
              ...procedureItemsToAdd,
            ];
            // Discount/tax entered for THIS finalization take precedence
            // over whatever the invoice already had — staff are explicitly
            // setting them right now for the procedure being added.
            const totals = appointmentBillingService.calculateInvoiceTotals(
              updatedItems,
              finaliseDiscountType,
              finaliseDiscountValue,
              finaliseApplyTax ? billingSettings?.defaultTaxPercentage || 0 : 0,
            );

            const newPaid = billing.paidAmount || 0;
            const newTotal = totals.totalAmount;
            const newBalance = newTotal - newPaid;

            const newPaymentStatus =
              newPaid >= newTotal ? "paid" : newPaid > 0 ? "partial" : "unpaid";
            const newStatus = newPaymentStatus === "paid" ? "paid" : "draft";

            // Append the recommending doctor to referrals for commission
            let updatedReferrals = billing.referrals || [];

            if (
              apptToFinalise.doctorId &&
              apptToFinalise.doctorId !== "unassigned"
            ) {
              const recommendingDoctor = doctors.find(
                (d) => d.id === apptToFinalise.doctorId,
              );

              if (recommendingDoctor) {
                const defaultComm = recommendingDoctor.defaultCommission || 0;

                if (defaultComm > 0) {
                  // Discount-adjusted, pre-tax base — same ratio formula
                  // doctorCommissionService/expertCommissionService already
                  // use for the performing clinician's own commission on
                  // this invoice, so the referring doctor's bonus isn't
                  // computed on a bigger (gross) base than the performer's.
                  const validTotalForReferral = Math.max(
                    totals.subtotal - totals.itemDiscountAmount,
                    1,
                  );
                  const referralDiscountRatio =
                    (validTotalForReferral - totals.mainDiscountAmount) /
                    validTotalForReferral;
                  const effectiveTotalFee = totalFee * referralDiscountRatio;

                  // Only add if not already present
                  const existingRef = updatedReferrals.find(
                    (r) =>
                      r.id === recommendingDoctor.id && r.type === "doctor",
                  );

                  if (!existingRef) {
                    updatedReferrals = [
                      ...updatedReferrals,
                      {
                        type: "doctor",
                        id: recommendingDoctor.id,
                        name: recommendingDoctor.name,
                        commissionPercentage: defaultComm,
                        commissionAmount: (effectiveTotalFee * defaultComm) / 100,
                      },
                    ];
                  } else {
                    // Update commission amount for the new total fee if they already exist
                    updatedReferrals = updatedReferrals.map((r) =>
                      r.id === recommendingDoctor.id && r.type === "doctor"
                        ? {
                          ...r,
                          commissionAmount:
                            r.commissionAmount +
                            (effectiveTotalFee * defaultComm) / 100,
                        }
                        : r,
                    );
                  }
                }
              }
            }

            await appointmentBillingService.updateBilling(billingId, {
              items: updatedItems,
              referrals: updatedReferrals,
              discountType: finaliseDiscountType,
              discountValue: finaliseDiscountValue,
              taxPercentage: finaliseApplyTax
                ? billingSettings?.defaultTaxPercentage || 0
                : 0,
              subtotal: totals.subtotal,
              itemDiscountAmount: totals.itemDiscountAmount,
              mainDiscountAmount: totals.mainDiscountAmount,
              discountAmount: totals.totalDiscount,
              taxAmount: totals.taxAmount,
              totalAmount: totals.totalAmount,
              balanceAmount: newBalance,
              paymentStatus: newPaymentStatus,
              status: newStatus,
            });

            await appointmentService.updateAppointment(apptToFinalise.id, {
              billingStatus: newPaymentStatus,
              paymentStatus: newPaymentStatus,
              updatedAt: new Date(),
            } as any);
          }
        }

        if (!billingId) {
          // No invoice exists (or the existing one was locked, see above) —
          // create a draft invoice for this procedure from scratch.
          let pat = patients.find((p) => p.id === apptToFinalise.patientId);

          if (!pat && apptToFinalise.patientId) {
            pat =
              (await patientService.getPatientById(apptToFinalise.patientId)) ||
              undefined;
          }

          const isExpert =
            apptToFinalise.assignedExpertId &&
            apptToFinalise.assignedExpertId !== "unassigned";
          const clinicianId = isExpert
            ? apptToFinalise.assignedExpertId
            : apptToFinalise.doctorId || "unassigned";
          const docInfo =
            doctors.find((d) => d.id === clinicianId) ||
            experts.find((e) => e.id === clinicianId);

          const draftBillingItems = procedureItemsToAdd;

          // Computed BEFORE the referral block below so the recommending
          // doctor's bonus can use the same discount-adjusted, pre-tax base
          // the performing clinician's own commission is computed on.
          const procTaxPercentage = finaliseApplyTax
            ? billingSettings?.defaultTaxPercentage || 0
            : 0;
          const procTotals = appointmentBillingService.calculateInvoiceTotals(
            draftBillingItems,
            finaliseDiscountType,
            finaliseDiscountValue,
            procTaxPercentage,
          );

          const referrals: any[] = [];

          // Automatically add the recommending doctor for commission
          if (
            apptToFinalise.doctorId &&
            apptToFinalise.doctorId !== "unassigned"
          ) {
            const recommendingDoctor = doctors.find(
              (d) => d.id === apptToFinalise.doctorId,
            );

            if (recommendingDoctor) {
              const defaultComm = recommendingDoctor.defaultCommission || 0;

              if (defaultComm > 0) {
                const validTotalForReferral = Math.max(
                  procTotals.subtotal - procTotals.itemDiscountAmount,
                  1,
                );
                const referralDiscountRatio =
                  (validTotalForReferral - procTotals.mainDiscountAmount) /
                  validTotalForReferral;
                const effectiveTotalFee = totalFee * referralDiscountRatio;

                referrals.push({
                  type: "doctor",
                  id: recommendingDoctor.id,
                  name: recommendingDoctor.name,
                  commissionPercentage: defaultComm,
                  commissionAmount: (effectiveTotalFee * defaultComm) / 100,
                });
              }
            }
          }

          const billingData = {
            invoiceNumber: "", // resolved by the Java backend; overwritten in createBilling
            clinicId: clinicId,
            branchId: branchId || clinicId,
            patientId: apptToFinalise.patientId,
            patientName: pat?.name || "Unknown Patient",
            patientPanVat: pat?.patientPanVat || undefined,
            doctorId: clinicianId,
            doctorName: docInfo?.name || "Clinician",
            doctorType: ((docInfo as any)?.doctorType || "regular") as
              | "regular"
              | "visitor",
            invoiceDate: new Date(),
            items: draftBillingItems,
            referrals: referrals,
            subtotal: procTotals.subtotal,
            itemDiscountAmount: procTotals.itemDiscountAmount,
            mainDiscountAmount: procTotals.mainDiscountAmount,
            discountType: finaliseDiscountType,
            discountValue: finaliseDiscountValue,
            discountAmount: procTotals.totalDiscount,
            taxPercentage: procTaxPercentage,
            taxAmount: procTotals.taxAmount,
            totalAmount: procTotals.totalAmount,
            status: "draft" as const,
            paymentStatus: "unpaid" as const,
            paidAmount: 0,
            balanceAmount: procTotals.totalAmount,
            createdBy: currentUser?.uid || "system",
          };

          const { id: newBillingId } =
            await appointmentBillingService.createBilling(billingData);

          await appointmentService.updateAppointment(apptToFinalise.id, {
            billingId: newBillingId,
            billingStatus: "unpaid",
            paymentStatus: "unpaid",
            updatedAt: new Date(),
          } as any);
        }
      }

      let firstAssignedExpert = "";

      if (rec && rec.items && Array.isArray(rec.items)) {
        for (const i of rec.items) {
          if (finaliseSelectedItems.includes(i.id) && itemExperts[i.id]) {
            firstAssignedExpert = itemExperts[i.id];
            break;
          }
        }
      }

      // Only clear the whole recommendation when there's nothing left to
      // preserve: it was declined, everything was billed, or it's a
      // single fee-only recommendation with no per-item list to split.
      // Otherwise, keep the unselected items on the appointment (with a
      // recomputed fee) so staff can finalise the rest later instead of
      // those items silently vanishing with no invoice ever created.
      let updatedRecommendedProcedure: any = null;

      if (
        accept &&
        rec &&
        rec.items &&
        Array.isArray(rec.items) &&
        finaliseSelectedItems.length > 0 &&
        finaliseSelectedItems.length < rec.items.length
      ) {
        const remainingItems = rec.items.filter(
          (i: any) => !finaliseSelectedItems.includes(i.id),
        );
        const remainingFee = remainingItems.reduce(
          (sum: number, i: any) => sum + (i.fee || 0),
          0,
        );

        updatedRecommendedProcedure = {
          ...rec,
          items: remainingItems,
          fee: remainingFee,
        };
      }

      const updates: any = {
        recommendedProcedure: updatedRecommendedProcedure,
      };

      if (firstAssignedExpert) {
        updates.assignedExpertId = firstAssignedExpert;
      }

      await appointmentService.updateAppointment(apptToFinalise.id, updates);

      addToast({
        title: accept
          ? followUpAfterLock
            ? "Follow-up Invoice Created"
            : "Procedure Billed"
          : "Procedure Declined",
        description: accept
          ? followUpAfterLock
            ? "The original invoice was already IRD-synced, so a separate invoice was created for this procedure instead."
            : "The procedure has been added to the invoice."
          : "The recommended procedure was discarded.",
        color: accept ? "success" : "warning",
      });
    } catch (err) {
      console.error("Error finalising procedure:", err);
      addToast({
        title: "Error",
        description: "Failed to finalise procedure.",
        color: "danger",
      });
    } finally {
      setIsFinalisingProcedure(false);
      setApptToFinalise(null);
    }
  };

  const handleSettleBilling = async (appt: Appointment) =>
    runGuarded(`settle-billing-${appt.id}`, async () => {
      // Guard: never let this function's fallback auto-create a plain
      // consultation-fee invoice while a procedure is pending — that
      // fallback (below) only knows about the appointment's originally
      // booked appointmentTypeId, not recommendedProcedure.items, so it
      // would silently re-bill a generic consultation fee and discard the
      // real procedures. Defer to the same Finalise Procedure flow the
      // "Finalise Recommended Procedure" queue button uses instead.
      const rec = (appt as any).recommendedProcedure;
      const hasPendingProcedureUpfront = !!rec?.fee && rec.fee > 0;

      if (hasPendingProcedureUpfront) {
        setApptToFinalise(appt);
        setFinaliseSelectedItems(
          rec.items && Array.isArray(rec.items)
            ? rec.items.map((i: any) => i.id)
            : [],
        );

        return;
      }

      // 1. If the appointment already has a cached billingId, let's inspect it.
      let targetBillingId = appt.billingId;

      if (targetBillingId) {
        // Find the bill in our local real-time billings state
        const matchingBill = billings.find((b) => b.id === targetBillingId);

        if (matchingBill) {
          const isConsBill = matchingBill.items?.some(
            (item: any) =>
              item.appointmentTypeId === "consultation-fee" ||
              item.appointmentTypeName?.includes("Consultation Fee"),
          );
          const isPaid =
            matchingBill.status === "paid" ||
            matchingBill.paymentStatus === "paid";

          // If it's a paid consultation bill, only discard if there IS a pending procedure
          // (in that case we'll find/create a separate procedure invoice below).
          // If there is NO pending procedure, just navigate to the paid bill for review.
          if (isConsBill && isPaid) {
            const hasPendingProc =
              !!(appt as any).recommendedProcedure?.fee &&
              (appt as any).recommendedProcedure?.fee > 0;

            if (!hasPendingProc) {
              // No procedure pending — consultation is fully settled. Navigate to it.
              navigate(
                `/dashboard/appointments-billing/${targetBillingId}?from=front-office&tab=${activeTab}`,
              );

              return;
            }

            // Procedure IS pending — clear so we look for/create a procedure invoice
            targetBillingId = null;
          }
        }
      }

      if (targetBillingId) {
        navigate(
          `/dashboard/appointments-billing/${targetBillingId}?from=front-office&tab=${activeTab}`,
        );

        return;
      }

      // 2. Fetch the draft invoices for this patient to find the matching billing record
      try {
        if (!clinicId) return;
        const patientBillings =
          await appointmentBillingService.getBillingByPatient(
            appt.patientId,
            clinicId,
          );

        // Find the most recent draft billing record for this patient that is NOT a consultation bill
        const draftBilling = patientBillings.find(
          (b) =>
            b.status === "draft" &&
            !b.items?.some(
              (item: any) =>
                item.appointmentTypeId === "consultation-fee" ||
                item.appointmentTypeName?.includes("Consultation Fee"),
            ),
        );

        if (draftBilling) {
          navigate(
            `/dashboard/appointments-billing/${draftBilling.id}?from=front-office&tab=${activeTab}`,
          );
        } else {
          const consultationBillingId = (appt as any).consultationBillingId;
          const hasPendingProcedure =
            !!(appt as any).recommendedProcedure?.fee &&
            (appt as any).recommendedProcedure?.fee > 0;

          // ALWAYS navigate to consultationBillingId if it exists (paid or unpaid)
          // to prevent creating a duplicate invoice for the same visit.
          if (consultationBillingId) {
            const consBilling = patientBillings.find(
              (b) => b.id === consultationBillingId,
            );

            if (consBilling) {
              navigate(
                `/dashboard/appointments-billing/${consultationBillingId}`,
              );

              return;
            }
          }

          // Also check any paid billing for this appointment as a fallback
          if (!hasPendingProcedure) {
            const paidBilling = patientBillings.find(
              (b) =>
                (b.status === "paid" || b.paymentStatus === "paid") &&
                b.items?.some((item: any) =>
                  item.appointmentTypeName
                    ?.toLowerCase()
                    .includes("consultation"),
                ),
            );

            if (paidBilling) {
              navigate(
                `/dashboard/appointments-billing/${paidBilling.id}?from=front-office&tab=${activeTab}`,
              );

              return;
            }
          }

          // Automatically create a draft billing invoice for the procedure/appointment type!
          try {
            const isExpert =
              appt.assignedExpertId && appt.assignedExpertId !== "unassigned";
            const clinicianId = isExpert
              ? appt.assignedExpertId
              : appt.doctorId || "unassigned";

            let docInfo = doctors.find((d) => d.id === clinicianId);

            if (!docInfo && isExpert) {
              docInfo = experts.find((e) => e.id === clinicianId) as any;
            }

            if (!docInfo && clinicianId && clinicianId !== "unassigned") {
              try {
                const fetchedDoc = await doctorService.getDoctorById(clinicianId);

                if (fetchedDoc) {
                  docInfo = fetchedDoc;
                } else {
                  const dbExp = await expertService.getExpertById(clinicianId);

                  if (dbExp) docInfo = dbExp as any;
                }
              } catch (err) {
                console.error(
                  "Error loading doctor/expert details dynamically:",
                  err,
                );
              }
            }

            const apptType = appointmentTypes.find(
              (t) => t.id === appt.appointmentTypeId,
            );

            let pat = patients.find((p) => p.id === appt.patientId);

            if (!pat && appt.patientId) {
              try {
                pat =
                  (await patientService.getPatientById(appt.patientId)) ||
                  undefined;
              } catch (err) {
                console.error("Error loading patient details dynamically:", err);
              }
            }

            let price = FALLBACK_GENERAL_FEE;
            let appointmentTypeName = "General Consultation";

            if (apptType) {
              if (Number(apptType.price)) {
                price = Number(apptType.price);
              } else {
                console.warn(
                  `Appointment type "${apptType.name}" (${apptType.id}) has no price set — falling back to NPR ${FALLBACK_GENERAL_FEE}. Set a real price on it.`,
                );
              }
              appointmentTypeName = apptType.name || "General Consultation";
            } else {
              console.warn(
                `Settling billing for an appointment with no resolvable appointment type — falling back to NPR ${FALLBACK_GENERAL_FEE} "General Consultation".`,
              );
            }

            if (
              appointmentTypeName.toLowerCase().includes("consult") &&
              docInfo?.consultationCharge !== undefined
            ) {
              price = Number(docInfo.consultationCharge);
            }

            const billingItem = {
              id: crypto.randomUUID(),
              appointmentTypeId: appt.appointmentTypeId || "manual-gp-fee",
              appointmentTypeName: appointmentTypeName,
              price: price,
              quantity: 1,
              commission: docInfo?.defaultCommission || 0,
              doctorId: clinicianId,
              doctorName: docInfo
                ? docInfo.name.startsWith("Dr.") || isExpert
                  ? docInfo.name
                  : `Dr. ${docInfo.name}`
                : isExpert
                  ? "Expert Cabin"
                  : "Unknown Doctor",
              amount: price,
            };

            const settleTaxPercentage = billingSettings?.enableTax
              ? billingSettings.defaultTaxPercentage || 0
              : 0;
            const settleTotals = appointmentBillingService.calculateInvoiceTotals(
              [billingItem],
              "percent",
              0,
              settleTaxPercentage,
            );

            // Resolve referrals — discount-adjusted, pre-tax base (see the
            // same fix in createConsultationBill). No discount mechanism
            // exists in this settle-billing path today, so this is
            // numerically identical to using `price` directly, but keeps
            // the same correct pattern if discount is ever added here.
            const settleReferralBase =
              settleTotals.taxableAmount + settleTotals.exemptAmount;
            const { processedReferrals, refPartnerId, refCommissionAmt } =
              await resolvePatientReferrals(pat, settleReferralBase);

            const billingData = {
              invoiceNumber: "", // resolved by the Java backend; overwritten in createBilling
              clinicId: clinicId,
              branchId: branchId ?? clinicId,
              patientId: appt.patientId,
              patientName: pat?.name || "Unknown Patient",
              patientPanVat: pat?.patientPanVat || undefined,
              appointmentId: appt.id,
              doctorId: clinicianId,
              doctorName: docInfo
                ? docInfo.name.startsWith("Dr.") || isExpert
                  ? docInfo.name
                  : `Dr. ${docInfo.name}`
                : isExpert
                  ? "Expert Cabin"
                  : "Unknown Doctor",
              doctorType: (docInfo?.doctorType || "regular") as
                | "regular"
                | "visitor",
              referralPartnerId: refPartnerId,
              referralCommissionAmount:
                refCommissionAmt && refCommissionAmt > 0
                  ? refCommissionAmt
                  : undefined,
              referrals: processedReferrals,
              invoiceDate: new Date(),
              items: [billingItem],
              subtotal: settleTotals.subtotal,
              itemDiscountAmount: 0,
              mainDiscountAmount: 0,
              discountType: "percent" as const,
              discountValue: 0,
              discountAmount: settleTotals.totalDiscount,
              taxPercentage: settleTaxPercentage,
              taxAmount: settleTotals.taxAmount,
              totalAmount: settleTotals.totalAmount,
              status: "draft" as const,
              paymentStatus: "unpaid" as const,
              paidAmount: 0,
              balanceAmount: settleTotals.totalAmount,
              createdBy: currentUser?.uid || "system",
            };

            const { id: newBillingId } =
              await appointmentBillingService.createBilling(billingData);

            // COMMISSIONS REMOVED: Commissions must only be generated by the billing engine
            // when the invoice is actually settled (paid >= total), not when the draft is created.

            // Link new billing to appointment
            await appointmentService.updateAppointment(appt.id, {
              billingId: newBillingId,
              billingStatus: "unpaid",
              paymentStatus: "unpaid",
              updatedAt: new Date(),
            } as any);

            addToast({
              title: "Invoice Generated",
              description: `Generated appointment invoice for ${appointmentTypeName}.`,
              color: "success",
            });

            navigate(
              `/dashboard/appointments-billing/${newBillingId}?from=front-office&tab=${activeTab}`,
            );
          } catch (genErr) {
            console.error(
              "Failed to generate procedure billing on fallback:",
              genErr,
            );
            navigate("/dashboard/appointments-billing");
          }
        }
      } catch (err) {
        console.error("Error settling billing:", err);
        navigate("/dashboard/appointments-billing");
      }
    });

  const getGuidedAction = (appt: Appointment) => {
    const stage = getPatientStage(appt);
    const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
    const hasExpert =
      appt.assignedExpertId && appt.assignedExpertId !== "unassigned";
    const hasAnyClinician = hasDoctor || hasExpert;
    const pendingBillId = appt.billingId || (appt as any).consultationBillingId;
    const consBill = pendingBillId
      ? billings.find((b) => b.id === pendingBillId)
      : null;
    const isConsBillPaid = consBill
      ? consBill.status === "paid" || consBill.paymentStatus === "paid"
      : false;
    const isConsBillPending = consBill && !isConsBillPaid;
    const isExpertOnly = currentExpertId && !currentDoctorId;

    if (isConsBillPending && stage !== "expert") {
      if (isExpertOnly) {
        return {
          label: "Consultation Fee Pending",
          icon: <IoTimeOutline className="w-4 h-4" />,
          colorClass:
            "bg-surface-3 text-text-muted cursor-not-allowed border border-border-base",
          onClick: () => { },
        };
      }
      const isOnlyCons =
        consBill.items?.length === 1 &&
        consBill.items.some(
          (item: any) =>
            item.appointmentTypeId === "consultation-fee" ||
            item.appointmentTypeName?.includes("Consultation"),
        );

      return {
        label: isOnlyCons
          ? "Settle Consultation Bill"
          : "Settle Billing Invoice",
        icon: <IoCardOutline className="w-4 h-4" />,
        colorClass: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
        onClick: () =>
          navigate(
            `/dashboard/appointments-billing/${consBill.id}?from=front-office&tab=${activeTab}`,
          ),
      };
    }

    switch (stage) {
      case "scheduled":
        return {
          label: "Check-In Patient",
          icon: <IoCheckmarkCircleOutline className="w-4 h-4" />,
          colorClass: "bg-primary text-white hover:bg-primary/90",
          onClick: () => handleCheckIn(appt.id),
        };
      case "lobby":
        return {
          label: "Record Triage Vitals",
          icon: <IoHeartOutline className="w-4 h-4" />,
          colorClass: "bg-teal-500 text-white hover:bg-teal-600",
          onClick: () => handleOpenTriage(appt),
        };
      case "triage-done":
        return {
          label: hasDoctor ? "Send to Doctor Cabin" : "Send to Expert Cabin",
          icon: <IoPlayOutline className="w-4 h-4" />,
          colorClass:
            "bg-indigo-500 text-white hover:bg-indigo-600 animate-pulse",
          onClick: () => handleSendToDoctor(appt.id),
        };
      case "doctor": {
        if (currentExpertId && !currentDoctorId) {
          return {
            label: "Waiting for Doctor",
            icon: <IoTimeOutline className="w-4 h-4" />,
            colorClass:
              "bg-surface-3 text-text-muted cursor-not-allowed border border-border-base",
            onClick: () => { },
          };
        }

        const hasPrescription = prescriptions.some(
          (p) => p.appointmentId === appt.id,
        );

        if (hasPrescription) {
          return {
            label: hasExpert ? "Send to Expert Cabin" : "Complete Consultation",
            icon: <IoCheckmarkCircleOutline className="w-4 h-4" />,
            colorClass: "bg-primary text-white hover:bg-primary/90",
            onClick: () => handleCompleteConsultation(appt.id),
          };
        }

        return {
          label: hasExpert
            ? "Send to Expert Cabin"
            : "Complete (No Prescription)",
          icon: <IoCheckmarkCircleOutline className="w-4 h-4" />,
          colorClass: "bg-primary text-white hover:bg-primary/90",
          onClick: () => handleCompleteConsultation(appt.id),
        };
      }
      case "expert": {
        if (currentDoctorId && !currentExpertId) {
          return {
            label: "Waiting for Expert",
            icon: <IoTimeOutline className="w-4 h-4" />,
            colorClass:
              "bg-surface-3 text-text-muted cursor-not-allowed border border-border-base",
            onClick: () => { },
          };
        }

        return {
          label: "Record Procedure Log",
          icon: <IoCreateOutline className="w-4 h-4" />,
          colorClass: "bg-primary text-white hover:bg-primary/95",
          onClick: () => handleOpenProcedure(appt),
        };
      }
      case "billing":
        if ((appt as any).recommendedProcedure) {
          return {
            label: "Finalise Recommended Procedure",
            icon: <IoCheckmarkCircleOutline className="w-4 h-4" />,
            colorClass:
              "bg-blue-500 text-white hover:bg-blue-600 animate-pulse",
            onClick: () => {
              setApptToFinalise(appt);
              const rec = (appt as any).recommendedProcedure;

              if (rec && rec.items && Array.isArray(rec.items)) {
                setFinaliseSelectedItems(rec.items.map((i: any) => i.id));
              } else {
                setFinaliseSelectedItems([]);
              }
            },
          };
        }
        if (isExpertOnly) {
          return {
            label: "Billing Pending",
            icon: <IoTimeOutline className="w-4 h-4" />,
            colorClass:
              "bg-surface-3 text-text-muted cursor-not-allowed border border-border-base",
            onClick: () => { },
          };
        }

        return {
          label: "Settle Billing Invoice",
          icon: <IoCardOutline className="w-4 h-4" />,
          colorClass: "bg-saffron-500 text-white hover:bg-saffron-600",
          onClick: () => handleSettleBilling(appt),
        };
      case "pharmacy":
        if (isExpertOnly) {
          return {
            label: "Pharmacy Pending",
            icon: <IoTimeOutline className="w-4 h-4" />,
            colorClass:
              "bg-surface-3 text-text-muted cursor-not-allowed border border-border-base",
            onClick: () => { },
          };
        }

        return {
          label: "Fulfill Prescription",
          icon: <IoReceiptOutline className="w-4 h-4" />,
          colorClass:
            "bg-purple-500 text-white hover:bg-purple-600 animate-pulse",
          onClick: () => navigate("/dashboard/pharmacy?tab=prescriptions"),
        };
      default:
        return {
          label: "Checkout Completed",
          icon: <IoCheckmarkCircleOutline className="w-4 h-4 text-green-500" />,
          colorClass:
            "bg-green-500/10 text-green-600 border border-green-500/20 cursor-default",
          onClick: () => { },
        };
    }
  };

  const getStageBadge = (stage: string, appt?: Appointment) => {
    if (appt) {
      const consBill = (appt as any).consultationBillingId
        ? billings.find((b) => b.id === (appt as any).consultationBillingId)
        : null;
      const isConsBillPaid = consBill
        ? consBill.status === "paid" || consBill.paymentStatus === "paid"
        : false;
      const isConsBillPending = consBill && !isConsBillPaid;

      if (isConsBillPending) {
        const isOnlyCons =
          consBill.items?.length === 1 &&
          consBill.items.some(
            (item: any) =>
              item.appointmentTypeId === "consultation-fee" ||
              item.appointmentTypeName?.includes("Consultation"),
          );

        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap shrink-0">
            {isOnlyCons
              ? "Consultation Fee Pending"
              : "Billing Invoice Pending"}
          </span>
        );
      }
    }

    switch (stage) {
      case "scheduled":
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-3 text-text-muted border border-border-base whitespace-nowrap shrink-0">
            Booking Today
          </span>
        );
      case "lobby":
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 whitespace-nowrap shrink-0">
            Waiting In Lobby
          </span>
        );
      case "triage-done":
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap shrink-0">
            Triage Finished
          </span>
        );
      case "doctor":
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap shrink-0">
            In Doctor Cabin
          </span>
        );
      case "expert":
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap shrink-0">
            In Expert Cabin
          </span>
        );
      case "billing":
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-saffron-500/10 text-saffron-600 dark:text-saffron-400 border border-saffron-500/20 whitespace-nowrap shrink-0">
            Billing Pending
          </span>
        );
      case "pharmacy":
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 whitespace-nowrap shrink-0">
            Pharmacy Pending
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 whitespace-nowrap shrink-0">
            Completed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            {hasFullFrontOfficeAccess
              ? "Front Office Dashboard"
              : currentExpertId
                ? "Expert Cabin Dashboard"
                : "Doctor Cabin Dashboard"}
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            {hasFullFrontOfficeAccess
              ? "Live patient operational waitlist queue and lobby triage desk."
              : "Manage your daily queue, review triage vitals, and process clinical records."}
          </p>
        </div>
        <div className="flex gap-2">
          {hasFullFrontOfficeAccess && (
            <>
              <button
                className="clarity-btn clarity-btn-primary flex items-center gap-1.5"
                type="button"
                onClick={handleOpenQuickIntake}
              >
                <IoAddOutline className="w-4 h-4" />
                New Intake Check-In
              </button>
              <button
                className="clarity-btn flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border-transparent shadow-sm"
                type="button"
                onClick={() => setIsSellPackageModalOpen(true)}
              >
                <IoReceiptOutline className="w-4 h-4" />
                Sell Package
              </button>
              <button
                className="clarity-btn clarity-btn-ghost flex items-center gap-1.5"
                type="button"
                onClick={() =>
                  navigate("/dashboard/front-office/manage-visitors")
                }
              >
                <IoPeopleOutline className="w-4 h-4" />
                Visitors Log
              </button>
              <button
                className="clarity-btn clarity-btn-ghost flex items-center gap-1.5"
                title="See and toggle which doctors/experts are on duty today"
                type="button"
                onClick={() => setIsDutyPanelOpen(true)}
              >
                <IoPulseOutline className="w-4 h-4" />
                Clinician Status
              </button>
            </>
          )}
          <button
            className="clarity-btn clarity-btn-ghost flex items-center gap-1.5"
            title={
              "Keyboard shortcuts:\n" +
              "1 – Lobby   2 – Triage   3 – Doctor   4 – Expert\n" +
              "5 – Billing   6 – Pharmacy   ` – All Workflow\n" +
              "Alt+N – New Intake Check-In\n" +
              "(disabled while typing in a text field)"
            }
            type="button"
          >
            <IoKeypadOutline className="w-4 h-4" />
            Shortcuts
          </button>
        </div>
      </div>

      {(() => {
        const getQueueFilter = (a: Appointment) => {
          if (currentDoctorId || currentExpertId) {
            const isMyDoctorPatient =
              currentDoctorId && a.doctorId === currentDoctorId;
            const isMyExpertPatient =
              currentExpertId && a.assignedExpertId === currentExpertId;

            if (currentDoctorId && currentExpertId) {
              if (!isMyDoctorPatient && !isMyExpertPatient) return false;
            } else if (currentDoctorId) {
              if (!isMyDoctorPatient) return false;
            } else if (currentExpertId) {
              if (!isMyExpertPatient) return false;
            }
          }

          return true;
        };

        const isDoc = userData?.role === "doctor" || currentDoctorId;
        const isExp = userData?.role === "expert" || currentExpertId;

        const showExpertCard =
          (!isDoc && !isExp) || hasFullFrontOfficeAccess || isExp;
        const showBillingCards = hasFullFrontOfficeAccess;

        let gridColsClass = "lg:grid-cols-7";

        if (!showExpertCard && !showBillingCards)
          gridColsClass = "lg:grid-cols-4";
        else if (showExpertCard && !showBillingCards)
          gridColsClass = "lg:grid-cols-5";

        return (
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 ${gridColsClass} gap-3.5`}
          >
            <StatCard
              colorClass="bg-surface-3 text-text-muted"
              icon={<IoCalendarOutline className="w-5 h-5" />}
              label={
                selectedDate.toDateString() === new Date().toDateString()
                  ? "Today's Appointments"
                  : `${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} Appointments`
              }
              value={appointments.filter(getQueueFilter).length}
            />
            <StatCard
              colorClass="bg-teal-500/10 text-teal-600"
              icon={<IoPeopleOutline className="w-5 h-5" />}
              label="Waiting in Lobby"
              value={
                appointments.filter(getQueueFilter).filter((a) => {
                  const s = getPatientStage(a);

                  if (s === "scheduled") return true;
                  if (s !== "lobby") return false;
                  const consBill = (a as any).consultationBillingId
                    ? billings.find(
                      (b) => b.id === (a as any).consultationBillingId,
                    )
                    : null;
                  const isConsBillPaid = consBill
                    ? consBill.status === "paid" ||
                    consBill.paymentStatus === "paid"
                    : false;
                  const isConsBillPending = consBill && !isConsBillPaid;

                  return isConsBillPending;
                }).length
              }
            />
            <StatCard
              colorClass="bg-indigo-500/10 text-indigo-600"
              icon={<IoHeartOutline className="w-5 h-5" />}
              label="Triage Completed"
              value={
                appointments
                  .filter(getQueueFilter)
                  .filter((a) => getPatientStage(a) === "triage-done").length
              }
            />
            <StatCard
              colorClass="bg-amber-500/10 text-amber-600"
              icon={<IoTimeOutline className="w-5 h-5" />}
              label="In Doctor Cabin"
              value={
                appointments
                  .filter(
                    (a) => !currentDoctorId || a.doctorId === currentDoctorId,
                  )
                  .filter((a) => getPatientStage(a) === "doctor").length
              }
            />
            {(!currentDoctorId ||
              hasFullFrontOfficeAccess ||
              currentExpertId) && (
                <StatCard
                  colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  icon={<IoPeopleOutline className="w-5 h-5" />}
                  label="In Expert Cabin"
                  value={
                    appointments
                      .filter(
                        (a) =>
                          !currentExpertId ||
                          a.assignedExpertId === currentExpertId,
                      )
                      .filter((a) => getPatientStage(a) === "expert").length
                  }
                />
              )}
            {(hasFullFrontOfficeAccess || currentExpertId) && (
              <>
                <StatCard
                  colorClass="bg-saffron-500/10 text-saffron-600"
                  icon={<IoCardOutline className="w-5 h-5" />}
                  label="Invoice Pending"
                  value={
                    appointments.filter(getQueueFilter).filter((a) => {
                      const s = getPatientStage(a);

                      return s === "billing";
                    }).length
                  }
                />
                <StatCard
                  colorClass="bg-purple-500/10 text-purple-600"
                  icon={<IoReceiptOutline className="w-5 h-5" />}
                  label="Pharmacy Pending"
                  value={
                    appointments.filter(getQueueFilter).filter((a) => {
                      const s = getPatientStage(a);

                      return s === "pharmacy";
                    }).length
                  }
                />
              </>
            )}
          </div>
        );
      })()}

      {/* Date Navigator Bar */}
      {(() => {
        const today = new Date();
        const todayStr = today.toDateString();
        const selectedStr = selectedDate.toDateString();
        const isSelectedToday = selectedStr === todayStr;
        const dateLabel = isSelectedToday
          ? "Today"
          : selectedDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });

        const goToPrev = () => {
          const d = new Date(selectedDate);

          d.setDate(d.getDate() - 1);
          setSelectedDate(d);
        };
        const goToNext = () => {
          const d = new Date(selectedDate);

          d.setDate(d.getDate() + 1);
          setSelectedDate(d);
        };
        const goToToday = () => setSelectedDate(new Date());

        return (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface border border-border-base rounded px-4 py-2.5">
            <div className="flex items-center gap-2">
              <button
                className="h-7 w-7 flex items-center justify-center rounded border border-border-base hover:border-primary hover:text-primary text-text-muted transition-colors"
                title="Previous day"
                type="button"
                onClick={goToPrev}
              >
                &#8249;
              </button>
              <div className="text-center">
                <p className="text-[13px] font-bold text-text-main">
                  {dateLabel}
                </p>
                <p className="text-[11px] text-text-muted">
                  {selectedDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })}
                </p>
              </div>
              <button
                className="h-7 w-7 flex items-center justify-center rounded border border-border-base hover:border-primary hover:text-primary text-text-muted transition-colors"
                title="Next day"
                type="button"
                onClick={goToNext}
              >
                &#8250;
              </button>
              {!isSelectedToday && (
                <button
                  className="text-[11px] font-bold text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded transition-colors"
                  type="button"
                  onClick={goToToday}
                >
                  Back to Today
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11.5px] font-semibold text-text-muted">
                Jump to date:
              </label>
              <input
                className="h-8 px-2 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary transition-colors"
                type="date"
                value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`}
                onChange={(e) => {
                  if (e.target.value)
                    setSelectedDate(new Date(e.target.value + "T00:00:00"));
                }}
              />
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isSelectedToday
                  ? "bg-primary/10 text-primary"
                  : "bg-warning/10 text-warning-600"
                  }`}
              >
                {isSelectedToday ? "● Live" : "📅 Archive"}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Live Queue Board and Tabs */}
      <div className="bg-surface border border-border-base rounded overflow-hidden shadow-none">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border-base bg-surface-2 p-1 gap-1 flex-wrap">
          {(() => {
            const getQueueFilter = (a: Appointment) => {
              if (currentDoctorId || currentExpertId) {
                const isMyDoctorPatient =
                  currentDoctorId && a.doctorId === currentDoctorId;
                const isMyExpertPatient =
                  currentExpertId && a.assignedExpertId === currentExpertId;

                if (currentDoctorId && currentExpertId) {
                  return isMyDoctorPatient || isMyExpertPatient;
                }
                if (currentDoctorId) return isMyDoctorPatient;
                if (currentExpertId) return isMyExpertPatient;
              }

              return true;
            };

            return [
              {
                id: "urgent",
                name: "🚨 ACTION REQUIRED",
                count: appointments.filter(getQueueFilter).filter((a) => {
                  const s = getPatientStage(a);

                  if (s === "billing") return true;

                  const consBill = (a as any).consultationBillingId
                    ? billings.find(
                      (b) => b.id === (a as any).consultationBillingId,
                    )
                    : null;
                  const isConsBillPaid = consBill
                    ? consBill.status === "paid" ||
                    consBill.paymentStatus === "paid"
                    : false;

                  if (
                    (s === "lobby" || s === "scheduled") &&
                    consBill &&
                    !isConsBillPaid
                  )
                    return true;

                  if (
                    !a.onHold &&
                    a.createdAt &&
                    (s === "lobby" ||
                      s === "triage-done" ||
                      s === "doctor" ||
                      s === "expert")
                  ) {
                    const dObj = (a.createdAt as any).seconds
                      ? new Date((a.createdAt as any).seconds * 1000)
                      : new Date(a.createdAt);

                    if (
                      !isNaN(dObj.getTime()) &&
                      Math.floor(
                        (new Date().getTime() - dObj.getTime()) / 60000,
                      ) > 30
                    ) {
                      return true;
                    }
                  }

                  return false;
                }).length,
              },
              {
                id: "lobby",
                name: " LOBBY QUEUE / WAITLIST",
                count: appointments.filter(getQueueFilter).filter((a) => {
                  const s = getPatientStage(a);

                  if (s === "scheduled") return true;
                  if (s !== "lobby") return false;
                  const consBill = (a as any).consultationBillingId
                    ? billings.find(
                      (b) => b.id === (a as any).consultationBillingId,
                    )
                    : null;
                  const isConsBillPaid = consBill
                    ? consBill.status === "paid" ||
                    consBill.paymentStatus === "paid"
                    : false;
                  const isConsBillPending = consBill && !isConsBillPaid;

                  return isConsBillPending;
                }).length,
              },
              {
                id: "triage",
                name: "🩺 TRIAGE WAITING",
                count: appointments.filter(getQueueFilter).filter((a) => {
                  const s = getPatientStage(a);

                  if (s !== "lobby") return false;
                  const consBill = (a as any).consultationBillingId
                    ? billings.find(
                      (b) => b.id === (a as any).consultationBillingId,
                    )
                    : null;
                  const isConsBillPaid = consBill
                    ? consBill.status === "paid" ||
                    consBill.paymentStatus === "paid"
                    : false;
                  const isConsBillPending = consBill && !isConsBillPaid;

                  return !isConsBillPending;
                }).length,
              },
              {
                id: "doctor",
                name: "👨‍⚕️ DOCTOR CABINS",
                count: appointments
                  .filter(
                    (a) => !currentDoctorId || a.doctorId === currentDoctorId,
                  )
                  .filter((a) => {
                    const s = getPatientStage(a);
                    const hasDoc = a.doctorId && a.doctorId !== "unassigned";

                    return s === "doctor" || (s === "triage-done" && hasDoc);
                  }).length,
              },
              {
                id: "expert",
                name: "👥 EXPERT CABINS",
                count: appointments
                  .filter(
                    (a) =>
                      !currentExpertId ||
                      a.assignedExpertId === currentExpertId,
                  )
                  .filter((a) => {
                    const s = getPatientStage(a);
                    const hasDoc = a.doctorId && a.doctorId !== "unassigned";

                    return s === "expert" || (s === "triage-done" && !hasDoc);
                  }).length,
              },
              {
                id: "billing",
                name: "💳 BILLING COUNTER",
                count: appointments
                  .filter(getQueueFilter)
                  .filter((a) => getPatientStage(a) === "billing").length,
              },
              {
                id: "pharmacy",
                name: "💊 PHARMACY QUEUE",
                count: appointments
                  .filter(getQueueFilter)
                  .filter((a) => getPatientStage(a) === "pharmacy").length,
              },
              {
                id: "all",
                name: "📋 ALL WORKFLOW",
                count: appointments.filter(getQueueFilter).length,
              },
            ]
              .filter((tab) => {
                if (hasFullFrontOfficeAccess) return true;

                const isDoc = userData?.role === "doctor" || currentDoctorId;
                const isExp = userData?.role === "expert" || currentExpertId;

                if (isDoc && isExp)
                  return ["doctor", "expert"].includes(tab.id);
                if (isDoc) return ["doctor"].includes(tab.id);
                if (isExp) return ["expert"].includes(tab.id);

                return false; // Prevent unauthorized access to all tabs
              })
              .map((tab) => (
                <button
                  key={tab.id}
                  className={`px-4 py-2 text-[12px] font-semibold rounded transition flex items-center gap-2 border border-transparent ${activeTab === tab.id
                    ? "bg-surface text-primary shadow-sm border-border-base/50"
                    : "text-text-muted hover:text-text-main hover:bg-surface-3/50"
                    }`}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                >
                  {tab.name}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "bg-surface-3 text-text-muted"
                      }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ));
          })()}
        </div>

        {/* Find a patient regardless of which stage/tab they're currently
            in — while active, this bypasses the tab filter entirely rather
            than further narrowing whichever tab happens to be selected. */}
        <div className="px-4 pt-3">
          <div className="relative max-w-sm">
            <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/50 w-4 h-4" />
            <input
              className="w-full h-9 pl-9 pr-8 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary placeholder:text-text-muted/40 text-text-main"
              placeholder="Find a patient by name or reg. number…"
              type="text"
              value={boardSearchQuery}
              onChange={(e) => setBoardSearchQuery(e.target.value)}
            />
            {boardSearchQuery && (
              <button
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                type="button"
                onClick={() => setBoardSearchQuery("")}
              >
                <IoCloseOutline className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live List rendering */}
        <div className="p-4">
          {loading ? (
            <div className="py-20 text-center flex flex-col justify-center items-center gap-3">
              <Spinner size="lg" />
              <p className="text-[13.5px] font-medium text-text-muted">
                Loading live waitlist queue...
              </p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <IoPeopleOutline className="w-12 h-12 text-text-muted/20 mb-3" />
              <p className="text-[14.5px] font-medium text-text-main">
                {hasFullFrontOfficeAccess
                  ? "No patients in this stage"
                  : "Your queue is currently empty"}
              </p>
              <p className="text-[13px] text-text-muted mt-1 max-w-sm mx-auto">
                {hasFullFrontOfficeAccess
                  ? "There are no active patient records matching this operational queue filter."
                  : "You have no pending patients assigned to your cabin at the moment. Take a short break or check back later."}
              </p>
            </div>
          ) : (
            <QueueList
              billings={billings}
              currentDoctorId={currentDoctorId}
              currentExpertId={currentExpertId}
              filteredAppointments={filteredAppointments}
              getApptTypeLabel={getApptTypeLabel}
              getDoctorName={getDoctorName}
              getDoctorSpeciality={getDoctorSpeciality}
              getGuidedAction={getGuidedAction}
              getPatientName={getPatientName}
              getPatientReg={getPatientReg}
              getPatientStage={getPatientStage}
              getStageBadge={getStageBadge}
              handleCompleteCheckout={handleCompleteCheckout}
              handleCompleteConsultation={handleCompleteConsultation}
              handleOpenProcedure={handleOpenProcedure}
              handleSendToDoctor={handleSendToDoctor}
              handleSendToExpert={handleSendToExpert}
              isActionPending={isActionPending}
              loading={loading}
              onToggleUrgent={handleToggleUrgent}
              onMarkNoShow={handleMarkNoShow}
              onReinstateNoShow={handleReinstateNoShow}
              onSendBack={setSendBackAppt}
              onToggleHold={handleHoldButtonClick}
            />
          )}
        </div>
      </div>

      {/* Render the triage vitals popup modal */}
      {renderTriageModal()}

      {/* Render the cabin routing popup modal */}
      {renderRoutingModal()}

      {/* Render the procedure log popup modal */}
      {renderProcedureModal()}

      {/* Send Back to Lobby / Undo Check-In — undo mis-routing, premature
          triage, or check-in itself, depending on the patient's stage */}
      <ReasonConfirmModal
        confirmColor="danger"
        confirmText={
          sendBackAppt && getPatientStage(sendBackAppt) === "lobby"
            ? "Undo Check-In"
            : "Send Back to Lobby"
        }
        description={
          sendBackAppt && getPatientStage(sendBackAppt) === "lobby"
            ? "This returns the patient to Scheduled, undoing check-in. It does not affect any invoice already created for this visit, and cannot un-send any check-in SMS that was already sent."
            : "This clears the patient's cabin assignment and triage status, moving them back to the Lobby queue. It does not affect any invoice already created for this visit."
        }
        isOpen={Boolean(sendBackAppt)}
        isSubmitting={isSendingBack}
        reasonLabel="Reason for sending back"
        title={
          sendBackAppt && getPatientStage(sendBackAppt) === "lobby"
            ? "Undo Check-In"
            : "Send Patient Back to Lobby"
        }
        onClose={() => setSendBackAppt(null)}
        onConfirm={(reason) => {
          if (sendBackAppt) handleSendBackToLobby(sendBackAppt, reason);
        }}
      />

      {/* Put On Hold — patient temporarily stepped out mid-visit. Resuming
          doesn't use this modal (see handleHoldButtonClick) — only
          starting a hold needs a documented reason. */}
      <ReasonConfirmModal
        confirmColor="primary"
        confirmText="Put On Hold"
        description="This pauses the wait-time indicator and excludes this patient from the 30-minute auto-urgent alert. It doesn't change their stage or routing."
        isOpen={Boolean(holdAppt)}
        isSubmitting={isTogglingHold}
        reasonLabel="Reason patient is on hold"
        title="Put Patient On Hold"
        onClose={() => setHoldAppt(null)}
        onConfirm={(reason) => {
          if (holdAppt) handleToggleHold(holdAppt, reason);
        }}
      />

      {/* Clinician Duty Status — who's actually at the clinic right now */}
      {isDutyPanelOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsDutyPanelOpen(false)}
            />
            <div className="bg-surface rounded border border-border-base shadow-xl max-w-sm w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
              <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
                <h3 className="font-bold text-[14.5px] text-text-main">
                  Clinician Duty Status
                </h3>
                <button
                  className="text-text-muted hover:text-text-main p-1"
                  type="button"
                  onClick={() => setIsDutyPanelOpen(false)}
                >
                  <IoCloseOutline className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto">
                <div>
                  <p className="text-[11.5px] font-semibold text-text-muted mb-2 uppercase tracking-wide">
                    Doctors
                  </p>
                  <div className="space-y-1.5">
                    {doctors
                      .filter((d) => d.isActive)
                      .map((d) => {
                        const onDuty = d.isOnDuty ?? true;

                        return (
                          <div
                            key={d.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-surface-2"
                          >
                            <span className="text-[13px] text-text-main">
                              {d.name}
                            </span>
                            <button
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${onDuty
                                ? "bg-success/15 text-success"
                                : "bg-surface-3 text-text-muted"
                                }`}
                              disabled={togglingDutyId === d.id}
                              type="button"
                              onClick={() => handleToggleDoctorDuty(d)}
                            >
                              {togglingDutyId === d.id
                                ? "..."
                                : onDuty
                                  ? "On Duty"
                                  : "Off Duty"}
                            </button>
                          </div>
                        );
                      })}
                    {doctors.filter((d) => d.isActive).length === 0 && (
                      <p className="text-xs text-text-muted px-2.5">
                        No active doctors.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[11.5px] font-semibold text-text-muted mb-2 uppercase tracking-wide">
                    Experts
                  </p>
                  <div className="space-y-1.5">
                    {experts
                      .filter((e) => e.isActive)
                      .map((e) => {
                        const onDuty = e.isOnDuty ?? true;

                        return (
                          <div
                            key={e.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-surface-2"
                          >
                            <span className="text-[13px] text-text-main">
                              {e.name}
                            </span>
                            <button
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${onDuty
                                ? "bg-success/15 text-success"
                                : "bg-surface-3 text-text-muted"
                                }`}
                              disabled={togglingDutyId === e.id}
                              type="button"
                              onClick={() => handleToggleExpertDuty(e)}
                            >
                              {togglingDutyId === e.id
                                ? "..."
                                : onDuty
                                  ? "On Duty"
                                  : "Off Duty"}
                            </button>
                          </div>
                        );
                      })}
                    {experts.filter((e) => e.isActive).length === 0 && (
                      <p className="text-xs text-text-muted px-2.5">
                        No active experts.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Render the quick intake walk-in modal */}
      {isQuickIntakeOpen && renderQuickIntakeModal()}

      {/* Render Finalise Procedure Modal */}
      {apptToFinalise &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setApptToFinalise(null)}
            />
            <div className="bg-surface rounded border border-border-base shadow-xl max-w-md w-full mx-4 relative z-10 p-5 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="font-bold text-lg text-text-main mb-2">
                Finalise Procedure
              </h3>
              <p className="text-sm text-text-muted mb-4">
                The expert recommended the following procedure for this patient.
                Would you like to generate a bill for it?
              </p>
              <div className="bg-surface-2 border border-border-base p-3 rounded mb-5">
                {(apptToFinalise as any).recommendedProcedure?.items &&
                  Array.isArray(
                    (apptToFinalise as any).recommendedProcedure.items,
                  ) ? (
                  <div className="flex flex-col gap-2">
                    {(apptToFinalise as any).recommendedProcedure.items.map(
                      (item: any) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center bg-surface border border-border-base rounded p-2"
                        >
                          <Checkbox
                            isSelected={finaliseSelectedItems.includes(item.id)}
                            onValueChange={(checked) => {
                              if (checked) {
                                setFinaliseSelectedItems((prev) => [
                                  ...prev,
                                  item.id,
                                ]);
                              } else {
                                setFinaliseSelectedItems((prev) =>
                                  prev.filter((id) => id !== item.id),
                                );
                              }
                            }}
                          >
                            <span className="text-[12.5px] text-text-main font-medium">
                              {item.name}
                            </span>
                          </Checkbox>
                          <div className="flex flex-col items-end gap-1 mt-2 sm:mt-0">
                            <span className="text-[12.5px] text-text-muted font-semibold">
                              NPR {item.fee.toLocaleString()}
                            </span>
                            <select
                              className="text-[11px] border border-border-base rounded px-1 py-0.5 bg-surface-2 w-40 focus:outline-primary"
                              value={itemExperts[item.id] || ""}
                              onChange={(e) =>
                                setItemExperts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">
                                Auto (Prescribing Clinician)
                              </option>
                              <optgroup label="Experts">
                                {experts.map((exp) => (
                                  <option key={exp.id} value={exp.id}>
                                    {exp.name}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Doctors">
                                {doctors.map((doc) => (
                                  <option key={doc.id} value={doc.id}>
                                    {doc.name}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      ),
                    )}
                    <div className="mt-2 pt-2 border-t border-border-base flex justify-between items-center">
                      <span className="text-sm font-semibold text-text-main">
                        Total Recommended Fee:
                      </span>
                      <span className="text-sm font-bold text-primary">
                        NPR{" "}
                        {(apptToFinalise as any).recommendedProcedure.items
                          .filter((i: any) =>
                            finaliseSelectedItems.includes(i.id),
                          )
                          .reduce((acc: number, curr: any) => acc + curr.fee, 0)
                          .toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-primary mb-1">
                      {(apptToFinalise as any).recommendedProcedure?.name}
                    </p>
                    <p className="text-xs text-text-main">
                      Area:{" "}
                      {(apptToFinalise as any).recommendedProcedure?.area ||
                        "N/A"}
                    </p>
                    <p className="text-xs text-text-main font-semibold mt-1">
                      Fee: NPR{" "}
                      {(
                        apptToFinalise as any
                      ).recommendedProcedure?.fee?.toLocaleString() || "0"}
                    </p>
                  </>
                )}
              </div>

              {/* Discount & Tax — applied to whichever invoice this
                  finalization writes to (new or an existing unlocked one),
                  via the same taxEngine-backed calculateInvoiceTotals used
                  everywhere else. Purely a live preview here; the actual
                  write happens in handleFinaliseProcedure. */}
              {(() => {
                const rawFee =
                  (apptToFinalise as any).recommendedProcedure?.items &&
                    Array.isArray(
                      (apptToFinalise as any).recommendedProcedure.items,
                    )
                    ? (apptToFinalise as any).recommendedProcedure.items
                      .filter((i: any) => finaliseSelectedItems.includes(i.id))
                      .reduce(
                        (acc: number, curr: any) => acc + curr.fee,
                        0,
                      )
                    : (apptToFinalise as any).recommendedProcedure?.fee || 0;
                const discountAmt =
                  finaliseDiscountType === "flat"
                    ? Math.min(finaliseDiscountValue, rawFee)
                    : (rawFee * finaliseDiscountValue) / 100;
                const afterDiscount = Math.max(0, rawFee - discountAmt);
                const taxRate = billingSettings?.defaultTaxPercentage || 0;
                const taxAmt = finaliseApplyTax
                  ? (afterDiscount * taxRate) / 100
                  : 0;
                const finalTotal = afterDiscount + taxAmt;

                return (
                  <div className="bg-surface-2 border border-border-base p-3 rounded mb-5 space-y-2.5">
                    <p className="text-[11.5px] font-semibold text-text-muted uppercase tracking-wide">
                      Discount & Tax
                    </p>
                    <div className="flex gap-2">
                      <select
                        className="text-[12px] border border-border-base rounded px-2 py-1.5 bg-surface"
                        value={finaliseDiscountType}
                        onChange={(e) =>
                          setFinaliseDiscountType(e.target.value as any)
                        }
                      >
                        <option value="percent">% Discount</option>
                        <option value="flat">Flat Discount</option>
                      </select>
                      <input
                        className="flex-1 text-[12px] border border-border-base rounded px-2 py-1.5 bg-surface"
                        min={0}
                        placeholder={
                          finaliseDiscountType === "percent" ? "0%" : "NPR 0"
                        }
                        type="number"
                        value={finaliseDiscountValue || ""}
                        onChange={(e) =>
                          setFinaliseDiscountValue(
                            Math.max(0, parseFloat(e.target.value) || 0),
                          )
                        }
                      />
                    </div>
                    <Checkbox
                      isSelected={finaliseApplyTax}
                      onValueChange={setFinaliseApplyTax}
                    >
                      <span className="text-[12px] text-text-main">
                        Apply Tax{taxRate > 0 ? ` (${taxRate}%)` : ""}
                      </span>
                    </Checkbox>
                    <div className="pt-2 border-t border-border-base space-y-1">
                      {discountAmt > 0 && (
                        <div className="flex justify-between text-[11.5px] text-text-muted">
                          <span>Discount:</span>
                          <span>- NPR {discountAmt.toLocaleString()}</span>
                        </div>
                      )}
                      {finaliseApplyTax && taxAmt > 0 && (
                        <div className="flex justify-between text-[11.5px] text-text-muted">
                          <span>Tax ({taxRate}%):</span>
                          <span>NPR {taxAmt.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-primary">
                        <span>Final Total:</span>
                        <span>NPR {finalTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 rounded text-sm font-semibold border border-border-base text-text-muted hover:text-red-500 hover:border-red-500 hover:bg-red-50 transition-colors"
                  disabled={isFinalisingProcedure}
                  type="button"
                  onClick={() => handleFinaliseProcedure(false)}
                >
                  Decline & Discard
                </button>
                <button
                  className="px-4 py-2 rounded text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  disabled={
                    isFinalisingProcedure ||
                    (Array.isArray(
                      (apptToFinalise as any).recommendedProcedure?.items,
                    ) &&
                      finaliseSelectedItems.length === 0)
                  }
                  type="button"
                  onClick={() => handleFinaliseProcedure(true)}
                >
                  {isFinalisingProcedure
                    ? "Processing..."
                    : "Accept & Generate Bill"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <SellPackageModal
        isOpen={isSellPackageModalOpen}
        patients={patients}
        onClose={() => setIsSellPackageModalOpen(false)}
      />
    </div>
  );
}
