import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { format, isToday } from "date-fns";
import {
  IoCalendarOutline,
  IoPersonOutline,
  IoReceiptOutline,
  IoChevronForwardOutline,
  IoPulseOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoEyeOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { expertService } from "@/services/expertService";
import { patientService } from "@/services/patientService";
import { appointmentService } from "@/services/appointmentService";
import { prescriptionService } from "@/services/prescriptionService";
import { PageSkeleton } from "@/components/ui";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 120, damping: 18 },
  },
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  "in-progress": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
};

function StatMini({
  label,
  value,
  icon,
  color,
  href,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  href: string;
  sub?: string;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Link className="block group no-underline" to={href}>
        <div className="bg-surface border border-border-base rounded-[12px] p-4 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden flex items-center gap-4">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/3 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div
            className={`relative z-10 w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color} shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/5 group-hover:scale-105 transition-transform duration-300`}
          >
            {React.cloneElement(icon as React.ReactElement, {
              className: "w-5 h-5",
            })}
          </div>
          <div className="relative z-10 flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {label}
            </p>
            <p className="text-[22px] font-black text-text-main leading-tight">
              {value}
            </p>
            {sub && (
              <p className="text-[10px] text-text-muted font-medium mt-0.5">
                {sub}
              </p>
            )}
          </div>
          <IoChevronForwardOutline className="relative z-10 w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
        </div>
      </Link>
    </motion.div>
  );
}

