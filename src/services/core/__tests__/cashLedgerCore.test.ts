import { describe, it, expect } from "vitest";

import {
  summariseCashCollections,
  computeUnappliedDeposits,
  splitRevenueByLineKind,
  shareOfInvoiceForKind,
  walletRefundableAmount,
} from "../cashLedgerCore";

describe("walletRefundableAmount", () => {
  it("refunds only the wallet part of a wallet-then-cash visit", () => {
    // The normal front-office shape: NPR 500 deposit applied from the
    // wallet, NPR 65 tax remainder paid in cash. The old logic keyed on
    // the top-level method — "cash", the last one — and refunded nothing,
    // so the patient lost the deposit on cancel.
    expect(
      walletRefundableAmount({
        paidAmount: 565,
        paymentMethod: "cash",
        paymentHistory: [
          { amount: 500, method: "wallet" },
          { amount: 65, method: "cash" },
        ],
      }),
    ).toBe(500);
  });

  it("refunds only the wallet part of a cash-then-wallet visit", () => {
    // Reverse order: top-level method ended as "wallet" and the old logic
    // refunded all 565 into the wallet — 65 of cash became store credit.
    expect(
      walletRefundableAmount({
        paidAmount: 565,
        paymentMethod: "wallet",
        paymentHistory: [
          { amount: 65, method: "cash" },
          { amount: 500, method: "wallet" },
        ],
      }),
    ).toBe(500);
  });

  it("refunds everything when the whole invoice was wallet-funded", () => {
    expect(
      walletRefundableAmount({
        paidAmount: 791,
        paymentMethod: "wallet",
        paymentHistory: [{ amount: 791, method: "wallet" }],
      }),
    ).toBe(791);
  });

  it("refunds nothing when no payment came from the wallet", () => {
    expect(
      walletRefundableAmount({
        paidAmount: 565,
        paymentMethod: "cash",
        paymentHistory: [{ amount: 565, method: "cash" }],
      }),
    ).toBe(0);
  });

  it("falls back to the single method for an invoice written before paymentHistory existed", () => {
    expect(
      walletRefundableAmount({ paidAmount: 300, paymentMethod: "wallet" }),
    ).toBe(300);
    expect(
      walletRefundableAmount({ paidAmount: 300, paymentMethod: "cash" }),
    ).toBe(0);
    expect(
      walletRefundableAmount({ paidAmount: 300, paymentMethod: "wallet", paymentHistory: [] }),
    ).toBe(300);
  });

  it("never refunds more than was actually paid", () => {
    // A doubled history line must not mint money.
    expect(
      walletRefundableAmount({
        paidAmount: 500,
        paymentHistory: [
          { amount: 500, method: "wallet" },
          { amount: 500, method: "wallet" },
        ],
      }),
    ).toBe(500);
  });

  it("treats method casing consistently and ignores non-positive lines", () => {
    expect(
      walletRefundableAmount({
        paidAmount: 100,
        paymentHistory: [
          { amount: 100, method: "WALLET" },
          { amount: 0, method: "wallet" },
          { amount: -20, method: "wallet" },
        ],
      }),
    ).toBe(100);
  });

  it("is zero for an unpaid invoice regardless of history", () => {
    expect(
      walletRefundableAmount({
        paidAmount: 0,
        paymentHistory: [{ amount: 500, method: "wallet" }],
      }),
    ).toBe(0);
  });
});

