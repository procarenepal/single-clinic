import { describe, it, expect } from "vitest";

import {
  describeCheckInPlan,
  planCheckIn,
  planCollectDue,
  standingWalletCredit,
  visitWaitStart,
  waitMinutes,
} from "../checkInCore";

const pricing = { taxPercentage: 13, isTaxEnabled: true };
const consult = {
  id: "c",
  name: "Doctor Consultation",
  pricedBy: "doctor" as const,
  performerKind: "doctor" as const,
  billAtFrontDesk: true,
  isTaxable: true,
  taxRate: 13,
};
const prp = {
  id: "prp",
  name: "PRP Therapy",
  price: 4500,
  billAtFrontDesk: true,
  isTaxable: false,
};
const drA = {
  id: "d1",
  name: "Dr. A",
  kind: "doctor" as const,
  consultationCharge: 700,
};
const rina = { id: "e1", name: "Rina", kind: "expert" as const };

describe("planCheckIn", () => {
  it("collects the booked service's tax-inclusive total — a PRP booking collects PRP", () => {
    const plan = planCheckIn({ status: "scheduled" }, prp, rina, pricing);

    expect(plan).toMatchObject({
      kind: "collect",
      due: 4500,
      standingCredit: 0,
      collectNow: 4500,
    });
    expect(describeCheckInPlan(plan)).toBe(
      "Collect NPR 4,500.00 (NPR 4,500.00).",
    );
  });

  it("the consultation is 700 + VAT 91 = 791", () => {
    const plan = planCheckIn({ status: "scheduled" }, consult, drA, pricing);

    expect(plan).toMatchObject({ kind: "collect", due: 791, collectNow: 791 });
    expect(describeCheckInPlan(plan)).toBe(
      "Collect NPR 791.00 (NPR 700.00 + VAT NPR 91.00).",
    );
  });

  it("standing wallet credit reduces what is taken, and can cover it entirely", () => {
    const partial = planCheckIn({}, consult, drA, pricing, {
      standingCredit: 300,
    });

    expect(partial).toMatchObject({
      kind: "collect",
      creditApplied: 300,
      collectNow: 491,
    });
    expect(describeCheckInPlan(partial)).toMatch(
      /less wallet credit NPR 300\.00/,
    );
    const covered = planCheckIn({}, consult, drA, pricing, {
      standingCredit: 1000,
    });

    // Only 791 of the 1,000 credit is applied — the fee it actually pays —
    // never the whole balance; the rest stays available for other visits.
    expect(covered).toMatchObject({
      kind: "collect",
      standingCredit: 1000,
      creditApplied: 791,
      collectNow: 0,
    });
    expect(describeCheckInPlan(covered)).toMatch(
      /Wallet credit NPR 791\.00 covers this fee/,
    );
  });

  it("what was already deposited is not asked for again", () => {
    expect(
      planCheckIn({ depositedAmount: 791 }, consult, drA, pricing),
    ).toMatchObject({ kind: "free" });
    expect(
      planCheckIn({ depositedAmount: 300 }, consult, drA, pricing),
    ).toMatchObject({ kind: "collect", due: 491, collectNow: 491 });
  });

  it("a legacy invoice, a package session and a sibling take nothing", () => {
    const invoiced = planCheckIn({ billingId: "b1" }, consult, drA, pricing, {
      invoiceNumber: "INV-0042",
    });

    expect(invoiced).toEqual({ kind: "invoiced", invoiceNumber: "INV-0042" });
    expect(describeCheckInPlan(invoiced)).toBe(
      "Already invoiced at booking · INV-0042. Nothing to collect.",
    );
    expect(
      planCheckIn({ patientPackageId: "pp" }, consult, drA, pricing),
    ).toEqual({ kind: "session" });
    expect(
      planCheckIn({ billedOnAppointmentId: "main" }, consult, drA, pricing),
    ).toEqual({ kind: "elsewhere" });
  });

  it("a free service or one collected at Settle is one click", () => {
    expect(
      planCheckIn(
        {},
        { id: "f", name: "Follow-up", price: 0, billAtFrontDesk: true },
        drA,
        pricing,
      ),
    ).toMatchObject({ kind: "free" });
    const later = planCheckIn(
      {},
      { id: "p", name: "Peel", price: 2500, billAtFrontDesk: false },
      rina,
      pricing,
    );

    expect(later).toMatchObject({ kind: "free" });
    expect(describeCheckInPlan(later)).toBe(
      "NPR 2,500.00 is collected at Settle. Nothing to collect now.",
    );
  });

  it("refuses what the charge core refuses, and a missing type or clinician", () => {
    expect(planCheckIn({}, consult, rina, pricing)).toMatchObject({
      kind: "refused",
      reason: expect.stringMatching(/performed by a doctor, not Rina/),
    });
    expect(
      planCheckIn(
        {},
        consult,
        { ...drA, consultationCharge: undefined },
        pricing,
      ),
    ).toMatchObject({ kind: "refused" });
    expect(planCheckIn({}, undefined, drA, pricing)).toMatchObject({
      kind: "refused",
      reason: expect.stringMatching(/not in the catalogue/),
    });
    expect(planCheckIn({}, consult, null, pricing)).toMatchObject({
      kind: "refused",
      reason: expect.stringMatching(/No clinician/),
    });
  });
});

