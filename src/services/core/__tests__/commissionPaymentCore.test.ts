import { describe, it, expect } from "vitest";

import {
  applyCommissionPayment,
  remainingCommission,
} from "../commissionPaymentCore";

describe("applyCommissionPayment — ordinary commission", () => {
  it("pays part of a commission and keeps it pending", () => {
    const r = applyCommissionPayment(
      { commissionAmount: 200, paidAmount: 0 },
      80,
    );

    expect(r).toEqual({
      paidAmount: 80,
      status: "pending",
      balanceDelta: -80,
      applied: 80,
      isClawback: false,
    });
  });

  it("marks it paid once the whole amount is covered", () => {
    const r = applyCommissionPayment(
      { commissionAmount: 200, paidAmount: 80 },
      120,
    );

    expect(r.paidAmount).toBe(200);
    expect(r.status).toBe("paid");
    expect(r.balanceDelta).toBe(-120);
  });

  it("treats a missing paidAmount as zero", () => {
    expect(applyCommissionPayment({ commissionAmount: 50 }, 50).status).toBe(
      "paid",
    );
    expect(
      applyCommissionPayment({ commissionAmount: 50, paidAmount: null }, 50)
        .status,
    ).toBe("paid");
  });

  it("refuses zero, negative, and over-payments", () => {
    expect(() => applyCommissionPayment({ commissionAmount: 200 }, 0)).toThrow(
      /greater than 0/,
    );
    expect(() =>
      applyCommissionPayment({ commissionAmount: 200 }, -10),
    ).toThrow(/greater than 0/);
    expect(() =>
      applyCommissionPayment({ commissionAmount: 200, paidAmount: 150 }, 60),
    ).toThrow(/exceed/);
  });

  it("tolerates float noise at the boundary", () => {
    // 169.5 - (56.5 + 56.5 + 56.5) is 0 in money and ~1e-14 in floats.
    const r = applyCommissionPayment(
      { commissionAmount: 169.5, paidAmount: 113 },
      56.5,
    );

    expect(r.status).toBe("paid");
    expect(r.paidAmount).toBe(169.5);
  });
});

describe("applyCommissionPayment — clawback (negative commission)", () => {
  const clawback = { commissionAmount: -169.5, paidAmount: 0 };

  it("accepts a positive 'amount to recover' and applies it in the record's direction", () => {
    const r = applyCommissionPayment(clawback, 169.5);

    expect(r).toEqual({
      paidAmount: -169.5,
      status: "paid",
      balanceDelta: 169.5,
      applied: -169.5,
      isClawback: true,
    });
  });

  it("accepts the signed remaining amount a payroll run passes straight through", () => {
    // HR bulk-pay passes commissionAmount - paidAmount, which is negative here.
    const r = applyCommissionPayment(clawback, remainingCommission(clawback));

    expect(r.paidAmount).toBe(-169.5);
    expect(r.status).toBe("paid");
    expect(r.balanceDelta).toBe(169.5);
  });

  it("recovers in instalments", () => {
    const first = applyCommissionPayment(clawback, 100);

    expect(first.paidAmount).toBe(-100);
    expect(first.status).toBe("pending");
    expect(first.balanceDelta).toBe(100);

    const second = applyCommissionPayment(
      { ...clawback, paidAmount: first.paidAmount },
      69.5,
    );

    expect(second.paidAmount).toBe(-169.5);
    expect(second.status).toBe("paid");
  });

  it("refuses to recover more than is owed back", () => {
    expect(() => applyCommissionPayment(clawback, 170)).toThrow(/exceed/);
    expect(() =>
      applyCommissionPayment({ ...clawback, paidAmount: -100 }, 70),
    ).toThrow(/exceed/);
  });
});

describe("remainingCommission", () => {
  it("is the outstanding obligation in either direction", () => {
    expect(remainingCommission({ commissionAmount: 200, paidAmount: 80 })).toBe(
      120,
    );
    expect(
      remainingCommission({ commissionAmount: -80, paidAmount: -30 }),
    ).toBe(-50);
    expect(remainingCommission({ commissionAmount: 100 })).toBe(100);
  });
});
