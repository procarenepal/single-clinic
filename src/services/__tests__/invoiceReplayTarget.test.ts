/**
 * invoiceReplayTarget.test.ts
 *
 * The create-invoice endpoint is idempotent: resend the same invoice and the
 * backend returns the ledger row it already made instead of minting a second
 * one. That is correct for the tax ledger, but the client used to write a
 * brand-new Firestore document on every attempt, so one ledger row could end
 * up with two app invoices showing the same number (observed live on
 * INV-2083.084-0003 and -0009).
 *
 * resolveReplayTarget is what makes a replay detectable, by comparing the
 * source pointer the backend reports against the document id the caller just
 * minted. The invariant it enforces: the Firestore document for a ledger row
 * is the document that ledger row points at.
 */

import { describe, it, expect } from "vitest";

import { resolveReplayTarget } from "../core/billingLifecycleCore";
import { InvoiceResponseDto } from "../api/billingApi";

function response(sourceDocId?: string): InvoiceResponseDto {
  return {
    id: 42,
    invoiceNumber: "INV-2083.084-0014",
    irdSynced: false,
    sourceCollection: "appointmentBilling",
    sourceDocId,
  };
}

describe("resolveReplayTarget", () => {
  it("treats a pointer matching the id we just minted as a fresh create", () => {
    const result = resolveReplayTarget(response("abc123"), "abc123");

    expect(result.isReplay).toBe(false);
    expect(result.targetDocId).toBe("abc123");
  });

  it("detects a replay when the backend points at a different document", () => {
    // The backend returned the invoice an EARLIER create produced, so its
    // pointer is that first attempt's document — not the one we just minted.
    const result = resolveReplayTarget(response("firstAttemptDoc"), "freshlyMinted");

    expect(result.isReplay).toBe(true);
    expect(result.targetDocId).toBe("firstAttemptDoc");
  });

  it("writes to our own id when the backend reports no pointer at all", () => {
    // Older ledger rows predate the source pointer (added in the V8
    // migration). Those must keep working, not be mistaken for replays.
    expect(resolveReplayTarget(response(undefined), "mine")).toEqual({
      isReplay: false,
      targetDocId: "mine",
    });
    expect(resolveReplayTarget(response(""), "mine")).toEqual({
      isReplay: false,
      targetDocId: "mine",
    });
  });

  it("never returns a target the caller did not ask for or the ledger does not hold", () => {
    // Guards the invariant directly: whatever comes back is either the id we
    // minted or the one the ledger row points at — never a third document.
    for (const [pointer, intended] of [
      ["p1", "i1"],
      ["i1", "i1"],
      [undefined, "i1"],
    ] as Array<[string | undefined, string]>) {
      const { targetDocId } = resolveReplayTarget(response(pointer), intended);

      expect([pointer, intended]).toContain(targetDocId);
    }
  });
});
