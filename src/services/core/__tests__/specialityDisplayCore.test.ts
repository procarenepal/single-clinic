import { describe, it, expect } from "vitest";

import {
  resolveSpecialityLabel,
  looksLikeUnresolvedId,
} from "../specialityDisplayCore";

const specialities = [
  { id: "WzV19Le9fiqRfMzBCWXx", name: "General Practice" },
  { id: "abc123", key: "dermatology", name: "Dermatology" },
];

describe("resolveSpecialityLabel", () => {
  it("resolves a document id, which is what the dropdown stores when a speciality has no key", () => {
    // The exact live case: an expert saved with the speciality's document id,
    // which the front office queue printed raw as
    // "General Practice & WzV19Le9fiqRfMzBCWXx".
    expect(resolveSpecialityLabel("WzV19Le9fiqRfMzBCWXx", specialities)).toBe(
      "General Practice",
    );
  });

  it("resolves a key", () => {
    expect(resolveSpecialityLabel("dermatology", specialities)).toBe(
      "Dermatology",
    );
  });

  it("prefers a key match over a document id match", () => {
    const ambiguous = [
      { id: "shared", name: "By Id" },
      { key: "shared", name: "By Key" },
    ];

    expect(resolveSpecialityLabel("shared", ambiguous)).toBe("By Key");
  });

  it("passes through a legacy record that stored the name itself", () => {
    expect(resolveSpecialityLabel("General Practice", specialities)).toBe(
      "General Practice",
    );
  });

  it("passes the value through when the list has not loaded yet", () => {
    // Better to show something briefly than to blank the field on every
    // render before the specialities arrive.
    expect(resolveSpecialityLabel("Dermatology", undefined)).toBe("Dermatology");
    expect(resolveSpecialityLabel("Dermatology", [])).toBe("Dermatology");
  });

  it("keeps the stored value when the speciality was deleted", () => {
    expect(resolveSpecialityLabel("gone-key", specialities)).toBe("gone-key");
  });

  it("is empty for an empty or whitespace value", () => {
    expect(resolveSpecialityLabel("", specialities)).toBe("");
    expect(resolveSpecialityLabel("   ", specialities)).toBe("");
    expect(resolveSpecialityLabel(undefined, specialities)).toBe("");
    expect(resolveSpecialityLabel(null, specialities)).toBe("");
  });
});

describe("looksLikeUnresolvedId", () => {
  it("recognises a Firestore auto-id", () => {
    expect(looksLikeUnresolvedId("WzV19Le9fiqRfMzBCWXx")).toBe(true);
    expect(looksLikeUnresolvedId("2hcAmFznPBp0oBUeBbbb")).toBe(true);
  });

  it("does not mistake a real speciality name for one", () => {
    expect(looksLikeUnresolvedId("General Practice")).toBe(false);
    expect(looksLikeUnresolvedId("Dermatology")).toBe(false);
    expect(looksLikeUnresolvedId("dermatology")).toBe(false);
    expect(looksLikeUnresolvedId("Skin & Laser Consultant")).toBe(false);
  });

  it("is false for empty input", () => {
    expect(looksLikeUnresolvedId("")).toBe(false);
    expect(looksLikeUnresolvedId(undefined)).toBe(false);
  });
});
