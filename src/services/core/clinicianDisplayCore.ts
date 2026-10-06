/**
 * Resolves a staff directory's real names — the same problem
 * useLoggedInClinicianName solves for "whoever is logged in", extended to
 * an entire list of accounts at once.
 *
 * A `users` record's `displayName` is a placeholder set once at account
 * creation; nothing keeps it in sync with the doctors/experts clinical
 * profile the same email is tied to, which is the actively-maintained name
 * shown everywhere else in the app. A staff picker built straight from
 * `users.displayName` shows every doctor and expert under that stale
 * placeholder, not just the logged-in one — observed live on the "Followed
 * By" dropdown in FollowupModal.tsx, which listed "Dr. Clinic Doctor" as an
 * option rather than "Dr. Pratik Bhusal".
 *
 * Matching the whole list in memory (rather than one lookup per user) is
 * deliberate: a clinic's doctor/expert roster is small, already fetched in
 * one call each, and this avoids N round trips for an N-person staff list.
 */

export interface ClinicianProfile {
  email?: string | null;
  name?: string | null;
}

export interface DirectoryUser {
  email?: string | null;
  displayName?: string | null;
}

const normaliseEmail = (email: string | null | undefined) =>
  (email || "").trim().toLowerCase();

/**
 * Builds an email → real name map from a clinic's doctors and experts
 * lists. Doctors are checked first; a person who is both (unusual, but the
 * data doesn't forbid it) resolves to their doctor name, matching the
 * precedence already used by useLoggedInClinicianName.
 */
export function buildClinicianNameMap(
  doctors: ClinicianProfile[],
  experts: ClinicianProfile[],
): Map<string, string> {
  const byEmail = new Map<string, string>();

  for (const expert of experts) {
    const email = normaliseEmail(expert.email);

    if (email && expert.name) byEmail.set(email, expert.name);
  }

  // After experts, so a doctor match overwrites an expert match for the
  // same email — doctors win ties.
  for (const doctor of doctors) {
    const email = normaliseEmail(doctor.email);

    if (email && doctor.name) byEmail.set(email, doctor.name);
  }

  return byEmail;
}

/**
 * The name to actually show for one staff-directory entry: their matched
 * clinical profile's name when the map has one, otherwise their account's
 * own displayName, otherwise their email, otherwise "Unknown".
 */
export function resolveStaffDisplayName(
  user: DirectoryUser,
  clinicianNameMap: Map<string, string>,
): string {
  const matched = clinicianNameMap.get(normaliseEmail(user.email));

  return matched || user.displayName || user.email || "Unknown";
}
