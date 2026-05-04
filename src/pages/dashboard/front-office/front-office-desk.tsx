import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { title } from "@/components/primitives";
import {
  IoPeopleOutline,
  IoCallOutline,
  IoTimeOutline,
  IoAddOutline,
  IoEyeOutline,
  IoCalendarOutline,
  IoPhonePortraitOutline,
} from "react-icons/io5";

import { useAuth } from "@/hooks/useAuth";
import { visitorService } from "@/services/visitorService";
import { callLogService } from "@/services/callLogService";
import { Visitor, CallLog } from "@/types/models";

export default function FrontOfficeDesk() {
  const navigate = useNavigate();
  const { clinicId } = useAuth();
  const [todaysVisitors, setTodaysVisitors] = useState<Visitor[]>([]);
  const [recentCallLogs, setRecentCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clinicId) {
      loadDashboardData();
    }
  }, [clinicId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [visitors, callLogs] = await Promise.all([
        visitorService.getTodaysVisitors(clinicId!),
        callLogService.getTodaysCallLogs(clinicId!),
      ]);

      setTodaysVisitors(visitors);
      setRecentCallLogs(callLogs);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96 text-[rgb(var(--color-text-muted))]">
        Loading front office data...
      </div>
    );
  }

  const incomingCount = recentCallLogs.filter(
    (log) => log.callType === "incoming",
  ).length;
  const outgoingCount = recentCallLogs.filter(
    (log) => log.callType === "outgoing",
  ).length;

  const StatCard = ({
    icon,
    label,
    value,
    colorClass,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    colorClass: string;
  }) => (
    <div className="clarity-card p-3 flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center ${colorClass}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{label}</p>
        <p className="text-xl font-bold text-[rgb(var(--color-text))]">
          {value}
        </p>
      </div>
    </div>
  );

  const InitialAvatar = ({
    name,
    accent,
  }: {
    name: string;
    accent: "teal" | "indigo" | "violet";
  }) => {
    const initial = name?.charAt(0)?.toUpperCase() || "?";
    const cls =
      accent === "teal"
        ? "bg-teal-100 text-teal-700"
        : accent === "indigo"
          ? "bg-indigo-100 text-indigo-700"
          : "bg-violet-100 text-violet-700";

    return (
      <div
        aria-hidden
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${cls}`}
      >
        {initial}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="clarity-page-header">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>Front Office Desk</h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage visitors and call logs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="clarity-btn clarity-btn-primary"
            type="button"
            onClick={() => navigate("/dashboard/front-office/manage-visitors")}
          >
            <IoAddOutline aria-hidden className="w-4 h-4" />
            Add Visitor
          </button>
          <button
            className="clarity-btn clarity-btn-ghost"
            type="button"
            onClick={() => navigate("/dashboard/front-office/manage-call-logs")}
          >
            <IoCallOutline aria-hidden className="w-4 h-4" />
            Log Call
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          colorClass="bg-teal-50"
          icon={
            <IoPeopleOutline aria-hidden className="w-5 h-5 text-teal-700" />
          }
          label="Today's Visitors"
          value={todaysVisitors.length}
        />
        <StatCard
          colorClass="bg-health-50"
          icon={
            <IoCallOutline aria-hidden className="w-5 h-5 text-health-700" />
          }
          label="Today's Calls"
          value={recentCallLogs.length}
        />
        <StatCard
          colorClass="bg-teal-50"
          icon={
            <IoPhonePortraitOutline
              aria-hidden
              className="w-5 h-5 text-teal-700"
            />
          }
          label="Incoming Calls"
          value={incomingCount}
        />
        <StatCard
          colorClass="bg-saffron-50"
          icon={
            <IoPhonePortraitOutline
              aria-hidden
              className="w-5 h-5 text-saffron-700"
            />
          }
          label="Outgoing Calls"
          value={outgoingCount}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="clarity-card p-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <InitialAvatar accent="indigo" name="Visitor" />
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--color-text))]">
                Visitor Management
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Register and track visitors
              </p>
            </div>
          </div>
          <div className="clarity-divider" />
          <div className="flex gap-2">
            <button
              className="clarity-btn clarity-btn-primary"
              type="button"
              onClick={() =>
                navigate("/dashboard/front-office/manage-visitors")
              }
            >
              <IoAddOutline aria-hidden className="w-4 h-4" />
              Add Visitor
            </button>
            <button
              className="clarity-btn clarity-btn-ghost"
              type="button"
              onClick={() =>
                navigate("/dashboard/front-office/manage-visitors")
              }
            >
              <IoEyeOutline aria-hidden className="w-4 h-4" />
              View All
            </button>
          </div>
        </div>

        <div className="clarity-card p-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <InitialAvatar accent="violet" name="Call" />
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--color-text))]">
                Call Log Management
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Track incoming and outgoing calls
              </p>
            </div>
          </div>
          <div className="clarity-divider" />
          <div className="flex gap-2">
            <button
              className="clarity-btn clarity-btn-primary"
              type="button"
              onClick={() =>
                navigate("/dashboard/front-office/manage-call-logs")
              }
            >
              <IoAddOutline aria-hidden className="w-4 h-4" />
              Log Call
            </button>
            <button
              className="clarity-btn clarity-btn-ghost"
              type="button"
              onClick={() =>
                navigate("/dashboard/front-office/manage-call-logs")
              }
            >
              <IoEyeOutline aria-hidden className="w-4 h-4" />
              View All
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Today's Visitors */}
        <div className="clarity-card p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <IoPeopleOutline aria-hidden className="w-5 h-5 text-teal-700" />
              <h3 className="text-sm font-semibold text-[rgb(var(--color-text))]">
                Today's Visitors
              </h3>
            </div>
            <button
              className="clarity-btn clarity-btn-ghost h-8 px-2 text-xs"
              type="button"
              onClick={() =>
                navigate("/dashboard/front-office/manage-visitors")
              }
            >
              View All
              <IoCalendarOutline aria-hidden className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="clarity-divider" />
          {todaysVisitors.length === 0 ? (
            <div className="text-center py-6 text-[rgb(var(--color-text-muted))]">
              <IoPeopleOutline
                aria-hidden
                className="w-10 h-10 mx-auto mb-2 opacity-60"
              />
              <p>No visitors today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todaysVisitors.slice(0, 5).map((visitor) => (
                <div
                  key={visitor.id}
                  className="flex items-center justify-between px-2 py-2 rounded bg-[rgb(var(--color-surface-2))]"
                >
                  <div className="flex items-center gap-3">
                    <InitialAvatar accent="teal" name={visitor.name} />
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--color-text))]">
                        {visitor.name}
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))]">
                        {visitor.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="clarity-badge bg-teal-100 text-teal-700 inline-block">
                      {visitor.purpose}
                    </span>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <IoTimeOutline
                        aria-hidden
                        className="w-3 h-3 text-[rgb(var(--color-text-muted))]"
                      />
                      <span className="text-xs text-[rgb(var(--color-text-muted))]">
                        {formatTime(visitor.date)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Call Logs */}
        <div className="clarity-card p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <IoCallOutline aria-hidden className="w-5 h-5 text-health-700" />
              <h3 className="text-sm font-semibold text-[rgb(var(--color-text))]">
                Recent Call Logs
              </h3>
            </div>
            <button
              className="clarity-btn clarity-btn-ghost h-8 px-2 text-xs"
              type="button"
              onClick={() =>
                navigate("/dashboard/front-office/manage-call-logs")
              }
            >
              View All
              <IoCalendarOutline aria-hidden className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="clarity-divider" />
          {recentCallLogs.length === 0 ? (
            <div className="text-center py-6 text-[rgb(var(--color-text-muted))]">
              <IoCallOutline
                aria-hidden
                className="w-10 h-10 mx-auto mb-2 opacity-60"
              />
              <p>No calls logged today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCallLogs.slice(0, 5).map((callLog) => (
                <div
                  key={callLog.id}
                  className="flex items-center justify-between px-2 py-2 rounded bg-[rgb(var(--color-surface-2))]"
                >
                  <div className="flex items-center gap-3">
                    <InitialAvatar accent="indigo" name={callLog.name} />
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--color-text))]">
                        {callLog.name}
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))]">
                        {callLog.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`clarity-badge inline-block ${
                        callLog.callType === "incoming"
                          ? "bg-health-100 text-health-700"
                          : "bg-saffron-100 text-saffron-700"
                      }`}
                    >
                      {callLog.callType}
                    </span>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <IoTimeOutline
                        aria-hidden
                        className="w-3 h-3 text-[rgb(var(--color-text-muted))]"
                      />
                      <span className="text-xs text-[rgb(var(--color-text-muted))]">
                        {formatTime(callLog.receivedOn)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
