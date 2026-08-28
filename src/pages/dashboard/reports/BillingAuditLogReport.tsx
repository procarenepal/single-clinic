import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { IoPrintOutline, IoShieldCheckmarkOutline, IoChevronBack, IoChevronForward, IoDownloadOutline } from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";
import { billingApi, BillingAuditLogEntry } from "@/services/api/billingApi";
import { userService } from "@/services/userService";

/**
 * The billing backend's automatic log-archive of every write action against
 * billing data — required to be viewable and printable per IRD's Electronic
 * Billing Procedure, clause 6(ट). This is distinct from the app-wide
 * Firestore audit trail (see AuditLogViewer) — this one specifically covers
 * the Java/MySQL billing ledger (invoice create/cancel/IRD-sync, IRD config
 * changes), which is the authoritative system for CBMS compliance purposes.
 */
export const BillingAuditLogReport: React.FC = () => {
  const [entries, setEntries] = useState<BillingAuditLogEntry[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [exporting, setExporting] = useState(false);

  const load = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await billingApi.getAuditLog({ page: targetPage, size: 25 });

      setEntries(result.content);
      setTotalPages(result.totalPages);
      setPage(result.number);

      const uniqueUids = Array.from(
        new Set(result.content.map((e) => e.performedByUid)),
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
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Printing the live page (window.print()) would capture the whole app
  // shell around this tab (filters, other tabs, sidebar) — build a
  // standalone document with just this table and print that instead.
  const printReport = () => {
    const rowsHtml = entries
      .map(
        (e) => `
        <tr>
          <td>${new Date(e.performedAt).toLocaleString()}</td>
          <td>${e.entityName}</td>
          <td>${e.entityId}</td>
          <td>${e.action}</td>
          <td>${userNames[e.performedByUid] || e.performedByUid}</td>
          <td>${e.details || "-"}</td>
        </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<title>Billing Audit Log</title>
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
  <h1>Billing Audit Log</h1>
  <p>Every write action against the billing ledger &middot; Generated ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      <tr><th>When</th><th>Entity</th><th>Entity Id</th><th>Action</th><th>Performed By</th><th>Details</th></tr>
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

  // Exports the FULL audit log (not just the current page) — fetches every
  // entry in one large request rather than paging through 25 at a time.
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const result = await billingApi.getAuditLog({ page: 0, size: 10000 });
      const uniqueUids = Array.from(
        new Set(result.content.map((e) => e.performedByUid)),
      ).filter((uid) => !(uid in userNames));

      let names = userNames;

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

        names = { ...names, ...Object.fromEntries(resolved) };
        setUserNames(names);
      }

      const exportData = result.content.map((e) => ({
        When: new Date(e.performedAt).toLocaleString(),
        Entity: e.entityName,
        "Entity Id": e.entityId,
        Action: e.action,
        "Performed By": names[e.performedByUid] || e.performedByUid,
        Details: e.details || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Billing Audit Log");
      worksheet["!cols"] = [
        { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 50 },
      ];
      XLSX.writeFile(workbook, "Billing_Audit_Log.xlsx");
    } catch (err: any) {
      addToast({
        title: "Export failed",
        description: err.message || "Could not export the audit log.",
        color: "danger",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4 w-full min-w-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
        <div>
          <h3 className="text-base font-bold text-mountain-800 flex items-center gap-2">
            <IoShieldCheckmarkOutline className="w-5 h-5 text-primary-600" />
            Billing Audit Log
          </h3>
          <p className="text-xs text-default-500 mt-1">
            Every write action against the billing ledger — who, what, and
            when. Insert-only; nothing here can be edited or deleted.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            isLoading={exporting}
            size="sm"
            startContent={<IoDownloadOutline />}
            variant="flat"
            onPress={exportToExcel}
          >
            Export Excel
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
        <>
          <div className="overflow-x-auto max-w-full border border-default-200 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-default-100">
                <tr>
                  {["When", "Entity", "Entity Id", "Action", "Performed By", "Details"].map(
                    (h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-default-100">
                    <td className="px-2 py-1 whitespace-nowrap">
                      {new Date(e.performedAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{e.entityName}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{e.entityId}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          e.action === "CANCEL"
                            ? "bg-danger/10 text-danger"
                            : e.action === "CREATE"
                              ? "bg-success/10 text-success"
                              : "bg-primary/10 text-primary"
                        }`}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td
                      className="px-2 py-1 whitespace-nowrap"
                      title={e.performedByUid}
                    >
                      {userNames[e.performedByUid] || e.performedByUid}
                    </td>
                    <td className="px-2 py-1">{e.details || "-"}</td>
                  </tr>
                ))}
                {entries.length === 0 && !error && (
                  <tr>
                    <td className="px-2 py-4 text-center text-default-400" colSpan={6}>
                      No audit log entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 print:hidden">
              <Button
                isDisabled={page <= 0}
                size="sm"
                startContent={<IoChevronBack />}
                variant="flat"
                onPress={() => load(page - 1)}
              >
                Prev
              </Button>
              <span className="text-xs text-default-500">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                isDisabled={page >= totalPages - 1}
                endContent={<IoChevronForward />}
                size="sm"
                variant="flat"
                onPress={() => load(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
