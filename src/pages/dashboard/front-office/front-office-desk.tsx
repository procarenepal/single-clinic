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
import { specialityService } from "@/services/specialityService";
import {
  resolveSpecialityLabel,
  looksLikeUnresolvedId,
  type SpecialityOption,
} from "@/services/core/specialityDisplayCore";
import { hrService } from "@/services/hrService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { packageService } from "@/services/packageService";
import { walletService } from "@/services/walletService";
import {
  computeVisitPayableTotal,
  getVisitPaymentGate,
  mergeVisitReferrals,
  resolveVisitDiscount,
  todayLocalDateString,
} from "@/services/core/visitBillingCore";
import {
  canCompleteCheckout,
  deriveVisitStage,
  visitQueueCandidates,
} from "@/services/core/visitLifecycleCore";
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
  const [specialities, setSpecialities] = useState<SpecialityOption[]>([]);
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
        // A no-show after check-in can already carry accumulated charges
        // and a collected wallet deposit. Leaving those on the appointment
        // strands them: the visit is never checked out, so the charges are
        // never billed and the deposit never reconciled, with nothing in
        // the UI surfacing either. Clear the pending visit state; the
        // wallet balance itself is deliberately left alone and stays as
        // usable patient credit (same as unused credit everywhere else —
        // there is no cash-refund flow in this app to route it to).
        const strandedDeposit = (appt as any).depositedAmount || 0;

        await appointmentService.updateAppointmentStatus(appt.id, "no-show");
        await appointmentService.updateAppointment(appt.id, {
          notes: priorNotes ? `${priorNotes}\n${marker}` : marker,
          pendingVisitItems: [],
          pendingVisitReferrals: [],
          pendingVisitDiscountType: null,
          pendingVisitDiscountValue: 0,
          depositedAmount: 0,
          updatedAt: new Date(),
        } as any);
        addToast({
          title: "Marked No-Show",
          description: strandedDeposit > 0
            ? `${getPatientName(appt.patientId)} did not complete their visit. NPR ${strandedDeposit.toFixed(2)} already collected stays as wallet credit on their account.`
            : `${getPatientName(appt.patientId)} did not check in for their appointment.`,
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
  // Multiple clinicians can jointly perform one recommended procedure item
  // (e.g. two experts on the same treatment) — each gets their own line
  // item on an even split of the fee, with their own commission computed on
  // their own share, rather than forcing one clinician to take sole credit.
  const [itemExperts, setItemExperts] = useState<Record<string, string[]>>(
    {},
  );
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
        const initialExperts: Record<string, string[]> = {};

        rec.items.forEach((i: any) => {
          initialExperts[i.id] = [];
        });
        setItemExperts(initialExperts);
      }
      setFinaliseDiscountType("percent");
      setFinaliseDiscountValue(0);
      // "Apply Tax" is a GATE — calculateInvoiceTotals taxes nothing when
      // it's off, even an item whose own Appointment Type is explicitly
      // marked Taxable. Defaulting to false regardless silently overrode
      // that category setting. Default from whether any recommended item
      // is catalogue-taxable instead (same fix as Quick Intake/Routing);
      // still editable by staff for a one-off exception.
      const anyItemTaxable =
        rec?.items &&
        Array.isArray(rec.items) &&
        rec.items.some((i: any) => {
          const at = appointmentTypes.find((t) => t.id === i.id);

          return at?.isTaxable === true;
        });

      setFinaliseApplyTax(Boolean(anyItemTaxable));
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
    appointmentDate: todayLocalDateString(),
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
    // "Apply Tax to Invoice" is a GATE — defaulting it off regardless of
    // the pre-selected category silently overrode a category explicitly
    // marked Taxable (see the matching fix on the per-row selector in
    // QuickIntakeModal.tsx). Default from the first row's own category,
    // same as routing already does in handleSendToDoctor/handleSendToExpert.
    const doctorDefaultType = appointmentTypes.find(
      (t) => t.id === doctorDefaults.appointmentTypeId,
    );

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
      appointmentDate: todayLocalDateString(),
      doctorId: "",
      assignedExpertId: "unassigned",
      appointmentTypeId: doctorDefaults.appointmentTypeId,
      reason: "",
      referralPartnerId: "",
      referrals: [],
      paymentMethod: "cash",
      paymentReference: "",
      generateConsultationBill: true,
      applyTax: Boolean(doctorDefaultType?.isTaxable),
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
        // appointmentTypes and billingSettings are NOT fetched here — they
        // feed directly into tax/commission math on every invoice this
        // desk creates, so they're live-subscribed instead (see the "Live
        // Sync" effect below) rather than frozen at whatever they were
        // when the page loaded.
        const [
          patientsData,
          doctorsData,
          pkgsData,
          referralPartnersData,
          expertsData,
          staffData,
          specialitiesData,
        ] = await Promise.all([
          patientService.getPatients(clinicId),
          doctorService.getDoctors(clinicId),
          packageService.getPackagesByClinic(clinicId),
          referralPartnerService.getReferralPartnersByClinic(
            clinicId,
          ),
          expertService.getExpertsByClinic(
            clinicId || undefined,
          ),
          hrService.getStaffByClinic(clinicId!),
          // A clinician's `speciality` can hold a speciality's document id,
          // so the list is needed to render a name instead of that id.
          // Never let it break the desk — the resolver falls back to the
          // stored value when the list is empty.
          specialityService.getSpecialities(true, clinicId).catch(() => []),
        ]);

        if (isActive) {
          setPatients(patientsData);
          setDoctors(doctorsData);
          setPackages(pkgsData);
          setReferralPartners(referralPartnersData);
          setExperts(expertsData || []);
          setStaff(staffData || []);
          setSpecialities(specialitiesData || []);

          // Pre-select first doctor for quick walk-in intake
          if (doctorsData.length > 0) {
            setQuickIntakeForm((prev) => ({
              ...prev,
              doctorId: doctorsData[0].id,
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

  // Pre-select the consultation appointment type for Quick Intake once
  // appointmentTypes first arrives from its live subscription — guarded so
  // it only runs while the field is still blank, never overwriting a
  // staff member's own in-progress selection on a later types update.
  useEffect(() => {
    if (appointmentTypes.length === 0) return;

    setQuickIntakeForm((prev) => {
      if (prev.appointmentTypeId) return prev;

      const consultationType = appointmentTypes.find(
        (t) =>
          t.id === "consultation-fee" ||
          t.name.toLowerCase().includes("consultation"),
      );

      return {
        ...prev,
        appointmentTypeId: consultationType
          ? consultationType.id
          : appointmentTypes[0].id,
      };
    });
  }, [appointmentTypes]);

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

    // Subscribe to Appointment Types in real-time — tax rate, commission %,
    // and price on a category feed directly into the invoice this desk
    // creates, so a one-time fetch here would keep billing against
    // whatever an admin's settings looked like when the tab was opened.
    const unsubscribeApptTypes =
      appointmentTypeService.subscribeToClinicAppointmentTypes(
        clinicId,
        (data) => setAppointmentTypes(data),
        (err) => {
          console.error("Live appointment types subscription error:", err);
          addToast({
            title: "Live Updates Interrupted",
            description:
              "Lost connection to live service/category settings — tax and commission on new invoices may be stale. Please refresh.",
            color: "danger",
          });
        },
      );

    // Subscribe to Billing Settings in real-time — the clinic-wide tax
    // master switch (enableTax) and default rate, same reasoning as above.
    const unsubscribeBillingSettings =
      appointmentBillingService.subscribeToBillingSettings(
        clinicId,
        (data) => setBillingSettings(data),
        (err) => {
          console.error("Live billing settings subscription error:", err);
          addToast({
            title: "Live Updates Interrupted",
            description:
              "Lost connection to live billing settings — tax on new invoices may be stale. Please refresh.",
            color: "danger",
          });
        },
      );

    return () => {
      unsubscribeAppts?.();
      unsubscribeBillings?.();
      unsubscribePrescriptions?.();
      unsubscribeApptTypes?.();
      unsubscribeBillingSettings?.();
    };
  }, [clinicId, branchId, selectedDate]);

  // The name of whoever is logged in right now, for attribution written
  // into permanent records — package-session consumption logs, procedure
  // notes ("Written By: ..."). currentDoctorId/currentExpertId are already
  // resolved (by email) against the SAME doctors/experts lists this page
  // loads for routing, so this reuses that match rather than doing a
  // second lookup. The account's own name is a placeholder set once at
  // creation and never revisited (see dashboard-header.tsx's fix for the
  // live example: "Dr. Clinic Doctor" logged in as, everywhere else on the
  // app, "Dr. Pratik Bhusal") — the clinical profile is what's actively
  // maintained, so it wins whenever one is matched.
  const getLoggedInClinicianName = (fallback: string) =>
    doctors.find((d) => d.id === currentDoctorId)?.name ||
    experts.find((e) => e.id === currentExpertId)?.name ||
    (userData as any)?.name ||
    currentUser?.displayName ||
    fallback;

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

    // A clinician's `speciality` may hold a speciality's document id rather
    // than its name (see specialityDisplayCore), so it is never printed raw.
    // An id that resolves to nothing is dropped entirely instead of being
    // shown to staff as a meaningless string.
    const label = (stored: string | undefined, fallback: string) => {
      const resolved = resolveSpecialityLabel(stored, specialities);

      return resolved && !looksLikeUnresolvedId(resolved) ? resolved : fallback;
    };

    if (doc && exp) {
      if (stage === "doctor") {
        return label(doc.speciality, "Dermatology");
      } else if (stage === "expert") {
        return label(exp.speciality, "Skin & Laser Consultant");
      } else {
        const docLabel = label(doc.speciality, "Dermatology");
        const expLabel = label(exp.speciality, "Laser Consultant");

        // A doctor and an expert on the same visit often share a speciality
        // — once ids resolve to names this printed it twice ("General
        // Practice & General Practice").
        return docLabel === expLabel ? docLabel : `${docLabel} & ${expLabel}`;
      }
    }

    if (exp) return label(exp.speciality, "Skin & Laser Consultant");
    if (doc) return label(doc.speciality, "Dermatology");

    const fallbackExp = experts.find((e) => e.id === appt.doctorId);

    if (fallbackExp)
      return label(fallbackExp.speciality, "Skin & Laser Consultant");

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
      const existingPendingItems: any[] =
        (appt as any)?.pendingVisitItems || [];

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

        // Idempotency: same clinician + appointment type already appended
        // to this visit's pending items — skip rather than double-charge.
        // Replaces the old "reuse the existing consultationBillingId
        // invoice" guard, which no longer applies since nothing is filed
        // as a real invoice until checkout.
        const dedupeKey = cl.appointmentTypeId || "consultation-fee";

        if (
          existingPendingItems.some(
            (it) =>
              it.doctorId === cl.clinicianId &&
              (it.appointmentTypeId || "consultation-fee") === dedupeKey,
          )
        ) {
          continue;
        }

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
          // Front desk's own per-row price override (Quick Intake's clinician
          // rows now show and let staff edit the price before check-in)
          // always wins — previously staff had no visibility into this
          // price at all until after the invoice was already created.
          if (typeof cl.price === "number" && !isNaN(cl.price)) {
            clConsultationPrice = cl.price;
          } else if (docInfo) {
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
            // Rounded to 2 decimals matching this app's established IRD
            // monetary convention (see taxEngine.ts) — an unrounded
            // division (e.g. 25000/3) produces long floating-point
            // artifacts that would otherwise flow straight into the
            // invoice amount and commission calculation.
            const perSessionValue =
              pkg.price > 0
                ? Math.round((pkg.price / sessionCount) * 100) / 100
                : 0;
            // This package's own commission % (Package Settings) takes
            // priority over the clinician's blanket default — same
            // category-priority rule already used for AppointmentType.
            const resolvedCommission =
              pkg.calculateCommission !== false &&
              typeof pkg.defaultCommission === "number"
                ? pkg.defaultCommission
                : (isExpert
                  ? expInfo?.defaultCommission
                  : docInfo?.defaultCommission) || 0;
            const commissionPct =
              cl.addCommission && pkg.calculateCommission !== false
                ? resolvedCommission
                : 0;

            if (perSessionValue > 0) {
              // Always record which clinician performed this session — even
              // with commissionPct 0 (unchecked "Add Commission" or no
              // default set) — so the session has an invoice/audit trail
              // instead of silently vanishing from the visit record.
              clApptTypeItem = {
                id: crypto.randomUUID(),
                appointmentTypeId: cl.appointmentTypeId,
                appointmentTypeName: `Package Session — ${pkg.name}`,
                price: 0,
                quantity: 1,
                lineKind: "service",
                commission: commissionPct,
                calculateCommission: pkg.calculateCommission,
                doctorId: cl.clinicianId,
                doctorName: isExpert
                  ? expInfo?.name || "Expert"
                  : docInfo?.name || "GP",
                amount: perSessionValue,
              };
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

              // Front desk's own per-row price override wins over both the
              // catalog price and the doctor's default consultation charge
              // — see the identical override in the clConsultationPrice
              // block above.
              if (typeof cl.price === "number" && !isNaN(cl.price)) {
                finalPrice = cl.price;
              }

              // This service's own commission % (Appointment Type Settings)
              // takes priority over the clinician's blanket default —
              // previously commission always came from the doctor/expert
              // alone, regardless of which service was actually billed.
              const resolvedFields =
                appointmentBillingService.resolveItemFieldsFromAppointmentType(
                  apptType,
                  isExpert
                    ? expInfo?.defaultCommission
                    : docInfo?.defaultCommission,
                );

              clApptTypeItem = {
                id: crypto.randomUUID(),
                appointmentTypeId: apptType.id,
                appointmentTypeName: apptType.name,
                price: finalPrice,
                quantity: 1,
                lineKind: "service",
                commission:
                  cl.addCommission && apptType.calculateCommission !== false
                    ? resolvedFields.commission
                    : 0,
                calculateCommission: resolvedFields.calculateCommission,
                doctorId: cl.clinicianId,
                doctorName: isExpert
                  ? expInfo?.name || "Expert"
                  : docInfo?.name || "GP",
                amount: finalPrice,
                // Sourced automatically from the service instead of staff
                // manually toggling tax per invoice regardless of which
                // service is being charged.
                isTaxable: resolvedFields.isTaxable,
                taxRate: resolvedFields.taxRate,
              };
              totalInvoiceAmount += finalPrice;
            }
          }
        }

        if (clConsultationPrice > 0 && !clApptTypeItem) {
          // Falls through here for a manually-priced row (cl.price override)
          // whose appointmentTypeId didn't resolve to a real category — must
          // still attribute to whichever clinician type this row actually
          // is, not always the doctor (an expert row can reach here too via
          // the cl.price override above, which isn't doctor-only).
          const fallbackClinician = isExpert ? expInfo : docInfo;

          totalInvoiceAmount += clConsultationPrice;
          items.push({
            id: crypto.randomUUID(),
            appointmentTypeId: "consultation-fee",
            appointmentTypeName: isExpert
              ? `Consultation Fee - ${fallbackClinician?.name || "Expert"}`
              : `Doctor Consultation Fee - ${fallbackClinician?.name
                ? fallbackClinician.name.startsWith("Dr.")
                  ? fallbackClinician.name
                  : `Dr. ${fallbackClinician.name}`
                : "Dr. GP"
                }`,
            price: clConsultationPrice,
            quantity: 1,
            lineKind: "service",
            commission: cl.addCommission
              ? fallbackClinician?.defaultCommission || 0
              : 0,
            doctorId: cl.clinicianId,
            doctorName: fallbackClinician?.name || "Unknown Clinician",
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

      // Nothing is filed as a real invoice at check-in any more — items
      // accumulate on the appointment's pendingVisitItems, and the
      // consultation fee (if any) is collected as a wallet deposit instead.
      // Tax, discount and referral resolution now happen once, at checkout,
      // over the full accumulated item set (see handleSettleBilling) —
      // doing it here on a partial set and again at checkout would double
      // up referral commission.
      const updatedPendingItems = [...existingPendingItems, ...items];

      // What the patient actually owes for these lines — tax included, via
      // the same engine checkout uses. Summing raw line amounts collected
      // the pre-tax base and left exactly the tax outstanding on every
      // visit, so the desk took NPR 700 against a 791 invoice and then had
      // to chase 91 later. Package-session items are commission-only
      // (price 0, already paid for at package sale) and are excluded.
      const depositAmount = computeVisitPayableTotal(items as any, {
        taxPercentage: billingSettings?.defaultTaxPercentage,
        isTaxEnabled: Boolean(billingSettings?.enableTax),
        discountType: discountType || "percent",
        discountValue: discountValue || 0,
      });
      // Deposit FIRST, then persist — if the wallet call throws, the
      // deposit bookkeeping below must not record depositedAmount as having
      // grown, or the payment gate (owed vs deposited) would think this
      // amount was collected when it wasn't and never let staff collect it
      // for real. pendingVisitItems still gets the charge either way so
      // it's still billed at checkout.
      let depositSucceeded = false;

      if (depositAmount > 0) {
        try {
          await walletService.addFunds(
            patientId,
            clinicId!,
            depositAmount,
            "cash",
            `Visit deposit — consultation fee (appointment ${appointmentId})`,
            currentUser?.uid || "system",
            appointmentId,
            "appointment",
          );
          depositSucceeded = true;
        } catch (depErr) {
          console.error("Error collecting visit deposit:", depErr);
          addToast({
            title: "Deposit Not Collected",
            description:
              "Consultation fee was added to the visit but the wallet deposit failed — please collect it manually.",
            color: "warning",
          });
        }
      }

      await appointmentService.updateAppointment(appointmentId, {
        pendingVisitItems: updatedPendingItems,
        // Carries forward to checkout, which has no discount UI of its own
        // — without this, a discount entered here was silently dropped.
        // Only overwrite the visit's standing discount when this call
        // actually specified one, so an earlier (e.g. Finalise Procedure)
        // discount isn't clobbered by a later call that passed none.
        ...(discountValue
          ? {
            pendingVisitDiscountType: discountType || "percent",
            pendingVisitDiscountValue: discountValue,
          }
          : {}),
        billingId: null,
        billingStatus: "unpaid",
        paymentStatus: "unpaid",
        updatedAt: new Date(),
      } as any);

      // Recorded as an atomic increment, separately from the item append
      // above: a plain read-modify-write here lost one of two concurrent
      // deposits, leaving the wallet credited twice but the visit showing
      // only one collection.
      if (depositSucceeded) {
        await appointmentService.addToVisitDeposit(appointmentId, depositAmount);
      }

      console.log(
        "Consultation charge appended to pending visit items for appointment:",
        appointmentId,
      );

      return appointmentId;
    } catch (err) {
      console.error("Error automatically generating consultation bill:", err);
      throw err;
    }
  };

  // Collects the remaining owed-vs-deposited gap for a visit as a wallet
  // deposit, right from the guided action — no navigation, since there is
  // no invoice to navigate to until checkout (see
  // "One Invoice Per Visit: Deposit at Check-in, Bill at Checkout").
  const handleCollectDeposit = async (appt: Appointment) =>
    runGuarded(`collect-deposit-${appt.id}`, async () => {
      const gate = getVisitPaymentGate(appt as any, {
      taxPercentage: billingSettings?.defaultTaxPercentage,
      isTaxEnabled: Boolean(billingSettings?.enableTax),
    });

      if (!gate.isDue) return;

      // Claim the amount against freshly-read state BEFORE taking any
      // money. If another desk collected this visit a moment ago, the claim
      // comes back 0 and we must not charge the patient a second time —
      // the old code read the amount due from this browser's snapshot and
      // would happily collect it again.
      let claimed = 0;

      try {
        claimed = await appointmentService.claimVisitDeposit(
          appt.id,
          gate.dueAmount,
        );
      } catch (err) {
        console.error("Error claiming visit deposit:", err);
        addToast({
          title: "Deposit Not Collected",
          description: "Could not record the deposit. Please try again.",
          color: "danger",
        });

        return;
      }

      if (claimed <= 0) {
        addToast({
          title: "Already Collected",
          description:
            "This visit's deposit was just collected elsewhere — nothing further is due.",
          color: "warning",
        });

        return;
      }

      try {
        await walletService.addFunds(
          appt.patientId,
          clinicId || appt.clinicId,
          claimed,
          "cash",
          `Visit deposit — remaining balance (appointment ${appt.id})`,
          currentUser?.uid || "system",
          appt.id,
          "appointment",
        );

        addToast({
          title: "Deposit Collected",
          description: `NPR ${claimed.toFixed(2)} collected for this visit.`,
          color: "success",
        });
      } catch (err) {
        // The claim is already recorded, so hand it back — otherwise the
        // visit would look paid for when no money was actually taken.
        console.error("Error collecting deposit:", err);
        await appointmentService
          .releaseVisitDeposit(appt.id, claimed)
          .catch((releaseErr) =>
            console.error(
              "Failed to release an unfulfilled deposit claim:",
              releaseErr,
            ),
          );
        addToast({
          title: "Deposit Not Collected",
          description: "Could not record the deposit. Please try again.",
          color: "danger",
        });
      }
    });

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

    // Default from the booked appointment category's own settings instead
    // of always starting unchecked — the commission formula in
    // createConsultationBill is `cl.addCommission && calculateCommission`,
    // so leaving this false by default silently zeroed commission on every
    // single routing action even for a category explicitly configured to
    // earn one, forcing staff to remember to re-check it every time.
    const apptType = appointmentTypes.find(
      (t) => t.id === appt.appointmentTypeId,
    );

    // A doctor's own restricted dashboard only ever lists their own
    // patients, so "which doctor is this?" has exactly one sensible
    // answer. Without this, a patient with no prior doctor (a fresh
    // walk-in, or one whose last-seen doctor was someone else) opened the
    // modal with the field empty or pointing at a colleague — asking the
    // doctor to find and select themselves from a clinic-wide dropdown on
    // their own queue.
    const restrictedToSelf = Boolean(currentDoctorId) && !hasFullFrontOfficeAccess;

    setRoutingAppointment(appt);
    setRoutingCabin(appt.cabinName || "");
    setRoutingDoctorId(
      alreadyAssigned ||
      (restrictedToSelf ? currentDoctorId! : lastSeenDoctorId || ""),
    );
    setRoutingChargeConsultation(false);
    setRoutingApplyTax(Boolean(apptType?.isTaxable));
    setRoutingAddCommission(apptType?.calculateCommission !== false);
    setRoutingTarget("doctor");
    setIsRoutingModalOpen(true);

    // Only true when last-seen actually drove the default — restrictedToSelf
    // overrides it above, and this toast naming a possibly different doctor
    // would be wrong (and pointless) in that case.
    if (lastSeenDoctorId && !restrictedToSelf) {
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

    // Same category-driven default as handleSendToDoctor above.
    const apptType = appointmentTypes.find(
      (t) => t.id === appt.appointmentTypeId,
    );

    setRoutingAppointment(appt);
    setRoutingCabin(appt.cabinName || "");
    setRoutingExpertId(
      appt.assignedExpertId && appt.assignedExpertId !== "unassigned"
        ? appt.assignedExpertId
        : "",
    );
    setRoutingAddCommission(apptType?.calculateCommission !== false);
    setRoutingChargeConsultation(false);
    setRoutingApplyTax(Boolean(apptType?.isTaxable));
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

    try {
      // Get the price of the booked appointment type first to check if it's a consultation
      const apptType = appointmentTypes.find(
        (t) => t.id === appt.appointmentTypeId,
      );

      if (!apptType) return null;

      const isApptTypeConsultation = apptType.name
        .toLowerCase()
        .includes("consult");

      const existingPendingItems: any[] = (appt as any).pendingVisitItems || [];

      // Already appended for this visit — skip rather than double-charge.
      const hasBookedItem = existingPendingItems.some(
        (item: any) =>
          item.appointmentTypeId === appt.appointmentTypeId ||
          (isApptTypeConsultation &&
            item.appointmentTypeId === "consultation-fee"),
      );

      if (hasBookedItem) return null;

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

      const resolvedFields =
        appointmentBillingService.resolveItemFieldsFromAppointmentType(
          apptType,
          (docInfo as any)?.defaultCommission,
        );

      const newItem = {
        id: crypto.randomUUID(),
        appointmentTypeId: appt.appointmentTypeId,
        appointmentTypeName: apptType.name || "Procedure/Service Fee",
        price: price,
        quantity: 1,
        lineKind: "service" as const,
        commission: resolvedFields.commission,
        calculateCommission: resolvedFields.calculateCommission,
        isTaxable: resolvedFields.isTaxable,
        taxRate: resolvedFields.taxRate,
        doctorId: clinicianId,
        doctorName: docInfo?.name || "Clinician",
        amount: price,
      };

      await appointmentService.updateAppointment(appt.id, {
        pendingVisitItems: [...existingPendingItems, newItem],
        updatedAt: new Date(),
      } as any);

      return null;
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
                clinicianName: getLoggedInClinicianName("Unknown Clinician"),
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

        const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";

        // One definition of "may this visit close", shared with every other
        // caller (see visitLifecycleCore). These checks used to live only
        // inside this handler, so any other path that marked the visit
        // complete skipped them entirely — which is exactly what the
        // billing path did.
        const eligibility = canCompleteCheckout(appt as any, {
          invoice: appt.billingId
            ? billings.find((b) => b.id === appt.billingId) || null
            : null,
        });

        if (!eligibility.allowed) {
          addToast({
            title: "Cannot Complete Checkout",
            description: eligibility.reason,
            color: "warning",
          });

          return;
        }

        if (hasDoctor && appt.doctorConsultationCompleted !== true) {
          addToast({
            title: "Incomplete Clinical Documentation",
            description:
              "Cannot complete checkout. Doctor consultation has not been marked as completed.",
            color: "danger",
          });

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
              clinicianName: getLoggedInClinicianName("System/Front Desk"),
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
        // Structured record of the same fact. Triage completion drove the
        // patient's stage and the checkout gate purely from a magic
        // substring inside this free-text field — which any unrelated notes
        // edit could erase, and which could be typed by hand to pass the
        // clinical-documentation gate with no vitals ever taken. The note
        // line stays for readability; this is what the logic reads.
        triageCompletedAt: new Date(),
        triageRecordedBy: currentUser?.uid || "system",
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

      const clinicianName = getLoggedInClinicianName("Clinician");
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
              clinicianName: getLoggedInClinicianName("Unknown Clinician"),
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

        // This handoff bills a genuinely separate "Doctor Consultation" —
        // selectedAppointment.appointmentTypeId is still whatever the EXPERT's
        // procedure category was (e.g. Skin Test), which has nothing to do
        // with the doctor being routed to next. Passing that id through
        // unchanged would silently bill the expert's procedure a second
        // time (its own price/tax/commission) under a "Doctor Consultation
        // Fee" label — resolve the real Doctor Consultation category by
        // name and override it on the in-memory routing copy so
        // handleConfirmRoute's createConsultationBill call (which reads
        // routingAppointment.appointmentTypeId) bills the correct category.
        // The original Firestore appointment document is untouched.
        const doctorConsultationType = appointmentTypes.find(
          (t) => t.name?.toLowerCase() === "doctor consultation",
        );

        setRoutingAppointment({
          ...selectedAppointment,
          appointmentTypeId:
            doctorConsultationType?.id ||
            selectedAppointment.appointmentTypeId,
        } as any);
        setRoutingCabin(selectedAppointment.cabinName || "");
        setRoutingDoctorId(
          selectedAppointment.doctorId &&
            selectedAppointment.doctorId !== "unassigned"
            ? selectedAppointment.doctorId
            : "",
        );
        setRoutingChargeConsultation(false);
        setRoutingApplyTax(Boolean(doctorConsultationType?.isTaxable));
        setRoutingAddCommission(
          doctorConsultationType?.calculateCommission !== false,
        );
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
            clinicianName: getLoggedInClinicianName("Unknown Clinician"),
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
    // Delegates to visitLifecycleCore, which is the single definition of a
    // visit's stage and is unit-tested in isolation. The inference used to
    // live here and keyed off a STORED completion flag, which let the
    // billing path mark a visit done without passing the clinical or
    // balance checks — so a patient could vanish from the board still
    // owing money, and a cancelled invoice left a visit stranded as
    // "already billed" with nothing left to bill. Deriving it from the
    // invoice's real state fixes both.
    const hasPendingPrescription = prescriptions.some(
      (p) =>
        (p.appointmentId === appt.id || p.patientId === appt.patientId) &&
        p.sendToPharmacy === true &&
        p.status === "active",
    );
    const invoice = appt.billingId
      ? billings.find((b) => b.id === appt.billingId) || null
      : null;

    const stage = deriveVisitStage(appt as any, {
      invoice,
      hasPendingPrescription,
    });

    // "cancelled" is a lifecycle state this board has never rendered; it
    // groups with completed here so callers keep their existing union.
    return stage === "cancelled" ? "completed" : stage;
  };

  /**
   * Which of an appointment’s invoices (if any) is still unpaid.
   *
   * An appointment can carry TWO independent invoices — the consultation
   * fee (consultationBillingId) and a separate procedure charge (billingId)
   * — each settled independently. This file previously had SEVEN separate
   * inline copies of "is there a pending bill" logic. Several checked only
   * ONE of the two: either by picking one via `billingId ||
   * consultationBillingId` (so a paid procedure charge masked an unpaid
   * consultation fee, or vice versa), or by checking only
   * consultationBillingId (so an appointment with only a procedure charge —
   * no consultation bill at all — was never flagged, no matter how unpaid).
   * One correct implementation, used everywhere a "pending bill" check is
   * needed in this file.
   *
   * Returns the pending bill itself (not just a boolean) because several
   * call sites need it — to read its line items, or navigate to it.
   * Prefers the consultation bill when both are pending, matching this
   * file’s existing "Settle Consultation Bill" UI copy.
   */
  // Nothing is a filed invoice between check-in and checkout any more —
  // this now compares what the visit owes so far (pendingVisitItems) against
  // what's been deposited (depositedAmount), instead of looking up a real
  // AppointmentBilling document. Returns null when there's nothing owed or
  // the deposit already covers it; otherwise an object shaped enough like a
  // bill (`items`, `owed`, `deposited`) for existing call sites to keep
  // reading item-level detail (e.g. the "is this just the consultation fee"
  // badge check) without needing a real invoice id.
  const getPendingBillForAppointment = (appt: Appointment) => {
    const items: any[] = (appt as any).pendingVisitItems || [];
    const gate = getVisitPaymentGate(appt as any, {
      taxPercentage: billingSettings?.defaultTaxPercentage,
      isTaxEnabled: Boolean(billingSettings?.enableTax),
    });

    if (!gate.isDue) return null;

    return { items, owed: gate.owed, deposited: gate.deposited };
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

    const consBill = getPendingBillForAppointment(appt);
    const isConsBillPending = Boolean(consBill);

    if (activeTab === "urgent") {
      if (appt.isUrgent) return true;
      if (stage === "billing") return true;
      if (stage === "lobby" || stage === "scheduled") {
        if (consBill) return true;
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
    // An unrouted triage-done patient is a candidate for whichever
    // clinicians the visit names — both, when it names none. See
    // visitQueueCandidates.
    const queues = visitQueueCandidates(appt);

    if (activeTab === "doctor")
      return stage === "doctor" || (stage === "triage-done" && queues.doctor);
    if (activeTab === "expert")
      return stage === "expert" || (stage === "triage-done" && queues.expert);
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
      ? billings.find((b) => b.id === (routingAppointment as any).billingId)
      : null;
    // A visit's consultation fee now lives on the appointment as a pending
    // charge until checkout, so looking only at invoice pointers found
    // nothing for any in-progress visit — "Charge Consultation Fee" was
    // therefore offered as if nothing had been billed, and routing could
    // append a second consultation fee to the same visit.
    const routingPendingItems: any[] =
      (routingAppointment as any)?.pendingVisitItems || [];
    const routingPendingConsultationItem = routingPendingItems.find(
      (it) =>
        it.appointmentTypeId === "consultation-fee" ||
        it.appointmentTypeName?.toLowerCase().includes("consult"),
    );
    const routingConsultationBillPaid = routingExistingConsultationBill
      ? routingExistingConsultationBill.status === "paid" ||
      routingExistingConsultationBill.paymentStatus === "paid"
      : Boolean(routingPendingConsultationItem);
    const routingConsultationBillDoctorId =
      routingExistingConsultationBill?.doctorId ||
      routingPendingConsultationItem?.doctorId;

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
        lockedDoctorId={
          currentDoctorId && !hasFullFrontOfficeAccess ? currentDoctorId : null
        }
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
        const billingData = appointmentBillingService.buildPackageSaleBillingData({
          pkg,
          clinicId: clinicId!,
          branchId: branchId || clinicId!,
          patientId: patientIdToUse,
          patientName: patientNameToUse,
          patientPanVat: patientPanVatToUse,
          applyTax: quickIntakeForm.applyTax,
          defaultTaxPercentage: billingSettings?.defaultTaxPercentage,
          createdBy: currentUser?.uid || "system",
          // Identity for this one sale, so two genuinely distinct sales of
          // the same package to the same patient cannot collapse into a
          // single invoice via the content-plus-time-bucket fallback.
          saleId: crypto.randomUUID(),
        });

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
        //
        // The sale is already filed and paid by this point, so a failure
        // here must not abort the whole check-in and report it as failed —
        // that told staff nothing happened when money had in fact been
        // taken. Surface precisely what is missing instead, so the credit
        // can be added manually rather than silently never existing.
        if (pkg.walletCreditAmount > 0) {
          try {
            await walletService.addFunds(
              patientIdToUse,
              clinicId!,
              pkg.walletCreditAmount,
              quickIntakeForm.paymentMethod,
              `Package Credit: ${pkg.name}`,
              currentUser?.uid || "system",
            );
          } catch (creditErr) {
            console.error("Error granting package wallet credit:", creditErr);
            addToast({
              title: "Wallet Credit Not Added",
              description: `The package was sold and paid, but the NPR ${pkg.walletCreditAmount} wallet credit could not be added — add it manually from the patient's Wallet tab.`,
              color: "warning",
              duration: 15000,
            });
          }
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
            await createConsultationBill(
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
          } catch (billErr: any) {
            // The appointment itself succeeded, so the intake is NOT rolled
            // back — the patient really is checked in and queued. But the
            // consultation charge does not exist, and this was previously
            // logged and nothing else, so the desk saw the ordinary success
            // notifications and the visit went unbilled with nobody aware.
            console.error(
              "Error generating quick intake consultation bill:",
              billErr,
            );
            addToast({
              title: "Patient checked in, but NOT billed",
              description: `${billErr?.message || "The consultation invoice could not be created."} Raise the invoice at the Billing Counter before the patient leaves.`,
              color: "danger",
              // Longer than the default 4s: this one has to survive the
              // other intake notifications and be acted on.
              duration: 15000,
            });
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
              // Marks this as a sibling whose charges live on the primary
              // appointment, so checkout refuses to fabricate a duplicate
              // invoice for it (see handleSettleBilling).
              billedOnAppointmentId: newApptId,
              // The extra clinician's charge was already appended to the
              // PRIMARY appointment's pendingVisitItems inside the single
              // createConsultationBill(cliniciansList) call above — this
              // sibling appointment carries no billing pointer of its own.
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
      const resetDoctorDefaultType = appointmentTypes.find(
        (t) => t.id === resetDoctorDefaults.appointmentTypeId,
      );

      setQuickIntakeForm({
        name: "",
        mobile: "",
        patientPanVat: "",
        age: "",
        gender: "male",
        appointmentDate: todayLocalDateString(),
        doctorId: "",
        assignedExpertId: "",
        appointmentTypeId: resetDoctorDefaults.appointmentTypeId,
        reason: "",
        referralPartnerId: "",
        referrals: [],
        paymentMethod: "cash",
        paymentReference: "",
        generateConsultationBill: true,
        applyTax: Boolean(resetDoctorDefaultType?.isTaxable),
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
        defaultTaxPercentage={billingSettings?.defaultTaxPercentage || 0}
        enableTax={Boolean(billingSettings?.enableTax)}
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

          procedureItemsToAdd = billedItems.flatMap((i: any) => {
            const assignedIds =
              itemExperts[i.id] && itemExperts[i.id].length > 0
                ? itemExperts[i.id]
                : [clinicianId];
            const shareCount = assignedIds.length;
            const shareFee = i.fee / shareCount;
            const pType = appointmentTypes.find((t) => t.id === i.id);

            return assignedIds.map((cid) => {
              const cl =
                experts.find((e) => e.id === cid) ||
                doctors.find((d) => d.id === cid);
              // Category's own commission % takes priority over each
              // clinician's individual default — same priority rule used
              // everywhere else this session.
              const resolvedFields = pType
                ? appointmentBillingService.resolveItemFieldsFromAppointmentType(
                    pType,
                    cl?.defaultCommission ?? defaultComm,
                  )
                : {
                    commission: cl?.defaultCommission || defaultComm,
                    calculateCommission: undefined,
                    isTaxable: undefined,
                    taxRate: undefined,
                  };

              return {
                id: crypto.randomUUID(),
                appointmentTypeId:
                  apptToFinalise.appointmentTypeId || "procedure-fee",
                appointmentTypeName:
                  shareCount > 1
                    ? `${i.name} (Procedure Fee — ${cl?.name || "Clinician"}'s share)`
                    : `${i.name} (Procedure Fee)`,
                price: shareFee,
                quantity: 1,
                lineKind: "service" as const,
                commission: resolvedFields.commission,
                calculateCommission: resolvedFields.calculateCommission,
                isTaxable: resolvedFields.isTaxable,
                taxRate: resolvedFields.taxRate,
                doctorId: cl?.id || clinicianId,
                doctorName: cl?.name || clinicianName,
                discountValue: 0,
                discountType: "percent" as const,
                discountAmount: 0,
                amount: shareFee,
              };
            });
          });
          totalFee = billedItems.reduce(
            (sum: number, i: any) => sum + i.fee,
            0,
          );
        } else {
          let procType: (typeof appointmentTypes)[number] | undefined;

          if (rec.items && rec.items.length === 1) {
            procType = appointmentTypes.find(
              (t) => t.id === rec.items[0].id,
            );
          } else {
            // If multiple or unknown, try to match by name
            procType = appointmentTypes.find((t) => t.name === rec.name);
          }

          const resolvedProcFields = procType
            ? appointmentBillingService.resolveItemFieldsFromAppointmentType(
                procType,
                defaultComm,
              )
            : {
                commission: defaultComm,
                calculateCommission: undefined,
                isTaxable: undefined,
                taxRate: undefined,
              };

          procedureItemsToAdd = [
            {
              id: crypto.randomUUID(),
              appointmentTypeId:
                apptToFinalise.appointmentTypeId || "procedure-fee",
              appointmentTypeName: `${rec.name} (Procedure Fee)`,
              price: rec.fee,
              quantity: 1,
              lineKind: "service" as const,
              commission: resolvedProcFields.commission,
              calculateCommission: resolvedProcFields.calculateCommission,
              isTaxable: resolvedProcFields.isTaxable,
              taxRate: resolvedProcFields.taxRate,
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

        // Nothing is filed as a real invoice mid-visit any more — the
        // procedure items (and the recommending doctor's referral
        // commission) append to the appointment's pending visit state,
        // same as a late charge against an already-checked-out invoice,
        // which stays on the separate credit-note-and-reissue path and is
        // untouched here.
        const existingPendingItems: any[] =
          (apptToFinalise as any).pendingVisitItems || [];
        const existingPendingReferrals: any[] =
          (apptToFinalise as any).pendingVisitReferrals || [];
        const updatedPendingItems = [
          ...existingPendingItems,
          ...procedureItemsToAdd,
        ];

        // Referral math unchanged: discount-adjusted, pre-tax base, using
        // this finalization's own discount/tax selection against the full
        // accumulated item set so far (checkout will still be the final
        // word once every charge for the visit is known). Gated on the
        // clinic's master tax switch same as handleSettleBilling — without
        // this, turning the clinic-wide toggle off wouldn't stop tax being
        // applied here, since finaliseApplyTax defaults to true whenever
        // any item is catalogue-taxable regardless of that master switch.
        const totals = appointmentBillingService.calculateInvoiceTotals(
          updatedPendingItems,
          finaliseDiscountType,
          finaliseDiscountValue,
          finaliseApplyTax && billingSettings?.enableTax
            ? billingSettings?.defaultTaxPercentage || 0
            : 0,
        );

        let updatedPendingReferrals = existingPendingReferrals;

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
                totals.subtotal - totals.itemDiscountAmount,
                1,
              );
              const referralDiscountRatio =
                (validTotalForReferral - totals.mainDiscountAmount) /
                validTotalForReferral;
              const effectiveTotalFee = totalFee * referralDiscountRatio;

              const existingRef = updatedPendingReferrals.find(
                (r) => r.id === recommendingDoctor.id && r.type === "doctor",
              );

              if (!existingRef) {
                updatedPendingReferrals = [
                  ...updatedPendingReferrals,
                  {
                    type: "doctor",
                    id: recommendingDoctor.id,
                    name: recommendingDoctor.name,
                    commissionPercentage: defaultComm,
                    commissionAmount: (effectiveTotalFee * defaultComm) / 100,
                  },
                ];
              } else {
                updatedPendingReferrals = updatedPendingReferrals.map((r) =>
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

        await appointmentService.updateAppointment(apptToFinalise.id, {
          pendingVisitItems: updatedPendingItems,
          pendingVisitReferrals: updatedPendingReferrals,
          // Carries forward to checkout, which has no discount UI of its
          // own — without this, a discount entered here was silently
          // dropped. Only overwrite when this modal's own value is
          // nonzero, so leaving it at 0 doesn't erase a discount already
          // set at check-in.
          ...(finaliseDiscountValue
            ? {
              pendingVisitDiscountType: finaliseDiscountType,
              pendingVisitDiscountValue: finaliseDiscountValue,
            }
            : {}),
          updatedAt: new Date(),
        } as any);
      }

      let firstAssignedExpert = "";

      if (rec && rec.items && Array.isArray(rec.items)) {
        for (const i of rec.items) {
          if (
            finaliseSelectedItems.includes(i.id) &&
            itemExperts[i.id]?.length
          ) {
            firstAssignedExpert = itemExperts[i.id][0];
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
        title: accept ? "Procedure Billed" : "Procedure Declined",
        description: accept
          ? "The procedure has been added to this visit's pending charges."
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

      // Checkout — the one point in the visit where a real, IRD-filed
      // invoice is created. pendingVisitItems/pendingVisitReferrals carry
      // everything accumulated since check-in (consultation fee, any
      // mid-visit procedures); nothing before this was ever filed, so
      // IRD's immutable-once-filed rule is never in tension with the
      // front-desk workflow. See "One Invoice Per Visit: Deposit at
      // Check-in, Bill at Checkout".
      try {
        if (!clinicId) return;

        const existingPendingItems: any[] =
          (appt as any).pendingVisitItems || [];
        const existingPendingReferrals: any[] =
          (appt as any).pendingVisitReferrals || [];
        const depositedAmount = (appt as any).depositedAmount || 0;
        // Whatever discount staff entered during the visit (check-in or
        // Finalise Procedure) — checkout has no discount UI of its own, so
        // this is the only place that decision can still take effect.
        const {
          discountType: settleDiscountType,
          discountValue: settleDiscountValue,
        } = resolveVisitDiscount(appt as any);

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

        // An appointment that already carries a filed invoice must never
        // reach the fabrication fallback below: with pendingVisitItems now
        // empty (cleared at checkout), it would invent a fresh
        // catalogue-price line item and file a SECOND IRD invoice for a
        // visit that was already billed. Two ways in: clicking "Settle
        // Billing Invoice" twice, and the sibling appointments created for
        // extra clinicians in Quick Intake, whose charges all live on the
        // primary appointment and which therefore legitimately have no
        // pending items of their own.
        if (existingPendingItems.length === 0 && appt.billingId) {
          addToast({
            title: "Already Billed",
            description:
              "This visit already has an invoice. Open it from Appointment Billing to collect any remaining balance.",
            color: "warning",
          });
          navigate(
            `/dashboard/appointments-billing/${appt.billingId}?from=front-office&tab=${activeTab}`,
          );

          return;
        }

        const billedElsewhereOn = (appt as any).billedOnAppointmentId;

        if (existingPendingItems.length === 0 && billedElsewhereOn) {
          const primary = appointments.find((a) => a.id === billedElsewhereOn);

          addToast({
            title: "Billed on the Main Visit",
            description:
              "This clinician's fee is already included on this patient's main visit invoice — settle it there instead.",
            color: "warning",
          });

          if (primary?.billingId) {
            navigate(
              `/dashboard/appointments-billing/${primary.billingId}?from=front-office&tab=${activeTab}`,
            );
          }

          return;
        }

        // Nothing accumulated yet (e.g. a visit with no consultation fee
        // and no mid-visit procedure) — fall back to today's single-item
        // construction so checkout still produces a real invoice.
        let billingItems = existingPendingItems;

        if (billingItems.length === 0) {
          const apptType = appointmentTypes.find(
            (t) => t.id === appt.appointmentTypeId,
          );

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

          const resolvedFields = apptType
            ? appointmentBillingService.resolveItemFieldsFromAppointmentType(
                apptType,
                docInfo?.defaultCommission,
              )
            : {
                commission: docInfo?.defaultCommission || 0,
                calculateCommission: undefined,
                isTaxable: undefined,
                taxRate: undefined,
              };

          billingItems = [
            {
              id: crypto.randomUUID(),
              appointmentTypeId: appt.appointmentTypeId || "manual-gp-fee",
              appointmentTypeName: appointmentTypeName,
              price: price,
              quantity: 1,
              lineKind: "service" as const,
              commission: resolvedFields.commission,
              calculateCommission: resolvedFields.calculateCommission,
              isTaxable: resolvedFields.isTaxable,
              taxRate: resolvedFields.taxRate,
              doctorId: clinicianId,
              doctorName: docInfo
                ? docInfo.name.startsWith("Dr.") || isExpert
                  ? docInfo.name
                  : `Dr. ${docInfo.name}`
                : isExpert
                  ? "Expert Cabin"
                  : "Unknown Doctor",
              amount: price,
            },
          ];
        }

        const settleTaxPercentage = billingSettings?.enableTax
          ? billingSettings.defaultTaxPercentage || 0
          : 0;
        const settleTotals = appointmentBillingService.calculateInvoiceTotals(
          billingItems,
          settleDiscountType,
          settleDiscountValue,
          settleTaxPercentage,
        );

        // Resolve a fresh consultation-fee referral and merge it with
        // whatever referral commissions already accumulated mid-visit
        // (handleFinaliseProcedure) — discount-adjusted, pre-tax base, same
        // as every other referral computation in this file.
        const settleReferralBase =
          settleTotals.taxableAmount + settleTotals.exemptAmount;
        const { processedReferrals, refPartnerId, refCommissionAmt } =
          await resolvePatientReferrals(pat, settleReferralBase);
        // Summing on id+type collision paid one person twice for the same
        // procedure: the mid-visit entry is computed on the procedure fee,
        // the checkout entry on the whole invoice that already contains it.
        // See mergeVisitReferrals for the policy and its tests.
        const mergedReferrals = mergeVisitReferrals(
          existingPendingReferrals as any,
          processedReferrals as any,
        );

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
          referrals: mergedReferrals,
          // One visit files at most one invoice, so the appointment id is
          // this filing's true identity. Without it the backend's
          // idempotency key is content + a 10-minute time bucket, which
          // both (a) lets two genuinely distinct same-priced visits for one
          // patient collapse into a single invoice, and (b) fails to make a
          // retry safe — a checkout whose Firestore follow-up failed, or a
          // second staff member clicking Settle at the same moment, would
          // file a duplicate IRD invoice. Keyed this way, a repeat attempt
          // returns the already-filed invoice instead.
          idempotencyDiscriminator: `visit:${appt.id}`,
          invoiceDate: new Date(),
          items: billingItems,
          subtotal: settleTotals.subtotal,
          itemDiscountAmount: settleTotals.itemDiscountAmount,
          mainDiscountAmount: settleTotals.mainDiscountAmount,
          discountType: settleDiscountType,
          discountValue: settleDiscountValue,
          discountAmount: settleTotals.totalDiscount,
          taxPercentage: settleTaxPercentage,
          taxAmount: settleTotals.taxAmount,
          taxableAmount: settleTotals.taxableAmount,
          exemptAmount: settleTotals.exemptAmount,
          totalAmount: settleTotals.totalAmount,
          status: "draft" as const,
          paymentStatus: "unpaid" as const,
          paidAmount: 0,
          balanceAmount: settleTotals.totalAmount,
          createdBy: currentUser?.uid || "system",
        };

        const { id: newBillingId } =
          await appointmentBillingService.createBilling(billingData);

        // Link the invoice to the appointment BEFORE recording any payment
        // against it. appointmentBillingService.recordPayment looks up the
        // appointment to update by matching its billingId/consultationBillingId
        // against the invoice id; if nothing points to the new invoice yet,
        // it falls back to a broad "any completed appointment for this
        // patient" query and stamps billingStatus/paymentStatus onto EVERY
        // one of them — silently corrupting unrelated past visits' payment
        // status. Setting billingId first makes that lookup resolve to
        // exactly this appointment.
        await appointmentService.updateAppointment(appt.id, {
          billingId: newBillingId,
          pendingVisitItems: [],
          pendingVisitReferrals: [],
          pendingVisitDiscountType: null,
          pendingVisitDiscountValue: 0,
          depositedAmount: 0,
          // Deliberately NOT setting checkoutCompleted here. Filing the
          // invoice and closing the visit are two different facts, and
          // conflating them let this path mark a visit done without the
          // triage-vitals and outstanding-balance checks that
          // canCompleteCheckout enforces — so a patient could drop off the
          // board still owing money. The visit now leaves "billing" because
          // deriveVisitStage can see a live, settled invoice, and only the
          // checkout path records an explicit closure.
          updatedAt: new Date(),
        } as any);

        // Apply the deposit collected over the course of the visit (capped
        // at the invoice total — any excess stays as wallet credit, same as
        // any other unused wallet balance in this app). Any shortfall is
        // collected normally on the invoice page, same as any other
        // partially-paid invoice. This also sets the appointment's own
        // billingStatus/paymentStatus to match (recordPayment's own
        // appointment-linking logic, now correctly scoped — see above).
        const depositToApply = Math.min(
          depositedAmount,
          settleTotals.totalAmount,
        );

        if (depositToApply > 0) {
          try {
            await appointmentBillingService.recordPayment(
              newBillingId,
              depositToApply,
              "wallet",
              undefined,
              "Visit deposit applied at checkout",
            );
          } catch (payErr) {
            console.error(
              "Error applying visit deposit at checkout:",
              payErr,
            );
            addToast({
              title: "Deposit Not Applied",
              description:
                "The invoice was created, but the collected deposit could not be applied — apply it manually from the invoice page.",
              color: "warning",
            });
          }
        } else if (settleTotals.totalAmount <= 0) {
          // A zero-total visit — a package session, whose line is
          // commission-only (price 0, already paid for at package
          // purchase). Nothing is owed, but commission and the patient
          // follow-up are both generated by recordPayment's
          // unpaid -> paid transition, which a zero-total invoice would
          // otherwise never reach: the performing clinician silently
          // earned nothing and no recall was created. Record an explicit
          // zero payment to drive that transition, exactly as the
          // pre-redesign code did.
          try {
            await appointmentBillingService.recordPayment(
              newBillingId,
              0,
              "package",
              undefined,
              "Package session — covered by pre-paid package, no additional charge.",
            );
          } catch (payErr) {
            console.error(
              "Error closing out zero-total visit invoice:",
              payErr,
            );
            addToast({
              title: "Commission Not Generated",
              description:
                "The visit was invoiced, but its commission could not be recorded — check Commissions for this clinician.",
              color: "warning",
            });
          }
        } else {
          // Nothing collected yet on a chargeable invoice — recordPayment
          // (which would otherwise set these) never runs, so set them
          // directly.
          await appointmentService.updateAppointment(appt.id, {
            billingStatus: "unpaid",
            paymentStatus: "unpaid",
            updatedAt: new Date(),
          } as any);
        }

        addToast({
          title: "Invoice Generated",
          description: "Generated the invoice for this visit.",
          color: "success",
        });

        navigate(
          `/dashboard/appointments-billing/${newBillingId}?from=front-office&tab=${activeTab}`,
        );
      } catch (err: any) {
        // Previously a failure here could be logged and then still
        // navigate to a success-shaped path — say what went wrong and stay
        // put so the action can be retried from here.
        console.error("Error settling billing:", err);
        addToast({
          title: "Could not settle this billing",
          description:
            err?.message || "Nothing was charged. Please try again.",
          color: "danger",
        });
      }
    });

  const getGuidedAction = (appt: Appointment) => {
    const stage = getPatientStage(appt);
    const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
    const hasExpert =
      appt.assignedExpertId && appt.assignedExpertId !== "unassigned";
    const hasAnyClinician = hasDoctor || hasExpert;
    const consBill = getPendingBillForAppointment(appt);
    const isConsBillPending = Boolean(consBill);
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
        label: isOnlyCons ? "Collect Deposit" : "Collect Deposit (Billing)",
        icon: <IoCardOutline className="w-4 h-4" />,
        colorClass: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
        onClick: () => handleCollectDeposit(appt),
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
      case "triage-done": {
        // An unrouted patient can be a candidate for both queues, so the
        // offered action follows the queue being looked at. Previously this
        // read "Send to Doctor Cabin" whenever a doctor was assigned — even
        // while standing in the Expert Queue — so a patient booked with both
        // could never be sent to the expert from the board at all.
        const queues = visitQueueCandidates(appt);
        const toExpert =
          queues.expert && (activeTab === "expert" || !queues.doctor);

        return {
          label: toExpert ? "Send to Expert Cabin" : "Send to Doctor Cabin",
          icon: <IoPlayOutline className="w-4 h-4" />,
          colorClass:
            "bg-indigo-500 text-white hover:bg-indigo-600 animate-pulse",
          onClick: () =>
            toExpert
              ? handleSendToExpert(appt.id)
              : handleSendToDoctor(appt.id),
        };
      }
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
      const consBill = getPendingBillForAppointment(appt);
      const isConsBillPending = Boolean(consBill);

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
                  const consBill = getPendingBillForAppointment(a);
                  const isConsBillPending = Boolean(consBill);

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

                  const consBill = getPendingBillForAppointment(a);

                  if ((s === "lobby" || s === "scheduled") && consBill)
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
                  const consBill = getPendingBillForAppointment(a);
                  const isConsBillPending = Boolean(consBill);

                  return isConsBillPending;
                }).length,
              },
              {
                id: "triage",
                name: "🩺 TRIAGE WAITING",
                count: appointments.filter(getQueueFilter).filter((a) => {
                  const s = getPatientStage(a);

                  if (s !== "lobby") return false;
                  const consBill = getPendingBillForAppointment(a);
                  const isConsBillPending = Boolean(consBill);

                  return !isConsBillPending;
                }).length,
              },
              {
                id: "doctor",
                // "Queue", not "Cabins". This tab deliberately holds both
                // the patients physically in a cabin AND the ones who have
                // finished triage and are waiting to be sent in — there is
                // no triage-done tab, so naming it for the cabin made it
                // contradict the "In Doctor Cabin" stat card sitting beside
                // it, which counts only those actually in one. Same for
                // Expert below.
                name: "👨‍⚕️ DOCTOR QUEUE",
                count: appointments
                  .filter(
                    (a) => !currentDoctorId || a.doctorId === currentDoctorId,
                  )
                  .filter((a) => {
                    const s = getPatientStage(a);

                    return (
                      s === "doctor" ||
                      (s === "triage-done" && visitQueueCandidates(a).doctor)
                    );
                  }).length,
              },
              {
                id: "expert",
                name: "👥 EXPERT QUEUE",
                count: appointments
                  .filter(
                    (a) =>
                      !currentExpertId ||
                      a.assignedExpertId === currentExpertId,
                  )
                  .filter((a) => {
                    const s = getPatientStage(a);

                    return (
                      s === "expert" ||
                      (s === "triage-done" && visitQueueCandidates(a).expert)
                    );
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
            <div className="bg-surface rounded border border-border-base shadow-xl max-w-md sm:max-w-xl w-full mx-4 relative z-10 p-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
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
                          className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 bg-surface border border-border-base rounded p-2"
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
                          <div className="flex flex-col items-start sm:items-end gap-1 w-full sm:w-56 shrink-0">
                            <span className="text-[12.5px] text-text-muted font-semibold">
                              NPR {item.fee.toLocaleString()}
                            </span>
                            <div className="w-full max-h-28 overflow-y-auto border border-border-base rounded bg-surface-2 p-1">
                              <p className="text-[9.5px] text-text-muted px-1 pb-1">
                                Assign clinician(s) — blank = Auto
                              </p>
                              {[
                                ...experts.map((e) => ({
                                  ...e,
                                  group: "Expert",
                                })),
                                ...doctors.map((d) => ({
                                  ...d,
                                  group: "Doctor",
                                })),
                              ].map((cl) => {
                                const selected = (
                                  itemExperts[item.id] || []
                                ).includes(cl.id);

                                return (
                                  <label
                                    key={`${cl.group}-${cl.id}`}
                                    className="flex items-center gap-1.5 px-1 py-0.5 text-[10.5px] hover:bg-surface rounded cursor-pointer"
                                  >
                                    <input
                                      checked={selected}
                                      className="h-3 w-3"
                                      type="checkbox"
                                      onChange={(e) =>
                                        setItemExperts((prev) => {
                                          const current = prev[item.id] || [];
                                          const next = e.target.checked
                                            ? [...current, cl.id]
                                            : current.filter(
                                              (id) => id !== cl.id,
                                            );

                                          return {
                                            ...prev,
                                            [item.id]: next,
                                          };
                                        })
                                      }
                                    />
                                    <span className="truncate">
                                      {cl.name}{" "}
                                      <span className="text-text-muted/60">
                                        ({cl.group})
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {(itemExperts[item.id]?.length || 0) > 1 && (
                              <p className="text-[9.5px] text-primary text-left sm:text-right">
                                Split {itemExperts[item.id].length}-way: NPR{" "}
                                {(
                                  item.fee / itemExperts[item.id].length
                                ).toFixed(0)}{" "}
                                each
                              </p>
                            )}
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
                const taxAmt =
                  finaliseApplyTax && billingSettings?.enableTax
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

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
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
