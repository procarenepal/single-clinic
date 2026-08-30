import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import {
  IoDownloadOutline,
  IoWalletOutline,
  IoSearchOutline,
} from "react-icons/io5";
import { Button } from "@/components/ui/button";
import {
  AppointmentBilling,
  PathologyBilling,
  MedicinePurchase,
  Patient,
} from "@/types/models";

interface OutstandingBalancesReportProps {
  billings: AppointmentBilling[];
  pathologyBillings: PathologyBilling[];
  medicinePurchases: MedicinePurchase[];
  patients: Patient[];
}

type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

interface OutstandingGroup {
  key: string;
  patientId?: string;
  name: string;
  appointmentDue: number;
  pathologyDue: number;
  pharmacyDue: number;
  totalDue: number;
  oldestDueDate: Date;
  daysOverdue: number;
  bucket: AgingBucket;
  // Only set for unlinked (no patientId) groups — a single record's own
  // detail page, since there's no patient page to send it to.
  singleRecordLink?: string;
}

const fmtCur = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;

const getBucket = (daysOverdue: number): AgingBucket => {
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";

  return "90+";
};

// Pharmacy stores no balanceAmount — derive it the same way purchase-detail.tsx
// and the Patient Billing Summary already do (return-adjusted net minus payments).
const getPharmacyDue = (purchase: MedicinePurchase) => {
  const totalReturnedAmount =
    typeof purchase.totalReturnedAmount === "number" &&
    purchase.totalReturnedAmount > 0
      ? purchase.totalReturnedAmount
      : (purchase.returns ?? []).reduce(
          (sum, r) => sum + Math.abs(r.totalAmount || 0),
          0,
        );
  const netAfterReturns = Math.max(
    0,
    (purchase.netAmount || 0) - totalReturnedAmount,
  );
  const paidAmount = Math.round(
    (purchase.paymentHistory || []).reduce((s, p) => s + p.amount, 0),
  );

  return Math.max(0, netAfterReturns - paidAmount);
};

/**
 * Clinic-wide view of every patient/customer who currently owes money,
 * combined across Appointment Billing, Pathology Billing, and Pharmacy —
 * the companion to the per-patient Unified Billing Summary on the Patient
 * detail page. A point-in-time snapshot: intentionally NOT scoped to the
 * Reports page's date-range filter, since an old unpaid invoice is still
 * owed regardless of when it was created.
 */
export const OutstandingBalancesReport: React.FC<
  OutstandingBalancesReportProps
