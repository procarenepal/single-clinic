import React from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline } from "react-icons/io5";

interface RoutingModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  patientName: string;
  clinicianName: string;
  routingCabin: string;
  setRoutingCabin: React.Dispatch<React.SetStateAction<string>>;
  routingTarget: "doctor" | "expert" | "default";
  routingAddCommission: boolean;
  setRoutingAddCommission: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
  doctors: any[];
  routingDoctorId: string;
  setRoutingDoctorId: React.Dispatch<React.SetStateAction<string>>;
  routingChargeConsultation: boolean;
  setRoutingChargeConsultation: React.Dispatch<React.SetStateAction<boolean>>;
  experts?: any[];
  routingExpertId?: string;
  setRoutingExpertId?: React.Dispatch<React.SetStateAction<string>>;
}

export const RoutingModal: React.FC<RoutingModalProps> = ({
  isOpen,
  onClose,
  appointment,
  patientName,
  clinicianName,
  routingCabin,
  setRoutingCabin,
  routingTarget,
  routingAddCommission,
  setRoutingAddCommission,
  onConfirm,
  doctors,
  routingDoctorId,
  setRoutingDoctorId,
  routingChargeConsultation,
  setRoutingChargeConsultation,
  experts = [],
  routingExpertId = "",
  setRoutingExpertId,
}) => {
  if (!isOpen || !appointment) return null;

  const modalRoot = document.body;
  const hasDoc = appointment.doctorId && appointment.doctorId !== "unassigned";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="bg-surface rounded border border-border-base shadow-xl max-w-md w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200">
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
            className="text-text-muted hover:text-text-main p-1"
            onClick={onClose}
          >
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {routingTarget === "doctor" && (
            <div className="space-y-4 border-b border-border-base pb-4">
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                  Select Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-10 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                  value={routingDoctorId}
                  onChange={(e) => setRoutingDoctorId(e.target.value)}
                >
                  <option value="">-- Select Doctor --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-text-main font-medium">
                <input
                  checked={routingChargeConsultation}
                  className="w-3.5 h-3.5 text-primary rounded focus:ring-primary border-border-base"
                  type="checkbox"
                  onChange={(e) => setRoutingChargeConsultation(e.target.checked)}
                />
                Charge Doctor Consultation Fee & Settle Bill
              </label>
            </div>
          )}

          {routingTarget === "expert" && setRoutingExpertId && (
            <div className="space-y-4 border-b border-border-base pb-4">
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
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
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
                <option value="OPD Room 1">OPD Room 1</option>
                <option value="OPD Room 2">OPD Room 2</option>
                <option value="OPD Room 3">OPD Room 3</option>
              </optgroup>
              <optgroup label="Cabins & Laser">
                <option value="Laser Room 1">Laser Room 1</option>
                <option value="Laser Room 2">Laser Room 2</option>
                <option value="PRP Cabin A">PRP Cabin A</option>
                <option value="PRP Cabin B">PRP Cabin B</option>
                <option value="Facial Therapy Room">Facial Room</option>
              </optgroup>
              <optgroup label="Other Areas">
                <option value="Lobby">Lobby</option>
                <option value="Triage Area">Triage Area</option>
                <option value="Billing Counter">Billing Counter</option>
                <option value="Pharmacy">Pharmacy</option>
              </optgroup>
            </select>
          </div>
          <p className="text-xs text-text-muted">
            Routing this patient will mark their status as{" "}
            <strong>In Consultation</strong> and alert the assigned clinician (
            {hasDoc ? clinicianName : "Expert"}).
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-border-base flex gap-2 justify-end px-5 pb-5">
          <div className="flex-1 flex items-center mt-2 px-2">
            {(routingTarget === "doctor" || routingTarget === "expert") &&
              routingCabin &&
              routingCabin !== "unassigned" && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-text-main font-medium">
                  <input
                    checked={routingAddCommission}
                    className="w-3.5 h-3.5 text-primary rounded focus:ring-primary border-border-base"
                    type="checkbox"
                    onChange={(e) => setRoutingAddCommission(e.target.checked)}
                  />
                  Add commission for clinician
                </label>
              )}
          </div>
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
