import { describe, it, expect } from "vitest";

import {
  boardRowFor,
  type BoardVisitFacts,
  type BoardSettings,
  type BillingSubState,
} from "../visitBoardCore";
import type { VisitStage } from "../visitLifecycleCore";

const settings: BoardSettings = {
  collectProcedureBeforePerforming: false,
  canSettle: true,
  canSkipTriage: true,
  canRemoveLine: true,
};
const base: BoardVisitFacts = {
  stage: "lobby",
  hasDoctor: true,
  hasExpert: false,
  targetClinicianName: "Dr. Shrestha",
  roomName: "OPD 2",
  waitMinutes: 6,
  checkInDue: 0,
  triageRequired: true,
  triageDone: false,
  settleLabel: "Settle · NPR 1,808.00 due",
  invoiceBalance: 1808,
  invoiceNumber: "INV-0231",
  hasDeposit: true,
};
const ROLES = ["clinic-admin", "staff", "doctor", "expert", "hr"] as const;
const STAGES: VisitStage[] = [
  "scheduled",
  "lobby",
  "triage-done",
  "doctor",
  "expert",
  "billing",
  "pharmacy",
  "completed",
  "cancelled",
  "no-show",
];
const SUBS: BillingSubState[] = ["to-settle", "filed-unpaid", "reissue"];

describe("invariant: one primary XOR one chip, and no primary without an action", () => {
  it("holds for every stage × sub-state × role × fee/triage/deposit variant", () => {
    let cells = 0;

    for (const stage of STAGES) {
      for (const sub of SUBS) {
        for (const role of ROLES) {
          for (const checkInDue of [0, 791]) {
            for (const triageDone of [false, true]) {
              for (const collectFirst of [false, true]) {
                const row = boardRowFor(
                  {
                    ...base,
                    stage,
                    billingSubState: sub,
                    checkInDue,
                    triageDone,
                    allDue: 2825,
                  },
                  role,
                  {
                    ...settings,
                    collectProcedureBeforePerforming: collectFirst,
                  },
                );
                const hasPrimary = Boolean(row.primary);
                const hasChip = Boolean(row.chip);

                expect(
                  hasPrimary !== hasChip,
                  `${stage}/${sub}/${role} due=${checkInDue} triage=${triageDone} collect=${collectFirst}`,
                ).toBe(true);
                if (row.primary) {
                  expect(row.primary.id).toBeTruthy();
                  expect(row.primary.label.trim().length).toBeGreaterThan(0);
                }
                for (const a of row.overflow) expect(a.id).toBeTruthy();
                cells++;
              }
            }
          }
        }
      }
    }
    expect(cells).toBe(STAGES.length * SUBS.length * ROLES.length * 8);
  });
});

describe("labels state effect and amount", () => {
  it("a doctor visit waits for triage; the fee gate comes first", () => {
    expect(boardRowFor(base, "staff", settings).primary).toEqual({
      id: "triage-and-send",
      label: "Triage & Send",
    });
    expect(
      boardRowFor({ ...base, checkInDue: 791 }, "staff", settings).primary
        ?.label,
    ).toBe("Collect NPR 791.00");
    expect(
      boardRowFor(
        { ...base, checkInDue: 791, depositFailed: true },
        "staff",
        settings,
      ).primary?.label,
    ).toBe("Retry fee NPR 791.00");
  });

  it("an expert-only visit with triage off sends straight to the expert's room", () => {
    const row = boardRowFor(
      {
        ...base,
        hasDoctor: false,
        hasExpert: true,
        targetClinicianName: "Rina",
        roomName: "Laser 1",
        triageRequired: false,
      },
      "staff",
      settings,
    );

    expect(row.primary?.label).toBe("Send to Rina · Laser 1");
  });

  it("a triaged patient's primary names the clinician and room", () => {
    expect(
      boardRowFor(
        { ...base, stage: "triage-done", triageDone: true },
        "staff",
        settings,
      ).primary?.label,
    ).toBe("Send to Dr. Shrestha · OPD 2");
  });

  it("collect-before-performing turns the pre-cabin primary into Collect & Send", () => {
    const row = boardRowFor(
      { ...base, triageDone: true, allDue: 2825 },
      "staff",
      { ...settings, collectProcedureBeforePerforming: true },
    );

    expect(row.primary?.label).toBe("Collect NPR 2,825.00 & Send");
  });

  it("in the cabin, only the clinician whose step it is gets a button; the desk gets a chip", () => {
    expect(
      boardRowFor({ ...base, stage: "doctor" }, "doctor", settings).primary?.id,
    ).toBe("finish-consultation");
    expect(
      boardRowFor({ ...base, stage: "doctor" }, "staff", settings).chip,
    ).toBe("With Dr. Shrestha · OPD 2 · 6 min");
    expect(
      boardRowFor({ ...base, stage: "doctor" }, "expert", settings).chip,
    ).toMatch(/With doctor/);
    expect(
      boardRowFor({ ...base, stage: "expert" }, "expert", settings).primary?.id,
    ).toBe("record-procedure");
  });

  it("the settle desk shows the plan's label; clinician logins see a chip", () => {
    expect(
      boardRowFor({ ...base, stage: "billing" }, "staff", settings).primary
        ?.label,
    ).toBe("Settle · NPR 1,808.00 due");
    expect(
      boardRowFor({ ...base, stage: "billing" }, "doctor", settings).chip,
    ).toBe("At billing desk");
    expect(
      boardRowFor({ ...base, stage: "billing" }, "staff", {
        ...settings,
        canSettle: false,
      }).chip,
    ).toBe("At billing desk");
  });

  it("after filing, the desk collects the balance or reissues", () => {
    expect(
      boardRowFor(
        { ...base, stage: "billing", billingSubState: "filed-unpaid" },
        "staff",
        settings,
      ).primary?.label,
    ).toBe("Collect NPR 1,808.00");
    expect(
      boardRowFor(
        { ...base, stage: "billing", billingSubState: "reissue" },
        "staff",
        settings,
      ).primary?.id,
    ).toBe("reissue-invoice");
  });

  it("closed rows are chips naming the invoice, or 'no invoice'", () => {
    expect(
      boardRowFor({ ...base, stage: "completed" }, "staff", settings).chip,
    ).toBe("Closed · INV-0231");
    expect(
      boardRowFor(
        { ...base, stage: "completed", closedWithoutInvoice: true },
        "staff",
        settings,
      ).chip,
    ).toBe("Closed · no invoice");
    expect(
      boardRowFor(
        { ...base, stage: "no-show" },
        "staff",
        settings,
      ).overflow.map((a) => a.id),
    ).toEqual(["reinstate"]);
  });

  it("skip-triage appears in the overflow only for roles allowed to", () => {
    expect(
      boardRowFor(base, "staff", settings).overflow.some(
        (a) => a.id === "skip-triage",
      ),
    ).toBe(true);
    expect(
      boardRowFor(base, "staff", {
        ...settings,
        canSkipTriage: false,
      }).overflow.some((a) => a.id === "skip-triage"),
    ).toBe(false);
  });
});
