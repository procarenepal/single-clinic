import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IoAlertCircleOutline, IoRefreshOutline } from "react-icons/io5";

import { Button } from "@/components/ui/button";
import {
  AppointmentBilling,
  PathologyBilling,
  MedicinePurchase,
} from "@/types/models";
import { addToast } from "@/components/ui/toast";

interface IrdSyncFailuresReportProps {
  billings: AppointmentBilling[];
  pathologyBillings: PathologyBilling[];
  medicinePurchases: MedicinePurchase[];
}

type ModuleType = "appointment" | "pathology" | "pharmacy";

interface FailureRow {
  key: string;
  recordId: string;
  module: ModuleType;
  moduleLabel: string;
  invoiceNumber: string;
  name: string;
  amount: number;
  date: Date;
  cbmsResponseCode?: string;
  link: string;
}

const fmtCur = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;
const moduleLabels: Record<ModuleType, string> = {
  appointment: "Appointment",
  pathology: "Pathology",
  pharmacy: "Pharmacy",
};

/**
 * Clinic-wide queue of every invoice/purchase where an IRD sync was
 * genuinely ATTEMPTED (irdSynced or cbmsResponseCode set — see
 * IrdSyncBadge.tsx) but did not succeed, combined across all 3 billing
 * modules — so failures don't have to be hunted down per-module list. A
 * point-in-time snapshot, intentionally not scoped to the Reports page's
 * date-range filter: a failed sync from last month is still unresolved
 * today.
 */
export const IrdSyncFailuresReport: React.FC<IrdSyncFailuresReportProps> = ({
  billings,
  pathologyBillings,
  medicinePurchases,
}) => {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const failures = useMemo<FailureRow[]>(() => {
    const rows: FailureRow[] = [];

    billings
      .filter(
        (b) =>
          !b.irdSynced &&
          Boolean(b.cbmsResponseCode) &&
          b.status !== "cancelled",
      )
      .forEach((b) =>
        rows.push({
          key: `appointment:${b.id}`,
          recordId: b.id,
          module: "appointment",
          moduleLabel: moduleLabels.appointment,
          invoiceNumber: b.invoiceNumber,
          name: b.patientName || "Cash Sales",
          amount: b.totalAmount,
          date: new Date(b.invoiceDate),
          cbmsResponseCode: b.cbmsResponseCode,
          link: `/dashboard/appointments-billing/${b.id}`,
        }),
      );

    pathologyBillings
      .filter(
        (b) =>
          !b.irdSynced &&
          Boolean(b.cbmsResponseCode) &&
          b.status !== "cancelled",
      )
      .forEach((b) =>
        rows.push({
          key: `pathology:${b.id}`,
          recordId: b.id,
          module: "pathology",
          moduleLabel: moduleLabels.pathology,
          invoiceNumber: b.invoiceNumber,
          name: b.patientName || "Cash Sales",
          amount: b.totalAmount,
          date: new Date(b.invoiceDate),
          cbmsResponseCode: b.cbmsResponseCode,
          link: `/dashboard/pathology-billing/${b.id}`,
        }),
      );

    medicinePurchases
      .filter((p) => !p.irdSynced && Boolean(p.cbmsResponseCode))
      .forEach((p) =>
        rows.push({
          key: `pharmacy:${p.id}`,
          recordId: p.id,
          module: "pharmacy",
          moduleLabel: moduleLabels.pharmacy,
          invoiceNumber: p.purchaseNo,
          name: p.patientName || "Walk-in Customer",
          amount: p.netAmount,
          date: new Date(p.purchaseDate),
          cbmsResponseCode: p.cbmsResponseCode,
          link: `/dashboard/pharmacy/purchase/${p.id}`,
        }),
      );

    return rows
      .filter((r) => !resolvedIds.has(r.key))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [billings, pathologyBillings, medicinePurchases, resolvedIds]);

  const handleRetry = async (row: FailureRow) => {
    setRetryingId(row.key);
    try {
      const { retryIrdSync } = await import("@/services/irdCbmsService");
      const res = await retryIrdSync(row.recordId, row.module);

      if (res.success) {
        addToast({
          title: "IRD Sync successful!",
          description: `${row.invoiceNumber} is now synced.`,
          color: "success",
        });
        setResolvedIds((prev) => new Set(prev).add(row.key));
      } else {
        addToast({
          title: "IRD Sync failed again",
          description: res.message,
          color: "danger",
        });
      }
    } catch (e) {
      addToast({ title: "Error during retry sync", color: "danger" });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-text-main flex items-center gap-2">
            <IoAlertCircleOutline className="w-4 h-4 text-danger" />
            IRD Sync Failures
          </h3>
          <p className="text-[12px] text-text-muted/60">
            Every invoice/purchase across all 3 modules where an IRD sync was
            attempted but did not succeed. Retry from here instead of hunting
            them down per-module.
          </p>
        </div>
        {failures.length > 0 && (
          <span className="text-[11px] px-2 py-1 rounded bg-danger-50 text-danger-600 border border-danger-200 font-medium">
            {failures.length} unresolved
          </span>
        )}
      </div>

      {failures.length === 0 ? (
        <div className="text-center py-12 border border-border-base rounded bg-surface">
          <p className="text-[13px] text-text-muted">
            No sync failures right now — everything that's been attempted has
            synced.
          </p>
        </div>
      ) : (
        <div className="border border-border-base rounded overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-2 border-b border-border-base">
                <tr>
                  {[
                    "MODULE",
                    "INVOICE #",
                    "PATIENT",
                    "DATE",
                    "AMOUNT",
                    "RESPONSE",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[10.5px] font-semibold text-primary uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base">
                {failures.map((row) => (
                  <tr key={row.key} className="hover:bg-surface-2">
                    <td className="px-3 py-2.5 text-[11.5px] text-text-muted">
                      {row.moduleLabel}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] font-mono">
                      <Link
                        className="text-primary hover:underline"
                        to={row.link}
                      >
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-text-main">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-text-muted">
                      {row.date.toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] font-semibold text-text-main">
                      {fmtCur(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-danger-600 font-mono">
                      {row.cbmsResponseCode || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button
                        color="primary"
                        isLoading={retryingId === row.key}
                        size="sm"
                        startContent={<IoRefreshOutline className="w-3.5 h-3.5" />}
                        variant="bordered"
                        onClick={() => handleRetry(row)}
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
