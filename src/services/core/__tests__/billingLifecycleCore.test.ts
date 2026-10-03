import { describe, it, expect, vi } from "vitest";
import {
  isRecordLocked,
  assertFinancialFieldsUnlocked,
  resolveInvoicePrefix,
  javaResultSyncFields,
  runBlockingJavaSyncThenFirestoreWrite,
  buildCreditNoteSkeleton,
} from "../billingLifecycleCore";

const guardConfig = {
  financialKeys: ["totalAmount", "subtotal", "taxAmount", "discountAmount"],
  allowlist: ["paidAmount", "balanceAmount", "paymentStatus", "status", "irdSynced"],
  financialErrorMessage: "FINANCIAL_BLOCKED",
  notesErrorMessage: "NOTES_BLOCKED",
  dataErrorMessage: "DATA_BLOCKED",
};

describe("isRecordLocked", () => {
  it("is unlocked when neither irdSynced nor a locked status", () => {
    expect(isRecordLocked({ irdSynced: false, status: "draft" })).toBe(false);
  });

  it("is locked when irdSynced is true regardless of status", () => {
    expect(isRecordLocked({ irdSynced: true, status: "draft" })).toBe(true);
  });

  it("is locked on status 'finalized' even without irdSynced", () => {
    expect(isRecordLocked({ irdSynced: false, status: "finalized" })).toBe(true);
  });

  it("does NOT lock on an extra status unless explicitly passed (appointment's exact rule)", () => {
    expect(isRecordLocked({ irdSynced: false, status: "paid" })).toBe(false);
  });

  it("locks on an extra status when passed (pathology's exact rule)", () => {
    expect(isRecordLocked({ irdSynced: false, status: "paid" }, ["paid"])).toBe(true);
  });
});

describe("assertFinancialFieldsUnlocked", () => {
  const existing = { totalAmount: 1000, subtotal: 900, notes: "original note" };

  it("allows any change when not locked", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(existing, { totalAmount: 2000 }, false, guardConfig),
    ).not.toThrow();
  });

  it("throws on a financial field change when locked", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(existing, { totalAmount: 2000 }, true, guardConfig),
    ).toThrow("FINANCIAL_BLOCKED");
  });

  it("throws on an items change when locked", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(
        existing,
        { items: [{ a: 1 }] },
        true,
        guardConfig,
      ),
    ).toThrow("FINANCIAL_BLOCKED");
  });

  it("allows an allowlisted field change when locked", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(existing, { paidAmount: 500 }, true, guardConfig),
    ).not.toThrow();
  });

  it("allows notes to be appended to when locked", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(
        existing,
        { notes: "original note + cancellation reason" },
        true,
        guardConfig,
      ),
    ).not.toThrow();
  });

  it("throws when notes are rewritten (not appended) when locked", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(existing, { notes: "a different note" }, true, guardConfig),
    ).toThrow("NOTES_BLOCKED");
  });

  it("throws on any other non-allowlisted field change when locked", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(
        existing,
        { patientName: "Someone Else" },
        true,
        guardConfig,
      ),
    ).toThrow("DATA_BLOCKED");
  });

  it("does not throw when a non-allowlisted field is sent unchanged", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(
        { ...existing, patientName: "Same" },
        { patientName: "Same" },
        true,
        guardConfig,
      ),
    ).not.toThrow();
  });

  it("normalizes undefined/0 so re-sending an unset financial field as 0 isn't a false-positive change", () => {
    expect(() =>
      assertFinancialFieldsUnlocked(
        { totalAmount: 1000 }, // discountAmount undefined on existing
        { discountAmount: 0 },
        true,
        guardConfig,
      ),
    ).not.toThrow();
  });
});

describe("resolveInvoicePrefix", () => {
  it("always uses CN for a credit note, ignoring the clinic's configured prefix", () => {
    expect(resolveInvoicePrefix(true, "HSCL")).toBe("CN");
  });

  it("uses the clinic's configured prefix for a normal sale", () => {
    expect(resolveInvoicePrefix(false, "HSCL")).toBe("HSCL");
  });

  it("returns undefined (letting the Java backend default) when no prefix is configured", () => {
    expect(resolveInvoicePrefix(false, "")).toBeUndefined();
    expect(resolveInvoicePrefix(false, null)).toBeUndefined();
  });
});

