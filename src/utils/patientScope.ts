/**
 * Which patients the logged-in person may see.
 *
 * A doctor sees the patients assigned to them (patient.doctorId) and the ones
 * they have treated — anyone with an appointment or prescription under their
 * name. The doctor record a login belongs to is found by email, as everywhere
 * else in the app. A doctor login that matches no doctor record has no patients
 * to see — it must never fall back to the whole clinic. Admins and other staff
 * are not limited here.
 */
export interface PatientScope {
  restricted: boolean;
  /** The doctor the login belongs to; null when no doctor record matches. */
  doctorId: string | null;
  /** Patients this doctor has treated (an appointment or prescription). */
  treatedPatientIds: ReadonlySet<string>;
}

const NO_PATIENTS: ReadonlySet<string> = new Set();

export const OPEN_PATIENT_SCOPE: PatientScope = {
  restricted: false,
  doctorId: null,
  treatedPatientIds: NO_PATIENTS,
};

/**
 * The scope for a login, given its role and the doctor record (if any) its
 * email matches. Any non-admin login that matches a doctor is limited to that
 * doctor's patients; a "doctor" login that matches none sees no patients.
 */
export function scopeFor(
  role: string | undefined,
  matchedDoctorId: string | null,
): PatientScope {
  if (role === "clinic-admin") return OPEN_PATIENT_SCOPE;
  if (matchedDoctorId) {
    return {
      restricted: true,
      doctorId: matchedDoctorId,
      treatedPatientIds: NO_PATIENTS,
    };
  }

  return role === "doctor"
    ? { restricted: true, doctorId: null, treatedPatientIds: NO_PATIENTS }
    : OPEN_PATIENT_SCOPE;
}

/** The same scope, also covering the patients the doctor has treated. */
export function withTreatedPatients(
  scope: PatientScope,
  patientIds: Iterable<string>,
): PatientScope {
  if (!scope.restricted || !scope.doctorId) return scope;

  return { ...scope, treatedPatientIds: new Set(patientIds) };
}

/** Whether `patient` may be shown to someone with this scope. */
export function canViewPatient(
  scope: PatientScope,
  patient: { id?: string | null; doctorId?: string | null },
): boolean {
  if (!scope.restricted) return true;
  if (!scope.doctorId) return false;

  return (
    patient.doctorId === scope.doctorId ||
    (!!patient.id && scope.treatedPatientIds.has(patient.id))
  );
}

/**
 * Whether `patient`'s record may be changed. Treating a patient is enough to
 * see them; changing the record stays with the assigned doctor.
 */
export function canEditPatient(
  scope: PatientScope,
  patient: { doctorId?: string | null },
): boolean {
  if (!scope.restricted) return true;

  return !!scope.doctorId && patient.doctorId === scope.doctorId;
}
