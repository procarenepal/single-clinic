import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import DatabaseCleaner from "@/components/DatabaseCleaner";
import MedicineSeeder from "@/components/MedicineSeeder";
import StaffSeeder from "@/components/StaffSeeder";
import { Link, useNavigate } from "react-router-dom";
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
  IoPersonAddOutline,
  IoChatbubbleEllipsesOutline,
  IoSettingsOutline,
  IoTimeOutline,
  IoReceiptOutline,
  IoDownloadOutline,
} from "react-icons/io5";

import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { prescriptionService } from "@/services/prescriptionService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { enquiryService } from "@/services/enquiryService";
import { branchService } from "@/services/branchService";
import { dailyReportService, DailyReportData } from "@/services/dailyReportService";
import { exportDailyReportToExcel, exportDailyReportToPDF } from "@/utils/reportExports";

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
import { Skeleton, PageSkeleton } from "@/components/ui";
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
  confirmed: "bg-primary/10 text-primary",
  scheduled: "bg-primary/10 text-primary",
  "in-progress": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  default: "bg-surface-2 text-text-muted",
};

const ENQUIRY_BADGE: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  contacted: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  scheduled: "bg-primary/10 text-primary",
  converted: "bg-green-500/10 text-green-600 border-green-500/20",
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
  iconBg = "bg-primary/10 text-primary",
  href,
  alert,
}: StatCardProps) {
  return (
    <motion.div variants={itemVariants} className="h-full">
      <Link className="block group no-underline h-full" to={href}>
        <div className="h-full bg-surface border border-border-base rounded-[10px] p-2.5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between gap-1.5">

          {/* Subtle radial gradient */}
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${alert ? 'bg-red-500 animate-pulse' : 'bg-primary'}`} />
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-text-muted whitespace-nowrap">
                    {label}
                  </p>
                </div>
                <p
                  className={`text-[16px] font-black leading-none tracking-tight ${alert ? "text-red-500" : "text-text-main"}`}
                >
                  {typeof value === "number" ? value.toLocaleString() : value}
                </p>
              </div>
            </div>

            {/* Icon Container */}
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/5 ${iconBg}`}
            >
              {React.cloneElement(icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between pt-1 mt-auto">
            {sub && (
              <p className="text-[10px] text-text-muted font-medium">
                {sub}
              </p>
            )}
            <div className="flex items-center gap-0.5 text-[10.5px] font-semibold text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
              <span>View</span>
              <IoChevronForwardOutline className="w-3 h-3" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/** Welcome Hero Component */
function WelcomeHero({
  name,
  stats,
}: {
  name: string;
  stats: DashboardStats;
}) {
  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";

  return (
    <motion.div
      variants={itemVariants}
      className="relative overflow-hidden rounded-[10px] bg-surface border border-border-base p-3 shadow-sm mb-1"
    >
      {/* Abstract background elements */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-[14px] font-black text-text-main leading-tight tracking-tight">
            {greeting}, <span className="text-primary">{name}!</span> 👋
          </h2>
          <p className="text-[12px] text-text-muted mt-1 font-semibold max-w-[480px] leading-tight">
            Welcome back to the clinic command center. You have{" "}
            <span className="text-text-main font-bold">
              {stats.todaysAppointments} appointments
            </span>{" "}
            scheduled for today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center px-3.5 py-1.5 bg-surface-2 rounded-lg border border-border-base/50">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
              Appointments
            </p>
            <p className="text-[16px] font-bold text-primary leading-tight">
              {stats.todaysAppointments}
            </p>
          </div>
          <div className="flex flex-col items-center px-3.5 py-1.5 bg-surface-2 rounded-lg border border-border-base/50">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
              Critical
            </p>
            <p className="text-[16px] font-bold text-red-500 leading-tight">
              {stats.criticalPatients}
            </p>
          </div>
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
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${selected === t.key
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

function QuickActions() {
  const actions = [
    { label: "New Appointment", icon: <IoCalendarOutline />, href: "/dashboard/appointments/new", color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Register Patient", icon: <IoPersonAddOutline />, href: "/dashboard/patients/new", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "New Prescription", icon: <IoReceiptOutline />, href: "/dashboard/prescriptions/new", color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Add Enquiry", icon: <IoChatbubbleEllipsesOutline />, href: "/dashboard/enquiries?action=new", color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  return (
    <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-1.5">
      {actions.map((action, idx) => (
        <Link key={idx} to={action.href} className="block group no-underline">
          <div className="bg-surface border border-border-base rounded-[10px] p-2 flex items-center gap-2.5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-400 hover:-translate-y-1 relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br from-surface to-${action.color.split('-')[1]}-500/5 opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className={`relative z-10 w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${action.bg} ${action.color} group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 ring-1 ring-inset ring-black/5 dark:ring-white/5`}>
              {React.cloneElement(action.icon as React.ReactElement, { className: "w-4 h-4" })}
            </div>
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-primary tracking-tight leading-none">{action.label}</p>
              <p className="text-[9px] font-semibold text-text-muted mt-0.5 uppercase tracking-wider">Quick Create</p>
            </div>
          </div>
        </Link>
      ))}
    </motion.div>
  );
}

function RecentActivityFeed({ activities }: { activities: any[] }) {
  const navigate = useNavigate();

  return (
    <div className="bg-surface border border-border-base rounded-[10px] flex flex-col shadow-sm h-[320px]">
      <div className="px-4 py-3 border-b border-border-base flex items-center justify-between">
        <h3 className="text-[12.5px] font-semibold text-primary flex items-center gap-2">
          <IoTimeOutline className="w-4 h-4 text-primary" />
          Recent Activity
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activities.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <IoTimeOutline className="w-8 h-8 mb-2" />
            <p className="text-[12px] font-medium">No recent activity</p>
          </div>
        ) : (
          <div className="relative border-l border-border-base/80 ml-2 space-y-6 pt-1 pb-2">
            {activities.map((item, idx) => (
              <div key={idx} className="relative pl-5 group cursor-default">
                <div className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-surface ${item.color} group-hover:scale-125 transition-transform`} />
                <div>
                  <p className="text-[12.5px] font-semibold text-text-main group-hover:text-primary transition-colors leading-tight">{item.title}</p>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{item.desc}</p>
                  <p className="text-[9px] font-bold text-text-muted/60 mt-1.5 uppercase tracking-[0.1em]">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-2 border-t border-border-base text-center bg-surface-2/30 mt-auto rounded-b-[10px]">
        <button
          className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-all uppercase tracking-wider py-1"
          onClick={() => navigate("/dashboard/activity-log")}
        >
          View Full Log
        </button>
      </div>
    </div>
  );
}

/** Section card header row */
function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border-base">
      <p className="text-[12.5px] font-semibold text-primary">{title}</p>
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
  const navigate = useNavigate();
  const { clinicId, userData, branchId, currentUser } = useAuthContext();
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
  const [recentPrescriptions, setRecentPrescriptions] = useState<any[]>([]);
  const [dailyReport, setDailyReport] = useState<DailyReportData | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [apptTab, setApptTab] = useState("today");
  const [enquiryTab, setEnquiryTab] = useState<EnquiryStatus | "all">("new");
  const [dailyTab, setDailyTab] = useState<"patients" | "appointments" | "billing">("patients");

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
  const todayAppts = appointments.filter((a) =>
    isToday(a.appointmentDate),
  ).sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());

  const upcomingAppts = appointments.filter((a) =>
    isFuture(startOfDay(a.appointmentDate)),
  ).sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());

  const pastAppts = appointments.filter(
    (a) => isPast(startOfDay(a.appointmentDate)) && !isToday(a.appointmentDate),
  ).sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());

  const filteredAppts =
    apptTab === "today"
      ? todayAppts
      : apptTab === "upcoming"
        ? upcomingAppts
        : apptTab === "past"
          ? pastAppts
          : appointments.slice(0, 6);

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
        const [allPatients, allDoctors, allAppTypes, allAppts, allEnquiries, allPrescriptions, dailyData] =
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
            prescriptionService.getPrescriptionsByClinic(clinicId),
            dailyReportService.getDailyReportData(clinicId, new Date(), effectiveBranchId),
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
        setDailyReport(dailyData);
        setRecentAppointments(
          allAppts
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .slice(0, 10),
        );
        const allRx = allPrescriptions as any[];
        setRecentPrescriptions(
          allRx
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .slice(0, 5),
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
    const primaryColor = isDark ? "#a78bfa" : "#6d28d9"; // HSC Purple
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

  // ── Generate real activity feed ───────────────────────────────────────────
  const activityFeed = useMemo(() => {
    const items: any[] = [];

    // Appointments
    appointments.slice(0, 5).forEach(a => {
      const patient = patients.find(p => p.id === a.patientId);
      const doctor = doctors.find(d => d.id === a.doctorId);
      items.push({
        type: 'appointment',
        title: 'New Appointment',
        desc: `${patient?.name || 'Patient'} with ${doctor?.name || 'Specialist'}`,
        time: format(new Date(a.createdAt), 'h:mm a'),
        rawTime: new Date(a.createdAt),
        color: 'bg-blue-500'
      });
    });

    // Patients
    patients.slice(0, 3).forEach(p => {
      items.push({
        type: 'patient',
        title: 'Patient Registered',
        desc: `${p.name} joined the clinic`,
        time: format(new Date(p.createdAt), 'h:mm a'),
        rawTime: new Date(p.createdAt),
        color: 'bg-emerald-500'
      });
    });

    // Enquiries
    enquiries.slice(0, 3).forEach(e => {
      items.push({
        type: 'enquiry',
        title: 'New Enquiry',
        desc: `Lead from ${e.fullName}`,
        time: format(new Date(e.createdAt), 'h:mm a'),
        rawTime: new Date(e.createdAt),
        color: 'bg-amber-500'
      });
    });

    // Prescriptions
    recentPrescriptions.forEach(rx => {
      const patient = patients.find(p => p.id === rx.patientId);
      items.push({
        type: 'prescription',
        title: 'Prescription Issued',
        desc: `For ${patient?.name || 'Patient'} (#${rx.prescriptionNo})`,
        time: format(new Date(rx.createdAt), 'h:mm a'),
        rawTime: new Date(rx.createdAt),
        color: 'bg-purple-500'
      });
    });

    return items.sort((a, b) => b.rawTime.getTime() - a.rawTime.getTime()).slice(0, 10);
  }, [appointments, patients, enquiries, recentPrescriptions]);

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
    cutout: "70%",
    plugins: {
      legend: {
        display: false,
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

  const handleExportExcel = () => {
    if (!dailyReport) return;
    try {
      const branchName = userData?.branchId ? branches.find(b => b.id === userData.branchId)?.name : undefined;
      exportDailyReportToExcel(
        dailyReport,
        new Date(),
        undefined,
        branchName,
        patients,
        doctors,
        appointmentTypes
      );
    } catch (e) {
      console.error("Failed to export daily report to Excel", e);
    }
  };

  const handleExportPDF = () => {
    if (!dailyReport) return;
    try {
      const branchName = userData?.branchId ? branches.find(b => b.id === userData.branchId)?.name : undefined;
      exportDailyReportToPDF(
        dailyReport,
        new Date(),
        undefined,
        branchName,
        patients,
        doctors,
        appointmentTypes
      );
    } catch (e) {
      console.error("Failed to export daily report to PDF", e);
    }
  };

  const apptTypeName = (id: string) =>
    appointmentTypes.find((t) => t.id === id)?.name ?? "General";

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-2">
        <PageSkeleton />
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
    <div className="w-full flex flex-col gap-2">
      <DatabaseCleaner />
      <MedicineSeeder />
      <StaffSeeder />
      {/* Header removed as requested */}

      <WelcomeHero
        name={currentUser?.displayName || currentUser?.email?.split("@")[0] || "Expert"}
        stats={stats}
      />

      {/* ── Daily Operations & Financial Report Summary ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 items-start">
          {/* Card 1: Daily Reports Exporter (Action Center) */}
          <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden flex flex-col shadow-sm p-4 justify-between" style={{ height: "210px" }}>
            <div>
              <h3 className="text-[13px] font-bold text-text-main">Daily Reports</h3>
              <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                Download today's reports for patient registrations, appointments, and billing. Export directly to Excel or PDF format.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  color="success"
                  size="sm"
                  variant="flat"
                  className="font-bold text-[11px] h-8"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  onClick={handleExportExcel}
                >
                  Excel
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  variant="flat"
                  className="font-bold text-[11px] h-8"
                  startContent={<IoDocumentTextOutline className="w-3.5 h-3.5" />}
                  onClick={handleExportPDF}
                >
                  PDF
                </Button>
              </div>
              <Button
                color="primary"
                size="sm"
                className="font-bold text-[11px] h-8 w-full"
                startContent={<IoChevronForwardOutline className="w-3.5 h-3.5" />}
                onClick={() => navigate("/dashboard/daily-report")}
              >
                Go to Daily Reports
              </Button>
            </div>
          </div>

          {/* Card 2: Daily Activities (Tabbed) */}
          <div className="lg:col-span-2 bg-surface border border-border-base rounded-[10px] overflow-hidden flex flex-col shadow-sm" style={{ height: "210px" }}>
            <div className="px-4 py-2 border-b border-border-base flex items-center justify-between bg-primary/[0.01]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDailyTab("patients")}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    dailyTab === "patients"
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:bg-surface-2"
                  }`}
                >
                  <IoPersonOutline className="w-3.5 h-3.5" />
                  Intake Patients ({dailyReport?.patients.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setDailyTab("appointments")}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    dailyTab === "appointments"
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:bg-surface-2"
                  }`}
                >
                  <IoCalendarOutline className="w-3.5 h-3.5" />
                  Appointments ({dailyReport?.appointments.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setDailyTab("billing")}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    dailyTab === "billing"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "text-text-muted hover:bg-surface-2"
                  }`}
                >
                  <IoReceiptOutline className="w-3.5 h-3.5" />
                  Billings ({dailyReport?.billing.length ?? 0})
                </button>
              </div>
              {dailyTab === "billing" && (
                <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  NPR {dailyReport?.billing.reduce((sum, b) => sum + (b.totalAmount || 0), 0).toLocaleString() ?? "0"}
                </span>
              )}
            </div>
            
            <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
              {dailyTab === "patients" && (
                (!dailyReport || dailyReport.patients.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-6">
                    <IoPersonOutline className="w-6 h-6 mb-1" />
                    <p className="text-[10px] font-semibold">No new patients today</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dailyReport.patients.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-2/40 hover:bg-primary/5 transition-all">
                        <div className="flex flex-col">
                          <span className="text-[11.5px] font-bold text-text-main leading-none">{p.name}</span>
                          <span className="text-[9px] text-text-muted mt-1 leading-none">{p.mobile || 'No Mobile'}</span>
                        </div>
                        <span className="text-[9px] font-mono bg-primary/5 text-primary px-1.5 py-0.5 rounded">
                          {p.regNumber || 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {dailyTab === "appointments" && (
                (!dailyReport || dailyReport.appointments.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-6">
                    <IoCalendarOutline className="w-6 h-6 mb-1 text-primary" />
                    <p className="text-[10px] font-semibold">No appointments today</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dailyReport.appointments.map((a, idx) => {
                      const patientName = patients.find(p => p.id === a.patientId)?.name || 'Unknown Patient';
                      const doctorName = doctors.find(d => d.id === a.doctorId)?.name || 'Expert';
                      const formatTimeStr = (tStr) => {
                        if (!tStr) return 'N/A';
                        const parts = tStr.split(':');
                        if (parts.length < 2) return tStr;
                        const hr = parseInt(parts[0], 10);
                        const ampm = hr >= 12 ? 'PM' : 'AM';
                        const displayHr = hr % 12 || 12;
                        return `${displayHr}:${parts[1]} ${ampm}`;
                      };
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-2/40 hover:bg-primary/5 transition-all">
                          <div className="flex flex-col">
                            <span className="text-[11.5px] font-bold text-text-main leading-none">{patientName}</span>
                            <span className="text-[9px] text-text-muted mt-1 leading-none">Doctor: {doctorName}</span>
                          </div>
                          <span className="text-[9.5px] font-bold text-primary px-2 py-0.5 rounded bg-primary/5">
                            {a.startTime ? formatTimeStr(a.startTime) : 'Scheduled'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {dailyTab === "billing" && (
                (!dailyReport || dailyReport.billing.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-6">
                    <IoReceiptOutline className="w-6 h-6 mb-1 text-emerald-500" />
                    <p className="text-[10px] font-semibold">No invoices generated today</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dailyReport.billing.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-2/40 hover:bg-emerald-500/5 transition-all">
                        <div className="flex flex-col">
                          <span className="text-[11.5px] font-bold text-text-main leading-none">{b.invoiceNumber}</span>
                          <span className="text-[9px] text-text-muted mt-1 leading-none">{b.patientName || 'Unknown Patient'}</span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600">
                          NPR {b.totalAmount?.toLocaleString() || '0'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      <QuickActions />

      {/* ── KPI stat cards — 4-col grid ────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-1.5"
      >
        <StatCard
          href="/dashboard/patients"
          icon={<IoPersonOutline className="w-4 h-4" />}
          iconBg="bg-primary/10 text-primary"
          label="Total Patients"
          sub="Clinic-wide"
          value={stats.totalPatients}
        />
        <StatCard
          alert={stats.criticalPatients > 0}
          href="/dashboard/patients"
          icon={<IoWarningOutline className="w-4 h-4" />}
          iconBg="bg-red-500/10 text-red-600 dark:text-red-400"
          label="Critical Care"
          sub="Requires attention"
          value={stats.criticalPatients}
        />
        <StatCard
          href="/dashboard/appointments"
          icon={<IoCalendarOutline className="w-4 h-4" />}
          iconBg="bg-primary/10 text-primary"
          label="Today's Bookings"
          sub="Scheduled for today"
          value={stats.todaysAppointments}
        />
        <StatCard
          href="/dashboard/doctors"
          icon={<IoMedicalOutline className="w-4 h-4" />}
          iconBg="bg-primary/10 text-primary"
          label="Active Experts"
          sub="Currently on duty"
          value={stats.activeDoctors}
        />
      </motion.div>

      {/* ── Row 2 & 3 with fade-in ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-1.5"
      >


        {/* ── Unified Dashboard Flow ──────────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 items-start pb-8">
          {/* Left Column: Main operations (2/3 width) */}
          <div className="lg:col-span-2 flex flex-col gap-1.5">
            {/* Top row inside left column: Registrations Chart + Live Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {/* Patient registrations (line chart) */}
              <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden shadow-sm shadow-black/5">
                <div className="px-3 py-2 border-b border-border-base">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-primary">
                    Patient Registrations
                  </p>
                  <p className="text-[12.5px] font-semibold text-text-main mt-0.5">
                    Last 6 months
                  </p>
                </div>
                <div className="p-3 h-[220px]">
                  <Suspense
                    fallback={
                      <div className="h-full w-full p-2">
                        <Skeleton className="h-full w-full rounded-lg" />
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

              {/* Appointments tabbed list (Live Schedule) */}
              <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden flex flex-col shadow-sm">
                <SectionHeader href="/dashboard/appointments" title="Live Schedule" />

                {/* Next Up Highlight */}
                {todayAppts.length > 0 && (
                  <div className="px-3 pt-3">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between group hover:bg-primary/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                          <IoCalendarOutline className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Next Appointment</p>
                          <h4 className="text-[14px] font-bold text-text-main leading-tight">
                            {patients.find(p => p.id === todayAppts[0].patientId)?.name || "Patient"}
                          </h4>
                          <p className="text-[11px] text-text-muted">
                            {formatTime12(todayAppts[0].startTime ?? "")} · Dr. {doctors.find(d => d.id === todayAppts[0].doctorId)?.name || "Expert"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="h-8 text-[11px] font-bold"
                        onClick={() => navigate(`/dashboard/appointments/${todayAppts[0].id}`)}
                      >
                        Check In
                      </Button>
                    </div>
                  </div>
                )}

                <div className="px-3 pt-4">
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
                  style={{ maxHeight: "280px" }}
                >
                  {filteredAppts.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-3">
                        <IoCalendarOutline className="w-6 h-6 text-text-muted/40" />
                      </div>
                      <p className="text-[13px] font-medium text-text-muted">No appointments found</p>
                      <p className="text-[11px] text-text-muted opacity-60">Try changing the tab filter</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredAppts.slice(0, 6).map((appt) => {
                        const doctor = doctors.find((d) => d.id === appt.doctorId);
                        const patient = patients.find((p) => p.id === appt.patientId);

                        return (
                          <div
                            key={appt.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2/50 rounded-xl transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center shrink-0 text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <span className="text-[11px] font-bold">
                                {formatTime12(appt.startTime ?? "").split(" ")[0]}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <Link
                                  className="text-[13px] font-bold text-text-main hover:text-primary truncate block no-underline"
                                  to={`/dashboard/patients/${patient?.id}`}
                                >
                                  {patient?.name ?? "Unknown Patient"}
                                </Link>
                                <span
                                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(appt.status)}`}
                                >
                                  {appt.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-text-muted truncate mt-0.5">
                                Expert: <span className="text-text-main/70 font-medium">{doctor?.name ?? "N/A"}</span> · {apptTypeName(appt.appointmentTypeId)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom row inside left column: Status breakdown doughnut chart */}
            <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden shadow-sm">
              <div className="px-3 py-2 border-b border-border-base flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-primary">
                    Status Breakdown
                  </p>
                  <p className="text-[12.5px] font-semibold text-text-main mt-0.5">
                    Appointment distribution
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Total</p>
                  <p className="text-[16px] font-black text-primary leading-none">{appointments.length}</p>
                </div>
              </div>
              <div className="p-5 flex flex-col md:flex-row items-center gap-8">
                {/* Chart Container - Fixed Square for Perfect Centering */}
                <div className="w-full md:w-2/5 flex justify-center">
                  <div className="w-[160px] h-[160px] relative">
                    <Suspense
                      fallback={
                        <div className="h-full w-full flex items-center justify-center">
                          <Skeleton variant="circle" className="w-32 h-32" />
                        </div>
                      }
                    >
                      <AppointmentStatusChart
                        data={chartData.appointmentStatus}
                        options={doughnutOpts}
                      />
                      {/* Center Text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-[24px] font-black text-text-main leading-none mt-1">
                          {appointments.length > 0 ? Math.round((appointments.filter(a => a.status === 'completed').length / appointments.length) * 100) : 0}%
                        </p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mt-0.5">Efficiency</p>
                      </div>
                    </Suspense>
                  </div>
                </div>

                {/* Legend Container */}
                <div className="w-full md:w-3/5 grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {[
                    { label: "Confirmed", count: appointments.filter(a => a.status === 'confirmed').length, color: "bg-teal-500" },
                    { label: "Scheduled", count: appointments.filter(a => a.status === 'scheduled').length, color: "bg-primary" },
                    { label: "In Progress", count: appointments.filter(a => a.status === 'in-progress').length, color: "bg-amber-500" },
                    { label: "Completed", count: appointments.filter(a => a.status === 'completed').length, color: "bg-purple-500" },
                    { label: "Cancelled", count: appointments.filter(a => a.status === 'cancelled').length, color: "bg-red-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2 border border-border-base/40 hover:border-border-base transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${item.color} shadow-sm`} />
                        <span className="text-[11.5px] font-semibold text-text-muted">{item.label}</span>
                      </div>
                      <span className="text-[13px] font-black text-text-main">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sidebar feeds & lead queries (1/3 width) */}
          <div className="flex flex-col gap-1.5">
            <RecentActivityFeed activities={activityFeed} />
            
            {/* Recent Prescriptions Widget */}
            <div className="bg-surface border border-border-base rounded-[10px] flex flex-col shadow-sm">
              <div className="px-4 py-3 border-b border-border-base flex items-center justify-between bg-purple-500/[0.02]">
                <h3 className="text-[12.5px] font-semibold text-purple-600 flex items-center gap-2">
                  <IoReceiptOutline className="w-4 h-4" />
                  Recent Prescriptions
                </h3>
                <Link to="/dashboard/prescriptions" className="text-[10px] font-bold text-purple-600 uppercase tracking-wider hover:underline">
                  View All
                </Link>
              </div>
              <div className="p-3 space-y-2">
                {recentPrescriptions.length === 0 ? (
                  <p className="text-[11px] text-text-muted text-center py-4 italic">No prescriptions found</p>
                ) : (
                  recentPrescriptions.map((rx, idx) => {
                    const patient = patients.find(p => p.id === rx.patientId);
                    const doctor = doctors.find(d => d.id === rx.doctorId);
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-2/40 hover:bg-purple-500/5 border border-transparent hover:border-purple-500/20 transition-all cursor-pointer" onClick={() => navigate(`/dashboard/prescriptions/${rx.id}`)}>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-text-main">{patient?.name || 'Unknown'}</span>
                          <span className="text-[10px] text-text-muted">Dr. {doctor?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-mono text-purple-600 font-bold">#{rx.prescriptionNo}</span>
                          <span className="text-[9px] text-text-muted">{format(new Date(rx.createdAt), 'MMM d, h:mm a')}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Lead Enquiries */}
            <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden flex flex-col shadow-sm">
              <SectionHeader href="/dashboard/enquiries" title="Lead Enquiries" />

              <div className="px-3 pt-2">
                <TabStrip
                  selected={enquiryTab}
                  tabs={[
                    { key: "new", label: "New", count: enquiryCount("new") },
                    {
                      key: "contacted",
                      label: "Pending",
                      count: enquiryCount("contacted"),
                    },
                    { key: "all", label: "All", count: enquiryCount("all") },
                  ]}
                  onChange={(v) => setEnquiryTab(v as EnquiryStatus | "all")}
                />
              </div>

              <div
                className="flex-1 overflow-y-auto px-1 pb-2"
                style={{ maxHeight: "280px" }}
              >
                {filteredEnquiries.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-3">
                      <IoStarOutline className="w-6 h-6 text-text-muted/40" />
                    </div>
                    <p className="text-[13px] font-medium text-text-muted">No new leads</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredEnquiries.map((enq) => (
                      <div
                        key={enq.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2/50 rounded-xl transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-bold text-text-main truncate">
                              {enq.fullName}
                            </p>
                            <span
                              className={`shrink-0 text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${enquiryBadge(enq.status)}`}
                            >
                              {enq.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted truncate mt-0.5">
                            {enq.phone}
                            {enq.source ? ` · ${enq.source}` : ""} ·{" "}
                            <span className="font-medium text-primary/70">
                              {enq.createdAt
                                ? format(new Date(enq.createdAt), "MMM dd")
                                : ""}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
