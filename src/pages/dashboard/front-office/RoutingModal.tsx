import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline } from "react-icons/io5";

/**
 * What routing will do about money, decided by the charge core on the desk
 * and shown here read-only. The old modal offered "Charge Consultation
 * Fee", "Apply Tax", a discount and "Add commission" — four decisions the
 * catalogue already makes, asked again of whoever happened to be routing.
 */
export interface RoutingFeeLine {
  /**
   * charge: collected on confirm · later: on the visit, collected at Settle ·
   * free: nothing to collect · already: the service is on the visit ·
   * elsewhere: the fee lives on the patient's main visit · invoiced: an
   * invoice already exists · nothing: not this clinician's service ·
   * unknown: cannot be priced, routing still allowed · refused: blocks ·
   * none: no clinician chosen yet.
   */
  status:
    | "charge"
    | "later"
    | "free"
    | "already"
    | "elsewhere"
    | "invoiced"
    | "nothing"
    | "unknown"
    | "refused"
    | "none";
  serviceName?: string;
  /** VAT-inclusive amount collected on confirm. */
  amount?: number;
  vat?: number;
  performerName?: string;
  reason?: string;
  /**
   * Set when status is "already": the id of the pending line that already
   * covers this service, whoever it is currently attributed to. Lets the
   * confirm handler re-point that line at the clinician actually being
   * routed to, instead of leaving it billed to whoever was on the visit
   * before Undo Check-In / Send Back cleared them off it.
   */
  existingLineId?: string;
}

interface RoutingModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  patientName: string;
  clinicianName: string;
  routingCabin: string;
  setRoutingCabin: React.Dispatch<React.SetStateAction<string>>;
  routingTarget: "doctor" | "expert" | "default";
  onConfirm: () => void;
  doctors: any[];
  routingDoctorId: string;
  setRoutingDoctorId: React.Dispatch<React.SetStateAction<string>>;
  experts?: any[];
  routingExpertId?: string;
  setRoutingExpertId?: React.Dispatch<React.SetStateAction<string>>;
  /** Cabin name → occupying patient's name, for the exclusive (non-shared)
   * rooms only — computed by front-office-desk.tsx from live appointment
   * state, excluding the patient currently being routed. */
  occupiedCabins?: Record<string, string>;
  /** The fee this routing collects (or not), for the clinician selected. */
  feeLine?: RoutingFeeLine;
  /**
   * Set when this modal was opened from a doctor's own restricted
   * dashboard — that account only ever acts on its own patients, so
   * letting it pick a DIFFERENT doctor from a clinic-wide dropdown would
   * let a single-doctor login reroute a patient to a colleague, which is a
   * front-desk decision, not theirs to make from their own queue. When
   * set, "Select Doctor" renders as the doctor's own name instead of a
   * dropdown.
   */
  lockedDoctorId?: string | null;
}

const money = (n: number | undefined) => `NPR ${(n || 0).toLocaleString()}`;

const FeeLineNotice: React.FC<{ feeLine?: RoutingFeeLine }> = ({ feeLine }) => {
  if (!feeLine || feeLine.status === "none") {
    return (
      <p className="text-[11.5px] text-text-muted">
        Select a clinician to see the fee for this visit.
      </p>
    );
  }
  if (feeLine.status === "already") {
    return (
      <p className="text-[11.5px] text-health-600 font-medium">
        ✓ {feeLine.serviceName || "Fee"} is already on this visit
        {feeLine.performerName ? ` (${feeLine.performerName})` : ""}.
      </p>
    );
  }
  if (feeLine.status === "elsewhere") {
    return (
      <p className="text-[11.5px] text-health-600 font-medium">
        ✓ This clinician's fee is on the patient's main visit; nothing to
        collect here.
      </p>
    );
  }
  if (feeLine.status === "invoiced") {
    return (
      <p className="text-[11.5px] text-health-600 font-medium">
        ✓ This visit was already invoiced; nothing to collect.
      </p>
    );
  }
  if (feeLine.status === "nothing") {
    return (
      <p className="text-[11.5px] text-text-muted font-medium">
        No fee at this step — {feeLine.serviceName || "the booked service"} is
        the other clinician's service.
      </p>
    );
  }
  if (feeLine.status === "unknown") {
    return (
      <p className="text-[11.5px] text-warning-600 font-medium">
        ⚠ {feeLine.reason}
      </p>
    );
  }
  if (feeLine.status === "free") {
    return (
      <p className="text-[11.5px] text-text-muted font-medium">
        {feeLine.serviceName || "This service"} is free — nothing to collect.
      </p>
    );
  }
  if (feeLine.status === "refused") {
    return (
      <p className="text-[11.5px] text-danger font-medium">
        ⚠ {feeLine.reason}
      </p>
    );
  }
  if (feeLine.status === "later") {
    return (
      <p className="text-[11.5px] text-text-main font-medium">
        {feeLine.serviceName || "Fee"} · {money(feeLine.amount)} added to the
        visit, collected at Settle
      </p>
    );
  }

  return (
    <p className="text-[11.5px] text-text-main font-medium">
      {feeLine.serviceName || "Fee"} · {money(feeLine.amount)} collected on
      confirm
      {feeLine.vat ? (
        <span className="text-text-muted font-normal">
          {" "}
          (incl. VAT {money(feeLine.vat)})
        </span>
      ) : null}
    </p>
  );
};

