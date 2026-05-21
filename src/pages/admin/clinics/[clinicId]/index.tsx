import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Tab, Tabs } from "@heroui/tabs";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Switch } from "@heroui/switch";
import { Spinner } from "@heroui/spinner";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { addToast } from "@heroui/toast";
import {
  IoBusinessOutline,
  IoSettingsOutline,
  IoStatsChartOutline,
  IoPeopleOutline,
  IoWalletOutline,
  IoStorefrontOutline,
} from "react-icons/io5";
import { Chip } from "@heroui/chip";

import { title } from "@/components/primitives";
import { useTheme } from "@/context/ThemeContext";
import { clinicService } from "@/services/clinicService";
import { subscriptionService } from "@/services/subscriptionService";
import { branchService } from "@/services/branchService";
import { userService } from "@/services/userService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { useAuthContext } from "@/context/AuthContext";
import {
  Clinic,
  User,
  SubscriptionPlan,
  Branch,
  AppointmentBillingSettings,
} from "@/types/models";

interface ClinicDetailPageParams {
  clinicId: string;
}

interface ClinicStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  monthlyRevenue: number;
}

export default function ClinicDetailPage() {
  const { clinicId } = useParams<keyof ClinicDetailPageParams>() as {
    clinicId: string;
  };
  const navigate = useNavigate();
  const { isSystemOwner, currentUser } = useAuthContext();
  const { currentTheme, themeConfig, isDark } = useTheme();

  // State variables
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<ClinicStats>({
    totalPatients: 0,
    totalDoctors: 0,
    totalAppointments: 0,
    monthlyRevenue: 0,
  });
  const [clinicSettings, setClinicSettings] = useState({
    isClinicEnabled: true,
    enableSMSNotifications: true,
  });
  const [billingSettings, setBillingSettings] =
    useState<AppointmentBillingSettings | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  // Create theme classes based on current theme
  const getThemeClasses = () => {
    return {
      // Card styling
      card: isDark ? "bg-default-100" : "bg-white",
      cardHeader: isDark ? "bg-default-50" : "bg-default-50/50",

      // Text colors
      textPrimary: isDark ? "text-default-900" : "text-default-900",
      textSecondary: isDark ? "text-default-700" : "text-default-600",
      textMuted: isDark ? "text-default-500" : "text-default-500",

      // Borders and dividers
      border: isDark ? "border-default-200" : "border-default-200",
      divider: isDark ? "border-default-200" : "border-default-200",

      // Progress bars
      progressBg: isDark ? "bg-default-200" : "bg-default-100",

      // Table styling
      tableWrapper: isDark ? "bg-default-100" : "bg-white",
      tableHeader: isDark
        ? "bg-default-50 text-default-900"
        : "bg-default-50 text-default-700",
      tableCell: isDark ? "text-default-800" : "text-default-700",
      tableRow: isDark ? "hover:bg-default-50" : "hover:bg-default-50",

      // Stat cards with theme-specific colors
      statCard: {
        primary:
          currentTheme === "medical"
            ? "bg-blue-50"
            : currentTheme === "nature"
              ? "bg-green-50"
              : currentTheme === "ocean"
                ? "bg-cyan-50"
                : currentTheme === "sunset"
                  ? "bg-orange-50"
                  : isDark
                    ? "bg-default-100"
                    : "bg-primary-50",
        success:
          currentTheme === "medical"
            ? "bg-teal-50"
            : currentTheme === "nature"
              ? "bg-emerald-50"
              : currentTheme === "ocean"
                ? "bg-blue-50"
                : currentTheme === "sunset"
                  ? "bg-amber-50"
                  : isDark
                    ? "bg-default-100"
                    : "bg-success-50",
        warning:
          currentTheme === "medical"
            ? "bg-cyan-50"
            : currentTheme === "nature"
              ? "bg-lime-50"
              : currentTheme === "ocean"
                ? "bg-indigo-50"
                : currentTheme === "sunset"
                  ? "bg-yellow-50"
                  : isDark
                    ? "bg-default-100"
                    : "bg-warning-50",
        secondary:
          currentTheme === "medical"
            ? "bg-slate-50"
            : currentTheme === "nature"
              ? "bg-green-50"
              : currentTheme === "ocean"
                ? "bg-cyan-50"
                : currentTheme === "sunset"
                  ? "bg-orange-50"
                  : isDark
                    ? "bg-default-100"
                    : "bg-secondary-50",
        primaryIcon:
          currentTheme === "medical"
            ? "bg-blue-100"
            : currentTheme === "nature"
              ? "bg-green-100"
              : currentTheme === "ocean"
                ? "bg-cyan-100"
                : currentTheme === "sunset"
                  ? "bg-orange-100"
                  : isDark
                    ? "bg-default-200"
                    : "bg-primary-100",
        successIcon:
          currentTheme === "medical"
            ? "bg-teal-100"
            : currentTheme === "nature"
              ? "bg-emerald-100"
              : currentTheme === "ocean"
                ? "bg-blue-100"
                : currentTheme === "sunset"
                  ? "bg-amber-100"
                  : isDark
                    ? "bg-default-200"
                    : "bg-success-100",
        warningIcon:
          currentTheme === "medical"
            ? "bg-cyan-100"
            : currentTheme === "nature"
              ? "bg-lime-100"
              : currentTheme === "ocean"
                ? "bg-indigo-100"
                : currentTheme === "sunset"
                  ? "bg-yellow-100"
                  : isDark
                    ? "bg-default-200"
                    : "bg-warning-100",
        secondaryIcon:
          currentTheme === "medical"
            ? "bg-slate-100"
            : currentTheme === "nature"
              ? "bg-green-100"
              : currentTheme === "ocean"
                ? "bg-cyan-100"
                : currentTheme === "sunset"
                  ? "bg-orange-100"
                  : isDark
                    ? "bg-default-200"
                    : "bg-secondary-100",
      },
    };
  };

  // Utility functions
  const getPlanNameById = (planId?: string) => {
    if (!planId) return "Basic";
    const plan = plans.find((p) => p.id === planId);

    return plan ? plan.name : "Unknown";
  };

  const formatSubscriptionType = (type?: string) => {
    if (!type) return "Monthly";

    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getPlanPrice = (
    planId?: string,
    subscriptionType?: "monthly" | "yearly",
  ) => {
    if (!planId) return 0;
    const plan = plans.find((p) => p.id === planId);

    if (!plan) return 0;

    if (subscriptionType === "yearly") {
      return plan.discountedYearlyPrice || plan.yearlyPrice;
    } else {
      return plan.discountedMonthlyPrice || plan.monthlyPrice;
    }
  };

  const getNextPaymentDate = (subscriptionType?: "monthly" | "yearly") => {
    const today = new Date();
    const nextPaymentDate = new Date(today);

    if (subscriptionType === "yearly") {
      nextPaymentDate.setFullYear(today.getFullYear() + 1);
    } else {
      nextPaymentDate.setMonth(today.getMonth() + 1);
    }

    return nextPaymentDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatUserRole = (role: string) => {
    return role
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Load clinic data
  useEffect(() => {
    const loadClinic = async () => {
      try {
        setLoading(true);
        const [clinicData, plansData, usersData] = await Promise.all([
          clinicService.getClinicById(clinicId),
          subscriptionService.getAllSubscriptionPlans(),
          userService.getUsersByClinic(clinicId),
        ]);

        if (clinicData?.isMultiBranchEnabled) {
          const branchesData = await branchService.getClinicBranches(
            clinicId,
            false,
          );

          setBranches(branchesData);
        }

        try {
          const billingData =
            await appointmentBillingService.getBillingSettings(clinicId);

          setBillingSettings(billingData);
          setBillingEnabled(
            billingData
              ? billingData.enabledByAdmin && billingData.isActive
              : false,
          );
        } catch (billingErr) {
          console.error("Error loading billing settings:", billingErr);
        }

        if (!clinicData.subscriptionType) {
          clinicData.subscriptionType = "monthly";
        }

        setClinic(clinicData);
        setPlans(plansData);
        setUsers(usersData);

        if (clinicData) {
          setClinicSettings((prev) => ({
            ...prev,
            isClinicEnabled: clinicData.subscriptionStatus === "active",
            enableSMSNotifications: true,
          }));
        }

        setStats({
          totalPatients: 1254,
          totalDoctors: 8,
          totalAppointments: 423,
          monthlyRevenue: 85000,
        });
      } catch (err) {
        console.error("Error loading clinic:", err);
        setError("Failed to load clinic details");
      } finally {
        setLoading(false);
      }
    };

    loadClinic();
  }, [clinicId]);

  // Event handlers
  const handleStatusChange = async (
    newStatus: "active" | "suspended" | "cancelled",
  ) => {
    if (!clinic) return;

    try {
      await clinicService.updateSubscriptionStatus(clinicId, newStatus);
      setClinic({ ...clinic, subscriptionStatus: newStatus });
      addToast({
        title: "Success",
        description: "Clinic status updated successfully",
      });
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to update status. Please try again.",
      });
    }
  };

  const handleEnableMultiBranch = async () => {
    if (!clinic) return;

    if (!isSystemOwner()) {
      addToast({
        title: "Access Denied",
        description:
          "Only platform super admins can enable multi-branch system.",
        color: "danger",
      });

      return;
    }

    try {
      await clinicService.enableMultiBranch(clinicId, 5);
      await branchService.createDefaultMainBranch(clinicId);

      setClinic({
        ...clinic,
        isMultiBranchEnabled: true,
        maxBranches: 5,
        totalBranches: 1,
      });

      const branchesData = await branchService.getClinicBranches(
        clinicId,
        false,
      );

      setBranches(branchesData);

      addToast({
        title: "Success",
        description: "Multi-branch system enabled successfully",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to enable multi-branch system. Please try again.",
        color: "danger",
      });
    }
  };

  const handleDisableMultiBranch = async () => {
    if (!clinic) return;

    if (!isSystemOwner()) {
      addToast({
        title: "Access Denied",
        description:
          "Only platform super admins can disable multi-branch system.",
        color: "danger",
      });

      return;
    }

    try {
      await clinicService.disableMultiBranch(clinicId);

      setClinic({
        ...clinic,
        isMultiBranchEnabled: false,
        maxBranches: undefined,
        totalBranches: undefined,
      });

      setBranches([]);

      addToast({
        title: "Success",
        description: "Multi-branch system disabled successfully",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to disable multi-branch system. Please try again.",
        color: "danger",
      });
    }
  };

  const handleEnableBilling = async () => {
    if (!clinic) return;

    if (!isSystemOwner()) {
      addToast({
        title: "Access Denied",
        description:
          "Only platform super admins can enable appointment billing system.",
        color: "danger",
      });

      return;
    }

    try {
      setBillingLoading(true);

      let branchId = "";

      if (clinic.isMultiBranchEnabled && branches.length > 0) {
        const mainBranch = branches.find((b) => b.isMainBranch) || branches[0];

        branchId = mainBranch.id;
      }

      await appointmentBillingService.enableBillingForClinic(
        clinicId,
        branchId,
        currentUser?.uid || "",
      );

      const settings =
        await appointmentBillingService.getBillingSettings(clinicId);

      setBillingSettings(settings);
      setBillingEnabled(true);

      addToast({
        title: "Success",
        description: "Appointment billing system enabled successfully",
        color: "success",
      });
    } catch (err) {
      console.error("Error enabling billing:", err);
      addToast({
        title: "Error",
        description: "Failed to enable billing system. Please try again.",
        color: "danger",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const handleDisableBilling = async () => {
    if (!clinic) return;

    if (!isSystemOwner()) {
      addToast({
        title: "Access Denied",
        description:
          "Only platform super admins can disable appointment billing system.",
        color: "danger",
      });

      return;
    }

    try {
      setBillingLoading(true);

      await appointmentBillingService.disableBillingForClinic(clinicId);
      setBillingSettings(null);
      setBillingEnabled(false);

      addToast({
        title: "Success",
        description: "Appointment billing system disabled successfully",
        color: "success",
      });
    } catch (err) {
      console.error("Error disabling billing:", err);
      addToast({
        title: "Error",
        description: "Failed to disable billing system. Please try again.",
        color: "danger",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!clinic) return;

    try {
      const newStatus = clinicSettings.isClinicEnabled ? "active" : "suspended";

      if (clinic.subscriptionStatus !== newStatus) {
        await clinicService.updateSubscriptionStatus(clinicId, newStatus);
      }

      setClinic({
        ...clinic,
        subscriptionStatus: newStatus,
      });

      addToast({
        title: "Success",
        description: "Clinic settings updated successfully",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to update clinic settings. Please try again.",
        color: "danger",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner label="Loading clinic details..." size="lg" />
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <Card
        className={`max-w-lg mx-auto my-12 shadow-md ${getThemeClasses().card}`}
      >
        <CardHeader className="bg-danger/10 flex gap-3 items-center">
          <div className="p-2 rounded-full bg-danger/20">
            <svg
              aria-hidden="true"
              fill="none"
              height="24"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                className="text-danger"
                d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-danger">Error</h3>
        </CardHeader>
        <CardBody>
          <div className="text-center py-6">
            <p className={`text-xl mb-6 ${getThemeClasses().textSecondary}`}>
              {error || "Clinic not found"}
            </p>
            <Button
              aria-label="Go back to clinics list"
              color="primary"
              size="lg"
              startContent={
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="20"
                  viewBox="0 0 24 24"
                  width="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19 12H5M5 12L12 19M5 12L12 5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              }
              onClick={() => navigate("/admin/clinics")}
            >
              Back to Clinics
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div aria-label="Clinic details" role="main">
      {/* Header */}
      <Card className={`mb-6 shadow-sm border-none ${getThemeClasses().card}`}>
        <CardBody className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1
                    className={title({
                      size: "sm",
                      className: `text-xl md:text-2xl ${getThemeClasses().textPrimary}`,
                    })}
                  >
                    {clinic.name}
                  </h1>
                  <Chip
                    aria-label={`Clinic status: ${clinic.subscriptionStatus}`}
                    className="font-medium py-1 px-3"
                    color={
                      clinic.subscriptionStatus === "active"
                        ? "success"
                        : clinic.subscriptionStatus === "suspended"
                          ? "warning"
                          : "danger"
                    }
                    size="sm"
                  >
                    {clinic.subscriptionStatus.charAt(0).toUpperCase() +
                      clinic.subscriptionStatus.slice(1)}
                  </Chip>
                  <Chip
                    aria-label={`Subscription type: ${formatSubscriptionType(clinic.subscriptionType)}`}
                    className="font-medium py-1 px-3"
                    color={
                      clinic.subscriptionType === "yearly"
                        ? "primary"
                        : "default"
                    }
                    size="sm"
                    variant="flat"
                  >
                    {formatSubscriptionType(clinic.subscriptionType)}
                  </Chip>
                </div>
                <p className={`${getThemeClasses().textSecondary} mt-1`}>
                  <span className={getThemeClasses().textMuted}>
                    Clinic ID:
                  </span>{" "}
                  {clinic.id}
                </p>
                <p className={getThemeClasses().textSecondary}>
                  <span className={getThemeClasses().textMuted}>Created:</span>{" "}
                  {new Date(clinic.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex gap-3 self-end sm:self-center mt-4 sm:mt-0">
              <Button
                aria-label="Edit clinic details"
                color="primary"
                startContent={
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="18"
                    viewBox="0 0 24 24"
                    width="18"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11 4H4C3.44772 4 3 4.44772 3 5V19C3 19.5523 3.44772 20 4 20H18C18.5523 20 19 19.5523 19 19V12M17.5858 3.58579C18.3668 2.80474 19.6332 2.80474 20.4142 3.58579C21.1953 4.36683 21.1953 5.63316 20.4142 6.41421L11.8284 15H9L9 12.1716L17.5858 3.58579Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                }
                variant="flat"
                onClick={() => navigate(`/admin/clinics/${clinicId}/edit`)}
              >
                Edit Clinic
              </Button>
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    aria-label="Clinic actions menu"
                    color="primary"
                    startContent={
                      <svg
                        aria-hidden="true"
                        fill="none"
                        height="18"
                        viewBox="0 0 24 24"
                        width="18"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 5V5.01M12 12V12.01M12 19V19.01M12 6C11.4477 6 11 5.55228 11 5C11 4.44772 11.4477 4 12 4C12.5523 4 13 4.44772 13 5C13 5.55228 12.5523 6 12 6ZM12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12C13 12.5523 12.5523 13 12 13ZM12 20C11.4477 20 11 19.5523 11 19C11 18.4477 11.4477 18 12 18C12.5523 18 13 18.4477 13 19C13 19.5523 12.5523 20 12 20Z"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    }
                  >
                    Actions
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Clinic actions"
                  className={getThemeClasses().card}
                >
                  <DropdownItem
                    key="active"
                    className="text-success"
                    startContent={
                      <svg
                        aria-hidden="true"
                        className="text-success"
                        fill="none"
                        height="18"
                        viewBox="0 0 24 24"
                        width="18"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    }
                    onClick={() => handleStatusChange("active")}
                  >
                    Activate Clinic
                  </DropdownItem>
                  <DropdownItem
                    key="suspended"
                    className="text-warning"
                    startContent={
                      <svg
                        aria-hidden="true"
                        className="text-warning"
                        fill="none"
                        height="18"
                        viewBox="0 0 24 24"
                        width="18"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 9V12.75M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12ZM12 15.75H12.0075V15.7575H12V15.75Z"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    }
                    onClick={() => handleStatusChange("suspended")}
                  >
                    Suspend Clinic
                  </DropdownItem>
                  <DropdownItem
                    key="cancelled"
                    className="text-danger"
                    startContent={
                      <svg
                        aria-hidden="true"
                        className="text-danger"
                        fill="none"
                        height="18"
                        viewBox="0 0 24 24"
                        width="18"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M10 14L12 12M12 12L14 10M12 12L10 10M12 12L14 14M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    }
                    onClick={() => handleStatusChange("cancelled")}
                  >
                    Cancel Subscription
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    className="text-danger"
                    color="danger"
                    startContent={
                      <svg
                        aria-hidden="true"
                        className="text-danger"
                        fill="none"
                        height="18"
                        viewBox="0 0 24 24"
                        width="18"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    }
                  >
                    Delete Clinic
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Stats Overview */}
      <div
        aria-label="Clinic statistics"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        role="region"
      >
        <Card
          className={`${getThemeClasses().statCard.primary} border-none shadow-sm`}
        >
          <CardBody className="p-5">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <p
                  className={`text-sm ${getThemeClasses().textMuted} font-medium`}
                >
                  Total Patients
                </p>
                <div className="flex items-baseline mt-1 gap-2">
                  <p
                    className={`text-2xl font-bold ${getThemeClasses().textPrimary}`}
                  >
                    {stats.totalPatients.toLocaleString()}
                  </p>
                  <span
                    aria-label="14% increase"
                    className="text-xs text-success"
                  >
                    +14% ↑
                  </span>
                </div>
              </div>
              <div
                className={`p-3 ${getThemeClasses().statCard.primaryIcon} rounded-full`}
              >
                <IoPeopleOutline
                  aria-hidden="true"
                  className="w-6 h-6 text-primary"
                />
              </div>
            </div>
            <div className="mt-4">
              <div
                className={`w-full h-2 ${getThemeClasses().progressBg} rounded-full overflow-hidden`}
              >
                <div
                  aria-label="Patient growth progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={70}
                  className="bg-primary h-full"
                  role="progressbar"
                  style={{ width: "70%" }}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card
          className={`${getThemeClasses().statCard.success} border-none shadow-sm`}
        >
          <CardBody className="p-5">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <p
                  className={`text-sm ${getThemeClasses().textMuted} font-medium`}
                >
                  Active Doctors
                </p>
                <div className="flex items-baseline mt-1 gap-2">
                  <p
                    className={`text-2xl font-bold ${getThemeClasses().textPrimary}`}
                  >
                    {stats.totalDoctors.toLocaleString()}
                  </p>
                  <span
                    aria-label="2% increase"
                    className="text-xs text-success"
                  >
                    +2% ↑
                  </span>
                </div>
              </div>
              <div
                className={`p-3 ${getThemeClasses().statCard.successIcon} rounded-full`}
              >
                <IoBusinessOutline
                  aria-hidden="true"
                  className="w-6 h-6 text-success"
                />
              </div>
            </div>
            <div className="mt-4">
              <div
                className={`w-full h-2 ${getThemeClasses().progressBg} rounded-full overflow-hidden`}
              >
                <div
                  aria-label="Doctor availability"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={40}
                  className="bg-success h-full"
                  role="progressbar"
                  style={{ width: "40%" }}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card
          className={`${getThemeClasses().statCard.warning} border-none shadow-sm`}
        >
          <CardBody className="p-5">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <p
                  className={`text-sm ${getThemeClasses().textMuted} font-medium`}
                >
                  Monthly Appointments
                </p>
                <div className="flex items-baseline mt-1 gap-2">
                  <p
                    className={`text-2xl font-bold ${getThemeClasses().textPrimary}`}
                  >
                    {stats.totalAppointments.toLocaleString()}
                  </p>
                  <span
                    aria-label="8% increase"
                    className="text-xs text-success"
                  >
                    +8% ↑
                  </span>
                </div>
              </div>
              <div
                className={`p-3 ${getThemeClasses().statCard.warningIcon} rounded-full`}
              >
                <IoStatsChartOutline
                  aria-hidden="true"
                  className="w-6 h-6 text-warning"
                />
              </div>
            </div>
            <div className="mt-4">
              <div
                className={`w-full h-2 ${getThemeClasses().progressBg} rounded-full overflow-hidden`}
              >
                <div
                  aria-label="Appointment booking rate"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={60}
                  className="bg-warning h-full"
                  role="progressbar"
                  style={{ width: "60%" }}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card
          className={`${getThemeClasses().statCard.secondary} border-none shadow-sm`}
        >
          <CardBody className="p-5">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <p
                  className={`text-sm ${getThemeClasses().textMuted} font-medium`}
                >
                  Monthly Revenue
                </p>
                <div className="flex items-baseline mt-1 gap-2">
                  <p
                    className={`text-2xl font-bold ${getThemeClasses().textPrimary}`}
                  >
                    ₹{stats.monthlyRevenue.toLocaleString()}
                  </p>
                  <span
                    aria-label="12% increase"
                    className="text-xs text-success"
                  >
                    +12% ↑
                  </span>
                </div>
              </div>
              <div
                className={`p-3 ${getThemeClasses().statCard.secondaryIcon} rounded-full`}
              >
                <IoWalletOutline
                  aria-hidden="true"
                  className="w-6 h-6 text-secondary"
                />
              </div>
            </div>
            <div className="mt-4">
              <div
                className={`w-full h-2 ${getThemeClasses().progressBg} rounded-full overflow-hidden`}
              >
                <div
                  aria-label="Revenue target progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={85}
                  className="bg-secondary h-full"
                  role="progressbar"
                  style={{ width: "85%" }}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Card className={`border-none shadow-sm ${getThemeClasses().card}`}>
        <Tabs
          aria-label="Clinic information tabs"
          classNames={{
            tabList: "gap-6 px-4 pt-4",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-4 h-12 text-medium font-medium",
            tabContent: "py-2",
          }}
          color="primary"
          selectedKey={selectedTab}
          variant="underlined"
          onSelectionChange={(key) => setSelectedTab(key as string)}
        >
          <Tab
            key="overview"
            title={
              <div className="flex items-center space-x-2">
                <IoBusinessOutline aria-hidden="true" className="text-lg" />
                <span>Overview</span>
              </div>
            }
          >
            <div aria-labelledby="overview-tab" className="p-4" role="tabpanel">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card
                  className={`border ${getThemeClasses().border} shadow-none ${getThemeClasses().card}`}
                >
                  <CardHeader
                    className={`flex gap-3 ${getThemeClasses().cardHeader}`}
                  >
                    <div>
                      <p
                        className={`text-lg font-semibold ${getThemeClasses().textPrimary}`}
                      >
                        Clinic Information
                      </p>
                      <p className={`${getThemeClasses().textMuted} text-sm`}>
                        Primary clinic details and registration info
                      </p>
                    </div>
                  </CardHeader>
                  <Divider className={getThemeClasses().divider} />
                  <CardBody className="p-5">
                    <div className="space-y-5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p
                            className={`text-sm ${getThemeClasses().textMuted} mb-1`}
                          >
                            Email Address
                          </p>
                          <div className="flex items-center gap-2">
                            <svg
                              aria-hidden="true"
                              className={getThemeClasses().textMuted}
                              fill="none"
                              height="16"
                              viewBox="0 0 24 24"
                              width="16"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19Z"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                              />
                            </svg>
                            <p
                              className={`font-medium ${getThemeClasses().textPrimary}`}
                            >
                              {clinic.email}
                            </p>
                          </div>
                        </div>
                        <Chip color="success" size="sm" variant="flat">
                          Verified
                        </Chip>
                      </div>

                      <div className="flex justify-between items-center">
                        <div>
                          <p
                            className={`text-sm ${getThemeClasses().textMuted} mb-1`}
                          >
                            Phone Number
                          </p>
                          <div className="flex items-center gap-2">
                            <svg
                              aria-hidden="true"
                              className={getThemeClasses().textMuted}
                              fill="none"
                              height="16"
                              viewBox="0 0 24 24"
                              width="16"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M3 5.5C3 14.0604 9.93959 21 18.5 21C19.2373 21 19.9654 20.9193 20.6759 20.7646C21.1139 20.6648 21.5 20.2852 21.5 19.8339V16.5C21.5 16.0328 21.1798 15.6392 20.7218 15.5654L17.8833 15.1208C17.4819 15.0561 17.0787 15.2249 16.8257 15.5486L15.5 17.25C12.5176 15.7708 10.2292 13.4824 8.75 10.5L10.4514 9.17429C10.7751 8.92131 10.9439 8.51806 10.8792 8.11669L10.4346 5.27818C10.3608 4.82025 9.96724 4.5 9.5 4.5H6.16606C5.7148 4.5 5.33517 4.88605 5.23542 5.32404C5.08074 6.03462 5 6.76269 5 7.5"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                              />
                            </svg>
                            <p
                              className={`font-medium ${getThemeClasses().textPrimary}`}
                            >
                              {clinic.phone}
                            </p>
                          </div>
                        </div>
                        <Button color="primary" size="sm" variant="light">
                          Change
                        </Button>
                      </div>

                      <div>
                        <p
                          className={`text-sm ${getThemeClasses().textMuted} mb-1`}
                        >
                          Address
                        </p>
                        <div className="flex items-start gap-2">
                          <svg
                            aria-hidden="true"
                            className={`mt-1 ${getThemeClasses().textMuted}`}
                            fill="none"
                            height="16"
                            viewBox="0 0 24 24"
                            width="16"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M17.6569 16.6569C16.7202 17.5935 14.7616 19.5521 13.4138 20.8999C12.6327 21.681 11.3677 21.6814 10.5866 20.9003C9.26234 19.576 7.34159 17.6553 6.34315 16.6569C3.21895 13.5327 3.21895 8.46734 6.34315 5.34315C9.46734 2.21895 14.5327 2.21895 17.6569 5.34315C20.781 8.46734 20.781 13.5327 17.6569 16.6569Z"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                            <path
                              d="M15 11C15 12.6569 13.6569 14 12 14C10.3431 14 9 12.6569 9 11C9 9.34315 10.3431 8 12 8C13.6569 8 15 9.34315 15 11Z"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                          <div>
                            <p
                              className={`font-medium ${getThemeClasses().textPrimary} leading-relaxed`}
                            >
                              {clinic.city}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p
                          className={`text-sm ${getThemeClasses().textMuted} mb-1`}
                        >
                          Registration Date
                        </p>
                        <div className="flex items-center gap-2">
                          <svg
                            aria-hidden="true"
                            className={getThemeClasses().textMuted}
                            fill="none"
                            height="16"
                            viewBox="0 0 24 24"
                            width="16"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                          <p
                            className={`font-medium ${getThemeClasses().textPrimary}`}
                          >
                            {new Date(clinic.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card
                  className={`border ${getThemeClasses().border} shadow-none ${getThemeClasses().card}`}
                >
                  <CardHeader
                    className={`flex gap-3 ${getThemeClasses().cardHeader}`}
                  >
                    <div>
                      <p
                        className={`text-lg font-semibold ${getThemeClasses().textPrimary}`}
                      >
                        Subscription Details
                      </p>
                      <p className={`${getThemeClasses().textMuted} text-sm`}>
                        Current plan and billing information
                      </p>
                    </div>
                  </CardHeader>
                  <Divider className={getThemeClasses().divider} />
                  <CardBody className="p-5">
                    <div className="space-y-5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p
                            className={`text-sm ${getThemeClasses().textMuted} mb-1`}
                          >
                            Current Plan
                          </p>
                          <div className="flex items-center gap-2">
                            <svg
                              aria-hidden="true"
                              className="text-warning"
                              fill="none"
                              height="16"
                              viewBox="0 0 24 24"
                              width="16"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M12 10V14M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21ZM12 17H12.01V17.01H12V17Z"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                              />
                            </svg>
                            <div className="flex items-center gap-2">
                              <p
                                className={`font-medium ${getThemeClasses().textPrimary} capitalize`}
                              >
                                {getPlanNameById(clinic.subscriptionPlan)} Plan
                              </p>
                              <Chip
                                className="font-medium py-0 px-2"
                                color={
                                  clinic.subscriptionType === "yearly"
                                    ? "primary"
                                    : "default"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {formatSubscriptionType(
                                  clinic.subscriptionType,
                                )}
                              </Chip>
                            </div>
                          </div>
                        </div>
                        <Button
                          color="primary"
                          size="sm"
                          variant="flat"
                          onClick={() =>
                            navigate(`/admin/subscriptions/edit/${clinic.id}`)
                          }
                        >
                          Upgrade
                        </Button>
                      </div>

                      <div>
                        <p
                          className={`text-sm ${getThemeClasses().textMuted} mb-1`}
                        >
                          Status
                        </p>
                        <div className="flex items-center gap-2">
                          <Chip
                            className="font-medium py-1 px-2"
                            color={
                              clinic.subscriptionStatus === "active"
                                ? "success"
                                : clinic.subscriptionStatus === "suspended"
                                  ? "warning"
                                  : "danger"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {clinic.subscriptionStatus.charAt(0).toUpperCase() +
                              clinic.subscriptionStatus.slice(1)}
                          </Chip>
                          <p
                            className={`${getThemeClasses().textMuted} text-sm`}
                          >
                            Last changed:{" "}
                            {new Date().toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <p
                          className={`text-sm ${getThemeClasses().textMuted} mb-3`}
                        >
                          Billing Period
                        </p>
                        <div
                          className={`flex items-center justify-between ${getThemeClasses().cardHeader} p-3 rounded-lg border ${getThemeClasses().border}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-md">
                              <svg
                                aria-hidden="true"
                                className="text-primary"
                                fill="none"
                                height="20"
                                viewBox="0 0 24 24"
                                width="20"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M21 10H3M16 2V6M8 2V6M10.5 14L12 13V17M12 13L13.5 14M5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22Z"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <div>
                              <p
                                className={`font-medium ${getThemeClasses().textPrimary}`}
                              >
                                Next Payment Due
                              </p>
                              <p
                                className={`${getThemeClasses().textMuted} text-sm`}
                              >
                                {getNextPaymentDate(clinic.subscriptionType)}
                              </p>
                            </div>
                          </div>
                          <p
                            className={`font-medium ${getThemeClasses().textPrimary}`}
                          >
                            ₹
                            {getPlanPrice(
                              clinic.subscriptionPlan,
                              clinic.subscriptionType,
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p
                          className={`text-sm ${getThemeClasses().textMuted} mb-3`}
                        >
                          Plan Details
                        </p>
                        {(() => {
                          const plan = plans.find(
                            (p) => p.id === clinic.subscriptionPlan,
                          );

                          if (!plan) return null;

                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <p
                                  className={`text-sm ${getThemeClasses().textSecondary}`}
                                >
                                  Monthly Price:
                                </p>
                                <p
                                  className={`font-medium ${getThemeClasses().textPrimary}`}
                                >
                                  ₹
                                  {(
                                    plan.discountedMonthlyPrice ||
                                    plan.monthlyPrice
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex justify-between items-center">
                                <p
                                  className={`text-sm ${getThemeClasses().textSecondary}`}
                                >
                                  Yearly Price:
                                </p>
                                <p
                                  className={`font-medium ${getThemeClasses().textPrimary}`}
                                >
                                  ₹
                                  {(
                                    plan.discountedYearlyPrice ||
                                    plan.yearlyPrice
                                  ).toLocaleString()}
                                  {plan.discountedYearlyPrice &&
                                  plan.yearlyPrice ? (
                                    <span className="text-xs text-success ml-2">
                                      {Math.round(
                                        (1 -
                                          plan.discountedYearlyPrice /
                                            plan.yearlyPrice) *
                                          100,
                                      )}
                                      % off
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                              <div className="flex justify-between items-center">
                                <p
                                  className={`text-sm ${getThemeClasses().textSecondary}`}
                                >
                                  Max Users:
                                </p>
                                <p
                                  className={`font-medium ${getThemeClasses().textPrimary}`}
                                >
                                  {plan.maxUsers}
                                </p>
                              </div>
                              <div className="flex justify-between items-center">
                                <p
                                  className={`text-sm ${getThemeClasses().textSecondary}`}
                                >
                                  Max Patients:
                                </p>
                                <p
                                  className={`font-medium ${getThemeClasses().textPrimary}`}
                                >
                                  {plan.maxPatients}
                                </p>
                              </div>
                              <div className="flex justify-between items-center">
                                <p
                                  className={`text-sm ${getThemeClasses().textSecondary}`}
                                >
                                  Storage:
                                </p>
                                <p
                                  className={`font-medium ${getThemeClasses().textPrimary}`}
                                >
                                  {plan.storageLimitGB} GB
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex justify-between pt-2">
                        <Button color="default" size="sm" variant="flat">
                          View Invoice History
                        </Button>
                        <Button color="primary" size="sm" variant="flat">
                          Update Payment Method
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          </Tab>

          <Tab
            key="users"
            title={
              <div className="flex items-center space-x-2">
                <IoPeopleOutline aria-hidden="true" className="text-lg" />
                <span>Users</span>
              </div>
            }
          >
            <div aria-labelledby="users-tab" className="p-4" role="tabpanel">
              <Card
                className={`border ${getThemeClasses().border} shadow-none ${getThemeClasses().card}`}
              >
                <CardHeader className={getThemeClasses().cardHeader}>
                  <div>
                    <p
                      className={`text-lg font-semibold ${getThemeClasses().textPrimary}`}
                    >
                      Clinic Users ({users.length})
                    </p>
                    <p className={`${getThemeClasses().textMuted} text-sm`}>
                      Users created and managed by clinic administrators
                    </p>
                  </div>
                </CardHeader>
                <Divider className={getThemeClasses().divider} />
                <CardBody className="p-0">
                  {users.length > 0 ? (
                    <Table
                      aria-label="Clinic users table"
                      classNames={{
                        wrapper: getThemeClasses().tableWrapper,
                        th: `${getThemeClasses().tableHeader} font-semibold`,
                        td: `${getThemeClasses().tableCell}`,
                        tr: `${getThemeClasses().tableRow}`,
                      }}
                    >
                      <TableHeader>
                        <TableColumn>USER</TableColumn>
                        <TableColumn>ROLE</TableColumn>
                        <TableColumn>BRANCH</TableColumn>
                        <TableColumn>STATUS</TableColumn>
                        <TableColumn>CREATED</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                  <span className="text-primary font-medium text-sm">
                                    {user.displayName
                                      ?.charAt(0)
                                      .toUpperCase() ||
                                      user.email.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p
                                    className={`font-medium ${getThemeClasses().textPrimary}`}
                                  >
                                    {user.displayName || "No name"}
                                  </p>
                                  <p
                                    className={`text-sm ${getThemeClasses().textMuted}`}
                                  >
                                    {user.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Chip
                                color={
                                  user.role === "system-owner"
                                    ? "warning"
                                    : user.role === "clinic-admin"
                                      ? "primary"
                                      : user.role === "staff"
                                        ? "success"
                                        : "default"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {formatUserRole(user.role)}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              {user.branchId ? (
                                <span
                                  className={getThemeClasses().textSecondary}
                                >
                                  {branches.find((b) => b.id === user.branchId)
                                    ?.name || "Unknown Branch"}
                                </span>
                              ) : (
                                <Chip
                                  color="secondary"
                                  size="sm"
                                  variant="flat"
                                >
                                  All Branches
                                </Chip>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                color={user.isActive ? "success" : "danger"}
                                size="sm"
                                variant="flat"
                              >
                                {user.isActive ? "Active" : "Inactive"}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <span className={getThemeClasses().textSecondary}>
                                {user.createdAt
                                  ? new Date(user.createdAt).toLocaleDateString(
                                      "en-US",
                                      {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      },
                                    )
                                  : "Unknown"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <div className="max-w-sm mx-auto">
                        <IoPeopleOutline
                          aria-hidden="true"
                          className={`w-16 h-16 mx-auto mb-4 ${getThemeClasses().textMuted}`}
                        />
                        <h3
                          className={`text-lg font-semibold ${getThemeClasses().textPrimary} mb-2`}
                        >
                          No Users Found
                        </h3>
                        <p className={getThemeClasses().textMuted}>
                          This clinic doesn't have any users created yet.
                        </p>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </Tab>

          <Tab
            key="branches"
            title={
              <div className="flex items-center space-x-2">
                <IoStorefrontOutline aria-hidden="true" className="text-lg" />
                <span>Branches</span>
              </div>
            }
          >
            <div aria-labelledby="branches-tab" className="p-4" role="tabpanel">
              {clinic.isMultiBranchEnabled ? (
                <div className="space-y-6">
                  <Card
                    className={`border ${getThemeClasses().border} shadow-none ${getThemeClasses().card}`}
                  >
                    <CardHeader
                      className={`flex justify-between items-center ${getThemeClasses().cardHeader}`}
                    >
                      <div>
                        <p
                          className={`text-lg font-semibold ${getThemeClasses().textPrimary}`}
                        >
                          Branch Management
                        </p>
                        <p className={`${getThemeClasses().textMuted} text-sm`}>
                          Manage all clinic branches (
                          {clinic.totalBranches || 0}/{clinic.maxBranches || 0}{" "}
                          branches)
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button color="primary" size="sm">
                          <svg
                            aria-hidden="true"
                            className="mr-1"
                            fill="none"
                            height="16"
                            viewBox="0 0 24 24"
                            width="16"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M12 4.5V19.5M19.5 12H4.5"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                          Add Branch
                        </Button>
                        {isSystemOwner() && (
                          <Button
                            color="danger"
                            size="sm"
                            variant="flat"
                            onClick={handleDisableMultiBranch}
                          >
                            Disable Multi-Branch
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <Divider className={getThemeClasses().divider} />
                    <CardBody>
                      {branches.length > 0 ? (
                        <div className="space-y-4">
                          {branches.map((branch) => (
                            <Card
                              key={branch.id}
                              className={`border ${getThemeClasses().border} ${getThemeClasses().card}`}
                            >
                              <CardBody className="p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                      <IoStorefrontOutline
                                        aria-hidden="true"
                                        className="w-5 h-5 text-primary"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4
                                          className={`font-semibold ${getThemeClasses().textPrimary}`}
                                        >
                                          {branch.name}
                                        </h4>
                                        <Chip
                                          color="primary"
                                          size="sm"
                                          variant="flat"
                                        >
                                          {branch.code}
                                        </Chip>
                                        {branch.isMainBranch && (
                                          <Chip
                                            color="warning"
                                            size="sm"
                                            variant="flat"
                                          >
                                            Main Branch
                                          </Chip>
                                        )}
                                      </div>
                                      <p
                                        className={`text-sm ${getThemeClasses().textSecondary}`}
                                      >
                                        {branch.address}, {branch.city}
                                      </p>
                                      <p
                                        className={`text-sm ${getThemeClasses().textMuted}`}
                                      >
                                        {branch.phone}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Chip
                                      color={
                                        branch.isActive ? "success" : "danger"
                                      }
                                      size="sm"
                                      variant="flat"
                                    >
                                      {branch.isActive ? "Active" : "Inactive"}
                                    </Chip>
                                    <Button
                                      color="primary"
                                      size="sm"
                                      variant="flat"
                                    >
                                      Edit
                                    </Button>
                                  </div>
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className={getThemeClasses().textMuted}>
                            No branches found
                          </p>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>
              ) : (
                <Card
                  className={`border ${getThemeClasses().border} shadow-none ${getThemeClasses().card}`}
                >
                  <CardBody className="p-8 text-center">
                    <div className="max-w-md mx-auto">
                      <IoStorefrontOutline
                        aria-hidden="true"
                        className={`w-16 h-16 mx-auto mb-4 ${getThemeClasses().textMuted}`}
                      />
                      <h3
                        className={`text-xl font-semibold ${getThemeClasses().textPrimary} mb-2`}
                      >
                        Multi-Branch System Disabled
                      </h3>
                      <p className={`${getThemeClasses().textSecondary} mb-6`}>
                        This clinic doesn't have multi-branch functionality
                        enabled.
                        {isSystemOwner()
                          ? "Enable it to manage multiple branch locations for this clinic."
                          : "Only platform super admins can enable multi-branch functionality."}
                      </p>
                      {isSystemOwner() ? (
                        <Button
                          color="primary"
                          startContent={
                            <svg
                              aria-hidden="true"
                              fill="none"
                              height="18"
                              viewBox="0 0 24 24"
                              width="18"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M12 4.5V19.5M19.5 12H4.5"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                              />
                            </svg>
                          }
                          onClick={handleEnableMultiBranch}
                        >
                          Enable Multi-Branch System
                        </Button>
                      ) : (
                        <Chip color="warning" variant="flat">
                          Contact Platform Administrator
                        </Chip>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          </Tab>

          <Tab
            key="settings"
            title={
              <div className="flex items-center space-x-2">
                <IoSettingsOutline aria-hidden="true" className="text-lg" />
                <span>Settings</span>
              </div>
            }
          >
            <div aria-labelledby="settings-tab" className="p-4" role="tabpanel">
              <Card
                className={`border ${getThemeClasses().border} shadow-none ${getThemeClasses().card}`}
              >
                <CardHeader className={getThemeClasses().cardHeader}>
                  <div>
                    <p
                      className={`text-lg font-semibold ${getThemeClasses().textPrimary}`}
                    >
                      Clinic Settings
                    </p>
                    <p className={`${getThemeClasses().textMuted} text-sm`}>
                      Configure essential clinic preferences
                    </p>
                  </div>
                </CardHeader>
                <Divider className={getThemeClasses().divider} />
                <CardBody className="space-y-6">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p
                          className={`font-medium ${getThemeClasses().textPrimary}`}
                        >
                          Clinic Status
                        </p>
                        <p className={`text-sm ${getThemeClasses().textMuted}`}>
                          Enable or disable the clinic operations
                        </p>
                      </div>
                      <Switch
                        aria-label="Enable or disable clinic operations"
                        color={
                          clinicSettings.isClinicEnabled ? "success" : "danger"
                        }
                        isDisabled={billingLoading}
                        isSelected={clinicSettings.isClinicEnabled}
                        onValueChange={(value) =>
                          setClinicSettings((prev) => ({
                            ...prev,
                            isClinicEnabled: value,
                          }))
                        }
                      />
                    </div>

                    <Divider className={getThemeClasses().divider} />

                    <div className="flex justify-between items-center">
                      <div>
                        <p
                          className={`font-medium ${getThemeClasses().textPrimary}`}
                        >
                          SMS Notifications
                        </p>
                        <p className={`text-sm ${getThemeClasses().textMuted}`}>
                          Send SMS reminders to patients
                        </p>
                      </div>
                      <Switch
                        aria-label="Enable or disable SMS notifications"
                        isDisabled={billingLoading}
                        isSelected={clinicSettings.enableSMSNotifications}
                        onValueChange={(value) =>
                          setClinicSettings((prev) => ({
                            ...prev,
                            enableSMSNotifications: value,
                          }))
                        }
                      />
                    </div>

                    <Divider className={getThemeClasses().divider} />

                    <div className="flex justify-between items-center">
                      <div>
                        <p
                          className={`font-medium ${getThemeClasses().textPrimary}`}
                        >
                          Appointment Billing System
                        </p>
                        <p className={`text-sm ${getThemeClasses().textMuted}`}>
                          Enable invoice generation for appointments
                          {!isSystemOwner() &&
                            " (Super admin control required)"}
                        </p>
                        {billingSettings && (
                          <p
                            className={`text-xs ${getThemeClasses().textMuted} mt-1`}
                          >
                            Next invoice: {billingSettings.invoicePrefix}-
                            {billingSettings.nextInvoiceNumber
                              .toString()
                              .padStart(4, "0")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {billingLoading ? (
                          <Chip color="warning" size="sm" variant="flat">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              {billingEnabled ? "Disabling..." : "Enabling..."}
                            </div>
                          </Chip>
                        ) : billingEnabled ? (
                          <>
                            <Chip color="success" size="sm" variant="flat">
                              Enabled
                            </Chip>
                            {isSystemOwner() && (
                              <Button
                                aria-label="Disable appointment billing system"
                                color="danger"
                                isDisabled={billingLoading}
                                isLoading={billingLoading}
                                size="sm"
                                variant="flat"
                                onClick={handleDisableBilling}
                              >
                                {billingLoading ? "Disabling..." : "Disable"}
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Chip color="default" size="sm" variant="flat">
                              Disabled
                            </Chip>
                            {isSystemOwner() && (
                              <Button
                                aria-label="Enable appointment billing system"
                                color="primary"
                                isDisabled={billingLoading}
                                isLoading={billingLoading}
                                size="sm"
                                onClick={handleEnableBilling}
                              >
                                {billingLoading ? "Enabling..." : "Enable"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      aria-label="Reset all changes to original values"
                      color="default"
                      isDisabled={billingLoading}
                      variant="flat"
                      onClick={() => {
                        // Reset to original clinic data
                        if (clinic) {
                          setClinicSettings((prev) => ({
                            ...prev,
                            isClinicEnabled:
                              clinic.subscriptionStatus === "active",
                            enableSMSNotifications: true,
                          }));
                        }
                      }}
                    >
                      Reset Changes
                    </Button>
                    <Button
                      aria-label="Save clinic settings"
                      color="primary"
                      isDisabled={billingLoading}
                      onClick={handleSaveSettings}
                    >
                      Save Settings
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Tab>
        </Tabs>
      </Card>
    </div>
  );
}
