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

export async function getPatientOutstandingSummary(
  patientId: string,
  clinicId: string,
): Promise<PatientOutstandingSummary> {
  const [appointmentBillings, pathologyBillings, pharmacyPurchases] =
    await Promise.all([
      appointmentBillingService
        .getBillingByPatient(patientId, clinicId)
        .catch(() => []),
      pathologyBillingService
        .getBillingByPatient(patientId, clinicId)
        .catch(() => []),
      pharmacyService
        .getMedicinePurchasesByPatient(patientId, clinicId)
        .catch(() => []),
    ]);

  const outstandingAppointments = appointmentBillings.filter(
    (b) => b.balanceAmount > 0 && b.status !== "cancelled",
  );
  const outstandingPathology = pathologyBillings.filter(
    (b) => b.balanceAmount > 0 && b.status !== "cancelled",
  );
  const pharmacyDuesByPurchase = pharmacyPurchases
    .map((p) => getPharmacyDue(p))
    .filter((due) => due > 0);

  const appointmentDue = outstandingAppointments.reduce(
    (s, b) => s + b.balanceAmount,
    0,
  );
  const pathologyDue = outstandingPathology.reduce(
    (s, b) => s + b.balanceAmount,
    0,
  );
  const pharmacyDue = pharmacyDuesByPurchase.reduce((s, due) => s + due, 0);

  return {
    total: appointmentDue + pathologyDue + pharmacyDue,
    appointmentDue,
    pathologyDue,
    pharmacyDue,
    recordCount:
      outstandingAppointments.length +
      outstandingPathology.length +
      pharmacyDuesByPurchase.length,
  };
}
