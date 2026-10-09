/**
 * "Dr. " in front of a doctor's name, exactly once.
 *
 * Doctor records are entered by hand and some already carry the prefix
 * ("Dr. Pratik Bhusal"); every screen that prepended "Dr. " unconditionally
 * then showed "Dr. Dr. Pratik Bhusal". One place to get it right.
 */
export function withDoctorPrefix(name?: string | null): string {
  const trimmed = (name || "").trim();

  if (!trimmed) return "";

  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}
