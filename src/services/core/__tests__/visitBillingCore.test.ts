import { describe, it, expect } from "vitest";

import {
  computeVisitOwed,
  computeVisitPayableTotal,
  getVisitPaymentGate,
  mergeVisitReferrals,
  todayLocalDateString,
  resolveVisitDiscount,
  type VisitReferral,
} from "../visitBillingCore";

const item = (price: number, amount: number) => ({ price, amount });
const taxable = (price: number) => ({
  price,
  amount: price,
  quantity: 1,
  isTaxable: true,
  taxRate: 13,
  appointmentTypeName: "Doctor Consultation",
});

describe("computeVisitPayableTotal — what the patient actually owes", () => {
  it("includes tax, so the desk collects the full amount rather than the base", () => {
    // The bug this prevents: depositing the raw line total (700) against an
    // invoice that checkout computes tax-inclusive (791) left exactly the
    // tax outstanding on every single visit.
    expect(
      computeVisitPayableTotal([taxable(700)], {
        taxPercentage: 13,
        isTaxEnabled: true,
      }),
    ).toBe(791);
  });

  it("charges no tax when the clinic-wide switch is off and no item overrides it", () => {
    expect(
      computeVisitPayableTotal([{ price: 700, amount: 700, quantity: 1 }], {
        taxPercentage: 13,
        isTaxEnabled: false,
      }),
    ).toBe(700);
  });

  it("applies the visit discount before tax", () => {
    // 700 less 10% = 630, +13% = 711.90
    expect(
      computeVisitPayableTotal([taxable(700)], {
        taxPercentage: 13,
        isTaxEnabled: true,
        discountType: "percent",
        discountValue: 10,
      }),
    ).toBeCloseTo(711.9, 2);
  });

  it("excludes package-session lines, which are already paid for", () => {
    expect(
      computeVisitPayableTotal([{ price: 0, amount: 8333, quantity: 1 }], {
        taxPercentage: 13,
        isTaxEnabled: true,
      }),
    ).toBe(0);
  });

  it("is zero when there is nothing chargeable", () => {
    expect(computeVisitPayableTotal([], { taxPercentage: 13 })).toBe(0);
    expect(computeVisitPayableTotal(undefined)).toBe(0);
  });
});

describe("getVisitPaymentGate with pricing context", () => {
  it("counts the visit settled once the tax-inclusive amount is deposited", () => {
    const gate = getVisitPaymentGate(
      { pendingVisitItems: [taxable(700)], depositedAmount: 791 },
      { taxPercentage: 13, isTaxEnabled: true },
    );

    expect(gate.isDue).toBe(false);
    expect(gate.dueAmount).toBe(0);
  });

  it("still shows the tax as due when only the base was collected", () => {
    const gate = getVisitPaymentGate(
      { pendingVisitItems: [taxable(700)], depositedAmount: 700 },
      { taxPercentage: 13, isTaxEnabled: true },
    );

    expect(gate.isDue).toBe(true);
    expect(gate.dueAmount).toBeCloseTo(91, 2);
  });

  it("honours the visit's own discount when deciding what is due", () => {
    const gate = getVisitPaymentGate(
      {
        pendingVisitItems: [taxable(700)],
        depositedAmount: 0,
        pendingVisitDiscountType: "percent",
        pendingVisitDiscountValue: 10,
      },
      { taxPercentage: 13, isTaxEnabled: true },
    );

    expect(gate.dueAmount).toBeCloseTo(711.9, 2);
  });
});

describe("computeVisitOwed", () => {
  it("is zero for a visit with no charges yet", () => {
    expect(computeVisitOwed(undefined)).toBe(0);
    expect(computeVisitOwed([])).toBe(0);
  });

  it("sums chargeable lines", () => {
    expect(computeVisitOwed([item(500, 500), item(2500, 2500)])).toBe(3000);
  });

  it("excludes package-session lines, which are commission-only", () => {
    // price 0 with a nonzero amount is the package-session shape: the
    // patient already paid at package purchase, so this must not be
    // charged again, but `amount` still carries the commission base.
    expect(computeVisitOwed([item(500, 500), item(0, 8333)])).toBe(500);
  });

  it("uses the discounted line amount, not price x quantity", () => {
    // `amount` is price*qty minus the line discount, so a discounted line
    // must contribute its post-discount value.
    expect(computeVisitOwed([item(1000, 900)])).toBe(900);
  });
});