describe("shareOfInvoiceForKind", () => {
  it("attributes a payment in proportion to the kind's share", () => {
    // A 1000 invoice that is 300 medicines, half paid — pharmacy's share of
    // the 500 collected is 150.
    expect(shareOfInvoiceForKind(1000, 300, 500)).toBe(150);
  });

  it("gives a single-kind invoice the whole amount", () => {
    expect(shareOfInvoiceForKind(90.4, 90.4, 90.4)).toBe(90.4);
  });

  it("gives nothing to a kind that isn't on the invoice", () => {
    expect(shareOfInvoiceForKind(1000, 0, 500)).toBe(0);
  });

  it("is zero rather than NaN for a zero-total invoice", () => {
    // A fully-discounted or package-covered visit; dividing by its total
    // would otherwise poison every card with NaN.
    expect(shareOfInvoiceForKind(0, 0, 0)).toBe(0);
    expect(shareOfInvoiceForKind(0, 100, 50)).toBe(0);
  });

  it("ignores a nothing-collected invoice", () => {
    expect(shareOfInvoiceForKind(1000, 300, 0)).toBe(0);
  });
});

describe("splitRevenueByLineKind", () => {
  it("credits medicines to pharmacy, not clinical", () => {
    // A medicine dispensed at the unified counter lands on an appointment
    // invoice; categorising by source collection reported it as clinical
    // and left Pharmacy Revenue at zero.
    const split = splitRevenueByLineKind(
      [{ amount: 80, lineKind: "medicine" }],
      90.4,
    );

    expect(split.pharmacy).toBe(90.4);
    expect(split.clinical).toBe(0);
  });

  it("credits lab tests to pathology", () => {
    const split = splitRevenueByLineKind([{ amount: 500, lineKind: "lab" }], 565);

    expect(split.pathology).toBe(565);
    expect(split.clinical).toBe(0);
  });

  it("splits a mixed visit invoice across all three", () => {
    const split = splitRevenueByLineKind(
      [
        { amount: 500, lineKind: "service" },
        { amount: 300, lineKind: "lab" },
        { amount: 200, lineKind: "medicine" },
      ],
      1000,
    );

    expect(split).toEqual({ clinical: 500, pathology: 300, pharmacy: 200 });
  });

  it("distributes invoice tax across the kinds proportionally", () => {
    // 1000 of lines billed at 1130 with 13% tax — each kind carries its share.
    const split = splitRevenueByLineKind(
      [
        { amount: 500, lineKind: "service" },
        { amount: 500, lineKind: "medicine" },
      ],
      1130,
    );

    expect(split.clinical).toBe(565);
    expect(split.pharmacy).toBe(565);
  });

  it("always sums back to the invoice total despite rounding", () => {
    const split = splitRevenueByLineKind(
      [
        { amount: 33.33, lineKind: "service" },
        { amount: 33.33, lineKind: "lab" },
        { amount: 33.34, lineKind: "medicine" },
      ],
      100,
    );

    expect(split.clinical + split.pathology + split.pharmacy).toBe(100);
  });

  it("treats lines without a kind as clinical, as older records are", () => {
    const split = splitRevenueByLineKind([{ amount: 700 }], 791);

    expect(split.clinical).toBe(791);
  });

  it("falls back to clinical when there are no usable lines", () => {
    expect(splitRevenueByLineKind([], 500).clinical).toBe(500);
    expect(splitRevenueByLineKind(undefined, 500).clinical).toBe(500);
    expect(splitRevenueByLineKind([{ amount: 0 }], 500).clinical).toBe(500);
  });
});

