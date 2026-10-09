import { describe, it, expect } from "vitest";

import {
  buildClawbackRecord,
  cancellationCounterDeltas,
  CLAWBACK_EXCLUDED_FIELDS,
  partialReversalPlan,
} from "../commissionClawbackCore";

const NOW = new Date("2026-10-07T12:00:00Z");

const paidOriginal = {
  doctorId: "doc1",
  doctorName: "Dr. Pratik Bhusal",
  clinicId: "default",
  branchId: "default",
  billingId: "inv1",
  billingType: "appointment",
  invoiceNumber: "INV-2083.084-0096",
  appointmentDate: "2026-10-06",
  patientId: "p1",
  patientName: "Namita Giri",
  serviceNames: ["Doctor Consultation"],
  totalInvoiceAmount: 1130,
  commissionPercentage: 15,
  commissionAmount: 169.5,
  status: "paid",
  paidAmount: 169.5,
  paymentMethod: "bank_transfer",
  paymentReference: "TXN-1",
  paidDate: "2026-10-06",
  paidBy: "admin1",
  createdAt: "2026-10-06",
  updatedAt: "2026-10-06",
  createdBy: "staff1",
};

describe("buildClawbackRecord", () => {
  it("writes the negative of what was paid, pending, naming the original", () => {
    const r = buildClawbackRecord(paidOriginal, "comm1", "admin1", NOW);

    expect(r).not.toBeNull();
    expect(r!.commissionAmount).toBe(-169.5);
    expect(r!.status).toBe("pending");
    expect(r!.clawbackOf).toBe("comm1");
    expect(r!.createdBy).toBe("admin1");
    expect(r!.createdAt).toBe(NOW);
  });

  it("carries the original's identity so reports and payouts attribute it correctly", () => {
    const r = buildClawbackRecord(paidOriginal, "comm1", "admin1", NOW)!;

    expect(r.doctorId).toBe("doc1");
    expect(r.doctorName).toBe("Dr. Pratik Bhusal");
    expect(r.billingId).toBe("inv1");
    expect(r.invoiceNumber).toBe("INV-2083.084-0096");
    expect(r.clinicId).toBe("default");
    expect(r.commissionPercentage).toBe(15);
  });

  it("never copies the original's own payment or lifecycle fields", () => {
    const r = buildClawbackRecord(paidOriginal, "comm1", "admin1", NOW)!;

    for (const key of CLAWBACK_EXCLUDED_FIELDS) {
      if (
        [
          "commissionAmount",
          "status",
          "createdAt",
          "updatedAt",
          "createdBy",
          "clawbackOf",
          "clawbackReason",
        ].includes(key)
      )
        continue;
      expect(key in r).toBe(false);
    }
    expect(r.paidAmount).toBeUndefined();
    expect(r.paymentReference).toBeUndefined();
    expect(r.id).toBeUndefined();
  });

  it("returns null when nothing was paid — there is nothing to claw back", () => {
    expect(
      buildClawbackRecord(
        { ...paidOriginal, status: "pending", paidAmount: 0 },
        "c",
        "a",
        NOW,
      ),
    ).toBeNull();
    expect(
      buildClawbackRecord(
        { ...paidOriginal, paidAmount: undefined },
        "c",
        "a",
        NOW,
      ),
    ).toBeNull();
    expect(
      buildClawbackRecord({ ...paidOriginal, paidAmount: null }, "c", "a", NOW),
    ).toBeNull();
  });

  it("claws back only the paid portion of a partially-paid commission", () => {
    const r = buildClawbackRecord(
      { ...paidOriginal, commissionAmount: 200, paidAmount: 80 },
      "c",
      "a",
      NOW,
    )!;

    expect(r.commissionAmount).toBe(-80);
  });

  it("rounds to the app's two-decimal money convention", () => {
    const r = buildClawbackRecord(
      { ...paidOriginal, paidAmount: 33.333333 },
      "c",
      "a",
      NOW,
    )!;

    expect(r.commissionAmount).toBe(-33.33);
  });

  it("accepts a specific reason", () => {
    const r = buildClawbackRecord(
      paidOriginal,
      "c",
      "a",
      NOW,
      "Credit Note CN-7 reversed INV-0096",
    )!;

    expect(r.clawbackReason).toBe("Credit Note CN-7 reversed INV-0096");
  });
});

describe("cancellationCounterDeltas", () => {
  it("drops balance by the whole amount, not just the unpaid part", () => {
    // Old behaviour: balance -= (amount - paid) = -0 for a fully paid
    // commission, leaving the clinician looking square after being paid
    // for an invoice that no longer exists.
    expect(
      cancellationCounterDeltas({ commissionAmount: 169.5, paidAmount: 169.5 }),
    ).toEqual({
      earned: -169.5,
      balance: -169.5,
    });
  });

  it("is the same for an unpaid commission (nothing owed back, nothing owed)", () => {
    expect(
      cancellationCounterDeltas({ commissionAmount: 100, paidAmount: 0 }),
    ).toEqual({
      earned: -100,
      balance: -100,
    });
  });

  it("treats missing amounts as zero", () => {
    expect(cancellationCounterDeltas({})).toEqual({ earned: -0, balance: -0 });
  });
});

