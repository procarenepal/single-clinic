import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  IoPeopleOutline,
  IoBusinessOutline,
  IoTimeOutline,
  IoDocumentTextOutline,
  IoStarOutline,
  IoChevronForwardOutline,
  IoLinkOutline,
} from "react-icons/io5";

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  category: "general" | "clinic" | "security" | "advanced";
}

const settingsSections: SettingsSection[] = [
  // {
  //   id: "theme",
  //   title: "Theme & Appearance",
  //   description: "Customize dashboard theme, colors, and visual preferences",
  //   icon: <IoColorPaletteOutline className="w-6 h-6" />,
  //   href: "/dashboard/settings/theme",
  //   category: "general",
  // },
  {
    id: "clinic-info",
    title: "Clinic Information",
    description: "Update clinic details, contact info, and operating hours",
    icon: <IoBusinessOutline className="w-6 h-6" />,
    href: "/dashboard/settings/clinic",
    category: "clinic",
  },
  {
    id: "staff-management",
    title: "Staff & User Management",
    description: "Manage clinic staff, roles, and permissions",
    icon: <IoPeopleOutline className="w-6 h-6" />,
    href: "/dashboard/settings/staff",
    category: "clinic",
  },
  {
    id: "appointment-settings",
    title: "Appointment Configuration",
    description: "Set appointment types, durations, and booking rules",
    icon: <IoTimeOutline className="w-6 h-6" />,
    href: "/dashboard/settings/appointments",
    category: "clinic",
  },
  {
    id: "medical-report-fields",
    title: "Medical Report Fields",
    description: "Configure custom fields for patient medical reports",
    icon: <IoDocumentTextOutline className="w-6 h-6" />,
    href: "/dashboard/settings/medical-report-fields",
    category: "clinic",
  },
  {
    id: "notes-sections",
    title: "Notes Sections",
    description: "Configure customizable note sections for patient records",
    icon: <IoDocumentTextOutline className="w-6 h-6" />,
    href: "/dashboard/settings/notes-sections",
    category: "clinic",
  },
  {
    id: "doctor-speciality",
    title: "Manage Doctor Speciality",
    description: "Configure medical specialties and subspecialties for doctors",
    icon: <IoStarOutline className="w-6 h-6" />,
    href: "/dashboard/settings/doctor-speciality",
    category: "clinic",
  },
  {
    id: "print-layout",
    title: "Print Layout Configuration",
    description:
      "Configure clinic letterhead, logo, and layout for receipts, prescriptions, and reports",
    icon: <IoDocumentTextOutline className="w-6 h-6" />,
    href: "/dashboard/settings/print-layout",
    category: "clinic",
  },
  {
    id: "referral-partners",
    title: "Referral Partners",
    description: "Manage external referral sources and commission rates",
    icon: <IoLinkOutline className="w-6 h-6" />,
    href: "/dashboard/settings/referral-partners",
    category: "clinic",
  },
  {
    id: "homepage-management",
    title: "Homepage Management",
    description: "Customize the public landing page for your clinic",
    icon: <IoBusinessOutline className="w-6 h-6" />,
    href: "/dashboard/settings/homepage",
    category: "clinic",
  },
];

const categoryLabels: Record<string, string> = {
  general: "System Settings",
};

export default function SettingsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredSections =
    selectedCategory === "all"
      ? settingsSections
      : settingsSections.filter(
        (section) => section.category === selectedCategory,
      );

  return (
    <div className="flex flex-col gap-4">
      {/* Page header — spec: clarity-page-header */}
      <div className="clarity-page-header">
        <div>
          <h1 className="clarity-page-title">Settings</h1>
          <p className="clarity-page-subtitle">
            Manage your clinic settings and preferences
          </p>
        </div>
        <div className="flex gap-2" />
      </div>


      {/* Settings Sections */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {settingsSections.map((section) => (
            <RouterLink
              key={section.id}
              className="clarity-card p-3 block group border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface-2))] hover:border-[rgb(var(--color-primary-hover))] transition-colors duration-200 rounded-[var(--card-radius)]"
              to={section.href}
            >
              <div className="flex gap-3 pb-2">
                <div className="flex-shrink-0 p-2 rounded-lg bg-[rgb(var(--color-primary-light))] text-[rgb(var(--color-primary))] transition-colors">
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-[13px] text-[rgb(var(--color-text))] truncate">
                    {section.title}
                  </h4>
                </div>
              </div>
              <p className="text-sm text-[rgb(var(--color-text-muted))] mb-3 line-clamp-2">
                {section.description}
              </p>
              <div className="flex items-center justify-end">
                <span className="clarity-btn clarity-btn-tinted opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                  Configure
                  <IoChevronForwardOutline className="w-4 h-4" />
                </span>
              </div>
            </RouterLink>
          ))}
        </div>
      </div>
    </div>
  );
}
