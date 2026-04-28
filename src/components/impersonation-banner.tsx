/**
 * ImpersonationBanner — Clinic Clarity Design
 *
 * Shown when a system-owner is impersonating a clinic user.
 * Robust features:
 *  - Reads impersonation metadata from localStorage (set by admin panel on login-as)
 *  - Shows: who is being impersonated, original admin identity, session duration timer
 *  - Warning pulse when session exceeds 30 min
 *  - Clean exit: clears flags, calls logout(), redirects back to admin
 *  - Zero HeroUI — fully custom UI
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  IoShieldOutline,
  IoLogOutOutline,
  IoTimeOutline,
  IoWarningOutline,
  IoPersonOutline,
  IoEyeOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

// ── Impersonation session data (written by admin panel at login-as) ────────────
interface ImpersonationMeta {
  /** UID of the original system-owner */
  originalAdminUid: string;
  /** Display name of the system-owner */
  originalAdminName: string;
  /** Email of the system-owner */
  originalAdminEmail: string;
  /** ISO timestamp when impersonation started */
  startedAt: string;
  /** URL to return to after exiting (defaults to /admin) */
  returnUrl?: string;
}

const STORAGE_KEY = "impersonationMeta";
const LEGACY_KEY = "isImpersonating";

function readMeta(): ImpersonationMeta | null {
  try {
    // New structured format
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) return JSON.parse(raw) as ImpersonationMeta;

    // Legacy boolean flag — synthetic meta with minimal data
    const legacy = localStorage.getItem(LEGACY_KEY);

    if (legacy === "true") {
      return {
        originalAdminUid: "unknown",
        originalAdminName: "Platform Admin",
        originalAdminEmail: "",
        startedAt: new Date().toISOString(),
        returnUrl: "/admin",
      };
    }

    return null;
  } catch {
    return null;
  }
}

function clearMeta() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  return `${h}h ${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const ImpersonationBanner: React.FC = () => {
  const { currentUser, userData, logout } = useAuthContext();

  const [meta, setMeta] = useState<ImpersonationMeta | null>(null);
  const [elapsed, setElapsed] = useState(0); // seconds since session start
  const [exiting, setExiting] = useState(false);

  // Read meta on mount and whenever auth changes
  useEffect(() => {
    setMeta(readMeta());
  }, [currentUser?.uid]);

  // Live timer — updates every second
  useEffect(() => {
    if (!meta) return;
    const start = new Date(meta.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));

    tick();
    const id = setInterval(tick, 1000);

    return () => clearInterval(id);
  }, [meta]);

  const handleExit = useCallback(async () => {
    setExiting(true);
    try {
      clearMeta();
      addToast({
        title: "Impersonation ended",
        description: "Returning to admin panel…",
        color: "primary",
      });
      await logout();
      window.location.href = meta?.returnUrl ?? "/admin";
    } catch (err) {
      console.error("Exit impersonation error:", err);
      addToast({ title: "Error exiting session", color: "danger" });
      setExiting(false);
    }
  }, [logout, meta?.returnUrl]);

  if (!meta) return null;

  const warnLong = elapsed >= 30 * 60; // warn after 30 minutes

  return (
    <div
      aria-live="polite"
      className={`
        mb-4 rounded border-l-4 overflow-hidden
        ${
          warnLong
            ? "bg-saffron-50 border-l-saffron-500"
            : "bg-teal-50 border-l-teal-700"
        }
        border border-r border-t border-b
        ${warnLong ? "border-saffron-200" : "border-teal-200"}
      `}
      role="alert"
    >
      {/* ── Top strip ──────────────────────────────────────────────────────── */}
      <div
        className={`flex items-center justify-between gap-3 px-3 py-2 ${warnLong ? "bg-saffron-100/60" : "bg-teal-100/60"}`}
      >
        {/* Left: identity info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Icon */}
          <div
            className={`shrink-0 p-1.5 rounded ${warnLong ? "bg-saffron-200 text-saffron-700" : "bg-teal-200 text-teal-700"}`}
          >
            <IoEyeOutline className="w-4 h-4" />
          </div>

          {/* Text */}
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <span
                className={`text-[12px] font-bold ${warnLong ? "text-saffron-800" : "text-teal-800"}`}
              >
                Impersonation Active
              </span>
              {/* Session duration badge */}
              <span
                className={`
                inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded
                ${warnLong ? "bg-saffron-200 text-saffron-800" : "bg-teal-200 text-teal-800"}
              `}
              >
                <IoTimeOutline className="w-3 h-3" />
                {formatDuration(elapsed)}
              </span>
              {warnLong && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-saffron-500 text-white animate-pulse">
                  <IoWarningOutline className="w-3 h-3" />
                  Long session
                </span>
              )}
            </div>

            {/* Who we're viewing as */}
            <p
              className={`text-[11px] mt-0.5 ${warnLong ? "text-saffron-700" : "text-teal-700"}`}
            >
              <span className="opacity-70">Viewing as </span>
              <span className="font-semibold">
                {userData?.displayName || userData?.email || "Clinic User"}
              </span>
              {userData?.role && (
                <span className="opacity-70">
                  {" "}
                  · {userData.role.replace(/-/g, " ")}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: exit button */}
        <Button
          className="shrink-0"
          color={warnLong ? "warning" : "primary"}
          isLoading={exiting}
          size="sm"
          startContent={
            !exiting ? <IoLogOutOutline className="w-3.5 h-3.5" /> : undefined
          }
          variant="solid"
          onClick={handleExit}
        >
          Exit
        </Button>
      </div>

      {/* ── Detail row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-1.5">
        {/* Admin identity */}
        <div className="flex items-center gap-1.5 text-[11px] text-mountain-500">
          <IoShieldOutline className="w-3 h-3 shrink-0 text-mountain-400" />
          <span>Logged in as:</span>
          <span className="font-semibold text-mountain-700">
            {meta.originalAdminName || "Platform Admin"}
          </span>
          {meta.originalAdminEmail && (
            <span className="text-mountain-400">
              ({meta.originalAdminEmail})
            </span>
          )}
        </div>

        {/* Session start */}
        <div className="flex items-center gap-1.5 text-[11px] text-mountain-400 hidden sm:flex">
          <IoTimeOutline className="w-3 h-3 shrink-0" />
          <span>
            Started{" "}
            {new Date(meta.startedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Read-only notice */}
        <div className="ml-auto flex items-center gap-1 text-[11px] text-mountain-400 hidden md:flex">
          <IoPersonOutline className="w-3 h-3" />
          <span>Support session — handle data with care</span>
        </div>
      </div>
    </div>
  );
};
