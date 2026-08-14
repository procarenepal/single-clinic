import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IoPeopleOutline,
  IoDocumentTextOutline,
  IoTimeOutline,
  IoCreateOutline,
} from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";

import { Spinner } from "@/components/ui";

function formatTimeTo12Hour(timeStr: string) {
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";

  hour = hour % 12 || 12;

  return `${hour}:${m} ${ampm}`;
}

const WaitTimeIndicator = ({ startTime }: { startTime: any }) => {
  const [mins, setMins] = useState(0);

  useEffect(() => {
    const calc = () => {
      if (!startTime) return;
      let dObj = null;

      if (startTime.seconds) dObj = new Date(startTime.seconds * 1000);
      else if (startTime instanceof Date) dObj = startTime;
      else if (typeof startTime === "string") dObj = new Date(startTime);
      else if (startTime.toDate) dObj = startTime.toDate();

      if (dObj && !isNaN(dObj.getTime())) {
        const diff = Math.floor(
          (new Date().getTime() - dObj.getTime()) / 60000,
        );

        setMins(Math.max(0, diff));
      }
    };

    calc();
    const interval = setInterval(calc, 60000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (mins === 0) return null;

  let colorClass = "bg-green-500/10 text-green-600 border-green-500/20";

  if (mins > 15)
    colorClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
  if (mins > 30) colorClass = "bg-red-500/10 text-red-600 border-red-500/20";
  if (mins > 60)
    colorClass = "bg-red-500/20 text-red-700 border-red-500/40 animate-pulse";

  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 whitespace-nowrap shrink-0 ${colorClass}`}
      title={`Waiting for ${mins} minutes`}
    >
      <IoTimeOutline className="w-3 h-3" /> {mins}m
    </span>
  );
};

export interface QueueListProps {
  loading: boolean;
  filteredAppointments: any[];
  getPatientName: (patientId: string) => string;
  getDoctorName: (appt: any) => string;
  getApptTypeLabel: (id: string | undefined) => string;
  getPatientStage: (appt: any) => string;
  getGuidedAction: (appt: any) => {
    label: string;
    icon: React.ReactNode;
    colorClass: string;
    onClick: () => void;
  };
  billings: any[];
  getStageBadge: (stage: string, appt: any) => React.ReactNode;
  getPatientReg: (patientId: string) => string;
  getDoctorSpeciality: (appt: any) => string;
  currentDoctorId?: string | null;
  currentExpertId?: string | null;
  handleSendToDoctor: (id: string) => void;
  handleSendToExpert: (id: string) => void;
  handleCompleteConsultation: (id: string, toBilling?: boolean) => void;
  handleCompleteCheckout: (id: string) => void;
  handleOpenProcedure: (appt: any) => void;
}

export const QueueList: React.FC<QueueListProps> = ({
  loading,
  filteredAppointments,
  getPatientName,
  getDoctorName,
  getApptTypeLabel,
  getPatientStage,
  getGuidedAction,
  billings,
  getStageBadge,
  getPatientReg,
  getDoctorSpeciality,
  currentDoctorId,
  currentExpertId,
  handleSendToDoctor,
  handleSendToExpert,
  handleCompleteConsultation,
  handleCompleteCheckout,
  handleOpenProcedure,
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col justify-center items-center gap-3">
        <Spinner size="lg" />
        <p className="text-[13.5px] font-medium text-text-muted">
          Loading live waitlist queue...
        </p>
      </div>
    );
  }

  if (filteredAppointments.length === 0) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center">
        <IoPeopleOutline className="w-12 h-12 text-text-muted/20 mb-3" />
        <p className="text-[14.5px] font-medium text-text-main">
          No patients in this stage
        </p>
        <p className="text-[13px] text-text-muted mt-1">
          There are no active patient records matching this operational queue
          filter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {(() => {
          // Group by patientId
          const grouped: Record<string, any[]> = {};
          filteredAppointments.forEach(appt => {
            if (!grouped[appt.patientId]) {
              grouped[appt.patientId] = [];
            }
            grouped[appt.patientId].push(appt);
          });

          return Object.entries(grouped).map(([patientId, appts]) => {
            const patientName = getPatientName(patientId);
            const regNo = getPatientReg(patientId);

            return (
              <motion.div
                key={`group_${patientId}`}
                layout
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="bg-surface border border-border-base rounded flex flex-col mb-4 overflow-hidden shadow-sm"
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {/* Patient Header (Visit Level) */}
                <div className="bg-surface-2/50 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between border-b border-border-base/50 gap-4">
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="w-10 h-10 rounded bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[13px] font-bold shrink-0">
                      {patientName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          className="text-[14px] font-bold text-primary hover:underline leading-none"
                          to={`/dashboard/patients/${patientId}`}
                        >
                          {patientName}
                        </Link>
                        {getStageBadge(getPatientStage(appts[0]), appts[0])}
                        {(getPatientStage(appts[0]) === "lobby" ||
                          getPatientStage(appts[0]) === "triage" ||
                          getPatientStage(appts[0]) === "doctor" ||
                          getPatientStage(appts[0]) === "expert") && (
                            <WaitTimeIndicator startTime={appts[0].createdAt} />
                          )}
                      </div>
                      <p className="text-[11.5px] text-text-muted leading-none mt-1">
                        Reg #{regNo}
                      </p>
                    </div>
                  </div>

                  {/* High-Fidelity Progression Pipeline stepper & Visit Actions (Elevated to Header) */}
                  <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                    {(() => {
                      const lobbyAppts = appts.filter(a => getPatientStage(a) === "lobby");
                      const firstLobbyAppt = lobbyAppts.find(a => a.doctorId && a.doctorId !== "unassigned") || lobbyAppts[0];
                      const scheduledAppts = appts.filter(a => getPatientStage(a) === "scheduled");
                      const firstScheduledAppt = scheduledAppts.find(a => a.doctorId && a.doctorId !== "unassigned") || scheduledAppts[0];
                      
                      let visitActionNode = null;
                      
                      if (firstLobbyAppt) {
                        const visitAction = getGuidedAction(firstLobbyAppt);
                        if (visitAction.label === "Record Triage Vitals" || visitAction.label === "Settle Consultation Bill") {
                          visitActionNode = (
                            <button
                              className={`h-8 px-3 whitespace-nowrap rounded text-[11.5px] font-semibold flex items-center gap-1.5 transition-colors outline-none shadow-sm ${visitAction.colorClass}`}
                              type="button"
                              onClick={visitAction.onClick}
                            >
                              {visitAction.icon}
                              {visitAction.label}
                            </button>
                          );
                        }
                      } else if (firstScheduledAppt) {
                        const visitAction = getGuidedAction(firstScheduledAppt);
                        if (visitAction.label === "Check-In Patient" || visitAction.label === "Settle Consultation Bill") {
                          visitActionNode = (
                            <button
                              className={`h-8 px-3 whitespace-nowrap rounded text-[11.5px] font-semibold flex items-center gap-1.5 transition-colors outline-none shadow-sm ${visitAction.colorClass}`}
                              type="button"
                              onClick={visitAction.onClick}
                            >
                              {visitAction.icon}
                              {visitAction.label}
                            </button>
                          );
                        }
                      }

                      return visitActionNode;
                    })()}

                    <div className="flex items-center gap-1 md:gap-1.5 bg-surface px-3 py-1.5 rounded border border-border-base/40">
                    {(() => {
                      // We build the pipeline based on the aggregate needs of all sub-appointments
                      const stage = getPatientStage(appts[0]); // Reference stage from first appt
                      const hasDoctor = appts.some(
                        (a) => a.doctorId && a.doctorId !== "unassigned",
                      );
                      const hasExpert = appts.some(
                        (a) =>
                          a.assignedExpertId &&
                          a.assignedExpertId !== "unassigned",
                      );

                      const steps: string[] = [
                        "Check-In",
                        "Lobby Wait",
                        "Triage Done",
                      ];
                      const stepStages: string[] = [
                        "scheduled",
                        "lobby",
                        "triage-done",
                      ];

                      if (hasDoctor) {
                        steps.push("Doctor Cabin");
                        stepStages.push("doctor");
                      }
                      if (hasExpert) {
                        steps.push("Expert Cabin");
                        stepStages.push("expert");
                      }

                      steps.push("Billing", "Pharmacy");
                      stepStages.push("billing", "pharmacy");

                      const currentStageIdx = stepStages.indexOf(stage);

                      return steps.map((step, idx) => {
                        const isCompleted =
                          stage === "completed" ||
                          (currentStageIdx > idx && currentStageIdx !== -1);
                        const isActive = currentStageIdx === idx;

                        let stepColor =
                          "bg-surface-3 text-text-muted/40 border-transparent";

                        if (isCompleted) {
                          stepColor =
                            "bg-green-500/10 text-green-600 border-green-500/20";
                        } else if (isActive) {
                          if (step === "Lobby Wait") {
                            stepColor =
                              "bg-teal-500/10 text-teal-600 border-teal-500/20 ring-1 ring-teal-500/10";
                          } else if (step === "Triage Done") {
                            stepColor =
                              "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 ring-1 ring-indigo-500/10";
                          } else if (
                            step === "Doctor Cabin" ||
                            step === "Expert Cabin"
                          ) {
                            stepColor =
                              "bg-amber-500/10 text-amber-600 border-amber-500/20 ring-1 ring-amber-500/10";
                          } else if (step === "Billing") {
                            stepColor =
                              "bg-saffron-500/10 text-saffron-600 border-saffron-500/20 ring-1 ring-saffron-500/10";
                          } else if (step === "Pharmacy") {
                            stepColor =
                              "bg-purple-500/10 text-purple-600 border-purple-500/20 ring-1 ring-purple-500/10";
                          } else {
                            stepColor =
                              "bg-primary/10 text-primary border-primary/20 ring-1 ring-primary/10";
                          }
                        }

                        return (
                          <React.Fragment key={step}>
                            <div
                              className={`flex-1 text-[9px] py-[3px] px-1 text-center font-bold rounded uppercase border tracking-wider transition-all duration-300 ${stepColor}`}
                            >
                              {step}
                            </div>
                            {idx < steps.length - 1 && (
                              <span className="text-text-muted/30 text-[8px] font-bold shrink-0">
                                &rarr;
                              </span>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Patient Sub-Appointments (Streamlined) */}
              <div className="flex flex-col divide-y divide-border-base/40 bg-surface/50">
                  {appts.map((appt) => {
                    const doctorName = getDoctorName(appt);
                    const apptType = getApptTypeLabel(appt.appointmentTypeId);
                    const time = appt.startTime
                      ? `${formatTimeTo12Hour(appt.startTime)}`
                      : "Time not set";
                    const stage = getPatientStage(appt);
                    const action = getGuidedAction(appt);
                    const pendingBillId =
                      appt.billingId || (appt as any).consultationBillingId;
                    const consBill = pendingBillId
                      ? billings.find((b) => b.id === pendingBillId)
                      : null;
                    const isConsBillPaid = consBill
                      ? consBill.status === "paid" || consBill.paymentStatus === "paid"
                      : false;
                    const isConsBillPending = consBill && !isConsBillPaid;

                    return (
                      <div key={appt.id} className="p-3 pl-4 md:pl-16 hover:bg-surface-2/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Streamlined Encounter Details */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 w-full items-center">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[13px] font-medium text-text-main leading-none">
                                {doctorName}
                              </p>
                              {appt.cabinName && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                                  🚪 {appt.cabinName}
                                </span>
                              )}
                            </div>
                            <p className="text-[11.5px] text-text-muted">
                              {getDoctorSpeciality(appt)}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-[12px] font-medium text-text-main leading-none mb-1">
                              {apptType}
                            </p>
                            <p className="text-[11px] text-text-muted truncate max-w-[200px]" title={appt.reason || appt.notes || "General consultation"}>
                              {appt.reason || appt.notes || "General consultation"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[12px] font-medium text-text-main leading-none mb-1">
                              Today
                            </p>
                            <p className="text-[11px] text-text-muted flex items-center gap-1">
                              <IoTimeOutline className="w-3 h-3" /> {time}
                            </p>
                          </div>
                        </div>

                        {/* Guided Action Trigger Buttons for Sub-Row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0 w-full md:w-auto justify-end shrink-0">
                          {stage === "lobby" && !isConsBillPending && (
                            <>
                              {(!appt.doctorId || appt.doctorId === "unassigned") &&
                                (!appt.assignedExpertId ||
                                  appt.assignedExpertId === "unassigned") && (
                                  <button
                                    className="h-8 px-2.5 whitespace-nowrap rounded text-[11.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                                    type="button"
                                    onClick={() => handleSendToDoctor(appt.id)}
                                  >
                                    Send to Cabin
                                  </button>
                                )}
                              {appt.doctorId && appt.doctorId !== "unassigned" && (
                                <button
                                  className="h-8 px-2.5 whitespace-nowrap rounded text-[11.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                                  type="button"
                                  onClick={() => handleSendToDoctor(appt.id)}
                                >
                                  Send to Doctor Cabin
                                </button>
                              )}
                              {appt.assignedExpertId &&
                                appt.assignedExpertId !== "unassigned" && (
                                  <button
                                    className="h-8 px-2.5 whitespace-nowrap rounded text-[11.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                                    type="button"
                                    onClick={() => handleSendToExpert(appt.id)}
                                  >
                                    Send to Expert Cabin
                                  </button>
                                )}
                            </>
                          )}
                          {((stage === "doctor" &&
                            (!currentExpertId || currentDoctorId)) ||
                            (stage === "expert" &&
                              (!currentDoctorId || currentExpertId))) && (
                              <>
                                {stage === "doctor" ? (
                                  <>
                                    <button
                                      className="h-8 px-2.5 rounded text-[11.5px] font-medium border border-blue-500/50 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors outline-none flex items-center gap-1.5"
                                      type="button"
                                      onClick={() => handleOpenProcedure(appt)}
                                    >
                                      <IoCreateOutline className="w-3.5 h-3.5" />
                                      Record Proc
                                    </button>
                                    <button
                                      className="h-8 px-2.5 rounded text-[11.5px] font-medium border border-amber-500/50 text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors outline-none flex items-center gap-1.5"
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/dashboard/prescriptions/new?appointmentId=${appt.id}`,
                                        )
                                      }
                                    >
                                      <IoDocumentTextOutline className="w-3.5 h-3.5" />
                                      Prescription
                                    </button>
                                    <button
                                      className="h-8 px-2.5 rounded text-[11.5px] font-medium border border-purple-500/50 text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-colors outline-none flex items-center gap-1.5"
                                      type="button"
                                      onClick={() => handleSendToExpert(appt.id)}
                                    >
                                      <IoPeopleOutline className="w-3.5 h-3.5" />
                                      Route
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="h-8 px-2.5 rounded text-[11.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                                    type="button"
                                    onClick={() => handleCompleteConsultation(appt.id)}
                                  >
                                    Complete (No Log)
                                  </button>
                                )}
                                {stage === "doctor" &&
                                  appt.assignedExpertId &&
                                  appt.assignedExpertId !== "unassigned" && (
                                    <button
                                      className="h-8 px-2.5 rounded text-[11.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                                      type="button"
                                      onClick={() =>
                                        handleCompleteConsultation(appt.id, true)
                                      }
                                    >
                                      Send to Billing
                                    </button>
                                  )}
                              </>
                            )}
                          {stage === "billing" && (
                            <button
                              className="h-8 px-2.5 rounded text-[11.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                              type="button"
                              onClick={() => handleCompleteCheckout(appt.id)}
                            >
                              Complete Checkout
                            </button>
                          )}
                          
                          {/* Render sub-row action if it's not a global visit-level action */}
                          {(() => {
                            const isVisitLevelAction = action.label === "Record Triage Vitals" || action.label === "Check-In Patient" || action.label === "Settle Consultation Bill";
                            if (!isVisitLevelAction) {
                              return (
                                <button
                                  className={`h-8 px-3 whitespace-nowrap rounded text-[11.5px] font-semibold flex items-center gap-1.5 transition-colors outline-none ${action.colorClass}`}
                                  type="button"
                                  onClick={action.onClick}
                                >
                                  {action.icon}
                                  {action.label}
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          });
        })()}
      </AnimatePresence>
    </div>
  );
};