describe("javaResultSyncFields", () => {
  it("maps a synced response, converting the IRD sync date to a Date", () => {
    const fields = javaResultSyncFields({
      id: 42,
      invoiceNumber: "INV-1",
      irdSynced: true,
      irdSyncDate: "2026-10-02T12:00:00Z",
      cbmsResponseCode: "200",
    });

    expect(fields.javaInvoiceId).toBe(42);
    expect(fields.irdSynced).toBe(true);
    expect(fields.irdSyncDate).toBeInstanceOf(Date);
    expect(fields.cbmsResponseCode).toBe("200");
  });

  it("normalizes a never-synced response to null, not undefined (Firestore rejects undefined)", () => {
    const fields = javaResultSyncFields({
      id: 7,
      invoiceNumber: "INV-2",
      irdSynced: false,
    });

    expect(fields.irdSynced).toBe(false);
    expect(fields.irdSyncDate).toBeNull();
    expect(fields.cbmsResponseCode).toBeNull();
  });
});

describe("runBlockingJavaSyncThenFirestoreWrite", () => {
  const okResult = { id: 1, invoiceNumber: "INV-2083.084-0001", irdSynced: true };

  it("writes to Firestore only after Java returns, and passes the Java result through", async () => {
    const order: string[] = [];

    const out = await runBlockingJavaSyncThenFirestoreWrite(
      async () => {
        order.push("java");

        return okResult;
      },
      async (javaResult) => {
        order.push("firestore");

        return { id: "fs1", invoiceNumber: javaResult.invoiceNumber };
      },
      "appointment",
    );

    expect(order).toEqual(["java", "firestore"]);
    expect(out.invoiceNumber).toBe("INV-2083.084-0001");
  });

  it("propagates a Java failure untouched and never writes to Firestore", async () => {
    const write = vi.fn();

    await expect(
      runBlockingJavaSyncThenFirestoreWrite(
        async () => {
          throw new Error("backend down");
        },
        write as any,
        "appointment",
      ),
    ).rejects.toThrow("backend down");

    expect(write).not.toHaveBeenCalled();
  });

  it("refuses to write locally when Java returns no invoice number", async () => {
    const write = vi.fn();

    await expect(
      runBlockingJavaSyncThenFirestoreWrite(
        async () => ({ id: 1, invoiceNumber: "", irdSynced: false }),
        write as any,
        "appointment",
      ),
    ).rejects.toThrow("did not return an invoice number");

    expect(write).not.toHaveBeenCalled();
  });

  it("rewrites a Firestore failure into a resubmit-safe message naming the filed invoice", async () => {
    await expect(
      runBlockingJavaSyncThenFirestoreWrite(
        async () => okResult,
        async () => {
          throw new Error("permission denied");
        },
        "pathology",
      ),
    ).rejects.toThrow(
      "Invoice INV-2083.084-0001 was recorded but could not be saved locally.",
    );
  });
});

