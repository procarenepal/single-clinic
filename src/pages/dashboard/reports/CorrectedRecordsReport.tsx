import React, { useMemo } from "react";
import * as XLSX from "xlsx";
import NepaliDate from "nepali-datetime";
import { IoDownloadOutline, IoPrintOutline, IoWarningOutline } from "react-icons/io5";
import { Button } from "@/components/ui/button";
import { AppointmentBilling, PathologyBilling, MedicinePurchase } from "@/types/models";

interface CorrectedRecordsReportProps {
  billings: AppointmentBilling[];
  pathologyBillings: PathologyBilling[];
  medicinePurchases?: MedicinePurchase[];
}

interface CorrectionRecord {
  id: string;
  source: "Appointment" | "Pathology" | "Pharmacy";
  correctionType: "Cancelled" | "Credit Note";
  invoiceNumber: string;
  date: string;
  bsDate: string;
  reason: string;
  linkedRecord: string;
}

const formatNepaliDate = (date: Date | string): string => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return new NepaliDate(d).format("YYYY-MM-DD");
  } catch {
    return "-";
  }
};

/**
 * IRD's Electronic Billing Procedure दफा ६(ट) requires a SEPARATE, printable
 * report listing every record whose effectiveness was ended (cancelled) or
 * that was corrected by superseding it with a new record (Credit Note) —
 * distinct from the general invoice list / Schedule 5 report. This is that
 * report.
 */
