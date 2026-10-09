import { describe, it, expect } from "vitest";

import { planSalaryCommissionNetting } from "../payrollCommissionNettingCore";

const row = (
  id: string,
  commissionAmount: number,
  paidAmount = 0,
  status = "pending",
) => ({
  id,
  commissionAmount,
  paidAmount,
  status,
});

describe("planSalaryCommissionNetting", () => {
  it("adds pending commission to the payout and settles every row", () => {
    const plan = planSalaryCommissionNetting(
      [row("a", 100), row("b", 50, 20)],
      10000,
    );

    expect(plan.netBalance).toBe(130);
    expect(plan.netIncluded).toBe(130);
    expect(plan.carriedForward).toBe(0);
    expect(plan.settlements).toEqual([
      { id: "a", amount: 100 },
      { id: "b", amount: 30 },
    ]);
  });

  it("nets a clawback against pending commission when the net is positive", () => {
    const plan = planSalaryCommissionNetting(
      [row("a", 300), row("c", -200)],
      10000,
    );

    expect(plan.netIncluded).toBe(100);
    expect(plan.settlements).toEqual([
      { id: "a", amount: 300 },
      { id: "c", amount: -200 },
    ]);
  });

  it("deducts a net receivable from the salary and recovers the clawback", () => {
    const plan = planSalaryCommissionNetting(
      [row("a", 100), row("c", -250)],
      10000,
    );

    expect(plan.netBalance).toBe(-150);
    expect(plan.netIncluded).toBe(-150);
    expect(plan.carriedForward).toBe(0);
    expect(plan.settlements).toEqual([
      { id: "a", amount: 100 },
      { id: "c", amount: -250 },
    ]);
  });

  it("never withholds more than the payout: the rest of the clawback stays pending", () => {
    // Salary 10,000; 15,000 owed back. Only 10,000 can be withheld; the
    // payout goes to zero and 5,000 is carried forward, still pending.
    const plan = planSalaryCommissionNetting([row("c", -15000)], 10000);

    expect(plan.netIncluded).toBe(-10000);
    expect(plan.carriedForward).toBe(5000);
    expect(plan.settlements).toEqual([{ id: "c", amount: -10000 }]);
  });

  it("recovers clawbacks in order and stops at the cap mid-row", () => {
    const plan = planSalaryCommissionNetting(
      [row("c1", -4000), row("c2", -4000), row("c3", -4000)],
      10000,
    );

    expect(plan.settlements).toEqual([
      { id: "c1", amount: -4000 },
      { id: "c2", amount: -4000 },
      { id: "c3", amount: -2000 },
    ]);
    expect(plan.carriedForward).toBe(2000);
  });

  it("with a zero payout, clawbacks are only netted against positives", () => {
    const plan = planSalaryCommissionNetting(
      [row("a", 100), row("c", -250)],
      0,
    );

    expect(plan.netIncluded).toBe(0);
    expect(plan.settlements).toEqual([
      { id: "a", amount: 100 },
      { id: "c", amount: -100 },
    ]);
    expect(plan.carriedForward).toBe(150);
  });

  it("ignores paid, cancelled and zero-remainder rows", () => {
    const plan = planSalaryCommissionNetting(
      [
        row("p", 100, 100, "paid"),
        row("x", 100, 0, "cancelled"),
        row("z", 50, 50),
      ],
      10000,
    );

    expect(plan.settlements).toEqual([]);
    expect(plan.netBalance).toBe(0);
  });

  it("treats a partly recovered clawback by its remainder", () => {
    const plan = planSalaryCommissionNetting([row("c", -250, -100)], 10000);

    expect(plan.settlements).toEqual([{ id: "c", amount: -150 }]);
    expect(plan.netIncluded).toBe(-150);
  });
});
