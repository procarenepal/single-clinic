/**
 * Pure logic shared by every place that creates a staff/doctor/expert login
 * or clinical profile — Staff & User Management, the Add New Doctor/Expert
 * pages' optional "create a login" checkbox, and ClinicalProfileLoginAccess's
 * "grant login later" recovery panel. Kept separate from those React
 * handlers so it can be unit-tested directly, per this codebase's usual
 * services/core pattern.
 */

export type ClinicalRole = "doctor" | "expert";

export function isClinicalRole(role: string): role is ClinicalRole {
  return role === "doctor" || role === "expert";
}

/**
 * Canonical form an email is stored/queried under everywhere a login or
 * clinical profile is created. Without this, the same person's email could
 * be stored as "Doctor@Clinic.com" in one write and queried as
 * "doctor@clinic.com" in another — an exact-match Firestore query treats
 * those as different documents, so a login and its profile can silently
 * stop finding each other.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export interface ClinicalProfileFields {
  phone: string;
  speciality: string;
  licenseNumber: string;
  practitionerType: string;
}

/**
 * Which required clinical-profile fields are missing, as field keys — not
 * just a boolean — so a caller can build a specific error message instead
 * of a generic "fill in all required fields" that doesn't say which one.
 */
export function missingClinicalFields(
  fields: Partial<ClinicalProfileFields>,
): Array<keyof ClinicalProfileFields> {
  const missing: Array<keyof ClinicalProfileFields> = [];

  if (!fields.phone) missing.push("phone");
  if (!fields.speciality) missing.push("speciality");
  if (!fields.licenseNumber) missing.push("licenseNumber");
  if (!fields.practitionerType) missing.push("practitionerType");

  return missing;
}

export type EmailCollisionKind = "login" | "profile" | "both";

/**
 * Decide whether a create attempt should be blocked for a colliding email,
 * given what the two independent lookups (an existing login, an existing
 * clinical profile) found. Pure decision logic — the caller does the actual
 * Firestore reads and passes in only their presence/absence.
 */
export function detectEmailCollision(
  hasExistingLogin: boolean,
  hasExistingProfile: boolean,
): EmailCollisionKind | null {
  if (hasExistingLogin && hasExistingProfile) return "both";
  if (hasExistingLogin) return "login";
  if (hasExistingProfile) return "profile";

  return null;
}

export function emailCollisionMessage(kind: EmailCollisionKind): string {
  switch (kind) {
    case "both":
      return "A login and a clinical profile already exist for this email.";
    case "login":
      return "A login account already exists for this email.";
    case "profile":
      return "A doctor/expert profile already exists for this email.";
  }
}

/**
 * A password nobody ever sees or types, used only to satisfy
 * createUserWithEmailAndPassword's required parameter before a password-
 * reset email replaces it — see userService.createUser's doc comment for
 * why this replaced collecting one from the admin. Not cryptographically
 * reviewed for use as a long-lived secret (it isn't one); the only real
 * requirements are "unguessable" and "clears Firebase Auth's 6-character
 * floor by a wide margin," which 48 hex characters from the Web Crypto
 * CSPRNG comfortably does.
 */
export function generateSecurePassword(): string {
  const bytes = new Uint8Array(24);

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
