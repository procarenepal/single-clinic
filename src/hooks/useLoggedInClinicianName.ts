import { useEffect, useState } from "react";

import { useAuthContext } from "@/context/AuthContext";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";

/**
 * The name on the logged-in user's doctors/experts clinical profile, when
 * they have one — resolved by email, the same match used throughout the
 * app (front-office routing and notifications, the profile page, the
 * header) to tie an Auth login to its clinical record.
 *
 * This exists because the Auth/account displayName is a placeholder set
 * once at account creation, and nothing keeps it in sync with the
 * clinical profile's name — which is the one actively maintained
 * everywhere else in the app (patient rows, invoices, queues). Observed
 * live: a login with Auth displayName "Dr. Clinic Doctor" matched, by
 * email, a doctors record named "Dr. Pratik Bhusal" — the name on every
 * patient row and invoice that same login operates on. Several screens
 * independently read the raw Auth name before this was pulled out as one
 * place to get it right (see dashboard-header.tsx and profile.tsx for the
 * first two fixes, and front-office-desk.tsx's getLoggedInClinicianName
 * for the same idea inline, where the matched lists were already loaded).
 *
 * Use this specifically for attributing an action to "whoever is logged
 * in" — a follow-up log entry, a note, a signature line — where the
 * component doesn't already have the doctors/experts lists loaded for
 * some other reason (if it does, as front-office-desk.tsx does, resolving
 * inline against that existing data avoids a redundant fetch).
 *
 * Falls back to the Firestore user doc's displayName, then the Auth
 * displayName, then `fallback` — correct behaviour for an account that
 * matches no clinical profile at all (front-desk, admin, HR logins, which
 * genuinely have none).
 */
export function useLoggedInClinicianName(fallback: string = "Staff"): string {
  const { currentUser, userData, clinicId } = useAuthContext();
  const [clinicianName, setClinicianName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!clinicId || !currentUser?.email) {
      setClinicianName(null);

      return;
    }

    (async () => {
      try {
        const doctor = await doctorService.getDoctorByEmail(
          currentUser.email!,
          clinicId,
        );

        if (cancelled) return;
        if (doctor?.name) {
          setClinicianName(doctor.name);

          return;
        }

        const expert = await expertService.getExpertByEmail(
          currentUser.email!,
          clinicId,
        );

        if (cancelled) return;
        if (expert?.name) setClinicianName(expert.name);
      } catch (error) {
        // Non-fatal — falls through to the account name below. An
        // attribution field should never block the action it's labelling.
        console.error("Error resolving logged-in clinician name:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicId, currentUser?.email]);

  return (
    clinicianName ||
    userData?.displayName ||
    currentUser?.displayName ||
    fallback
  );
}
