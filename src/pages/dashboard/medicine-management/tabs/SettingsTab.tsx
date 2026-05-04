import React, { useEffect, useState } from "react";
import {
  IoSaveOutline,
  IoWarningOutline,
  IoCashOutline,
  IoNotificationsOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { clinicSettingsService } from "@/services/clinicSettingsService";
import { useAuthContext } from "@/context/AuthContext";

interface MedicineSettings {
  canSellMedicines: boolean;
  enableInventoryManagement: boolean;
  enableLowStockAlerts: boolean;
  lowStockThreshold: number;
  enableExpiryAlerts: boolean;
  expiryAlertDays: number;
}

interface SettingsTabProps {
  clinicSettings: any;
  onSettingsChange: (settings: any) => void;
}

function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`relative inline-flex items-center h-5 w-9 shrink-0 rounded-full border transition-all duration-200 focus:outline-none ${
        checked
          ? "border-primary bg-primary"
          : "border-border-base bg-mountain-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-border-focus"}`}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  clinicSettings,
  onSettingsChange,
}) => {
  const { clinicId, userData } = useAuthContext();
  const [settings, setSettings] = useState<MedicineSettings>({
    canSellMedicines: false,
    enableInventoryManagement: false,
    enableLowStockAlerts: false,
    lowStockThreshold: 10,
    enableExpiryAlerts: false,
    expiryAlertDays: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clinicId && clinicSettings) {
      loadSettings();
    }
  }, [clinicId, clinicSettings]);

  const loadSettings = async () => {
    try {
      setLoading(true);

      setSettings({
        canSellMedicines: clinicSettings?.sellsMedicines || false,
        enableInventoryManagement: clinicSettings?.enableInventoryManagement || false,
        enableLowStockAlerts: clinicSettings?.enableLowStockAlerts || false,
        lowStockThreshold: clinicSettings?.lowStockThreshold || 10,
        enableExpiryAlerts: clinicSettings?.enableExpiryAlerts || false,
        expiryAlertDays: clinicSettings?.expiryAlertDays || 30,
      });
    } catch (error) {
      console.error("Error loading settings:", error);
      addToast({
        title: "Error",
        description: "Failed to load settings",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clinicId || !userData?.id) return;

    try {
      setSaving(true);

      const settingsData = {
        clinicId,
        sellsMedicines: settings.canSellMedicines,
        enableInventoryManagement: settings.enableInventoryManagement,
        enableLowStockAlerts: settings.enableLowStockAlerts,
        lowStockThreshold: settings.lowStockThreshold,
        enableExpiryAlerts: settings.enableExpiryAlerts,
        expiryAlertDays: settings.expiryAlertDays,
        allowNegativeStock: false,
        requireBatchTracking: false,
        requireExpiryTracking: false,
        autoGenerateBarcode: false,
        updatedBy: userData.id,
      };

      await clinicSettingsService.upsertClinicSettings(settingsData);

      const updatedClinicSettings = {
        ...clinicSettings,
        sellsMedicines: settings.canSellMedicines,
        enableInventoryManagement: settings.enableInventoryManagement,
        enableLowStockAlerts: settings.enableLowStockAlerts,
        lowStockThreshold: settings.lowStockThreshold,
        enableExpiryAlerts: settings.enableExpiryAlerts,
        expiryAlertDays: settings.expiryAlertDays,
      };

      onSettingsChange(updatedClinicSettings);

      addToast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      addToast({
        title: "Error",
        description: "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (key: keyof MedicineSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-2 text-text-muted text-[12.5px]">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-text-main tracking-tight">
            Medicine Settings
          </h2>
          <p className="text-[12.5px] text-text-muted mt-1">
            Configure your clinic's medicine management settings
          </p>
        </div>
        <button
          className="clarity-btn clarity-btn-primary inline-flex items-center gap-1.5"
          disabled={saving}
          type="button"
          onClick={handleSave}
        >
          <IoSaveOutline className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Settings"}</span>
        </button>
      </div>

      {/* Medicine Sales Settings */}
      <div className="bg-surface border border-border-base rounded overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-base bg-surface-2/50">
          <IoCashOutline className="text-primary w-5 h-5" />
          <h3 className="text-[13px] font-semibold text-text-main">
            Medicine Sales
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div>
              <p className="text-[13px] font-medium text-text-main">
                Enable Medicine Sales
              </p>
              <p className="text-[12px] text-text-muted mt-0.5">
                Allow selling medicines and generate invoices
              </p>
            </div>
            <Toggle
              aria-label="Enable medicine sales"
              checked={settings.canSellMedicines}
              onChange={(value) =>
                handleSettingChange("canSellMedicines", value)
              }
            />
          </div>

          <div className="flex justify-between items-center gap-4 pt-4 border-t border-border-base">
            <div>
              <p className="text-[13px] font-medium text-text-main">
                Enable Inventory Management
              </p>
              <p className="text-[12px] text-text-muted mt-0.5">
                Track stock levels, batches, and expiries
              </p>
            </div>
            <Toggle
              aria-label="Enable inventory management"
              checked={settings.enableInventoryManagement}
              onChange={(value) =>
                handleSettingChange("enableInventoryManagement", value)
              }
            />
          </div>
        </div>
      </div>

      {/* Alert Settings */}
      <div className="bg-surface border border-border-base rounded overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-base bg-surface-2/50">
          <IoNotificationsOutline className="text-primary w-5 h-5" />
          <h3 className="text-[13px] font-semibold text-text-main">
            Alert Settings
          </h3>
        </div>
        <div className="p-4 space-y-6">
          {/* Low Stock Alerts */}
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div>
                <p className="text-[13px] font-medium text-text-main">
                  Low Stock Alerts
                </p>
                <p className="text-[12px] text-text-muted mt-0.5">
                  Get notified when medicines are running low
                </p>
              </div>
              <Toggle
                aria-label="Enable low stock alerts"
                checked={settings.enableLowStockAlerts}
                onChange={(value) =>
                  handleSettingChange("enableLowStockAlerts", value)
                }
              />
            </div>

            {settings.enableLowStockAlerts && (
              <div className="ml-1 pl-4 border-l-2 border-border-base">
                <label className="text-sm font-medium text-text-muted mb-1.5 block">
                  Alert Threshold (minimum stock quantity)
                </label>
                <input
                  className="clarity-input h-8 w-full max-w-xs text-[13px] px-2"
                  min={0}
                  placeholder="Enter threshold quantity"
                  type="number"
                  value={settings.lowStockThreshold}
                  onChange={(e) =>
                    handleSettingChange(
                      "lowStockThreshold",
                      parseInt(e.target.value, 10) || 0,
                    )
                  }
                />
                <p className="text-[11.5px] text-text-muted/70 mt-1">
                  Alert when stock falls below this quantity
                </p>
              </div>
            )}
          </div>

          {/* Expiry Alerts */}
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div>
                <p className="text-[13px] font-medium text-text-main">
                  Expiry Alerts
                </p>
                <p className="text-[12px] text-text-muted mt-0.5">
                  Get notified when medicines are about to expire
                </p>
              </div>
              <Toggle
                aria-label="Enable expiry alerts"
                checked={settings.enableExpiryAlerts}
                onChange={(value) =>
                  handleSettingChange("enableExpiryAlerts", value)
                }
              />
            </div>

            {settings.enableExpiryAlerts && (
              <div className="ml-1 pl-4 border-l-2 border-border-base">
                <label className="text-sm font-medium text-text-muted mb-1.5 block">
                  Alert Days Before Expiry
                </label>
                <input
                  className="clarity-input h-8 w-full max-w-xs text-[13px] px-2"
                  max={365}
                  min={1}
                  placeholder="Enter number of days"
                  type="number"
                  value={settings.expiryAlertDays}
                  onChange={(e) =>
                    handleSettingChange(
                      "expiryAlertDays",
                      parseInt(e.target.value, 10) || 30,
                    )
                  }
                />
                <p className="text-[11.5px] text-text-muted/70 mt-1">
                  Alert this many days before medicines expire
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warning Card */}
      {!settings.canSellMedicines && (
        <div className="bg-amber-900/20 border border-amber-900/30 rounded p-4">
          <div className="flex items-start gap-3">
            <IoWarningOutline className="text-amber-600 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[13px] font-semibold text-amber-800">
                Prescription-Only Mode
              </h4>
              <p className="text-[12.5px] text-amber-200/80 mt-1">
                Medicine sales are disabled. Your clinic is configured for
                prescription-only mode. Enable medicine sales above to access
                full inventory and billing features.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
