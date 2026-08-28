import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { IoDownloadOutline, IoPrintOutline, IoServerOutline } from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { billingApi, Schedule5Record } from "@/services/api/billingApi";
import { userService } from "@/services/userService";

/**
 * The Schedule 5 (अनुसूची ५) master invoice table, sourced from the Java
 * billing backend (the authoritative ledger). Required to be viewable and
 * printable from the front end per IRD's Electronic Billing Procedure,
 * clause 6(ङ).
 */
export const Schedule5Report: React.FC = () => {
  const [records, setRecords] = useState<Schedule5Record[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await billingApi.getSchedule5Report({
        fiscalYear: fiscalYear || undefined,
        size: 500,
      });
      setRecords(result.content);

      const uniqueUids = Array.from(
        new Set(result.content.map((r) => r.enteredBy)),
      ).filter((uid) => !(uid in userNames));

      if (uniqueUids.length > 0) {
        const resolved = await Promise.all(
          uniqueUids.map(async (uid) => {
            try {
              const user = await userService.getUserById(uid);

              return [uid, user?.displayName || user?.email || uid] as const;
            } catch {
              return [uid, uid] as const;
            }
          }),
        );

        setUserNames((prev) => ({
          ...prev,
          ...Object.fromEntries(resolved),
        }));
      }
    } catch (err: any) {
      setError(
        err.message ||
          "Could not reach the billing backend. Is it running and configured?",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportToExcel = () => {
    const exportData = records.map((r) => ({
      "Fiscal Year": r.fiscalYear,
      "Bill No": r.billNo,
      "Customer Name": r.customerName,
      "Customer PAN": r.customerPan || "-",
      "Bill Date": r.billDate,
      Amount: r.amount.toFixed(2),
      Discount: r.discount.toFixed(2),
      "Taxable Amount": r.taxableAmount.toFixed(2),
      "Tax Amount": r.taxAmount.toFixed(2),
      "Total Amount": r.totalAmount.toFixed(2),
      "Sync with IRD": r.syncWithIrd ? "Yes" : "No",
      "Is Bill Printed": r.billPrinted === null ? "-" : r.billPrinted ? "Yes" : "No",
      "Is Bill Active": r.billActive ? "Yes" : "No",
      "Printed Time": r.printedTime || "-",
      "Entered By": userNames[r.enteredBy] || r.enteredBy,
      "Printed By": r.printedBy || "-",
      "Is Realtime": r.realtime === null ? "-" : r.realtime ? "Yes" : "No",
      "Payment Method": r.paymentMethod || "-",
      "VAT Refund Amount": r.vatRefundAmount ?? "-",
      "Transaction Id": r.transactionId || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule 5");
    XLSX.writeFile(workbook, `Schedule_5_Master_Bill${fiscalYear ? `_${fiscalYear}` : ""}.xlsx`);
  };

  // Printing the live page (window.print()) would capture the whole app
  // shell around this tab (filters, other tabs, sidebar) — same pattern as
  // invoicePrinting.ts: build a standalone document with just this table and
  // print that instead.
  const printReport = () => {
    const rowsHtml = records
      .map(
        (r) => `
        <tr>
          <td>${r.fiscalYear}</td>
          <td>${r.billNo}</td>
          <td>${r.customerName}</td>
          <td>${r.customerPan || "-"}</td>
          <td>${r.billDate}</td>
          <td class="num">${r.amount.toFixed(2)}</td>
          <td class="num">${r.discount.toFixed(2)}</td>
          <td class="num">${r.taxableAmount.toFixed(2)}</td>
          <td class="num">${r.taxAmount.toFixed(2)}</td>
          <td class="num"><strong>${r.totalAmount.toFixed(2)}</strong></td>
          <td>${r.syncWithIrd ? "Yes" : "No"}</td>
          <td>${r.billActive ? "Active" : "Cancelled"}</td>
          <td>${userNames[r.enteredBy] || r.enteredBy}</td>
          <td>${r.paymentMethod || "-"}</td>
        </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<title>Schedule 5 - Master Bill Table${fiscalYear ? ` (${fiscalYear})` : ""}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; padding: 16px; color: #1e293b; }
  h1 { font-size: 16px; margin: 0 0 4px 0; }
  p { font-size: 11px; color: #64748b; margin: 0 0 16px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; white-space: nowrap; }
  th { background: #f1f5f9; }
  td.num, th.num { text-align: right; }
  @media print { @page { size: landscape; margin: 10mm; } }
</style>
</head>
<body>
  <h1>Schedule 5 &mdash; Master Bill Table</h1>
  <p>${fiscalYear ? `Fiscal Year: ${fiscalYear}` : "All fiscal years"} &middot; Generated ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      <tr>
        <th>Fiscal Year</th><th>Bill No</th><th>Customer</th><th>PAN</th><th>Date</th>
        <th class="num">Amount</th><th class="num">Discount</th><th class="num">Taxable</th>
        <th class="num">Tax</th><th class="num">Total</th><th>IRD Synced</th><th>Status</th>
        <th>Entered By</th><th>Payment Method</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>
    window.addEventListener("load", () => { window.print(); });
    window.addEventListener("afterprint", () => { window.close(); });
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1000,height=700");

    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  return (
    <div className="px-4 py-4 space-y-4 w-full min-w-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
        <div>
          <h3 className="text-base font-bold text-mountain-800 flex items-center gap-2">
            <IoServerOutline className="w-5 h-5 text-primary-600" />
            Schedule 5 — Master Bill Table
          </h3>
          <p className="text-xs text-default-500 mt-1">
            Sourced live from the billing backend (MySQL) — the authoritative
            invoice ledger, not a Firestore copy.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            className="border border-default-200 rounded-md px-2 py-1.5 text-sm"
            placeholder="Fiscal Year e.g. 2081.082"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
          />
          <Button size="sm" variant="flat" onPress={load}>
            Filter
          </Button>
          <Button
            color="primary"
            size="sm"
            startContent={<IoDownloadOutline />}
            variant="flat"
            onPress={exportToExcel}
          >
            Excel
          </Button>
          <Button
            size="sm"
            startContent={<IoPrintOutline />}
            variant="flat"
            onPress={printReport}
          >
            Print
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md p-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-default-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto max-w-full border border-default-200 rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-default-100">
              <tr>
                {[
                  "Fiscal Year", "Bill No", "Customer", "PAN", "Date", "Amount",
                  "Discount", "Taxable", "Tax", "Total", "IRD Synced", "Active",
                  "Entered By", "Payment Method",
                ].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.billNo} className="border-t border-default-100">
                  <td className="px-2 py-1 whitespace-nowrap">{r.fiscalYear}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.billNo}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.customerName}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.customerPan || "-"}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.billDate}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">{r.amount.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">{r.discount.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">{r.taxableAmount.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">{r.taxAmount.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap font-semibold">{r.totalAmount.toFixed(2)}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.syncWithIrd ? "✓" : "—"}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.billActive ? "Active" : "Cancelled"}</td>
                  <td className="px-2 py-1 whitespace-nowrap" title={r.enteredBy}>
                    {userNames[r.enteredBy] || r.enteredBy}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.paymentMethod || "-"}</td>
                </tr>
              ))}
              {records.length === 0 && !error && (
                <tr>
                  <td className="px-2 py-4 text-center text-default-400" colSpan={14}>
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
