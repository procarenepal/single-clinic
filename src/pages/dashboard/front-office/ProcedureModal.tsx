import React from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline, IoReceiptOutline } from "react-icons/io5";

import { Checkbox } from "@/components/ui";

export interface ProcedureState {
  procedureType: string;
  energy: string;
  spotSize: string;
  pulseWidth: string;
  passes: string;
  area: string;
  fee: string;
  notes: string;
}

interface ProcedureModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  patientName: string;
  procedure: ProcedureState;
  setProcedure: React.Dispatch<React.SetStateAction<ProcedureState>>;
  appointmentTypes: any[];
  modalActivePackages: any[];
  procedureSaving: boolean;
  onSave: (e: React.MouseEvent, target: "doctor" | "billing" | "expert") => void;
  loadingHistory: boolean;
  historicalProcedures: any[];
  getApptTypeLabel: (id: string | undefined) => string;
  isDoctorCabin?: boolean;
  hasExpert?: boolean;
}

export const ProcedureModal: React.FC<ProcedureModalProps> = ({
  isOpen,
  onClose,
  appointment,
  patientName,
  procedure,
  setProcedure,
  appointmentTypes,
  modalActivePackages,
  procedureSaving,
  onSave,
  loadingHistory,
  historicalProcedures,
  getApptTypeLabel,
  isDoctorCabin,
  hasExpert,
}) => {
  if (!isOpen || !appointment) return null;

  const modalRoot = document.body;

  const getBookedApptTypeOption = () => {
    const label = getApptTypeLabel(appointment.appointmentTypeId);

    if (appointment.appointmentTypeId === "package-session") {
      return null;
    }
    const isDynamicPresent = appointmentTypes.some((t) => t.name === label);

    if (!isDynamicPresent) {
      return label;
    }

    return null;
  };

  const handleToggleProcedure = (val: string) => {
    const currentList = procedure.procedureType
      .split(", ")
      .filter((x) => x !== "");
    const isSelected = currentList.includes(val);
    let newList: string[];

    if (isSelected) {
      newList = currentList.filter((x) => x !== val);
    } else {
      newList = [...currentList, val];
    }

    const newTypeStr = newList.join(", ");

    // Recalculate fee
    let totalFee = 0;

    newList.forEach((item) => {
      if (item.startsWith("consume_pkg_")) {
        // package consumption has 0 fee
      } else {
        const matchingType = appointmentTypes.find((t) => t.name === item);

        if (matchingType) {
          let wasAlreadyBilled = false;

          // Check if this was the booked appointment type AND if it was billed at front desk
          if (appointment.appointmentTypeId === matchingType.id) {
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
            totalFee += Number(matchingType.price || 0);
          }
        }
      }
    });

    setProcedure((p) => ({
      ...p,
      procedureType: newTypeStr,
      fee: String(totalFee),
    }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="bg-surface rounded border border-border-base shadow-xl max-w-5xl w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[14.5px] text-text-main flex items-center gap-1.5">
              ⚡ Record Laser & Aesthetic Procedure Log
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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 overflow-hidden flex-1">
          {/* Left side: Log Form */}
          <form
            className="col-span-3 flex flex-col justify-between border-r border-border-base max-h-[75vh]"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                {/* Procedure Type */}
                <div className="col-span-2">
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex justify-between">
                    <span>Procedure Type (Select Multiple)</span>
                    {procedure.procedureType && (
                      <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {
                          procedure.procedureType
                            .split(", ")
                            .filter((x) => x !== "").length
                        }{" "}
                        selected
                      </span>
                    )}
                  </label>
                  <div className="w-full max-h-[140px] overflow-y-auto p-2 border rounded outline-none border-border-base bg-surface flex flex-col gap-2">
                    {modalActivePackages.map((pkg) => {
                      const val = `consume_pkg_${pkg.id}`;
                      const isChecked = procedure.procedureType
                        .split(", ")
                        .includes(val);

                      return (
                        <Checkbox
                          key={val}
                          isSelected={isChecked}
                          onValueChange={() => handleToggleProcedure(val)}
                        >
                          <span className="text-[12.5px] text-text-main">
                            Consume Session: {pkg.packageName} (
                            {pkg.usedSessions}/{pkg.totalSessions} used)
                          </span>
                        </Checkbox>
                      );
                    })}
                    {appointmentTypes.map((type) => {
                      const isChecked = procedure.procedureType
                        .split(", ")
                        .includes(type.name);

                      return (
                        <Checkbox
                          key={type.id}
                          isSelected={isChecked}
                          onValueChange={() => handleToggleProcedure(type.name)}
                        >
                          <span className="text-[12.5px] text-text-main">
                            {type.name}
                          </span>
                        </Checkbox>
                      );
                    })}
                    {(() => {
                      const label = getBookedApptTypeOption();

                      if (label) {
                        const isChecked = procedure.procedureType
                          .split(", ")
                          .includes(label);

                        return (
                          <Checkbox
                            isSelected={isChecked}
                            onValueChange={() => handleToggleProcedure(label)}
                          >
                            <span className="text-[12.5px] text-text-main">
                              {label} (Booked)
                            </span>
                          </Checkbox>
                        );
                      }

                      return null;
                    })()}
                    <Checkbox
                      isSelected={procedure.procedureType
                        .split(", ")
                        .includes("Other")}
                      onValueChange={() => handleToggleProcedure("Other")}
                    >
                      <span className="text-[12.5px] text-text-main">
                        Other
                      </span>
                    </Checkbox>
                  </div>
                </div>

                {/* Treated Area */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                    Treated Area
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                    placeholder="e.g. Full Face, Cheeks"
                    type="text"
                    value={procedure.area}
                    onChange={(e) =>
                      setProcedure((p) => ({ ...p, area: e.target.value }))
                    }
                  />
                </div>

                {/* Procedure Cost/Fee */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5 flex items-center gap-1">
                    Additional Procedure Fee (NPR){" "}
                    <span className="text-[10px] font-normal text-text-muted">
                      (Optional)
                    </span>
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                    placeholder="Leave blank if already billed"
                    type="number"
                    value={procedure.fee}
                    onChange={(e) =>
                      setProcedure((p) => ({ ...p, fee: e.target.value }))
                    }
                  />
                </div>

                {/* Energy (Fluence) */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                    Energy / Fluence (J/cm²)
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                    placeholder="e.g. 15"
                    type="text"
                    value={procedure.energy}
                    onChange={(e) =>
                      setProcedure((p) => ({ ...p, energy: e.target.value }))
                    }
                  />
                </div>

                {/* Spot Size */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                    Spot Size (mm)
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                    placeholder="e.g. 4"
                    type="text"
                    value={procedure.spotSize}
                    onChange={(e) =>
                      setProcedure((p) => ({ ...p, spotSize: e.target.value }))
                    }
                  />
                </div>

                {/* Pulse Width */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                    Pulse Width (ms)
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                    placeholder="e.g. 10"
                    type="text"
                    value={procedure.pulseWidth}
                    onChange={(e) =>
                      setProcedure((p) => ({
                        ...p,
                        pulseWidth: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Passes */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                    Passes (Count)
                  </label>
                  <input
                    className="w-full h-9 px-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main"
                    placeholder="e.g. 2"
                    type="text"
                    value={procedure.passes}
                    onChange={(e) =>
                      setProcedure((p) => ({ ...p, passes: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                  Clinical Procedure Notes
                </label>
                <textarea
                  className="w-full min-h-[80px] p-3 text-[13px] border rounded outline-none transition-colors border-border-base focus:border-primary bg-surface text-text-main resize-none"
                  placeholder="Enter skin reaction details, patient tolerance, or post-procedure cream recommendations..."
                  value={procedure.notes}
                  onChange={(e) =>
                    setProcedure((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border-base bg-surface-2 flex flex-wrap justify-end gap-2.5">
              <button
                className="h-9 px-4 rounded text-[13px] font-semibold border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                type="button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="h-9 px-4 rounded text-[13px] font-semibold bg-mountain-600 text-white hover:bg-mountain-700 transition-colors outline-none disabled:opacity-50"
                disabled={procedureSaving}
                type="button"
                onClick={(e) => onSave(e, "doctor")}
              >
                {procedureSaving ? "Saving..." : isDoctorCabin ? "Save Procedure" : "Save & Send to Doctor"}
              </button>
              {isDoctorCabin && hasExpert && (
                <button
                  className="h-9 px-4 rounded text-[13px] font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors outline-none disabled:opacity-50"
                  disabled={procedureSaving}
                  type="button"
                  onClick={(e) => onSave(e, "expert")}
                >
                  {procedureSaving ? "Saving..." : "Save & Send to Expert"}
                </button>
              )}
              <button
                className="h-9 px-4 rounded text-[13px] font-semibold bg-primary text-white hover:bg-primary/95 transition-colors outline-none disabled:opacity-50"
                disabled={procedureSaving}
                type="button"
                onClick={(e) => onSave(e, "billing")}
              >
                {procedureSaving ? "Saving..." : "Save & Send to Billing"}
              </button>
            </div>
          </form>

          {/* Right side: Patient History */}
          <div className="col-span-2 bg-surface-2 p-5 flex flex-col max-h-[75vh] overflow-hidden">
            <h4 className="font-bold text-[13px] text-text-main mb-3 flex items-center gap-1.5 border-b border-border-base pb-2">
              📋 Past Treatment Records ({historicalProcedures.length})
            </h4>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingHistory ? (
                <div className="h-full flex items-center justify-center py-10">
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                </div>
              ) : historicalProcedures.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 text-center text-text-muted">
                  <IoReceiptOutline className="w-8 h-8 opacity-40 mb-1.5 text-text-muted" />
                  <p className="text-[12px]">
                    No past procedures recorded for this patient.
                  </p>
                </div>
              ) : (
                historicalProcedures.map((entry) => {
                  const lines = entry.content.split("\n");
                  let procType = "";
                  let area = "";
                  let settings = "";
                  let notes = "";
                  let fee = "";
                  let writtenBy = "";

                  lines.forEach((line: string) => {
                    if (line.startsWith("Procedure:"))
                      procType = line.replace("Procedure:", "").trim();
                    else if (line.startsWith("Area:"))
                      area = line.replace("Area:", "").trim();
                    else if (line.startsWith("Laser Settings:"))
                      settings = line.replace("Laser Settings:", "").trim();
                    else if (line.startsWith("Clinical Notes:"))
                      notes = line.replace("Clinical Notes:", "").trim();
                    else if (line.startsWith("Charge:"))
                      fee = line.replace("Charge:", "").trim();
                    else if (line.startsWith("Written By:"))
                      writtenBy = line.replace("Written By:", "").trim();
                  });

                  return (
                    <div
                      key={entry.id}
                      className="p-3 bg-surface border border-border-base rounded-md text-[12px] space-y-1.5 shadow-sm hover:border-border-muted transition-colors"
                    >
                      <div className="flex justify-between items-center border-b border-border-base pb-1">
                        <span className="font-semibold text-primary">
                          {procType || "Laser Procedure"}
                        </span>
                        <div className="flex items-center gap-2">
                          {writtenBy && (
                            <span className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded text-text-muted font-medium">
                              By: {writtenBy}
                            </span>
                          )}
                          <span className="text-[10px] text-text-muted">
                            {entry.createdAt
                              ? new Date(entry.createdAt).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                      </div>
                      {area && (
                        <p className="text-text-main text-[11.5px]">
                          <span className="font-medium text-text-muted">
                            Area:
                          </span>{" "}
                          {area}
                        </p>
                      )}
                      {settings && (
                        <div className="bg-surface-2 p-1.5 rounded text-[10.5px] font-mono text-text-main border border-border-base leading-relaxed">
                          {settings}
                        </div>
                      )}
                      {notes && notes !== "None" && (
                        <p className="text-text-main italic text-[11px] bg-amber-50/20 p-1.5 rounded border border-amber-100/10 leading-snug">
                          "{notes}"
                        </p>
                      )}
                      {fee && (
                        <p className="text-[10px] text-text-muted text-right">
                          {fee}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    modalRoot,
  );
};
