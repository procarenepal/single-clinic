import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
  getPrintFontsLinkHTML,
} from "./printBranding";

import { PathologyBilling, AppointmentBilling } from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import { numberToWords } from "./numberToWords";
import { adToBS } from "./dateConverter";

export type PrintFormat =
  | "A4"
  | "A4_HALF"
  | "THERMAL_80MM"
  | "THERMAL_58MM"
  | "THERMAL_4INCH";

export interface UnifiedInvoiceItem {
  name: string;
  subtext?: string;
  quantity: number;
  price?: number;
  amount: number;
}

export interface UnifiedInvoice {
  invoiceType: 'pathology' | 'appointment' | 'pharmacy';
  invoiceNumber: string;
  invoiceDate: Date | string;
  patientName: string;
  patientPanVat?: string;
  patientPhone?: string;
  patientAddress?: string;
  buyerPan?: string;
  subtotal: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxPercentage?: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount: number;
  previousDuePaidAmount?: number;
  balanceAmount: number;
  irdSynced?: boolean;
  // Required on the printed invoice by IRD's Electronic Billing Procedure, Schedule 6.
  paymentMethod?: string;
  items: UnifiedInvoiceItem[];
  cliniciansHtml?: string;
  // Credit Note (sales return) marking — must be visually distinct from a
  // normal tax invoice, per IRD's cancellation/return provisions.
  isCreditNote?: boolean;
  creditNoteNote?: string;
  // A cancelled invoice must never print looking like a valid, unmarked tax
  // document — same visual-distinction requirement as Credit Note above.
  isCancelled?: boolean;
  cancelledNote?: string;
}

const formatCurrency = (amount: number) => `NPR ${amount.toLocaleString()}`;

/**
 * IRD's Electronic Billing Procedure, Schedule 6, defines three invoice
 * title variants: for VAT-registered clinics, the full "Tax Invoice" (has a
 * VAT line) or "Abbreviated Tax Invoice" (no VAT line — this specific bill
 * has no taxable amount); for a clinic that is NOT VAT-registered
 * (income-tax-only), a plain "Invoice" with no Taxable Amount/VAT rows at
 * all. Shared so both invoicePrinting.ts and pharmacy's print template stay
 * in sync on which title a given bill should carry.
 */
export const getIrdInvoiceTitle = (
  taxAmount?: number,
  isVatRegistered: boolean = true,
): string => {
  if (!isVatRegistered) return "बिल (INVOICE)";
  return (taxAmount || 0) > 0
    ? "कर बिजक (TAX INVOICE)"
    : "संक्षिप्त कर बिजक (ABBREVIATED TAX INVOICE)";
};

/**
 * "Taxable Amount" is a required row on both Tax Invoice and Abbreviated Tax
 * Invoice per Schedule 6 — it must show even when 0 for a fully exempt sale,
 * never be omitted. Only the VAT % line disappears for non-taxable bills.
 */
export const getIrdTaxableAmount = (
  taxAmount: number | undefined,
  taxableAmount: number | undefined,
  fallbackBase: number,
): number => {
  if (typeof taxableAmount === "number") return taxableAmount;
  return (taxAmount || 0) > 0 ? fallbackBase : 0;
};

// Payment method values are stored as machine keys (e.g. "mobile_banking",
// "bank_transfer") — humanize for the printed "Method of Payment" line.
export const formatPaymentMethod = (method?: string): string => {
  if (!method) return "Cash";
  return method
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * IRD's Electronic Billing Procedure, Schedule 6, requires the printed
 * "Method of Payment" line to be exactly one of Cash / Cheque / Creditor /
 * Other — a narrower set than the clinic's actual configurable payment
 * methods (card, mobile banking, bank transfer, etc). Maps into that
 * required category for the legal document while keeping the clinic's own
 * detail visible alongside it (e.g. "Other (Mobile Banking)").
 */
export const getIrdPaymentCategory = (
  method: string | undefined,
  balanceAmount: number | undefined,
): "Cash" | "Cheque" | "Creditor" | "Other" => {
  const m = (method || "").toLowerCase();

  if (m.includes("cheque") || m.includes("check")) return "Cheque";
  if (m.includes("cash")) return "Cash";
  if (method) return "Other";
  // No method was actually recorded — this is the only case "Creditor" is a
  // reasonable inference (payment genuinely outstanding, nothing collected).
  // A method being selected but payment not yet marked complete (this app
  // records payment as a separate step after invoice creation) must NOT be
  // read as a credit sale — that would mislabel almost every fresh invoice.
  return (balanceAmount || 0) > 0 ? "Creditor" : "Cash";
};

const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// IRD's invoice date fields are expected in both AD and BS (Nepali calendar).
const formatDateWithBS = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return `${formatDate(d)} (BS ${adToBS(d).formatted})`;
  } catch {
    return formatDate(d);
  }
};

