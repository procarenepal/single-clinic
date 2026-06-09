import { format } from "date-fns";

import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "./printBranding";

import { StaffMember, AccountBill, Clinic } from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";

/**
 * Generates and prints a professional, high-density salary slip for a staff member.
 * Optimized for 'Clinical Command Console' aesthetics.
 */
export const printSalarySlip = (
  bill: AccountBill,
  staff: StaffMember,
  clinic: Clinic,
  config: PrintLayoutConfig,
) => {
  // Create a hidden iframe to print directly from the current window, avoiding about:blank URLs
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) {
    console.error("Could not access iframe document");
    return;
  }

  // Defensive date parsing helper
  const parseDefensiveDate = (dateVal: any): Date => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;
    if (typeof dateVal?.toDate === "function") {
      try {
        const d = dateVal.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch (e) {}
    }
    if (typeof dateVal?.seconds === "number") {
      return new Date(dateVal.seconds * 1000);
    }
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) return parsed;
    return new Date(); // fallback to current date instead of failing
  };

  const paymentDate = parseDefensiveDate(bill.billDate);
  const joiningDate = parseDefensiveDate(staff.joiningDate);

  const formattedPaymentDate = format(paymentDate, "MMM dd, yyyy");
  const formattedPeriod =
    bill.description?.split(". ")[0]?.replace("Salary for ", "") ||
    format(paymentDate, "MMMM yyyy");

  const primaryColor = config.primaryColor || "#7c3aed";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Salary Slip - ${staff.name}</title>
      <style>
        ${getPrintBrandingCSS(config)}
        
        body {
          background: #f1f5f9;
          padding: 60px 0;
          font-family: 'Inter', -apple-system, sans-serif !important;
        }

        .slip-wrapper {
          background: white;
          max-width: 820px;
          margin: 0 auto;
          box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.15);
          min-height: 1050px;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        
        .slip-content {
          padding: 40px 60px flex-grow: 1;
          z-index: 10;
        }
        
        .slip-header-title {
          text-align: center;
          margin: 15px 0 25px 0;
        }
        
        .slip-header-title h2 {
          font-family: 'Outfit', sans-serif !important;
          font-size: 16px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #0f172a;
          margin: 0;
          display: inline-block;
          border-bottom: 3px solid ${primaryColor};
          padding-bottom: 6px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 25px;
          margin-bottom: 50px;
          background: #f8fafc;
          padding: 30px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
          position: relative;
        }

        .info-grid::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: ${primaryColor};
          opacity: 0.3;
        }
        
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .info-label {
          font-size: 8.5px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        
        .info-value {
          font-family: 'Outfit', sans-serif !important;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }
        
        .financial-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 60px;
        }
        
        .financial-table th {
          background: ${primaryColor};
          text-align: left;
          padding: 12px 20px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: white;
          letter-spacing: 0.15em;
        }
        
        .financial-table td {
          padding: 18px 20px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13.5px;
          color: #334155;
          font-weight: 500;
        }
        
        .total-container {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-top: 2px solid ${primaryColor};
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 20px 30px;
          gap: 40px;
          margin-top: -1px;
        }
        
        .total-label {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        
        .total-value {
          font-family: 'Outfit', sans-serif !important;
          color: ${primaryColor};
          font-size: 22px;
          font-weight: 800;
        }
        
        .signature-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 150px;
          margin-top: 100px;
          padding: 0 40px;
        }
        
        .signature-box {
          border-top: 2px solid #e2e8f0;
          padding-top: 15px;
          text-align: center;
          font-size: 9.5px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.15em;
        }

        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-family: 'Outfit', sans-serif !important;
          font-size: 160px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.02);
          pointer-events: none;
          text-transform: uppercase;
          white-space: nowrap;
          z-index: 0;
          letter-spacing: 0.1em;
        }

        @media print {
          @page { margin: 0; }
          body { background: white; padding: 0; }
          .slip-wrapper { box-shadow: none; width: 100%; max-width: 100%; margin: 0; min-height: 100vh; }
          .no-print { display: none; }
          .slip-content { padding: 40px; }
        }
      </style>
    </head>
    <body>
      <div class="slip-wrapper">
        ${getPrintHeaderHTML(config, clinic)}
        
        <div class="watermark">OFFICIAL</div>

        <div class="slip-content">
          <div class="slip-header-title">
            <h2>Salary Payment Slip</h2>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Employee Name</span>
              <span class="info-value">${staff.name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Payment Ref #</span>
              <span class="info-value">${bill.billNumber}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Clinical Designation</span>
              <span class="info-value">${staff.role}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Disbursement Date</span>
              <span class="info-value">${formattedPaymentDate}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Salary Period</span>
              <span class="info-value">
                ${formattedPeriod}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Transaction Mode</span>
              <span class="info-value" style="text-transform: capitalize;">${bill.paymentMethod || "Cash"}</span>
            </div>
          </div>
          
          <table class="financial-table">
            <thead>
              <tr>
                <th>Description of Disbursement</th>
                <th style="text-align: right;">Amount (NPR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="line-height: 1.6;">
                  ${bill.description || `Salary disbursement for ${formattedPeriod}.`}
                </td>
                <td style="text-align: right; font-weight: 700;">Rs. ${bill.totalAmount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-container">
            <span class="total-label">Total Net Disbursed</span>
            <span class="total-value">Rs. ${bill.paidAmount.toLocaleString()}</span>
          </div>
          
          <div class="signature-section">
            <div class="signature-box">Employee Acknowledgment</div>
            <div class="signature-box">Clinical Authorization</div>
          </div>
        </div>
        
        ${getPrintFooterHTML(config)}
      </div>

  `;

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Print using the iframe context and clean up afterward to avoid popup/blank tab issues
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
    } catch (e) {
      console.error("Failed to print via iframe:", e);
    }
  }, 500);
};
