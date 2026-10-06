import { describe, it, expect } from "vitest";

import {
  deriveVisitStage,
  canCompleteCheckout,
  isTriageComplete,
  hasOutstandingInvoice,
  hasLiveInvoice,
  LEGACY_TRIAGE_MARKER,
} from "../visitLifecycleCore";

const billedVisit = (overrides = {}) => ({
  status: "completed",
  doctorId: "doc1",
  triageCompletedAt: new Date(),
  billingId: "inv1",
  pendingVisitItems: [],
  ...overrides,
});

describe("isTriageComplete", () => {
  it("uses the structured field", () => {
    expect(isTriageComplete({ triageCompletedAt: new Date() })).toBe(true);
  });

  it("falls back to the legacy notes marker for older visits", () => {
    expect(
      isTriageComplete({ notes: `something\n${LEGACY_TRIAGE_MARKER} BP: 120/80` }),
    ).toBe(true);
  });

  it("is false when neither is present", () => {
    expect(isTriageComplete({ notes: "patient was late" })).toBe(false);
    expect(isTriageComplete({})).toBe(false);
  });
});

describe("deriveVisitStage — clinical progression", () => {
  it("maps terminal statuses", () => {
    expect(deriveVisitStage({ status: "no-show" })).toBe("no-show");
    expect(deriveVisitStage({ status: "cancelled" })).toBe("cancelled");
    expect(deriveVisitStage({ status: "scheduled" })).toBe("scheduled");
  });

  it("splits lobby and triage-done on vitals", () => {
    expect(deriveVisitStage({ status: "confirmed" })).toBe("lobby");
    expect(
      deriveVisitStage({ status: "confirmed", triageCompletedAt: new Date() }),
    ).toBe("triage-done");
  });

  it("sequences a dual doctor+expert visit doctor-first", () => {
    const dual = {
      status: "in-progress",
      doctorId: "doc1",
      assignedExpertId: "exp1",
    };

    expect(deriveVisitStage(dual)).toBe("doctor");
    expect(
      deriveVisitStage({ ...dual, doctorConsultationCompleted: true }),
    ).toBe("expert");
  });

  it("treats 'unassigned' as no clinician", () => {
    expect(
      deriveVisitStage({
        status: "in-progress",
        doctorId: "unassigned",
        assignedExpertId: "exp1",
      }),
    ).toBe("expert");
  });
});

describe("deriveVisitStage — billing truthfully reflects money owed", () => {
  it("keeps an unbilled completed visit at the billing desk", () => {
    expect(
      deriveVisitStage({ status: "completed", doctorId: "doc1", billingId: null }),
    ).toBe("billing");
  });

  it("holds the visit while a recommended procedure is undecided", () => {
    expect(
      deriveVisitStage(
        billedVisit({ recommendedProcedure: { name: "Peel", fee: 2500 } }),
        { invoice: { paymentStatus: "paid", balanceAmount: 0 } },
      ),
    ).toBe("billing");
  });

  it("completes a visit whose invoice is fully paid", () => {
    expect(
      deriveVisitStage(billedVisit(), {
        invoice: { status: "draft", paymentStatus: "paid", balanceAmount: 0 },
      }),
    ).toBe("completed");
  });

  it("does NOT let a visit disappear while its invoice is still owed", () => {
    // The regression this module exists to prevent: a stored completion
    // flag let a partially-paid visit drop off the board entirely.
    expect(
      deriveVisitStage(billedVisit(), {
        invoice: { status: "draft", paymentStatus: "partial", balanceAmount: 65 },
      }),
    ).toBe("billing");
  });

  it("returns a visit to the desk when its invoice was cancelled", () => {
    // Cancelling the invoice must make the visit billable again rather than
    // stranding it as 'already billed' with its charges already cleared.
    expect(
      deriveVisitStage(billedVisit(), {
        invoice: { status: "cancelled", paymentStatus: "cancelled", balanceAmount: 0 },
      }),
    ).toBe("billing");
  });

  it("routes a settled visit with dispensing left to pharmacy", () => {
    expect(
      deriveVisitStage(billedVisit(), {
        invoice: { paymentStatus: "paid", balanceAmount: 0 },
        hasPendingPrescription: true,
      }),
    ).toBe("pharmacy");
  });

  it("honours an explicit checkout closure recorded by the checkout path", () => {
    expect(
      deriveVisitStage(
        billedVisit({ billingId: null, checkoutCompleted: true }),
        {},
      ),
    ).toBe("completed");
  });

  it("still honours the legacy paid/closed mirrors on older visits", () => {
    expect(
      deriveVisitStage(
        { status: "completed", doctorId: "doc1", billingStatus: "paid" },
        {},
      ),
    ).toBe("completed");
  });

  it("an outstanding balance outranks an explicit closure flag", () => {
    // The exact regression: the billing path set the closure flag, which
    // made a part-paid visit vanish from the board. Money owed wins.
    expect(
      deriveVisitStage(billedVisit({ checkoutCompleted: true }), {
        invoice: { paymentStatus: "partial", balanceAmount: 65 },
      }),
    ).toBe("billing");
  });

  it("a cancelled invoice outranks an explicit closure flag", () => {
    expect(
      deriveVisitStage(billedVisit({ checkoutCompleted: true }), {
        invoice: { status: "cancelled", balanceAmount: 0 },
      }),
    ).toBe("billing");
  });

  it("keeps a visit at billing when charges accumulated but nothing was filed", () => {
    expect(
      deriveVisitStage({
        status: "completed",
        doctorId: "doc1",
        billingId: null,
        pendingVisitItems: [{ price: 500, amount: 500 }],
      }),
    ).toBe("billing");
  });
});

