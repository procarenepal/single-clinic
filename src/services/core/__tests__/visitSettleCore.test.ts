import { describe, it, expect } from "vitest";

import {
  buildSettlePlan,
  computeSettleTotals,
  deriveFundingMethods,
  filesInvoiceFor,
  settleIdempotencyKey,
  settlePrimaryLabel,
  type SettleLine,
} from "../visitSettleCore";

const pricing = { taxPercentage: 13, isTaxEnabled: true };
const consult: SettleLine = {
  appointmentTypeId: "t-consult",
  appointmentTypeName: "Doctor Consultation",
  price: 700,
  quantity: 1,
  amount: 700,
  isTaxable: true,
  taxRate: 13,
  origin: "booked",
  collectAtCheckIn: true,
  doctorId: "doc1",
};
const laser: SettleLine = {
  appointmentTypeId: "t-laser",
  appointmentTypeName: "Laser Hair Removal (face)",
  price: 1600,
  quantity: 1,
  amount: 1600,
  isTaxable: true,
  origin: "procedure",
  doctorId: "exp1",
};
const dressing: SettleLine = {
  appointmentTypeId: "t-dress",
  appointmentTypeName: "Dressing",
  price: 300,
  quantity: 1,
  amount: 300,
  isTaxable: false,
  origin: "procedure",
  doctorId: "exp1",
};
const session: SettleLine = {
  appointmentTypeId: "pkg1",
  appointmentTypeName: "Laser Hair Removal (6)",
  price: 0,
  amount: 1666.67,
  calculateCommission: true,
  origin: "session",
  patientPackageId: "pp1",
  doctorId: "exp1",
};

const visit = (over: Record<string, unknown> = {}) => ({
  id: "appt1",
  pendingVisitItems: [consult, laser, dressing],
  depositedAmount: 791,
  depositTxnIds: ["w1"],
  ...over,
});
const esewaRow = { id: "w1", amount: 791, paymentMethod: "esewa" };

describe("the worked example from the spec", () => {
  it("totals with a 10% discount allocated pro-rata across taxable and exempt lines", () => {
    const t = computeSettleTotals(
      [consult, laser, dressing],
      { pendingVisitDiscountType: "percent", pendingVisitDiscountValue: 10 },
      pricing,
    );

    expect(t.subtotal).toBe(2600);
    expect(t.discountAmount).toBe(260);
    expect(t.taxableAmount).toBe(2070);
    expect(t.exemptAmount).toBe(270);
    expect(t.taxAmount).toBe(269.1);
    expect(t.totalAmount).toBe(2609.1);
  });

  it("plans: deposit applied, residual due, truthful funding, ordered steps", () => {
    const plan = buildSettlePlan({
      visit: visit({
        pendingVisitDiscountType: "percent",
        pendingVisitDiscountValue: 10,
      }),
      walletBalance: 791,
      depositRows: [esewaRow],
      pricing,
      residualMethod: "cash",
    });

    expect(plan.totals.totalAmount).toBe(2609.1);
    expect(plan.depositToApply).toBe(791);
    expect(plan.dueNow).toBe(1818.1);
    expect(plan.excessToWallet).toBe(0);
    expect(plan.filesInvoice).toBe(true);
    expect(plan.fundingMethods).toEqual([
      { method: "esewa", amount: 791 },
      { method: "cash", amount: 1818.1 },
    ]);
    expect(plan.paymentMethodForInvoice).toBe("mixed");
    expect(plan.idempotencyDiscriminator).toBe("visit:appt1");
    expect(plan.steps.map((s) => s.kind)).toEqual([
      "create-invoice",
      "link-appointment",
      "apply-deposit",
      "collect-residual",
      "close-appointment",
    ]);
    expect(settlePrimaryLabel(plan)).toBe("Settle · NPR 1,818.10 due");
  });
});

