import { describe, it, expect } from "vitest";

import {
  VENDOR_ALL,
  buildVendorOptions,
  isWithinDateRange,
  matchesVendor,
  resolveDateRange,
  toLocalYmd,
  vendorKey,
} from "../inventoryFilters";

describe("resolveDateRange", () => {
  const none = { from: "", to: "" };
  const now = new Date(2026, 9, 16, 15, 30); // 16 Oct 2026

  it("has no range for All time", () => {
    expect(resolveDateRange("all", none, now)).toEqual(none);
  });

  it("Today is just today, morning or night", () => {
    const today = { from: "2026-10-16", to: "2026-10-16" };

    expect(resolveDateRange("today", none, now)).toEqual(today);
    expect(
      resolveDateRange("today", none, new Date(2026, 9, 16, 0, 1)),
    ).toEqual(today);
    expect(
      resolveDateRange("today", none, new Date(2026, 9, 16, 23, 59)),
    ).toEqual(today);
  });

  it("Last 7 days is today plus the six days before", () => {
    expect(resolveDateRange("last7", none, now)).toEqual({
      from: "2026-10-10",
      to: "2026-10-16",
    });
  });

  it("Last 30 days is today plus the 29 days before", () => {
    expect(resolveDateRange("last30", none, now)).toEqual({
      from: "2026-09-17",
      to: "2026-10-16",
    });
  });

  it("rolls back across a month and year end", () => {
    const early = new Date(2026, 0, 3, 9);

    expect(resolveDateRange("last7", none, early)).toEqual({
      from: "2025-12-28",
      to: "2026-01-03",
    });
    expect(resolveDateRange("last30", none, early)).toEqual({
      from: "2025-12-05",
      to: "2026-01-03",
    });
  });

  it("hands back a custom range as typed", () => {
    const typed = { from: "2026-02-01", to: "" };

    expect(resolveDateRange("custom", typed, now)).toEqual(typed);
  });
});

describe("vendorKey", () => {
  it("treats case and surrounding spaces as the same vendor", () => {
    expect(vendorKey("Jhola Ktm")).toBe(vendorKey("  jhola ktm "));
  });

  it("is empty for a missing or blank name", () => {
    expect(vendorKey(undefined)).toBe("");
    expect(vendorKey(null)).toBe("");
    expect(vendorKey("   ")).toBe("");
  });
});

describe("buildVendorOptions", () => {
  it("lists each vendor once, A–Z, keeping the first spelling seen", () => {
    const options = buildVendorOptions([
      "Zen Supplies",
      "Jhola Ktm",
      "jhola ktm ",
      "Alpha Traders",
    ]);

    expect(options.map((o) => o.label)).toEqual([
      "Alpha Traders",
      "Jhola Ktm",
      "Zen Supplies",
    ]);
  });

  it("skips blank and missing names", () => {
    expect(buildVendorOptions(["", "  ", undefined, null])).toEqual([]);
  });
});

describe("matchesVendor", () => {
  it("lets everything through when no vendor is chosen", () => {
    expect(matchesVendor(VENDOR_ALL, "Anyone")).toBe(true);
    expect(matchesVendor(VENDOR_ALL, undefined)).toBe(true);
  });

  it("matches the chosen vendor only", () => {
    const chosen = vendorKey("Jhola Ktm");

    expect(matchesVendor(chosen, " JHOLA KTM")).toBe(true);
    expect(matchesVendor(chosen, "Alpha Traders")).toBe(false);
    expect(matchesVendor(chosen, undefined)).toBe(false);
  });
});

describe("toLocalYmd", () => {
  it("uses the local calendar day of a Date, early morning or late night", () => {
    expect(toLocalYmd(new Date(2026, 9, 16, 0, 30))).toBe("2026-10-16");
    expect(toLocalYmd(new Date(2026, 9, 16, 23, 59))).toBe("2026-10-16");
  });

  it("keeps a yyyy-MM-dd string as it is", () => {
    expect(toLocalYmd("2026-01-05")).toBe("2026-01-05");
  });

  it("reads a Firestore-style Timestamp", () => {
    const timestamp = { toDate: () => new Date(2026, 0, 5, 12) };

    expect(toLocalYmd(timestamp)).toBe("2026-01-05");
  });

  it("is empty for missing or unreadable values", () => {
    expect(toLocalYmd(undefined)).toBe("");
    expect(toLocalYmd(null)).toBe("");
    expect(toLocalYmd("not a date")).toBe("");
    expect(toLocalYmd(new Date("nope"))).toBe("");
    expect(toLocalYmd({})).toBe("");
  });
});

describe("isWithinDateRange", () => {
  const day = new Date(2026, 9, 16, 10);

  it("passes every record when no range is set, even one with no date", () => {
    expect(isWithinDateRange(day, "", "")).toBe(true);
    expect(isWithinDateRange(undefined, "", "")).toBe(true);
  });

  it("includes both end days", () => {
    expect(isWithinDateRange(day, "2026-10-16", "2026-10-16")).toBe(true);
    expect(isWithinDateRange(day, "2026-10-01", "2026-10-31")).toBe(true);
  });

  it("excludes days outside the range", () => {
    expect(isWithinDateRange(day, "2026-10-17", "")).toBe(false);
    expect(isWithinDateRange(day, "", "2026-10-15")).toBe(false);
  });

  it("works with only one end set", () => {
    expect(isWithinDateRange(day, "2026-10-01", "")).toBe(true);
    expect(isWithinDateRange(day, "", "2026-12-31")).toBe(true);
  });

  it("drops records with no readable date once a range is set", () => {
    expect(isWithinDateRange(undefined, "2026-10-01", "")).toBe(false);
    expect(isWithinDateRange("garbage", "", "2026-10-31")).toBe(false);
  });
});
