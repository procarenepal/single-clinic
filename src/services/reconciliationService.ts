import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "@/config/firebase";
import { billingApi, LedgerRecordDto } from "@/services/api/billingApi";
import { getNepaliFiscalYear } from "@/services/irdCbmsService";

/**
 * Compares the authoritative MySQL ledger (what IRD sees) against the
 * parallel Firestore copy every billing screen reads from.
 *
 * The diff is computed here rather than in Java deliberately: the backend
 * would otherwise have to learn that pharmacy calls its number purchaseNo
 * and its total netAmount, and that pharmacy returns live nested inside
 * their purchase document. That mapping belongs on this side, where it
 * already exists.
 */

export type ReconBucket =
  | "MATCHED_OK"
  | "SPLIT_ONLY_DIVERGENT"
  | "AMOUNT_DIVERGENT"
  | "STALE_CACHE"
  | "FIRESTORE_ONLY"
  | "MYSQL_ONLY";

export type ReconModule =
  | "appointment"
  | "pathology"
  | "pharmacy"
  | "pharmacy-return";

export interface ComparableDoc {
  module: ReconModule;
  docId: string;
  /** Invoice/receipt number as this module stores it. */
  number: string;
  date?: Date;
  total: number;
  taxable: number;
  tax: number;
  exempt: number;
  discount: number;
  irdSynced: boolean;
  javaInvoiceId?: number;
  /** A return/credit note — amounts are reversals and its tax is rounded. */
  isReturn: boolean;
  /** The source document, needed to build a filing proposal for an unfiled sale. */
  raw?: any;
}

export interface ReconRow {
  key: string;
  bucket: ReconBucket;
  invoiceNumber: string;
  module: ReconModule | "—";
  docId?: string;
  ledgerId?: number;
  date?: string;
  ledgerTotal?: number;
  localTotal?: number;
  ledgerSynced?: boolean;
  localSynced?: boolean;
  diffs: string[];
  /** Present on FIRESTORE_ONLY rows — the document a filing proposal is built from. */
  raw?: any;
}

export interface ReconSummary {
  counts: Record<ReconBucket, number>;
  ledgerCount: number;
  firestoreCount: number;
  rows: ReconRow[];
  generatedAt: Date;
}

const n = (v: any): number =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? 0
    : Math.round(Number(v) * 100) / 100;

const normNumber = (s: any): string => String(s ?? "").trim().toUpperCase();

const toDate = (v: any): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v.toDate === "function") return v.toDate();

  const d = new Date(v);

  return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * Normalise one Firestore billing document into the shape reconciliation
 * compares on. Pharmacy is the reason this exists: it names its number
 * purchaseNo and its total netAmount, where the other two modules use
 * invoiceNumber/totalAmount.
 */
export function toComparable(
  billingDoc: any,
  module: Exclude<ReconModule, "pharmacy-return">,
): ComparableDoc | null {
  const number = normNumber(billingDoc.invoiceNumber ?? billingDoc.purchaseNo);

  if (!number) return null;

  const total = n(billingDoc.totalAmount ?? billingDoc.netAmount);

  return {
    module,
    docId: billingDoc.id,
    number,
    date: toDate(
      billingDoc.invoiceDate ?? billingDoc.purchaseDate ?? billingDoc.createdAt,
    ),
    total,
    taxable: n(billingDoc.taxableAmount),
    tax: n(billingDoc.taxAmount),
    exempt: n(billingDoc.exemptAmount),
    discount: n(billingDoc.discountAmount ?? billingDoc.discount),
    irdSynced: Boolean(billingDoc.irdSynced),
    javaInvoiceId:
      typeof billingDoc.javaInvoiceId === "number"
        ? billingDoc.javaInvoiceId
        : undefined,
    isReturn: Boolean(billingDoc.isCreditNote) || total < 0,
    raw: billingDoc,
  };
}

/**
 * Pharmacy returns each get their own ledger row (negative amounts, "CN"
 * prefix) but are stored nested in the originating purchase's returns array
 * rather than as documents of their own. Without flattening them here, every
 * pharmacy return would show up as a phantom MYSQL_ONLY row.
 */
