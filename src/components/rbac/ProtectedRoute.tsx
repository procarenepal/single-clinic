import React, { useEffect, useState, useMemo } from "react";
import { Card, CardBody, Spinner } from "@heroui/react";
import { ShieldOffIcon } from "lucide-react";

import { useAuthContext } from "../../context/AuthContext";

import { cacheService } from "@/services/cacheService";

interface ProtectedRouteProps {
  children: React.ReactNode;
  pageId?: string;
  pagePath?: string;
  requireSuperAdmin?: boolean;
  requireClinicAdmin?: boolean;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = React.memo(
  ({
    children,
    pageId,
    pagePath,
    requireSuperAdmin = false,
    requireClinicAdmin = false,
    fallback,
  }) => {
    const {
      currentUser,
      clinicId,
      isSystemOwner,
      isClinicAdmin,
      hasPagePermission,
      hasPagePermissionByPath,
      preloadPermissions,
      isLoading,
    } = useAuthContext();

    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(true);

    // Memoize the access check logic to prevent unnecessary re-runs
    const accessCheckKey = useMemo(() => {
      return `${currentUser?.uid || "none"}-${clinicId || "none"}-${pageId || pagePath || "none"}-${requireSuperAdmin}-${requireClinicAdmin}`;
    }, [
      currentUser?.uid,
      clinicId,
      pageId,
      pagePath,
      requireSuperAdmin,
      requireClinicAdmin,
    ]);

    useEffect(() => {
      let isMounted = true;

      const checkAccess = async () => {
        if (isLoading) return;

        setChecking(true);

        try {
          // Super admin has access to everything
          if (isSystemOwner()) {
            if (isMounted) {
              setHasAccess(true);
              setChecking(false);
            }

            return;
          }

          // Check for super admin requirement
          if (requireSuperAdmin) {
            if (isMounted) {
              setHasAccess(false);
              setChecking(false);
            }

            return;
          }

          // Check for clinic admin requirement
          if (requireClinicAdmin && !isClinicAdmin()) {
            if (isMounted) {
              setHasAccess(false);
              setChecking(false);
            }

            return;
          }

          // If no user is logged in
          if (!currentUser) {
            if (isMounted) {
              setHasAccess(false);
              setChecking(false);
            }

            return;
          }

          // If no specific page permission is required, allow access
          if (!pageId && !pagePath) {
            if (isMounted) {
              setHasAccess(true);
              setChecking(false);
            }

            return;
          }

          // Must have clinicId to evaluate RBAC
          if (!clinicId) {
            if (isMounted) {
              setHasAccess(false);
              setChecking(false);
            }

            return;
          }

          // First try fully synchronous cached evaluation
          const userId = currentUser.uid;
          let cachedDecision: boolean | null = null;

          if (pagePath) {
            const resolvedPageId = cacheService.getPageIdByPath(
              userId,
              clinicId,
              pagePath,
            );

            if (resolvedPageId) {
              const p = cacheService.hasPagePermissionCached(
                userId,
                clinicId,
                resolvedPageId,
              );

              if (p !== null) cachedDecision = p;
            }
          } else if (pageId) {
            const p = cacheService.hasPagePermissionCached(
              userId,
              clinicId,
              pageId,
            );

            if (p !== null) cachedDecision = p;
          }

          if (cachedDecision !== null) {
            if (isMounted) {
              setHasAccess(cachedDecision);
              setChecking(false);
            }

            return;
          }

          // Cache miss: proactively preload permissions once, then re-check synchronously
          try {
            await preloadPermissions();
          } catch (e) {
            // Ignore preload errors; we'll fallback to async checks
          }

          // Re-check cache after preload
          cachedDecision = null;
          if (pagePath) {
            const resolvedPageId = cacheService.getPageIdByPath(
              userId,
              clinicId,
              pagePath,
            );

            if (resolvedPageId) {
              const p = cacheService.hasPagePermissionCached(
                userId,
                clinicId,
                resolvedPageId,
              );

              if (p !== null) cachedDecision = p;
            }
          } else if (pageId) {
            const p = cacheService.hasPagePermissionCached(
              userId,
              clinicId,
              pageId,
            );

            if (p !== null) cachedDecision = p;
          }

          if (cachedDecision !== null) {
            if (isMounted) {
              setHasAccess(cachedDecision);
              setChecking(false);
            }

            return;
          }

          // Final fallback: use existing async helpers (should rarely run after first load)
          if (pageId) {
            try {
              const permission = await hasPagePermission(pageId);

              if (isMounted) {
                setHasAccess(permission);
                setChecking(false);
              }
            } catch (error) {
              console.error("Error checking page permission by ID:", error);
              if (isMounted) {
                setHasAccess(false);
                setChecking(false);
              }
            }

            return;
          }

          if (pagePath) {
            try {
              const permission = await hasPagePermissionByPath(pagePath);

              if (isMounted) {
                setHasAccess(permission);
                setChecking(false);
              }
            } catch (error) {
              console.error("Error checking page permission by path:", error);
              if (isMounted) {
                setHasAccess(false);
                setChecking(false);
              }
            }

            return;
          }

          // Default to false if we couldn't determine access
          if (isMounted) {
            setHasAccess(false);
            setChecking(false);
          }
        } catch (error) {
          console.error("Error checking route access:", error);
          if (isMounted) {
            setHasAccess(false);
            setChecking(false);
          }
        }
      };

      checkAccess();

      return () => {
        isMounted = false;
      };
    }, [
      accessCheckKey, // Use the memoized key instead of individual deps
      isLoading,
      isSystemOwner,
      isClinicAdmin,
      hasPagePermission,
      hasPagePermissionByPath,
      preloadPermissions,
      clinicId,
      currentUser?.uid,
      pageId,
      pagePath,
      requireClinicAdmin,
      requireSuperAdmin,
    ]);

    // Show loading spinner while checking permissions
    if (isLoading || checking) {
      return (
        <div className="flex justify-center items-center min-h-[200px]">
          <Spinner size="lg" />
        </div>
      );
    }

    // Show access denied if no permission
    if (hasAccess === false) {
      if (fallback) {
        return <>{fallback}</>;
      }

      return (
        <div className="container mx-auto p-6">
          <Card>
            <CardBody className="text-center py-12">
              <ShieldOffIcon className="mx-auto mb-4 text-gray-400" size={48} />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-gray-600">
                You don't have permission to access this page.
              </p>
              {requireSuperAdmin && (
                <p className="text-sm text-gray-500 mt-2">
                  This page requires super administrator privileges.
                </p>
              )}
              {requireClinicAdmin && (
                <p className="text-sm text-gray-500 mt-2">
                  This page requires clinic administrator privileges.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      );
    }

    // Render children if access is granted
    return <>{children}</>;
  },
);
