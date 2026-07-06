import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  IoPeopleOutline,
  IoCalendarOutline,
  IoCheckmarkCircleOutline,
  IoTimeOutline,
  IoCashOutline,
  IoChevronForwardOutline,
  IoPersonAddOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { hrService } from "@/services/hrService";
import { leaveRequestService } from "@/services/leaveRequestService";
import { accountService } from "@/services/accountService";
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

export default function HRDashboard() {
  const navigate = useNavigate();
  const { clinicId, branchId, currentUser, userData } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName =
    userData?.displayName ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "HR Manager";

  useEffect(() => {
    if (!clinicId) return;

    (async () => {
      try {
        setLoading(true);
        const [staffData, leavesData, billsData] = await Promise.all([
          hrService.getStaffByClinic(clinicId, branchId || undefined),
          leaveRequestService.getLeavesByClinic(
            clinicId,
            branchId || undefined,
          ),
          accountService.getBillsByClinic(clinicId, branchId || undefined),
        ]);

        setStaff(staffData);
        setLeaves(leavesData);
        setBills(billsData.filter((b) => b.category === "salary"));
      } catch (err) {
        console.error("HRDashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [clinicId, branchId]);

  if (loading)
    return (
      <div className="p-2">
        <PageSkeleton />
      </div>
    );

  const activeStaff = staff.filter((s) => s.status === "active");
  const pendingLeaves = leaves.filter((l) => l.status === "pending");
  const approvedLeaves = leaves.filter((l) => l.status === "approved");

  // Calculate this month's payroll
  const startOfThisMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  const thisMonthBills = bills.filter(
    (b) => new Date(b.billDate) >= startOfThisMonth,
  );
  const payrollTotal = thisMonthBills.reduce((sum, b) => sum + b.paidAmount, 0);

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
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                HR Operations
              </span>
            </div>
            <h2 className="text-[14px] font-black text-text-main leading-tight tracking-tight">
              {greeting}, <span className="text-primary">{displayName}!</span>{" "}
              👋
            </h2>
            <p className="text-[12px] text-text-muted mt-1 font-semibold max-w-[480px] leading-tight">
              You are managing{" "}
              <span className="text-text-main font-bold">
                {activeStaff.length} active staff members
              </span>
              {pendingLeaves.length > 0 && (
                <>
                  {" "}
                  and have{" "}
                  <span className="text-amber-500 font-bold">
                    {pendingLeaves.length} pending leave requests
                  </span>{" "}
                  to review
                </>
              )}
              .
            </p>
          </div>

          <div className="flex items-center gap-3">
            {[
              { label: "Active Staff", value: activeStaff.length },
              { label: "Pending Leaves", value: pendingLeaves.length },
              { label: "Total Staff", value: staff.length },
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
          href="/dashboard/hr"
          icon={<IoPeopleOutline />}
          label="Active Staff"
          sub="Currently employed"
          value={activeStaff.length}
        />
        <StatMini
          color="bg-amber-500/10 text-amber-500"
          href="/dashboard/hr"
          icon={<IoCalendarOutline />}
          label="Leave Requests"
          sub="Pending review"
          value={pendingLeaves.length}
        />
        <StatMini
          color="bg-green-500/10 text-green-500"
          href="/dashboard/hr"
          icon={<IoCheckmarkCircleOutline />}
          label="Approved Leaves"
          sub="All time"
          value={approvedLeaves.length}
        />
        <StatMini
          color="bg-purple-500/10 text-purple-600"
          href="/dashboard/hr"
          icon={<IoCashOutline />}
          label="Payroll (This Month)"
          sub="Total disbursed"
          value={`Rs. ${payrollTotal.toLocaleString()}`}
        />
      </div>

      {/* Main Content: Staff List + Recent Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Staff Directory Preview */}
        <motion.div
          className="lg:col-span-2 bg-surface border border-border-base rounded-[14px] overflow-hidden shadow-sm flex flex-col"
          variants={itemVariants}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-base">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <IoPeopleOutline className="w-4 h-4" />
              </div>
              <p className="text-[13px] font-bold text-text-main">
                Staff Directory
              </p>
            </div>
            <Link
              className="text-[11px] text-primary hover:text-primary/70 font-semibold flex items-center gap-0.5 no-underline transition-colors"
              to="/dashboard/hr"
            >
              Manage Staff <IoChevronForwardOutline className="w-3 h-3" />
            </Link>
          </div>

          {staff.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-14 opacity-40">
              <IoPersonAddOutline className="w-10 h-10 mb-2 text-text-muted" />
              <p className="text-[13px] font-semibold text-text-muted">
                No staff members found
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-base/60">
              {staff.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2/40 transition-colors cursor-pointer group"
                  onClick={() => navigate("/dashboard/hr")}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[13px] font-black shrink-0 overflow-hidden">
                    {s.photoUrl ? (
                      <img
                        alt={s.name}
                        className="w-full h-full object-cover"
                        src={s.photoUrl}
                      />
                    ) : (
                      (s.name?.[0]?.toUpperCase() ?? "S")
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-text-main truncate">
                      {s.name}
                    </p>
                    <p className="text-[11px] text-text-muted font-medium">
                      {s.role} · Joined{" "}
                      {format(new Date(s.joiningDate), "MMM yyyy")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      s.status === "active"
                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                        : s.status === "on-leave"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                    }`}
                  >
                    {s.status.toUpperCase()}
                  </span>
                  <IoChevronForwardOutline className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Sidebar: Pending Leaves + Quick Actions */}
        <div className="flex flex-col gap-4">
          {/* Quick Actions */}
          <motion.div
            className="bg-surface border border-border-base rounded-[14px] overflow-hidden shadow-sm p-4"
            variants={itemVariants}
          >
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-text-muted mb-3">
              HR Actions
            </p>
            <div className="flex flex-col gap-2">
              <Link
                className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all no-underline"
                to="/dashboard/hr"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <IoPersonAddOutline className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[12.5px] font-bold text-text-main">
                    Add Staff Member
                  </p>
                  <p className="text-[10px] text-text-muted">
                    Onboard new employee
                  </p>
                </div>
              </Link>
              <Link
                className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all no-underline"
                to="/dashboard/hr"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <IoCashOutline className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[12.5px] font-bold text-text-main">
                    Process Payroll
                  </p>
                  <p className="text-[10px] text-text-muted">
                    Manage staff salaries
                  </p>
                </div>
              </Link>
            </div>
          </motion.div>

          {/* Pending Leaves */}
          <motion.div
            className="bg-surface border border-border-base rounded-[14px] overflow-hidden shadow-sm flex-1"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-base">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <IoTimeOutline className="w-3.5 h-3.5" />
                </div>
                <p className="text-[12.5px] font-bold text-text-main">
                  Pending Leaves
                </p>
              </div>
            </div>
            {pendingLeaves.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center opacity-40">
                <IoCheckmarkCircleOutline className="w-8 h-8 mb-1 text-green-500" />
                <p className="text-[11px] text-text-muted">
                  No pending requests
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-base/50">
                {pendingLeaves.slice(0, 4).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors cursor-pointer"
                    onClick={() => navigate("/dashboard/hr")}
                  >
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-[12.5px] font-semibold text-text-main truncate">
                        {l.staffName}
                      </p>
                      <p className="text-[10.5px] text-text-muted line-clamp-1 mt-0.5">
                        {l.reason}
                      </p>
                      <p className="text-[9.5px] text-primary font-medium mt-1">
                        {format(new Date(l.startDate), "MMM d")} -{" "}
                        {format(new Date(l.endDate), "MMM d")} ({l.totalDays}{" "}
                        days)
                      </p>
                    </div>
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
