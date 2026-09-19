/**
 * Centralized Tax & VAT Calculation Engine
 * Compliant with Nepal Inland Revenue Department (IRD) CBMS specifications.
 */

export interface TaxEngineItemInput {
  id?: string;
  itemName: string;
  quantity: number;
  price: number; // Unit price
  discountType?: "flat" | "percent";
  discountValue?: number;
  isTaxable?: boolean; // Default false for exempt medical services, true for taxable goods
  taxRate?: number; // VAT rate, e.g., 13
}

export interface TaxEngineCalculationInput {
  items: TaxEngineItemInput[];
  discountType?: "flat" | "percent"; // Main invoice discount type
  discountValue?: number; // Main invoice discount value
  defaultTaxPercentage?: number; // Default 13% for taxable items
  isTaxEnabled?: boolean; // Overall clinic tax setting flag
}

export interface TaxEngineResult {
  subtotal: number; // Gross items subtotal before item discounts
  itemDiscountAmount: number; // Total item-level discounts
  mainDiscountAmount: number; // Total main invoice-level discount
  totalDiscountAmount: number; // Total combined discount (item + main)
  taxableAmount: number; // Net sales value of taxable items after pro-rata discount
  taxAmount: number; // 13% VAT calculated on net taxable sales
  exemptAmount: number; // Net sales value of tax-exempt items after pro-rata discount
  totalAmount: number; // Final payable grand total (taxable + exempt + VAT)
}

/**
 * Calculate complete invoice financial breakdown with pro-rata discount allocation
 */
export function calculateTaxBreakdown(input: TaxEngineCalculationInput): TaxEngineResult {
  const {
    items = [],
    discountType = "flat",
    discountValue = 0,
    defaultTaxPercentage = 13,
    isTaxEnabled = true,
  } = input;

  let grossSubtotal = 0;
  let totalItemDiscount = 0;

  // Step 1: Evaluate item-level subtotals & item-level discounts
  const processedItems = items.map((item) => {
    const qty = Math.max(1, item.quantity || 1);
    const unitPrice = Math.max(0, item.price || 0);
    const itemGross = qty * unitPrice;

    let itemDisc = 0;
    const dVal = item.discountValue || 0;
    const dType = item.discountType || "percent";

    if (dType === "percent") {
      itemDisc = (itemGross * dVal) / 100;
    } else {
      itemDisc = Math.min(dVal, itemGross);
    }
    itemDisc = Math.max(0, itemDisc);

    const itemNet = Math.max(0, itemGross - itemDisc);
    const itemIsTaxable = isTaxEnabled && Boolean(item.isTaxable);

    grossSubtotal += itemGross;
    totalItemDiscount += itemDisc;

    return {
      ...item,
      quantity: qty,
      price: unitPrice,
      gross: itemGross,
      itemDiscount: itemDisc,
      netBeforeMainDiscount: itemNet,
      isTaxable: itemIsTaxable,
      // Clamped defense-in-depth: settings validation should already
      // reject an out-of-range tax percentage before it's saved, but a
      // negative/absurd rate reaching this engine (e.g. legacy data,
      // an untrusted per-item override) must not produce a negative or
      // wildly inflated tax amount.
      taxRate: Math.min(100, Math.max(0, item.taxRate ?? defaultTaxPercentage)),
    };
  });

  // Step 2: Calculate main invoice-level discount
  const netSubtotalAfterItemDiscounts = Math.max(0, grossSubtotal - totalItemDiscount);
  let mainDiscount = 0;

  if (discountType === "percent") {
    mainDiscount = (netSubtotalAfterItemDiscounts * (discountValue || 0)) / 100;
  } else {
    mainDiscount = Math.min(discountValue || 0, netSubtotalAfterItemDiscounts);
  }
  mainDiscount = Math.max(0, mainDiscount);

  // Step 3-5: Allocate the main discount pro-rata onto EACH item (not just
  // a taxable/exempt bucket split), then compute VAT per item at that
  // item's OWN clamped tax rate and sum — items can carry genuinely
  // different rates (e.g. a 13% service alongside a 0%/exempt one), so a
  // single blended rate over the whole invoice would be wrong whenever
  // rates differ across items.
  let netTaxableSales = 0;
  let netExemptSales = 0;
  let vatAmount = 0;

  processedItems.forEach((item) => {
    const itemMainDiscountShare =
      netSubtotalAfterItemDiscounts > 0 && mainDiscount > 0
        ? mainDiscount * (item.netBeforeMainDiscount / netSubtotalAfterItemDiscounts)
        : 0;
    const netItemAmount = Math.max(0, item.netBeforeMainDiscount - itemMainDiscountShare);

    if (item.isTaxable && isTaxEnabled) {
      netTaxableSales += netItemAmount;
      vatAmount += netItemAmount * (item.taxRate / 100);
    } else {
      netExemptSales += netItemAmount;
    }
  });

  // Round currency outputs to 2 decimal places cleanly
  const subtotal = Math.round(grossSubtotal * 100) / 100;
  const itemDiscountAmount = Math.round(totalItemDiscount * 100) / 100;
  const mainDiscountAmount = Math.round(mainDiscount * 100) / 100;
  const totalDiscountAmount = Math.round((itemDiscountAmount + mainDiscountAmount) * 100) / 100;

  const taxableAmount = Math.round(netTaxableSales * 100) / 100;
  const taxAmount = Math.round(vatAmount * 100) / 100;
  const exemptAmount = Math.round(netExemptSales * 100) / 100;
  const totalAmount = Math.round((taxableAmount + exemptAmount + taxAmount) * 100) / 100;

  return {
    subtotal,
    itemDiscountAmount,
    mainDiscountAmount,
    totalDiscountAmount,
    taxableAmount,
    taxAmount,
    exemptAmount,
    totalAmount,
  };
}
