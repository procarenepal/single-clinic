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

interface AllocatedItem {
  isTaxable: boolean;
  taxRate: number;
  /** Net amount for this item after item-level AND pro-rata main discount —
   * NOT yet split into taxable/tax/exempt, since that split differs between
   * tax-exclusive and tax-inclusive pricing (see the two breakdown
   * functions below, which are the only two consumers of this). */
  netItemAmount: number;
}

interface AllocationResult {
  subtotal: number;
  itemDiscountAmount: number;
  mainDiscountAmount: number;
  totalDiscountAmount: number;
  items: AllocatedItem[];
}

/**
 * Shared first half of both pricing modes: per-item discount, then the
 * main invoice-level discount allocated pro-rata across every item (not
 * just a taxable/exempt bucket split) based on each item's share of the
 * post-item-discount subtotal. Identical between tax-exclusive and
 * tax-inclusive pricing — only how `netItemAmount` is subsequently split
 * into taxable/tax/exempt differs, which is why that split is NOT done
 * here (see `calculateTaxBreakdown` / `calculateTaxInclusiveBreakdown`).
 */
function allocateItemsWithProRataDiscount(
  input: TaxEngineCalculationInput,
): AllocationResult {
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

  // Step 3: Allocate the main discount pro-rata onto EACH item
  const allocatedItems: AllocatedItem[] = processedItems.map((item) => {
    const itemMainDiscountShare =
      netSubtotalAfterItemDiscounts > 0 && mainDiscount > 0
        ? mainDiscount * (item.netBeforeMainDiscount / netSubtotalAfterItemDiscounts)
        : 0;
    const netItemAmount = Math.max(0, item.netBeforeMainDiscount - itemMainDiscountShare);

    return { isTaxable: item.isTaxable, taxRate: item.taxRate, netItemAmount };
  });

  return {
    subtotal: Math.round(grossSubtotal * 100) / 100,
    itemDiscountAmount: Math.round(totalItemDiscount * 100) / 100,
    mainDiscountAmount: Math.round(mainDiscount * 100) / 100,
    totalDiscountAmount: Math.round((totalItemDiscount + mainDiscount) * 100) / 100,
    items: allocatedItems,
  };
}

/**
 * Calculate complete invoice financial breakdown with pro-rata discount
 * allocation — TAX-EXCLUSIVE pricing (unit price does NOT include VAT; VAT
 * is added on top). This is the convention for appointment and pathology
 * billing. For pharmacy's MRP-inclusive convention, see
 * `calculateTaxInclusiveBreakdown` below.
 */
export function calculateTaxBreakdown(input: TaxEngineCalculationInput): TaxEngineResult {
  const { subtotal, itemDiscountAmount, mainDiscountAmount, totalDiscountAmount, items } =
    allocateItemsWithProRataDiscount(input);

  // Compute VAT per item at that item's OWN clamped tax rate and sum —
  // items can carry genuinely different rates (e.g. a 13% service alongside
  // a 0%/exempt one), so a single blended rate over the whole invoice would
  // be wrong whenever rates differ across items.
  let netTaxableSales = 0;
  let netExemptSales = 0;
  let vatAmount = 0;

  items.forEach((item) => {
    if (item.isTaxable) {
      netTaxableSales += item.netItemAmount;
      vatAmount += item.netItemAmount * (item.taxRate / 100);
    } else {
      netExemptSales += item.netItemAmount;
    }
  });

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

/**
 * Calculate complete invoice financial breakdown with pro-rata discount
 * allocation — TAX-INCLUSIVE pricing (unit price, e.g. MRP, already
 * includes VAT; the taxable base is backed OUT of it instead of VAT being
 * added on top). This is Nepal's pharmacy-goods convention. A taxable
 * item's post-discount amount is split as
 * `taxable = netItemAmount / (1 + rate/100)`, `tax = netItemAmount - taxable`;
 * an exempt (rate 0 or isTaxable false) item's full post-discount amount
 * goes to `exemptAmount` untouched — never folded into `taxableAmount`,
 * which was a real bug fixed earlier (an exempt medicine's price was
 * being counted as part of the taxable base).
 */
export function calculateTaxInclusiveBreakdown(
  input: TaxEngineCalculationInput,
): TaxEngineResult {
  const { subtotal, itemDiscountAmount, mainDiscountAmount, totalDiscountAmount, items } =
    allocateItemsWithProRataDiscount(input);

  let netTaxableSales = 0;
  let netExemptSales = 0;
  let vatAmount = 0;

  items.forEach((item) => {
    if (item.isTaxable && item.taxRate > 0) {
      const itemTaxable = item.netItemAmount / (1 + item.taxRate / 100);

      netTaxableSales += itemTaxable;
      vatAmount += item.netItemAmount - itemTaxable;
    } else {
      netExemptSales += item.netItemAmount;
    }
  });

  const taxableAmount = Math.round(Math.max(0, netTaxableSales) * 100) / 100;
  const taxAmount = Math.round(Math.max(0, vatAmount) * 100) / 100;
  const exemptAmount = Math.round(Math.max(0, netExemptSales) * 100) / 100;
  // Note: for inclusive pricing, totalAmount reconstructs to the same
  // post-discount gross the items already summed to (taxable + tax is
  // just the taxable item's own netItemAmount split two ways) — this is
  // expected, unlike exclusive mode where tax is genuinely additional.
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

/**
 * Low-level single-unit helper for tax-inclusive pricing — backs VAT out
 * of one already-discounted, tax-inclusive gross amount. Exists so a
 * live per-line UI preview (e.g. pharmacy's purchase form, showing tax for
 * one row as the user types) can use the EXACT same math as
 * `calculateTaxInclusiveBreakdown` without re-deriving it, which is how
 * two independently-maintained (and independently buggy) copies of this
 * calculation existed before.
 */
export function calculateInclusiveUnitBreakdown(
  grossAmount: number,
  taxRate: number,
): { taxableAmount: number; taxAmount: number } {
  const gross = Math.max(0, grossAmount || 0);
  const rate = Math.min(100, Math.max(0, taxRate || 0));

  if (rate <= 0) {
    return { taxableAmount: 0, taxAmount: 0 };
  }

  const taxable = gross / (1 + rate / 100);
  const tax = gross - taxable;

  return {
    taxableAmount: Math.round(taxable * 100) / 100,
    taxAmount: Math.round(tax * 100) / 100,
  };
}
