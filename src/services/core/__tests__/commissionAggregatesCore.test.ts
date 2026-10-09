import { describe, it, expect } from "vitest";

import {
  earnedAmount,
  paidOutAmount,
  summarizeCommissions,
} from "../commissionAggregatesCore";

const earnedPaid = {
  commissionAmount: 169.5,
  paidAmount: 169.5,
  status: "paid",
};
const earnedPending = {
  commissionAmount: 200,
  paidAmount: 50,
  status: "pending",
};
const cancelledOriginal = {
  commissionAmount: 169.5,
  paidAmount: 169.5,
  status: "cancelled",
};
const clawback = {
  commissionAmount: -169.5,
  status: "pending",
  clawbackOf: "orig",
};

describe("summarizeCommissions", () => {
  it("adds up ordinary commissions the way the pages always did", () => {
    expect(summarizeCommissions([earnedPaid, earnedPending])).toEqual({
      earned: 369.5,
      paidOut: 219.5,
      outstanding: 150,
      owedBack: 0,
      count: 2,
    });
  });

  it("ignores cancelled records entirely", () => {
    expect(summarizeCommissions([cancelledOriginal])).toEqual({
      earned: 0,
      paidOut: 0,
      outstanding: 0,
      owedBack: 0,
      count: 0,
    });
  });

  it("counts a clawback as owed back, never as negative earnings", () => {
    // The reversed invoice: original cancelled, 169.5 already paid out,
    // clawback pending. Earned is 0 (the counter agrees: +169.5 -169.5),
    // outstanding is -169.5 (the counter agrees), owed back is 169.5.
    expect(summarizeCommissions([cancelledOriginal, clawback])).toEqual({
      earned: 0,
      paidOut: 0,
      outstanding: -169.5,
      owedBack: 169.5,
      count: 0,
    });
  });

  it("nets a clawback against other pending commissions", () => {
    const s = summarizeCommissions([
      earnedPending,
      cancelledOriginal,
      clawback,
    ]);

    expect(s.earned).toBe(200);
    expect(s.outstanding).toBe(-19.5);
    expect(s.owedBack).toBe(169.5);
  });

  it("a recovered clawback no longer counts as owed back", () => {
    const recovered = { ...clawback, paidAmount: -169.5, status: "paid" };

    expect(summarizeCommissions([cancelledOriginal, recovered])).toEqual({
      earned: 0,
      paidOut: 0,
      outstanding: 0,
      owedBack: 0,
      count: 0,
    });
  });

  it("a partly recovered clawback shows the remainder", () => {
    const partly = { ...clawback, paidAmount: -100 };

    expect(summarizeCommissions([partly]).owedBack).toBe(69.5);
    expect(summarizeCommissions([partly]).outstanding).toBe(-69.5);
  });
});

describe("per-record helpers", () => {
  it("earnedAmount and paidOutAmount are zero for a clawback", () => {
    expect(earnedAmount(clawback)).toBe(0);
    expect(paidOutAmount({ ...clawback, paidAmount: -50 })).toBe(0);
    expect(earnedAmount(earnedPending)).toBe(200);
    expect(paidOutAmount(earnedPending)).toBe(50);
  });
});
