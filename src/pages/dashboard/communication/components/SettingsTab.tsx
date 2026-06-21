import React, { useState, useEffect } from "react";
import { RefreshCwIcon } from "lucide-react";

import { addToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import {
  getSMSSettings,
  updateSMSSettings,
  createDefaultSMSSettings,
  SMSSettings,
  smsService,
} from "@/services/sendMessageService";
import { appointmentTypeService } from "@/services/appointmentTypeService";

interface AppointmentType {
  id: string;
  name: string;
  clinicId: string;
}

const SettingsTab: React.FC = () => {
  const { clinicId, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SMSSettings | null>(null);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );

  const [enableReminders, setEnableReminders] = useState(true);
  const [reminderHours, setReminderHours] = useState(24);
  const [maxDailySMS, setMaxDailySMS] = useState(100);
  const [smsAppointmentTypes, setSmsAppointmentTypes] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [campaign, setCampaign] = useState("9569");
  const [routeId, setRouteId] = useState("10255");

  useEffect(() => {
    const loadData = async () => {
      if (!clinicId) return;
      setLoading(true);
      try {
        await refreshUsage();
        const appointmentTypesData =
          await appointmentTypeService.getAppointmentTypes(clinicId);

        setAppointmentTypes(appointmentTypesData);
      } catch (error) {
        console.error("Error loading settings:", error);
        addToast({
          title: "Error",
          description: "Failed to load settings. Please try again.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clinicId]);

  const refreshUsage = async () => {
    if (clinicId) {
      const [updatedSettings, logs] = await Promise.all([
        getSMSSettings(clinicId),
        smsService.getSMSLogs(clinicId, undefined, 500),
      ]);

      if (updatedSettings) {
        const today = new Date().toDateString();
        const todayCount = logs.filter(
          (l) =>
            new Date(l.createdAt).toDateString() === today &&
            l.status === "sent",
        ).length;

        setSettings({
          ...updatedSettings,
          currentDailySMS: todayCount,
        });

        // Sync local states
        setEnableReminders(updatedSettings.enableReminders);
        setReminderHours(updatedSettings.reminderHours);
        setMaxDailySMS(updatedSettings.maxDailySMS);
        setSmsAppointmentTypes(
          Array.isArray(updatedSettings.smsAppointmentTypes)
            ? updatedSettings.smsAppointmentTypes
            : updatedSettings.smsAppointmentType
              ? [updatedSettings.smsAppointmentType]
              : [],
        );
        setApiKey(updatedSettings.apiKey || "");
        setApiUrl(updatedSettings.apiUrl || "");
        setCampaign(updatedSettings.campaign || "9569");
        setRouteId(updatedSettings.routeId || "10255");
      } else {
        await createDefaultSMSSettings(
          clinicId,
          null,
          currentUser?.uid || "system",
        );
        const freshSettings = await getSMSSettings(clinicId);

        if (freshSettings) {
          setSettings(freshSettings);
          setEnableReminders(freshSettings.enableReminders);
          setReminderHours(freshSettings.reminderHours);
          setMaxDailySMS(freshSettings.maxDailySMS);
          setApiKey(freshSettings.apiKey || "");
          setApiUrl(freshSettings.apiUrl || "");
          setCampaign(freshSettings.campaign || "9569");
          setRouteId(freshSettings.routeId || "10255");
        }
      }
    }
  };

  const handleSaveSettings = async () => {
    if (!clinicId) {
      addToast({
        title: "Error",
        description: "Clinic ID not found.",
        color: "danger",
      });

      return;
    }
    setSaving(true);
    try {
      const updatedSettings: Partial<SMSSettings> = {
        enableReminders,
        reminderHours,
        maxDailySMS,
        smsAppointmentTypes,
        apiKey,
        apiUrl,
        campaign,
        routeId,
      };

      await updateSMSSettings(
        clinicId,
        updatedSettings,
        currentUser?.uid || "system",
      );
      setSettings((prev) => (prev ? { ...prev, ...updatedSettings } : null));
      addToast({
        title: "Success",
        description: "Settings saved successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      addToast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setEnableReminders(true);
    setReminderHours(24);
    setMaxDailySMS(100);
    setSmsAppointmentTypes([]);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 text-[rgb(var(--color-text-muted))]">
        <div className="flex flex-col items-center gap-2">
          <RefreshCwIcon className="animate-spin text-primary" size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Initialising Console...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
          <RefreshCwIcon className="text-primary" size={12} />
          SMS Configuration
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-bold text-text-muted uppercase mb-1 tracking-wide">
              Max Daily SMS
            </label>
            <input
              aria-label="Max daily SMS"
              className="clarity-input w-full text-[11px] h-8"
              max={10000}
              min={1}
              type="number"
              value={maxDailySMS}
              onChange={(e) => setMaxDailySMS(parseInt(e.target.value) || 100)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wide">
                Current Usage
              </span>
              <button
                aria-label="Refresh usage"
                className="clarity-btn clarity-btn-ghost h-6 w-6 p-0 justify-center"
                type="button"
                onClick={refreshUsage}
              >
                <RefreshCwIcon aria-hidden size={12} />
              </button>
            </div>
            <div className="text-[11px] font-bold text-text-main">
              {settings?.currentDailySMS || 0} / {maxDailySMS} SMS sent today
            </div>
            <div className="w-full h-1 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (settings?.currentDailySMS || 0) / maxDailySMS > 0.9
                    ? "bg-rose-500"
                    : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(((settings?.currentDailySMS || 0) / maxDailySMS) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="text-[8px] font-bold text-text-muted uppercase">
              {maxDailySMS - (settings?.currentDailySMS || 0)} SMS remaining
              today
            </div>
          </div>
        </div>

        {settings?.smsBalance !== undefined && (
          <div className="clarity-card p-3 bg-teal-500/10 border-teal-500/20">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-teal-500 uppercase tracking-widest">
                  SMS Account Balance
                </span>
                <button
                  className="p-1 text-teal-500 hover:bg-teal-500/20 rounded transition-colors"
                  disabled={loading}
                  title="Sync live balance"
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const balance = await smsService.getSMSBalance(
                        settings.apiKey,
                        settings.apiUrl,
                      );

                      if (balance !== null) {
                        await updateSMSSettings(
                          clinicId!,
                          { smsBalance: balance },
                          currentUser?.uid || "system",
                        );
                        await refreshUsage();
                        addToast({
                          title: "Balance Synced",
                          description: `Your live balance is Rs. ${balance}`,
                          color: "success",
                        });
                      } else {
                        addToast({
                          title: "Sync Failed",
                          description: "Could not fetch balance from provider.",
                          color: "danger",
                        });
                      }
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <RefreshCwIcon
                    className={loading ? "animate-spin" : ""}
                    size={10}
                  />
                </button>
              </div>
              <span className="text-[8px] bg-teal-500/20 text-teal-400 px-1 py-0.5 rounded font-bold uppercase tracking-tighter">
                Live
              </span>
            </div>
            <div
              className="text-base font-bold text-teal-400 cursor-pointer hover:text-teal-300 transition-colors group flex items-center gap-2"
              title="Click to edit manually"
              onClick={() => {
                const manual = window.prompt(
                  "Enter your current SMS balance (Rs.):",
                  settings.smsBalance.toString(),
                );

                if (manual !== null) {
                  const val = parseFloat(manual);

                  if (!isNaN(val)) {
                    updateSMSSettings(
                      clinicId!,
                      { smsBalance: val },
                      currentUser?.uid || "system",
                    ).then(() => {
                      refreshUsage();
                      addToast({
                        title: "Balance Updated",
                        description: `Balance manually set to Rs. ${val}`,
                        color: "success",
                      });
                    });
                  }
                }
              }}
            >
              Rs. {settings.smsBalance.toLocaleString()}
              <span className="text-[9px] opacity-0 group-hover:opacity-100 text-teal-500 font-medium tracking-tight">
                (Click to edit)
              </span>
            </div>
            <p className="text-[9px] text-teal-500/80 mt-0.5 font-bold uppercase tracking-tight">
              ~{Math.floor(settings.smsBalance / 1.5)} SMS messages remaining
            </p>
          </div>
        )}

        <button
          className="text-[9px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-widest"
          type="button"
          onClick={handleResetDefaults}
        >
          Reset to default settings
        </button>
      </div>

      <div className="pt-4 border-t border-border-base">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
          SMS Provider Configuration
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-bold text-text-muted uppercase mb-1 tracking-wide">
              SMS Provider URL
            </label>
            <input
              className="clarity-input w-full text-[11px] h-8"
              placeholder="e.g. http://api.sparrowsms.com/v2/sms/"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-text-muted uppercase mb-1 tracking-wide">
              SMS API Key / Token
            </label>
            <input
              className="clarity-input w-full text-[11px] h-8"
              placeholder="Your API secret token"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-[9px] font-bold text-text-muted uppercase mb-1 tracking-wide">
              SMS Campaign ID (Required for Custom Sender Name)
            </label>
            <input
              className="clarity-input w-full text-[11px] h-8"
              placeholder="e.g. 9569"
              type="text"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-text-muted uppercase mb-1 tracking-wide">
              SMS Route ID (Required for Custom Sender Name)
            </label>
            <input
              className="clarity-input w-full text-[11px] h-8"
              placeholder="e.g. 10255"
              type="text"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-border-base">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
          Appointment Reminders
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              checked={enableReminders}
              className="h-3.5 w-3.5 rounded border-border-base text-primary focus:ring-primary"
              id="enable-reminders"
              type="checkbox"
              onChange={(e) => setEnableReminders(e.target.checked)}
            />
            <label
              className="text-[10px] font-bold text-text-main uppercase tracking-wide"
              htmlFor="enable-reminders"
            >
              Enable automatic reminders
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold text-text-muted uppercase mb-1 tracking-wide">
                Send reminders (hours before)
              </label>
              <select
                className="clarity-input w-full text-[11px] h-8"
                value={reminderHours}
                onChange={(e) => setReminderHours(parseInt(e.target.value))}
              >
                <option value={12}>12 hours before</option>
                <option value={24}>24 hours before</option>
                <option value={48}>48 hours before</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-text-muted uppercase mb-2 tracking-wide">
              Applicable Appointment Categories
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {appointmentTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center gap-2 p-1.5 rounded border border-border-base bg-surface-1"
                >
                  <input
                    checked={smsAppointmentTypes.includes(type.id)}
                    className="h-3 w-3 rounded border-border-base text-primary focus:ring-primary"
                    id={`type-${type.id}`}
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSmsAppointmentTypes((prev) => [...prev, type.id]);
                      } else {
                        setSmsAppointmentTypes((prev) =>
                          prev.filter((id) => id !== type.id),
                        );
                      }
                    }}
                  />
                  <label
                    className="text-[9px] font-bold text-text-main uppercase truncate"
                    htmlFor={`type-${type.id}`}
                  >
                    {type.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-border-base flex justify-end">
        <button
          className="clarity-btn clarity-btn-primary min-w-[140px] h-8 justify-center text-[10px] uppercase font-bold tracking-widest"
          disabled={saving}
          type="button"
          onClick={handleSaveSettings}
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
