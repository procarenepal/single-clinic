/**
 * The signed-in user's clinic, readable from plain service functions.
 *
 * Why this exists: Firestore authorises a list/listen only when the query
 * itself proves it can return nothing outside the caller's clinic. Rules on
 * these collections all require `resource.data.clinicId == <my clinic>`, so a
 * query filtered only on an owner field (doctorId, patientId, staffId) is
 * rejected outright. That went unnoticed because clinic-admin satisfies the
 * rules through their super-admin branch — every other role simply got
 * "Missing or insufficient permissions" and an empty screen.
 *
 * Services that already receive a clinicId keep using it; this is the
 * fallback for the many that don't, so the constraint could be added without
 * rewriting every call site. Set once when auth resolves, cleared on sign-out.
 */
let currentClinicId: string | null = null;

export function setCurrentClinicId(clinicId: string | null): void {
  currentClinicId = clinicId;
}

export function getCurrentClinicId(): string | null {
  return currentClinicId;
}

/**
 * The clinic a query must be scoped to. Prefers an explicitly supplied id so
 * callers that already thread one through keep full control.
 */
export function resolveClinicId(explicit?: string | null): string | null {
  return explicit || currentClinicId;
}