> = ({ billings, pathologyBillings, medicinePurchases, patients }) => {
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<AgingBucket | "all">(
    "all",
  );

  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();

    patients.forEach((p) => map.set(p.id, p.name));

    return map;
  }, [patients]);

  const groups = useMemo<OutstandingGroup[]>(() => {
    const now = Date.now();
    const byKey = new Map<
      string,
      {
        patientId?: string;
        name: string;
        appointmentDue: number;
        pathologyDue: number;
        pharmacyDue: number;
        oldestDueDate: Date;
        singleRecordLink?: string;
      }
    >();

    const keyFor = (patientId: string | undefined, module: string, recordId: string) =>
      patientId ? `patient:${patientId}` : `unlinked:${module}:${recordId}`;

    const upsert = (
      patientId: string | undefined,
      module: string,
      recordId: string,
      name: string,
      amount: number,
      dueDate: Date,
      field: "appointmentDue" | "pathologyDue" | "pharmacyDue",
      singleRecordLink: string,
    ) => {
      if (amount <= 0) return;
      const key = keyFor(patientId, module, recordId);
      const existing = byKey.get(key);

      if (existing) {
        existing[field] += amount;
        if (dueDate < existing.oldestDueDate) existing.oldestDueDate = dueDate;
      } else {
        byKey.set(key, {
          patientId,
          name: patientId ? patientNameById.get(patientId) || name : name,
          appointmentDue: field === "appointmentDue" ? amount : 0,
          pathologyDue: field === "pathologyDue" ? amount : 0,
          pharmacyDue: field === "pharmacyDue" ? amount : 0,
          oldestDueDate: dueDate,
          singleRecordLink: patientId ? undefined : singleRecordLink,
        });
      }
    };

    billings
      .filter((b) => b.balanceAmount > 0 && b.status !== "cancelled")
      .forEach((b) =>
        upsert(
          b.patientId,
          "appointment",
          b.id,
          b.patientName,
          b.balanceAmount,
          new Date(b.invoiceDate),
          "appointmentDue",
          `/dashboard/appointments-billing/${b.id}`,
        ),
      );

    pathologyBillings
      .filter((b) => b.balanceAmount > 0 && b.status !== "cancelled")
      .forEach((b) =>
        upsert(
          b.patientId,
          "pathology",
          b.id,
          b.patientName,
          b.balanceAmount,
          new Date(b.invoiceDate),
          "pathologyDue",
          `/dashboard/pathology-billing/${b.id}`,
        ),
      );

    medicinePurchases.forEach((p) => {
      const due = getPharmacyDue(p);

      if (due <= 0) return;
      const patientId = (p as any).patientId;

      upsert(
        patientId && patientId !== "walk-in-pharmacy" ? patientId : undefined,
        "pharmacy",
        p.id,
        p.patientName || "Walk-in Customer",
        due,
        new Date(p.purchaseDate),
        "pharmacyDue",
        `/dashboard/pharmacy/purchase/${p.id}`,
      );
    });

    return Array.from(byKey.entries())
      .map(([key, v]) => {
        const totalDue = v.appointmentDue + v.pathologyDue + v.pharmacyDue;
        const daysOverdue = Math.max(
          0,
          Math.floor((now - v.oldestDueDate.getTime()) / (1000 * 60 * 60 * 24)),
        );

        return {
          key,
          patientId: v.patientId,
          name: v.name,
          appointmentDue: v.appointmentDue,
          pathologyDue: v.pathologyDue,
          pharmacyDue: v.pharmacyDue,
          totalDue,
          oldestDueDate: v.oldestDueDate,
          daysOverdue,
          bucket: getBucket(daysOverdue),
          singleRecordLink: v.singleRecordLink,
        };
      })
      .sort((a, b) => b.totalDue - a.totalDue);
  }, [billings, pathologyBillings, medicinePurchases, patientNameById]);

  const filtered = groups.filter((g) => {
    if (bucketFilter !== "all" && g.bucket !== bucketFilter) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()))
      return false;

    return true;
  });

  const summary = {
    total: groups.reduce((s, g) => s + g.totalDue, 0),
    count: groups.length,
    appointment: groups.reduce((s, g) => s + g.appointmentDue, 0),
    pathology: groups.reduce((s, g) => s + g.pathologyDue, 0),
    pharmacy: groups.reduce((s, g) => s + g.pharmacyDue, 0),
    overdue90: groups
      .filter((g) => g.bucket === "90+")
      .reduce((s, g) => s + g.totalDue, 0),
  };

  const exportToExcel = () => {
    const exportData = filtered.map((g) => ({
      Name: g.name,
      "Appointment Due": g.appointmentDue,
      "Pathology Due": g.pathologyDue,
      "Pharmacy Due": g.pharmacyDue,
      "Total Due": g.totalDue,
      "Oldest Due Date": g.oldestDueDate.toLocaleDateString(),
      "Days Overdue": g.daysOverdue,
      Linked: g.patientId ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Outstanding Balances");
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
    ];
    XLSX.writeFile(workbook, "Outstanding_Balances_Report.xlsx");
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-mountain-800 flex items-center gap-2">
            <IoWalletOutline className="w-5 h-5 text-primary-600" />
            Outstanding Balances
          </h3>
          <p className="text-xs text-mountain-500">
            Every patient/customer with an unpaid balance, combined across
            Appointment, Pathology, and Pharmacy — a snapshot as of now, not
            scoped to the date range above.
          </p>
        </div>
        <Button
          color="primary"
          isDisabled={filtered.length === 0}
          size="sm"
          startContent={<IoDownloadOutline className="w-4 h-4" />}
          onPress={exportToExcel}
        >
          Export Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="clarity-card p-3 border border-mountain-200 rounded-lg text-center">
          <p className="text-lg font-bold text-mountain-900">
            {fmtCur(summary.total)}
          </p>
          <p className="text-[11px] text-mountain-500 mt-0.5">
            Total Outstanding
          </p>
        </div>
        <div className="clarity-card p-3 border border-mountain-200 rounded-lg text-center">
          <p className="text-lg font-bold text-mountain-900">
            {summary.count}
          </p>
          <p className="text-[11px] text-mountain-500 mt-0.5">
            With a Balance
          </p>
        </div>
        <div className="clarity-card p-3 border border-mountain-200 rounded-lg text-center">
          <p className="text-lg font-bold text-mountain-900">
            {fmtCur(summary.appointment)}
          </p>
          <p className="text-[11px] text-mountain-500 mt-0.5">Appointment</p>
        </div>
        <div className="clarity-card p-3 border border-mountain-200 rounded-lg text-center">
          <p className="text-lg font-bold text-mountain-900">
            {fmtCur(summary.pathology + summary.pharmacy)}
          </p>
          <p className="text-[11px] text-mountain-500 mt-0.5">
            Pathology + Pharmacy
          </p>
        </div>
        <div className="clarity-card p-3 border border-danger-200 bg-danger-50 rounded-lg text-center">
          <p className="text-lg font-bold text-danger-700">
            {fmtCur(summary.overdue90)}
          </p>
          <p className="text-[11px] text-danger-600 mt-0.5">
            90+ Days Overdue
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center h-9 border border-mountain-200 rounded bg-white flex-1 max-w-sm">
          <IoSearchOutline className="ml-2.5 w-4 h-4 text-mountain-400 shrink-0" />
          <input
            className="flex-1 text-[12.5px] px-2 bg-transparent focus:outline-none text-mountain-800 placeholder:text-mountain-400"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "0-30", "31-60", "61-90", "90+"] as const).map((b) => (
            <button
              key={b}
              className={`px-2.5 py-1.5 text-[11.5px] font-medium rounded border ${
                bucketFilter === b
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-mountain-600 border-mountain-200 hover:bg-mountain-50"
              }`}
              type="button"
              onClick={() => setBucketFilter(b)}
            >
              {b === "all" ? "All" : `${b} days`}
            </button>
          ))}
        </div>
      </div>

      <div className="clarity-card p-0 overflow-hidden border border-mountain-200 rounded-lg">
        <div className="px-4 py-2.5 bg-mountain-50 border-b border-mountain-200 flex justify-between items-center">
          <h4 className="text-xs font-bold uppercase tracking-wider text-mountain-700">
            Outstanding Register
          </h4>
          <span className="text-xs text-mountain-500 font-medium">
            Showing {filtered.length} of {groups.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="clarity-table min-w-full w-full text-xs">
            <thead>
              <tr className="bg-mountain-100/50">
                <th>Name</th>
                <th className="text-right">Appointment</th>
                <th className="text-right">Pathology</th>
                <th className="text-right">Pharmacy</th>
                <th className="text-right">Total</th>
                <th>Oldest Due</th>
                <th className="text-right">Days Overdue</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    className="text-center py-6 text-mountain-400 font-medium"
                    colSpan={8}
                  >
                    No outstanding balances found.
                  </td>
                </tr>
              ) : (
                filtered.map((g) => (
                  <tr key={g.key}>
                    <td className="font-medium text-mountain-800">
                      {g.name}
                      {!g.patientId && (
                        <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[9.5px] rounded bg-mountain-100 text-mountain-500 font-medium">
                          unlinked
                        </span>
                      )}
                    </td>
                    <td className="text-right text-mountain-700">
                      {g.appointmentDue > 0 ? fmtCur(g.appointmentDue) : "-"}
                    </td>
                    <td className="text-right text-mountain-700">
                      {g.pathologyDue > 0 ? fmtCur(g.pathologyDue) : "-"}
                    </td>
                    <td className="text-right text-mountain-700">
                      {g.pharmacyDue > 0 ? fmtCur(g.pharmacyDue) : "-"}
                    </td>
                    <td className="text-right font-bold text-mountain-900">
                      {fmtCur(g.totalDue)}
                    </td>
                    <td className="whitespace-nowrap text-mountain-700">
                      {g.oldestDueDate.toLocaleDateString()}
                    </td>
                    <td
                      className={`text-right font-semibold ${
                        g.bucket === "90+"
                          ? "text-danger-600"
                          : g.bucket === "61-90"
                            ? "text-warning-600"
                            : "text-mountain-700"
                      }`}
                    >
                      {g.daysOverdue}
                    </td>
                    <td>
                      {g.patientId ? (
                        <Link
                          className="text-primary-600 font-semibold hover:underline text-[11.5px]"
                          to={`/dashboard/patients/${g.patientId}`}
                        >
                          View Patient
                        </Link>
                      ) : (
                        <Link
                          className="text-primary-600 font-semibold hover:underline text-[11.5px]"
                          to={g.singleRecordLink || "#"}
                        >
                          View Record
                        </Link>
                      )}
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