describe("summariseCashCollections", () => {
  it("is zero for a day with no activity", () => {
    const summary = summariseCashCollections({});

    expect(summary.totalCollected).toBe(0);
    expect(summary.byMethod).toEqual({});
  });

  it("counts a front-desk deposit on the day it was taken", () => {
    const summary = summariseCashCollections({
      walletDeposits: [{ amount: 500, paymentMethod: "cash" }],
    });

    expect(summary.depositsCollected).toBe(500);
    expect(summary.totalCollected).toBe(500);
    expect(summary.byMethod).toEqual({ cash: 500 });
  });

  it("does NOT double-count a deposit that was applied to an invoice the same day", () => {
    // The whole point of this module. Check-in takes NPR 500 cash into the
    // wallet; checkout applies that same 500 to the invoice. One physical
    // 500 arrived, so the day's collection is 500 — not 1000.
    const summary = summariseCashCollections({
      walletDeposits: [{ amount: 500, paymentMethod: "cash" }],
      invoicePayments: [{ amount: 500, method: "wallet" }],
    });

    expect(summary.totalCollected).toBe(500);
    expect(summary.walletApplied).toBe(500);
    expect(summary.byMethod).toEqual({ cash: 500 });
  });

  it("counts a direct invoice payment that did not come from wallet", () => {
    const summary = summariseCashCollections({
      invoicePayments: [{ amount: 65, method: "cash" }],
    });

    expect(summary.directInvoicePayments).toBe(65);
    expect(summary.totalCollected).toBe(65);
  });

  it("handles the real front-office shape: deposit at check-in, balance settled in cash", () => {
    // 500 deposit at check-in, invoice totals 565, wallet covers 500 and
    // the 65 tax remainder is paid in cash at the counter.
    const summary = summariseCashCollections({
      walletDeposits: [{ amount: 500, paymentMethod: "cash" }],
      invoicePayments: [
        { amount: 500, method: "wallet" },
        { amount: 65, method: "cash" },
      ],
    });

    expect(summary.totalCollected).toBe(565);
    expect(summary.walletApplied).toBe(500);
    expect(summary.byMethod).toEqual({ cash: 565 });
  });

  it("still reports cash taken for a visit that never checked out", () => {
    // No invoice payment at all — a no-show or abandoned visit. The clinic
    // physically holds this money, so the day must report it.
    const summary = summariseCashCollections({
      walletDeposits: [{ amount: 800, paymentMethod: "cash" }],
      invoicePayments: [],
    });

    expect(summary.totalCollected).toBe(800);
  });

  it("reports a wallet-funded invoice from a prior day as a transfer, not a collection", () => {
    // Deposit happened yesterday, so today sees only the application.
    const summary = summariseCashCollections({
      walletDeposits: [],
      invoicePayments: [{ amount: 500, method: "wallet" }],
    });

    expect(summary.totalCollected).toBe(0);
    expect(summary.walletApplied).toBe(500);
  });

  it("splits collections by how the money arrived", () => {
    const summary = summariseCashCollections({
      walletDeposits: [
        { amount: 500, paymentMethod: "cash" },
        { amount: 300, paymentMethod: "card" },
      ],
      invoicePayments: [
        { amount: 65, method: "cash" },
        { amount: 200, method: "mobile_banking" },
        { amount: 500, method: "wallet" },
      ],
    });

    expect(summary.byMethod).toEqual({
      cash: 565,
      card: 300,
      mobile_banking: 200,
    });
    expect(summary.totalCollected).toBe(1065);
  });

  it("ignores non-positive amounts and labels missing methods", () => {
    const summary = summariseCashCollections({
      walletDeposits: [{ amount: 0, paymentMethod: "cash" }],
      invoicePayments: [{ amount: 100 }],
    });

    expect(summary.totalCollected).toBe(100);
    expect(summary.byMethod).toEqual({ unknown: 100 });
  });

  it("treats payment method casing consistently", () => {
    const summary = summariseCashCollections({
      invoicePayments: [
        { amount: 10, method: "Cash" },
        { amount: 5, method: "cash" },
        { amount: 50, method: "WALLET" },
      ],
    });

    expect(summary.byMethod).toEqual({ cash: 15 });
    expect(summary.walletApplied).toBe(50);
  });
});

describe("computeUnappliedDeposits", () => {
  it("totals money held for patients, which is the clinic's exposure", () => {
    const held = computeUnappliedDeposits([
      { patientId: "a", walletBalance: 500 },
      { patientId: "b", walletBalance: 0 },
      { patientId: "c", walletBalance: 250 },
      { patientId: "d" },
    ]);

    expect(held.totalHeld).toBe(750);
    expect(held.patientsHolding).toBe(2);
  });

  it("is zero when nothing is held", () => {
    expect(computeUnappliedDeposits([])).toEqual({
      totalHeld: 0,
      patientsHolding: 0,
    });
  });
});
