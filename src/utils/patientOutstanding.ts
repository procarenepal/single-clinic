/**
 * Cross-module outstanding-balance lookup for a single patient, used to warn
 * front-desk staff of existing dues while they're creating a NEW invoice —
 * before the transaction that would trigger the "any data is frozen once
 * finalized/synced" IRD compliance guard. Read-only; never writes anything.
 *
 * Mirrors the exact due-calculation logic already used by the Unified
 * Patient Billing Summary (`PatientBillingTab.tsx`) so the numbers shown
 * here always agree with that page.
 */
import type { MedicinePurchase } from "@/types/models";

import { appointmentBillingService } from "@/services/appointmentBillingService";
import { pathologyBillingService } from "@/services/pathologyBillingService";
import { pharmacyService } from "@/services/pharmacyService";

export interface PatientOutstandingSummary {
  total: number;
  appointmentDue: number;
  pathologyDue: number;
  pharmacyDue: number;
  recordCount: number;
}

// Pharmacy stores no balanceAmount field — derive it the same way
// purchase-detail.tsx / PatientBillingTab.tsx do (return-adjusted net minus
// payments made).
const getPharmacyDue = (purchase: MedicinePurchase): number => {
  const totalReturnedAmount =
    typeof purchase.totalReturnedAmount === "number" &&
    purchase.totalReturnedAmount > 0
      ? purchase.totalReturnedAmount
      : (purchase.returns ?? []).reduce(
          (sum, r) => sum + Math.abs(r.totalAmount || 0),
          0,
        );
  const netAfterReturns = Math.max(
    0,
    (purchase.netAmount || 0) - totalReturnedAmount,
  );
  const paidAmount = Math.round(
    (purchase.paymentHistory || []).reduce((s, p) => s + p.amount, 0),
  );

  return Math.max(0, netAfterReturns - paidAmount);
};

interface InvoiceLike {
  id: string;
  invoiceNumber?: string;
  status?: string;
  balanceAmount?: number;
  totalAmount?: number;
  isCreditNote?: boolean;
  linkedInvoiceNumber?: string;
}

/**
 * What is still owed on each invoice in the list, after netting the
 * credit notes that reverse it. A credit note — full or partial — is its
 * own negative invoice linked to the original by id/number. The original
 * is immutable once filed with IRD, so its stored balanceAmount never
 * changes; the receivable it represents does. (A flag like hasCreditNote
 * cannot carry this: a partial credit note sets it too, and the rest of
 * the balance is still owed.)
 */
const invoiceDues = (list: readonly InvoiceLike[]): number[] => {
  const reversed = new Map<string, number>();

  for (const b of list) {
    if (!b.isCreditNote) continue;
    const key =
      (b as { linkedInvoiceId?: string }).linkedInvoiceId ||
      b.linkedInvoiceNumber;

    if (key) {
      reversed.set(
        key,
        (reversed.get(key) || 0) + Math.abs(b.totalAmount || 0),
      );
    }
  }

  return list
    .filter((b) => b.status !== "cancelled" && !b.isCreditNote)
    .map((b) =>
      Math.max(
        0,
        (b.balanceAmount || 0) -
          (reversed.get(b.id) || 0) -
          (reversed.get(b.invoiceNumber || "") || 0),
      ),
    )
    .filter((due) => due >= 0.005);
};

export async function getPatientOutstandingSummary(
  patientId: string,
  clinicId: string,
): Promise<PatientOutstandingSummary> {
  // A failed lookup throws. Callers that only want a warning catch it;
  // the one caller that must not guess (patientService.deletePatient)
  // refuses on it. Silently reading "nothing owed" off a failed query was
  // how a delete could proceed past dues it never saw.
  const [appointmentBillings, pathologyBillings, pharmacyPurchases] =
    await Promise.all([
      appointmentBillingService.getBillingByPatient(patientId, clinicId),
      pathologyBillingService.getBillingByPatient(patientId, clinicId),
      pharmacyService.getMedicinePurchasesByPatient(patientId, clinicId),
    ]);

  const appointmentDues = invoiceDues(appointmentBillings);
  const pathologyDues = invoiceDues(pathologyBillings);
  const pharmacyDuesByPurchase = pharmacyPurchases
    .map((p) => getPharmacyDue(p))
    .filter((due) => due > 0);

  const appointmentDue = appointmentDues.reduce((s, due) => s + due, 0);
  const pathologyDue = pathologyDues.reduce((s, due) => s + due, 0);
  const pharmacyDue = pharmacyDuesByPurchase.reduce((s, due) => s + due, 0);

  return {
    total: appointmentDue + pathologyDue + pharmacyDue,
    appointmentDue,
    pathologyDue,
    pharmacyDue,
    recordCount:
      appointmentDues.length +
      pathologyDues.length +
      pharmacyDuesByPurchase.length,
  };
}
