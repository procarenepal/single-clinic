import React, { useState, useEffect } from "react";
import {
  IoChatbubbleEllipsesOutline,
  IoClipboardOutline,
  IoSettingsOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoStatsChartOutline,
  IoCalendarOutline,
  IoLayersOutline,
  IoSyncOutline,
} from "react-icons/io5";

import SendSMSTab from "./components/SendSMSTab";
import ViewSMSLogsTab from "./components/ViewSMSLogsTab";
import SettingsTab from "./components/SettingsTab";
import SMSTemplatesTab from "./components/SMSTemplatesTab";
import BulkMessagingTab from "./components/BulkMessagingTab";

import { useAuth } from "@/hooks/useAuth";
import {
  smsService,
  getSMSSettings,
  SMSSettings,
} from "@/services/sendMessageService";
import { title } from "@/components/primitives";

type TabKey = "send-sms" | "bulk-sms" | "templates" | "sms-logs" | "settings";

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "send-sms",
    label: "Send SMS",
    icon: <IoChatbubbleEllipsesOutline aria-hidden size={16} />,
  },
  {
    key: "bulk-sms",
    label: "Bulk SMS",
    icon: <IoLayersOutline aria-hidden size={16} />,
  },
  {
    key: "templates",
    label: "Templates",
    icon: <IoClipboardOutline aria-hidden size={16} />,
  },
  {
    key: "sms-logs",
    label: "SMS Logs",
    icon: <IoStatsChartOutline aria-hidden size={16} />,
  },
  {
    key: "settings",
    label: "Settings",
    icon: <IoSettingsOutline aria-hidden size={16} />,
  },
];

const CommunicationPage: React.FC = () => {
  const { clinicId, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("send-sms");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SMSSettings | null>(null);
  const [stats, setStats] = useState({
    sentToday: 0,
    totalHistory: 0,
    failedLogs: 0,
    usagePercent: 0,
  });

  useEffect(() => {
    if (!clinicId) return;

    const loadGlobalStats = async () => {
      try {
        const [logs, smsSettings] = await Promise.all([
          smsService.getSMSLogs(clinicId, undefined, 500),
          getSMSSettings(clinicId),
        ]);

        const today = new Date().toDateString();
        const todayLogs = logs.filter(
          (l) => new Date(l.createdAt).toDateString() === today,
        );
        const sentTodayCount = todayLogs.filter(
          (l) => l.status === "sent",
        ).length;
        const dailyLimit = smsSettings?.maxDailySMS || 100;

        setStats({
          sentToday: sentTodayCount,
          totalHistory: logs.length,
          failedLogs: logs.filter((l) => l.status === "failed").length,
          usagePercent: Math.round((sentTodayCount / dailyLimit) * 100),
        });
        setSettings(smsSettings);
      } catch (error) {
        console.error("Error loading communication stats:", error);
      }
    };

    loadGlobalStats();
  }, [clinicId, activeTab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={title()}>Communication</h1>
          <p className="text-default-500">
            Manage SMS communications with patients and doctors
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-success-50 text-success-700 rounded-md border border-success-100 font-bold text-[10px] uppercase tracking-wider">
            <IoCheckmarkCircleOutline size={14} />
            Service: Online
          </div>
          <button className="clarity-btn clarity-btn-ghost text-[10px] uppercase font-bold tracking-wider">
            <IoSyncOutline className="animate-spin-slow" size={14} />
            Process Reminders
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="clarity-card p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-50 text-primary rounded-lg">
            <IoChatbubbleEllipsesOutline size={20} />
          </div>
          <div>
            <p className="text-xl font-bold">{stats.sentToday}</p>
            <p className="text-[10px] text-default-500 uppercase font-bold tracking-tight">
              Sent Today
            </p>
          </div>
        </div>
        <div className="clarity-card p-4 flex items-center gap-4">
          <div className="p-3 bg-secondary-50 text-secondary rounded-lg">
            <IoStatsChartOutline size={20} />
          </div>
          <div>
            <p className="text-xl font-bold">{stats.totalHistory}</p>
            <p className="text-[10px] text-default-500 uppercase font-bold tracking-tight">
              Total History
            </p>
          </div>
        </div>
        <div className="clarity-card p-4 flex items-center gap-4">
          <div className="p-3 bg-danger-50 text-danger rounded-lg">
            <IoAlertCircleOutline size={20} />
          </div>
          <div>
            <p className="text-xl font-bold">{stats.failedLogs}</p>
            <p className="text-[10px] text-default-500 uppercase font-bold tracking-tight">
              Failed Logs
            </p>
          </div>
        </div>
        <div className="clarity-card p-4 flex items-center gap-4">
          <div className="p-3 bg-warning-50 text-warning rounded-lg">
            <IoCalendarOutline size={20} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <p className="text-xl font-bold">{stats.usagePercent}%</p>
              <p className="text-[10px] text-default-500 uppercase font-bold tracking-tight self-end">
                Daily Limit
              </p>
            </div>
            <div className="w-full bg-default-100 rounded-full h-1.5">
              <div
                className="bg-warning h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.usagePercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="clarity-card overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-border-base bg-surface-2/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`flex items-center gap-2 px-6 py-3 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === tab.key
                  ? "border-primary text-primary bg-surface-base"
                  : "border-transparent text-text-muted hover:text-text-main hover:bg-surface-2"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === "send-sms" && <SendSMSTab />}
          {activeTab === "bulk-sms" && <BulkMessagingTab />}
          {activeTab === "templates" && <SMSTemplatesTab />}
          {activeTab === "sms-logs" && <ViewSMSLogsTab />}
          {activeTab === "settings" && <SettingsTab />}
        </div>
      </div>
    </div>
  );
};

export default CommunicationPage;
