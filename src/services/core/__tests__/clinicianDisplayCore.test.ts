import { describe, it, expect } from "vitest";

import {
  buildClinicianNameMap,
  resolveStaffDisplayName,
} from "../clinicianDisplayCore";

describe("buildClinicianNameMap / resolveStaffDisplayName", () => {
  const doctors = [{ email: "doctor@hsclhospital.com", name: "Dr. Pratik Bhusal" }];
  const experts = [{ email: "expert@hsclhospital.com", name: "Manisha Basnet" }];

  it("resolves a user to their doctor profile's real name", () => {
    // The exact live case: the account's own displayName is the stale
    // placeholder "Dr. Clinic Doctor"; the doctors record tied to the same
    // email is "Dr. Pratik Bhusal" — the name on every patient row and
    // invoice that login operates on.
    const map = buildClinicianNameMap(doctors, experts);

    expect(
      resolveStaffDisplayName(
        { email: "doctor@hsclhospital.com", displayName: "Dr. Clinic Doctor" },
        map,
      ),
    ).toBe("Dr. Pratik Bhusal");
  });

  it("resolves a user to their expert profile's real name", () => {
    const map = buildClinicianNameMap(doctors, experts);

    expect(
      resolveStaffDisplayName(
        { email: "expert@hsclhospital.com", displayName: "Staff Account" },
        map,
      ),
    ).toBe("Manisha Basnet");
  });

  it("matches case-insensitively", () => {
    const map = buildClinicianNameMap(doctors, experts);

    expect(
      resolveStaffDisplayName(
        { email: "Doctor@HSCLHospital.com", displayName: "whatever" },
        map,
      ),
    ).toBe("Dr. Pratik Bhusal");
  });

  it("falls back to the account displayName for staff with no clinical profile", () => {
    const map = buildClinicianNameMap(doctors, experts);

    // Front-desk/admin/HR accounts correctly have no doctors/experts
    // record — their own account name IS the right name to show.
    expect(
      resolveStaffDisplayName(
        { email: "frontdesk@hsclhospital.com", displayName: "HSCL Admin" },
        map,
      ),
    ).toBe("HSCL Admin");
  });

  it("falls back to email, then Unknown, when nothing else is available", () => {
    const map = buildClinicianNameMap([], []);

    expect(resolveStaffDisplayName({ email: "x@y.com" }, map)).toBe("x@y.com");
    expect(resolveStaffDisplayName({}, map)).toBe("Unknown");
  });

  it("prefers the doctor profile when one person is both (doctor wins the tie)", () => {
    const map = buildClinicianNameMap(
      [{ email: "both@hsclhospital.com", name: "Dr. Both" }],
      [{ email: "both@hsclhospital.com", name: "Expert Both" }],
    );

    expect(
      resolveStaffDisplayName({ email: "both@hsclhospital.com" }, map),
    ).toBe("Dr. Both");
  });

  it("ignores a clinician profile with no email or no name", () => {
    const map = buildClinicianNameMap(
      [{ name: "No Email Doctor" }, { email: "noname@x.com" }],
      [],
    );

    expect(map.size).toBe(0);
  });
});
