import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import NepaliDate from "nepali-datetime";
import { IoDownloadOutline, IoFilterOutline, IoReceiptOutline, IoRefreshOutline } from "react-icons/io5";
import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";
import { retryIrdSync } from "@/services/irdCbmsService";
import { AppointmentBilling, PathologyBilling, MedicinePurchase } from "@/types/models";

interface IrdAnnexureReportProps {
  billings: AppointmentBilling[];
  pathologyBillings: PathologyBilling[];
  medicinePurchases?: MedicinePurchase[];
}

export interface CombinedIrdRecord {
  id: string;
  date: string;
  bsDate: string;
  invoiceNumber: string;
  buyerName: string;
  buyerPan: string;
  totalAmount: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  taxExemptAmount: number;
  isCreditNote: boolean;
  irdSynced: boolean;
  irdSyncDate?: string;
  cbmsResponseCode?: string;
  timestamp: number;
  source: "Appointment" | "Pathology" | "Pharmacy";
}

const formatNepaliDate = (date: Date | string): string => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    const nepali = new NepaliDate(d);
    return nepali.format("YYYY-MM-DD");
  } catch {
    return "-";
  }
};

export const IrdAnnexureReport: React.FC<IrdAnnexureReportProps> = ({
  billings,
  pathologyBillings,
  medicinePurchases = [],
}) => {
  const [activeTab, setActiveTab] = useState<"annexure13" | "annexure14">("annexure13");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedSyncStatus, setSelectedSyncStatus] = useState<string>("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetrySync = async (record: CombinedIrdRecord) => {
    setRetryingId(record.id);
    try {
      const typeMap: Record<string, "appointment" | "pathology" | "pharmacy"> = {
        Appointment: "appointment",
        Pathology: "pathology",
        Pharmacy: "pharmacy",
      };
      const type = typeMap[record.source] || "appointment";
      const res = await retryIrdSync(record.id, type, record.isCreditNote);

      if (res.success) {
        addToast({ title: "IRD Sync Successful", description: `Invoice ${record.invoiceNumber} synced to IRD.`, color: "success" });
      } else {
        addToast({ title: "IRD Sync Result", description: res.message || "Sync attempt finished.", color: res.success ? "success" : "danger" });
      }
    } catch (err: any) {
      addToast({ title: "Sync Error", description: err.message || "Error retrying IRD sync.", color: "danger" });
    } finally {
      setRetryingId(null);
    }
  };

  // Combine and normalize data from Appointments, Pathology, and Pharmacy
  const allRecords = useMemo<CombinedIrdRecord[]>(() => {
    const formattedBillings: CombinedIrdRecord[] = billings.map((b) => {
      const total = b.totalAmount || 0;
      const tax = b.taxAmount || 0;
      const discount = (b.discountAmount || 0) + (b.mainDiscountAmount || 0) + (b.itemDiscountAmount || 0);
      const isTaxed = (b.taxPercentage || 0) > 0 || tax > 0;
      const taxable = isTaxed ? b.taxableAmount || Math.max(0, total - tax) : 0;
      const exempt = isTaxed ? 0 : b.taxableAmount || total;

      return {
        id: b.id,
        date: new Date(b.invoiceDate).toLocaleDateString(),
        bsDate: formatNepaliDate(b.invoiceDate),
        invoiceNumber: b.invoiceNumber || "N/A",
        buyerName: b.patientName || "Cash Sales",
        buyerPan: "",
        totalAmount: total,
        discount,
        taxableAmount: taxable,
        taxAmount: tax,
        taxExemptAmount: exempt,
        isCreditNote: b.isCreditNote || false,
        irdSynced: !!b.irdSynced,
        irdSyncDate: b.irdSyncDate ? new Date(b.irdSyncDate).toLocaleString() : undefined,
        cbmsResponseCode: b.cbmsResponseCode,
        timestamp: new Date(b.invoiceDate).getTime(),
        source: "Appointment",
      };
    });

    const formattedPathology: CombinedIrdRecord[] = pathologyBillings.map((b) => {
      const total = b.totalAmount || 0;
      const tax = b.taxAmount || 0;
      const discount = b.discountAmount || 0;
      const isTaxed = (b.taxPercentage || 0) > 0 || tax > 0;
      const taxable = isTaxed ? (b as any).taxableAmount || Math.max(0, total - tax) : 0;
      const exempt = isTaxed ? 0 : (b as any).taxableAmount || total;

      return {
        id: b.id,
        date: new Date(b.invoiceDate).toLocaleDateString(),
        bsDate: formatNepaliDate(b.invoiceDate),
        invoiceNumber: b.invoiceNumber || "N/A",
        buyerName: b.patientName || "Cash Sales",
        buyerPan: "",
        totalAmount: total,
        discount,
        taxableAmount: taxable,
        taxAmount: tax,
        taxExemptAmount: exempt,
        isCreditNote: b.isCreditNote || false,
        irdSynced: !!b.irdSynced,
        irdSyncDate: b.irdSyncDate ? new Date(b.irdSyncDate).toLocaleString() : undefined,
        cbmsResponseCode: b.cbmsResponseCode,
        timestamp: new Date(b.invoiceDate).getTime(),
        source: "Pathology",
      };
    });

    const formattedPharmacy: CombinedIrdRecord[] = [];
    medicinePurchases.forEach((p) => {
      const total = p.netAmount || 0;
      const tax = p.taxAmount || 0;
      const discount = p.discount || 0;
      const isTaxed = (p.taxPercentage || 0) > 0 || tax > 0;
      const taxable = isTaxed ? Math.max(0, total - tax) : 0;
      const exempt = isTaxed ? 0 : total;
      const dateVal = p.purchaseDate || p.createdAt || new Date();

      // Original Sale -> Annexure 13
      formattedPharmacy.push({
        id: p.id,
        date: new Date(dateVal).toLocaleDateString(),
        bsDate: formatNepaliDate(dateVal),
        invoiceNumber: p.purchaseNo || "N/A",
        buyerName: p.patientName || "Cash Sales",
        buyerPan: "",
        totalAmount: total,
        discount,
        taxableAmount: taxable,
        taxAmount: tax,
        taxExemptAmount: exempt,
        isCreditNote: false, // Original purchase is never a credit note
        irdSynced: !!p.irdSynced,
        irdSyncDate: p.irdSyncDate ? new Date(p.irdSyncDate).toLocaleString() : undefined,
        cbmsResponseCode: p.cbmsResponseCode,
        timestamp: new Date(dateVal).getTime(),
        source: "Pharmacy",
      });

      // Returns -> Annexure 14
      if (p.returns && p.returns.length > 0) {
        p.returns.forEach((ret: any) => {
          const retTotal = Math.abs(ret.totalAmount || 0);
          const retTaxRatio = total > 0 ? tax / total : 0;
          const retTax = retTotal * retTaxRatio;
          const retTaxable = isTaxed ? Math.max(0, retTotal - retTax) : 0;
          const retExempt = isTaxed ? 0 : retTotal;
          // Use return date or fallback to original purchase date
          const retDateVal = ret.createdAt?.toDate?.() || ret.createdAt || dateVal;

          formattedPharmacy.push({
            id: p.id, // For retry purposes, retrying the pharmacy purchase
            date: new Date(retDateVal).toLocaleDateString(),
            bsDate: formatNepaliDate(retDateVal),
            invoiceNumber: p.purchaseNo || "N/A",
            buyerName: p.patientName || "Cash Sales",
            buyerPan: "",
            totalAmount: retTotal,
            discount: 0,
            taxableAmount: retTaxable,
            taxAmount: retTax,
            taxExemptAmount: retExempt,
            isCreditNote: true, // This is a return/credit note
            irdSynced: true, // Note: Individual return sync status is not tracked in model
            irdSyncDate: p.irdSyncDate ? new Date(p.irdSyncDate).toLocaleString() : undefined,
            cbmsResponseCode: p.cbmsResponseCode,
            timestamp: new Date(retDateVal).getTime(),
            source: "Pharmacy",
          });
        });
      }
    });

    return [...formattedBillings, ...formattedPathology, ...formattedPharmacy].sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }, [billings, pathologyBillings, medicinePurchases]);

  // Filter records based on active tab, selected module, and sync status
  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      // Tab filter
      if (activeTab === "annexure13" && rec.isCreditNote) return false;
      if (activeTab === "annexure14" && !rec.isCreditNote) return false;

      // Module filter
      if (selectedModule !== "all" && rec.source.toLowerCase() !== selectedModule.toLowerCase()) {
        return false;
      }

      // Sync status filter
      if (selectedSyncStatus === "synced" && !rec.irdSynced) return false;
      if (selectedSyncStatus === "pending" && rec.irdSynced) return false;

      return true;
    });
  }, [allRecords, activeTab, selectedModule, selectedSyncStatus]);

  // Summary Totals
  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, r) => ({
        totalSales: acc.totalSales + r.totalAmount,
        discount: acc.discount + r.discount,
        taxable: acc.taxable + r.taxableAmount,
        vat: acc.vat + r.taxAmount,
        exempt: acc.exempt + r.taxExemptAmount,
      }),
      { totalSales: 0, discount: 0, taxable: 0, vat: 0, exempt: 0 }
    );
  }, [filteredRecords]);

  // Export Annexure 13 / 14 to Excel
  const exportToExcel = () => {
    const isAnnexure14 = activeTab === "annexure14";
    const filename = isAnnexure14 ? "IRD_Annexure_14_Sales_Return_Report.xlsx" : "IRD_Annexure_13_Sales_Book_Report.xlsx";
    const sheetName = isAnnexure14 ? "Annexure 14 (Returns)" : "Annexure 13 (Sales)";

    const exportData = filteredRecords.map((row) => ({
      "Date (AD)": row.date,
      "Date (BS Miti)": row.bsDate,
      "Invoice Number": row.invoiceNumber,
      "Source Module": row.source,
      "Buyer Name": row.buyerName,
      "Buyer PAN": row.buyerPan || "-",
      "Total Amount (NPR)": row.totalAmount.toFixed(2),
      "Discount (NPR)": row.discount.toFixed(2),
      "Taxable Amount (NPR)": row.taxableAmount.toFixed(2),
      "13% VAT (NPR)": row.taxAmount.toFixed(2),
      "Tax Exempt Sales (NPR)": row.taxExemptAmount.toFixed(2),
      "IRD Synced": row.irdSynced ? "Yes" : "Pending",
      "CBMS Response Code": row.cbmsResponseCode || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const colWidths = [
      { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 14 },
      { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
      { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 18 }
    ];
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-mountain-800 flex items-center gap-2">
            <IoReceiptOutline className="w-5 h-5 text-primary-600" />
            Nepal IRD CBMS Compliance Audit Reports
          </h3>
          <p className="text-xs text-mountain-500">
            Materialized sales and return registers formatted for Inland Revenue Department (IRD) tax verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            color="primary"
            isDisabled={filteredRecords.length === 0}
            size="sm"
            startContent={<IoDownloadOutline className="w-4 h-4" />}
            onPress={exportToExcel}
          >
            Export Excel ({activeTab === "annexure13" ? "Annexure 13" : "Annexure 14"})
          </Button>
        </div>
      </div>

      {/* Tab Navigation & Filters */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-mountain-200 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("annexure13")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === "annexure13"
                ? "bg-primary-600 text-white shadow-sm"
                : "bg-mountain-100 text-mountain-700 hover:bg-mountain-200"
            }`}
          >
            Annexure 13 (Sales Book)
          </button>
          <button
            onClick={() => setActiveTab("annexure14")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === "annexure14"
                ? "bg-danger-600 text-white shadow-sm"
                : "bg-mountain-100 text-mountain-700 hover:bg-mountain-200"
            }`}
          >
            Annexure 14 (Sales Return / Credit Notes)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-mountain-600">
            <IoFilterOutline className="w-3.5 h-3.5" />
            <span>Module:</span>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="text-xs border border-mountain-300 rounded px-2 py-1 bg-white text-mountain-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Modules</option>
              <option value="appointment">Appointments</option>
              <option value="pathology">Pathology</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs text-mountain-600">
            <span>Sync Status:</span>
            <select
              value={selectedSyncStatus}
              onChange={(e) => setSelectedSyncStatus(e.target.value)}
              className="text-xs border border-mountain-300 rounded px-2 py-1 bg-white text-mountain-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="synced">IRD Synced Only</option>
              <option value="pending">Sync Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 bg-mountain-50 border border-mountain-200 rounded-lg">
          <p className="text-[11px] font-medium text-mountain-500 uppercase">Total Sales</p>
          <p className="text-sm font-bold text-mountain-900">NPR {totals.totalSales.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-mountain-50 border border-mountain-200 rounded-lg">
          <p className="text-[11px] font-medium text-mountain-500 uppercase">Total Discount</p>
          <p className="text-sm font-bold text-warning-700">NPR {totals.discount.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-mountain-50 border border-mountain-200 rounded-lg">
          <p className="text-[11px] font-medium text-mountain-500 uppercase">Taxable Sales</p>
          <p className="text-sm font-bold text-primary-700">NPR {totals.taxable.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-mountain-50 border border-mountain-200 rounded-lg">
          <p className="text-[11px] font-medium text-mountain-500 uppercase">13% VAT Collected</p>
          <p className="text-sm font-bold text-success-700">NPR {totals.vat.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-mountain-50 border border-mountain-200 rounded-lg col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium text-mountain-500 uppercase">Tax Exempt Sales</p>
          <p className="text-sm font-bold text-mountain-700">NPR {totals.exempt.toLocaleString()}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="clarity-card p-0 overflow-hidden border border-mountain-200 rounded-lg">
        <div className="px-4 py-2.5 bg-mountain-50 border-b border-mountain-200 flex justify-between items-center">
          <h4 className="text-xs font-bold uppercase tracking-wider text-mountain-700">
            {activeTab === "annexure13" ? "Sales Register (Annexure 13)" : "Sales Return Register (Annexure 14)"}
          </h4>
          <span className="text-xs text-mountain-500 font-medium">
            Showing {filteredRecords.length} record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="clarity-table min-w-full w-full text-xs">
            <thead>
              <tr className="bg-mountain-100/50">
                <th>Date (AD/BS)</th>
                <th>Invoice No</th>
                <th>Source</th>
                <th>Buyer Name</th>
                <th>Buyer PAN</th>
                <th className="text-right">Total (NPR)</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">13% VAT</th>
                <th className="text-center">IRD Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-6 text-mountain-400 font-medium">
                    No records found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row) => (
                  <tr key={row.id} className={row.isCreditNote ? "bg-danger-50/40" : ""}>
                    <td className="whitespace-nowrap font-medium text-mountain-800">
                      <div>{row.date}</div>
                      <div className="text-[10px] text-mountain-400">BS: {row.bsDate}</div>
                    </td>
                    <td className="whitespace-nowrap font-semibold text-primary-700">
                      {row.invoiceNumber}
                      {row.isCreditNote && (
                        <span className="ml-1.5 text-[9px] bg-danger-100 text-danger-700 px-1 py-0.5 rounded font-bold">
                          CN
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-mountain-100 font-medium text-mountain-700">
                        {row.source}
                      </span>
                    </td>
                    <td className="font-medium text-mountain-800">{row.buyerName}</td>
                    <td>{row.buyerPan || "-"}</td>
                    <td className="text-right font-semibold">{row.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-right text-warning-700">{row.discount > 0 ? row.discount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}</td>
                    <td className="text-right">{row.taxableAmount > 0 ? row.taxableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}</td>
                    <td className="text-right text-success-700">{row.taxAmount > 0 ? row.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}</td>
                    <td className="text-center whitespace-nowrap">
                      {row.irdSynced ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-success-100 text-success-800 px-2 py-0.5 rounded-full font-medium">
                          Synced
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="inline-flex items-center text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                            Pending
                          </span>
                          <button
                            onClick={() => handleRetrySync(row)}
                            disabled={retryingId === row.id}
                            title="Retry IRD Sync Now"
                            className="p-1 text-mountain-600 hover:text-primary-600 hover:bg-mountain-100 rounded transition-colors disabled:opacity-50"
                          >
                            <IoRefreshOutline className={`w-3.5 h-3.5 ${retryingId === row.id ? "animate-spin text-primary-600" : ""}`} />
                          </button>
                        </div>
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