function returnsToComparables(purchase: any): ComparableDoc[] {
  const returns = Array.isArray(purchase.returns) ? purchase.returns : [];

  return returns
    .filter((r: any) => typeof r?.javaInvoiceId === "number")
    .map((r: any) => ({
      module: "pharmacy-return" as const,
      docId: purchase.id,
      number: normNumber(r.creditNoteNumber ?? ""),
      date: toDate(r.createdAt),
      total: -Math.abs(n(r.totalAmount)),
      taxable: 0,
      tax: 0,
      exempt: 0,
      discount: 0,
      irdSynced: Boolean(r.irdSynced),
      javaInvoiceId: r.javaInvoiceId as number,
      isReturn: true,
    }));
}

async function fetchCollection(name: string, clinicId: string): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, name), where("clinicId", "==", clinicId)),
  );

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchAllLedgerRows(
  fiscalYear?: string,
): Promise<LedgerRecordDto[]> {
  const rows: LedgerRecordDto[] = [];
  let page = 0;
  // Hard stop: a runaway loop against a paged endpoint is worse than an
  // incomplete report, which the operator can see and re-run.
  const MAX_PAGES = 50;

  while (page < MAX_PAGES) {
    const result = await billingApi.getReconciliation({
      fiscalYear,
      page,
      size: 200,
    });

    rows.push(...(result.content || []));
    if (page + 1 >= (result.totalPages ?? 1)) break;
    page += 1;
  }

  return rows;
}

export async function runReconciliation(
  clinicId: string,
  fiscalYear?: string,
): Promise<ReconSummary> {
  const [ledgerRows, appts, paths, purchases] = await Promise.all([
    fetchAllLedgerRows(fiscalYear),
    fetchCollection("appointmentBilling", clinicId),
    fetchCollection("pathologyBilling", clinicId),
    fetchCollection("medicinePurchases", clinicId),
  ]);

  const comparables: ComparableDoc[] = [];

  for (const d of appts) {
    const c = toComparable(d, "appointment");

    if (c) comparables.push(c);
  }
  for (const d of paths) {
    const c = toComparable(d, "pathology");

    if (c) comparables.push(c);
  }
  for (const d of purchases) {
    const c = toComparable(d, "pharmacy");

    if (c) comparables.push(c);
    comparables.push(...returnsToComparables(d));
  }

  const byJavaId = new Map<number, ComparableDoc>();
  const byNumber = new Map<string, ComparableDoc>();

  for (const c of comparables) {
    if (c.javaInvoiceId !== undefined) byJavaId.set(c.javaInvoiceId, c);
    if (c.number) byNumber.set(c.number, c);
  }

  const rows: ReconRow[] = [];
  const matchedDocs = new Set<ComparableDoc>();

  for (const led of ledgerRows) {
    const ledNum = normNumber(led.invoiceNumber);
    const local = byJavaId.get(led.id) ?? byNumber.get(ledNum);

    if (!local) {
      rows.push({
        key: "mysql:" + led.id,
        bucket: "MYSQL_ONLY",
        invoiceNumber: led.invoiceNumber,
        module: "—",
        ledgerId: led.id,
        date: led.invoiceDate,
        ledgerTotal: n(led.totalAmount),
        ledgerSynced: led.irdSynced,
        diffs: ["No Firestore document — the UI can never display this row"],
      });
      continue;
    }

    matchedDocs.add(local);

    // A return's tax is rounded to whole rupees on the Firestore side
    // (pharmacyService rounds returnTaxAmount) while MySQL keeps 2dp, so a
    // flat 0.01 epsilon would flag every credit note as divergent.
    const eps = local.isReturn ? 0.51 : 0.011;
    const diffs: string[] = [];

    const cmp = (label: string, a: number, b: number, tol: number) => {
      if (Math.abs(a - b) > tol) {
        diffs.push(label + ": " + a + " (ledger) vs " + b + " (app)");

        return true;
      }

      return false;
    };

    const totalBad = cmp("total", n(led.totalAmount), local.total, eps);
    const taxBad = cmp("tax", n(led.taxAmount), local.tax, eps);
    const taxableBad = cmp("taxable", n(led.taxableAmount), local.taxable, eps);
    const exemptBad = cmp("exempt", n(led.exemptAmount), local.exempt, eps);

    const staleCache = led.irdSynced && !local.irdSynced;

    if (staleCache) {
      diffs.push(
        "Ledger says filed with IRD, app still shows unsynced — the badge is stale, not the filing",
      );
    }

    let bucket: ReconBucket;

    if (!totalBad && !taxBad && (taxableBad || exemptBad)) {
      // Money collected and tax charged agree; only how the base was split
      // between taxable and exempt differs. This is the class that was filed
      // to IRD incorrectly without being a revenue discrepancy.
      bucket = "SPLIT_ONLY_DIVERGENT";
    } else if (totalBad || taxBad || taxableBad || exemptBad) {
      bucket = "AMOUNT_DIVERGENT";
    } else if (staleCache) {
      bucket = "STALE_CACHE";
    } else {
      bucket = "MATCHED_OK";
    }

    rows.push({
      key: "m:" + led.id,
      bucket,
      invoiceNumber: led.invoiceNumber,
      module: local.module,
      docId: local.docId,
      ledgerId: led.id,
      date: led.invoiceDate,
      ledgerTotal: n(led.totalAmount),
      localTotal: local.total,
      ledgerSynced: led.irdSynced,
      localSynced: local.irdSynced,
      diffs,
    });
  }

  for (const c of comparables) {
    if (matchedDocs.has(c)) continue;
    rows.push({
      key: "fs:" + c.module + ":" + c.docId + ":" + c.number,
      bucket: "FIRESTORE_ONLY",
      invoiceNumber: c.number,
      module: c.module,
      docId: c.docId,
      localTotal: c.total,
      localSynced: c.irdSynced,
      date: c.date ? c.date.toISOString().slice(0, 10) : undefined,
      raw: c.raw,
      diffs: [
        c.irdSynced
          ? "Shown as IRD-synced in the app but has NO ledger row — it was never actually filed"
          : "No ledger row — this sale was never filed with IRD",
      ],
    });
  }

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.bucket] += 1;

      return acc;
    },
    {
      MATCHED_OK: 0,
      SPLIT_ONLY_DIVERGENT: 0,
      AMOUNT_DIVERGENT: 0,
      STALE_CACHE: 0,
      FIRESTORE_ONLY: 0,
      MYSQL_ONLY: 0,
    } as Record<ReconBucket, number>,
  );

  return {
    counts,
    ledgerCount: ledgerRows.length,
    firestoreCount: comparables.length,
    rows,
    generatedAt: new Date(),
  };
}

