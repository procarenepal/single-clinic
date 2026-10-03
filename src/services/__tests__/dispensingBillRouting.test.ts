/**
 * dispensingBillRouting.test.ts
 *
 * hasDispensableLines decides which of two write paths an invoice takes, and
 * the two differ in a safety-relevant way: a bill with no medicine on it goes
 * through createBilling, which calls the Java ledger first because nothing
 * irreversible has happened yet, while a bill that dispenses medicine must
 * commit stock, invoice and outbox entry in one transaction and file
 * afterwards. Answering false for a bill that does take stock off the shelf
 * would route it down the path that can lose the sale, so the gate is worth
 * pinning on its own.
 */

import { describe, it, expect } from "vitest";

import { hasDispensableLines } from "../unifiedBillingService";
import { AppointmentBillingItem } from "../../types/models";

function line(over: Partial<AppointmentBillingItem>): AppointmentBillingItem {
  return {
    id: "x",
    appointmentTypeId: "cat-1",
    appointmentTypeName: "Thing",
    price: 100,
    quantity: 1,
    amount: 100,
    commission: 0,
    ...over,
  };
}

describe("hasDispensableLines", () => {
  it("is false for a bill of services and lab tests", () => {
    expect(
      hasDispensableLines([
        line({ lineKind: "service" }),
        line({ lineKind: "lab" }),
      ]),
    ).toBe(false);
  });

  it("treats a line with no lineKind as a service", () => {
    // Every record written before the billing counter existed has no
    // lineKind, and all of those are services.
    expect(hasDispensableLines([line({})])).toBe(false);
  });

  it("is true as soon as one medicine line is present", () => {
    expect(
      hasDispensableLines([
        line({ lineKind: "service" }),
        line({ lineKind: "lab" }),
        line({ lineKind: "medicine", quantity: 1 }),
      ]),
    ).toBe(true);
  });

  it("ignores a medicine line that dispenses nothing", () => {
    // A zero-quantity line takes nothing off the shelf, so it must not drag
    // the bill onto the heavier path.
    expect(
      hasDispensableLines([line({ lineKind: "medicine", quantity: 0 })]),
    ).toBe(false);
  });

  it("is false for an empty bill", () => {
    expect(hasDispensableLines([])).toBe(false);
  });
});
