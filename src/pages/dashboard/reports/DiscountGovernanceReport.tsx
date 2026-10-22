import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  IoPricetagOutline,
  IoChevronBack,
  IoChevronForward,
  IoDownloadOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { auditLogService } from "@/services/auditLogService";
import { userService } from "@/services/userService";
import type { AuditLog } from "@/types/models";
import { formatLocalDate, parseLocalDate } from "@/utils/localDate";

const describeDiscount = (d?: {
  discountType?: string;
  discountValue?: number;
}) => {
  if (!d || !d.discountValue) return "none";

  return `${d.discountValue}${d.discountType === "percent" ? "%" : " NPR"}`;
};

/**
 * Every discount given anywhere in front office — at Quick Intake (gates the
 * wallet deposit down) or at Settle (the final invoice) — with who gave it
 * and why. Built on the same audit_logs event appointmentBillingService and
 * front-office-desk already write (billing_discount_tax_changed); this is
 * just the first purpose-built view onto that event type.
 */
export const DiscountGovernanceReport: React.FC = () => {
  const { clinicId } = useAuthContext();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastDocs, setLastDocs] = useState<any[]>([]); // stack, for Prev
  const [hasMore, setHasMore] = useState(false);
  // The real Firestore cursor from the most recent load() — kept outside
  // state since it's an opaque snapshot, not something to re-render on.
  const cursorRef = React.useRef<any>(null);
  const [dateRange, setDateRange] = useState({
    start: formatLocalDate(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    end: formatLocalDate(),
  });

  /** Resolves and caches names, returning the FULL map (cache + new) so a
   * caller that needs them immediately (export) isn't reading React state
   * before its async update has actually applied. */
  const resolveNames = async (
    entries: AuditLog[],
  ): Promise<Record<string, string>> => {
    const uids = Array.from(
      new Set(entries.map((e) => e.performedBy)),
    ).filter((uid) => uid && !(uid in userNames) && uid !== "system");

    if (uids.length === 0) return userNames;
    const resolved = await Promise.all(
      uids.map(async (uid) => {
        try {
          const user = await userService.getUserById(uid);

          return [uid, user?.displayName || user?.email || uid] as const;
        } catch {
          return [uid, uid] as const;
        }
      }),
    );
    const merged = { ...userNames, ...Object.fromEntries(resolved) };

    setUserNames(merged);

    return merged;
  };

  const load = async (lastDoc?: any) => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const start = parseLocalDate(dateRange.start);

      start.setHours(0, 0, 0, 0);
      const end = parseLocalDate(dateRange.end);

      end.setHours(23, 59, 59, 999);

      const { logs: page, lastDoc: newLastDoc } = await auditLogService.getLogs(
        {
          clinicId,
          eventType: "billing_discount_tax_changed",
          startDate: start,
          endDate: end,
        },
        { pageSize: 25, lastDoc },
      );

      setLogs(page);
      setHasMore(page.length === 25);
      cursorRef.current = newLastDoc;
      await resolveNames(page);
    } catch (err) {
      console.error("Error loading discount governance report:", err);
      addToast({
        title: "Error",
        description: "Could not load the discount report.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLastDocs([]);
    load(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, dateRange.start, dateRange.end]);

  const loadPage = async (direction: "next" | "prev" | "first") => {
    if (direction === "first") {
      setLastDocs([]);
      cursorRef.current = null;
      await load(undefined);

      return;
    }
    if (direction === "next") {
      const newStack = [...lastDocs, cursorRef.current];

      setLastDocs(newStack);
      await load(cursorRef.current);

      return;
    }
    // prev
    const newStack = lastDocs.slice(0, -1);

    setLastDocs(newStack);
    await load(newStack[newStack.length - 1]);
  };

  const exportToExcel = async () => {
    if (!clinicId) return;
    setExporting(true);
    try {
      const start = parseLocalDate(dateRange.start);

      start.setHours(0, 0, 0, 0);
      const end = parseLocalDate(dateRange.end);

      end.setHours(23, 59, 59, 999);

      const { logs: all } = await auditLogService.getLogs(
        {
          clinicId,
          eventType: "billing_discount_tax_changed",
          startDate: start,
          endDate: end,
        },
        { pageSize: 5000 },
      );

      const names = await resolveNames(all);
      const rows = all.map((e) => ({
        When: new Date(e.timestamp).toLocaleString(),
        Source: e.details?.source === "intake" ? "Intake" : "Settle",
        "Invoice/Visit": e.details?.invoiceNumber || e.details?.billingId || "",
        "Given By":
          (e.performedBy && names[e.performedBy]) || e.performedBy || "system",
        From: describeDiscount(e.details?.before),
        To: describeDiscount(e.details?.after),
        Reason: e.details?.after?.reason || e.details?.before?.reason || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Discounts");
      worksheet["!cols"] = [
        { wch: 20 },
        { wch: 10 },
        { wch: 16 },
        { wch: 20 },
        { wch: 10 },
        { wch: 10 },
        { wch: 40 },
      ];
      XLSX.writeFile(
        workbook,
        `Discount_Governance_${dateRange.start}_to_${dateRange.end}.xlsx`,
      );
    } catch (err) {
      console.error("Error exporting discount report:", err);
      addToast({
        title: "Export failed",
        description: "Could not export the discount report.",
        color: "danger",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4 w-full min-w-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-mountain-800 flex items-center gap-2">
            <IoPricetagOutline className="w-5 h-5 text-primary-600" />
            Discount Governance
          </h3>
          <p className="text-xs text-default-500 mt-1">
            Every discount given at Quick Intake or Settle — who gave it, how
            much, and why.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Input
            label="From"
            size="sm"
            type="date"
            value={dateRange.start}
            onValueChange={(v) => setDateRange((p) => ({ ...p, start: v }))}
          />
          <Input
            label="To"
            size="sm"
            type="date"
            value={dateRange.end}
            onValueChange={(v) => setDateRange((p) => ({ ...p, end: v }))}
          />
          <Button
            isLoading={exporting}
            size="sm"
            startContent={<IoDownloadOutline />}
            variant="flat"
            onPress={exportToExcel}
          >
            Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-default-500">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto max-w-full border border-default-200 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-default-100">
                <tr>
                  {[
                    "When",
                    "Source",
                    "Invoice/Visit",
                    "Given By",
                    "From",
                    "To",
                    "Reason",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-2 py-1.5 text-left font-semibold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((e) => (
                  <tr key={e.id} className="border-t border-default-100">
                    <td className="px-2 py-1 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          e.details?.source === "intake"
                            ? "bg-primary/10 text-primary"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        {e.details?.source === "intake" ? "Intake" : "Settle"}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {e.details?.invoiceNumber || e.details?.billingId || "-"}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {(e.performedBy && userNames[e.performedBy]) ||
                        e.performedBy ||
                        "system"}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {describeDiscount(e.details?.before)}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap font-medium">
                      {describeDiscount(e.details?.after)}
                    </td>
                    <td className="px-2 py-1 max-w-xs truncate">
                      {e.details?.after?.reason ||
                        e.details?.before?.reason || (
                          <span className="text-default-400 italic">
                            none given
                          </span>
                        )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td
                      className="px-2 py-4 text-center text-default-400"
                      colSpan={7}
                    >
                      No discounts in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              isDisabled={lastDocs.length === 0}
              size="sm"
              startContent={<IoChevronBack />}
              variant="flat"
              onPress={() => loadPage("prev")}
            >
              Prev
            </Button>
            <span className="text-xs text-default-500">
              Page {lastDocs.length + 1}
            </span>
            <Button
              isDisabled={!hasMore}
              endContent={<IoChevronForward />}
              size="sm"
              variant="flat"
              onPress={() => loadPage("next")}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
