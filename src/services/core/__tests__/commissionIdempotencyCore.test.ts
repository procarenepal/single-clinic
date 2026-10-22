import { describe, it, expect } from "vitest";

import {
  commissionDocId,
  registrationAnchorId,
} from "../commissionIdempotencyCore";

describe("commissionDocId", () => {
  it("is deterministic — same anchor+entity always gives the same id", () => {
    expect(commissionDocId("bill1", "doc1")).toBe(
      commissionDocId("bill1", "doc1"),
    );
  });

  it("differs across different anchors or entities, so distinct work never collides", () => {
    expect(commissionDocId("bill1", "doc1")).not.toBe(
      commissionDocId("bill2", "doc1"),
    );
    expect(commissionDocId("bill1", "doc1")).not.toBe(
      commissionDocId("bill1", "doc2"),
    );
  });

  it("is not just concatenation ambiguity — 'a1'+'b' can't collide with 'a'+'1b'", () => {
    // Both would naively concatenate to "a1_b" vs "a_1b" — different
    // strings, as intended; this just documents the separator is load-bearing.
    expect(commissionDocId("a1", "b")).not.toBe(commissionDocId("a", "1b"));
  });
});

describe("registrationAnchorId", () => {
  it("is deterministic per patient", () => {
    expect(registrationAnchorId("patient1")).toBe(
      registrationAnchorId("patient1"),
    );
  });

  it("differs across patients", () => {
    expect(registrationAnchorId("patient1")).not.toBe(
      registrationAnchorId("patient2"),
    );
  });

  it("can never collide with a real billing id anchor — reg_ prefix is reserved", () => {
    const realBillingAnchor = "bill123";
    const registrationAnchor = registrationAnchorId("bill123");

    expect(registrationAnchor).not.toBe(realBillingAnchor);
  });
});