/**
 * Core engine for generating unified HTML invoice layouts.
 */
export const generateUnifiedInvoiceHTML = (
  invoice: UnifiedInvoice,
  format: PrintFormat,
  clinic: any,
  layoutConfig: any,
  // 0 = original; N = the Nth reprint — IRD requires reprints to be marked
  // "Copy of Original – 1, 2, 3…", not just a generic "copy" label.
  copyNumber: number = 0,
  printedBy: string = ""
): string => {
  const isThermal =
    format === "THERMAL_80MM" ||
    format === "THERMAL_58MM" ||
    format === "THERMAL_4INCH";

  let thermalWidth = "80mm";
  if (format === "THERMAL_80MM") thermalWidth = "80mm";
  else if (format === "THERMAL_58MM") thermalWidth = "58mm";
  else if (format === "THERMAL_4INCH") thermalWidth = "104mm";
  else if (isThermal && layoutConfig?.thermalPaperWidthMm) {
    thermalWidth = `${layoutConfig.thermalPaperWidthMm}mm`;
  }

  const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig, isThermal) : "";
  const headerHTML = layoutConfig ? getPrintHeaderHTML(layoutConfig, clinic, isThermal) : "";
  // Defaults to VAT-registered (existing behavior) — CBMS is fundamentally
  // a VAT-context system, so only an explicit `false` opts a clinic out.
  const isVatRegistered = clinic?.isVatRegistered !== false;

  // Footer text depends on the invoice type
  let footerType: "pathology" | "appointment" | "pharmacy" = invoice.invoiceType;
  let footerHTML = layoutConfig ? getPrintFooterHTML(layoutConfig, footerType as any) : "";

  const itemsHtml = invoice.items
    .map(
      (item, index) =>
        `<tr>
          <td class="text-center" style="text-align: center;">${index + 1}</td>
          <td style="text-align: ${isThermal ? 'center' : 'left'};">
            <div style="font-weight: 500;">${item.name}</div>
            ${item.subtext ? `<div style="font-size: ${isThermal ? '0.9em' : '10px'}; color: #000000; font-weight: 600; margin-top: 2px;">${item.subtext}</div>` : ''}
          </td>
          <td class="text-center" style="text-align: center; white-space: nowrap;">${item.quantity}</td>
          ${!isThermal ? `<td class="text-center" style="text-align: center; white-space: nowrap;">${item.price !== undefined ? formatCurrency(item.price) : '-'}</td>` : ""}
          <td class="text-center" style="text-align: center; white-space: nowrap;">${formatCurrency(item.amount)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  ${layoutConfig ? getPrintFontsLinkHTML() : ""}
  <title>Invoice - ${invoice.invoiceNumber}</title>
  <style>
    @page {
      ${format === "A4_HALF" ? "size: A5 landscape; margin: 0;" : format === "A4" ? "size: A4; margin: 0;" : `size: ${thermalWidth} auto; margin: 0;`}
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      -webkit-print-color-adjust: exact;
      width: 100%;
    }
    body {
      font-family: ${layoutConfig?.fontFamily || "'Nunito', 'Plus Jakarta Sans', 'Inter', system-ui, Arial, sans-serif"};
      color: ${layoutConfig?.textColor || "#333"};
      font-size: ${isThermal ? "9px" : layoutConfig?.contentFontSize ? `${layoutConfig.contentFontSize}px` : "12px"};
      line-height: 1.3;
    }
    .print-container {
      width: ${isThermal ? thermalWidth : "100%"};
      margin: 0 auto;
      background: white;
      display: flex;
      flex-direction: column;
      min-height: auto;
      padding: ${isThermal ? "2mm" : "5mm 8mm"};
      box-sizing: border-box;
    }
    
    ${brandingCSS}

    .content {
      flex: 1;
      padding: ${isThermal ? "2mm 0" : "4mm 6mm"};
      min-height: 0;
    }
    .document-title {
      text-align: center;
      margin: 2px 0 4px 0;
    }
    .document-title h2 {
      font-size: 15px;
      font-weight: 800;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #000000;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${isThermal ? "8px" : "10px"};
    }
    .items-table th,
    .items-table td {
      border: 1px solid #e2e8f0;
      padding: ${isThermal ? "4px 4px" : "6px 8px"};
      font-size: ${isThermal ? "1em" : "13px"};
      color: #000000;
    }
    .items-table th {
      background-color: #f1f5f9;
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      font-size: ${isThermal ? "0.85em" : "12px"};
      letter-spacing: 0.05em;
      color: #000000;
    }
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 6px;
    }
    .summary-table { width: ${isThermal ? '100%' : '340px'}; min-width: ${isThermal ? '100%' : '340px'}; border-collapse: collapse; }
    .summary-table td {
      padding: ${isThermal ? "3px 4px" : "4px 8px"};
      border-bottom: 1px solid #f1f5f9;
      font-size: ${isThermal ? "1em" : "13px"};
      color: #000000;
      white-space: nowrap;
    }
    .summary-table td:first-child { padding-right: 20px; }
    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }
    .font-bold { font-weight: 700; color: #000000; }

    @media screen {
      body {
        background-color: #f1f5f9;
        display: flex;
        justify-content: center;
        padding: 40px 20px;
      }
      .print-container {
        width: ${isThermal ? thermalWidth : "210mm"};
        min-height: ${isThermal ? "auto" : "297mm"};
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border-radius: 8px;
        position: relative;
      }
      .print-container::before {
        content: "PRINT PREVIEW";
        position: absolute;
        top: -25px;
        left: 0;
        font-size: 10px;
        font-weight: 800;
        color: #94a3b8;
        letter-spacing: 0.1em;
      }
    }

    @media print {
      body { 
        -webkit-print-color-adjust: exact;
        background: white !important;
        padding: 0 !important;
      }
      .print-container {
        box-shadow: none !important;
        width: 100% !important;
        margin: 0 !important;
        padding: ${isThermal ? "2mm" : "10mm"} !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${headerHTML}
    ${copyNumber > 0 ? `<div style="text-align: center; font-weight: bold; font-size: 13px; margin-top: 4px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">[ COPY OF ORIGINAL &ndash; ${copyNumber} ]</div>` : ""}
    
    <div class="content">
      <div class="document-title">
        ${invoice.isCreditNote ? `<div style="text-align: center; font-weight: 800; font-size: 15px; color: #b91c1c; letter-spacing: 0.05em; border: 2px solid #b91c1c; padding: 4px 0; margin-bottom: 6px;">मूल्य फिर्ता बिजक (CREDIT NOTE / SALES RETURN)</div>` : ""}
        ${invoice.isCancelled ? `<div style="text-align: center; font-weight: 800; font-size: 15px; color: #b91c1c; letter-spacing: 0.05em; border: 2px solid #b91c1c; padding: 4px 0; margin-bottom: 6px;">रद्द गरिएको बिजक (CANCELLED — NOT A VALID TAX DOCUMENT)</div>` : ""}
        <h2>${getIrdInvoiceTitle(invoice.taxAmount, isVatRegistered)}</h2>
        ${invoice.isCreditNote && invoice.creditNoteNote ? `<div style="font-size: 11px; color: #b91c1c; font-weight: 600; margin-top: 6px; text-align: center;">${invoice.creditNoteNote}</div>` : ""}
        ${invoice.isCancelled && invoice.cancelledNote ? `<div style="font-size: 11px; color: #b91c1c; font-weight: 600; margin-top: 6px; text-align: center;">${invoice.cancelledNote}</div>` : ""}
      </div>

      <div style="border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: ${isThermal ? "6px 0" : "8px 0"}; margin: 10px 0;">
        <div style="display: flex; flex-direction: ${isThermal ? "column" : "row"}; justify-content: space-between; align-items: baseline; width: 100%; gap: ${isThermal ? "1px" : "16px"}; font-size: 13px; color: #000000; margin-bottom: ${isThermal ? "6px" : "8px"};">
          <span style="font-weight: 700; color: #000000; white-space: nowrap; flex-shrink: 0;"># ${invoice.invoiceNumber}</span>
          <span style="text-align: ${isThermal ? "left" : "right"};">Transaction Date: ${formatDateWithBS(invoice.invoiceDate)}${isThermal ? "" : " &nbsp;|&nbsp; "}${isThermal ? "<br/>" : ""}Invoice Issue Date: ${formatDateWithBS(invoice.invoiceDate)}</span>
        </div>
        ${(() => {
          const lbl = `padding: 1px 0; color: #000000; text-transform: uppercase; font-size: 12px; letter-spacing: 0.03em; vertical-align: top; white-space: nowrap;`;
          const val = `padding: 1px 8px 1px 0; font-weight: 600; vertical-align: top;`;
          const patientName =
            invoice.patientName && invoice.patientName !== "Unknown Patient"
              ? invoice.patientName
              : "Unknown Patient";
          const paymentCategory = getIrdPaymentCategory(invoice.paymentMethod, invoice.balanceAmount);
          const paymentDetail = formatPaymentMethod(invoice.paymentMethod);
          // Only show the parenthetical detail when it adds real information
          // — a method was actually recorded, and it says something beyond
          // what the category already states (e.g. skip "Cash (Cash)").
          const paymentLine =
            invoice.paymentMethod && paymentDetail !== paymentCategory
              ? `${paymentCategory} (${paymentDetail})`
              : paymentCategory;

          // Left column is always present (required fields). On the right,
          // Address is also a fixed Schedule 6 field slot — like Purchaser's
          // PAN, it always renders (with a "-" fallback) rather than
          // disappearing when blank; Phone is not schedule-required, so it's
          // only shown when there's actually a value.
          const leftRows = [
            ["Bill To", patientName],
            ["PAN", invoice.buyerPan || invoice.patientPanVat || "-"],
            ["Payment", paymentLine],
          ];
          // Address first so it lands on a fixed row position regardless of
          // whether the optional Phone row is present.
          const rightRows = [
            ["Address", invoice.patientAddress || "-"],
            invoice.patientPhone ? ["Phone", invoice.patientPhone] : null,
          ].filter(Boolean) as [string, string][];

          if (isThermal) {
            const allRows = [...leftRows, ...rightRows];
            return `<table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #000000;">
              ${allRows.map(([label, value]) => `<tr><td style="width: 70px; ${lbl}">${label}</td><td style="${val}">${value}</td></tr>`).join("")}
            </table>`;
          }

          const rowCount = Math.max(leftRows.length, rightRows.length);
          const bodyRows = Array.from({ length: rowCount }, (_, i) => {
            const [ll, lv] = leftRows[i] || ["", ""];
            const [rl, rv] = rightRows[i] || ["", ""];

            return `<tr>
              <td style="width: 78px; ${lbl}">${ll}</td>
              <td style="width: 40%; ${val}">${lv}</td>
              <td style="width: 65px; ${lbl}">${rl}</td>
              <td style="${val}">${rv}</td>
            </tr>`;
          }).join("");

          return `<table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #000000;">${bodyRows}</table>`;
        })()}
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">S.N.</th>
            <th style="text-align: center;">Item / Service</th>
            <th style="width: 50px; text-align: center; white-space: nowrap;">Qty</th>
            ${!isThermal ? `<th style="width: 100px; text-align: center; white-space: nowrap;">Price</th>` : ""}
            <th style="width: 100px; text-align: center; white-space: nowrap;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div class="summary-section">
        <table class="summary-table">
          <tr>
            <td>Gross Amount</td>
            <td class="text-right">${formatCurrency(invoice.subtotal)}</td>
          </tr>
          <tr><td>Discount % (${invoice.subtotal > 0 ? (((invoice.discountAmount || 0) / invoice.subtotal) * 100).toFixed(1) : "0.0"}%)</td><td class="text-right">- ${formatCurrency(invoice.discountAmount || 0)}</td></tr>
          ${isVatRegistered ? `<tr><td>Taxable Amount</td><td class="text-right">${formatCurrency(getIrdTaxableAmount(invoice.taxAmount, invoice.taxableAmount, invoice.subtotal - (invoice.discountAmount || 0)))}</td></tr>` : ""}
          ${isVatRegistered && (invoice.taxPercentage || 0) > 0 ? `<tr><td>VAT (${invoice.taxPercentage}%)</td><td class="text-right">${formatCurrency(invoice.taxAmount || 0)}</td></tr>` : ""}
          <tr class="font-bold">
            <td>Total Amount</td>
            <td class="text-right">${formatCurrency(invoice.totalAmount)}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-top: 4px; font-size: 13px; color: #000000;">
        <strong>In words:</strong> Rupees ${numberToWords(invoice.totalAmount || 0)} Only
      </div>

      <div style="margin-top: ${isThermal ? "10px" : "15px"}; display: flex; gap: 60px; font-size: 13px; color: #000000;">
        <div>
          <p style="margin: 0;">Authorized Signature</p>
          <p style="margin: 5px 0 0 0;">___________________</p>
        </div>
        <div>
          <p style="margin: 0;">Printed By</p>
          <p style="margin: 5px 0 0 0;">${printedBy ? printedBy : "___________________"}</p>
        </div>
      </div>
    </div>
    
    ${!isThermal && footerHTML
      ? footerHTML
      : `
    <div style="margin-top: 15px; text-align: center; font-size: 0.85em; color: #000000; border-top: 1px solid #eee; padding-top: 5px;">
      <p style="font-weight: bold; margin: 2px 0;">Computerized Billing System</p>
      <p>${layoutConfig?.showFooter ? (
        invoice.invoiceType === 'appointment' ? layoutConfig.appointmentFooterText :
          invoice.invoiceType === 'pathology' ? layoutConfig.pathologyFooterText :
            layoutConfig.footerText
      ) || layoutConfig.footerText || "Thank you for choosing us" : "Thank you for choosing us"}</p>
      ${isThermal ? `<p>${new Date().toLocaleString()}</p>` : ""}
    </div>
    `
    }
  </div>
  
  <script>
    window.onload = () => {
      document.fonts.ready.then(() => {
        setTimeout(() => { window.print(); window.close(); }, 800);
      });
    }
  </script>
