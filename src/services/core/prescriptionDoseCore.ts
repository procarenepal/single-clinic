/**
 * How many units of a medicine a prescription actually dispenses.
 *
 * Nepali clinics write frequency and duration in a mix of English, Latin
 * abbreviations and the Nepali morning-noon-night notation — "twice daily",
 * "BD", "b.i.d." and "1-0-1" all mean the same two doses a day. Turning that
 * into a quantity is the one piece of real judgement in dispensing against a
 * prescription, and it was previously inlined inside a JSX callback in
 * pharmacy.tsx where nothing could test it and nothing else could reuse it.
 *
 * The result is a SUGGESTION. Staff can always correct the quantity before
 * dispensing, which is why an unrecognised frequency or duration falls back to
 * the smallest sensible number rather than refusing or guessing high: handing
 * someone a short count they can raise is safer than handing them a long one
 * they might not notice.
 */

/** Doses per day implied by a frequency, defaulting to one. */
export function dosesPerDay(frequency: string | undefined | null): number {
  const f = (frequency || "").toLowerCase().trim();

  if (!f) return 1;

  if (
    f.includes("once daily") ||
    f === "od" ||
    f === "qd" ||
    f === "q.d." ||
    f === "1-0-0" ||
    f === "0-1-0" ||
    f === "0-0-1"
  ) {
    return 1;
  }

  if (
    f.includes("twice daily") ||
    f === "bd" ||
    f === "bid" ||
    f === "b.i.d." ||
    f === "1-0-1" ||
    f === "2-0-2"
  ) {
    return 2;
  }

  if (
    f.includes("three times daily") ||
    f === "tds" ||
    f === "tid" ||
    f === "t.i.d." ||
    f === "1-1-1"
  ) {
    return 3;
  }

  if (f.includes("four times daily") || f === "qid" || f === "q.i.d.") {
    return 4;
  }

  // "as needed" has no schedule, so one unit is the only defensible
  // suggestion — the alternative is dispensing a course nobody asked for.
  if (f.includes("as needed") || f === "sos" || f === "prn") {
    return 1;
  }

  const explicit = f.match(/(\d+)\s*(times|tabs|caps|doses|day)/);

  if (explicit) return parseInt(explicit[1], 10);

  return 1;
}

/** Days implied by a duration, defaulting to one. */
export function durationInDays(duration: string | undefined | null): number {
  const d = (duration || "").toLowerCase().trim();
  const match = d.match(/(\d+)/);

  if (!match) return 1;

  let days = parseInt(match[1], 10);

  if (d.includes("week")) days *= 7;
  else if (d.includes("month")) days *= 30;

  return days;
}

/**
 * The quantity to dispense for one prescribed line: doses per day across the
 * prescribed duration.
 */
export function suggestedDispenseQuantity(item: {
  frequency?: string | null;
  duration?: string | null;
}): number {
  return durationInDays(item.duration) * dosesPerDay(item.frequency);
}

/**
 * The longest duration on a prescription, which is the course length the sale
 * is recorded against.
 */
export function courseDurationInDays(
  items: Array<{ duration?: string | null }>,
): number {
  return items.reduce(
    (max, item) => Math.max(max, durationInDays(item.duration)),
    0,
  );
}