export const RoutingModal: React.FC<RoutingModalProps> = ({
  isOpen,
  onClose,
  appointment,
  patientName,
  clinicianName,
  routingCabin,
  setRoutingCabin,
  routingTarget,
  onConfirm,
  doctors,
  routingDoctorId,
  setRoutingDoctorId,
  experts = [],
  routingExpertId = "",
  setRoutingExpertId,
  occupiedCabins = {},
  feeLine,
  lockedDoctorId = null,
}) => {
  // Escape-to-close and focus-on-open — see the identical fix/rationale in
  // QuickIntakeModal.tsx.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen || !appointment) return null;

  const modalRoot = document.body;
  const hasDoc = appointment.doctorId && appointment.doctorId !== "unassigned";
  const cabinLabel = (value: string, label: string) =>
    occupiedCabins[value]
      ? `${label} — Occupied (${occupiedCabins[value]})`
      : label;
  const clinicianLabel = (clinician: any) =>
    clinician.isOnDuty === false
      ? `${clinician.name} (Off Duty)`
      : clinician.name;
  const selectedCabinConflict = routingCabin
    ? occupiedCabins[routingCabin]
    : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="bg-surface rounded border border-border-base shadow-xl max-w-md w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200 outline-none"
        tabIndex={-1}
      >
        <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[14.5px] text-text-main">
              🚪 Route Patient to Room/Cabin
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Patient:{" "}
              <span className="font-semibold text-primary">{patientName}</span>
            </p>
          </div>
          <button
            aria-label="Close"
            className="text-text-muted hover:text-text-main p-1"
            onClick={onClose}
          >
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {routingTarget === "doctor" && (
            <div className="space-y-3 border-b border-border-base pb-4">
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                  {lockedDoctorId ? (
                    "Doctor"
                  ) : (
                    <>
                      Select Doctor <span className="text-red-500">*</span>
                    </>
                  )}
                </label>
                {lockedDoctorId ? (
                  // This is the doctor's own restricted dashboard — only
                  // their own patients ever reach it, so there is nothing to
                  // choose. A free dropdown here would let a single-doctor
                  // login hand a patient to a colleague, which is a
                  // front-desk decision.
                  <p className="h-10 px-3 flex items-center text-[13px] border rounded border-border-base bg-surface-2 text-text-main font-medium">
                    {doctors.find((d) => d.id === lockedDoctorId)?.name ||
                      clinicianName ||
                      "You"}
                  </p>
                ) : (
                  <select
                    className="w-full h-10 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                    value={routingDoctorId}
                    onChange={(e) => setRoutingDoctorId(e.target.value)}
                  >
                    <option value="">-- Select Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {clinicianLabel(d)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <FeeLineNotice feeLine={feeLine} />
            </div>
          )}

          {routingTarget === "expert" && setRoutingExpertId && (
            <div className="space-y-3 border-b border-border-base pb-4">
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                  Select Expert <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-10 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                  value={routingExpertId}
                  onChange={(e) => setRoutingExpertId(e.target.value)}
                >
                  <option value="">-- Select Expert --</option>
                  {experts.map((e) => (
                    <option key={e.id} value={e.id}>
                      {clinicianLabel(e)}
                    </option>
                  ))}
                </select>
              </div>
              <FeeLineNotice feeLine={feeLine} />
            </div>
          )}

          <div>
            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
              Select Consultation Room or Procedure Cabin
            </label>
            <select
              className="w-full h-10 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
              value={routingCabin}
              onChange={(e) => setRoutingCabin(e.target.value)}
            >
              <option value="">-- Select Room/Cabin (Optional) --</option>
              <optgroup label="OPD Rooms">
                <option
                  disabled={Boolean(occupiedCabins["OPD Room 1"])}
                  value="OPD Room 1"
                >
                  {cabinLabel("OPD Room 1", "OPD Room 1")}
                </option>
                <option
                  disabled={Boolean(occupiedCabins["OPD Room 2"])}
                  value="OPD Room 2"
                >
                  {cabinLabel("OPD Room 2", "OPD Room 2")}
                </option>
                <option
                  disabled={Boolean(occupiedCabins["OPD Room 3"])}
                  value="OPD Room 3"
                >
                  {cabinLabel("OPD Room 3", "OPD Room 3")}
                </option>
              </optgroup>
              <optgroup label="Cabins & Laser">
                <option
                  disabled={Boolean(occupiedCabins["Laser Room 1"])}
                  value="Laser Room 1"
                >
                  {cabinLabel("Laser Room 1", "Laser Room 1")}
                </option>
                <option
                  disabled={Boolean(occupiedCabins["Laser Room 2"])}
                  value="Laser Room 2"
                >
                  {cabinLabel("Laser Room 2", "Laser Room 2")}
                </option>
                <option
                  disabled={Boolean(occupiedCabins["PRP Cabin A"])}
                  value="PRP Cabin A"
                >
                  {cabinLabel("PRP Cabin A", "PRP Cabin A")}
                </option>
                <option
                  disabled={Boolean(occupiedCabins["PRP Cabin B"])}
                  value="PRP Cabin B"
                >
                  {cabinLabel("PRP Cabin B", "PRP Cabin B")}
                </option>
                <option
                  disabled={Boolean(occupiedCabins["Facial Therapy Room"])}
                  value="Facial Therapy Room"
                >
                  {cabinLabel("Facial Therapy Room", "Facial Room")}
                </option>
              </optgroup>
              <optgroup label="Other Areas">
                <option value="Lobby">Lobby</option>
                <option value="Triage Area">Triage Area</option>
                <option value="Billing Counter">Billing Counter</option>
                <option value="Pharmacy">Pharmacy</option>
              </optgroup>
            </select>
            {selectedCabinConflict && (
              <p className="text-[11px] text-danger mt-1">
                ⚠️ {routingCabin} is currently occupied by{" "}
                {selectedCabinConflict}. Please choose a different room.
              </p>
            )}
          </div>
          <p className="text-xs text-text-muted">
            Routing this patient will mark their status as{" "}
            <strong>In Consultation</strong> and alert the assigned clinician (
            {(() => {
              // Reflect whoever is actually being routed to in THIS action
              // (routingTarget + the dropdown selection), not the original
              // appointment's pre-existing doctorId — that stale value made
              // this text say "Expert" even while asking staff to "Select
              // Doctor" whenever the appointment itself had no doctor set
              // yet (e.g. an expert-to-doctor handoff after Record
              // Procedure Log).
              if (routingTarget === "doctor") {
                return (
                  doctors.find((d) => d.id === routingDoctorId)?.name ||
                  "the selected doctor"
                );
              }
              if (routingTarget === "expert") {
                return (
                  experts.find((e) => e.id === routingExpertId)?.name ||
                  "the selected expert"
                );
              }

              return hasDoc ? clinicianName : "Expert";
            })()}
            ).
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-border-base flex gap-2 justify-end px-5 pb-5">
          <button
            className="h-9 px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="h-9 px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 flex items-center gap-1.5 transition-colors"
            type="button"
            onClick={onConfirm}
          >
            Confirm & Route
          </button>
        </div>
      </div>
    </div>,
    modalRoot,
  );
};
