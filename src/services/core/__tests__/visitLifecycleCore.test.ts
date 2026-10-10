import { describe, it, expect } from "vitest";

import {
  deriveVisitStage,
  canCompleteCheckout,
  isTriageComplete,
  hasOutstandingInvoice,
  hasLiveInvoice,
  visitQueueCandidates,
  LEGACY_TRIAGE_MARKER,
  isVoidedInvoice,
  deriveBillingSubState,
  nextStageAfterConsultation,
  reverseVisitPlan,
  rerouteVisitPlan,
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

  it("judges the deposit tax-inclusive when pricing is supplied", () => {
    // 700 deposited against a 700 line that carries 13% tax: 91 is still
    // owed. Without the pricing context this used to pass, and the desk
    // (which gates tax-inclusive) and checkout disagreed about the visit.
    const visit = {
      status: "completed",
      doctorId: "doc1",
      triageCompletedAt: new Date(),
      pendingVisitItems: [
        { price: 700, amount: 700, isTaxable: true, taxRate: 13 } as any,
      ],
      depositedAmount: 700,
    };
    const pricing = { taxPercentage: 13, isTaxEnabled: true };
    const result = canCompleteCheckout(visit, { pricing });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/91\.00 is still to be collected/);
    // ...and the same visit with the tax deposited too passes the gate.
    expect(
      canCompleteCheckout({ ...visit, depositedAmount: 791 }, { pricing })
        .reason,
    ).not.toMatch(/still to be collected/);
  });

  it("blocks a fully deposited visit whose charges were never invoiced", () => {
    // Money taken, nothing filed: closing now would strand the patient
    // with no invoice, no IRD filing and no commission.
    const result = canCompleteCheckout({
      status: "completed",
      doctorId: "doc1",
      triageCompletedAt: new Date(),
      pendingVisitItems: [{ price: 500, amount: 500 }],
      depositedAmount: 500,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not been invoiced/i);
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

describe("visitQueueCandidates", () => {
  it("puts a doctor-only visit in the doctor queue alone", () => {
    expect(visitQueueCandidates({ doctorId: "doc1" })).toEqual({
      doctor: true,
      expert: false,
    });
  });

  it("puts an expert-only visit in the expert queue alone", () => {
    expect(visitQueueCandidates({ assignedExpertId: "exp1" })).toEqual({
      doctor: false,
      expert: true,
    });
  });

  it("puts a visit booked with BOTH in both queues", () => {
    // The real regression: this patient used to appear only under Doctor,
    // because the rule looked at doctorId and never at the expert, so staff
    // who intended the expert could not find them.
    expect(
      visitQueueCandidates({ doctorId: "doc1", assignedExpertId: "exp1" }),
    ).toEqual({ doctor: true, expert: true });
  });

  it("puts a visit with neither assigned in both, since the desk must choose", () => {
    // Previously landed in the expert queue purely because the rule was the
    // negation of "has a doctor" — nothing to do with experts at all.
    expect(visitQueueCandidates({})).toEqual({ doctor: true, expert: true });
  });

  it("treats \"unassigned\" as not assigned", () => {
    expect(
      visitQueueCandidates({
        doctorId: "unassigned",
        assignedExpertId: "exp1",
      }),
    ).toEqual({ doctor: false, expert: true });

    expect(
      visitQueueCandidates({
        doctorId: "unassigned",
        assignedExpertId: "unassigned",
      }),
    ).toEqual({ doctor: true, expert: true });
  });

  it("treats null and empty ids as not assigned", () => {
    expect(
      visitQueueCandidates({ doctorId: null, assignedExpertId: "" }),
    ).toEqual({ doctor: true, expert: true });
  });
});

describe("voided invoices", () => {
  it("a reissued (voided) invoice id is never live, so the visit returns to the desk", () => {
    const visit = billedVisit({ voidedInvoiceIds: ["inv1"] });

    expect(isVoidedInvoice(visit)).toBe(true);
    expect(hasLiveInvoice(visit, { status: "cancelled" })).toBe(false);
    expect(deriveVisitStage(visit, { invoice: { status: "cancelled" } })).toBe("billing");
    expect(deriveBillingSubState(visit, { invoice: { status: "cancelled" } })).toBe("to-settle");
  });
});

describe("deriveBillingSubState", () => {
  it("is to-settle before anything is filed", () => {
    expect(deriveBillingSubState({ status: "completed", pendingVisitItems: [{ price: 500, amount: 500 }] })).toBe("to-settle");
  });

  it("is filed-unpaid while a live invoice still carries a balance", () => {
    expect(
      deriveBillingSubState(billedVisit(), { invoice: { paymentStatus: "partial", balanceAmount: 65 } }),
    ).toBe("filed-unpaid");
  });

  it("is reissue when new lines accumulate under a filed invoice", () => {
    expect(
      deriveBillingSubState(billedVisit({ pendingVisitItems: [{ price: 300, amount: 300 }] }), {
        invoice: { paymentStatus: "paid", balanceAmount: 0 },
      }),
    ).toBe("reissue");
  });

  it("is reissue when the filed invoice was cancelled without a reissue", () => {
    expect(deriveBillingSubState(billedVisit(), { invoice: { status: "cancelled" } })).toBe("reissue");
  });
});

describe("nextStageAfterConsultation", () => {
  it("routes to the expert when the doctor recorded expert work for today", () => {
    const out = nextStageAfterConsultation({
      assignedExpertId: "exp1",
      recommendedItems: [{ doToday: true, status: "recommended", performedBy: { kind: "expert" } }],
    });

    expect(out).toEqual({ status: "in-progress", doctorConsultationCompleted: true, routeToExpert: true });
  });

  it("completes when the doctor recorded only own work", () => {
    expect(
      nextStageAfterConsultation({
        assignedExpertId: "exp1",
        recommendedItems: [{ doToday: true, status: "performed", performedBy: { kind: "doctor" } }],
      }).status,
    ).toBe("completed");
  });

  it("still sends a booked expert the patient when the doctor recorded nothing", () => {
    expect(nextStageAfterConsultation({ assignedExpertId: "exp1" }).routeToExpert).toBe(true);
  });

  it("completes a doctor-only visit", () => {
    expect(nextStageAfterConsultation({ assignedExpertId: "unassigned" }).status).toBe("completed");
  });
});

describe("reverseVisitPlan", () => {
  const now = new Date("2026-10-10T10:00:00Z");
  const by = "staff1";

  it("cancel after check-in clears the visit's charges but keeps the wallet money as credit", () => {
    const plan = reverseVisitPlan(
      "cancel",
      { status: "confirmed", depositedAmount: 791, pendingVisitItems: [{ price: 700, amount: 700 }], patientPackageId: "pp1" },
      { by, now, reason: "left" },
    );

    expect(plan.allowed).toBe(true);
    expect(plan.patch.status).toBe("cancelled");
    expect(plan.patch.pendingVisitItems).toEqual([]);
    expect(plan.patch.depositedAmount).toBe(0);
    expect(plan.walletCreditRetained).toBe(791);
    expect(plan.releasesSession).toBe(true);
    expect(plan.note).toMatch(/Cancelled by staff1/);
  });

  it("cancel is refused once an invoice has been filed", () => {
    const plan = reverseVisitPlan("cancel", billedVisit(), { by, now }, { invoice: { paymentStatus: "paid" } });

    expect(plan.allowed).toBe(false);
    expect(plan.reason).toMatch(/credit note/i);
  });

  it("send back keeps clinicians, triage and money", () => {
    const plan = reverseVisitPlan(
      "send-back",
      { status: "in-progress", doctorId: "doc1", triageCompletedAt: now, depositedAmount: 791, cabinName: "OPD 2" },
      { by, now },
    );

    expect(plan.allowed).toBe(true);
    expect(plan.patch).toEqual({ status: "confirmed", cabinName: null });
    expect(plan.walletCreditRetained).toBe(0);
  });

  it("undo check-in is refused when a deposit exists", () => {
    const plan = reverseVisitPlan("undo-check-in", { status: "confirmed", depositedAmount: 791 }, { by, now });

    expect(plan.allowed).toBe(false);
    expect(plan.reason).toMatch(/Cancel Visit/);
  });

  it("undo check-in returns a fee-free visit to scheduled", () => {
    const plan = reverseVisitPlan("undo-check-in", { status: "confirmed", depositedAmount: 0 }, { by, now });

    expect(plan.allowed).toBe(true);
    expect(plan.patch.status).toBe("scheduled");
  });

  it("no-show only applies to a scheduled visit", () => {
    expect(reverseVisitPlan("no-show", { status: "scheduled" }, { by, now }).allowed).toBe(true);
    expect(reverseVisitPlan("no-show", { status: "confirmed" }, { by, now }).allowed).toBe(false);
  });

  it("reinstate restores status only", () => {
    const plan = reverseVisitPlan("reinstate", { status: "no-show" }, { by, now });

    expect(plan.patch).toEqual({ status: "scheduled", cancelReason: null, checkedInAt: null });
  });
});

describe("rerouteVisitPlan", () => {
  const now = new Date("2026-10-10T10:00:00Z");

  it("changes the clinician and room, keeps earlier lines attributed, never after filing", () => {
    const plan = rerouteVisitPlan(
      {
        status: "in-progress",
        doctorId: "docA",
        pendingVisitItems: [{ price: 700, amount: 700, doctorId: "docA", appointmentTypeName: "Consultation" }],
      },
      { doctorId: "docB", doctorName: "Dr. B", cabinName: "OPD 3" },
      { by: "staff1", now },
    );

    expect(plan.allowed).toBe(true);
    expect(plan.patch).toEqual({ doctorId: "docB", cabinName: "OPD 3" });
    expect(plan.keptAttribution).toEqual(["Consultation"]);
    expect(plan.note).toMatch(/Rerouted to Dr. B · OPD 3/);

    expect(
      rerouteVisitPlan(billedVisit(), { doctorId: "docB" }, { by: "staff1", now }, { invoice: { paymentStatus: "paid" } })
        .allowed,
    ).toBe(false);
  });
});