describe("buildCreditNoteSkeleton", () => {
  const original = {
    id: "orig-doc-id",
    invoiceNumber: "INV-2083.084-0100",
    items: [
      { testName: "CBC", price: 500, amount: 500 },
      { testName: "LFT", price: 300, amount: 300 },
    ],
    subtotal: 800,
    discountAmount: 80,
    taxAmount: 93.6,
    totalAmount: 813.6,
    notes: "original note",
    status: "finalized",
    paymentStatus: "paid",
    paidAmount: 813.6,
    balanceAmount: 0,
    irdSynced: true,
    irdSyncDate: new Date("2026-09-30"),
    cbmsResponseCode: "200",
    paymentHistory: [{ amount: 813.6 }],
    createdAt: new Date("2026-09-30"),
    updatedAt: new Date("2026-09-30"),
  };

  it("negates every amount for a full reversal", () => {
    const cn = buildCreditNoteSkeleton(original, {
      reason: "Wrong test",
      createdBy: "u1",
    }) as any;

    expect(cn.subtotal).toBe(-800);
    expect(cn.discountAmount).toBe(-80);
    expect(cn.taxAmount).toBe(-93.6);
    expect(cn.totalAmount).toBe(-813.6);
    expect(cn.items.map((i: any) => i.amount)).toEqual([-500, -300]);
    expect(cn.items.map((i: any) => i.price)).toEqual([-500, -300]);
  });

  it("does NOT carry the original's Firestore doc-id into the new document", () => {
    const cn = buildCreditNoteSkeleton(original, { reason: "r", createdBy: "u1" }) as any;

    expect(cn.id).toBeUndefined();
    expect(cn.createdAt).toBeUndefined();
    expect(cn.updatedAt).toBeUndefined();
    // but it IS linked back to the original
    expect(cn.linkedInvoiceId).toBe("orig-doc-id");
    expect(cn.linkedInvoiceNumber).toBe("INV-2083.084-0100");
  });

  it("resets sync state so the credit note files with IRD as its own document", () => {
    const cn = buildCreditNoteSkeleton(original, { reason: "r", createdBy: "u1" }) as any;

    expect(cn.isCreditNote).toBe(true);
    expect(cn.irdSynced).toBe(false);
    expect(cn.irdSyncDate).toBeUndefined();
    expect(cn.cbmsResponseCode).toBeUndefined();
    expect(cn.invoiceNumber).toBe(""); // assigned by the Java backend
    expect(cn.paymentHistory).toEqual([]);
  });

  it("marks the reversal as settled (paid in full, nothing outstanding)", () => {
    const cn = buildCreditNoteSkeleton(original, { reason: "r", createdBy: "u1" }) as any;

    expect(cn.status).toBe("finalized");
    expect(cn.paymentStatus).toBe("paid");
    expect(cn.paidAmount).toBe(-813.6);
    expect(cn.balanceAmount).toBe(0);
  });

  it("negates domain-specific extra fields (appointment's two discount components)", () => {
    const appointmentOriginal = {
      ...original,
      itemDiscountAmount: 30,
      mainDiscountAmount: 50,
    };

    const cn = buildCreditNoteSkeleton(appointmentOriginal, {
      reason: "r",
      createdBy: "u1",
      extraNegatedFields: ["itemDiscountAmount", "mainDiscountAmount"],
    }) as any;

    expect(cn.itemDiscountAmount).toBe(-30);
    expect(cn.mainDiscountAmount).toBe(-50);
  });

  it("scales and rounds to 2dp for a partial reversal, leaving no float artifacts on an IRD document", () => {
    // 2 of 7 sessions refunded — the exact case that produces long floats
    const cn = buildCreditNoteSkeleton(original, {
      reason: "2 of 7 sessions unused",
      createdBy: "u1",
      ratio: 2 / 7,
    }) as any;

    expect(cn.subtotal).toBe(-228.57); // round2(800 * 2/7)
    expect(cn.totalAmount).toBe(-232.46); // round2(813.6 * 2/7)
    expect(cn.paidAmount).toBe(-232.46);

    for (const v of [cn.subtotal, cn.discountAmount, cn.taxAmount, cn.totalAmount]) {
      expect(Number(v.toFixed(2))).toBe(v);
    }
  });

  it("labels a partial reversal with its percentage, a full one without", () => {
    const full = buildCreditNoteSkeleton(original, {
      reason: "Wrong test",
      createdBy: "u1",
    }) as any;
    const partial = buildCreditNoteSkeleton(original, {
      reason: "Unused",
      createdBy: "u1",
      ratio: 0.5,
    }) as any;

    expect(full.notes).toBe(
      "Credit Note for Invoice INV-2083.084-0100. Reason: Wrong test",
    );
    expect(partial.notes).toBe(
      "Partial Credit Note (50%) for Invoice INV-2083.084-0100. Reason: Unused",
    );
  });
});
