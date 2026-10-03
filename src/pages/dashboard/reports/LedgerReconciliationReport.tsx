import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  IoDownloadOutline,
  IoRefreshOutline,
  IoSearchOutline,
  IoWarningOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";
import { billingApi } from "@/services/api/billingApi";
import { useAuthContext } from "@/context/AuthContext";
import {
  runReconciliation,
  toUnfiledSale,
  ReconBucket,
  ReconSummary,
} from "@/services/reconciliationService";
import {
  queueSaleForFiling,
  approveFiling,
  listAwaitingApproval,
  PendingRemediation,
} from "@/services/remediationService";
import { clinicService } from "@/services/clinicService";

/**
 * Ledger Reconciliation — compares the authoritative MySQL ledger (what IRD
 * sees) against the Firestore copy every billing screen reads from.
 *
 * These two stores are written independently and nothing keeps them in
 * agreement, so drift is invisible until something is audited. This makes it
 * countable and exportable.
 */

const BUCKET_META: Record<
  ReconBucket,
  { label: string; help: string; tone: string }
> = {
  MYSQL_ONLY: {
    label: "Not visible in app",
    help: "Filed in the ledger, but no Firestore document — the UI can never show these.",
    tone: "bg-mountain-100 text-mountain-700 border-mountain-200",
  },
  FIRESTORE_ONLY: {
    label: "Never filed with IRD",
    help: "A real sale exists in the app with no ledger row, so it was never reported.",
    tone: "bg-danger/10 text-danger border-danger/20",
  },
  SPLIT_ONLY_DIVERGENT: {
    label: "Wrong taxable/exempt split",
    help: "Total and tax agree, but the taxable vs exempt split filed with IRD does not match the app.",
    tone: "bg-saffron-100 text-saffron-700 border-saffron-200",
  },
  AMOUNT_DIVERGENT: {
    label: "Amounts disagree",
    help: "The ledger and the app disagree on money — needs investigation.",
    tone: "bg-danger/10 text-danger border-danger/20",
  },
  STALE_CACHE: {
    label: "Stale sync badge",
    help: "IRD accepted it and the ledger knows, but the app still shows it unsynced.",
    tone: "bg-teal-100 text-teal-700 border-teal-200",
  },
  MATCHED_OK: {
    label: "Matched",
    help: "The ledger and the app agree.",
    tone: "bg-health-100 text-health-700 border-health-200",
  },
};

const ORDER: ReconBucket[] = [
  "FIRESTORE_ONLY",
  "AMOUNT_DIVERGENT",
  "SPLIT_ONLY_DIVERGENT",
  "STALE_CACHE",
  "MYSQL_ONLY",
  "MATCHED_OK",
];

/** Which Firestore collection a module's documents live in. */
const COLLECTION_OF: Record<string, string> = {
  appointment: "appointmentBilling",
  pathology: "pathologyBilling",
  pharmacy: "medicinePurchases",
};

