import { describe, it, expect } from "vitest";

import { formatLocalDate, parseLocalDate } from "../localDate";

describe("parseLocalDate", () => {
  it("reads a yyyy-mm-dd string as local midnight, whatever the timezone", () => {
    const d = parseLocalDate("2026-10-16");

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("round-trips with formatLocalDate", () => {
    expect(formatLocalDate(parseLocalDate("2026-01-05"))).toBe("2026-01-05");
    expect(formatLocalDate(parseLocalDate("2026-12-31"))).toBe("2026-12-31");
  });

  it("passes timestamps, Dates and numbers through unchanged", () => {
    const iso = "2026-10-16T13:45:00.000Z";

    expect(parseLocalDate(iso).getTime()).toBe(new Date(iso).getTime());

    const asDate = new Date(2026, 9, 16, 8, 30);

    expect(parseLocalDate(asDate).getTime()).toBe(asDate.getTime());
    expect(parseLocalDate(asDate.getTime()).getTime()).toBe(asDate.getTime());
  });

  it("still yields an invalid Date for garbage, like new Date would", () => {
    expect(Number.isNaN(parseLocalDate("not a date").getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate("").getTime())).toBe(true);
  });
});

describe("formatLocalDate", () => {
  it("formats the local calendar date, zero-padded", () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("defaults to today", () => {
    const now = new Date();

    expect(formatLocalDate()).toBe(formatLocalDate(now));
  });
});
