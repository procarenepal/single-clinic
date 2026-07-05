import React from "react";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { IoBusinessOutline } from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";

interface SystemOwnerRouteProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

/**
 * ProtectedRoute component specifically for clinic super admin features
 * Bypasses clinic type page authorization and only checks role
 */
export function SystemOwnerRoute({
  children,
  fallbackMessage = "Only system owners can access this page.",
}: SystemOwnerRouteProps) {
  const { userData, isLoading } = useAuthContext();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner label="Loading..." size="md" />
      </div>
    );
  }

  // Check if user is clinic super admin or clinic admin
  const isAuthorized =
    userData?.role === "system-owner" || userData?.role === "clinic-admin";

  if (!isAuthorized) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="border border-warning-200 bg-warning-50">
          <CardBody className="p-6">
            <div className="flex items-center gap-3">
              <IoBusinessOutline className="text-warning text-2xl" />
              <div>
                <h3 className="text-lg font-semibold text-warning-800">
                  Access Restricted
                </h3>
                <p className="text-warning-700">{fallbackMessage}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