describe("money rules", () => {
  it("never deducts more than the wallet holds: a wallet spent elsewhere grows 'due now', no exception", () => {
    const plan = buildSettlePlan({
      visit: visit({ pendingVisitItems: [consult] }),
      walletBalance: 200,
      depositRows: [esewaRow],
      pricing,
    });

    expect(plan.totals.totalAmount).toBe(791);
    expect(plan.depositToApply).toBe(200);
    expect(plan.depositShortfall).toBe(591);
    expect(plan.dueNow).toBe(591);
  });

  it("a deposit larger than the total leaves the excess as wallet credit", () => {
    const plan = buildSettlePlan({
      visit: visit({
        pendingVisitItems: [consult],
        pendingVisitDiscountType: "percent",
        pendingVisitDiscountValue: 20,
      }),
      walletBalance: 791,
      depositRows: [esewaRow],
      pricing,
    });

    expect(plan.totals.totalAmount).toBe(632.8);
    expect(plan.depositToApply).toBe(632.8);
    expect(plan.excessToWallet).toBe(158.2);
    expect(plan.dueNow).toBe(0);
    expect(settlePrimaryLabel(plan)).toBe("Settle · paid by deposit");
  });

  it("applies standing wallet credit only beyond this visit's deposit and only up to what is due", () => {
    const plan = buildSettlePlan({
      visit: visit({ pendingVisitItems: [consult, dressing] }),
      walletBalance: 2000,
      depositRows: [esewaRow],
      standingCreditToApply: 5000,
      pricing,
    });

    expect(plan.totals.totalAmount).toBe(1091);
    expect(plan.depositToApply).toBe(791);
    expect(plan.standingCreditToApply).toBe(300);
    expect(plan.dueNow).toBe(0);
    expect(plan.steps.map((s) => s.kind)).toContain("apply-standing-credit");
  });

  it("files nothing for a visit with no chargeable line and closes it unbilled", () => {
    const plan = buildSettlePlan({
      visit: visit({
        pendingVisitItems: [{ ...consult, price: 0, amount: 0 }],
        depositedAmount: 0,
        depositTxnIds: [],
      }),
      walletBalance: 0,
      pricing,
    });

    expect(plan.filesInvoice).toBe(false);
    expect(plan.steps.map((s) => s.kind)).toEqual([
      "close-unbilled",
      "close-appointment",
    ]);
    expect(settlePrimaryLabel(plan)).toBe("Close Visit · nothing due");
  });

  it("a package session files a zero-total invoice, records a zero package payment and consumes once", () => {
    const plan = buildSettlePlan({
      visit: visit({
        pendingVisitItems: [session],
        depositedAmount: 0,
        depositTxnIds: [],
        patientPackageId: "pp1",
      }),
      walletBalance: 10000,
      pricing,
    });

    expect(plan.filesInvoice).toBe(true);
    expect(plan.zeroPayment).toBe(true);
    expect(plan.totals.totalAmount).toBe(0);
    expect(plan.steps.map((s) => s.kind)).toEqual([
      "create-invoice",
      "link-appointment",
      "record-zero-payment",
      "consume-session",
      "close-appointment",
    ]);
    expect(settlePrimaryLabel(plan)).toBe("File session & Close");
  });

  it("the deposit record is cleared only by the final step", () => {
    const plan = buildSettlePlan({
      visit: visit(),
      walletBalance: 791,
      depositRows: [esewaRow],
      pricing,
    });
    const kinds = plan.steps.map((s) => s.kind);

    expect(kinds.indexOf("apply-deposit")).toBeLessThan(
      kinds.indexOf("close-appointment"),
    );
    expect(kinds[kinds.length - 1]).toBe("close-appointment");
  });
});

describe("filesInvoiceFor", () => {
  it("is false for no lines or only free lines; true for any chargeable or commission-bearing session line", () => {
    expect(filesInvoiceFor([])).toBe(false);
    expect(filesInvoiceFor([{ price: 0, amount: 0 }])).toBe(false);
    expect(filesInvoiceFor([dressing])).toBe(true);
    expect(filesInvoiceFor([session])).toBe(true);
    expect(filesInvoiceFor([{ ...session, calculateCommission: false }])).toBe(
      false,
    );
  });
});

describe("idempotency key", () => {
  it("revision 0 is byte-identical to the key filed today; later revisions append the revision", () => {
    expect(settleIdempotencyKey("appt1")).toBe("visit:appt1");
    expect(settleIdempotencyKey("appt1", 0)).toBe("visit:appt1");
    expect(settleIdempotencyKey("appt1", 2)).toBe("visit:appt1:2");
  });
});