describe("getVisitPaymentGate", () => {
  it("is not due when nothing has been charged", () => {
    const gate = getVisitPaymentGate({ pendingVisitItems: [] });

    expect(gate.isDue).toBe(false);
    expect(gate.dueAmount).toBe(0);
  });

  it("is due when charges exist and nothing was deposited", () => {
    const gate = getVisitPaymentGate({ pendingVisitItems: [item(500, 500)] });

    expect(gate.isDue).toBe(true);
    expect(gate.dueAmount).toBe(500);
  });

  it("is due for only the gap when partially deposited", () => {
    const gate = getVisitPaymentGate({
      pendingVisitItems: [item(500, 500), item(2500, 2500)],
      depositedAmount: 500,
    });

    expect(gate.isDue).toBe(true);
    expect(gate.dueAmount).toBe(2500);
  });

  it("is settled once the deposit covers what is owed", () => {
    const gate = getVisitPaymentGate({
      pendingVisitItems: [item(500, 500)],
      depositedAmount: 500,
    });

    expect(gate.isDue).toBe(false);
    expect(gate.dueAmount).toBe(0);
  });

  it("never reports a negative amount when over-deposited", () => {
    const gate = getVisitPaymentGate({
      pendingVisitItems: [item(500, 500)],
      depositedAmount: 800,
    });

    expect(gate.isDue).toBe(false);
    expect(gate.dueAmount).toBe(0);
  });

  it("does not gate a package-session-only visit, which owes nothing", () => {
    const gate = getVisitPaymentGate({ pendingVisitItems: [item(0, 8333)] });

    expect(gate.isDue).toBe(false);
  });
});

describe("mergeVisitReferrals", () => {
  const ref = (
    id: string,
    type: VisitReferral["type"],
    commissionAmount: number,
    commissionPercentage = 15,
  ): VisitReferral => ({
    id,
    type,
    name: id,
    commissionPercentage,
    commissionAmount,
  });

  it("keeps entries that appear on only one side", () => {
    const merged = mergeVisitReferrals(
      [ref("doc1", "doctor", 375)],
      [ref("partner1", "referral-partner", 200)],
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.id).sort()).toEqual(["doc1", "partner1"]);
  });

  it("does NOT pay the same person twice for one procedure", () => {
    // The mid-visit entry is computed on the procedure fee; the checkout
    // entry on the whole invoice, which already contains that fee. Summing
    // them (375 + 495) would pay this doctor twice over the same money.
    const merged = mergeVisitReferrals(
      [ref("doc1", "doctor", 375)],
      [ref("doc1", "doctor", 495)],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].commissionAmount).toBe(495);
  });

  it("keeps the mid-visit amount when it is the larger entitlement", () => {
    const merged = mergeVisitReferrals(
      [ref("doc1", "doctor", 600)],
      [ref("doc1", "doctor", 495)],
    );

    expect(merged[0].commissionAmount).toBe(600);
  });

  it("treats the same id under a different referral type as distinct", () => {
    const merged = mergeVisitReferrals(
      [ref("x1", "doctor", 100)],
      [ref("x1", "staff", 50)],
    );

    expect(merged).toHaveLength(2);
  });

  it("never mutates its inputs", () => {
    const accrued = [ref("doc1", "doctor", 375)];
    const checkout = [ref("doc1", "doctor", 495)];

    mergeVisitReferrals(accrued, checkout);

    expect(accrued[0].commissionAmount).toBe(375);
    expect(checkout[0].commissionAmount).toBe(495);
  });

  it("handles either side being absent", () => {
    expect(mergeVisitReferrals(undefined, undefined)).toEqual([]);
    expect(mergeVisitReferrals([ref("a", "doctor", 1)], undefined)).toHaveLength(
      1,
    );
    expect(mergeVisitReferrals(undefined, [ref("a", "doctor", 1)])).toHaveLength(
      1,
    );
  });
});

describe("todayLocalDateString", () => {
  it("formats the local calendar date, zero-padded", () => {
    expect(todayLocalDateString(new Date(2026, 0, 5, 13, 30))).toBe(
      "2026-01-05",
    );
  });

  it("stays on the local date during the pre-dawn window that UTC gets wrong", () => {
    // 02:30 local. toISOString() would roll back to the previous UTC day
    // for any timezone ahead of UTC (Nepal is +5:45), which dated an
    // early-morning check-in to yesterday and hid it from today's board.
    const preDawn = new Date(2026, 9, 5, 2, 30);

    expect(todayLocalDateString(preDawn)).toBe("2026-10-05");
  });

  it("stays on the local date late at night", () => {
    expect(todayLocalDateString(new Date(2026, 9, 5, 23, 45))).toBe(
      "2026-10-05",
    );
  });
});

describe("resolveVisitDiscount", () => {
  it("defaults to no discount when none was entered during the visit", () => {
    expect(resolveVisitDiscount({})).toEqual({
      discountType: "percent",
      discountValue: 0,
    });
  });

  it("carries a percent discount forward to checkout", () => {
    expect(
      resolveVisitDiscount({
        pendingVisitDiscountType: "percent",
        pendingVisitDiscountValue: 10,
      }),
    ).toEqual({ discountType: "percent", discountValue: 10 });
  });

  it("carries a flat discount forward to checkout", () => {
    expect(
      resolveVisitDiscount({
        pendingVisitDiscountType: "flat",
        pendingVisitDiscountValue: 250,
      }),
    ).toEqual({ discountType: "flat", discountValue: 250 });
  });

  it("treats cleared values as no discount rather than passing null through", () => {
    expect(
      resolveVisitDiscount({
        pendingVisitDiscountType: null,
        pendingVisitDiscountValue: 0,
      }),
    ).toEqual({ discountType: "percent", discountValue: 0 });
  });
});
