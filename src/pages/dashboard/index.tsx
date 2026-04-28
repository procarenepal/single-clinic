import React, { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { isToday, isFuture, isPast, startOfDay, format } from "date-fns";

// Services
import {
  IoPersonOutline,
  IoCalendarOutline,
  IoMedicalOutline,
  IoWarningOutline,
  IoAlertCircleOutline,
  IoRefreshOutline,
  IoChevronForwardOutline,
  IoAddOutline,
  IoStarOutline,
  IoDocumentTextOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { enquiryService } from "@/services/enquiryService";
import { branchService } from "@/services/branchService";

// Context
import { useTheme } from "@/context/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";

// Types
import {
  Appointment,
  Patient,
  Doctor,
  AppointmentType,
  Enquiry,
  EnquiryStatus,
  Branch,
} from "@/types/models";

// Custom UI — zero HeroUI
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Icons

// Lazy chart components
const PatientVisitsChart = lazy(() =>
  import("./components/Charts").then((m) => ({
    default: m.PatientVisitsChart,
  })),
);
const AppointmentStatusChart = lazy(() =>
  import("./components/Charts").then((m) => ({
    default: m.AppointmentStatusChart,
  })),
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  totalPatients: number;
  criticalPatients: number;
  todaysAppointments: number;
  activeDoctors: number;
}

interface ChartDataType {
  patientVisits: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      fill: boolean;
      backgroundColor: string;
      borderColor: string;
      tension: number;
    }[];
  };
  appointmentStatus: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string[];
      borderWidth: number;
      borderColor: string;
    }[];
  };
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  scheduled: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "in-progress": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
  default: "bg-surface-2 text-text-muted",
};

const ENQUIRY_BADGE: Record<string, string> = {
  new: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  contacted: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  scheduled: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  converted: "bg-green-500/10 text-green-600 dark:text-green-400",
  closed: "bg-surface-2 text-text-muted",
};

function statusBadge(status: string) {
  return STATUS_BADGE[status] ?? STATUS_BADGE.default;
}
function enquiryBadge(status: string) {
  return ENQUIRY_BADGE[status] ?? STATUS_BADGE.default;
}

// ── Motion Variants ──────────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

// ── Micro components ──────────────────────────────────────────────────────────

/** Clinic Clarity stat card */
interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  iconBg?: string;
  href: string;
  alert?: boolean;
}

