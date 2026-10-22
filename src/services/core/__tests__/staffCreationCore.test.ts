import { describe, it, expect } from "vitest";

import {
  isClinicalRole,
  normalizeEmail,
  missingClinicalFields,
  detectEmailCollision,
  emailCollisionMessage,
  generateSecurePassword,
} from "../staffCreationCore";

describe("isClinicalRole", () => {
  it("is true only for doctor and expert", () => {
    expect(isClinicalRole("doctor")).toBe(true);
    expect(isClinicalRole("expert")).toBe(true);
    expect(isClinicalRole("staff")).toBe(false);
    expect(isClinicalRole("clinic-admin")).toBe(false);
    expect(isClinicalRole("hr")).toBe(false);
    expect(isClinicalRole("")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Doctor@Clinic.com  ")).toBe("doctor@clinic.com");
  });

  it("handles null/undefined/empty without throwing", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("")).toBe("");
  });

  it("is idempotent", () => {
    const once = normalizeEmail("Mixed.Case@Example.COM");

    expect(normalizeEmail(once)).toBe(once);
  });
});

describe("missingClinicalFields", () => {
  const complete = {
    phone: "9800000000",
    speciality: "ent",
    licenseNumber: "NMC-1",
    practitionerType: "regular",
  };

  it("is empty when every field is present", () => {
    expect(missingClinicalFields(complete)).toEqual([]);
  });

  it("lists each missing field by key, not just true/false", () => {
    expect(missingClinicalFields({ ...complete, phone: "" })).toEqual([
      "phone",
    ]);
    expect(
      missingClinicalFields({ speciality: "", licenseNumber: "" }),
    ).toEqual(
      expect.arrayContaining(["phone", "speciality", "licenseNumber", "practitionerType"]),
    );
  });

  it("treats a missing key the same as an empty one", () => {
    expect(missingClinicalFields({})).toEqual([
      "phone",
      "speciality",
      "licenseNumber",
      "practitionerType",
    ]);
  });
});

describe("detectEmailCollision", () => {
  it("is null when neither a login nor a profile exists", () => {
    expect(detectEmailCollision(false, false)).toBeNull();
  });

  it("flags a login-only collision", () => {
    expect(detectEmailCollision(true, false)).toBe("login");
  });

  it("flags a profile-only collision", () => {
    expect(detectEmailCollision(false, true)).toBe("profile");
  });

  it("flags both when a login and a profile already exist", () => {
    expect(detectEmailCollision(true, true)).toBe("both");
  });
});

describe("emailCollisionMessage", () => {
  it("names which kind of record collided", () => {
    expect(emailCollisionMessage("login")).toMatch(/login/i);
    expect(emailCollisionMessage("profile")).toMatch(/profile/i);
    expect(emailCollisionMessage("both")).toMatch(/login/i);
    expect(emailCollisionMessage("both")).toMatch(/profile/i);
  });
});

describe("generateSecurePassword", () => {
  it("clears Firebase Auth's 6-character minimum by a wide margin", () => {
    expect(generateSecurePassword().length).toBeGreaterThanOrEqual(40);
  });

  it("is lowercase hex — no characters a password-strength check could reject", () => {
    expect(generateSecurePassword()).toMatch(/^[0-9a-f]+$/);
  });

  it("never repeats across calls", () => {
    const seen = new Set(Array.from({ length: 50 }, generateSecurePassword));

    expect(seen.size).toBe(50);
  });
});