describe("deriveFundingMethods — truthful method of payment", () => {
  it("one method throughout files as that method", () => {
    const r = deriveFundingMethods(
      [{ id: "w1", amount: 791, paymentMethod: "cash" }],
      791,
      0,
      { amount: 500, method: "cash" },
    );

    expect(r.fundingMethods).toEqual([{ method: "cash", amount: 1291 }]);
    expect(r.paymentMethodForInvoice).toBe("cash");
  });

  it("a legacy visit with no ledger rows is funded as 'wallet' rather than inventing a method", () => {
    const r = deriveFundingMethods([], 791, 0, { amount: 0 });

    expect(r.fundingMethods).toEqual([{ method: "wallet", amount: 791 }]);
    expect(r.paymentMethodForInvoice).toBe("wallet");
  });

  it("takes deposit rows in order and stops at the amount applied", () => {
    const r = deriveFundingMethods(
      [
        { id: "a", amount: 500, paymentMethod: "cash" },
        { id: "b", amount: 500, paymentMethod: "esewa" },
      ],
      700,
      0,
      { amount: 0 },
    );

    expect(r.fundingMethods).toEqual([
      { method: "cash", amount: 500 },
      { method: "esewa", amount: 200 },
    ]);
    expect(r.paymentMethodForInvoice).toBe("mixed");
  });
});

describe("reconciliation property: deposits + residual == invoice total, to the paisa", () => {
  // Deterministic PRNG so a failure is reproducible.
  let seed = 20261010;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;

    return seed / 4294967296;
  };
  const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const money = (max: number) => Math.round(rnd() * max * 100) / 100;

  it("holds over 1,000 random visits", () => {
    for (let n = 0; n < 1000; n++) {
      const lines: SettleLine[] = [];
      const count = 1 + Math.floor(rnd() * 4);

      for (let i = 0; i < count; i++) {
        const price = rnd() < 0.15 ? 0 : money(5000);
        const taxable = rnd() < 0.6;

        lines.push({
          appointmentTypeId: `t${i}`,
          appointmentTypeName: `Service ${i}`,
          price,
          quantity: 1 + Math.floor(rnd() * 2),
          amount: price,
          isTaxable: taxable,
          ...(taxable && rnd() < 0.3 ? { taxRate: pick([5, 13]) } : {}),
          origin: i === 0 ? "booked" : "procedure",
          collectAtCheckIn: i === 0,
          doctorId: "d",
        });
      }
      const discountType = pick(["percent", "flat"] as const);
      const discountValue =
        discountType === "percent" ? Math.floor(rnd() * 30) : money(400);
      const v = {
        id: `a${n}`,
        pendingVisitItems: lines,
        pendingVisitDiscountType: discountType,
        pendingVisitDiscountValue: discountValue,
        depositedAmount: money(3000),
        depositTxnIds: ["w"],
      };
      const walletBalance =
        rnd() < 0.3
          ? money(v.depositedAmount)
          : v.depositedAmount + money(2000);
      const standing = rnd() < 0.3 ? money(1500) : 0;
      const plan = buildSettlePlan({
        visit: v,
        walletBalance,
        depositRows: [
          {
            id: "w",
            amount: v.depositedAmount,
            paymentMethod: pick(["cash", "esewa", "card"]),
          },
        ],
        standingCreditToApply: standing,
        pricing: { taxPercentage: 13, isTaxEnabled: rnd() < 0.85 },
        residualMethod: "cash",
      });
      const total = plan.totals.totalAmount;
      const funded =
        plan.depositToApply + plan.standingCreditToApply + plan.dueNow;

      expect(Math.abs(funded - total)).toBeLessThan(0.005);
      expect(plan.depositToApply).toBeLessThanOrEqual(
        Math.min(v.depositedAmount, walletBalance) + 0.005,
      );
      expect(
        plan.depositToApply + plan.standingCreditToApply,
      ).toBeLessThanOrEqual(walletBalance + 0.005);
      expect(plan.dueNow).toBeGreaterThanOrEqual(0);
      expect(plan.excessToWallet).toBeGreaterThanOrEqual(0);
      const fundingSum = plan.fundingMethods.reduce((s, f) => s + f.amount, 0);

      if (plan.filesInvoice)
        expect(Math.abs(fundingSum - total)).toBeLessThan(0.005);
      for (const l of plan.lines) {
        expect(typeof l.isTaxable).toBe("boolean");
        expect(l.appointmentTypeId).toBeTruthy();
        expect(l.doctorId).toBeTruthy();
      }
    }
  });
});