export default function ExpertDashboard() {
  const navigate = useNavigate();
  const { clinicId, currentUser, userData } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [expertId, setexpertId] = useState<string | null>(null);
  const [expertName, setexpertName] = useState<string>("");
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName =
    expertName ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "Expert";

  useEffect(() => {
    if (!clinicId || !currentUser?.email) return;

    (async () => {
      try {
        setLoading(true);
        const doc = await expertService.getExpertByEmail(currentUser.email!);

        if (!doc) return;

        setexpertId(doc.id);
        setexpertName(doc.name || "");

        const [pts, appts, rxs] = await Promise.all([
          patientService.getPatientsByExpert(doc.id, clinicId),
          appointmentService.getAppointmentsByClinic(clinicId),
          prescriptionService.getPrescriptionsByClinic(clinicId),
        ]);

        setPatients(pts);
        setAppointments(
          appts.filter((a: any) => a.assignedExpertId === doc.id),
        );
        setPrescriptions(
          (rxs as any[])
            .filter(
              (rx: any) =>
                rx.assignedExpertId === doc.id ||
                pts.some((p: any) => p.id === rx.patientId),
            )
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .slice(0, 5),
        );
      } catch (err) {
        console.error("ExpertDashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [clinicId, currentUser?.email]);

  if (loading)
    return (
      <div className="p-2">
        <PageSkeleton />
      </div>
    );

  const todayAppts = appointments.filter((a) =>
    isToday(new Date(a.appointmentDate)),
  );
  const pendingAppts = appointments.filter((a) =>
    ["scheduled", "confirmed", "in-progress"].includes(a.status),
  );
  const criticalPts = patients.filter((p) => p.isCritical);
  const upcomingAppts = appointments
    .filter((a) => ["scheduled", "confirmed"].includes(a.status))
    .sort(
      (a, b) =>
        new Date(a.appointmentDate).getTime() -
        new Date(b.appointmentDate).getTime(),
    )
    .slice(0, 6);

  return (
    <motion.div
      animate="visible"
      className="w-full flex flex-col gap-4 pb-10"
      initial="hidden"
      variants={containerVariants}
    >
      {/* Welcome Banner */}
      <motion.div
        className="relative overflow-hidden rounded-[10px] bg-surface border border-border-base p-3 shadow-sm mb-1"
        variants={itemVariants}
      >
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                On Duty
              </span>
            </div>
            <h2 className="text-[14px] font-black text-text-main leading-tight tracking-tight">
              {greeting},{" "}
              <span className="text-primary">Dr. {displayName}!</span> 👋
            </h2>
            <p className="text-[12px] text-text-muted mt-1 font-semibold max-w-[480px] leading-tight">
              You have{" "}
              <span className="text-text-main font-bold">
                {todayAppts.length} appointments
              </span>{" "}
              scheduled today
              {criticalPts.length > 0 && (
                <>
                  {" "}
                  and{" "}
                  <span className="text-red-500 font-bold">
                    {criticalPts.length} critical patient
                    {criticalPts.length > 1 ? "s" : ""}
                  </span>{" "}
                  requiring attention
                </>
              )}
              .
            </p>
          </div>

          <div className="flex items-center gap-3">
            {[
              { label: "Appointments", value: todayAppts.length },
              { label: "Pending", value: pendingAppts.length },
              { label: "Patients", value: patients.length },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center px-3.5 py-1.5 bg-surface-2 rounded-lg border border-border-base/50"
              >
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                  {s.label}
                </p>
                <p className="text-[16px] font-bold text-primary leading-tight">
                  {s.value}
                </p>
              </div>
            ))}
            <div className="h-8 w-[1px] bg-border-base hidden sm:block mx-1.5" />
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-[11.5px] font-bold text-text-main">
                {format(new Date(), "h:mm a")}
              </p>
              <p className="text-[9px] text-text-muted font-bold uppercase tracking-tighter">
                {format(new Date(), "EEEE, MMM d")}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatMini
          color="bg-blue-500/10 text-blue-600"
          href="/dashboard/appointments"
          icon={<IoCalendarOutline />}
          label="Today's Appts"
          sub="Scheduled today"
          value={todayAppts.length}
        />
        <StatMini
          color="bg-primary/10 text-primary"
          href="/dashboard/patients"
          icon={<IoPersonOutline />}
          label="My Patients"
          sub="Assigned to you"
          value={patients.length}
        />
        <StatMini
          color="bg-red-500/10 text-red-500"
          href="/dashboard/patients"
          icon={<IoAlertCircleOutline />}
          label="Critical"
          sub="Needs attention"
          value={criticalPts.length}
        />
        <StatMini
          color="bg-purple-500/10 text-purple-600"
          href="/dashboard/prescriptions"
          icon={<IoReceiptOutline />}
          label="Prescriptions"
          sub="Issued by you"
          value={prescriptions.length}
        />
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2 px-0.5">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            {
              label: "New Appointment",
              sub: "Schedule a visit",
              icon: <IoCalendarOutline />,
              href: "/dashboard/appointments",
              bg: "bg-blue-500/10",
              color: "text-blue-600",
              iconBg: "bg-blue-500",
            },
            {
              label: "New Prescription",
              sub: "Issue medication",
              icon: <IoReceiptOutline />,
              href: "/dashboard/prescriptions/new",
              bg: "bg-purple-500/10",
              color: "text-purple-600",
              iconBg: "bg-purple-500",
            },
            {
              label: "View Patients",
              sub: "My patient list",
              icon: <IoPersonOutline />,
              href: "/dashboard/patients",
              bg: "bg-emerald-500/10",
              color: "text-emerald-600",
              iconBg: "bg-emerald-500",
            },
            {
              label: "Expert Cabin",
              sub: "Live queue",
              icon: <IoPulseOutline />,
              href: "/dashboard/front-office",
              bg: "bg-primary/10",
              color: "text-primary",
              iconBg: "bg-primary",
            },
          ].map((a, i) => (
            <Link key={i} className="block group no-underline" to={a.href}>
              <div
                className={`relative overflow-hidden rounded-[12px] border border-border-base bg-surface p-3.5 flex items-center gap-3 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300`}
              >
                <div
                  className={`absolute inset-0 ${a.bg} opacity-0 group-hover:opacity-60 transition-opacity duration-500`}
                />
                <div
                  className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center ${a.iconBg} text-white shadow-md group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500`}
                >
                  {React.cloneElement(a.icon as React.ReactElement, {
                    className: "w-4.5 h-4.5",
                  })}
                </div>
                <div className="relative z-10">
                  <p className={`text-[12px] font-bold ${a.color}`}>
                    {a.label}
                  </p>
                  <p className="text-[10px] text-text-muted font-medium">
                    {a.sub}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Main Content: Upcoming Appointments + Recent Prescriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming Appointments */}
        <motion.div
          className="lg:col-span-2 bg-surface border border-border-base rounded-[14px] overflow-hidden shadow-sm flex flex-col"
          variants={itemVariants}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-base">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <IoCalendarOutline className="w-4 h-4" />
              </div>
              <p className="text-[13px] font-bold text-text-main">
                Upcoming Appointments
              </p>
            </div>
            <Link
              className="text-[11px] text-primary hover:text-primary/70 font-semibold flex items-center gap-0.5 no-underline transition-colors"
              to="/dashboard/appointments"
            >
              View all <IoChevronForwardOutline className="w-3 h-3" />
            </Link>
          </div>

          {upcomingAppts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-14 opacity-40">
              <IoCalendarOutline className="w-10 h-10 mb-2 text-text-muted" />
              <p className="text-[13px] font-semibold text-text-muted">
                No upcoming appointments
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-base/60">
              {upcomingAppts.map((appt) => {
                const pat = patients.find((p) => p.id === appt.patientId);
                const statusCls =
                  STATUS_COLORS[appt.status] ?? "bg-surface-2 text-text-muted";
                const apptDate = new Date(appt.appointmentDate);
                const isTodayAppt = isToday(apptDate);

                return (
                  <div
                    key={appt.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2/40 transition-colors cursor-pointer group"
                    onClick={() => navigate("/dashboard/appointments")}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[13px] font-black shrink-0">
                      {pat?.name?.[0]?.toUpperCase() ?? "P"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-text-main truncate">
                        {pat?.name ?? "—"}
                      </p>
                      <p className="text-[11px] text-text-muted font-medium">
                        {isTodayAppt ? "Today" : format(apptDate, "MMM d")}
                        {appt.appointmentTime
                          ? ` · ${appt.appointmentTime}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCls}`}
                    >
                      {appt.status.replace("-", " ")}
                    </span>
                    <IoChevronForwardOutline className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Sidebar: Recent Prescriptions + Critical Patients */}
        <div className="flex flex-col gap-4">
          {/* Recent Prescriptions */}
          <motion.div
            className="bg-surface border border-border-base rounded-[14px] overflow-hidden shadow-sm"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-base">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <IoReceiptOutline className="w-3.5 h-3.5" />
                </div>
                <p className="text-[12.5px] font-bold text-text-main">
                  Recent Prescriptions
                </p>
              </div>
              <Link
                className="text-[10px] text-primary font-semibold no-underline hover:underline"
                to="/dashboard/prescriptions"
              >
                View all
              </Link>
            </div>
            {prescriptions.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center opacity-40">
                <IoReceiptOutline className="w-8 h-8 mb-1 text-text-muted" />
                <p className="text-[11px] text-text-muted">
                  No prescriptions yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-base/50">
                {prescriptions.map((rx) => {
                  const pat = patients.find((p) => p.id === rx.patientId);

                  return (
                    <div
                      key={rx.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors cursor-pointer"
                      onClick={() => navigate("/dashboard/prescriptions")}
                    >
                      <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0 text-[11px] font-black">
                        {pat?.name?.[0]?.toUpperCase() ?? "P"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-text-main truncate">
                          {pat?.name ?? "Patient"}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          #{rx.prescriptionNo}
                        </p>
                      </div>
                      <p className="text-[9.5px] text-text-muted shrink-0">
                        {rx.createdAt
                          ? format(new Date(rx.createdAt), "MMM d")
                          : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Critical Patients */}
          <motion.div
            className="bg-surface border border-border-base rounded-[14px] overflow-hidden shadow-sm"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-base">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                  <IoAlertCircleOutline className="w-3.5 h-3.5" />
                </div>
                <p className="text-[12.5px] font-bold text-text-main">
                  Critical Patients
                </p>
              </div>
              <Link
                className="text-[10px] text-primary font-semibold no-underline hover:underline"
                to="/dashboard/patients"
              >
                View all
              </Link>
            </div>
            {criticalPts.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center opacity-40">
                <IoCheckmarkCircleOutline className="w-8 h-8 mb-1 text-green-500" />
                <p className="text-[11px] text-text-muted">All clear</p>
              </div>
            ) : (
              <div className="divide-y divide-border-base/50">
                {criticalPts.slice(0, 4).map((pt) => (
                  <div
                    key={pt.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-red-500/5 transition-colors cursor-pointer"
                    onClick={() => navigate("/dashboard/patients")}
                  >
                    <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 text-[11px] font-black">
                      {pt.name?.[0]?.toUpperCase() ?? "P"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-text-main truncate">
                        {pt.name}
                      </p>
                      <p className="text-[10px] text-red-500 font-medium">
                        Critical
                      </p>
                    </div>
                    <IoEyeOutline className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
