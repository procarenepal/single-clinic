/**
 * Shared date-range quick-filter predicate for the 3 billing list pages
 * (appointment/pathology/pharmacy) — kept in one place so "Today"/"This
 * Week"/"This Month" mean exactly the same date math everywhere.
 */
export type DateRangeFilter = "all" | "today" | "week" | "month";

export const DATE_RANGE_OPTIONS: { key: DateRangeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

export function isWithinDateRange(
  date: Date | string,
  filter: DateRangeFilter,
): boolean {
  if (filter === "all") return true;

  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  if (filter === "today") {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  if (filter === "week") {
    // Week starts Sunday, matching Date.getDay()'s 0-6 convention.
    const startOfWeek = new Date(now);

    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return d >= startOfWeek && d <= now;
  }

  // month
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export type SortDirection = "asc" | "desc";
