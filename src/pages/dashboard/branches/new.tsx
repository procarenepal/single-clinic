import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoStorefrontOutline,
  IoArrowBackOutline,
  IoSaveOutline,
  IoLocationOutline,
  IoCallOutline,
  IoMailOutline,
  IoCodeSlashOutline,
  IoTimeOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { branchService } from "@/services/branchService";

export default function NewBranchPage() {
  const navigate = useNavigate();
  const { clinicId, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    isMainBranch: false,
    operatingHours: {
      monday: { open: "09:00", close: "17:00", isOpen: true },
      tuesday: { open: "09:00", close: "17:00", isOpen: true },
      wednesday: { open: "09:00", close: "17:00", isOpen: true },
      thursday: { open: "09:00", close: "17:00", isOpen: true },
      friday: { open: "09:00", close: "17:00", isOpen: true },
      saturday: { open: "09:00", close: "13:00", isOpen: true },
      sunday: { open: "09:00", close: "13:00", isOpen: false },
    },
  });

  const isSystemOwner =
    userData?.role === "system-owner" ||
    userData?.role === "clinic-admin";

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOperatingHoursChange = (
    day: string,
    field: string,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day as keyof typeof prev.operatingHours],
          [field]: value,
        },
      },
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      addToast({
        title: "Validation Error",
        description: "Branch name is required",
        color: "warning",
      });

      return false;
    }
    if (!formData.code.trim()) {
      addToast({
        title: "Validation Error",
        description: "Branch code is required",
        color: "warning",
      });

      return false;
    }
    if (!formData.address.trim()) {
      addToast({
        title: "Validation Error",
        description: "Address is required",
        color: "warning",
      });

      return false;
    }
    if (!formData.city.trim()) {
      addToast({
        title: "Validation Error",
        description: "City is required",
        color: "warning",
      });

      return false;
    }
    if (!formData.phone.trim()) {
      addToast({
        title: "Validation Error",
        description: "Phone number is required",
        color: "warning",
      });

      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !validateForm()) return;

    try {
      setLoading(true);
      await branchService.createBranch({
        clinicId,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        isMainBranch: formData.isMainBranch,
        isActive: true,
        operatingHours: formData.operatingHours,
      });
      addToast({
        title: "Success",
        description: "Branch created successfully",
        color: "success",
      });
      navigate("/dashboard/branches");
    } catch (error: unknown) {
      console.error("Error creating branch:", error);
      addToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create branch",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isSystemOwner) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="clarity-card p-3 border-saffron-200 bg-saffron-50">
          <div className="flex items-center gap-3">
            <IoStorefrontOutline
              aria-hidden
              className="text-saffron-600 text-2xl shrink-0"
            />
            <div>
              <h3 className="text-base font-semibold text-saffron-800">
                Access Restricted
              </h3>
              <p className="text-sm text-saffron-700">
                Only clinic super administrators can create branches.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const dayLabels = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-3 space-y-6">
      <div className="clarity-page-header">
        <div>
          <h1 className="clarity-page-title">Create New Branch</h1>
          <p className="clarity-page-subtitle">
            Add a new branch location to your clinic
          </p>
        </div>
        <button
          className="clarity-btn clarity-btn-ghost"
          type="button"
          onClick={() => navigate("/dashboard/branches")}
        >
          <IoArrowBackOutline aria-hidden className="w-4 h-4" />
          Back to Branches
        </button>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="clarity-card overflow-hidden">
          <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
            <div className="flex items-center gap-3">
              <IoStorefrontOutline
                aria-hidden
                className="w-5 h-5 text-teal-700"
              />
              <h2 className="text-base font-semibold text-[rgb(var(--color-text))]">
                Basic Information
              </h2>
            </div>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-mountain-600 mb-1">
                  Branch Name
                </label>
                <div className="relative">
                  <IoStorefrontOutline
                    aria-hidden
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                  />
                  <input
                    aria-required
                    required
                    className="clarity-input with-left-icon w-full"
                    placeholder="e.g., Downtown Branch"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-mountain-600 mb-1">
                  Branch Code
                </label>
                <div className="relative">
                  <IoCodeSlashOutline
                    aria-hidden
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                  />
                  <input
                    aria-required
                    required
                    className="clarity-input with-left-icon w-full"
                    placeholder="e.g., DT, MB"
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      handleInputChange("code", e.target.value.toUpperCase())
                    }
                  />
                </div>
                <p className="text-xs text-mountain-500 mt-0.5">
                  Short unique identifier for this branch
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-mountain-600 mb-1">
                Address
              </label>
              <textarea
                aria-required
                required
                className="clarity-textarea w-full"
                placeholder="Enter branch address"
                rows={3}
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-mountain-600 mb-1">
                  City
                </label>
                <div className="relative">
                  <IoLocationOutline
                    aria-hidden
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                  />
                  <input
                    aria-required
                    required
                    className="clarity-input with-left-icon w-full"
                    placeholder="Enter city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-mountain-600 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <IoCallOutline
                    aria-hidden
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                  />
                  <input
                    aria-required
                    required
                    className="clarity-input with-left-icon w-full"
                    placeholder="e.g., 9801234567"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-mountain-600 mb-1">
                Email Address (Optional)
              </label>
              <div className="relative">
                <IoMailOutline
                  aria-hidden
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                />
                <input
                  className="clarity-input with-left-icon w-full"
                  placeholder="branch@clinic.com"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[rgb(var(--color-surface-2))] rounded-md border border-[rgb(var(--color-border))]">
              <div>
                <h4 className="font-medium text-[rgb(var(--color-text))]">
                  Set as Main Branch
                </h4>
                <p className="text-xs text-mountain-500 mt-0.5">
                  This will be the primary branch for your clinic
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  checked={formData.isMainBranch}
                  className="sr-only peer"
                  type="checkbox"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isMainBranch: e.target.checked,
                    }))
                  }
                />
                <span className="relative inline-block w-9 h-5 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] peer-checked:bg-teal-600 peer-checked:border-teal-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:border-[rgb(var(--color-border))] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          </div>
        </div>

        <div className="clarity-card overflow-hidden">
          <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
            <div className="flex items-center gap-3">
              <IoTimeOutline aria-hidden className="w-5 h-5 text-teal-700" />
              <h2 className="text-base font-semibold text-[rgb(var(--color-text))]">
                Operating Hours
              </h2>
            </div>
          </div>
          <div className="p-3 space-y-3">
            {days.map((day, index) => (
              <div
                key={day}
                className="flex items-center gap-4 p-3 bg-[rgb(var(--color-surface-2))] rounded-md"
              >
                <div className="w-24 shrink-0">
                  <p className="font-medium text-[rgb(var(--color-text))] text-sm">
                    {dayLabels[index]}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    checked={
                      formData.operatingHours[
                        day as keyof typeof formData.operatingHours
                      ]?.isOpen ?? false
                    }
                    className="sr-only peer"
                    type="checkbox"
                    onChange={(e) =>
                      handleOperatingHoursChange(
                        day,
                        "isOpen",
                        e.target.checked,
                      )
                    }
                  />
                  <span className="relative inline-block w-9 h-5 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] peer-checked:bg-health-600 peer-checked:border-health-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:border-[rgb(var(--color-border))] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
                {formData.operatingHours[
                  day as keyof typeof formData.operatingHours
                ]?.isOpen ? (
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`${dayLabels[index]} open time`}
                      className="clarity-input w-32"
                      type="time"
                      value={
                        formData.operatingHours[
                          day as keyof typeof formData.operatingHours
                        ]?.open ?? "09:00"
                      }
                      onChange={(e) =>
                        handleOperatingHoursChange(day, "open", e.target.value)
                      }
                    />
                    <span className="text-mountain-500 text-sm">to</span>
                    <input
                      aria-label={`${dayLabels[index]} close time`}
                      className="clarity-input w-32"
                      type="time"
                      value={
                        formData.operatingHours[
                          day as keyof typeof formData.operatingHours
                        ]?.close ?? "17:00"
                      }
                      onChange={(e) =>
                        handleOperatingHoursChange(day, "close", e.target.value)
                      }
                    />
                  </div>
                ) : (
                  <span className="text-mountain-400 text-sm">Closed</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="clarity-btn clarity-btn-ghost"
            type="button"
            onClick={() => navigate("/dashboard/branches")}
          >
            Cancel
          </button>
          <button
            className="clarity-btn clarity-btn-primary"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              "Creating…"
            ) : (
              <>
                <IoSaveOutline aria-hidden className="w-4 h-4" />
                Create Branch
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
