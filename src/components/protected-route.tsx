import { ReactNode, useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthContext } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPageId?: string; // internal usage kept for backward compatibility
  /**
   * When true (default), the component renders children optimistically while
   * subscription & permission checks run in the background (no spinner).
   * If false, you can supply your own fallback UI before auth resolves.
   */
  optimistic?: boolean;
  /** Optional minimal placeholder element while auth state (not permissions) is loading */
  loadingPlaceholder?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredPageId,
  optimistic = true,
  loadingPlaceholder = null,
}: ProtectedRouteProps) {
  const {
    currentUser,
    isLoading,
    userData,
    hasPagePermission,
    hasPagePermissionSync,
    subscriptionValid,
    permissionsReady,
    checkClinicSubscription,
  } = useAuthContext();
  const location = useLocation();

  // Tri-state markers
  const [permissionAllowed, setPermissionAllowed] = useState<boolean | null>(
    null,
  );
  const runningCheckRef = useRef(0); // increment to invalidate stale async results

  // Run permission + subscription checks in parallel when prerequisites satisfied
  useEffect(() => {
    if (!currentUser || isLoading) {
      setPermissionAllowed(null);

      return;
    }

    const runId = ++runningCheckRef.current;
    const isSystemOwner = userData?.role === "system-owner";

    // Fast path: system owner always allowed
    if (isSystemOwner) {
      setPermissionAllowed(true);

      return;
    }

    // Try synchronous cache first
    if (requiredPageId) {
      const syncResult = hasPagePermissionSync(requiredPageId);

      if (syncResult !== null) {
        setPermissionAllowed(syncResult && subscriptionValid !== false);
      } else {
        // Fallback async only if cache miss
        (async () => {
          try {
            const perm = await hasPagePermission(requiredPageId);

            if (runId === runningCheckRef.current) {
              setPermissionAllowed(perm && subscriptionValid !== false);
            }
          } catch (e) {
            if (runId === runningCheckRef.current) setPermissionAllowed(false);
          }
        })();
      }
    } else {
      setPermissionAllowed(subscriptionValid !== false);
    }
  }, [
    currentUser,
    isLoading,
    requiredPageId,
    userData?.role,
    hasPagePermission,
    hasPagePermissionSync,
    subscriptionValid,
  ]);

  // Still establishing base auth state — show optional placeholder (no spinner by default)
  if (isLoading) {
    return <>{loadingPlaceholder}</>;
  }

  // Not authenticated
  if (!currentUser) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  // Account deactivated
  if (userData && !userData.isActive) {
    return (
      <Navigate replace state={{ error: "Account deactivated" }} to="/login" />
    );
  }



  // If background checks finished and denied
  if (permissionAllowed === false) {
    if (subscriptionValid === false) {
      return (
        <Navigate
          replace
          state={{
            error:
              "Your clinic's subscription has expired or been cancelled. Please contact your administrator.",
          }}
          to="/login"
        />
      );
    }

    return (
      <Navigate
        replace
        state={{ error: "Insufficient permissions" }}
        to="/dashboard"
      />
    );
  }

  // Optimistic rendering: if permissionAllowed null and optimistic, show children;
  // if not optimistic, show placeholder until permission resolves or permissionsReady known to be true with no requiredPageId.
  if (permissionAllowed === null) {
    if (optimistic) return <>{children}</>;

    return <>{loadingPlaceholder}</>;
  }

  return <>{children}</>;
}
