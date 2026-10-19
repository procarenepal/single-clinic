import { describe, expect, it } from "vitest";

import { describeCbmsResponseCode } from "../cbmsResponseCodes";

describe("describeCbmsResponseCode", () => {
  it("explains the config-not-enabled code — the most common cause of a silent failure", () => {
    expect(describeCbmsResponseCode("400")).toMatch(/not configured or enabled/i);
  });

  it("explains a credentials mismatch", () => {
    expect(describeCbmsResponseCode("100")).toMatch(/credentials/i);
  });

  it("explains an invalid model/payload", () => {
    expect(describeCbmsResponseCode("104")).toMatch(/invalid/i);
  });

  it("falls back to a generic HTTP-rejection message for an unrecognized 3-digit code", () => {
    expect(describeCbmsResponseCode("403")).toBe("CBMS rejected the request (HTTP 403).");
  });

  it("treats 500 as a network/exception failure, not an HTTP rejection", () => {
    expect(describeCbmsResponseCode("500")).toMatch(/could not reach/i);
  });

  it("explains the no-recognizable-code sentinel", () => {
    expect(describeCbmsResponseCode("2xx-NOCODE")).toMatch(/didn't return a recognizable/i);
  });

  it("returns null for an absent or unrecognized code, so callers fall back to the raw value", () => {
    expect(describeCbmsResponseCode(undefined)).toBeNull();
    expect(describeCbmsResponseCode(null)).toBeNull();
    expect(describeCbmsResponseCode("")).toBeNull();
    expect(describeCbmsResponseCode("not-a-code")).toBeNull();
  });
});