describe("hasOutstandingInvoice", () => {
  it("is false for no invoice, paid, or cancelled", () => {
    expect(hasOutstandingInvoice(null)).toBe(false);
    expect(hasOutstandingInvoice({ paymentStatus: "paid", balanceAmount: 0 })).toBe(false);
    expect(
      hasOutstandingInvoice({ status: "cancelled", balanceAmount: 500 }),
    ).toBe(false);
  });

  it("is true when a live invoice still carries a balance", () => {
    expect(
      hasOutstandingInvoice({ status: "draft", paymentStatus: "partial", balanceAmount: 65 }),
    ).toBe(true);
  });
});

describe("hasLiveInvoice", () => {
  it("is false when no invoice was ever filed", () => {
    expect(hasLiveInvoice({ billingId: null })).toBe(false);
  });

  it("is false once the invoice is cancelled", () => {
    expect(hasLiveInvoice({ billingId: "i1" }, { status: "cancelled" })).toBe(false);
  });

  it("assumes live when the invoice cannot be loaded, rather than inviting a second filing", () => {
    expect(hasLiveInvoice({ billingId: "i1" }, null)).toBe(true);
  });
});

describe("canCompleteCheckout", () => {
  it("blocks when a doctor saw the patient but vitals were never recorded", () => {
    const result = canCompleteCheckout({ status: "completed", doctorId: "doc1" });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/triage vitals/i);
  });

  it("blocks while a recommended procedure is undecided", () => {
    const result = canCompleteCheckout(
      billedVisit({ recommendedProcedure: { fee: 2500 } }),
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/recommended procedure/i);
  });

  it("blocks when the visit still has uncollected charges", () => {
    const result = canCompleteCheckout({
      status: "completed",
      doctorId: "doc1",
      triageCompletedAt: new Date(),
      pendingVisitItems: [{ price: 500, amount: 500 }],
      depositedAmount: 0,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/still to be collected/i);
  });

  it("blocks when the filed invoice still has a balance", () => {
    const result = canCompleteCheckout(billedVisit(), {
      invoice: { paymentStatus: "partial", balanceAmount: 65 },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/outstanding balance/i);
  });

  it("allows a visit that is documented and fully settled", () => {
    expect(
      canCompleteCheckout(billedVisit(), {
        invoice: { paymentStatus: "paid", balanceAmount: 0 },
      }),
    ).toEqual({ allowed: true });
  });

  it("does not demand vitals when no doctor was involved", () => {
    expect(
      canCompleteCheckout(
        { status: "completed", assignedExpertId: "exp1", billingId: "i1" },
        { invoice: { paymentStatus: "paid", balanceAmount: 0 } },
      ).allowed,
    ).toBe(true);
  });
});
