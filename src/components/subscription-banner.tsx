/**
 * SubscriptionBanner — Clinic Clarity Design
 * Zero HeroUI. Flat bordered design with left accent stripe.
 */
import React, { useState, useEffect } from "react";
import {
  IoWarningOutline,
  IoAlertCircleOutline,
  IoCloseOutline,
  IoTimeOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import { useNavigate } from "react-router-dom";

import { useAuthContext } from "@/context/AuthContext";
import { clinicService } from "@/services/clinicService";
import { Clinic } from "@/types/models";
import { Button } from "@/components/ui/button";

// ── Alert levels ──────────────────────────────────────────────────────────────
type AlertLevel = "danger" | "warning" | "info";

interface SubscriptionAlert {
  level: AlertLevel;
  title: string;
  message: string;
  urgent: boolean;
  daysLeft: number | null;
}

function getAlert(clinic: Clinic): SubscriptionAlert | null {
  if (!clinic.subscriptionEndDate) return null;

  const end = new Date(clinic.subscriptionEndDate);
  const today = new Date();
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  const status = clinic.subscriptionStatus;

  if (status === "cancelled") {
    return {
      level: "danger",
      title: "Subscription Cancelled",
      daysLeft: null,
      urgent: true,
      message:
        "Your clinic subscription has been cancelled. Contact support to reactivate.",
    };
  }
  if (status === "suspended") {
    return {
      level: "danger",
      title: "Subscription Suspended",
      daysLeft: null,
      urgent: true,
      message:
        "Your clinic subscription is suspended. Some features may be restricted.",
    };
  }
  if (daysLeft < 0) {
    return {
      level: "danger",
      title: "Subscription Expired",
      daysLeft,
      urgent: true,
      message: `Your subscription expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""} ago. Renew now to restore access.`,
    };
  }
  if (daysLeft <= 3) {
    return {
      level: "danger",
      title: "Expiring in " + daysLeft + (daysLeft === 1 ? " day" : " days"),
      daysLeft,
      urgent: true,
      message: `Critical: renew immediately to avoid losing access to clinic data.`,
    };
  }
  if (daysLeft <= 7) {
    return {
      level: "warning",
      title: "Expiring Soon",
      daysLeft,
      urgent: true,
      message: `Your subscription expires in ${daysLeft} days. Renew now to avoid interruption.`,
    };
  }
  if (daysLeft <= 30) {
    return {
      level: "info",
      title: "Renewal Reminder",
      daysLeft,
      urgent: false,
      message: `Your subscription expires in ${daysLeft} days.`,
    };
  }

  return null;
}

// ── Style maps ────────────────────────────────────────────────────────────────
const STRIPE: Record<AlertLevel, string> = {
  danger: "border-l-red-500  bg-red-50   border-red-200",
  warning: "border-l-saffron-500 bg-saffron-50 border-saffron-200",
  info: "border-l-teal-600 bg-teal-50  border-teal-200",
};

const ICON_CLR: Record<AlertLevel, string> = {
  danger: "text-red-500",
  warning: "text-saffron-600",
  info: "text-teal-700",
};

const TITLE_CLR: Record<AlertLevel, string> = {
  danger: "text-red-800",
  warning: "text-saffron-800",
  info: "text-teal-800",
};

const MSG_CLR: Record<AlertLevel, string> = {
  danger: "text-red-700",
  warning: "text-saffron-700",
  info: "text-teal-700",
};

const BADGE_CLR: Record<AlertLevel, string> = {
  danger: "bg-red-100 text-red-700",
  warning: "bg-saffron-100 text-saffron-700",
  info: "bg-teal-100 text-teal-700",
};

const BTN_COLOR: Record<AlertLevel, "danger" | "warning" | "primary"> = {
  danger: "danger",
  warning: "warning",
  info: "primary",
};

// ── Component ─────────────────────────────────────────────────────────────────
export function SubscriptionBanner() {
  const navigate = useNavigate();
  const { userData, isSystemOwner, logout } = useAuthContext();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isImpersonating =
      localStorage.getItem("isImpersonating") === "true" ||
      !!localStorage.getItem("impersonationMeta");

    if (isSystemOwner() || !userData?.clinicId || isImpersonating) {
      setLoading(false);

      return;
    }

    clinicService
      .getClinicById(userData.clinicId)
      .then(async (data) => {
        setClinic(data);
        if (
          data?.subscriptionStatus === "suspended" ||
          data?.subscriptionStatus === "cancelled"
        ) {
          console.warn("🚫 Critical subscription issue — forcing logout");
          await logout();
        }
      })
      .catch((err) => console.error("SubscriptionBanner fetch error:", err))
      .finally(() => setLoading(false));
  }, [userData?.clinicId, isSystemOwner, logout]);

  if (loading || dismissed || !clinic || isSystemOwner()) return null;

  const alert = getAlert(clinic);

  if (!alert) return null;

  const { level, title, message, urgent } = alert;

  return (
    <div
      className={`mb-4 border border-l-4 rounded overflow-hidden ${STRIPE[level]}`}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        {/* Icon + body */}
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Icon */}
          <span className={`mt-0.5 shrink-0 ${ICON_CLR[level]}`}>
            {level === "danger" ? (
              <IoAlertCircleOutline className="w-4 h-4" />
            ) : level === "warning" ? (
              <IoWarningOutline className="w-4 h-4" />
            ) : (
              <IoTimeOutline className="w-4 h-4" />
            )}
          </span>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-0.5">
              <span
                className={`text-[12.5px] font-semibold ${TITLE_CLR[level]}`}
              >
                {title}
              </span>
              {urgent && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${BADGE_CLR[level]}`}
                >
                  Action Required
                </span>
              )}
            </div>

            <p className={`text-[12px] ${MSG_CLR[level]}`}>{message}</p>

            {/* Action buttons (only for urgent alerts) */}
            {urgent && (
              <div className="flex gap-2 mt-2">
                <Button
                  color={BTN_COLOR[level]}
                  size="sm"
                  onClick={() => {
                    if (
                      clinic?.subscriptionStatus === "suspended" ||
                      clinic?.subscriptionStatus === "cancelled"
                    ) {
                      window.open(
                        "mailto:support@procaresoft.com?subject=Subscription Support",
                      );
                    } else {
                      navigate("/dashboard/settings/clinic");
                    }
                  }}
                >
                  {clinic?.subscriptionStatus === "suspended" ||
                  clinic?.subscriptionStatus === "cancelled"
                    ? "Contact Support"
                    : "Manage Subscription"}
                </Button>
                <Button
                  color={BTN_COLOR[level]}
                  size="sm"
                  startContent={<IoRefreshOutline className="w-3.5 h-3.5" />}
                  variant="bordered"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Dismiss (only non-urgent) */}
        {!urgent && (
          <button
            aria-label="Dismiss"
            className={`shrink-0 p-1 rounded transition-colors ${ICON_CLR[level]} hover:bg-black/5`}
            type="button"
            onClick={() => setDismissed(true)}
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
