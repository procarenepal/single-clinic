import { describe, it, expect } from "vitest";

import { applyPayment, AlreadyPaidError } from "../paymentApplicationCore";

const NOW = new Date("2026-10-07T10:00:00Z");

const input = (over: Partial<Parameters<typeof applyPayment>[1]> = {}) => ({
  amount: 200,
  method: "cash",
  recordedBy: "uid-1",
  eventId: "evt-1",
  now: NOW,
  ...over,
});

describe("applyPayment", () => {
  it("applies a partial payment to an unpaid invoice", () => {
    const r = applyPayment({ totalAmount: 565, paidAmount: 0 }, input());

    expect(r.updateData.paidAmount).toBe(200);
    expect(r.updateData.balanceAmount).toBe(365);
    expect(r.updateData.paymentStatus).toBe("partial");
    expect(r.previousStatus).toBe("unpaid");
    expect(r.becamePaid).toBe(false);
    expect(r.updateData.paymentHistory).toHaveLength(1);
    expect(r.updateData.paymentHistory[0]).toMatchObject({
      id: "evt-1",
      amount: 200,
      method: "cash",
      recordedBy: "uid-1",
    });
  });

  it("computes from the snapshot it is given, not from anything earlier", () => {
    // The lost-update bug: a second concurrent 200 must see the first 200
    // already applied and land at 400, not overwrite back to 200.
    const first = applyPayment({ totalAmount: 565, paidAmount: 0 }, input());
    const second = applyPayment(
      { totalAmount: 565, paidAmount: first.updateData.paidAmount, paymentStatus: "partial",
        paymentHistory: first.updateData.paymentHistory },
      input({ eventId: "evt-2" }),
    );

    expect(second.updateData.paidAmount).toBe(400);
    expect(second.updateData.paymentHistory).toHaveLength(2);
  });

  it("crosses to paid exactly on the edge and reports becamePaid once", () => {
    const r = applyPayment(
      { totalAmount: 565, paidAmount: 365, paymentStatus: "partial" },
      input(),
    );

    expect(r.updateData.paymentStatus).toBe("paid");
    expect(r.updateData.balanceAmount).toBe(0);
    expect(r.becamePaid).toBe(true);
  });

  it("refuses a positive payment on an already-paid invoice", () => {
    expect(() =>
      applyPayment({ totalAmount: 565, paidAmount: 565, paymentStatus: "paid" }, input()),
    ).toThrow(AlreadyPaidError);
  });

  it("tolerates floating-point drift that used to strand invoices at partial", () => {
    const r = applyPayment(
      { totalAmount: 497, paidAmount: 297.00000000000006 },
      input({ amount: 200 }),
    );

    expect(r.updateData.paidAmount).toBe(497);
    expect(r.updateData.paymentStatus).toBe("paid");
  });

  it("applies a checkout-time discount to the total before judging paid", () => {
    const r = applyPayment(
      { totalAmount: 565, paidAmount: 500, discountAmount: 0, paymentStatus: "partial" },
      input({ amount: 0, discountAmount: 65 }),
    );

    expect(r.updateData.totalAmount).toBe(500);
    expect(r.updateData.discountAmount).toBe(65);
    expect(r.updateData.paymentStatus).toBe("paid");
    expect(r.becamePaid).toBe(true);
  });

  it("carries the split discount only when the caller asks for it", () => {
    const appt = applyPayment(
      { totalAmount: 565, paidAmount: 0, mainDiscountAmount: 10, discountAmount: 10 },
      input({ discountAmount: 5, trackMainDiscount: true }),
    );

    expect(appt.updateData.mainDiscountAmount).toBe(15);

    // A raw appointment document that never had the field still gets one.
    const fresh = applyPayment(
      { totalAmount: 565, paidAmount: 0 },
      input({ discountAmount: 5, trackMainDiscount: true }),
    );

    expect(fresh.updateData.mainDiscountAmount).toBe(5);

    // Pathology never tracks it — and must not have one invented.
    const lab = applyPayment({ totalAmount: 565, paidAmount: 0 }, input({ discountAmount: 5 }));

    expect("mainDiscountAmount" in lab.updateData).toBe(false);
  });

  it("stores trimmed reference and notes only when present", () => {
    const with_ = applyPayment(
      { totalAmount: 100 },
      input({ reference: "  TXN-9  ", notes: " via counter " }),
    );

    expect(with_.updateData.paymentReference).toBe("TXN-9");
    expect(with_.updateData.paymentNotes).toBe("via counter");
    expect(with_.event.reference).toBe("TXN-9");

    const without = applyPayment({ totalAmount: 100 }, input({ reference: "  ", notes: "" }));

    expect("paymentReference" in without.updateData).toBe(false);
    expect("paymentNotes" in without.updateData).toBe(false);
  });

  it("treats a missing status as unpaid and a null history as empty", () => {
    const r = applyPayment(
      { totalAmount: 100, paidAmount: null, paymentStatus: null, paymentHistory: null },
      input({ amount: 100 }),
    );

    expect(r.previousStatus).toBe("unpaid");
    expect(r.updateData.paymentStatus).toBe("paid");
    expect(r.updateData.paymentHistory).toHaveLength(1);
  });
});
