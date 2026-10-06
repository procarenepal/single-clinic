import { useEffect, useState } from "react";

import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { buildClinicianNameMap } from "@/services/core/clinicianDisplayCore";

/**
 * A clinic's doctors+experts, loaded once and reduced to an email → real
 * name map (see clinicianDisplayCore for why this exists). Use this when
 * rendering a list of staff accounts — a "Followed By" picker, an assigned-
 * staff dropdown — rather than printing each account's own displayName,
 * which can be a stale placeholder for any account tied to a doctor/expert
 * profile. For resolving just the logged-in user's own name, prefer
 * useLoggedInClinicianName instead — this hook fetches the whole roster,
 * which that single-user case doesn't need.
 */
export function useClinicianNameMap(clinicId?: string | null): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    if (!clinicId) {
      setMap(new Map());

      return;
    }

    Promise.all([
      doctorService.getDoctorsByClinic(clinicId),
      expertService.getExpertsByClinic(clinicId),
    ])
      .then(([doctors, experts]) => {
        if (!cancelled) setMap(buildClinicianNameMap(doctors, experts));
      })
      .catch((error) => {
        // Non-fatal — the caller's own fallback (account displayName) still
        // works without this map, so a failed fetch here shouldn't break
        // the staff picker it's rendering into.
        console.error("Error loading clinician name map:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  return map;
}
