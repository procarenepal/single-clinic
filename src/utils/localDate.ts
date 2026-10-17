const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Turns a calendar date into a Date the way a person reading it would.
 *
 * `new Date("2026-10-16")` is parsed as UTC midnight, so on any clock
 * behind UTC it lands on the evening of the 15th and every "that day"
 * range built from it is a day early; ahead of UTC it is simply the 16th
 * at an odd hour. Date pickers, URL params and todayLocalDateString all
 * produce this exact `yyyy-mm-dd` shape, so it is parsed as LOCAL
 * midnight here. Anything else (an ISO timestamp, a Date, a number) is
 * passed straight to `new Date`, which makes this a safe drop-in for it.
 */
export function parseLocalDate(value: string | Date | number): Date {
  if (typeof value === "string") {
    const match = DATE_ONLY.exec(value.trim());

    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
    }
  }

  return new Date(value);
}

/**
 * The local calendar date as `yyyy-mm-dd` — the shape a date picker's
 * value takes. `toISOString().split("T")[0]` gives the UTC date instead,
 * which is yesterday in Nepal between midnight and 05:45 and tomorrow on
 * a clock behind UTC after the evening.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * The local date and wall-clock time as `yyyy-mm-ddThh:mm` — the shape a
 * `datetime-local` input takes. `toISOString().slice(0, 16)` gives UTC
 * time instead, 5:45 early in Nepal.
 */
export function formatLocalDateTime(date: Date = new Date()): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${formatLocalDate(date)}T${hours}:${minutes}`;
}
