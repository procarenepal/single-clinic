import { describe, it, expect } from "vitest";

import { csvCell, toCsv } from "../csv";

describe("csvCell", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("Himalayan Medico")).toBe("Himalayan Medico");
    expect(csvCell(80000)).toBe("80000");
    expect(csvCell(0)).toBe("0");
  });

  it("quotes values containing a comma so they stay in one column", () => {
    expect(csvCell("Shah, Patel & Sons")).toBe('"Shah, Patel & Sons"');
  });

  it("doubles embedded quotes", () => {
    expect(csvCell('10" monitor')).toBe('"10"" monitor"');
  });

  it("quotes values containing line breaks", () => {
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("writes empty for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("keeps every row at the same number of columns", () => {
    const csv = toCsv([
      ["Bill #", "Vendor", "Total (Rs)"],
      ["INV-1", "Shah, Patel & Sons", 900],
    ]);

    expect(csv).toBe(
      'Bill #,Vendor,Total (Rs)\nINV-1,"Shah, Patel & Sons",900',
    );
  });
});