describe("standingWalletCredit", () => {
  it("is the balance less every open visit's deposit, never negative", () => {
    expect(standingWalletCredit(1000, [{ depositedAmount: 791 }])).toBe(209);
    expect(standingWalletCredit(500, [{ depositedAmount: 791 }])).toBe(0);
    expect(standingWalletCredit(undefined, [])).toBe(0);
    expect(standingWalletCredit(300.005, [])).toBe(300.01);
  });

  it("does not re-subtract a deposit's credit share, since claiming it already left the balance", () => {
    // Balance 500 is what remains AFTER 500 of credit was already claimed
    // (deductFunds) for this visit's deposit. Treating the whole deposit as
    // still-earmarked cash would wrongly report 0 standing credit left.
    expect(
      standingWalletCredit(500, [{ depositedAmount: 500, depositFromCredit: 500 }]),
    ).toBe(500);
  });

  it("still earmarks the cash share of a mixed deposit, only skipping the credit share", () => {
    // 300 credit (already left the balance) + 400 cash (added to the
    // balance and earmarked) deposited; balance now 1100 (800 prior + 400 cash in).
    expect(
      standingWalletCredit(1100, [{ depositedAmount: 700, depositFromCredit: 300 }]),
    ).toBe(700);
  });
});

describe("wait clock", () => {
  const day = new Date(2026, 9, 10, 0, 0, 0);

  it("starts at check-in when known", () => {
    const at = new Date(2026, 9, 10, 10, 32);

    expect(visitWaitStart({ checkedInAt: at, appointmentDate: day })).toEqual(
      at,
    );
    expect(
      visitWaitStart({
        checkedInAt: { seconds: Math.floor(at.getTime() / 1000) },
        appointmentDate: day,
      }),
    ).toEqual(at);
  });

  it("else at the booked start, never at creation", () => {
    expect(
      visitWaitStart({ appointmentDate: day, startTime: "10:30" }),
    ).toEqual(new Date(2026, 9, 10, 10, 30));
    expect(visitWaitStart({ appointmentDate: day })).toEqual(day);
    expect(visitWaitStart({})).toBeNull();
  });

  it("counts whole minutes and never goes negative", () => {
    const now = new Date(2026, 9, 10, 10, 45, 30);

    expect(waitMinutes({ appointmentDate: day, startTime: "10:30" }, now)).toBe(
      15,
    );
    expect(waitMinutes({ appointmentDate: day, startTime: "11:30" }, now)).toBe(
      0,
    );
    expect(waitMinutes({}, now)).toBeNull();
  });
});

describe("planCollectDue — the sheet for a visit already in the lobby", () => {
  it("asks for what the gate still owes, with the breakdown", () => {
    const plan = planCollectDue({ owed: 791, base: 700, deposited: 0 });

    expect(plan).toMatchObject({ kind: "collect", due: 791, collectNow: 791 });
    expect(describeCheckInPlan(plan)).toBe(
      "Collect NPR 791.00 (NPR 700.00 + VAT NPR 91.00).",
    );
    expect(
      planCollectDue({
        owed: 791,
        base: 700,
        deposited: 300,
        standingCredit: 100,
      }),
    ).toMatchObject({ kind: "collect", due: 491, collectNow: 391 });
    expect(planCollectDue({ owed: 791, base: 700, deposited: 791 })).toEqual({
      kind: "free",
    });
  });
});
