/**
 * Vendor-wise and date-wise filtering for the Asset inventory page.
 */

/** Filter value meaning "don't filter by vendor". */
export const VENDOR_ALL = "__all__";

export interface VendorOption {
  key: string;
  label: string;
}

export type DatePreset = "all" | "today" | "last7" | "last30" | "custom";

/** The choices of the date filter, in the order they are listed. */
export const DATE_PRESET_OPTIONS: Array<{ key: DatePreset; label: string }> = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "custom", label: "Custom range" },
];

/** Key for a vendor name, so "Jhola Ktm" and " jhola ktm " count as one vendor. */
export function vendorKey(name?: string | null): string {
  const normalised = (name ?? "").trim().toLowerCase();

  return normalised ? `v:${normalised}` : "";
}

/** The distinct vendors in `names`, A–Z. Blank names are skipped. */
export function buildVendorOptions(
  names: Array<string | null | undefined>,
): VendorOption[] {
  const byKey = new Map<string, string>();

  names.forEach((name) => {
    const key = vendorKey(name);

    if (key && !byKey.has(key)) byKey.set(key, (name as string).trim());
  });

  return Array.from(byKey, ([key, label]) => ({ key, label })).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

/** Whether a record from vendor `name` passes the chosen vendor filter. */
export function matchesVendor(filter: string, name?: string | null): boolean {
  return filter === VENDOR_ALL || vendorKey(name) === filter;
}

/**
 * The local calendar day ("yyyy-MM-dd") of a Date, Firestore Timestamp or date
 * string. Empty when there is no readable date.
 */
export function toLocalYmd(value: unknown): string {
  if (!value) return "";

  // Already a calendar day — don't shift it through a timezone.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof (value as { toDate?: unknown }).toDate === "function") {
    date = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    return "";
  }

  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** `date`'s calendar day moved by `days`, as a plain "yyyy-MM-dd". */
function shiftedDay(date: Date, days: number): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  day.setDate(day.getDate() + days);

  return toLocalYmd(day);
}

/**
 * The inclusive range ("yyyy-MM-dd") a date-filter choice stands for. "Last 7
 * days" is today and the six days before it, "Last 30 days" is today and the
 * 29 before. `custom` is whatever was typed in.
 */
export function resolveDateRange(
  preset: DatePreset,
  custom: { from: string; to: string },
  now: Date = new Date(),
): { from: string; to: string } {
  const today = toLocalYmd(now);

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "last7":
      return { from: shiftedDay(now, -6), to: today };
    case "last30":
      return { from: shiftedDay(now, -29), to: today };
    case "custom":
      return custom;
    default:
      return { from: "", to: "" };
  }
}

/**
 * Whether a record's date falls inside the inclusive range `from`..`to`
 * ("yyyy-MM-dd"; either end may be blank). With no range every record passes;
 * once an end is set, a record with no readable date does not.
 */
export function isWithinDateRange(
  value: unknown,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;

  const day = toLocalYmd(value);

  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;

  return true;
}