function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg = "bg-teal-100 text-teal-700",
  href,
  alert,
}: StatCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <Link className="block group no-underline" to={href}>
        <div className="bg-surface border border-border-base rounded-xl p-4 hover-glow hover:border-primary/30 transition-all duration-300 relative overflow-hidden group">
          {/* Subtle background glow on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5 opacity-80">
                {label}
              </p>
              <p
                className={`text-stat-sm font-bold leading-none tracking-tight ${alert ? "text-red-500" : "text-text-main"}`}
              >
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
              {sub && <p className="text-[11px] text-text-muted mt-2 font-medium">{sub}</p>}
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${iconBg}`}
            >
              {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
            </div>
          </div>

          <div className="relative z-10 mt-4 flex items-center gap-1.5 text-[11px] font-bold text-text-muted group-hover:text-primary transition-colors">
            <span>Details</span>
            <IoChevronForwardOutline className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/** Inline tab strip — custom, replaces HeroUI Tabs */
interface TabStripProps {
  tabs: { key: string; label: string; count?: number }[];
  selected: string;
  onChange: (key: string) => void;
}

function TabStrip({ tabs, selected, onChange }: TabStripProps) {
  return (
    <div className="flex gap-1 border-b border-border-base mb-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-75 border-b-2 -mb-px ${selected === t.key
            ? "border-primary text-primary"
            : "border-transparent text-text-muted hover:text-text-main"
            }`}
          type="button"
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${selected === t.key
                ? "bg-primary/10 text-primary"
                : "bg-surface-2 text-text-muted"
                }`}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Section card header row */
function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border-base">
      <p className="text-[12.5px] font-semibold text-text-main">{title}</p>
      <Link
        className="text-[11px] text-primary hover:text-primary/80 font-medium flex items-center gap-0.5 no-underline"
        to={href}
      >
        View all <IoChevronForwardOutline className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardIndexPage() {
  const { isDark } = useTheme();
  const { clinicId, userData, branchId } = useAuthContext();
  const isClinicAdmin =
    userData?.role === "system-owner" ||
    userData?.role === "clinic-admin";

  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    criticalPatients: 0,
    todaysAppointments: 0,
    activeDoctors: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>(
    [],
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [apptTab, setApptTab] = useState("today");
  const [enquiryTab, setEnquiryTab] = useState<EnquiryStatus | "all">("new");

  const [showAnnouncement, setShowAnnouncement] = useState(false);

  useEffect(() => {
    // Only show once per user based on localStorage
    if (!localStorage.getItem("uiAnnouncementSeen")) {
      setShowAnnouncement(true);
    }
  }, []);

  const mainBranchId = branches.find((b) => b.isMainBranch)?.id ?? null;
  const effectiveBranchId =
    branchId ??
    (mainBranchId && selectedBranchId === mainBranchId
      ? undefined
      : (selectedBranchId ?? undefined));

  const closeAnnouncement = () => {
    localStorage.setItem("uiAnnouncementSeen", "true");
    setShowAnnouncement(false);
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const todayAppts = recentAppointments.filter((a) =>
    isToday(a.appointmentDate),
  );
  const upcomingAppts = recentAppointments.filter((a) =>
    isFuture(startOfDay(a.appointmentDate)),
  );
  const pastAppts = recentAppointments.filter(
    (a) => isPast(startOfDay(a.appointmentDate)) && !isToday(a.appointmentDate),
  );

  const filteredAppts =
    apptTab === "today"
      ? todayAppts
      : apptTab === "upcoming"
        ? upcomingAppts
        : apptTab === "past"
          ? pastAppts
          : recentAppointments.slice(0, 6);

  const filteredEnquiries =
    enquiryTab === "all"
      ? enquiries
      : enquiries.filter((e) => e.status === enquiryTab);

  const enquiryCount = (s: string) =>
    s === "all"
      ? enquiries.length
      : enquiries.filter((e) => e.status === s).length;

  // ── Branch list for clinic-wide admins (no fixed branchId) ────────────────
  // Removed legacy branch fetching for standalone mode

  // ── Data fetch (all in parallel to avoid waterfall) ────────────────────────
  useEffect(() => {
    if (!clinicId) return;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const branchScopedId = undefined; // Branch filters removed for standalone mode
        const [allPatients, allDoctors, allAppTypes, allAppts, allEnquiries] =
          await Promise.all([
            patientService.getPatientsByClinic(clinicId, branchScopedId),
            doctorService.getDoctorsByClinic(clinicId, branchScopedId),
            appointmentTypeService.getAppointmentTypesByClinic(
              clinicId,
              branchScopedId,
            ),
            appointmentService.getAppointmentsByClinic(
              clinicId,
              branchScopedId,
            ),
            enquiryService.getEnquiries(clinicId, branchScopedId, {
              dateField: "createdAt",
            }),
          ]);

        const now = new Date();
        const start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
        );
        const todayCount = allAppts.filter((a) => {
          const t = new Date(a.appointmentDate);

          return t >= start && t <= end;
        }).length;

        setPatients(allPatients);
        setDoctors(allDoctors);
        setAppointmentTypes(allAppTypes);
        setAppointments(allAppts);
        setEnquiries(allEnquiries.slice(0, 20));
        setRecentAppointments(
          allAppts
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .slice(0, 10),
        );
        setStats({
          totalPatients: allPatients.length,
          criticalPatients: allPatients.filter((p) => p.isCritical).length,
          todaysAppointments: todayCount,
          activeDoctors: allDoctors.filter((d) => d.isActive).length,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [clinicId, effectiveBranchId]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const getChartData = (): ChartDataType => {
    // ProCare Blue theme colors from globals.css
    const primaryColor = isDark ? "#38a9f8" : "#0356a1";
    const secondaryColor = isDark ? "#4ade80" : "#16a34a";
    const warningColor = isDark ? "#fbbf24" : "#d97706";
    const dangerColor = isDark ? "#f87171" : "#e11d48";

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const cur = new Date();
    const months: string[] = [];
    const visitData: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const mo = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
      const end = new Date(
        cur.getFullYear(),
        cur.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999,
      );

      months.push(monthNames[mo.getMonth()]);
      visitData.push(
        patients.filter((p) => {
          const d = new Date(p.createdAt);

          return d >= mo && d <= end;
        }).length,
      );
    }

    const counts = {
      confirmed: 0,
      scheduled: 0,
      "in-progress": 0,
      completed: 0,
      cancelled: 0,
    };

    appointments.forEach((a) => {
      if (a.status in counts) (counts as any)[a.status]++;
    });

    return {
      patientVisits: {
        labels: months,
        datasets: [
          {
            label: "Patient Registrations",
            data: visitData,
            fill: false,
            backgroundColor: primaryColor,
            borderColor: primaryColor,
            tension: 0.3,
          },
        ],
      },
      appointmentStatus: {
        labels: [
          "Confirmed",
          "Scheduled",
          "In Progress",
          "Completed",
          "Cancelled",
        ],
        datasets: [
          {
            label: "Appointments",
            data: [
              counts.confirmed,
              counts.scheduled,
              counts["in-progress"],
              counts.completed,
              counts.cancelled,
            ],
            backgroundColor: [
              secondaryColor,
              primaryColor,
              warningColor,
              "#8b5cf6",
              dangerColor,
            ],
            borderWidth: 2,
            borderColor: isDark ? "#18181b" : "#ffffff",
          },
        ],
      },
    };
  };

  const chartData = getChartData();

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: isDark ? "#e2e8f0" : "#475569",
          boxWidth: 10,
          padding: 12,
          font: { size: 11 },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: isDark ? "#94a3b8" : "#64748b", font: { size: 11 } },
        grid: { color: isDark ? "#27272a" : "#f1f5f9" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: isDark ? "#94a3b8" : "#64748b", font: { size: 11 } },
        grid: { color: isDark ? "#27272a" : "#f1f5f9" },
      },
    },
  };

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: isDark ? "#e2e8f0" : "#475569",
          boxWidth: 10,
          padding: 12,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: { label: (c: any) => `${c.label}: ${c.parsed} appts` },
      },
    },
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime12 = (t24: string): string => {
    if (!t24) return "—";
    const [h, m] = t24.split(":").map(Number);

    return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const apptTypeName = (id: string) =>
    appointmentTypes.find((t) => t.id === id)?.name ?? "General";

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <Spinner label="Loading dashboard…" size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
        <IoAlertCircleOutline className="w-8 h-8 text-red-400" />
        <p className="text-sm text-text-muted">{error}</p>
        <Button
          color="primary"
          size="sm"
          startContent={<IoRefreshOutline />}
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-4">
      {/* ── Page header — spec: clarity-page-header pattern ────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          {/* spec: page title 15px/700/-0.02em */}
          <h1 className="text-page-title text-text-main leading-tight">
            Dashboard
          </h1>
          {/* spec: body 13px/400 */}
          <p className="text-[13px] text-text-muted mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Branch selector (clinic admins without fixed branch) + Quick actions */}
        <div className="flex flex-wrap gap-2 items-center">
          {!branchId && isClinicAdmin && branches.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[11px] text-text-muted">Branch</span>
              <select
                className="h-8 px-2.5 py-0 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                value={selectedBranchId ?? ""}
                onChange={(e) => setSelectedBranchId(e.target.value || null)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.isMainBranch ? " (all branches)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick actions — spec: clarity-btn compact */}
          <Link className="no-underline" to="/dashboard/appointments/new">
            <Button
              color="primary"
              size="sm"
              startContent={<IoAddOutline className="w-3.5 h-3.5" />}
            >
              New Appointment
            </Button>
          </Link>
          <Link className="no-underline" to="/dashboard/patients/new">
            <Button
              color="primary"
              size="sm"
              startContent={<IoPersonOutline className="w-3.5 h-3.5" />}
              variant="bordered"
            >
              New Patient
            </Button>
          </Link>
          <Link className="no-underline" to="/dashboard/daily-report">
            <Button
              color="default"
              size="sm"
              startContent={<IoDocumentTextOutline className="w-3.5 h-3.5" />}
              variant="bordered"
            >
              Daily Report
            </Button>
          </Link>
        </div>
      </div>

      {/* ── KPI stat cards — 4-col grid ────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <StatCard
          href="/dashboard/patients"
          icon={<IoPersonOutline className="w-4 h-4" />}
          iconBg="bg-teal-100 text-teal-700"
          label="Total Patients"
          sub="All registered"
          value={stats.totalPatients}
        />
        <StatCard
          alert={stats.criticalPatients > 0}
          href="/dashboard/patients"
          icon={<IoWarningOutline className="w-4 h-4" />}
          iconBg="bg-red-100 text-red-600"
          label="Critical Patients"
          sub="Need attention"
          value={stats.criticalPatients}
        />
        <StatCard
          href="/dashboard/appointments"
          icon={<IoCalendarOutline className="w-4 h-4" />}
          iconBg="bg-sky-100 text-sky-600"
          label="Today's Appointments"
          sub="Scheduled today"
          value={stats.todaysAppointments}
        />
        <StatCard
          href="/dashboard/doctors"
          icon={<IoMedicalOutline className="w-4 h-4" />}
          iconBg="bg-health-100 text-health-700"
          label="Active Doctors"
          sub="Currently available"
          value={stats.activeDoctors}
        />
      </motion.div>

      {/* ── Row 2 & 3 with fade-in ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3"
      >
        {/* ── Row 2: Patient visits chart + Appointments list ────────────── */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Patient visits (line chart) */}
          <div className="bg-surface border border-border-base rounded-xl overflow-hidden shadow-sm shadow-black/5">
            <div className="px-3 py-2 border-b border-border-base">
              {/* spec: section label 11px/600/uppercase */}
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-text-muted">
                Patient Registrations
              </p>
              <p className="text-[12.5px] font-semibold text-text-main mt-0.5">
                Last 6 months
              </p>
            </div>
            <div className="p-3 h-[220px]">
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center">
                    <Spinner label="Loading chart…" size="sm" />
                  </div>
                }
              >
                <PatientVisitsChart
                  data={chartData.patientVisits}
                  options={chartOpts}
                />
              </Suspense>
            </div>
          </div>

          {/* Appointments tabbed list */}
          <div className="bg-surface border border-border-base rounded overflow-hidden flex flex-col">
            <SectionHeader href="/dashboard/appointments" title="Appointments" />

            <div className="px-3 pt-2">
              <TabStrip
                selected={apptTab}
                tabs={[
                  { key: "today", label: "Today", count: todayAppts.length },
                  {
                    key: "upcoming",
                    label: "Upcoming",
                    count: upcomingAppts.length,
                  },
                  { key: "past", label: "Past", count: pastAppts.length },
                ]}
                onChange={setApptTab}
              />
            </div>

            <div
              className="flex-1 overflow-y-auto px-1 pb-2"
              style={{ maxHeight: "234px" }}
            >
              {filteredAppts.length === 0 ? (
                <div className="py-8 text-center">
                  <IoCalendarOutline className="w-6 h-6 mx-auto mb-1.5 text-mountain-300" />
                  <p className="text-[12px] text-mountain-400">No appointments</p>
                </div>
              ) : (
                filteredAppts.slice(0, 6).map((appt) => {
                  const doctor = doctors.find((d) => d.id === appt.doctorId);
                  const patient = patients.find((p) => p.id === appt.patientId);

                  return (
                    <div
                      key={appt.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-surface-2 rounded transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          className="text-[12.5px] font-medium text-text-main hover:text-primary truncate block no-underline"
                          to={`/dashboard/patients/${patient?.id}`}
                        >
                          {patient?.name ?? "Unknown Patient"}
                        </Link>
                        <p className="text-[11px] text-text-muted truncate">
                          Dr. {doctor?.name ?? "Unknown"} ·{" "}
                          {apptTypeName(appt.appointmentTypeId)} ·{" "}
                          {formatTime12(appt.startTime ?? "")}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded ${statusBadge(appt.status)}`}
                      >
                        {appt.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Row 3: Status doughnut + Enquiries ─────────────────────────── */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-3 pb-8">
          {/* Appointment status breakdown (doughnut) — 2/3 width */}
          <div className="lg:col-span-2 bg-surface border border-border-base rounded overflow-hidden">
            <div className="px-3 py-2 border-b border-border-base">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-text-muted">
                Status Breakdown
              </p>
              <p className="text-[12.5px] font-semibold text-text-main mt-0.5">
                Appointment distribution
              </p>
            </div>
            <div className="p-3 h-[220px]">
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center">
                    <Spinner label="Loading chart…" size="sm" />
                  </div>
                }
              >
                <AppointmentStatusChart
                  data={chartData.appointmentStatus}
                  options={doughnutOpts}
                />
              </Suspense>
            </div>
          </div>

          {/* Enquiries — 1/3 width */}
          <div className="bg-surface border border-border-base rounded overflow-hidden flex flex-col">
            <SectionHeader href="/dashboard/enquiries" title="Enquiries" />

            <div className="px-3 pt-2">
              <TabStrip
                selected={enquiryTab}
                tabs={[
                  { key: "new", label: "New", count: enquiryCount("new") },
                  {
                    key: "contacted",
                    label: "Contacted",
                    count: enquiryCount("contacted"),
                  },
                  {
                    key: "converted",
                    label: "Done",
                    count: enquiryCount("converted"),
                  },
                  { key: "all", label: "All", count: enquiryCount("all") },
                ]}
                onChange={(v) => setEnquiryTab(v as EnquiryStatus | "all")}
              />
            </div>

            <div
              className="flex-1 overflow-y-auto px-1 pb-2"
              style={{ maxHeight: "234px" }}
            >
              {filteredEnquiries.length === 0 ? (
                <div className="py-8 text-center">
                  <IoStarOutline className="w-6 h-6 mx-auto mb-1.5 text-text-muted/30" />
                  <p className="text-[12px] text-text-muted">No enquiries</p>
                </div>
              ) : (
                filteredEnquiries.map((enq) => (
                  <div
                    key={enq.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-surface-2 rounded transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-text-main truncate">
                        {enq.fullName}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">
                        {enq.phone}
                        {enq.source ? ` · ${enq.source}` : ""} ·{" "}
                        {enq.createdAt
                          ? format(new Date(enq.createdAt), "MMM dd")
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded ${enquiryBadge(enq.status)}`}
                    >
                      {enq.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {showAnnouncement && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 overflow-hidden backdrop-blur-sm"
          onClick={closeAnnouncement}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-surface border border-border-base rounded-2xl max-w-md w-full flex flex-col shadow-2xl glass-morphism overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 py-4 border-b border-border-base bg-gradient-to-r from-teal-500/10 to-transparent">
              <h3 className="text-[16px] font-bold text-text-main flex items-center gap-2">
                <IoStarOutline className="text-teal-500" /> UI Update Announcement
              </h3>
              <button
                className="text-text-muted hover:text-text-main transition-colors"
                type="button"
                onClick={closeAnnouncement}
              >
                <IoCloseOutline className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 text-[14px] text-text-main space-y-4">
              <p className="text-[16px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400">
                A New Premium Experience
              </p>
              <p className="text-text-muted text-[13.5px] leading-relaxed">
                Welcome to ProCare v2.0. We've introduced glassmorphism,
                staggered entrance animations, and a new "Floating" navigation
                to make your workflow feel faster and more premium.
              </p>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-border-base bg-surface-2/50">
              <Button color="primary" radius="lg" size="md" onClick={closeAnnouncement}>
                Got it!
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
