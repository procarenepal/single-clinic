/**
 * The Advance Receipt: proof that money was taken at the desk before the
 * visit's tax invoice exists. It is deliberately NOT a tax invoice — no
 * invoice number, no VAT split — and says so in its title, so it can never
 * be mistaken for one by the patient or an IRD officer.
 */
import {
  getPrintBrandingCSS,
  getPrintFontsLinkHTML,
  getPrintHeaderHTML,
} from "./printBranding";

import type { PrintLayoutConfig } from "@/types/printLayout";

export interface AdvanceReceiptDeposit {
  amount: number;
  method: string;
  reference?: string;
  at: Date;
}

export interface AdvanceReceiptData {
  /** The wallet ledger row id (or the first of several). */
  receiptNo: string;
  date: Date;
  patient: { name: string; regNumber?: string; mobile?: string };
  visit: { serviceNames: string[]; performerName?: string };
  deposits: AdvanceReceiptDeposit[];
  receivedBy?: string;
}

const money = (n: number) =>
  `NPR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );

const methodLabel = (m: string) =>
  m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const generateAdvanceReceiptHTML = (
  data: AdvanceReceiptData,
  clinic: any,
  layoutConfig: PrintLayoutConfig | null,
): string => {
  const brandingCSS = layoutConfig
    ? getPrintBrandingCSS(layoutConfig, false)
    : "";
  const headerHTML = layoutConfig
    ? getPrintHeaderHTML(layoutConfig, clinic, false)
    : "";
  const total = data.deposits.reduce((s, d) => s + d.amount, 0);
  const rows = data.deposits
    .map(
      (d, i) => `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHtml(d.at.toLocaleString("en-GB"))}</td>
        <td>${escapeHtml(methodLabel(d.method))}</td>
        <td>${d.reference ? escapeHtml(d.reference) : "—"}</td>
        <td style="text-align:right;font-weight:600">${money(d.amount)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  ${layoutConfig ? getPrintFontsLinkHTML() : ""}
  <title>Advance Receipt - ${escapeHtml(data.patient.name)}</title>
  <style>
    @page { size: A5 landscape; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
    body {
      font-family: ${layoutConfig?.fontFamily || "'Nunito', 'Inter', system-ui, Arial, sans-serif"};
      color: #111; font-size: 12px; line-height: 1.35;
    }
    .sheet { padding: 6mm 8mm; }
    .title { display:flex; justify-content:space-between; align-items:baseline; border-bottom: 1.5px solid #111; padding-bottom: 4px; margin: 6px 0 8px; }
    .title h1 { font-size: 15px; margin: 0; letter-spacing: 0.02em; text-transform: uppercase; }
    .title .not { font-size: 10.5px; font-weight: 700; color: #7a1f1f; border: 1px solid #7a1f1f; padding: 1px 6px; border-radius: 3px; }
    .meta { display:grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; font-size: 11.5px; margin-bottom: 8px; }
    .meta b { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    th, td { border-bottom: 1px solid #cfcfcf; padding: 4px 6px; text-align: left; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #333; border-bottom: 1.5px solid #111; }
    .total td { border-bottom: none; border-top: 1.5px solid #111; font-weight: 700; font-size: 12.5px; }
    .note { margin-top: 10px; font-size: 10.5px; color: #333; }
    .sign { margin-top: 18px; display:flex; justify-content: space-between; font-size: 10.5px; }
    .sign div { border-top: 1px solid #555; padding-top: 3px; min-width: 150px; text-align: center; }
    ${brandingCSS}
  </style>
</head>
<body>
  <div class="sheet">
    ${headerHTML}
    <div class="title">
      <h1>Advance Receipt</h1>
      <span class="not">Not a tax invoice</span>
    </div>
    <div class="meta">
      <div><b>Receipt no.</b> ${escapeHtml(data.receiptNo)}</div>
      <div><b>Date</b> ${escapeHtml(data.date.toLocaleString("en-GB"))}</div>
      <div><b>Patient</b> ${escapeHtml(data.patient.name)}${data.patient.regNumber ? ` (Reg #${escapeHtml(data.patient.regNumber)})` : ""}</div>
      <div><b>Contact</b> ${escapeHtml(data.patient.mobile || "—")}</div>
      <div><b>For</b> ${escapeHtml(data.visit.serviceNames.join(", ") || "Today's visit")}</div>
      <div><b>Clinician</b> ${escapeHtml(data.visit.performerName || "—")}</div>
    </div>
    <table>
      <thead><tr><th style="width:28px;text-align:center">#</th><th>Received at</th><th>Method</th><th>Reference</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total"><td colspan="4">Total advance received</td><td style="text-align:right">${money(total)}</td></tr></tfoot>
    </table>
    <p class="note">This amount is held as an advance against today's visit and is applied to the tax invoice issued when the visit is settled. Any unused balance stays as wallet credit on the patient's account.</p>
    <div class="sign">
      <div>Received by${data.receivedBy ? `: ${escapeHtml(data.receivedBy)}` : ""}</div>
      <div>Patient / Guardian</div>
    </div>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
};
