import { describe, it, expect } from "vitest";

import { isNotificationForViewer } from "../notificationTargetingCore";

describe("isNotificationForViewer", () => {
  const doctorViewer = {
    userId: "auth-uid-doctor",
    role: "doctor",
    doctorId: "HwTUMYHjyMz656JmGupt",
    expertId: null,
  };

  it("matches a targetUserId notification against the viewer's doctor id, not their Auth uid", () => {
    // The real shape in this app: sendNotification targets the DOCTORS
    // collection id (appt.doctorId), which is a different id space from
    // the Firebase Auth uid. Comparing only against Auth uid would make
    // every doctor-targeted notification invisible to the doctor it's for.
    expect(
      isNotificationForViewer(
        { targetRole: "doctor", targetUserId: "HwTUMYHjyMz656JmGupt" },
        doctorViewer,
      ),
    ).toBe(true);
  });

  it("matches a targetUserId notification against the viewer's expert id", () => {
    const expertViewer = {
      userId: "auth-uid-expert",
      role: "expert",
      doctorId: null,
      expertId: "2hcAmFznPBp0oBUeBbbb",
    };

    expect(
      isNotificationForViewer(
        { targetRole: "expert", targetUserId: "2hcAmFznPBp0oBUeBbbb" },
        expertViewer,
      ),
    ).toBe(true);
  });

  it("excludes a targetUserId notification aimed at someone else, even with a matching role", () => {
    // Two doctors share role "doctor" but are different people — a
    // notification naming one specifically is not the other's.
    expect(
      isNotificationForViewer(
        { targetRole: "doctor", targetUserId: "some-other-doctor-id" },
        doctorViewer,
      ),
    ).toBe(false);
  });

  it("falls back to role matching only when no targetUserId is set", () => {
    expect(
      isNotificationForViewer({ targetRole: "doctor" }, doctorViewer),
    ).toBe(true);
    expect(
      isNotificationForViewer(
        { targetRole: "front-office" },
        doctorViewer,
      ),
    ).toBe(false);
  });

  it("shows a general broadcast to non-clinical staff", () => {
    const admin = { userId: "admin-uid", role: "clinic-admin" };
    const frontDesk = { userId: "fd-uid", role: "staff" };

    expect(isNotificationForViewer({}, admin)).toBe(true);
    expect(isNotificationForViewer({}, frontDesk)).toBe(true);
  });

  it("hides a general broadcast from clinical staff", () => {
    expect(isNotificationForViewer({}, doctorViewer)).toBe(false);
    expect(
      isNotificationForViewer(
        {},
        { userId: "x", role: "expert", expertId: "e1" },
      ),
    ).toBe(false);
  });

  it("treats a role of 'doctor'/'expert' as clinical even without a matched id yet", () => {
    // The id is resolved asynchronously after login (an email-match
    // lookup) — the role field is known immediately, so broadcasts must
    // stay hidden from a doctor/expert account even in that brief window.
    expect(
      isNotificationForViewer(
        {},
        { userId: "x", role: "doctor", doctorId: null, expertId: null },
      ),
    ).toBe(false);
  });
});