/**
 * The line items as the ledger expects them. Each module names its item
 * fields differently, which is exactly the knowledge that belongs here
 * rather than in the backend.
 */
function toInvoiceItems(raw: any, module: ReconModule) {
  const items = Array.isArray(raw?.items) ? raw.items : [];

  return items.map((item: any) => {
    const quantity = Number(item.quantity) || 1;
    const amount = n(item.amount ?? item.price ?? 0);
    const name =
      module === "pharmacy"
        ? item.medicineName || item.productName || "Medicine"
        : module === "pathology"
          ? item.testName || "Test"
          : item.appointmentTypeName || item.serviceName || "Service";

    return {
      itemName: name,
      quantity,
      rate: quantity > 0 ? n(amount / quantity) : amount,
      totalAmount: amount,
      isTaxable:
        item.isTaxable === true || Number(item.taxRate ?? 0) > 0,
    };
  });
}

/**
 * Turn an unfiled sale from the report into the shape the filing proposal
 * needs. Returns null for anything that cannot be filed on its own (a
 * pharmacy return belongs to its purchase) or that is missing a number.
 */
export function toUnfiledSale(row: ReconRow, clinicId: string, fiscalYear?: string) {
  if (row.bucket !== "FIRESTORE_ONLY" || !row.raw || row.module === "pharmacy-return") {
    return null;
  }

  const raw = row.raw;
  const saleDate = toDate(raw.invoiceDate ?? raw.purchaseDate ?? raw.createdAt);
  // The fiscal year the sale actually fell in, derived from its own date —
  // filing it late must not move it into the current year.
  const resolvedFiscalYear =
    fiscalYear || (saleDate ? getNepaliFiscalYear(saleDate) : "");

  return {
    module: row.module,
    docId: row.docId as string,
    invoiceNumber: row.invoiceNumber,
    saleDate: saleDate ? saleDate.toISOString().slice(0, 10) : undefined,
    fiscalYear: resolvedFiscalYear,
    clinicId,
    patientName: raw.patientName,
    patientPanVat: raw.patientPanVat,
    totalAmount: n(raw.totalAmount ?? raw.netAmount),
    taxableAmount: n(raw.taxableAmount),
    taxAmount: n(raw.taxAmount),
    exemptAmount: n(raw.exemptAmount),
    discountAmount: n(raw.discountAmount ?? raw.discount),
    paymentMethod: raw.paymentMethod ?? raw.paymentType,
    items: toInvoiceItems(raw, row.module as ReconModule),
  };
}
