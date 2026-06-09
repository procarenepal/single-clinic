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
        {filteredAppointments.map((appt) => {
          const patientName = getPatientName(appt.patientId);
          const doctorName = getDoctorName(appt);
          const apptType = getApptTypeLabel(appt.appointmentTypeId);
          const time = appt.startTime
            ? `${formatTimeTo12Hour(appt.startTime)}`
            : "Time not set";
          const stage = getPatientStage(appt);
          const action = getGuidedAction(appt);
          const hasDoctor = appt.doctorId && appt.doctorId !== "unassigned";
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
            <motion.div
              key={appt.id}
              layout
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-surface border border-border-base rounded hover:border-primary transition-colors relative"
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex items-start md:items-center flex-1 gap-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded bg-surface-2 border border-border-base text-text-muted flex items-center justify-center text-[12px] font-bold shrink-0">
                  {patientName.substring(0, 2).toUpperCase()}
                </div>

                {/* Patient / Encounter Details */}
                <div className="flex-1 flex flex-col gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 w-full">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Link
                          className="text-[13.5px] font-bold text-primary hover:underline leading-none"
                          to={`/dashboard/patients/${appt.patientId}`}
                        >
                          {patientName}
                        </Link>
                        {getStageBadge(stage, appt)}
                        {appt.cabinName && (
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1 whitespace-nowrap shrink-0">
                            🚪 {appt.cabinName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-[11.5px] text-text-muted leading-none flex items-center gap-2 mt-1">
                          Reg #{getPatientReg(appt.patientId)}
                          {(stage === "lobby" ||
                            stage === "triage" ||
                            stage === "doctor" ||
                            stage === "expert") && (
                            <WaitTimeIndicator startTime={appt.createdAt} />
                          )}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-text-main leading-none mb-1">
                        {doctorName}
                      </p>
                      <p className="text-[11.5px] text-text-muted">
                        {getDoctorSpeciality(appt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-text-main leading-none mb-1">
                        Today
                      </p>
                      <p className="text-[11.5px] text-text-muted">{time}</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-text-main leading-none mb-1">
                        {apptType}
                      </p>
                      <p className="text-[11.5px] text-text-muted truncate">
                        {appt.reason || appt.notes || "General consultation"}
                      </p>
                    </div>
                  </div>

                  {/* High-Fidelity Progression Pipeline stepper */}
                  <div className="border-t border-border-base/40 pt-2.5 flex items-center gap-1 md:gap-1.5 w-full max-w-2xl">
                    {(() => {
                      const hasDoctor =
                        appt.doctorId && appt.doctorId !== "unassigned";
                      const hasExpert =
                        appt.assignedExpertId &&
                        appt.assignedExpertId !== "unassigned";

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

                      steps.push("Billing Pending", "Pharmacy Queue");
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
                          } else if (step === "Billing Pending") {
                            stepColor =
                              "bg-saffron-500/10 text-saffron-600 border-saffron-500/20 ring-1 ring-saffron-500/10";
                          } else if (step === "Pharmacy Queue") {
                            stepColor =
                              "bg-purple-500/10 text-purple-600 border-purple-500/20 ring-1 ring-purple-500/10";
                          } else {
                            stepColor =
                              "bg-primary/10 text-primary border-primary/20 ring-1 ring-primary/10";
                          }
                        }

                        let stepLabel = step;

                        if (step === "Check-In" && appt.createdAt) {
                          let dObj = null;

                          if (appt.createdAt.seconds)
                            dObj = new Date(appt.createdAt.seconds * 1000);
                          else if (appt.createdAt instanceof Date)
                            dObj = appt.createdAt;
                          else if (typeof appt.createdAt === "string")
                            dObj = new Date(appt.createdAt);
                          else if (appt.createdAt.toDate)
                            dObj = appt.createdAt.toDate();

                          if (dObj && !isNaN(dObj.getTime())) {
                            stepLabel += ` (${dObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`;
                          }
                        }

                        return (
                          <React.Fragment key={step}>
                            <div
                              className={`flex-1 text-[9.5px] py-0.5 px-1 text-center font-bold rounded uppercase border tracking-wider transition-all duration-300 ${stepColor} truncate`}
                            >
                              {stepLabel}
                            </div>
                            {idx < steps.length - 1 && (
                              <span className="text-text-muted/30 text-[9px] font-bold shrink-0">
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

              {/* Guided Action Trigger Button */}
              <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0 ml-0 md:ml-4 self-end md:self-auto border-t md:border-t-0 border-border-base pt-3 md:pt-0 w-full md:w-auto justify-end">
                {stage === "lobby" && !isConsBillPending && (
                  <>
                    {(!appt.doctorId || appt.doctorId === "unassigned") &&
                      (!appt.assignedExpertId ||
                        appt.assignedExpertId === "unassigned") && (
                        <button
                          className="h-9 px-3 whitespace-nowrap rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                          type="button"
                          onClick={() => handleSendToDoctor(appt.id)}
                        >
                          Skip Triage & Send to Cabin
                        </button>
                      )}
                    {appt.doctorId && appt.doctorId !== "unassigned" && (
                      <button
                        className="h-9 px-3 whitespace-nowrap rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                        type="button"
                        onClick={() => handleSendToDoctor(appt.id)}
                      >
                        Skip Triage & Send to Doctor Cabin
                      </button>
                    )}
                    {appt.assignedExpertId &&
                      appt.assignedExpertId !== "unassigned" && (
                        <button
                          className="h-9 px-3 whitespace-nowrap rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                          type="button"
                          onClick={() => handleSendToExpert(appt.id)}
                        >
                          Skip Triage & Send to Expert Cabin
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
                          className="h-9 px-3 rounded text-[12.5px] font-medium border border-blue-500/50 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors outline-none flex items-center gap-1.5"
                          type="button"
                          onClick={() => handleOpenProcedure(appt)}
                        >
                          <IoCreateOutline className="w-4 h-4" />
                          Record Procedure
                        </button>
                        <button
                          className="h-9 px-3 rounded text-[12.5px] font-medium border border-amber-500/50 text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors outline-none flex items-center gap-1.5"
                          type="button"
                          onClick={() =>
                            navigate(
                              `/dashboard/prescriptions/new?appointmentId=${appt.id}`,
                            )
                          }
                        >
                          <IoDocumentTextOutline className="w-4 h-4" />
                          Write Prescription
                        </button>
                      </>
                    ) : (
                      <button
                        className="h-9 px-3 rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
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
                          className="h-9 px-3 rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
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
                    className="h-9 px-3 rounded text-[12.5px] font-medium border border-border-base text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors outline-none"
                    type="button"
                    onClick={() => handleCompleteCheckout(appt.id)}
                  >
                    Complete Checkout
                  </button>
                )}
                <button
                  className={`h-9 px-4 whitespace-nowrap rounded text-[12.5px] font-semibold flex items-center gap-1.5 transition-colors outline-none ${action.colorClass}`}
                  type="button"
                  onClick={action.onClick}
                >
                  {action.icon}
                  {action.label}
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
