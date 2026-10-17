import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../config/firebase";
import { resolveClinicId } from "./currentClinic";

import { doctorService } from "@/services/doctorService";
import {
  OPEN_PATIENT_SCOPE,
  scopeFor,
  withTreatedPatients,
  type PatientScope,
} from "@/utils/patientScope";

export { canEditPatient, canViewPatient } from "@/utils/patientScope";
export type { PatientScope } from "@/utils/patientScope";

/** How long a login's scope is reused before the treated patients are re-read. */
const SCOPE_TTL_MS = 60_000;

/**
 * The patients a doctor has treated: everyone with an appointment or a
 * prescription under their name.
 */
async function treatedPatientIds(
  doctorId: string,
  clinicId: string | null | undefined,
): Promise<Set<string>> {
  const ids = new Set<string>();
  const scopedClinicId = resolveClinicId(clinicId);

  if (!scopedClinicId) return ids;

  await Promise.all(
    ["appointments", "prescriptions"].map(async (name) => {
      try {
        const snap = await getDocs(
          query(
            collection(db, name),
            where("doctorId", "==", doctorId),
            where("clinicId", "==", scopedClinicId),
          ),
        );

        snap.forEach((record) => {
          const patientId = record.data().patientId;

          if (patientId) ids.add(patientId);
        });
      } catch (error) {
        // Leaving a source out only ever shows fewer patients, never more.
        console.error(
          `Could not read ${name} for the doctor's patients:`,
          error,
        );
      }
    }),
  );

  return ids;
}

async function resolveScope(
  uid: string,
  authEmail: string | null,
): Promise<PatientScope> {
  const snap = await getDoc(doc(db, "users", uid));
  const user = snap.exists() ? snap.data() : null;
  const role: string | undefined = user?.role;
  const email: string = (user?.email || authEmail || "").trim();

  if (role === "clinic-admin" || !email) return scopeFor(role, null);

  const doctor = await doctorService.getDoctorByEmail(email, user?.clinicId);
  const scope = scopeFor(role, doctor?.id ?? null);

  if (!scope.restricted || !scope.doctorId) return scope;

  return withTreatedPatients(
    scope,
    await treatedPatientIds(scope.doctorId, user?.clinicId),
  );
}

let settled: { uid: string; scope: PatientScope; expires: number } | null =
  null;
let inFlight: { uid: string; promise: Promise<PatientScope> } | null = null;

/**
 * The scope of whoever is signed in now. Waits for Firebase to restore the
 * session first, and reuses the answer for that login for a minute. A doctor
 * login with no doctor record yet is looked up again next time, so linking one
 * takes effect without signing out.
 */
export async function getPatientScope(): Promise<PatientScope> {
  await auth.authStateReady();

  const user = auth.currentUser;

  // Signed out: Firestore refuses the patient reads itself.
  if (!user) return OPEN_PATIENT_SCOPE;
  if (settled?.uid === user.uid && settled.expires > Date.now()) {
    return settled.scope;
  }

  if (inFlight?.uid !== user.uid) {
    const uid = user.uid;
    const promise = resolveScope(uid, user.email)
      .then((scope) => {
        if (!scope.restricted || scope.doctorId) {
          settled = { uid, scope, expires: Date.now() + SCOPE_TTL_MS };
        }

        return scope;
      })
      .finally(() => {
        inFlight = null;
      });

    inFlight = { uid, promise };
  }

  return inFlight.promise;
}
