import type {
  AppointmentBilling,
  AppointmentBillingItem,
  PathologyBilling,
  PathologyBillingItem,
} from "../../types/models";

import {
  shareOfInvoiceForKind,
  splitRevenueByLineKind,
} from "./cashLedgerCore";

const round2 = (n: number) => Math.round(n * 100) / 100;

const isLabLine = (item: AppointmentBillingItem) => item.lineKind === "lab";

/**
 * The lab tests on a Billing Counter invoice, as the pathology screens
 * expect to see an invoice.
 *
 * The counter puts a consultation, lab tests and medicines on ONE
 * appointmentBilling document. Pathology's own screens read only
 * pathologyBilling, so a day with real lab invoices from the counter showed
 * zero tests, zero revenue — while the hospital-wide Daily Report counted
 * them. This builds the row those screens need, keeping only the lab lines
 * and attributing the invoice's money to them in the same proportion the
 * hospital-wide report uses, so the two agree to the rupee.
 *
 * Returns null for an invoice with no lab lines. A credit note comes back
 * as a negative row, the way pathology's own credit notes are stored.
 */
export function labLinesAsPathologyBilling(
  invoice: AppointmentBilling,
): PathologyBilling | null {
  const labItems = (invoice.items || []).filter(isLabLine);

  if (labItems.length === 0) return null;

  // The split is taken on magnitudes so the paid/balance arithmetic below
  // works in positive numbers; the credit note's sign goes back on at the
  // end of each figure.
  const sign = (invoice.totalAmount || 0) < 0 ? -1 : 1;
  const magnitude = (n: number | undefined) => Math.abs(n || 0);
  const split = splitRevenueByLineKind(
    (invoice.items || []).map((item) => ({
      amount: magnitude(item.amount),
      lineKind: item.lineKind,
    })),
    magnitude(invoice.totalAmount),
  );
  const pathologyTotal = split.pathology;
  const paidShare = shareOfInvoiceForKind(
    magnitude(invoice.totalAmount),
    pathologyTotal,
    magnitude(invoice.paidAmount),
  );
  const labSubtotal = labItems.reduce(
    (sum, item) => sum + magnitude(item.amount),
    0,
  );

  const items: PathologyBillingItem[] = labItems.map((item) => ({
    id: item.id,
    testId: item.appointmentTypeId,
    testName: item.appointmentTypeName,
    price: sign * magnitude(item.price),
    quantity: item.quantity,
    discountAmount: item.discountAmount,
    amount: sign * magnitude(item.amount),
    isTaxable: item.isTaxable,
    taxRate: item.taxRate,
    hsCode: item.hsCode,
  }));

  return {
    id: `bc:${invoice.id}`,
    invoiceNumber: invoice.invoiceNumber,
    clinicId: invoice.clinicId,
    branchId: invoice.branchId || invoice.clinicId,
    patientId: invoice.patientId || undefined,
    patientName: invoice.patientName,
    patientPanVat: invoice.patientPanVat || (invoice as any).buyerPan,
    invoiceDate: invoice.invoiceDate,
    items,
    subtotal: sign * round2(labSubtotal),
    discountType: "flat",
    discountValue: 0,
    discountAmount: 0,
    taxPercentage: invoice.taxPercentage || 0,
    taxAmount: sign * round2(Math.max(0, pathologyTotal - labSubtotal)),
    totalAmount: sign * round2(pathologyTotal),
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    paidAmount: sign * round2(paidShare),
    balanceAmount: sign * round2(Math.max(0, pathologyTotal - paidShare)),
    paymentMethod: invoice.paymentMethod,
    reportStatus: "pending_collection",
    irdSynced: invoice.irdSynced,
    cbmsResponseCode: invoice.cbmsResponseCode,
    isCreditNote: invoice.isCreditNote,
    linkedInvoiceId: invoice.linkedInvoiceId,
    linkedInvoiceNumber: invoice.linkedInvoiceNumber,
    hasCreditNote: invoice.hasCreditNote,
    createdAt: invoice.createdAt || invoice.invoiceDate,
    updatedAt: invoice.updatedAt || invoice.invoiceDate,
    createdBy: invoice.createdBy,
    sourceType: "billing-counter",
    sourceBillingId: invoice.id,
  };
}

/** Every counter invoice that carries lab lines, as pathology rows. */
export function counterLabInvoicesAsPathologyBillings(
  invoices: AppointmentBilling[],
): PathologyBilling[] {
  return invoices
    .filter((invoice) => invoice.status !== "cancelled")
    .map(labLinesAsPathologyBilling)
    .filter((row): row is PathologyBilling => row !== null);
}
