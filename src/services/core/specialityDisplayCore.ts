/**
 * Turns a stored speciality value into something a human should read.
 *
 * A doctor's or expert's `speciality` field does not hold one consistent
 * kind of value. The settings dropdown emits `speciality.key || speciality.id`
 * as its option value, so a speciality record saved without a `key` hands
 * out its Firestore document id instead — and that id is what gets written
 * onto the clinician. Older records, saved before specialities were their
 * own collection, hold the plain display name.
 *
 * So the same field can hold a key ("general-practice"), a document id
 * ("WzV19Le9fiqRfMzBCWXx") or a name ("General Practice"), and every screen
 * that printed it raw showed a document id to staff for clinicians saved the
 * first way. Observed live: an expert's speciality rendered on the front
 * office queue as "General Practice & WzV19Le9fiqRfMzBCWXx".
 *
 * Resolving on read rather than migrating the data is deliberate: storing an
 * id is the correct thing to store, the legacy name-valued records stay
 * readable, and nothing has to be rewritten to make the screens correct.
 */

export interface SpecialityOption {
  id?: string;
  key?: string;
  name?: string;
}

/**
 * Resolves by key first, then document id, then falls back to the stored
 * value itself — which is already the display name on legacy records, and on
 * anything referencing a speciality that has since been deleted is still the
 * most informative thing available.
 */
export function resolveSpecialityLabel(
  stored: string | undefined | null,
  specialities: SpecialityOption[] | undefined,
): string {
  const value = (stored || "").trim();

  if (!value) return "";
  if (!specialities || specialities.length === 0) return value;

  const match =
    specialities.find((s) => s.key && s.key === value) ||
    specialities.find((s) => s.id && s.id === value);

  return match?.name?.trim() || value;
}

/**
 * True when the stored value is an unresolved reference rather than
 * something readable — i.e. it matched no speciality and looks like a
 * Firestore auto-id (20 chars, mixed case, no separators or spaces).
 *
 * Used to decide whether to show a placeholder instead of leaking an id into
 * the UI when the speciality list has loaded and genuinely has no match.
 */
export function looksLikeUnresolvedId(value: string | undefined | null): boolean {
  const v = (value || "").trim();

  return /^[A-Za-z0-9]{20}$/.test(v) && /[a-z]/.test(v) && /[A-Z]/.test(v);
}
