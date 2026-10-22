import type { MedicinePurchaseReturn } from "../../types/models";

/**
 * Billing Counter mixes two pricing conventions on one invoice: a
 * service/lab line's price is tax-EXCLUSIVE (VAT goes on top), a dispensed
 * medicine line's price is its MRP — tax-INCLUSIVE, same as pharmacy's own
 * sales — and VAT must be backed OUT of it instead. `calculateMixedTaxBreakdown`
 * is what actually bills the invoice correctly; `billingLineRate` below
 * just resolves which rate applies (a line's own override, or else the
 * invoice's), used by the reporting code that rebuilds a dispensed line's
 * VAT for display elsewhere.
 */
export function billingLineRate(
  invoice: { taxPercentage?: number },
  item: { isTaxable?: boolean; taxRate?: number },
): number {
  if (item.isTaxable !== true) return 0;

  return typeof item.taxRate === "number"
    ? item.taxRate
    : invoice.taxPercentage || 0;
}

export function vatOn(amount: number, rate: number): number {
  return Math.round(amount * rate) / 100;
}

export interface BillingCounterCreditNote {
  id: string;
  clinicId: string;
  branchId?: string;
  invoiceDate: Date;
  createdBy: string;
  creditNoteReason?: string;
  javaInvoiceId?: number;
  irdSynced?: boolean;
  cbmsResponseCode?: string;
  items?: Array<{ id: string; quantity?: number; amount?: number }>;
}

/**
 * A reversal through Billing Counter is a second appointmentBilling
 * document — the same lines with negated amounts but positive quantities,
 * status "finalized", paymentStatus "paid". Read as a sale it counted the
 * units again and its negative amount was clamped away, leaving a reversed
 * dispensing at full revenue. This turns the credit notes linked to one
 * original invoice into the returns pharmacy's own sales already carry, so
 * every net-after-returns figure handles both kinds the same way.
 */
export function creditNotesAsReturns(params: {
  invoice: { id: string };
  item: {
    id: string;
    appointmentTypeId: string;
    appointmentTypeName: string;
    amount?: number;
  };
  rate: number;
  creditNotes: BillingCounterCreditNote[];
}): { returns: MedicinePurchaseReturn[]; totalReturnedAmount: number } {
  const lineAmount = params.item.amount || 0;

  const returns = params.creditNotes.flatMap(
    (cn): MedicinePurchaseReturn[] => {
      const cnItem = (cn.items || []).find((i) => i.id === params.item.id);

      if (!cnItem) return [];

      // cnItem.amount is already the complete MRP-inclusive gross the
      // original dispensing-bill line charged, negated — not a pre-tax
      // base, so there is nothing to add on top of it (that was the same
      // double-counting bug calculateMixedTaxBreakdown fixes on the
      // invoice itself).
      const reversed = Math.abs(cnItem.amount || 0);
      const reversedGross = reversed;
      // A partial credit note scales amounts but keeps the original
      // quantity, so the units reversed come from the amount's share.
      const share = lineAmount > 0 ? Math.min(1, reversed / lineAmount) : 1;

      return [
        {
          id: cn.id,
          clinicId: cn.clinicId,
          branchId: cn.branchId || cn.clinicId,
          purchaseId: params.invoice.id,
          totalAmount: -reversedGross,
          notes: cn.creditNoteReason || "Credit note",
          items: [
            {
              id: cnItem.id,
              purchaseItemId: params.item.id,
              medicineId: params.item.appointmentTypeId,
              medicineName: params.item.appointmentTypeName,
              quantity: Math.round(Math.abs(cnItem.quantity || 0) * share),
              amount: -reversedGross,
            },
          ],
          createdAt: cn.invoiceDate,
          createdBy: cn.createdBy,
          javaInvoiceId: cn.javaInvoiceId,
          irdSynced: cn.irdSynced,
          cbmsResponseCode: cn.cbmsResponseCode,
        },
      ];
    },
  );

  return {
    returns,
    totalReturnedAmount: returns.reduce(
      (sum, r) => sum + Math.abs(r.totalAmount),
      0,
    ),
  };
}
