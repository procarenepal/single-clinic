import { calculateInclusiveUnitBreakdown } from "../../utils/taxEngine";

export interface ReturnTaxOriginalLine {
  id: string;
  taxRate?: number;
  hsCode?: string;
}

export interface ReturnTaxReturnLine {
  purchaseItemId: string;
  medicineName?: string;
  quantity: number;
  /** Signed or unsigned — only its magnitude is used. */
  amount: number;
}

export interface ReturnTaxLine {
  purchaseItemId: string;
  itemName: string;
  quantity: number;
  gross: number;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  hsCode?: string;
}

export interface ReturnTaxSplit {
  lines: ReturnTaxLine[];
  taxableAmount: number;
  taxAmount: number;
  exemptAmount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Splits a pharmacy sales return into taxable / VAT / exempt the same way
 * the original sale was split: per line, at that line's own rate, backing
 * VAT out of the MRP-inclusive refund amount. A return of only the
 * VAT-exempt medicine from a mixed cart therefore reverses no VAT at all,
 * and a return of only the 13% medicine reverses the full 13% — which a
 * single ratio blended across the whole original cart got wrong both ways.
 *
 * The rate and HS code come from the original purchase line, since the
 * return itself never carried them.
 */
export function computeReturnTaxSplit(params: {
  originalItems: ReturnTaxOriginalLine[];
  purchaseTaxPercentage: number;
  returnItems: ReturnTaxReturnLine[];
}): ReturnTaxSplit {
  const originalById = new Map(params.originalItems.map((i) => [i.id, i]));
  const fallbackRate = params.purchaseTaxPercentage || 0;

  let taxable = 0;
  let tax = 0;
  let exempt = 0;

  const lines = params.returnItems.map((item): ReturnTaxLine => {
    const original = originalById.get(item.purchaseItemId);
    const taxRate =
      typeof original?.taxRate === "number" ? original.taxRate : fallbackRate;
    const gross = Math.abs(item.amount || 0);
    const unit = calculateInclusiveUnitBreakdown(gross, taxRate);

    if (taxRate > 0) {
      taxable += unit.taxableAmount;
      tax += unit.taxAmount;
    } else {
      exempt += gross;
    }

    return {
      purchaseItemId: item.purchaseItemId,
      itemName: item.medicineName || "Return Item",
      quantity: Math.abs(item.quantity || 0),
      gross,
      taxRate,
      taxableAmount: unit.taxableAmount,
      taxAmount: unit.taxAmount,
      ...(original?.hsCode ? { hsCode: original.hsCode } : {}),
    };
  });

  return {
    lines,
    taxableAmount: round2(taxable),
    taxAmount: round2(tax),
    exemptAmount: round2(exempt),
  };
}
