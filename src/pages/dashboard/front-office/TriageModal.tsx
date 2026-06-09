import React from "react";
import { createPortal } from "react-dom";
import {
  IoCloseOutline,
  IoHeartOutline,
  IoThermometerOutline,
  IoSpeedometerOutline,
  IoBodyOutline,
  IoCreateOutline,
} from "react-icons/io5";

export interface VitalsState {
  bpSystolic: string;
  bpDiastolic: string;
  pulse: string;
  temp: string;
  weight: string;
  spo2: string;
  complaints: string;
}

interface TriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  patientName: string;
  vitals: VitalsState;
  setVitals: React.Dispatch<React.SetStateAction<VitalsState>>;
  onSave: (
    e: React.MouseEvent | React.FormEvent,
    target?: "doctor" | "expert",
  ) => void;
  saving: boolean;
}

export const TriageModal: React.FC<TriageModalProps> = ({
  isOpen,
  onClose,
  appointment,
  patientName,
  vitals,
  setVitals,
  onSave,
  saving,
}) => {
  if (!isOpen || !appointment) return null;

  const modalRoot = document.body;

  const handleTriageKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextId: string,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById(nextId)?.focus();
    }
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="bg-surface rounded border border-border-base shadow-xl max-w-2xl w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[14.5px] text-text-main">
              🩺 Record Triage Vitals
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

        <form>
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {/* Systolic BP */}
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <IoHeartOutline className="text-red-500" /> Blood Pressure
                  (Systolic)
                </label>
                <input
                  className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary"
                  id="triage_bpSystolic"
                  placeholder="e.g. 120"
                  type="number"
                  value={vitals.bpSystolic}
                  onChange={(e) =>
                    setVitals((v) => ({ ...v, bpSystolic: e.target.value }))
                  }
                  onKeyDown={(e) =>
                    handleTriageKeyDown(e, "triage_bpDiastolic")
                  }
                />
              </div>
              {/* Diastolic BP */}
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <IoHeartOutline className="text-red-500" /> Blood Pressure
                  (Diastolic)
                </label>
                <input
                  className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary"
                  id="triage_bpDiastolic"
                  placeholder="e.g. 80"
                  type="number"
                  value={vitals.bpDiastolic}
                  onChange={(e) =>
                    setVitals((v) => ({ ...v, bpDiastolic: e.target.value }))
                  }
                  onKeyDown={(e) => handleTriageKeyDown(e, "triage_temp")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Temperature */}
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <IoThermometerOutline className="text-saffron-500" />{" "}
                  Temperature (°F)
                </label>
                <input
                  className={`w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors ${getTriageClass(
                    "temp",
                    vitals.temp,
                  )}`}
                  id="triage_temp"
                  placeholder="e.g. 98.6"
                  step="0.1"
                  type="number"
                  value={vitals.temp}
                  onChange={(e) =>
                    setVitals((v) => ({ ...v, temp: e.target.value }))
                  }
                  onKeyDown={(e) => handleTriageKeyDown(e, "triage_pulse")}
                />
                {vitals.temp && parseFloat(vitals.temp) > 99.5 && (
                  <p className="text-[10px] font-bold text-saffron-600 mt-1 leading-none">
                    ⚠️ High Temp / Fever Warning
                  </p>
                )}
              </div>
              {/* Pulse Rate */}
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <IoSpeedometerOutline className="text-teal-500" /> Pulse /
                  Heart Rate (bpm)
                </label>
                <input
                  className={`w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors ${getTriageClass(
                    "pulse",
                    vitals.pulse,
                  )}`}
                  id="triage_pulse"
                  placeholder="e.g. 72"
                  type="number"
                  value={vitals.pulse}
                  onChange={(e) =>
                    setVitals((v) => ({ ...v, pulse: e.target.value }))
                  }
                  onKeyDown={(e) => handleTriageKeyDown(e, "triage_weight")}
                />
                {vitals.pulse &&
                  (parseFloat(vitals.pulse) < 60 ||
                    parseFloat(vitals.pulse) > 100) && (
                    <p className="text-[10px] font-bold text-saffron-600 mt-1 leading-none">
                      ⚠️ Pulse outside normal range
                    </p>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Weight */}
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <IoBodyOutline className="text-sky-500" /> Weight (kg)
                </label>
                <input
                  className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                  id="triage_weight"
                  placeholder="e.g. 70"
                  step="0.1"
                  type="number"
                  value={vitals.weight}
                  onChange={(e) =>
                    setVitals((v) => ({ ...v, weight: e.target.value }))
                  }
                  onKeyDown={(e) => handleTriageKeyDown(e, "triage_spo2")}
                />
              </div>
              {/* SpO2 */}
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                  <IoSpeedometerOutline className="text-indigo-500" /> SpO2 (%)
                  Oxygen Saturation
                </label>
                <input
                  className={`w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors ${getTriageClass(
                    "spo2",
                    vitals.spo2,
                  )}`}
                  id="triage_spo2"
                  placeholder="e.g. 98"
                  type="number"
                  value={vitals.spo2}
                  onChange={(e) =>
                    setVitals((v) => ({ ...v, spo2: e.target.value }))
                  }
                  onKeyDown={(e) => handleTriageKeyDown(e, "triage_complaints")}
                />
                {vitals.spo2 && parseFloat(vitals.spo2) < 95 && (
                  <p className="text-[10px] font-bold text-red-600 mt-1 leading-none">
                    🚨 Critical Low Oxygen warning
                  </p>
                )}
              </div>
            </div>

            {/* Chief Complaints */}
            <div>
              <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                <IoCreateOutline className="text-text-muted" /> Chief Complaints
                / Symptoms
              </label>
              <textarea
                className="w-full min-h-20 px-3 py-2 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors resize-none"
                id="triage_complaints"
                placeholder="Describe patient symptoms (e.g. cough for 3 days, mild headache)..."
                value={vitals.complaints}
                onChange={(e) =>
                  setVitals((v) => ({ ...v, complaints: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-border-base bg-surface-2 flex flex-col md:flex-row items-center justify-between gap-3 rounded-b-lg">
            <button
              className="h-9 w-full md:w-auto px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <div className="flex flex-col md:flex-row items-center justify-end gap-2 w-full md:w-auto flex-wrap">
              <button
                className="h-9 w-full md:w-auto px-4 rounded border border-primary text-primary text-[12.5px] font-medium hover:bg-primary/10 transition-colors whitespace-nowrap"
                disabled={saving}
                type="button"
                onClick={(e) => onSave(e)}
              >
                {saving ? "Saving..." : "Save Vitals Only"}
              </button>

              {appointment?.doctorId &&
                appointment.doctorId !== "unassigned" && (
                  <button
                    className="h-9 w-full md:w-auto px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 transition-colors whitespace-nowrap"
                    disabled={saving}
                    type="button"
                    onClick={(e) => onSave(e, "doctor")}
                  >
                    Save & Send to Doctor
                  </button>
                )}
              {appointment?.assignedExpertId &&
                appointment.assignedExpertId !== "unassigned" && (
                  <button
                    className="h-9 w-full md:w-auto px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 transition-colors whitespace-nowrap"
                    disabled={saving}
                    type="button"
                    onClick={(e) => onSave(e, "expert")}
                  >
                    Save & Send to Expert
                  </button>
                )}
              {(!appointment?.doctorId ||
                appointment.doctorId === "unassigned") &&
                (!appointment?.assignedExpertId ||
                  appointment.assignedExpertId === "unassigned") && (
                  <button
                    className="h-9 w-full md:w-auto px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 transition-colors whitespace-nowrap"
                    disabled={saving}
                    type="button"
                    onClick={(e) => onSave(e, "doctor")}
                  >
                    Save & Send to Cabin
                  </button>
                )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    modalRoot,
  );
};