export const LedgerReconciliationReport: React.FC = () => {
  const { clinicId } = useAuthContext();
  const [repairingKey, setRepairingKey] = useState<string | null>(null);
  const [awaiting, setAwaiting] = useState<PendingRemediation[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<ReconBucket | "all">("all");

  const load = async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      setSummary(await runReconciliation(clinicId));
      setAwaiting(await listAwaitingApproval(clinicId));
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
  }, [clinicId]);

  const filtered = useMemo(() => {
    if (!summary) return [];
    const q = search.trim().toLowerCase();

    return summary.rows
      .filter((r) => bucketFilter === "all" || r.bucket === bucketFilter)
      .filter(
        (r) =>
          !q ||
          r.invoiceNumber.toLowerCase().includes(q) ||
          r.module.toLowerCase().includes(q),
      )
      .sort((a, b) => ORDER.indexOf(a.bucket) - ORDER.indexOf(b.bucket));
  }, [summary, search, bucketFilter]);

  /**
   * Point the ledger row at its Firestore document and let the backend
   * mirror the real IRD state onto it. Only offered where reconciliation has
   * already matched the two by exact key — never for returns, whose state
   * lives nested inside the purchase document.
   */
  const repairBadge = async (row: (typeof filtered)[number]) => {
    const collectionName = COLLECTION_OF[row.module];

    if (!row.ledgerId || !row.docId || !collectionName) return;

    setRepairingKey(row.key);
    try {
      await billingApi.attachSourcePointer(
        row.ledgerId,
        collectionName,
        row.docId,
      );
      addToast({
        title: "Sync state refreshed from the ledger",
        description: `${row.invoiceNumber} now shows what IRD actually recorded.`,
        color: "success",
      });
      await load();
    } catch (err: any) {
      addToast({
        title: "Could not refresh",
        description:
          err?.response?.data?.message || err?.message || "Unknown error",
        color: "danger",
        duration: 10000,
      });
    } finally {
      setRepairingKey(null);
    }
  };

  /**
   * Propose filing a sale that never reached the ledger. This files nothing
   * on its own — the backend poller ignores proposals until a second person
   * releases one.
   */
  const queueForFiling = async (row: (typeof filtered)[number]) => {
    if (!clinicId) return;
    setBusyKey(row.key);
    try {
      const sale = toUnfiledSale(row, clinicId);

      if (!sale) throw new Error("This record cannot be filed on its own.");
      if (!sale.fiscalYear) {
        throw new Error(
          "Could not determine which fiscal year this sale belongs to — it needs filing by hand.",
        );
      }

      const clinic = await clinicService.getClinicById(clinicId);

      await queueSaleForFiling(sale, Boolean(clinic?.irdEnabled));
      addToast({
        title: "Queued for approval",
        description: `${row.invoiceNumber} is waiting for a second person to release it. Nothing has been filed yet.`,
        color: "success",
      });
      await load();
    } catch (err: any) {
      addToast({
        title: "Could not queue this sale",
        description: err?.message || "Unknown error",
        color: "danger",
        duration: 10000,
      });
    } finally {
      setBusyKey(null);
    }
  };

  const releaseFiling = async (entry: PendingRemediation) => {
    setBusyKey(entry.id);
    try {
      await approveFiling(entry.id, entry.requestedBy);
      addToast({
        title: "Released for filing",
        description: `${entry.invoiceNumber} will be filed by the backend within a minute.`,
        color: "success",
      });
      await load();
    } catch (err: any) {
      addToast({
        title: "Could not approve",
        description:
          err?.code === "permission-denied"
            ? "A filing must be approved by someone other than the person who proposed it."
            : err?.message || "Unknown error",
        color: "danger",
        duration: 10000,
      });
    } finally {
      setBusyKey(null);
    }
  };

  /**
   * The taxable/exempt split discrepancy schedule — as-filed vs. correct,
   * for the accountant and the IRD officer to rule on. Nothing is submitted
   * or amended from here: CBMS has no amend operation, and the sanctioned
   * route (credit note and reissue) is a decision for them, not for this
   * report.
   */
  const exportSplitSchedule = () => {
    const rows = (summary?.rows || []).filter(
      (r) => r.bucket === "SPLIT_ONLY_DIVERGENT",
    );
    const data = rows.map((r) => ({
      "Invoice #": r.invoiceNumber,
      Module: r.module,
      Date: r.date || "",
      "Total (agrees)": r.ledgerTotal ?? "",
      "Discrepancy (as filed vs. correct)": r.diffs.join(" | "),
      "Ledger Row Id": r.ledgerId ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Split Discrepancies");
    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 70 },
      { wch: 14 },
    ];
    XLSX.writeFile(workbook, "Taxable_Exempt_Split_Discrepancies.xlsx");
  };

  const exportToExcel = () => {
    const exportData = filtered.map((r) => ({
      Status: BUCKET_META[r.bucket].label,
      "Invoice #": r.invoiceNumber,
      Module: r.module,
      Date: r.date || "",
      "Ledger Total": r.ledgerTotal ?? "",
      "App Total": r.localTotal ?? "",
      "Ledger Filed with IRD":
        r.ledgerSynced === undefined ? "" : r.ledgerSynced ? "Yes" : "No",
      "App Shows Synced":
        r.localSynced === undefined ? "" : r.localSynced ? "Yes" : "No",
      "Ledger Row Id": r.ledgerId ?? "",
      "Firestore Doc Id": r.docId || "",
      Findings: r.diffs.join(" | "),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger Reconciliation");
    worksheet["!cols"] = [
      { wch: 26 },
      { wch: 22 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 24 },
      { wch: 70 },
    ];
    XLSX.writeFile(workbook, "Ledger_Reconciliation.xlsx");
  };

  const problemCount = summary
    ? summary.rows.length - summary.counts.MATCHED_OK
    : 0;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[14px] font-semibold text-text-main flex items-center gap-2">
            <IoWarningOutline className="w-4 h-4 text-saffron-600" />
            Ledger Reconciliation
          </h3>
          <p className="text-[12px] text-text-muted/60 max-w-3xl">
            The official ledger (MySQL, what IRD sees) against the app&apos;s own
            copy. They are written separately and nothing keeps them in step, so
            anything below is a real disagreement worth explaining.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="bordered"
            startContent={<IoRefreshOutline className="w-4 h-4" />}
            isLoading={loading}
            onPress={load}
          >
            Re-run
          </Button>
          <Button
            size="sm"
            variant="flat"
            startContent={<IoDownloadOutline className="w-4 h-4" />}
            isDisabled={filtered.length === 0}
            onPress={exportToExcel}
          >
            Export
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md p-3">
          {error}
        </div>
      )}

      {loading && !summary && (
        <div className="text-sm text-default-500">
          Comparing the ledger against the app&hellip;
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {ORDER.map((b) => (
              <button
                key={b}
                className={`text-left rounded-md border p-2.5 transition ${
                  BUCKET_META[b].tone
                } ${bucketFilter === b ? "ring-2 ring-primary-400" : ""}`}
                title={BUCKET_META[b].help}
                onClick={() => setBucketFilter(bucketFilter === b ? "all" : b)}
              >
                <div className="text-[18px] font-semibold leading-none">
                  {summary.counts[b]}
                </div>
                <div className="text-[11px] mt-1 leading-tight">
                  {BUCKET_META[b].label}
                </div>
              </button>
            ))}
          </div>

          {awaiting.length > 0 && (
            <div className="rounded-md border border-saffron-200 bg-saffron-50 p-3 space-y-2">
              <div className="text-[13px] font-semibold text-saffron-800">
                {awaiting.length} sale{awaiting.length === 1 ? "" : "s"} proposed
                for late filing
              </div>
              <p className="text-[12px] text-saffron-800/80">
                Nothing has been filed yet. Filing a tax document after the fact
                needs a second person, so these can only be released by someone
                other than whoever proposed them.
              </p>
              {awaiting.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 bg-white rounded border border-saffron-200 px-2.5 py-1.5"
                >
                  <div className="text-[12px]">
                    <span className="font-mono">{entry.invoiceNumber}</span>
                    {entry.totalAmount !== undefined && (
                      <> &middot; NPR {entry.totalAmount}</>
                    )}
                    {entry.backfillInvoiceDate && (
                      <> &middot; dated {entry.backfillInvoiceDate}</>
                    )}
                    <div className="text-text-muted/70">
                      proposed by {entry.requestedByName || entry.requestedBy}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    isLoading={busyKey === entry.id}
                    onPress={() => releaseFiling(entry)}
                  >
                    Approve &amp; file
                  </Button>
                </div>
              ))}
            </div>
          )}

          {summary.counts.SPLIT_ONLY_DIVERGENT > 0 && (
            <div className="rounded-md border border-mountain-200 bg-mountain-50 p-3 flex items-start justify-between gap-3">
              <div className="text-[12px] text-mountain-700 max-w-3xl">
                <strong>{summary.counts.SPLIT_ONLY_DIVERGENT}</strong> invoices
                were filed with the wrong taxable/exempt split. The total and the
                tax collected are correct — only how the base was divided
                differs. CBMS has no amend operation, so nothing is corrected
                from here: export the schedule for your accountant and IRD
                officer to decide whether credit-note-and-reissue is warranted.
              </div>
              <Button
                size="sm"
                variant="bordered"
                startContent={<IoDownloadOutline className="w-4 h-4" />}
                onPress={exportSplitSchedule}
              >
                Discrepancy schedule
              </Button>
            </div>
          )}

          <div className="text-[12px] text-text-muted/70">
            {summary.ledgerCount} ledger rows vs {summary.firestoreCount} app
            records &middot; <strong>{problemCount}</strong> need attention
            &middot; generated {summary.generatedAt.toLocaleString()}
            {bucketFilter !== "all" && (
              <>
                {" "}
                &middot;{" "}
                <button
                  className="underline text-primary-600"
                  onClick={() => setBucketFilter("all")}
                >
                  clear filter
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 border border-mountain-200 rounded-md px-2 py-1.5 max-w-sm">
            <IoSearchOutline className="w-4 h-4 text-text-muted/60" />
            <input
              className="flex-1 text-[12px] outline-none bg-transparent"
              placeholder="Search invoice number or module..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="clarity-table min-w-full w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left">Status</th>
                  <th className="text-left">Invoice #</th>
                  <th className="text-left">Module</th>
                  <th className="text-left">Date</th>
                  <th className="text-right">Ledger</th>
                  <th className="text-right">App</th>
                  <th className="text-left">What is wrong</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full border text-[11px] ${
                          BUCKET_META[r.bucket].tone
                        }`}
                      >
                        {BUCKET_META[r.bucket].label}
                      </span>
                    </td>
                    <td className="font-mono">{r.invoiceNumber || "—"}</td>
                    <td>{r.module}</td>
                    <td>{r.date || "—"}</td>
                    <td className="text-right">
                      {r.ledgerTotal === undefined ? "—" : r.ledgerTotal}
                    </td>
                    <td className="text-right">
                      {r.localTotal === undefined ? "—" : r.localTotal}
                    </td>
                    <td className="text-text-muted/80">
                      {r.diffs.join(" · ") || "—"}
                    </td>
                    <td className="text-right">
                      {r.bucket === "STALE_CACHE" &&
                      r.ledgerId &&
                      r.docId &&
                      COLLECTION_OF[r.module] ? (
                        <Button
                          size="sm"
                          variant="flat"
                          isLoading={repairingKey === r.key}
                          onPress={() => repairBadge(r)}
                        >
                          Refresh badge
                        </Button>
                      ) : r.bucket === "FIRESTORE_ONLY" &&
                        COLLECTION_OF[r.module] ? (
                        <Button
                          size="sm"
                          variant="flat"
                          isLoading={busyKey === r.key}
                          onPress={() => queueForFiling(r)}
                        >
                          Queue for filing
                        </Button>
                      ) : (
                        <span className="text-text-muted/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="text-text-muted/60" colSpan={8}>
                      Nothing matches the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
