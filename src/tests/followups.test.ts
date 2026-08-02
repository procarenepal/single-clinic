import { describe, it, expect, vi } from "vitest";
import { isToday, isTomorrow, isYesterday, addDays, subDays } from "date-fns";

describe("Patient Follow-ups Logic", () => {
  describe("Date Filtering Logic", () => {
    // Simulating the exact date filtering logic from index.tsx
    const checkDateMatch = (
      dateFilter: "today" | "tomorrow" | "yesterday" | "all",
      nextFollowupDate: Date | null
    ) => {
      let matchesDate = true;
      if (dateFilter !== "all") {
        if (!nextFollowupDate) {
          matchesDate = false;
        } else {
          if (dateFilter === "today") matchesDate = isToday(nextFollowupDate);
          else if (dateFilter === "tomorrow") matchesDate = isTomorrow(nextFollowupDate);
          else if (dateFilter === "yesterday") matchesDate = isYesterday(nextFollowupDate);
        }
      }
      return matchesDate;
    };

    const today = new Date();
    const tomorrow = addDays(today, 1);
    const yesterday = subDays(today, 1);

    it("should match today when filter is 'today'", () => {
      expect(checkDateMatch("today", today)).toBe(true);
      expect(checkDateMatch("today", tomorrow)).toBe(false);
      expect(checkDateMatch("today", yesterday)).toBe(false);
      expect(checkDateMatch("today", null)).toBe(false);
    });

    it("should match tomorrow when filter is 'tomorrow'", () => {
      expect(checkDateMatch("tomorrow", tomorrow)).toBe(true);
      expect(checkDateMatch("tomorrow", today)).toBe(false);
    });

    it("should match yesterday when filter is 'yesterday'", () => {
      expect(checkDateMatch("yesterday", yesterday)).toBe(true);
      expect(checkDateMatch("yesterday", today)).toBe(false);
    });

    it("should match everything when filter is 'all'", () => {
      expect(checkDateMatch("all", today)).toBe(true);
      expect(checkDateMatch("all", tomorrow)).toBe(true);
      expect(checkDateMatch("all", null)).toBe(true);
    });
  });

  describe("Inline Status Update & Pending Count Auto-Completion", () => {
    // Simulating the exact state payload creation from index.tsx `handleInlineUpdate`
    const simulateInlineUpdate = (
      item: any,
      field: "session" | "initStatus" | "updatedStatus" | "category",
      value: string
    ) => {
      const currentSession = item.session || "1st";
      const sessionToUse = field === "session" ? value : currentSession;

      const payload: any = { [field]: value };
      const newSessionStatuses = { ...(item.sessionStatuses || {}) };

      if (field !== "session" && field !== "category") {
        if (!newSessionStatuses[sessionToUse]) newSessionStatuses[sessionToUse] = {};
        newSessionStatuses[sessionToUse] = {
          ...newSessionStatuses[sessionToUse],
          [field]: value,
        };
        payload.sessionStatuses = newSessionStatuses;
      }

      // The new logic that auto-completes the follow-up
      if (field === "updatedStatus" && value) {
        payload.overallStatus = "completed";
      }

      return payload;
    };

    it("should update overallStatus to 'completed' when updatedStatus is provided", () => {
      const mockItem = {
        id: "1",
        session: "1st",
        overallStatus: "pending",
        sessionStatuses: {}
      };

      const result = simulateInlineUpdate(mockItem, "updatedStatus", "satisfy");
      
      expect(result.updatedStatus).toBe("satisfy");
      expect(result.overallStatus).toBe("completed"); // Auto-completion behavior
      expect(result.sessionStatuses["1st"].updatedStatus).toBe("satisfy");
    });

    it("should NOT update overallStatus to 'completed' if updating a different field", () => {
      const mockItem = {
        id: "1",
        session: "1st",
        overallStatus: "pending",
        sessionStatuses: {}
      };

      const result = simulateInlineUpdate(mockItem, "initStatus", "good");
      
      expect(result.initStatus).toBe("good");
      expect(result.overallStatus).toBeUndefined(); // overallStatus remains unchanged
    });
  });

  describe("Modal Form Handle Change Auto-Completion", () => {
    // Simulating the exact handleChange logic from FollowupModal.tsx
    const simulateModalHandleChange = (
      prevFormData: any,
      field: string,
      value: string
    ) => {
      const next = { ...prevFormData, [field]: value };

      if (field === "updatedStatus" && value) {
        next.overallStatus = "completed";
      }

      if (field === "initStatus" || field === "updatedStatus") {
        const currentSession = prevFormData.session || "1st";
        const newSessionStatuses = { ...prevFormData.sessionStatuses };

        if (!newSessionStatuses[currentSession])
          newSessionStatuses[currentSession] = {};
        newSessionStatuses[currentSession] = {
          ...newSessionStatuses[currentSession],
          [field]: value,
        };
        next.sessionStatuses = newSessionStatuses;
      }

      return next;
    };

    it("should auto-update overallStatus to 'completed' in the modal when updatedStatus is selected", () => {
      const mockFormData = {
        session: "2nd",
        overallStatus: "pending",
        updatedStatus: "",
        sessionStatuses: {}
      };

      const result = simulateModalHandleChange(mockFormData, "updatedStatus", "complain");
      
      expect(result.updatedStatus).toBe("complain");
      expect(result.overallStatus).toBe("completed");
      expect(result.sessionStatuses["2nd"].updatedStatus).toBe("complain");
    });
  });
});
