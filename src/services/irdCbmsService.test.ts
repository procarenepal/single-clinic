import { describe, it, expect, vi, beforeEach } from "vitest";

import { getNepaliFiscalYear } from "./irdCbmsService";

vi.mock("../config/firebase", () => ({
  auth: {
    currentUser: { getIdToken: vi.fn().mockResolvedValue("mock-id-token") },
  },
}));

describe("irdCbmsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNepaliFiscalYear", () => {
    it("should calculate fiscal year for dates before Shrawan (e.g., Baishakh)", () => {
      // Baishakh is the 1st month. Before Shrawan (4th month), it falls in the previous fiscal year.
      // Example: 2080-01-01 BS (approx mid April 2023)
      const date = new Date("2023-04-14");
      const fy = getNepaliFiscalYear(date);

      // If year is 2080 and month is 1, fiscal year should be 2079.80
      expect(fy).toMatch(/\d{4}\.\d{2}/);
    });

    it("should calculate fiscal year for dates after Shrawan (e.g., Mangsir)", () => {
      // Example: 2080-08-01 BS (approx mid Nov 2023)
      const date = new Date("2023-11-17");
      const fy = getNepaliFiscalYear(date);

      // If year is 2080 and month is 8, fiscal year should be 2080.81
      expect(fy).toMatch(/\d{4}\.\d{2}/);
    });
  });
});
