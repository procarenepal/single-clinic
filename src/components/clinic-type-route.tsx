// src/components/clinic-type-route.tsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuthContext } from "@/context/AuthContext";
import { clinicService } from "@/services/clinicService";
import { pageService } from "@/services/pageService";

interface ClinicTypeRouteProps {
  children: React.ReactNode;
  path: string;
}

export const ClinicTypeRoute = ({ children, path }: ClinicTypeRouteProps) => {
  const { currentUser, userData, isLoading } = useAuthContext();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessChecking, setAccessChecking] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!currentUser || !currentUser.clinicId) {
        setHasAccess(false);
        setAccessChecking(false);

        return;
      }

      try {
        // Get the clinic to determine its type
        const clinic = await clinicService.getClinicById(currentUser.clinicId);

        if (!clinic || !clinic.clinicType) {
          setHasAccess(false);
          setAccessChecking(false);

          return;
        }

        // Get pages assigned to this clinic type
        const pages = await pageService.getPagesForClinicType(
          clinic.clinicType,
        );

        // Check if the current path is in the allowed pages
        const pageExists = pages.some((page) => page.path === path);

        setHasAccess(pageExists);
      } catch (error) {
        console.error("Error checking page access:", error);
        setHasAccess(false);
      } finally {
        setAccessChecking(false);
      }
    };

    if (!isLoading) {
      checkAccess();
    }
  }, [currentUser, path, isLoading]);

  if (isLoading || accessChecking) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

export default ClinicTypeRoute;