describe("buildClawbackRecord with an explicit owedBack", () => {
  it("claws back only the stated share, not everything that was paid", () => {
    const r = buildClawbackRecord(
      paidOriginal,
      "comm1",
      "admin1",
      NOW,
      "partial",
      40,
    )!;

    expect(r.commissionAmount).toBe(-40);
    expect(r.clawbackReason).toBe("partial");
  });

  it("returns null for a zero or sub-paisa share", () => {
    expect(buildClawbackRecord(paidOriginal, "c", "a", NOW, "x", 0)).toBeNull();
    expect(
      buildClawbackRecord(paidOriginal, "c", "a", NOW, "x", 0.004),
    ).toBeNull();
  });
});

describe("partialReversalPlan", () => {
  it("takes the reversal off the unpaid part when there is enough of it", () => {
    const plan = partialReversalPlan(
      { commissionAmount: 200, paidAmount: 50, status: "pending" },
      100,
    )!;

    expect(plan).toEqual({
      actualReduction: 100,
      overpaid: 0,
      newCommissionAmount: 100,
      newPaidAmount: 50,
      newStatus: "pending",
      earnedDelta: -100,
      balanceDelta: -100,
    });
  });

  it("moves the paid share of the reversed part off the record and claws it back", () => {
    // 200 earned, 150 paid, half the invoice reversed: the 50 unpaid absorbs
    // 50, the other 50 had been paid and is owed back. The record ends as
    // "earned 100, paid 100" for the half that still stands.
    const plan = partialReversalPlan(
      { commissionAmount: 200, paidAmount: 150, status: "pending" },
      100,
    )!;

    expect(plan.actualReduction).toBe(50);
    expect(plan.overpaid).toBe(50);
    expect(plan.newCommissionAmount).toBe(100);
    expect(plan.newPaidAmount).toBe(100);
    expect(plan.newStatus).toBe("paid");
    expect(plan.earnedDelta).toBe(-100);
    expect(plan.balanceDelta).toBe(-100);
  });

  it("on a fully paid commission, the whole reversal is a clawback and the record shrinks to what stands", () => {
    const plan = partialReversalPlan(
      { commissionAmount: 169.5, paidAmount: 169.5, status: "paid" },
      84.75,
    )!;

    expect(plan.actualReduction).toBe(0);
    expect(plan.overpaid).toBe(84.75);
    expect(plan.newCommissionAmount).toBe(84.75);
    expect(plan.newPaidAmount).toBe(84.75);
    expect(plan.newStatus).toBe("paid");
    expect(plan.balanceDelta).toBe(-84.75);
  });

  it("a later FULL cancel then claws back only what is still on the record", () => {
    // Regression for the double-clawback: 200 paid in full, half reversed
    // (clawback 100), then the invoice is cancelled outright. The cancel
    // must owe back the remaining 100, not the original 200 again.
    const partial = partialReversalPlan(
      { commissionAmount: 200, paidAmount: 200, status: "paid" },
      100,
    )!;
    const afterPartial = {
      commissionAmount: partial.newCommissionAmount,
      paidAmount: partial.newPaidAmount,
      status: partial.newStatus,
    };
    const cancelDelta = cancellationCounterDeltas(afterPartial);
    const cancelClawback = buildClawbackRecord(afterPartial, "orig", "a", NOW)!;

    expect(partial.overpaid).toBe(100);
    expect(cancelDelta).toEqual({ earned: -100, balance: -100 });
    expect(cancelClawback.commissionAmount).toBe(-100);
    // Owed back in total: 100 (partial) + 100 (cancel) == 200 paid out.
    // Earned in total: +200 -100 -100 == 0.
  });

  it("never reverses more than the commission itself, and a total reversal cancels the record", () => {
    const plan = partialReversalPlan(
      { commissionAmount: 100, paidAmount: 100, status: "paid" },
      250,
    )!;

    expect(plan.overpaid).toBe(100);
    expect(plan.newCommissionAmount).toBe(0);
    expect(plan.newPaidAmount).toBe(0);
    expect(plan.newStatus).toBe("cancelled");
    expect(plan.earnedDelta).toBe(-100);
  });

  it("does nothing for a cancelled commission, a zero reversal, or a clawback record", () => {
    expect(
      partialReversalPlan(
        { commissionAmount: 100, paidAmount: 0, status: "cancelled" },
        50,
      ),
    ).toBeNull();
    expect(
      partialReversalPlan(
        { commissionAmount: 100, paidAmount: 0, status: "pending" },
        0,
      ),
    ).toBeNull();
    expect(
      partialReversalPlan(
        { commissionAmount: -80, paidAmount: 0, status: "pending" },
        40,
      ),
    ).toBeNull();
  });

  it("keeps both counters equal to the records on every split", () => {
    for (const paid of [0, 30, 100, 170, 200]) {
      const plan = partialReversalPlan(
        { commissionAmount: 200, paidAmount: paid, status: "pending" },
        120,
      )!;

      expect(plan.actualReduction + plan.overpaid).toBe(120);
      expect(plan.earnedDelta).toBe(-120);
      // earned == live non-clawback commissionAmount
      expect(plan.newCommissionAmount).toBe(80);
      // paidAmount never exceeds commissionAmount on an ordinary record
      expect(plan.newPaidAmount).toBeLessThanOrEqual(plan.newCommissionAmount);
      // balance == (record remaining) + (clawback remaining)
      const recordRemaining = plan.newCommissionAmount - plan.newPaidAmount;
      const before = 200 - paid;

      expect(recordRemaining - plan.overpaid).toBeCloseTo(
        before + plan.balanceDelta,
        10,
      );
      // what was paid out is still fully accounted for
      expect(plan.newPaidAmount + plan.overpaid).toBe(paid);
    }
  });
});
