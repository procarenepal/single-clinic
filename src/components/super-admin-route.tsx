import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@heroui/spinner";

import { useAuthContext } from "@/context/AuthContext";

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

export const SuperAdminRoute: React.FC<SuperAdminRouteProps> = ({
  children,
}) => {
  const { currentUser, userData, isLoading } = useAuthContext();
  const location = useLocation();

  // Show loading state while auth status is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner label="Loading..." size="lg" />
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!currentUser) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  // If not a super admin, redirect to dashboard
  if (userData?.role !== "system-owner") {
    return <Navigate replace to="/dashboard" />;
  }

  // Render the protected content
  return <>{children}</>;
};