</body>
</html>`;
};

/**
 * Wrapper for pathology invoices
 */
export const generateInvoiceHTML = (
  billing: PathologyBilling,
  format: PrintFormat,
  clinic: any,
  layoutConfig: any,
  copyNumber: number = 0,
  printedBy: string = ""
): string => {
  const unifiedInvoice: UnifiedInvoice = {
    invoiceType: 'pathology',
    invoiceNumber: billing.invoiceNumber,
    invoiceDate: billing.invoiceDate,
    patientName: billing.patientName,
    patientPanVat: billing.patientPanVat,
    patientPhone: billing.patientPhone,
    patientAddress: billing.patientAddress,
    subtotal: billing.subtotal || 0,
    discountAmount: billing.discountAmount || 0,
    taxableAmount: (billing.taxPercentage || 0) > 0 ? (billing.subtotal || 0) - (billing.discountAmount || 0) : undefined,
    taxPercentage: billing.taxPercentage || 0,
    taxAmount: billing.taxAmount || 0,
    totalAmount: billing.totalAmount || 0,
    paidAmount: billing.paidAmount || 0,
    balanceAmount: billing.balanceAmount || 0,
    irdSynced: billing.irdSynced,
    paymentMethod: billing.paymentMethod,
    isCreditNote: billing.isCreditNote,
    creditNoteNote: billing.isCreditNote ? billing.notes : undefined,
    isCancelled: billing.status === "cancelled",
    cancelledNote: billing.status === "cancelled" ? billing.notes : undefined,
    items: billing.items.map(i => ({
      name: i.testName,
      subtext: i.testType ? `(${i.testType})` : undefined,
      quantity: i.quantity,
      price: i.price || 0,
      amount: i.amount || 0
    }))
  };

  return generateUnifiedInvoiceHTML(unifiedInvoice, format, clinic, layoutConfig, copyNumber, printedBy);
};

/**
 * Wrapper for appointment invoices
 */
export const generateAppointmentInvoiceHTML = (
  invoice: AppointmentBilling,
  clinic: any,
  layoutConfig: PrintLayoutConfig | null,
  patient: any,
  format: PrintFormat = "A4",
  doctor?: any,
  copyNumber: number = 0,
  printedBy: string = ""
): string => {
  // Get involved clinicians
  const cliniciansMap = new Map();
  const primaryDocId = invoice.doctorId && invoice.doctorId !== "unassigned" ? invoice.doctorId : doctor?.id || "unassigned";

  const primaryDocName = (() => {
    if (doctor?.name && doctor.name !== "Unknown Doctor" && doctor.name !== "Expert Cabin") return doctor.name;
    if (invoice.doctorName && invoice.doctorName !== "Unknown Doctor" && invoice.doctorName !== "Expert Cabin") return invoice.doctorName;
    return primaryDocId !== "unassigned" ? "Unknown Doctor" : "Expert Cabin";
  })();

  if (primaryDocName && primaryDocName !== "Unknown Doctor") {
    cliniciansMap.set(primaryDocId, { name: primaryDocName, isPrimary: true });
  }

  invoice.items.forEach((item) => {
    if (item.doctorId && item.doctorId !== "unassigned" && !cliniciansMap.has(item.doctorId)) {
      const name = item.doctorName && item.doctorName !== "Unknown Doctor" && item.doctorName !== "Expert Cabin" ? item.doctorName : "Expert Cabin";
      cliniciansMap.set(item.doctorId, { name, isPrimary: false });
    }
  });

  const cliniciansList = Array.from(cliniciansMap.values());
  const cliniciansHtml = cliniciansList.length > 0
    ? `<div>
        <h3 style="margin: 0 0 6px 0; font-size: 10px; font-weight: 700; color: #000000; text-transform: uppercase; letter-spacing: 0.03em;">${cliniciansList.length > 1 ? "Clinicians" : "Clinician"}:</h3>
        ${cliniciansList.map((c) => `<p style="margin: 2px 0; font-size: 11px; font-weight: 600; color: #000000;">${c.name}${c.isPrimary && cliniciansList.length > 1 ? " (Primary)" : ""}</p>`).join("")}
      </div>`
    : "";

  const unifiedInvoice: UnifiedInvoice = {
    invoiceType: 'appointment',
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    patientName: patient?.name || (invoice.patientName && invoice.patientName !== "Unknown Patient" ? invoice.patientName : "Unknown Patient"),
    patientPanVat: invoice.buyerPan,
    patientPhone: patient?.mobile,
    patientAddress: patient?.address,
    subtotal: invoice.subtotal || 0,
    discountAmount: invoice.discountAmount || 0,
    taxableAmount: invoice.taxPercentage > 0 ? (invoice.subtotal - invoice.discountAmount) : undefined,
    taxPercentage: invoice.taxPercentage || 0,
    taxAmount: invoice.taxAmount || 0,
    totalAmount: invoice.totalAmount || 0,
    paidAmount: invoice.paidAmount || 0,
    previousDuePaidAmount: (invoice as any).previousDuePaidAmount || 0,
    balanceAmount: invoice.balanceAmount || 0,
    irdSynced: invoice.irdSynced,
    paymentMethod: invoice.paymentMethod,
    isCreditNote: invoice.isCreditNote,
    creditNoteNote: invoice.isCreditNote ? invoice.notes : undefined,
    isCancelled: invoice.status === "cancelled",
    cancelledNote: invoice.status === "cancelled" ? invoice.notes : undefined,
    cliniciansHtml,
    items: invoice.items.map(i => ({
      name: i.appointmentTypeName,
      subtext: i.doctorName && i.doctorName !== 'Unknown Doctor' && i.doctorName !== 'Expert Cabin' ? `Assigned: ${i.doctorName}` : undefined,
      quantity: i.quantity,
      price: i.price,
      amount: i.amount
    }))
  };

  return generateUnifiedInvoiceHTML(unifiedInvoice, format, clinic, layoutConfig, copyNumber, printedBy);
};

/**
 * Wrapper for generic pharmacy invoices
 */
export const generatePharmacyInvoiceHTML = (
  saleData: any,
  format: PrintFormat,
  clinic: any,
  layoutConfig: any,
  copyNumber: number = 0,
  printedBy: string = ""
): string => {
  const unifiedInvoice: UnifiedInvoice = {
    invoiceType: 'pharmacy',
    invoiceNumber: saleData.invoiceNumber || saleData.id,
    invoiceDate: saleData.invoiceDate || saleData.createdAt || new Date(),
    patientName: saleData.patientName || saleData.customerName || "Cash Customer",
    patientPanVat: saleData.patientPanVat || saleData.buyerPan,
    patientPhone: saleData.patientPhone || saleData.customerPhone,
    patientAddress: saleData.patientAddress || saleData.customerAddress,
    subtotal: saleData.subtotal || 0,
    discountAmount: saleData.discountAmount || 0,
    taxableAmount: saleData.taxableAmount || (saleData.taxPercentage > 0 ? (saleData.subtotal - (saleData.discountAmount || 0)) : 0),
    taxPercentage: saleData.taxPercentage || 0,
    taxAmount: saleData.taxAmount || 0,
    totalAmount: saleData.totalAmount || 0,
    paidAmount: saleData.paidAmount || 0,
    balanceAmount: saleData.balanceAmount || 0,
    irdSynced: saleData.irdSynced,
    paymentMethod: saleData.paymentMethod || saleData.paymentType,
    isCreditNote: saleData.isCreditNote,
    creditNoteNote: saleData.creditNoteNote,
    items: (saleData.items || []).map((i: any) => ({
      name: i.name || i.medicineName || i.itemName,
      subtext: i.subtext || (i.batchNumber ? `Batch: ${i.batchNumber}` : undefined),
      quantity: i.quantity || 1,
      price: i.price || i.unitPrice || 0,
      amount: i.amount || i.totalPrice || (i.quantity * (i.price || i.unitPrice || 0))
    }))
  };

  return generateUnifiedInvoiceHTML(unifiedInvoice, format, clinic, layoutConfig, copyNumber, printedBy);
};


export const generatePatientSlipHTML = (
  patient: any,
  clinic: any,
  format: PrintFormat,
  layoutConfig: PrintLayoutConfig | null,
): string => {
  const isThermal =
    format === "THERMAL_80MM" ||
    format === "THERMAL_58MM" ||
    format === "THERMAL_4INCH";

  // Use config-defined width if available and format is thermal
  let thermalWidth = "80mm";

  if (format === "THERMAL_80MM") thermalWidth = "80mm";
  else if (format === "THERMAL_58MM") thermalWidth = "58mm";
  else if (format === "THERMAL_4INCH") thermalWidth = "104mm";
  else if (isThermal && layoutConfig?.thermalPaperWidthMm) {
    thermalWidth = `${layoutConfig.thermalPaperWidthMm}mm`;
  }

  const brandingCSS = layoutConfig
    ? getPrintBrandingCSS(layoutConfig, isThermal)
    : "";

  // Helper for date formatting
  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateAge = (dob: Date | string): number => {
    const today = new Date();
    const b = typeof dob === "string" ? new Date(dob) : dob;
    let a = today.getFullYear() - b.getFullYear();

    if (
      today.getMonth() < b.getMonth() ||
      (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())
    )
      a--;

    return a;
  };

  const ageGender = [
    patient.dob
      ? calculateAge(patient.dob) + " yrs"
      : patient.age
        ? patient.age + " yrs"
        : "",
    patient.gender || "",
  ]
    .filter(Boolean)
    .join(" / ");

  const slipDate = new Date().toISOString().split("T")[0].replace(/-/g, "/");

  // Layout for A4/A5
  const standardLayout = `
    <table class="slip-table">
      <tbody>
        <tr>
          <td class="label">Reg#:</td><td class="value">${patient.regNumber || ""}</td>
          <td class="label">Name:</td><td class="value">${patient.name}</td>
        </tr>
        <tr>
          <td class="label">Age/Gender:</td><td class="value">${ageGender}</td>
          <td class="label">Date:</td><td class="value">${slipDate}</td>
        </tr>
        <tr>
          <td class="label">Contact:</td><td class="value">${patient.mobile || ""}</td>
          <td class="label">Address:</td><td class="value">${patient.address || ""}</td>
        </tr>
        <tr>
          <td class="label">Ref By:</td><td class="value" colspan="3">${patient.referredBy || ""}</td>
        </tr>
      </tbody>
    </table>
  `;

  // Layout for Thermal
  const thermalLayout = `
    <table class="slip-table-thermal">
      <tbody>
        <tr><td class="label">Reg#:</td><td class="value">${patient.regNumber || ""}</td></tr>
        <tr><td class="label">Name:</td><td class="value">${patient.name}</td></tr>
        <tr><td class="label">Age/Gen:</td><td class="value">${ageGender}</td></tr>
        <tr><td class="label">Date:</td><td class="value">${slipDate}</td></tr>
        <tr><td class="label">Contact:</td><td class="value">${patient.mobile || ""}</td></tr>
        <tr><td class="label">Address:</td><td class="value">${patient.address || ""}</td></tr>
        <tr><td class="label">Ref By:</td><td class="value">${patient.referredBy || ""}</td></tr>
      </tbody>
    </table>
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <title>Patient Slip - ${patient.name}</title>
  <style>
    @page {
      ${format === "A4_HALF" ? "size: A5 landscape; margin: 0;" : format === "A4" ? "size: A4; margin: 0;" : `size: ${thermalWidth} auto; margin: 0;`}
    }
    ${brandingCSS}

    .print-container {
      width: ${isThermal ? thermalWidth : "100%"};
      margin: 0 auto;
      padding: ${isThermal ? "2mm" : "20mm"};
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    
    .document-title {
      text-align: center;
      margin: ${isThermal ? "5px 0" : "15px 0"};
      border-bottom: 1px solid #333;
      padding-bottom: 5px;
    }
    .document-title h2 {
      font-size: ${isThermal ? "14px" : "18px"};
      margin: 0;
      text-transform: uppercase;
    }

    /* Standard Table Styles */
    .slip-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .slip-table td { border: 1px solid #333; padding: 6px 8px; vertical-align: top; }
    .slip-table td.label { background: #f5f5f5; font-weight: bold; width: 15%; }
    .slip-table td.value { width: 35%; }

    /* Thermal Table Styles */
    .slip-table-thermal { width: 100%; border-collapse: collapse; margin-top: 5px; }
    .slip-table-thermal td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
    .slip-table-thermal td.label { font-weight: bold; width: 35%; background: #f9f9f9; }
    .slip-table-thermal td.value { width: 65%; }

    .header-thermal {
      text-align: center;
      margin-bottom: 10px;
    }
    .clinic-name-thermal { font-weight: bold; font-size: 14px; margin: 0; }
    .clinic-info-thermal { font-size: 10px; margin: 2px 0; }

    .footer {
      margin-top: 15px;
      text-align: center;
      font-size: 10px;
      color: #000000;
      border-top: 1px solid #eee;
      padding-top: 5px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div style="text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 5px;">
      <h1 style="font-weight: bold; font-size: 14px; margin: 0;">PATIENT SLIP</h1>
    </div>
    
    ${isThermal ? thermalLayout : standardLayout}
    
    <div class="footer">
      <p>Thank you</p>
      <p>${new Date().toLocaleString()}</p>
    </div>
  </div>
  
  <script>
    window.onload = () => {
      document.fonts.ready.then(() => {
        setTimeout(() => { window.print(); window.close(); }, 800);
      });
    }
  </script>
</body>
</html>`;
};
