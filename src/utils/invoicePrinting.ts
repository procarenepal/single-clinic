import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
  getPrintFontsLinkHTML,
} from "./printBranding";

import { PathologyBilling, AppointmentBilling } from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import { numberToWords } from "./numberToWords";
import { getNepaliFiscalYear } from "@/services/irdCbmsService";

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
  items: UnifiedInvoiceItem[];
  cliniciansHtml?: string;
}

const formatCurrency = (amount: number) => `NPR ${amount.toLocaleString()}`;

const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Core engine for generating unified HTML invoice layouts.
 */
export const generateUnifiedInvoiceHTML = (
  invoice: UnifiedInvoice,
  format: PrintFormat,
  clinic: any,
  layoutConfig: any,
  isCopy: boolean = false,
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
            ${item.subtext ? `<div style="font-size: 0.9em; color: #334155; font-weight: 600; margin-top: 2px;">${item.subtext}</div>` : ''}
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
      font-size: ${isThermal ? "9px" : layoutConfig?.contentFontSize ? `${layoutConfig.contentFontSize}px` : "11px"};
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
      color: #1e293b;
    }
    .bill-to-section {
      display: flex;
      flex-direction: ${isThermal ? "column" : "row"};
      justify-content: space-between;
      margin-bottom: ${isThermal ? "8px" : "10px"};
      padding: ${isThermal ? "8px" : "6px 12px"};
      background-color: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .bill-to-section h3 {
      margin: 0 0 6px 0;
      font-size: 0.85em;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .bill-to-section p {
      margin: 1px 0;
      font-size: 1em;
      color: #334155;
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
      font-size: 1em;
      color: #334155;
    }
    .items-table th {
      background-color: #f1f5f9;
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.05em;
      color: #1e293b;
    }
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 6px;
    }
    .summary-table { width: ${isThermal ? '100%' : '260px'}; min-width: ${isThermal ? '100%' : '260px'}; border-collapse: collapse; }
    .summary-table td {
      padding: ${isThermal ? "3px 4px" : "4px 8px"};
      border-bottom: 1px solid #f1f5f9;
      font-size: 1em;
      color: #334155;
    }
    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }
    .font-bold { font-weight: 700; color: #1e293b; }

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
    ${isCopy ? `<div style="text-align: center; font-weight: bold; font-size: 16px; margin-top: 4px; margin-bottom: 4px; text-transform: uppercase;">[ COPY OF ORIGINAL ]</div>` : ""}
    
    <div class="content">
      <div class="document-title">
        <h2>कर बिजक (TAX INVOICE)</h2>
        <div class="document-info" style="display: flex; justify-content: space-between; margin-top: 10px;">
          <span># ${invoice.invoiceNumber}</span>
          <span>Date: ${formatDate(invoice.invoiceDate)}</span>
        </div>
      </div>
      
      <div class="bill-to-section">
        <div style="flex: 1;">
          <div style="display: grid; grid-template-columns: ${isThermal ? '1fr' : '1fr 1fr'}; gap: ${isThermal ? '2px' : '20px'};">
            <div style="display: grid; grid-template-columns: max-content 1fr; column-gap: 8px; row-gap: 4px; align-items: baseline;">
              <div style="font-weight: 700; font-size: 0.8em; color: #64748b; text-transform: uppercase;">BILL TO:</div>
              <div style="font-weight: 700; font-size: 1.1em; color: #0f172a;">${invoice.patientName && invoice.patientName !== "Unknown Patient" ? invoice.patientName : "Unknown Patient"}</div>
              
              ${invoice.buyerPan || invoice.patientPanVat ? `<div style="font-size: 0.85em; color: #64748b;">Buyer PAN:</div><div style="font-size: 0.9em; font-weight: 600; color: #1e293b;">${invoice.buyerPan || invoice.patientPanVat}</div>` : ""}
            </div>
            <div style="display: grid; grid-template-columns: max-content 1fr; column-gap: 8px; row-gap: 4px; align-items: baseline;">
              ${invoice.patientPhone ? `<div style="font-size: 0.85em; color: #64748b;">Phone:</div><div style="font-size: 0.9em; font-weight: 600; color: #1e293b;">${invoice.patientPhone}</div>` : ""}
              ${invoice.patientAddress ? `<div style="font-size: 0.85em; color: #64748b;">Address:</div><div style="font-size: 0.9em; font-weight: 600; color: #1e293b;">${invoice.patientAddress}</div>` : ""}
            </div>
          </div>
        </div>
        ${!isThermal && invoice.cliniciansHtml ? invoice.cliniciansHtml : ""}
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
          ${(invoice.discountAmount || 0) > 0 ? `<tr><td>Discount</td><td class="text-right">- ${formatCurrency(invoice.discountAmount || 0)}</td></tr>` : ""}
          ${(invoice.taxPercentage || 0) > 0 ? `<tr><td>Taxable Amount</td><td class="text-right">${formatCurrency(invoice.taxableAmount || (invoice.subtotal - (invoice.discountAmount || 0)))}</td></tr>` : ""}
          ${(invoice.taxPercentage || 0) > 0 ? `<tr><td>VAT (${invoice.taxPercentage}%)</td><td class="text-right">${formatCurrency(invoice.taxAmount || 0)}</td></tr>` : ""}
          <tr class="font-bold">
            <td>Total Amount</td>
            <td class="text-right">${formatCurrency(invoice.totalAmount)}</td>
          </tr>
          ${(invoice.previousDuePaidAmount || 0) > 0 ? `<tr><td>Previous Due Settled</td><td class="text-right">${formatCurrency(invoice.previousDuePaidAmount || 0)}</td></tr>` : ""}
          <tr>
            <td>Paid</td>
            <td class="text-right">${formatCurrency(invoice.paidAmount + (invoice.previousDuePaidAmount || 0))}</td>
          </tr>
          <tr class="font-bold">
            <td>Balance</td>
            <td class="text-right">${formatCurrency(invoice.balanceAmount)}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-top: 4px; font-size: 1em; color: #1e293b;">
        <strong>In words:</strong> Rupees ${numberToWords(invoice.totalAmount || 0)} Only
      </div>

      <div style="margin-top: ${isThermal ? "10px" : "15px"}; display: flex; justify-content: space-between; align-items: flex-end; font-size: 1em; color: #334155;">
        <div style="display: flex; gap: 40px;">
          <div>
            <p style="margin: 0;">Prepared By</p>
            <p style="margin: 5px 0 0 0;">___________________</p>
          </div>
          <div>
            <p style="margin: 0;">Printed By</p>
            <p style="margin: 5px 0 0 0;">${printedBy ? printedBy : "___________________"}</p>
          </div>
        </div>
        <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 0.85em; color: #166534; text-transform: uppercase;">
              ${invoice.irdSynced ? "✓ IRD Verified E-Bill" : "E-Bill System"}
            </div>
            <div style="font-size: 0.75em; color: #64748b;">
              PAN: ${clinic?.panNumber || layoutConfig?.panNumber || "-"} | FY: ${getNepaliFiscalYear(invoice.invoiceDate)}
            </div>
          </div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(`PAN:${clinic?.panNumber || layoutConfig?.panNumber || ''}|INV:${invoice.invoiceNumber}|DATE:${new Date(invoice.invoiceDate).toISOString().split('T')[0]}|AMT:${invoice.totalAmount}`)}" style="width: 50px; height: 50px; border: 1px solid #e2e8f0; padding: 2px; border-radius: 4px;" alt="IRD QR" />
        </div>
      </div>
      ${isThermal && invoice.cliniciansHtml ? invoice.cliniciansHtml : ""}
    </div>
    
    ${!isThermal && footerHTML
      ? footerHTML
      : `
    <div style="margin-top: 15px; text-align: center; font-size: 0.85em; color: #666; border-top: 1px solid #eee; padding-top: 5px;">
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
  isCopy: boolean = false,
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
    totalAmount: billing.totalAmount || 0,
    paidAmount: billing.paidAmount || 0,
    balanceAmount: billing.balanceAmount || 0,
    irdSynced: billing.irdSynced,
    items: billing.items.map(i => ({
      name: i.testName,
      subtext: i.testType ? `(${i.testType})` : undefined,
      quantity: i.quantity,
      price: i.price || 0,
      amount: i.amount || 0
    }))
  };

  return generateUnifiedInvoiceHTML(unifiedInvoice, format, clinic, layoutConfig, isCopy, printedBy);
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
  isCopy: boolean = false,
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
        <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #333;">${cliniciansList.length > 1 ? "Clinicians" : "Clinician"}:</h3>
        ${cliniciansList.map((c) => `<p style="margin: 2px 0; font-size: 12px; font-weight: 500;">${c.name}${c.isPrimary && cliniciansList.length > 1 ? " (Primary)" : ""}</p>`).join("")}
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
    cliniciansHtml,
    items: invoice.items.map(i => ({
      name: i.appointmentTypeName,
      subtext: i.doctorName && i.doctorName !== 'Unknown Doctor' && i.doctorName !== 'Expert Cabin' ? `Assigned: ${i.doctorName}` : undefined,
      quantity: i.quantity,
      price: i.price,
      amount: i.amount
    }))
  };

  return generateUnifiedInvoiceHTML(unifiedInvoice, format, clinic, layoutConfig, isCopy, printedBy);
};

/**
 * Wrapper for generic pharmacy invoices
 */
export const generatePharmacyInvoiceHTML = (
  saleData: any,
  format: PrintFormat,
  clinic: any,
  layoutConfig: any,
  isCopy: boolean = false,
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
    items: (saleData.items || []).map((i: any) => ({
      name: i.name || i.medicineName || i.itemName,
      subtext: i.batchNumber ? `Batch: ${i.batchNumber}` : undefined,
      quantity: i.quantity || 1,
      price: i.price || i.unitPrice || 0,
      amount: i.amount || i.totalPrice || (i.quantity * (i.price || i.unitPrice || 0))
    }))
  };

  return generateUnifiedInvoiceHTML(unifiedInvoice, format, clinic, layoutConfig, isCopy, printedBy);
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
      color: #666;
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
