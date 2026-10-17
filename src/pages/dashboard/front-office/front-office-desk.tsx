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
import { RoutingModal, type RoutingFeeLine } from "./RoutingModal";
import { CheckInSheet } from "./CheckInSheet";
import { ProcedureModal } from "./ProcedureModal";
import {
  QuickIntakeModal,
  getClinicianTypeDefaults,
} from "./QuickIntakeModal";
import { QueueList } from "./QueueList";
import { StageListModal } from "./StageListModal";

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
import { splitDepositApplication } from "@/services/core/visitSettleCore";
import {
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
import { withDoctorPrefix } from "@/utils/clinicianName";
import { parseLocalDate } from "@/utils/localDate";
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
import {
  appendBookedLines,
  checkInVisit,
  collectCheckInDue,
  ensureVisitLine,
  findClinician,
  type BookedRow,
  type VisitLineContext,
} from "@/services/visitLineService";
import {
  planCheckIn,
  planCollectDue,
  standingWalletCredit,
  visitWaitStart,
  type CheckInPlan,
} from "@/services/core/checkInCore";
import { isLineCollectableAtCheckIn } from "@/services/core/legacyVisitAdapters";
import {
  initialPaymentCapture,
  paymentMethodLabel,
  type PaymentCaptureValue,
} from "@/components/billing/PaymentCapture";
import { clinicService } from "@/services/clinicService";
import { generateAdvanceReceiptHTML } from "@/utils/advanceReceiptPrinting";
import { printHtmlViaIframe } from "@/utils/printHtmlViaIframe";
import {
  previewLineCharge,
  refusalMessage,
  resolveTypePrice,
  splitAmount,
  typePerformerKind,
  type ChargeClinician,
} from "@/services/core/visitChargeCore";
import {
  findBookedLine,
  legacyRecommendationToItems,
} from "@/services/core/legacyVisitAdapters";

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
 * (appendCheckInLines, handleSettleBilling) — was previously
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

  // A doctor/expert login that matches no clinician profile has no patients of
  // its own — it gets an empty board, never the whole clinic's.
  const isUnlinkedClinician =
    !hasFullFrontOfficeAccess &&
    !currentDoctorId &&
    !currentExpertId &&
    (userData?.role === "doctor" || userData?.role === "expert");

  // Which stat card's patient list is open
  const [openStatCard, setOpenStatCard] = useState<string | null>(null);

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
        // Both branches claim triage/routing state is cleared (the toast
        // below says so explicitly) — but the stage a "confirmed" status
        // resolves to is driven entirely by triageCompletedAt, so leaving
        // it set sent a "sent back to Lobby" patient straight back to
        // "Triage Finished" instead, and the same stale flag later put a
        // fully re-checked-in patient at "Triage Finished" with nobody
        // having recorded a single vital for the new visit.
        triageCompletedAt: null,
        triageRecordedBy: null,
        notes: isUndoingCheckIn
          ? `[Check-In Undone] ${reason}`
          : `[Sent Back to Lobby] ${reason}`,
        updatedAt: new Date(),
      } as any);
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
        const liveVisit = await appointmentService.getAppointmentById(appt.id);
        const strandedDeposit =
          liveVisit?.depositedAmount ?? ((appt as any).depositedAmount || 0);
        // The cash share of the deposit is already sitting in the wallet.
        // The credit share was taken OUT of the wallet at check-in, so it
        // has to be put back — otherwise it simply vanished.
        const creditTaken = Math.min(
          strandedDeposit,
          liveVisit?.depositFromCredit ?? 0,
        );

        if (creditTaken > 0 && clinicId) {
          await walletService.refundFunds(
            appt.patientId,
            clinicId,
            creditTaken,
            appt.id,
            "Visit credit returned — marked no-show",
            currentUser?.uid || "system",
          );
        }

        await appointmentService.updateAppointmentStatus(appt.id, "no-show");
        await appointmentService.updateAppointment(appt.id, {
          notes: priorNotes ? `${priorNotes}\n${marker}` : marker,
          pendingVisitItems: [],
          pendingVisitReferrals: [],
          pendingVisitDiscountType: null,
          pendingVisitDiscountValue: 0,
          depositedAmount: 0,
          depositFromCredit: 0,
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
  const [routingDoctorId, setRoutingDoctorId] = useState("");
  const [routingExpertId, setRoutingExpertId] = useState("");

  // The check-in sheet: open only when money changes hands.
  const [checkInSheet, setCheckInSheet] = useState<{
    appt: Appointment;
    mode: "check-in" | "collect";
    plan: CheckInPlan;
    serviceName?: string;
    performerName?: string;
  } | null>(null);
  const [checkInSaving, setCheckInSaving] = useState(false);

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
  useEffect(() => {
    if (apptToFinalise) {
      const rec = (apptToFinalise as any).recommendedProcedure;

      if (rec?.items && Array.isArray(rec.items)) {
        // Only items the catalogue can price are pre-selected; a free-text
        // "additional fee" has no catalogue id and cannot be billed.
        setFinaliseSelectedItems(
          rec.items
            .filter(
              (i: any) =>
                appointmentTypes.some((t) => t.id === i.id) &&
                !findBookedLine(
                  (apptToFinalise as any).pendingVisitItems,
                  i.id,
                  apptToFinalise.appointmentTypeId,
                ),
            )
            .map((i: any) => i.id),
        );
        const initialExperts: Record<string, string[]> = {};

        rec.items.forEach((i: any) => {
          initialExperts[i.id] = [];
        });
        setItemExperts(initialExperts);
      }
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
    startSessionInstantly: false,
    sendDirectlyToCabin: false,
    clinicians: [
      {
        id: crypto.randomUUID(),
        clinicianType: "doctor" as "doctor" | "expert",
        clinicianId: "",
        appointmentTypeId: "",
      },
    ],
  });

  const handleOpenQuickIntake = () => {
    // The first row's service comes from Settings › Front Office, same as
    // every row added after it (see getClinicianTypeDefaults).
    const doctorDefaults = getClinicianTypeDefaults(
      "doctor",
      billingSettings?.frontOffice,
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
      startSessionInstantly: false,
      sendDirectlyToCabin: false,
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

  // Pre-select the clinic's default consultation for Quick Intake once the
  // settings arrive — guarded so it only runs while the field is still
  // blank, never overwriting a staff member's own in-progress selection.
  const defaultConsultationTypeId =
    billingSettings?.frontOffice?.defaultConsultationTypeId;
  const defaultExpertTypeId = billingSettings?.frontOffice?.defaultExpertTypeId;

  useEffect(() => {
    if (!defaultConsultationTypeId && !defaultExpertTypeId) return;

    setQuickIntakeForm((prev) => {
      // Rows opened before the settings arrived are filled in now; a row
      // whose service staff already chose is left alone.
      const clinicians = (prev.clinicians || []).map((c) =>
        c.appointmentTypeId
          ? c
          : {
              ...c,
              appointmentTypeId:
                (c.clinicianType === "expert"
                  ? defaultExpertTypeId
                  : defaultConsultationTypeId) || "",
            },
      );
      const appointmentTypeId =
        prev.appointmentTypeId || defaultConsultationTypeId || "";
      const unchanged =
        appointmentTypeId === prev.appointmentTypeId &&
        clinicians.every((c, i) => c === prev.clinicians[i]);

      return unchanged ? prev : { ...prev, appointmentTypeId, clinicians };
    });
  }, [defaultConsultationTypeId, defaultExpertTypeId]);

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

  /** The context every line-writing call shares. */
  const lineContext = (): VisitLineContext => ({
    clinicId: clinicId!,
    userId: currentUser?.uid || "system",
    pricing: {
      taxPercentage: billingSettings?.defaultTaxPercentage,
      isTaxEnabled: Boolean(billingSettings?.enableTax),
    },
  });

  /**
   * Wallet money not earmarked for any of this patient's open visits — it
   * reduces what the desk collects, with no ledger row written.
   */
  const standingCreditFor = (patientId: string): number => {
    const patient = patients.find((p) => p.id === patientId);
    const open = appointments.filter(
      (a) =>
        a.patientId === patientId &&
        !a.checkoutCompleted &&
        !["completed", "cancelled", "no-show"].includes(
          String(a.status || "").toLowerCase(),
        ),
    );

    return standingWalletCredit(patient?.walletBalance, open);
  };

  const catalogueLists = () => ({ doctors, experts, appointmentTypes, packages });

  /**
   * Put each row's booked service on the visit, then collect what the
   * check-in scope says is due with the default method. Routing and Quick
   * Intake use this; a scheduled check-in goes through the sheet instead.
   */
  const appendCheckInLines = async (
    appointmentId: string,
    patientId: string,
    rows: BookedRow[],
  ): Promise<{ refusals: string[]; collected: number }> => {
    if (!clinicId) return { refusals: [], collected: 0 };
    const owner = appointments.find((a) => a.id === appointmentId);
    const ctx = lineContext();
    const refusals = await appendBookedLines({
      appointment: {
        id: appointmentId,
        billedOnAppointmentId: (owner as any)?.billedOnAppointmentId,
      },
      rows,
      lists: catalogueLists(),
      ctx,
    });

    let collected = 0;

    try {
      collected = (
        await collectCheckInDue(
          { id: appointmentId, patientId },
          ctx,
          initialPaymentCapture(billingSettings),
          { standingCredit: standingCreditFor(patientId) },
        )
      ).collected;
    } catch (err) {
      console.error("Error collecting the check-in deposit:", err);
      addToast({
        title: "Deposit Not Collected",
        description:
          "The fee is on the visit but the wallet deposit failed — retry it from the queue before sending the patient in.",
        color: "warning",
      });
    }
    if (refusals.length > 0) {
      addToast({
        title: "Checked in, but not every fee could be charged",
        description: refusals.join(" "),
        color: "danger",
        duration: 15000,
      });
    }

    return { refusals, collected };
  };

  /** The Advance Receipt for a visit's deposits — not a tax invoice. */
  const printAdvanceReceipt = async (appt: Appointment) => {
    try {
      const [deposits, clinic, layoutConfig] = await Promise.all([
        walletService.getDepositsForAppointment(appt.id),
        clinicService.getClinicById(clinicId || appt.clinicId),
        clinicService.getPrintLayoutConfig(clinicId || appt.clinicId),
      ]);

      if (deposits.length === 0) {
        addToast({
          title: "No Deposit on Record",
          description: "Nothing has been collected for this visit yet.",
          color: "warning",
        });

        return;
      }
      const patient = patients.find((p) => p.id === appt.patientId);
      const lines: any[] = (appt as any).pendingVisitItems || [];
      const html = generateAdvanceReceiptHTML(
        {
          receiptNo: deposits[0].id.slice(0, 8).toUpperCase(),
          date: deposits[deposits.length - 1].createdAt,
          patient: {
            name: patient?.name || getPatientName(appt.patientId),
            regNumber: patient?.regNumber,
            mobile: patient?.mobile,
          },
          visit: {
            serviceNames: lines
              .filter((l) => isLineCollectableAtCheckIn(l, appt.appointmentTypeId))
              .map((l) => l.appointmentTypeName)
              .filter(Boolean),
            performerName: getDoctorName(appt),
          },
          deposits: deposits.map((d) => ({
            amount: d.amount,
            // A credit claim (type "deduction") has no paymentMethod — it
            // left the wallet, not the till — and must never print as
            // "Cash": the clinic did not receive cash for that share.
            method:
              (d as any).type === "deduction"
                ? "Wallet Credit"
                : paymentMethodLabel(billingSettings, d.paymentMethod || "cash"),
            reference: d.paymentReference,
            at: d.createdAt,
          })),
          receivedBy: userData?.displayName || undefined,
        },
        clinic,
        layoutConfig,
      );
      printHtmlViaIframe(html);
    } catch (err) {
      console.error("Error printing the advance receipt:", err);
      addToast({
        title: "Receipt Not Printed",
        description: "Could not prepare the advance receipt. Please try again.",
        color: "danger",
      });
    }
  };

  /** What checking this visit in means for money, from the booked service. */
  const checkInPlanFor = (appt: Appointment) => {
    const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
    const performerId = hasDoctor
      ? appt.doctorId
      : appt.assignedExpertId && appt.assignedExpertId !== "unassigned"
        ? appt.assignedExpertId
        : "";
    const person = hasDoctor
      ? doctors.find((d) => d.id === performerId)
      : experts.find((e) => e.id === performerId);
    const clinician = person
      ? {
          id: person.id,
          name: person.name,
          kind: (hasDoctor ? "doctor" : "expert") as "doctor" | "expert",
          consultationCharge: (person as Doctor).consultationCharge,
          defaultCommission: person.defaultCommission,
        }
      : null;
    const type = appointmentTypes.find((t) => t.id === appt.appointmentTypeId);
    const invoice = appt.billingId
      ? billings.find((b) => b.id === appt.billingId)
      : null;
    const plan = planCheckIn(
      appt as any,
      type,
      clinician,
      lineContext().pricing,
      {
        standingCredit: standingCreditFor(appt.patientId),
        invoiceNumber: invoice?.invoiceNumber,
      },
    );

    return {
      plan,
      serviceName: type?.name || getApptTypeLabel(appt.appointmentTypeId),
      performerName: person?.name,
      rows: performerId
        ? [
            {
              clinicianId: performerId,
              clinicianType: (hasDoctor ? "doctor" : "expert") as
                | "doctor"
                | "expert",
              appointmentTypeId: appt.appointmentTypeId,
              patientPackageId: appt.patientPackageId,
            },
          ]
        : [],
    };
  };

  /** Check In: the sheet when a fee is collectable now, else one click. */
  const openCheckIn = (appt: Appointment) => {
    const { plan, serviceName, performerName } = checkInPlanFor(appt);

    if (plan.kind === "collect" && plan.collectNow > 0) {
      setCheckInSheet({ appt, mode: "check-in", plan, serviceName, performerName });

      return;
    }
    void performCheckIn(appt, null);
  };

  const performCheckIn = (appt: Appointment, capture: PaymentCaptureValue | null) =>
    runGuarded(`check-in-${appt.id}`, async () => {
      if (
        capture &&
        checkInSheet &&
        !confirmMatchesLiveAmount(appt, "check-in", checkInSheet.plan.kind === "collect" ? checkInSheet.plan.collectNow : 0)
      ) {
        return;
      }
      setCheckInSaving(true);
      try {
        const { rows } = checkInPlanFor(appt);
        const outcome = await checkInVisit({
          appointment: {
            id: appt.id,
            patientId: appt.patientId,
            billedOnAppointmentId: (appt as any).billedOnAppointmentId,
            billingId: appt.billingId,
            consultationBillingId: (appt as any).consultationBillingId,
          },
          rows,
          lists: catalogueLists(),
          ctx: lineContext(),
          capture: capture ? { method: capture.method, reference: capture.reference } : null,
          standingCredit: standingCreditFor(appt.patientId),
        });

        setCheckInSheet(null);
        if (outcome.transitioned) {
          sendCheckInSMS(
            appt.patientId,
            appt.clinicId || clinicId || "standalone",
            appt.id,
            appt.branchId || branchId || undefined,
          ).catch((err) => console.error("Auto check-in SMS failed:", err));
        }
        if (outcome.depositFailed) {
          addToast({
            title: "Checked In — Fee Not Collected",
            description:
              "The payment could not be recorded. The patient is in the lobby; use Retry fee on their row before sending them in.",
            color: "danger",
            duration: 12000,
          });
        } else if (outcome.collected > 0) {
          addToast({
            title: "Checked In",
            description: `NPR ${outcome.collected.toFixed(2)} collected. Patient is in the lobby.`,
            color: "success",
            duration: 8000,
            action: {
              label: "Print advance receipt",
              onClick: () => void printAdvanceReceipt(appt),
            },
          });
        } else {
          addToast({
            title: outcome.transitioned ? "Checked In" : "Already Checked In",
            description: outcome.transitioned
              ? "Patient is in the lobby."
              : "Another desk checked this patient in a moment ago.",
            color: outcome.transitioned ? "success" : "warning",
          });
        }
        if (outcome.refusals.length > 0) {
          addToast({
            title: outcome.lineAppendFailed
              ? "Checked In — Service Not Added"
              : "Checked in, but the fee could not be charged",
            description: outcome.refusals.join(" "),
            color: "danger",
            duration: 15000,
          });
        }
      } catch (err) {
        console.error("Error checking in patient:", err);
        addToast({
          title: "Check-in Failed",
          description: "Could not update status. Please try again.",
          color: "danger",
        });
      } finally {
        setCheckInSaving(false);
      }
    });

  /** What is still due on a visit already in the lobby, right now. */
  const collectDuePlanFor = (appt: Appointment) => {
    const lines: any[] = (appt as any).pendingVisitItems || [];
    const gate = getVisitPaymentGate(
      appt as any,
      lineContext().pricing,
      "checkin",
    );
    const base = lines
      .filter((l) => isLineCollectableAtCheckIn(l, appt.appointmentTypeId))
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const plan = planCollectDue({
      owed: gate.owed,
      base,
      deposited: gate.deposited,
      standingCredit: standingCreditFor(appt.patientId),
    });

    return {
      plan,
      serviceName: lines
        .filter((l) => isLineCollectableAtCheckIn(l, appt.appointmentTypeId))
        .map((l) => l.appointmentTypeName)
        .join(", "),
    };
  };

  /** Collect (or retry) a fee still due on a visit already in the lobby. */
  const openCollectDue = (appt: Appointment) => {
    const { plan, serviceName } = collectDuePlanFor(appt);

    setCheckInSheet({
      appt,
      mode: "collect",
      plan,
      serviceName,
      performerName: getDoctorName(appt),
    });
  };

  /**
   * The sheet can sit open a while; if another action (a second desk, a
   * concurrent line change) moved the live amount away from what is
   * displayed, confirming now would let a clerk physically collect the
   * stale figure from the patient while the system claims a different one
   * — with no trace of the gap. Compare and refuse rather than let that
   * happen silently.
   */
  const confirmMatchesLiveAmount = (
    appt: Appointment,
    mode: "check-in" | "collect",
    displayedCollectNow: number,
  ): boolean => {
    const live =
      mode === "collect"
        ? collectDuePlanFor(appt).plan
        : checkInPlanFor(appt).plan;
    const liveNow = live.kind === "collect" ? live.collectNow : 0;

    if (Math.abs(liveNow - displayedCollectNow) < 0.01) return true;
    addToast({
      title: "Amount Changed",
      description: `The amount due changed since this was opened (now NPR ${liveNow.toFixed(2)}) — please confirm with the patient and try again.`,
      color: "warning",
      duration: 12000,
    });
    setCheckInSheet(null);

    return false;
  };

  const performCollectDue = (appt: Appointment, capture: PaymentCaptureValue | null) =>
    runGuarded(`collect-deposit-${appt.id}`, async () => {
      if (!capture) return;
      if (
        checkInSheet &&
        !confirmMatchesLiveAmount(appt, "collect", checkInSheet.plan.kind === "collect" ? checkInSheet.plan.collectNow : 0)
      ) {
        return;
      }
      setCheckInSaving(true);
      try {
        const { collected } = await collectCheckInDue(
          { id: appt.id, patientId: appt.patientId },
          { ...lineContext(), clinicId: clinicId || appt.clinicId },
          { method: capture.method, reference: capture.reference },
          { standingCredit: standingCreditFor(appt.patientId) },
        );

        setCheckInSheet(null);
        if (collected <= 0) {
          addToast({
            title: "Nothing Due",
            description:
              "This visit's check-in fee is already collected — nothing further is due.",
            color: "warning",
          });

          return;
        }
        addToast({
          title: "Fee Collected",
          description: `NPR ${collected.toFixed(2)} collected for this visit.`,
          color: "success",
          duration: 8000,
          action: {
            label: "Print advance receipt",
            onClick: () => void printAdvanceReceipt(appt),
          },
        });
      } catch (err) {
        console.error("Error collecting the fee:", err);
        addToast({
          title: "Fee Not Collected",
          description: "The payment could not be recorded. Please try again.",
          color: "danger",
        });
      } finally {
        setCheckInSaving(false);
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

    setRoutingAppointment(appt);
    setRoutingCabin(appt.cabinName || "");
    setRoutingExpertId(
      appt.assignedExpertId && appt.assignedExpertId !== "unassigned"
        ? appt.assignedExpertId
        : "",
    );
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

        const fee = describeRoutingFee();

        if (fee.status === "refused") {
          addToast({
            title: "Cannot Route Yet",
            description: fee.reason,
            color: "danger",
            duration: 10000,
          });

          return;
        }

        const updateData: any = {
          status: "in-progress",
          cabinName: routingCabin,
          updatedAt: new Date(),
        };
        let doctorConsultationSkipped = false;

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
            // This is a routing-board hack, not a clinical fact: it exists
            // so the board's stage can skip the doctor cabin, not because
            // the doctor's consultation actually happened. If the doctor's
            // fee was already collected at check-in, that line stays on
            // the visit — nothing here removes it, so it is still filed
            // and commissioned at Settle. Flagged below rather than
            // acted on automatically: whether a booked-but-unseen
            // consultation should still be billed is a clinic policy
            // call, not one this screen should make silently.
            doctorConsultationSkipped = true;
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

        // The booked service for the clinician being routed to, unless it
        // is already on the visit (see describeRoutingFee), and the check-in
        // fee collected before the patient goes in.
        if (
          fee.status === "charge" ||
          fee.status === "later" ||
          fee.status === "free"
        ) {
          await appendCheckInLines(
            routingAppointment.id,
            routingAppointment.patientId,
            [
              {
                clinicianId:
                  routingTarget === "doctor" ? routingDoctorId : routingExpertId,
                clinicianType: routingTarget === "doctor" ? "doctor" : "expert",
                appointmentTypeId: routingAppointment.appointmentTypeId,
                patientPackageId: routingAppointment.patientPackageId,
              },
            ],
          );
        } else if (fee.status === "already" && fee.existingLineId) {
          // The fee is already on the visit, but possibly attributed to a
          // DIFFERENT clinician — e.g. this visit was Sent Back/Undone
          // after Dr A's consultation fee was collected, and is now being
          // routed to Dr B instead. Re-point that line so the invoice and
          // commission land on whoever is actually seeing the patient,
          // rather than silently staying with Dr A.
          const newClinicianId =
            routingTarget === "doctor" ? routingDoctorId : routingExpertId;
          const newClinician =
            routingTarget === "doctor"
              ? doctors.find((d) => d.id === newClinicianId)
              : experts.find((e) => e.id === newClinicianId);

          if (newClinician) {
            await appointmentService
              .reattributeVisitLine(routingAppointment.id, fee.existingLineId, {
                id: newClinician.id,
                name: newClinician.name,
                kind: routingTarget === "doctor" ? "doctor" : "expert",
              })
              .catch((err) =>
                console.error(
                  "Failed to re-attribute the visit's existing booked line:",
                  err,
                ),
              );
          }
        }

        addToast({
          title:
            routingTarget === "expert"
              ? `Sent to Expert Cabin`
              : `Sent to Doctor Cabin`,
          description: `Patient routed to ${routingCabin || "unassigned Room/Cabin"}.`,
          color: "success",
        });
        if (doctorConsultationSkipped) {
          addToast({
            title: "Doctor's Consultation Fee Still On This Visit",
            description:
              "The doctor was skipped — their consultation fee, if already collected, remains on the invoice and will still be commissioned at Settle. Remove it from the visit first if the doctor should not be billed.",
            color: "warning",
            duration: 15000,
          });
        }
        setIsRoutingModalOpen(false);
        setRoutingAppointment(null);
        setRoutingTarget("default");
        setRoutingExpertId("");
        setRoutingDoctorId("");
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

  /**
   * The booked service for whoever is completing, in case check-in or
   * routing never put it on the visit (a legacy visit, or one checked in
   * before a clinician was assigned). The charge core prices it or
   * refuses; nothing is invented.
   */
  const ensureBookedLine = async (
    appt: Appointment,
    completingAsExpert: boolean,
  ): Promise<void> => {
    if (!clinicId) return;
    const typeId = appt.appointmentTypeId || "";
    const pending: any[] = (appt as any).pendingVisitItems || [];

    if (
      appt.patientPackageId ||
      !typeId ||
      typeId === "default" ||
      typeId === "package-session" ||
      (appt as any).billedOnAppointmentId ||
      (pending.length === 0 &&
        (appt.billingId || (appt as any).consultationBillingId))
    ) {
      return;
    }
    const type = appointmentTypes.find((t) => t.id === typeId);

    if (!type) return;
    const isExpert =
      completingAsExpert &&
      !!(appt.assignedExpertId && appt.assignedExpertId !== "unassigned");
    const clinician = await findClinician(
      isExpert ? appt.assignedExpertId : appt.doctorId,
      isExpert ? "expert" : "doctor",
      { doctors, experts },
    );

    if (!clinician) return;
    const existingBookedLine = findBookedLine(
      pending,
      type.id,
      appt.appointmentTypeId,
    );

    if (existingBookedLine) {
      // Same re-attribution as handleConfirmRoute: the fee is already on
      // the visit but may be attributed to whoever had it before Undo
      // Check-In / Send Back cleared the clinician off this visit. Correct
      // it to whoever is actually completing now, rather than leaving the
      // invoice and commission with someone who never saw the patient.
      if (
        existingBookedLine.doctorId !== clinician.id ||
        existingBookedLine.performerKind !== clinician.kind
      ) {
        await appointmentService
          .reattributeVisitLine(appt.id, existingBookedLine.id, {
            id: clinician.id,
            name: clinician.name,
            kind: clinician.kind,
          })
          .catch((err) =>
            console.error(
              "Failed to re-attribute the visit's existing booked line:",
              err,
            ),
          );
      }

      return;
    }
    // Not this clinician's service (an expert closing a doctor-only visit):
    // the doctor's own line is already on the visit or never will be.
    const allowed = typePerformerKind(type);

    if (allowed !== "either" && allowed !== clinician.kind) return;
    const result = await ensureVisitLine({
      appointment: { id: appt.id },
      type,
      clinician,
      origin: "booked",
      ctx: lineContext(),
    });

    if (result.ok === false) {
      addToast({
        title: "Booked service not charged",
        description: refusalMessage(result),
        color: "warning",
        duration: 10000,
      });
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
          await ensureBookedLine(
            appt,
            appt.doctorConsultationCompleted === true,
          );

          await appointmentService.updateAppointment(appointmentId, {
            status: "completed",
            doctorConsultationCompleted: true,
            billingStatus: appt.billingStatus || "unpaid",
            paymentStatus: appt.paymentStatus || "unpaid",
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
          pricing: {
            taxPercentage: billingSettings?.defaultTaxPercentage,
            isTaxEnabled: Boolean(billingSettings?.enableTax),
          },
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

    // The booked service is already on the visit (appended at check-in or
    // routing), so the fee starts at 0 — the expert has no procedure to add
    // unless they pick one.
    const isBookedTypeAlreadyBilled = Boolean(
      apptType &&
        ((appt as any).pendingVisitItems || []).some(
          (l: any) => l.appointmentTypeId === apptType.id,
        ),
    );

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

    // triageCompletedAt exists specifically because the old free-text
    // marker could be typed by hand with no vitals ever taken (see the
    // comment below on that field). Saving with every field blank stamped
    // the exact same structured flag unconditionally, which made it just
    // as fakeable as what it replaced — one click with nothing entered
    // passed the clinical-documentation gate the same as a real triage.
    const anyVitalRecorded = [
      vitals.bpSystolic,
      vitals.bpDiastolic,
      vitals.pulse,
      vitals.temp,
      vitals.weight,
      vitals.spo2,
      vitals.complaints,
    ].some((v) => v && v.trim().length > 0);

    if (!anyVitalRecorded) {
      addToast({
        title: "Nothing to Record",
        description:
          "Enter at least one vital sign or a chief complaint before saving triage.",
        color: "warning",
      });

      return;
    }

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
      let doctorConsultationSkipped = false;
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

      // Same invariant handleConfirmRoute enforces: one patient cannot be
      // actively with two clinicians at once. This path has no such check
      // of its own, so triaging a sibling appointment and routing it
      // straight from here could put the same patient "in" two cabins
      // simultaneously — one via Routing, one via Triage.
      const otherActiveAppt = appointments.find(
        (a) =>
          a.patientId === selectedAppointment.patientId &&
          a.id !== selectedAppointment.id &&
          (getPatientStage(a) === "doctor" || getPatientStage(a) === "expert"),
      );
      let routed = false;

      if (routeTarget && hasAssignedClinicianForTarget && otherActiveAppt) {
        addToast({
          title: "Patient Already With a Clinician",
          description: `Vitals were saved, but the patient was NOT routed — ${getPatientName(selectedAppointment.patientId)} is currently in ${otherActiveAppt.cabinName || "a cabin"} with ${getDoctorName(otherActiveAppt)}. Complete or send back that visit first.`,
          color: "warning",
          duration: 10000,
        });
      } else if (routeTarget && hasAssignedClinicianForTarget) {
        updateData.status = "in-progress";
        // Fallback to assigned cabin if it's already selected
        updateData.cabinName = selectedAppointment.cabinName || "";
        if (
          routeTarget === "expert" &&
          selectedAppointment.doctorId &&
          selectedAppointment.doctorId !== "unassigned"
        ) {
          // Routing-board hack, not a clinical fact — see the identical
          // comment and fix in handleConfirmRoute. Does not remove the
          // doctor's consultation fee if it was already collected at
          // check-in, so it is still invoiced and commissioned at Settle.
          doctorConsultationSkipped = true;
          updateData.doctorConsultationCompleted = true;
        }
        routed = true;
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

      // Trigger notification for Doctor that Triage is done and patient is
      // ready — only when the patient was ACTUALLY routed there. This used
      // to fire whenever a doctor happened to be assigned, including a
      // plain "Save Vitals Only" with no routing at all, telling the
      // doctor a patient was "waiting in your cabin" who was still sitting
      // in Lobby/Triage.
      if (clinicId && routed && routeTarget === "doctor") {
        const patObj = patients.find(
          (p) => p.id === selectedAppointment.patientId,
        );
        const patName = patObj ? patObj.name : "Patient";

        NotificationService.sendNotification(clinicId, {
          title: "Patient Vitals Recorded",
          message: `Vitals for patient ${patName} have been recorded. They are now waiting in your cabin.`,
          type: "doctor_queue",
          targetRole: "doctor",
          targetUserId: selectedAppointment.doctorId,
        });
      }

      addToast({
        title: "Triage Vitals Saved",
        description: routed
          ? `Vitals recorded and patient routed to ${routeTarget === "doctor" ? "Doctor" : "Expert"} cabin.`
          : "Vitals recorded successfully.",
        color: "success",
      });
      if (doctorConsultationSkipped) {
        addToast({
          title: "Doctor's Consultation Fee Still On This Visit",
          description:
            "The doctor was skipped — their consultation fee, if already collected, remains on the invoice and will still be commissioned at Settle. Remove it from the visit first if the doctor should not be billed.",
          color: "warning",
          duration: 15000,
        });
      }

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

      // procedureType is a comma-joined multi-select list (ProcedureModal
      // appends each new pick to the END), so a "Consume Session" choice
      // alongside a catalogue procedure — e.g. "CO2 Laser Resurfacing,
      // consume_pkg_<id>" — was never detected by a whole-string
      // startsWith: it only matched when the package pick happened to be
      // the very first thing selected. Checking each comma-separated
      // token catches it regardless of position.
      const procedureTypeTokens = procedure.procedureType
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const consumePkgToken = procedureTypeTokens.find((t) =>
        t.startsWith("consume_pkg_"),
      );

      if (consumePkgToken) {
        packageIdToConsume = consumePkgToken.replace("consume_pkg_", "");
        const pkg = modalActivePackages.find(
          (p) => p.id === packageIdToConsume,
        );
        const displayName = pkg ? pkg.packageName : "Package Session";

        // Swap just the raw token for a human-readable name — any OTHER
        // selected procedure name in the same list stays intact, since a
        // visit can combine a catalogue procedure with consuming a
        // package session in one log.
        actualProcedureName = procedureTypeTokens
          .map((t) => (t === consumePkgToken ? displayName : t))
          .join(", ");
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
        // Set when a selected name is neither a package-session token nor
        // a catalogue service — in practice, "Other". Distinguishes "there
        // was nothing left to bill because everything was already on the
        // visit" (correctly silent) from "a typed fee has nowhere to go
        // because nothing the catalogue prices was actually selected" —
        // which used to discard the fee with no record and no warning.
        let hadUnbillableSelection = false;

        procList.forEach((procName) => {
          if (procName.startsWith("consume_pkg_")) return;
          const matchingType = appointmentTypes.find(
            (t) => t.name === procName,
          );

          if (matchingType) {
            let wasAlreadyBilled = false;

            // Already on the visit — charging it again would bill it twice.
            if (
              ((currentAppt as any).pendingVisitItems || []).some(
                (l: any) => l.appointmentTypeId === matchingType.id,
              )
            ) {
              wasAlreadyBilled = true;
            }
            if (!wasAlreadyBilled) {
              itemsList.push({
                name: procName,
                fee: Number(matchingType.price || 0),
                id: matchingType.id,
              });
              calculatedFee += Number(matchingType.price || 0);
            }
          } else {
            hadUnbillableSelection = true;
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

          // A typed fee with nowhere to go is not the same as "nothing left
          // to bill" — this app deliberately never files a charge the
          // catalogue didn't price, but silently proceeding left staff
          // believing the fee was recorded when it was simply dropped.
          if (hadUnbillableSelection) {
            addToast({
              title: "Fee Not Recorded",
              description: `A fee of NPR ${feeNum.toLocaleString()} was entered for "${actualProcedureName}", which is not a catalogue service and cannot be billed. Add it under Settings › Appointment Types, or select the matching catalogue service instead.`,
              color: "warning",
              duration: 15000,
            });
          }
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

        // This handoff charges the clinic's consultation, not the expert's
        // own service again: the routing copy carries the default
        // consultation type from Settings › Front Office, so the fee line in
        // the modal and handleConfirmRoute price the right thing. The
        // Firestore appointment document is untouched.
        const consultationTypeId =
          billingSettings?.frontOffice?.defaultConsultationTypeId;

        setRoutingAppointment({
          ...currentAppt,
          appointmentTypeId:
            consultationTypeId || selectedAppointment.appointmentTypeId,
          // A package-session visit's own patientPackageId, if carried
          // over unchanged, made describeRoutingFee take the package
          // branch FIRST — reporting the session "already on this visit"
          // (true, but irrelevant here) and never reaching the catalogue
          // lookup that would actually price this consultation. The
          // comment above this block already claimed the handoff charges
          // the consultation; this is what made that claim true.
          patientPackageId: undefined,
          // Without a configured consultation the doctor's fee cannot be
          // priced; describeRoutingFee refuses rather than charging the
          // expert's service again or nothing at all.
          __needsConsultationType: !consultationTypeId,
        } as any);
        setRoutingCabin(selectedAppointment.cabinName || "");
        setRoutingDoctorId(
          selectedAppointment.doctorId &&
            selectedAppointment.doctorId !== "unassigned"
            ? selectedAppointment.doctorId
            : "",
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
    // The check-in scope: what is collected before the clinician. Lines
    // added mid-visit are collected at Settle, not chased from the board.
    const gate = getVisitPaymentGate(
      appt as any,
      {
        taxPercentage: billingSettings?.defaultTaxPercentage,
        isTaxEnabled: Boolean(billingSettings?.enableTax),
      },
      "checkin",
      { standingCredit: standingCreditFor(appt.patientId) },
    );

    if (!gate.isDue) return null;

    return {
      items,
      owed: gate.owed,
      deposited: gate.deposited,
      dueAmount: gate.dueAmount,
    };
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

    // A clinician login with no clinician profile sees nothing here
    if (isUnlinkedClinician) return false;

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
        (stage === "lobby" ||
          stage === "triage-done" ||
          stage === "doctor" ||
          stage === "expert")
      ) {
        const start = visitWaitStart(appt as any);

        if (
          start &&
          Math.floor((new Date().getTime() - start.getTime()) / 60000) > 30
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
    onClick,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    colorClass: string;
    onClick?: () => void;
  }) => {
    const className =
      "bg-surface border border-border-base p-4 rounded flex items-center gap-4 hover:border-primary/50 transition-colors";
    const content = (
      <>
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[12px] font-medium text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text-main mt-0.5">{value}</p>
        </div>
      </>
    );

    return onClick ? (
      <button
        aria-label={`${label}: ${value}. View patients`}
        className={`${className} w-full text-left cursor-pointer`}
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    );
  };

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

  /**
   * What routing will collect for the clinician currently selected: the
   * visit's booked service through the charge core, unless that service is
   * already on the visit. Shown read-only in the modal; acted on in
   * handleConfirmRoute.
   */
  const describeRoutingFee = (): RoutingFeeLine => {
    if (!routingAppointment) return { status: "none" };
    const kind: "doctor" | "expert" | null =
      routingTarget === "doctor"
        ? "doctor"
        : routingTarget === "expert"
          ? "expert"
          : null;
    const clinicianId =
      kind === "doctor" ? routingDoctorId : kind === "expert" ? routingExpertId : "";

    if (!kind || !clinicianId || clinicianId === "unassigned") {
      return { status: "none" };
    }
    if ((routingAppointment as any).billedOnAppointmentId) {
      return { status: "elsewhere" };
    }
    if ((routingAppointment as any).__needsConsultationType) {
      return {
        status: "refused",
        reason:
          "Set the default consultation service under Settings › Front Office so the doctor's consultation can be charged.",
      };
    }
    const typeId = routingAppointment.appointmentTypeId || "";
    const pending: any[] = (routingAppointment as any).pendingVisitItems || [];

    // An invoice filed under the old model already covers this visit.
    if (
      pending.length === 0 &&
      (routingAppointment.billingId ||
        (routingAppointment as any).consultationBillingId)
    ) {
      return { status: "invoiced" };
    }

    if (
      routingAppointment.patientPackageId ||
      typeId === "package-session" ||
      typeId.startsWith("consume_pkg_")
    ) {
      const session = pending.find(
        (l) => l.patientPackageId || ((l.price || 0) === 0 && (l.amount || 0) > 0),
      );

      return session
        ? {
            status: "already",
            serviceName: session.appointmentTypeName || "Package session",
            performerName: session.doctorName,
          }
        : { status: "free", serviceName: "Package session" };
    }
    const type = appointmentTypes.find((t) => t.id === typeId);

    if (!type) {
      return {
        status: "unknown",
        reason:
          "This visit's service is not in the catalogue, so nothing can be charged until the appointment's service is corrected.",
      };
    }
    const existing = findBookedLine(pending, type.id, routingAppointment.appointmentTypeId);

    if (existing) {
      return {
        status: "already",
        serviceName: type.name,
        performerName: existing.doctorName,
        existingLineId: existing.id,
      };
    }
    // The booked service belongs to the other kind of clinician (a doctor
    // routed on an expert-booked visit, or the reverse): nothing is charged
    // at this step; the service's own line is, or will be, on the visit.
    const allowed = typePerformerKind(type);

    if (allowed !== "either" && allowed !== kind) {
      return { status: "nothing", serviceName: type.name };
    }
    const person =
      kind === "doctor"
        ? doctors.find((d) => d.id === clinicianId)
        : experts.find((e) => e.id === clinicianId);

    if (!person) {
      return {
        status: "unknown",
        reason: "The selected clinician could not be found; nothing is charged.",
      };
    }
    const clinician: ChargeClinician = {
      id: person.id,
      name: person.name,
      kind,
      consultationCharge: (person as Doctor).consultationCharge,
      defaultCommission: person.defaultCommission,
    };
    const preview = previewLineCharge(type, clinician, lineContext().pricing);

    if (preview.ok === false) {
      return { status: "refused", reason: refusalMessage(preview) };
    }
    if (preview.isFree) return { status: "free", serviceName: type.name };

    return {
      status: preview.collectAtCheckIn ? "charge" : "later",
      serviceName: type.name,
      amount: preview.total,
      vat: preview.vat,
    };
  };

  const renderRoutingModal = () => {
    return (
      <RoutingModal
        appointment={routingAppointment}
        clinicianName={
          routingAppointment ? getDoctorName(routingAppointment) : ""
        }
        doctors={doctors}
        experts={experts}
        feeLine={describeRoutingFee()}
        isOpen={isRoutingModalOpen}
        occupiedCabins={occupiedCabins}
        lockedDoctorId={
          currentDoctorId && !hasFullFrontOfficeAccess ? currentDoctorId : null
        }
        patientName={
          routingAppointment ? getPatientName(routingAppointment.patientId) : ""
        }
        routingCabin={routingCabin}
        routingDoctorId={routingDoctorId}
        routingExpertId={routingExpertId}
        routingTarget={routingTarget}
        setRoutingCabin={setRoutingCabin}
        setRoutingDoctorId={setRoutingDoctorId}
        setRoutingExpertId={setRoutingExpertId}
        onClose={() => {
          setIsRoutingModalOpen(false);
          setRoutingExpertId("");
          setRoutingDoctorId("");
        }}
        onConfirm={handleConfirmRoute}
      />
    );
  };

  const renderTriageModal = () => {
    // THIS appointment's own clinician fields — not any sibling's. The
    // modal's "Save & Send to Doctor/Expert" buttons must agree with what
    // handleSaveTriage actually checks (selectedAppointment.doctorId /
    // assignedExpertId) or a sibling appointment having a doctor could
    // show a routing button that silently does nothing but save vitals,
    // with a toast that used to claim it worked anyway.
    const hasDoctor = Boolean(
      selectedAppointment?.doctorId &&
        selectedAppointment.doctorId !== "unassigned",
    );
    const hasExpert = Boolean(
      (selectedAppointment as any)?.assignedExpertId &&
        (selectedAppointment as any).assignedExpertId !== "unassigned",
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
          ? withDoctorPrefix(matchDoc.name)
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
    let mappedApptTypeId: string;

    if (isSingleDoctorSingleExpert) {
      const doctorRow = doctorRows[0];
      const expertRow = expertRows[0];

      mappedDoctorId = doctorRow.clinicianId;
      mappedExpertId = expertRow.clinicianId;
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
      mappedApptTypeId =
        firstClinician.appointmentTypeId || quickIntakeForm.appointmentTypeId;
    }

    // We mutate the form object purely for the rest of the existing function logic to read from it
    quickIntakeForm.doctorId = mappedDoctorId;
    quickIntakeForm.assignedExpertId = mappedExpertId;
    quickIntakeForm.appointmentTypeId = mappedApptTypeId;

    if (!mappedApptTypeId) {
      addToast({
        title: "Choose a Service",
        description:
          "Pick the service for the first clinician row before checking in — nothing is booked by guess.",
        color: "warning",
      });

      return;
    }

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

    // A referral alone (no doctor, no expert, no package) is only a real
    // booking if it is for a FUTURE date — staff can assign a clinician
    // before that visit actually happens. Checking in TODAY with nothing
    // but a referral put the patient straight into the Lobby Queue with
    // no clinician and no chargeable line: validClinicianRows was empty,
    // so no line was ever appended, and the visit later refused at Check
    // In / Settle with "No clinician is on this visit" — a dead end that
    // this screen's own success toast gave no hint of.
    if (!hasDoctor && !hasExpert && !isPackageSale && hasReferral) {
      const intakeDate = quickIntakeForm.appointmentDate
        ? parseLocalDate(quickIntakeForm.appointmentDate)
        : new Date();
      const isTodayIntake =
        intakeDate.toDateString() === new Date().toDateString();

      if (isTodayIntake) {
        addToast({
          title: "Validation Error",
          description:
            "A referral alone cannot be checked in today with no Doctor or Expert — assign one, or schedule this for a future date instead.",
          color: "danger",
        });

        return;
      }
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

        // Optionally update existing patient's doctor, referrals or expert
        // in background if changed. quickIntakeForm.doctorId is the
        // literal string "unassigned" whenever the first clinician row is
        // an expert — truthy, so the plain `if (quickIntakeForm.doctorId)`
        // below wrote "unassigned" straight onto the patient's profile,
        // erasing whichever doctor they already had on file.
        const updateData: any = {};

        if (quickIntakeForm.doctorId && quickIntakeForm.doctorId !== "unassigned")
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
          // VAT from the package's own flag (Settings › Packages), gated by
          // the clinic's master switch — not a per-sale checkbox.
          applyTax:
            pkg.isTaxable === true && Boolean(billingSettings?.enableTax),
          defaultTaxPercentage: billingSettings?.defaultTaxPercentage,
          createdBy: currentUser?.uid || "system",
          // Identity for this one sale, so two genuinely distinct sales of
          // the same package to the same patient cannot collapse into a
          // single invoice via the content-plus-time-bucket fallback.
          saleId: crypto.randomUUID(),
        });

        const { id: billingId } =
          await appointmentBillingService.createBilling(billingData);

        // 3. Record the payment for the invoice total — VAT included when
        // the package is taxable; the old code paid the bare price and left
        // every taxable sale "partial" by exactly the VAT.
        if (billingData.totalAmount > 0) {
          await appointmentBillingService.recordPayment(
            billingId,
            billingData.totalAmount,
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
              // Tagged to the sale's own invoice, not left untagged like a
              // manual top-up — the Daily Report relies on this to exclude
              // it from "cash collected today": the invoice's own payment
              // (just above) already counts that money once; without this
              // tag the wallet-credit side of the SAME sale counted it a
              // second time.
              billingId,
              "package",
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
            // Neither billingId (that would be the PACKAGE SALE's invoice,
            // not this visit's) nor a "paid" stamp belongs here: this visit
            // is pre-paid via the package, not already settled. Stamping
            // it "paid" at creation made deriveVisitStage treat the visit
            // as closed the moment the clinician finished — before the
            // session's commission-only line (appended just below via
            // appendCheckInLines) was ever filed on a real invoice, so the
            // performing clinician's commission was silently never
            // generated. The zero-total path through Settle is what
            // actually creates it (see handleSettleBilling).
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

          // The first session's commission-only line for whoever performs it.
          const performerId =
            quickIntakeForm.doctorId && quickIntakeForm.doctorId !== "unassigned"
              ? quickIntakeForm.doctorId
              : quickIntakeForm.assignedExpertId;

          if (patientPkgId && performerId && performerId !== "unassigned") {
            try {
              await appendCheckInLines(newApptId, patientIdToUse, [
                {
                  clinicianId: performerId,
                  clinicianType:
                    performerId === quickIntakeForm.doctorId ? "doctor" : "expert",
                  patientPackageId: patientPkgId,
                },
                // Any other clinician row (a consultation alongside the
                // package) goes on the same session visit.
                ...validClinicianRows
                  .filter(
                    (c: any) => !String(c.appointmentTypeId || "").startsWith("pkg_"),
                  )
                  .map((c: any) => ({
                    clinicianId: c.clinicianId,
                    clinicianType: c.clinicianType,
                    appointmentTypeId: c.appointmentTypeId,
                  })),
              ]);
            } catch (billErr) {
              // The sale and the session visit both already exist — only
              // the commission-generating line failed to attach. Silence
              // here (unlike the toast below) left staff with no sign that
              // the clinician's commission for this session needs manual
              // attention.
              console.error(
                "Error recording the first package session:",
                billErr,
              );
              addToast({
                title: "Session Started, but Not Logged for Commission",
                description:
                  "The package session visit was created, but its commission line could not be recorded — add it from the queue before Settle.",
                color: "warning",
                duration: 15000,
              });
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
          appointmentDate = parseLocalDate(quickIntakeForm.appointmentDate);
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
            : quickIntakeForm.appointmentTypeId,
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
          // No "paid" stamp here either, and for the same reason as the
          // sell-package-and-start-session branch above: this visit's
          // session line (appended below via appendCheckInLines) still has
          // to reach a real, filed invoice through Settle for the
          // performing clinician's commission to be generated — stamping
          // the visit "paid" at creation let it close before that ever
          // happened.
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

        // Every clinician row's service goes on this one visit through the
        // charge core, and the check-in fee is collected. Sibling
        // appointments for extra clinicians (below) carry no lines of their
        // own.
        if (validClinicianRows.length > 0) {
          try {
            await appendCheckInLines(
              newApptId,
              patientIdToUse,
              validClinicianRows.map((c: any) => ({
                clinicianId: c.clinicianId,
                clinicianType: c.clinicianType,
                appointmentTypeId:
                  c.appointmentTypeId || quickIntakeForm.appointmentTypeId,
              })),
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
              description: `${billErr?.message || "The fee could not be recorded on the visit."} Collect it from the queue before the patient goes in.`,
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
              // appendCheckInLines call above — this
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
        billingSettings?.frontOffice,
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
        frontOffice={billingSettings?.frontOffice}
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

  /**
   * Bill the procedure the clinician recommended. Each selected catalogue
   * item becomes a line per performer chosen for it, priced by the charge
   * core — a multi-performer item splits the catalogue price in shares that
   * still sum to it. Items the catalogue cannot price are refused, never
   * invented. Declining discards the recommendation.
   */
  const handleFinaliseProcedure = async (accept: boolean) => {
    if (!apptToFinalise || !clinicId) return;
    setIsFinalisingProcedure(true);

    try {
      const rec = (apptToFinalise as any).recommendedProcedure;
      const ctx = lineContext();
      const items = legacyRecommendationToItems(
        rec,
        {
          doctorId: apptToFinalise.doctorId,
          assignedExpertId: apptToFinalise.assignedExpertId,
        },
        new Date(),
        (name) => appointmentTypes.find((t) => t.name === name)?.id,
      );
      const hasItemList = Array.isArray(rec?.items) && rec.items.length > 0;
      const refusals: string[] = [];
      const skipped: string[] = [];
      // Types that are now on the visit (added, or already there), so the
      // recommendation keeps everything else — including what was refused.
      const settledTypeIds = new Set<string>();
      let firstAssignedExpert = "";
      let procedureTotal = 0;

      if (accept) {
        const selected = hasItemList
          ? items.filter((it) =>
              finaliseSelectedItems.includes(it.appointmentTypeId),
            )
          : items;

        for (const item of selected) {
          const type = appointmentTypes.find(
            (t) => t.id === item.appointmentTypeId,
          );

          if (!type) {
            refusals.push(
              `"${item.name}" is not a catalogue service and cannot be billed; add it under Settings › Appointment Types.`,
            );
            continue;
          }
          // The visit's own booked service, recommended "as a procedure"
          // (the old procedure modal pre-ticked it), is not a second charge.
          if (
            findBookedLine(
              (apptToFinalise as any).pendingVisitItems,
              type.id,
              apptToFinalise.appointmentTypeId,
            )
          ) {
            skipped.push(`"${type.name}" is already on this visit.`);
            settledTypeIds.add(type.id);
            continue;
          }
          const chosen = itemExperts[item.appointmentTypeId] || [];
          const performerIds = chosen.length > 0 ? chosen : [item.performedBy.id];
          const performers = (
            await Promise.all(
              performerIds.map((id) =>
                findClinician(id, undefined, { doctors, experts }),
              ),
            )
          ).filter(Boolean) as ChargeClinician[];

          if (performers.length === 0) {
            refusals.push(`No clinician is assigned to "${type.name}".`);
            continue;
          }
          // Price once, then share it; the shares sum to the catalogue price.
          const priced = resolveTypePrice(type, performers[0]);

          if (priced.ok === false) {
            refusals.push(refusalMessage(priced));
            continue;
          }
          const shares = splitAmount(priced.price, performers.length);

          for (let i = 0; i < performers.length; i++) {
            const result = await ensureVisitLine({
              appointment: { id: apptToFinalise.id },
              type,
              clinician: performers[i],
              origin: "procedure",
              ctx,
              recommendedBy: item.recommendedBy || undefined,
              ...(performers.length > 1 ? { price: shares[i] } : {}),
            });

            if (result.ok === false) {
              refusals.push(refusalMessage(result));
              continue;
            }
            settledTypeIds.add(type.id);
            if (result.added) procedureTotal += result.line.amount;
            if (
              !firstAssignedExpert &&
              chosen.length > 0 &&
              performers[i].kind === "expert"
            ) {
              firstAssignedExpert = performers[i].id;
            }
          }
        }

        // The recommending doctor's referral share, accrued as before. Whether
        // it should stack on the doctor's own consultation commission is the
        // owner's call before stage 5 (spec, open question 6).
        const recommendingDoctor =
          apptToFinalise.doctorId && apptToFinalise.doctorId !== "unassigned"
            ? doctors.find((d) => d.id === apptToFinalise.doctorId)
            : undefined;
        const recommenderComm = recommendingDoctor?.defaultCommission || 0;

        if (recommendingDoctor && recommenderComm > 0 && procedureTotal > 0) {
          const fresh = await appointmentService.getAppointmentById(
            apptToFinalise.id,
          );
          const pendingItems: any[] = (fresh as any)?.pendingVisitItems || [];
          const existingPendingReferrals: any[] =
            (fresh as any)?.pendingVisitReferrals || [];
          const { discountType, discountValue } = resolveVisitDiscount(
            (fresh || apptToFinalise) as any,
          );
          const totals = appointmentBillingService.calculateInvoiceTotals(
            pendingItems,
            discountType,
            discountValue,
            billingSettings?.enableTax
              ? billingSettings?.defaultTaxPercentage || 0
              : 0,
          );
          const validTotalForReferral = Math.max(
            totals.subtotal - totals.itemDiscountAmount,
            1,
          );
          const referralDiscountRatio =
            (validTotalForReferral - totals.mainDiscountAmount) /
            validTotalForReferral;
          const effectiveTotalFee = procedureTotal * referralDiscountRatio;
          const share = (effectiveTotalFee * recommenderComm) / 100;
          const existingRef = existingPendingReferrals.find(
            (r) => r.id === recommendingDoctor.id && r.type === "doctor",
          );
          const updatedPendingReferrals = existingRef
            ? existingPendingReferrals.map((r) =>
                r.id === recommendingDoctor.id && r.type === "doctor"
                  ? { ...r, commissionAmount: r.commissionAmount + share }
                  : r,
              )
            : [
                ...existingPendingReferrals,
                {
                  type: "doctor",
                  id: recommendingDoctor.id,
                  name: recommendingDoctor.name,
                  commissionPercentage: recommenderComm,
                  commissionAmount: share,
                },
              ];

          await appointmentService.updateAppointment(apptToFinalise.id, {
            pendingVisitReferrals: updatedPendingReferrals,
            updatedAt: new Date(),
          } as any);
        }
      }

      // Declining discards the recommendation. Accepting keeps whatever is
      // not on the visit yet — the unselected items AND the ones the charge
      // core refused — so a refusal never makes a procedure vanish.
      let updatedRecommendedProcedure: any = null;

      if (accept && hasItemList) {
        const remainingItems = rec.items.filter(
          (i: any) => !settledTypeIds.has(i.id),
        );
        const remainingFee = remainingItems.reduce(
          (sum: number, i: any) => sum + (i.fee || 0),
          0,
        );

        updatedRecommendedProcedure =
          remainingItems.length > 0
            ? { ...rec, items: remainingItems, fee: remainingFee }
            : null;
      } else if (accept && settledTypeIds.size === 0 && refusals.length > 0) {
        updatedRecommendedProcedure = rec;
      }

      const updates: any = {
        recommendedProcedure: updatedRecommendedProcedure,
      };

      if (firstAssignedExpert) {
        updates.assignedExpertId = firstAssignedExpert;
      }

      await appointmentService.updateAppointment(apptToFinalise.id, updates);

      if (refusals.length > 0) {
        addToast({
          title: "Some items were not billed",
          description: [...refusals, ...skipped].join(" "),
          color: "danger",
          duration: 15000,
        });
      } else if (skipped.length > 0) {
        addToast({
          title: accept ? "Procedure Billed" : "Procedure Declined",
          description: `${skipped.join(" ")} The rest was added to this visit's pending charges.`,
          color: "warning",
          duration: 10000,
        });
      } else {
        addToast({
          title: accept ? "Procedure Billed" : "Procedure Declined",
          description: accept
            ? "The procedure has been added to this visit's pending charges."
            : "The recommended procedure was discarded.",
          color: accept ? "success" : "warning",
        });
      }
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

        // Read the visit fresh: a deposit may have been collected or
        // retried, or a line appended (a mid-visit procedure, a booked
        // consultation fee), from another desk or the expert's screen
        // after this screen loaded. Settling from a stale local snapshot
        // either lost such a collection outright or filed an invoice
        // missing a line that was already delivered and never billed.
        const liveVisit = await appointmentService.getAppointmentById(appt.id);
        const existingPendingItems: any[] =
          (liveVisit as any)?.pendingVisitItems ??
          (appt as any).pendingVisitItems ??
          [];
        const existingPendingReferrals: any[] =
          (liveVisit as any)?.pendingVisitReferrals ??
          (appt as any).pendingVisitReferrals ??
          [];
        const depositedAmount =
          liveVisit?.depositedAmount ?? ((appt as any).depositedAmount || 0);
        const depositFromCredit = Math.min(
          depositedAmount,
          liveVisit?.depositFromCredit ??
            ((appt as any).depositFromCredit || 0),
        );
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

        // Nothing accumulated yet (a visit with no check-in fee and no
        // mid-visit procedure): the booked service goes on the visit through
        // the charge core, or Settle refuses. Nothing is priced by guess —
        // the NPR 500 "General Consultation" this used to file is gone.
        let billingItems = existingPendingItems;

        if (billingItems.length === 0) {
          const apptType = appointmentTypes.find(
            (t) => t.id === appt.appointmentTypeId,
          );
          const clinician = await findClinician(
            clinicianId,
            isExpert ? "expert" : "doctor",
            { doctors, experts },
          );

          if (!apptType || !clinician) {
            addToast({
              title: "Nothing to Bill",
              description: !apptType
                ? "This visit's service is not in the catalogue, so there is nothing to invoice."
                : "No clinician is on this visit, so its service cannot be priced.",
              color: "warning",
            });

            return;
          }
          const result = await ensureVisitLine({
            appointment: { id: appt.id },
            type: apptType,
            clinician,
            origin: "booked",
            ctx: lineContext(),
          });

          if (result.ok === false) {
            addToast({
              title: "Cannot Settle",
              description: refusalMessage(result),
              color: "danger",
              duration: 10000,
            });

            return;
          }
          billingItems = [result.line];
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
          // depositedAmount is NOT cleared here. It is released below, only
          // for the money that actually lands on the invoice — zeroing it
          // first meant a wallet spent since check-in left the invoice
          // unpaid and the visit's only record of the deposit gone.
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

        // Apply what the visit already holds, in the order the money sits:
        // the share taken OUT of the wallet as standing credit at check-in
        // is applied without deducting the wallet again (it used to be
        // deducted a second time here, so the patient paid twice for it);
        // then the cash/card share still held in the wallet is deducted.
        // Any shortfall — a wallet spent at the pharmacy since check-in —
        // stays on the invoice as due, with the deposit record intact for
        // whatever did not land. Any excess stays as wallet credit, and
        // excess CREDIT goes back to the wallet it was taken from.
        const { creditPart, walletPart, creditExcess } =
          splitDepositApplication({
            depositedAmount,
            depositFromCredit,
            total: settleTotals.totalAmount,
          });
        let creditApplied = 0;
        let walletApplied = 0;
        const depositNotApplied = (payErr: unknown) => {
          console.error("Error applying visit deposit at checkout:", payErr);
          addToast({
            title: "Deposit Not Applied",
            description:
              "The invoice was created, but part of the collected deposit could not be applied — it stays recorded on the visit; apply it from the invoice page.",
            color: "warning",
          });
        };

        if (creditPart > 0) {
          try {
            await appointmentBillingService.recordPayment(
              newBillingId,
              creditPart,
              "wallet",
              undefined,
              "Visit deposit (wallet credit taken at check-in) applied at checkout",
              0,
              { walletAlreadyDeducted: true },
            );
            creditApplied = creditPart;
          } catch (payErr) {
            depositNotApplied(payErr);
          }
        }

        if (walletPart > 0) {
          try {
            await appointmentBillingService.recordPayment(
              newBillingId,
              walletPart,
              "wallet",
              undefined,
              "Visit deposit applied at checkout",
            );
            walletApplied = walletPart;
          } catch (payErr) {
            depositNotApplied(payErr);
          }
        }

        const depositToApply = creditApplied + walletApplied;
        // Release only what landed; the held cash share beyond the invoice
        // total simply stays as wallet credit once the cash share applied.
        const heldExcess =
          walletApplied === walletPart
            ? Math.max(
                0,
                depositedAmount - depositFromCredit - walletApplied,
              )
            : 0;

        if (depositToApply + heldExcess > 0) {
          await appointmentService
            .releaseVisitDeposit(appt.id, depositToApply + heldExcess)
            .catch((releaseErr) =>
              console.error("Failed to release the applied deposit:", releaseErr),
            );
        }
        if (creditApplied > 0) {
          await appointmentService
            .markVisitDepositFromCredit(appt.id, -creditApplied)
            .catch((markErr) =>
              console.error("Failed to release the credit share:", markErr),
            );
        }
        if (creditExcess > 0) {
          try {
            await walletService.refundFunds(
              appt.patientId,
              clinicId,
              creditExcess,
              appt.id,
              "Unused visit credit returned at checkout",
              currentUser?.uid || "system",
            );
            await appointmentService.releaseVisitDeposit(appt.id, creditExcess);
            await appointmentService.markVisitDepositFromCredit(
              appt.id,
              -creditExcess,
            );
          } catch (refundErr) {
            console.error("Error returning unused visit credit:", refundErr);
            addToast({
              title: "Credit Not Returned",
              description: `NPR ${creditExcess.toFixed(2)} of wallet credit taken at check-in was not needed but could not be returned automatically — add it back from the patient's wallet.`,
              color: "warning",
            });
          }
        }

        if (depositToApply === 0 && settleTotals.totalAmount <= 0) {
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
        } else if (depositToApply === 0) {
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
      const due = consBill.dueAmount;

      return {
        label: `${(appt as any).checkInDepositFailedAt ? "Retry fee" : "Collect"} NPR ${due.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        icon: <IoCardOutline className="w-4 h-4" />,
        colorClass: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
        onClick: () => openCollectDue(appt),
      };
    }

    switch (stage) {
      case "scheduled":
        return {
          label: "Check In",
          icon: <IoCheckmarkCircleOutline className="w-4 h-4" />,
          colorClass: "bg-primary text-white hover:bg-primary/90",
          onClick: () => openCheckIn(appt),
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
          pendingKey: `settle-billing-${appt.id}`,
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
        return (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap shrink-0">
            Fee Pending
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
          if (isUnlinkedClinician) return false;

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

        // The patients behind each card's number — clicking a card lists them
        const queue = appointments.filter(getQueueFilter);
        const lobbyList = queue.filter((a) => {
          const s = getPatientStage(a);

          if (s === "scheduled") return true;
          if (s !== "lobby") return false;
          const consBill = getPendingBillForAppointment(a);
          const isConsBillPending = Boolean(consBill);

          return isConsBillPending;
        });
        const triageList = queue.filter(
          (a) => getPatientStage(a) === "triage-done",
        );
        const doctorCabinList = appointments
          .filter(
            (a) =>
              !isUnlinkedClinician &&
              (!currentDoctorId || a.doctorId === currentDoctorId),
          )
          .filter((a) => getPatientStage(a) === "doctor");
        const expertCabinList = appointments
          .filter(
            (a) =>
              !isUnlinkedClinician &&
              (!currentExpertId || a.assignedExpertId === currentExpertId),
          )
          .filter((a) => getPatientStage(a) === "expert");
        const invoiceList = queue.filter(
          (a) => getPatientStage(a) === "billing",
        );
        const pharmacyList = queue.filter(
          (a) => getPatientStage(a) === "pharmacy",
        );
        const appointmentsLabel =
          selectedDate.toDateString() === new Date().toDateString()
            ? "Today's Appointments"
            : `${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} Appointments`;

        const statLists: Record<
          string,
          { title: string; rows: Appointment[] }
        > = {
          appointments: { title: appointmentsLabel, rows: queue },
          lobby: { title: "Waiting in Lobby", rows: lobbyList },
          triage: { title: "Triage Completed", rows: triageList },
          doctor: { title: "In Doctor Cabin", rows: doctorCabinList },
          expert: { title: "In Expert Cabin", rows: expertCabinList },
          billing: { title: "Invoice Pending", rows: invoiceList },
          pharmacy: { title: "Pharmacy Pending", rows: pharmacyList },
        };
        const openList = openStatCard ? statLists[openStatCard] : null;

        return (
          <>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 ${gridColsClass} gap-3.5`}
            >
              <StatCard
                colorClass="bg-surface-3 text-text-muted"
                icon={<IoCalendarOutline className="w-5 h-5" />}
                label={appointmentsLabel}
                value={queue.length}
                onClick={() => setOpenStatCard("appointments")}
              />
              <StatCard
                colorClass="bg-teal-500/10 text-teal-600"
                icon={<IoPeopleOutline className="w-5 h-5" />}
                label="Waiting in Lobby"
                value={lobbyList.length}
                onClick={() => setOpenStatCard("lobby")}
              />
              <StatCard
                colorClass="bg-indigo-500/10 text-indigo-600"
                icon={<IoHeartOutline className="w-5 h-5" />}
                label="Triage Completed"
                value={triageList.length}
                onClick={() => setOpenStatCard("triage")}
              />
              <StatCard
                colorClass="bg-amber-500/10 text-amber-600"
                icon={<IoTimeOutline className="w-5 h-5" />}
                label="In Doctor Cabin"
                value={doctorCabinList.length}
                onClick={() => setOpenStatCard("doctor")}
              />
              {(!currentDoctorId ||
                hasFullFrontOfficeAccess ||
                currentExpertId) && (
                <StatCard
                  colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  icon={<IoPeopleOutline className="w-5 h-5" />}
                  label="In Expert Cabin"
                  value={expertCabinList.length}
                  onClick={() => setOpenStatCard("expert")}
                />
              )}
              {(hasFullFrontOfficeAccess || currentExpertId) && (
                <>
                  <StatCard
                    colorClass="bg-saffron-500/10 text-saffron-600"
                    icon={<IoCardOutline className="w-5 h-5" />}
                    label="Invoice Pending"
                    value={invoiceList.length}
                    onClick={() => setOpenStatCard("billing")}
                  />
                  <StatCard
                    colorClass="bg-purple-500/10 text-purple-600"
                    icon={<IoReceiptOutline className="w-5 h-5" />}
                    label="Pharmacy Pending"
                    value={pharmacyList.length}
                    onClick={() => setOpenStatCard("pharmacy")}
                  />
                </>
              )}
            </div>
            <StageListModal
              isOpen={Boolean(openList)}
              rows={(openList?.rows ?? []).map((a) => ({
                id: a.id,
                patientId: a.patientId,
                name: getPatientName(a.patientId),
                reg: getPatientReg(a.patientId),
                clinician: getDoctorName(a),
                time: a.startTime,
                stage: getStageBadge(getPatientStage(a), a),
              }))}
              title={openList?.title ?? ""}
              onClose={() => setOpenStatCard(null)}
            />
          </>
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
              if (isUnlinkedClinician) return false;

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
                    (a) =>
                      !isUnlinkedClinician &&
                      (!currentDoctorId || a.doctorId === currentDoctorId),
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
                      !isUnlinkedClinician &&
                      (!currentExpertId ||
                        a.assignedExpertId === currentExpertId),
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
              pricing={{
                taxPercentage: billingSettings?.defaultTaxPercentage,
                isTaxEnabled: Boolean(billingSettings?.enableTax),
              }}
              getApptTypeLabel={getApptTypeLabel}
              getDoctorName={getDoctorName}
              getDoctorSpeciality={getDoctorSpeciality}
              getGuidedAction={getGuidedAction}
              getPatientName={getPatientName}
              getPatientReg={getPatientReg}
              getPatientStage={getPatientStage}
              getStageBadge={getStageBadge}
              getStandingCredit={(a) => standingCreditFor(a.patientId)}
              getWaitStart={(a) => visitWaitStart(a)}
              onPrintAdvanceReceipt={printAdvanceReceipt}
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
      {checkInSheet && (
        <CheckInSheet
          depositFailed={Boolean(
            (checkInSheet.appt as any).checkInDepositFailedAt,
          )}
          isOpen
          mode={checkInSheet.mode}
          patientName={getPatientName(checkInSheet.appt.patientId)}
          performerName={checkInSheet.performerName}
          plan={checkInSheet.plan}
          regNumber={getPatientReg(checkInSheet.appt.patientId)}
          saving={checkInSaving}
          serviceName={checkInSheet.serviceName}
          settings={billingSettings}
          onClose={() => {
            if (!checkInSaving) setCheckInSheet(null);
          }}
          onConfirm={(capture) =>
            checkInSheet.mode === "collect"
              ? performCollectDue(checkInSheet.appt, capture)
              : performCheckIn(checkInSheet.appt, capture)
          }
        />
      )}

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
                The clinician recommended the following procedure for this
                patient. Add it to this visit's charges? It is collected at
                Settle.
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
                            disabled={
                              !appointmentTypes.some((t) => t.id === item.id) ||
                              Boolean(
                                findBookedLine(
                                  (apptToFinalise as any).pendingVisitItems,
                                  item.id,
                                  apptToFinalise.appointmentTypeId,
                                ),
                              )
                            }
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
                              {!appointmentTypes.some(
                                (t) => t.id === item.id,
                              ) && (
                                <span className="ml-1.5 text-[10px] font-semibold uppercase text-danger">
                                  not in catalogue
                                </span>
                              )}
                              {findBookedLine(
                                (apptToFinalise as any).pendingVisitItems,
                                item.id,
                                apptToFinalise.appointmentTypeId,
                              ) && (
                                <span className="ml-1.5 text-[10px] font-semibold uppercase text-text-muted">
                                  already on this visit
                                </span>
                              )}
                            </span>
                          </Checkbox>
                          <div className="flex flex-col items-start sm:items-end gap-1 w-full sm:w-56 shrink-0">
                            <span className="text-[12.5px] text-text-muted font-semibold">
                              {(() => {
                                const price = appointmentTypes.find(
                                  (t) => t.id === item.id,
                                )?.price;

                                return typeof price === "number"
                                  ? `NPR ${price.toLocaleString()}`
                                  : "priced at Finalise";
                              })()}
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
                                {splitAmount(
                                  appointmentTypes.find((t) => t.id === item.id)
                                    ?.price ?? 0,
                                  itemExperts[item.id].length,
                                )
                                  .map((n) => n.toLocaleString())
                                  .join(" / ")}
                              </p>
                            )}
                          </div>
                        </div>
                      ),
                    )}
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

              {/* What this adds: each selected item at its catalogue price,
                  VAT from the service's own flag. No discount or tax decision
                  is taken here — a discount is permissioned and taken at
                  Settle, where the whole visit is known. */}
              {(() => {
                const rec = (apptToFinalise as any).recommendedProcedure;
                const items = legacyRecommendationToItems(
                  rec,
                  {
                    doctorId: apptToFinalise.doctorId,
                    assignedExpertId: apptToFinalise.assignedExpertId,
                  },
                  new Date(),
                  (name) => appointmentTypes.find((t) => t.name === name)?.id,
                );
                const hasList = Array.isArray(rec?.items) && rec.items.length > 0;
                const selected = hasList
                  ? items.filter((it) =>
                      finaliseSelectedItems.includes(it.appointmentTypeId),
                    )
                  : items;
                const pricing = lineContext().pricing;
                const unpriceable: string[] = [];
                let subtotal = 0;
                let vat = 0;

                for (const it of selected) {
                  const t = appointmentTypes.find(
                    (x) => x.id === it.appointmentTypeId,
                  );
                  const performerId =
                    itemExperts[it.appointmentTypeId]?.[0] || it.performedBy.id;
                  const person =
                    doctors.find((d) => d.id === performerId) ||
                    experts.find((e) => e.id === performerId);
                  const clinician: ChargeClinician | null = person
                    ? {
                        id: person.id,
                        name: person.name,
                        kind: doctors.some((d) => d.id === person.id)
                          ? "doctor"
                          : "expert",
                        consultationCharge: (person as Doctor).consultationCharge,
                        defaultCommission: person.defaultCommission,
                      }
                    : null;
                  const preview = t
                    ? previewLineCharge(t, clinician, pricing)
                    : null;

                  if (!preview || preview.ok === false) {
                    unpriceable.push(
                      `${it.name}${preview && preview.ok === false ? ` (${preview.reason})` : ""}`,
                    );
                    continue;
                  }
                  subtotal += preview.price;
                  vat += preview.vat;
                }

                return (
                  <div className="bg-surface-2 border border-border-base p-3 rounded mb-5 space-y-1">
                    <div className="flex justify-between text-[11.5px] text-text-muted">
                      <span>Catalogue price</span>
                      <span>NPR {subtotal.toLocaleString()}</span>
                    </div>
                    {vat > 0 && (
                      <div className="flex justify-between text-[11.5px] text-text-muted">
                        <span>VAT</span>
                        <span>NPR {vat.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-primary pt-1 border-t border-border-base">
                      <span>Added to the visit</span>
                      <span>NPR {(subtotal + vat).toLocaleString()}</span>
                    </div>
                    {unpriceable.length > 0 && (
                      <p className="text-[11px] text-danger pt-1">
                        Cannot be billed: {unpriceable.join("; ")}.
                      </p>
                    )}
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
                    : "Accept & Add to Visit"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <SellPackageModal
        isOpen={isSellPackageModalOpen}
        patients={patients}
        doctors={doctors}
        experts={experts}
        onClose={() => setIsSellPackageModalOpen(false)}
      />
    </div>
  );
}
