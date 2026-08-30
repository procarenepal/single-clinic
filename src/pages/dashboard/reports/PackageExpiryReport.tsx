import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import {
  IoDownloadOutline,
  IoAlarmOutline,
  IoSendOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";
import { PatientPackage, Patient } from "@/types/models";
import { smsService } from "@/services/sendMessageService";

interface PackageExpiryReportProps {
  patientPackages: PatientPackage[];
  patients: Patient[];
  clinicId: string;
  branchId?: string;
  createdBy: string;
}

/**
 * Clinic-wide view of packages nearing expiry (or already expired with
 * unused sessions) — a point-in-time snapshot, not scoped to the Reports
 * page's date-range filter, since an expiring package matters regardless
 * of when it was purchased (same reasoning as OutstandingBalancesReport).
 */
export const PackageExpiryReport: React.FC<PackageExpiryReportProps> = ({
  patientPackages,
  patients,
  clinicId,
  branchId,
  createdBy,
}) => {
  const [windowDays, setWindowDays] = useState(30);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const patientById = useMemo(() => {
    const map = new Map<string, Patient>();

    patients.forEach((p) => map.set(p.id, p));

    return map;
  }, [patients]);

  const rows = useMemo(() => {
    const now = Date.now();

    return patientPackages
      .filter(
        (p) =>
          p.expiresAt &&
          (p.status === "active" || p.status === "expired") &&
          p.totalSessions - p.usedSessions > 0,
      )
      .map((p) => {
        const expiresAt = p.expiresAt as Date;
        const daysRemaining = Math.ceil(
          (expiresAt.getTime() - now) / (1000 * 60 * 60 * 24),
        );
        const patient = patientById.get(p.patientId);

        return {
          pkg: p,
          patient,
          daysRemaining,
          expiresAt,
        };
      })
      .filter((r) => r.daysRemaining <= windowDays)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [patientPackages, patientById, windowDays]);

  const handleSendReminder = async (row: (typeof rows)[number]) => {
    if (!row.patient?.mobile) {
      addToast({
        title: "No mobile number",
        description: "This patient has no mobile number on file.",
        color: "warning",
      });

      return;
    }

    const unusedSessions = row.pkg.totalSessions - row.pkg.usedSessions;
    const message =
      row.daysRemaining < 0
        ? `Hi ${row.patient.name}, your ${row.pkg.packageName} package (${unusedSessions} session(s) remaining) expired on ${row.expiresAt.toLocaleDateString()}. Please contact us to arrange your remaining sessions.`
        : `Hi ${row.patient.name}, your ${row.pkg.packageName} package (${unusedSessions} session(s) remaining) expires on ${row.expiresAt.toLocaleDateString()}. Book your remaining sessions soon!`;

    setSendingId(row.pkg.id);
    try {
      await smsService.sendManualSMS(
        clinicId,
        row.patient.mobile,
        message,
        "patient",
        row.patient.id,
        row.patient.name,
        createdBy,
        undefined,
        branchId,
      );
      addToast({
        title: "Reminder Sent",
        description: `SMS sent to ${row.patient.name}.`,
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Failed to Send",
        description:
          error instanceof Error ? error.message : "Could not send SMS.",
        color: "danger",
      });
    } finally {
      setSendingId(null);
    }
  };

  const exportToExcel = () => {
    const exportData = rows.map((r) => ({
      Patient: r.patient?.name || r.pkg.patientId,
      Package: r.pkg.packageName,
      "Sessions Used": r.pkg.usedSessions,
      "Total Sessions": r.pkg.totalSessions,
      "Expiry Date": r.expiresAt.toLocaleDateString(),
      "Days Remaining": r.daysRemaining,
      Status: r.daysRemaining < 0 ? "Expired" : "Active",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Package Expiry");
    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 26 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
    ];
    XLSX.writeFile(workbook, "Package_Expiry_Report.xlsx");
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-mountain-800 flex items-center gap-2">
            <IoAlarmOutline className="w-5 h-5 text-primary-600" />
            Package Expiry
          </h3>
          <p className="text-xs text-mountain-500">
            Patient packages with unused sessions expiring soon or already
            expired — a snapshot as of now, not scoped to the date range
            above.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs border border-mountain-200 rounded-lg px-2 py-1.5"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          >
            <option value={7}>Within 7 days</option>
            <option value={30}>Within 30 days</option>
            <option value={90}>Within 90 days</option>
          </select>
          <Button
            color="primary"
            isDisabled={rows.length === 0}
            size="sm"
            startContent={<IoDownloadOutline className="w-4 h-4" />}
            onPress={exportToExcel}
          >
            Export Excel
          </Button>
        </div>
      </div>

      <div className="clarity-card border border-mountain-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mountain-50 text-mountain-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Patient</th>
                <th className="text-left px-4 py-2.5">Package</th>
                <th className="text-left px-4 py-2.5">Sessions</th>
                <th className="text-left px-4 py-2.5">Expiry Date</th>
                <th className="text-left px-4 py-2.5">Days Remaining</th>
                <th className="text-left px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mountain-100">
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-mountain-400"
                    colSpan={6}
                  >
                    No packages expiring within {windowDays} days.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.pkg.id} className="hover:bg-mountain-50/50">
                    <td className="px-4 py-2.5">
                      {r.patient ? (
                        <Link
                          className="text-primary-600 hover:underline font-medium"
                          to={`/dashboard/patients/${r.patient.id}`}
                        >
                          {r.patient.name}
                        </Link>
                      ) : (
                        <span className="text-mountain-400">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{r.pkg.packageName}</td>
                    <td className="px-4 py-2.5">
                      {r.pkg.usedSessions} / {r.pkg.totalSessions}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.expiresAt.toLocaleDateString()}
                    </td>
                    <td
                      className={`px-4 py-2.5 font-semibold ${
                        r.daysRemaining < 0
                          ? "text-danger-600"
                          : r.daysRemaining <= 7
                            ? "text-danger-600"
                            : r.daysRemaining <= 30
                              ? "text-warning-600"
                              : "text-mountain-700"
                      }`}
                    >
                      {r.daysRemaining < 0
                        ? `Expired ${Math.abs(r.daysRemaining)}d ago`
                        : `${r.daysRemaining}d`}
                    </td>
                    <td className="px-4 py-2.5">
                      <Button
                        color="primary"
                        isDisabled={!r.patient?.mobile}
                        isLoading={sendingId === r.pkg.id}
                        size="sm"
                        startContent={<IoSendOutline className="w-3.5 h-3.5" />}
                        variant="flat"
                        onPress={() => handleSendReminder(r)}
                      >
                        Send Reminder
                      </Button>
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
