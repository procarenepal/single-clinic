/**
 * "Login Access" panel for a doctor/expert clinical profile.
 *
 * Clinical profiles (doctors/experts collections) and login accounts (users
 * collection) are two separate records, linked only by matching email — the
 * same join every other screen in this app already uses to resolve "who is
 * logged in" to their clinical profile (see useLoggedInClinicianName). This
 * panel is the one place that creates that login side for a profile that
 * doesn't have one yet, so a doctor/expert added without a login can be
 * granted one later without re-entering their clinical details.
 */
import React, { useEffect, useState } from "react";
import {
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoKeyOutline,
  IoLockClosedOutline,
  IoRefreshOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { addToast } from "@/components/ui/toast";
import { userService } from "@/services/userService";
import { rbacService } from "@/services/rbacService";
import { normalizeEmail } from "@/services/core/staffCreationCore";
import { UserRole } from "@/types/models";

interface ClinicalProfileLoginAccessProps {
  role: Extract<UserRole, "doctor" | "expert">;
  email?: string;
  displayName: string;
  phone?: string;
  clinicId: string;
  branchId?: string;
}

export function ClinicalProfileLoginAccess({
  role,
  email,
  displayName,
  phone,
  clinicId,
  branchId,
}: ClinicalProfileLoginAccessProps) {
  const normalizedEmail = normalizeEmail(email);
  const [checking, setChecking] = useState(true);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  // Distinct from "no login found" — a failed check must never be treated
  // as a confirmed negative. Rendering "No login access yet" for a lookup
  // that actually errored (offline, a transient permission hiccup) would
  // invite creating a second, duplicate login for someone who already has
  // one, rather than telling the admin the check itself didn't complete.
  const [checkFailed, setCheckFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!normalizedEmail) {
      setLoginEmail(null);
      setCheckFailed(false);
      setChecking(false);

      return;
    }

    setChecking(true);
    setCheckFailed(false);
    userService
      .getUserByEmail(normalizedEmail)
      .then((user) => {
        if (!cancelled) setLoginEmail(user ? normalizedEmail : null);
      })
      .catch((error) => {
        console.error("ClinicalProfileLoginAccess: login status check failed", error);
        if (!cancelled) {
          setLoginEmail(null);
          setCheckFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedEmail, retryToken]);

  const handleCreateLogin = async () => {
    if (!normalizedEmail) return;
    if (
      !confirm(
        `Create a login for ${displayName} at ${normalizedEmail} with the ${role === "doctor" ? "Doctor" : "Expert"} role? They'll be emailed a link to set their own password.`,
      )
    ) {
      return;
    }

    setCreating(true);
    try {
      // No password is collected here — userService.createUser generates
      // and discards a random one internally. Nobody, including the admin
      // creating this login, ever sees a credential that could sit around
      // valid-but-unused before the person opens the reset email.
      const newUserId = await userService.createUser(
        normalizedEmail,
        undefined,
        {
          displayName,
          role,
          clinicId,
          ...(branchId ? { branchId } : {}),
          ...(phone ? { phone } : {}),
        },
        undefined,
        "login-access-panel",
      );

      try {
        await rbacService.ensureDefaultClinicalRoleAssigned(
          clinicId,
          newUserId,
          role,
        );
        addToast({
          title: "Login created",
          description: `${displayName} can now sign in with ${normalizedEmail} and has dashboard access. A password reset link has been emailed to them.`,
          color: "success",
        });
      } catch (rbacError: any) {
        addToast({
          title: "Login created, access setup incomplete",
          description:
            "The login was created, but their dashboard permissions could not be set automatically. Assign a role from Settings > RBAC > User Management.",
          color: "warning",
        });
      }
      setLoginEmail(normalizedEmail);
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error?.message || "Failed to create login.",
        color: "danger",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-surface border border-border-base rounded-[10px] shadow-sm">
      <div className="px-5 py-4 border-b border-border-base/50 bg-surface-2/50">
        <h4 className="font-semibold text-[15px] text-text-main leading-none">
          Login Access
        </h4>
      </div>
      <div className="p-6">
        {checking ? (
          <div className="flex items-center gap-2 text-[13.5px] text-text-muted">
            <Spinner size="sm" />
            Checking login status…
          </div>
        ) : !normalizedEmail ? (
          <p className="text-[13.5px] text-text-muted">
            Save an email address on this profile to grant login access.
          </p>
        ) : checkFailed ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[13.5px] text-warning">
              <IoAlertCircleOutline className="w-4.5 h-4.5" />
              Couldn't check login status — try again before creating one.
            </div>
            <Button
              size="sm"
              startContent={<IoRefreshOutline />}
              variant="flat"
              onPress={() => setRetryToken((n) => n + 1)}
            >
              Retry
            </Button>
          </div>
        ) : loginEmail ? (
          <div className="flex items-center gap-2 text-[13.5px] text-success">
            <IoCheckmarkCircleOutline className="w-4.5 h-4.5" />
            Has a login account ({loginEmail}). Manage its role or
            deactivation from Staff &amp; User Management.
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[13.5px] text-text-muted">
              <IoLockClosedOutline className="w-4.5 h-4.5" />
              No login access yet — this person can't sign in.
            </div>
            <Button
              isLoading={creating}
              size="sm"
              startContent={!creating && <IoKeyOutline />}
              variant="flat"
              onPress={handleCreateLogin}
            >
              Create Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