export const CorrectedRecordsReport: React.FC<CorrectedRecordsReportProps> = ({
  billings,
  pathologyBillings,
  medicinePurchases = [],
}) => {
  const records = useMemo<CorrectionRecord[]>(() => {
    const result: CorrectionRecord[] = [];

    const addFromBillings = (
      list: (AppointmentBilling | PathologyBilling)[],
      source: "Appointment" | "Pathology",
    ) => {
      list.forEach((b) => {
        if (b.status === "cancelled") {
          result.push({
            id: b.id,
            source,
            correctionType: "Cancelled",
            invoiceNumber: b.invoiceNumber || "N/A",
            date: new Date(b.invoiceDate).toLocaleDateString(),
            bsDate: formatNepaliDate(b.invoiceDate),
            reason: b.notes || "-",
            linkedRecord: "-",
          });
        }

        if ((b as any).hasCreditNote) {
          const linkedCn = list.find(
            (other) => (other as any).linkedInvoiceId === b.id,
          );

          result.push({
            id: b.id,
            source,
            correctionType: "Credit Note",
            invoiceNumber: b.invoiceNumber || "N/A",
            date: new Date(b.invoiceDate).toLocaleDateString(),
            bsDate: formatNepaliDate(b.invoiceDate),
            reason: (linkedCn as any)?.creditNoteReason || "-",
            linkedRecord: linkedCn?.invoiceNumber || "-",
          });
        }
      });
    };

    addFromBillings(billings, "Appointment");
    addFromBillings(pathologyBillings, "Pathology");

    medicinePurchases.forEach((p) => {
      (p.returns || []).forEach((ret) => {
        const retDate = (ret.createdAt as any)?.toDate?.() || ret.createdAt;

        result.push({
          id: `${p.id}-${ret.id}`,
          source: "Pharmacy",
          correctionType: "Credit Note",
          invoiceNumber: p.purchaseNo || "N/A",
          date: new Date(retDate).toLocaleDateString(),
          bsDate: formatNepaliDate(retDate),
          reason: ret.notes || "-",
          linkedRecord: `RET-${p.purchaseNo}-${ret.id.slice(0, 6)}`,
        });
      });
    });

    return result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [billings, pathologyBillings, medicinePurchases]);

  const exportToExcel = () => {
    const exportData = records.map((r) => ({
      "Date (AD)": r.date,
      "Date (BS)": r.bsDate,
      "Source Module": r.source,
      "Correction Type": r.correctionType,
      "Original Invoice Number": r.invoiceNumber,
      "Linked Record": r.linkedRecord,
      Reason: r.reason,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Corrected Records");
    worksheet["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 15 },
      { wch: 22 }, { wch: 22 }, { wch: 40 },
    ];
    XLSX.writeFile(workbook, "IRD_Corrected_Records_Report.xlsx");
  };

  // Printing the live page (window.print()) would capture the whole app
  // shell around this tab (filters, other tabs, sidebar) — build a
  // standalone document with just this table and print that instead,
  // matching BillingAuditLogReport's approach.
  const printReport = () => {
    const rowsHtml = records
      .map(
        (r) => `
        <tr>
          <td>${r.date} (BS: ${r.bsDate})</td>
          <td>${r.source}</td>
          <td>${r.correctionType}</td>
          <td>${r.invoiceNumber}</td>
          <td>${r.linkedRecord}</td>
          <td>${r.reason}</td>
        </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<title>Corrected & Cancelled Records</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; padding: 16px; color: #1e293b; }
  h1 { font-size: 16px; margin: 0 0 4px 0; }
  p { font-size: 11px; color: #64748b; margin: 0 0 16px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
  th { background: #f1f5f9; }
  @media print { @page { margin: 10mm; } }
</style>
</head>
<body>
  <h1>Corrected & Cancelled Records</h1>
  <p>Every invoice whose effectiveness was ended (cancelled) or superseded by a Credit Note.</p>
  <table>
    <thead>
      <tr>
        <th>Date (AD/BS)</th>
        <th>Source</th>
        <th>Type</th>
        <th>Original Invoice</th>
        <th>Linked Record</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
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
    <div className="px-4 py-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-mountain-800 flex items-center gap-2">
            <IoWarningOutline className="w-5 h-5 text-primary-600" />
            Corrected & Cancelled Records
          </h3>
          <p className="text-xs text-mountain-500">
            Every invoice whose effectiveness was ended (cancelled) or superseded by a Credit Note — required as a separate, printable report per IRD's Electronic Billing Procedure.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            isDisabled={records.length === 0}
            size="sm"
            startContent={<IoPrintOutline className="w-4 h-4" />}
            variant="flat"
            onPress={printReport}
          >
            Print
          </Button>
          <Button
            color="primary"
            isDisabled={records.length === 0}
            size="sm"
            startContent={<IoDownloadOutline className="w-4 h-4" />}
            onPress={exportToExcel}
          >
            Export Excel
          </Button>
        </div>
      </div>

      <div className="clarity-card p-0 overflow-hidden border border-mountain-200 rounded-lg">
        <div className="px-4 py-2.5 bg-mountain-50 border-b border-mountain-200 flex justify-between items-center">
          <h4 className="text-xs font-bold uppercase tracking-wider text-mountain-700">
            Correction Register
          </h4>
          <span className="text-xs text-mountain-500 font-medium">
            Showing {records.length} record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="clarity-table min-w-full w-full text-xs">
            <thead>
              <tr className="bg-mountain-100/50">
                <th>Date (AD/BS)</th>
                <th>Source</th>
                <th>Type</th>
                <th>Original Invoice</th>
                <th>Linked Record</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-mountain-400 font-medium">
                    No cancelled or corrected records found.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={`${r.id}-${r.correctionType}`}>
                    <td className="whitespace-nowrap font-medium text-mountain-800">
                      <div>{r.date}</div>
                      <div className="text-[10px] text-mountain-400">BS: {r.bsDate}</div>
                    </td>
                    <td>
                      <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-mountain-100 font-medium text-mountain-700">
                        {r.source}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-bold ${
                          r.correctionType === "Cancelled"
                            ? "bg-danger-100 text-danger-700"
                            : "bg-warning-100 text-warning-700"
                        }`}
                      >
                        {r.correctionType}
                      </span>
                    </td>
                    <td className="font-semibold text-primary-700">{r.invoiceNumber}</td>
                    <td className="text-mountain-700">{r.linkedRecord}</td>
                    <td className="text-mountain-700 max-w-xs truncate" title={r.reason}>
                      {r.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
