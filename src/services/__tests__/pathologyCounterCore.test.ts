import { describe, it, expect } from "vitest";

import {
  counterLabInvoicesAsPathologyBillings,
  labLinesAsPathologyBilling,
} from "../core/pathologyCounterCore";

const base = {
  id: "inv-1",
  invoiceNumber: "INV-2083.084-0144",
  clinicId: "default",
  branchId: "default",
  patientId: "p1",
  patientName: "Namrata Giri",
  invoiceDate: new Date(2026, 9, 17, 10, 0),
  taxPercentage: 13,
  status: "draft",
  paymentStatus: "paid",
  createdBy: "staff",
} as any;

const lab = (id: string, name: string, amount: number) => ({
  id,
  appointmentTypeId: `type-${id}`,
  appointmentTypeName: name,
  price: amount,
  quantity: 1,
  amount,
  commission: 0,
  isTaxable: true,
  taxRate: 13,
  lineKind: "lab" as const,
});

describe("labLinesAsPathologyBilling", () => {
  it("turns a lab-only counter invoice into a pathology row carrying the whole total", () => {
    // CBC 500 + HDL 320, 10% invoice discount, 13% VAT -> 833.94 (the real INV-0144).
    const row = labLinesAsPathologyBilling({
      ...base,
      items: [lab("a", "Complete Blood Count (CBC)", 500), lab("b", "HDL Cholesterol (Direct)", 320)],
      totalAmount: 833.94,
      paidAmount: 833.94,
      balanceAmount: 0,
    });

    expect(row).not.toBeNull();
    expect(row!.totalAmount).toBe(833.94);
    expect(row!.paidAmount).toBe(833.94);
    expect(row!.balanceAmount).toBe(0);
    expect(row!.items.map((i) => i.testName)).toEqual([
      "Complete Blood Count (CBC)",
      "HDL Cholesterol (Direct)",
    ]);
    expect(row!.items[0].testId).toBe("type-a");
    expect(row!.sourceType).toBe("billing-counter");
    expect(row!.sourceBillingId).toBe("inv-1");
    expect(row!.id).toBe("bc:inv-1");
  });

  it("attributes only the lab share of a mixed invoice, in the hospital report's proportion", () => {
    const row = labLinesAsPathologyBilling({
      ...base,
      items: [
        { ...lab("c", "Consultation", 1000), lineKind: "service" as const },
        lab("a", "CBC", 500),
        lab("b", "HDL", 320),
      ],
      totalAmount: 1850.94,
      paidAmount: 925.47,
      balanceAmount: 925.47,
      paymentStatus: "partial",
    });

    // 820 of 1820 line value -> 45.05% of 1850.94 = 833.94, and the same share of the half paid.
    expect(row!.totalAmount).toBe(833.94);
    expect(row!.paidAmount).toBe(416.97);
    expect(row!.balanceAmount).toBe(416.97);
    expect(row!.items).toHaveLength(2);
    expect(row!.paymentStatus).toBe("partial");
  });

  it("returns null when the invoice has no lab lines", () => {
    expect(
      labLinesAsPathologyBilling({
        ...base,
        items: [{ ...lab("c", "Consultation", 1000), lineKind: "service" as const }],
        totalAmount: 1130,
        paidAmount: 1130,
        balanceAmount: 0,
      }),
    ).toBeNull();
  });

  it("keeps a credit note negative, the way pathology's own credit notes are stored", () => {
    const row = labLinesAsPathologyBilling({
      ...base,
      id: "cn-1",
      isCreditNote: true,
      linkedInvoiceId: "inv-1",
      items: [lab("a", "CBC", -500), lab("b", "HDL", -320)],
      totalAmount: -833.94,
      paidAmount: -833.94,
      balanceAmount: 0,
    });

    expect(row!.totalAmount).toBe(-833.94);
    expect(row!.paidAmount).toBe(-833.94);
    expect(row!.items[0].amount).toBe(-500);
    expect(row!.isCreditNote).toBe(true);
  });
});

describe("counterLabInvoicesAsPathologyBillings", () => {
  it("drops cancelled invoices and invoices without lab lines", () => {
    const rows = counterLabInvoicesAsPathologyBillings([
      { ...base, id: "x", items: [lab("a", "CBC", 500)], totalAmount: 565, paidAmount: 565, balanceAmount: 0 },
      { ...base, id: "y", status: "cancelled", items: [lab("a", "CBC", 500)], totalAmount: 565, paidAmount: 0, balanceAmount: 565 },
      { ...base, id: "z", items: [{ ...lab("c", "Consultation", 1000), lineKind: "service" as const }], totalAmount: 1130, paidAmount: 1130, balanceAmount: 0 },
    ]);

    expect(rows.map((r) => r.sourceBillingId)).toEqual(["x"]);
  });
});
