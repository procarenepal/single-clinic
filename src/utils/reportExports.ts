import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  Patient,
  Doctor,
  AppointmentType,
  MedicinePurchase,
  Medicine,
  StockTransaction,
} from "@/types/models";
import { DailyReportData } from "@/services/dailyReportService";
import { addToast } from "@/components/ui/toast";

/**
 * Format date for display
 */
const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${month}/${day}/${year}`;
};

/**
 * Format time for display
 */
const formatTime = (time: string | undefined): string => {
  if (!time) return "N/A";
  const [hours, minutes] = time.split(":");

  if (!hours || !minutes) return time;
  const hour24 = parseInt(hours, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? "PM" : "AM";

  return `${hour12}:${minutes} ${ampm}`;
};

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  return `NPR ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Export daily report to Excel
 */
export const exportDailyReportToExcel = (
  reportData: DailyReportData,
  date: Date,
  clinicName?: string,
  branchName?: string,
  patients?: Patient[],
  doctors?: Doctor[],
  appointmentTypes?: AppointmentType[],
): void => {
  try {
    const wb = XLSX.utils.book_new();
    const dateStr = formatDate(date);
    const data: any[][] = [];

    // Helper function to add a row
    const addRow = (row: any[]) => {
      data.push(row);
    };

    // Helper function to add empty row(s)
    const addEmptyRow = (count: number = 1) => {
      for (let i = 0; i < count; i++) {
        addRow([]);
      }
    };

    // Header Section
    addRow(["Daily Report"]);
    addRow(["Date:", dateStr]);
    if (clinicName) {
      addRow(["Clinic:", clinicName]);
    }
    if (branchName) {
      addRow(["Branch:", branchName]);
    }
    addEmptyRow(2);

    // Summary Section
    addRow(["Summary"]);
    addRow(["Metric", "Value"]);
    addRow(["Total New Patients", reportData.patients.length]);
    addRow(["Total Appointments", reportData.appointments.length]);
    addRow([
      "Scheduled Appointments",
      reportData.appointments.filter((a) => a.status === "scheduled").length,
    ]);
    addRow([
      "Completed Appointments",
      reportData.appointments.filter((a) => a.status === "completed").length,
    ]);
    addRow([
      "Cancelled Appointments",
      reportData.appointments.filter((a) => a.status === "cancelled").length,
    ]);
    addRow(["Total Invoices", reportData.billing.length]);
    addRow([
      "Total Revenue",
      formatCurrency(
        Math.round(
          reportData.billing.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
        ),
      ),
    ]);
    addRow([
      "Cash Collected",
      formatCurrency(
        Math.round(
          reportData.billing.reduce((sum, b) => sum + (b.paidAmount || 0), 0),
        ),
      ),
    ]);
    addRow([
      "Total Due",
      formatCurrency(
        Math.round(
          reportData.billing.reduce(
            (sum, b) => sum + (b.balanceAmount || 0),
            0,
          ),
        ),
      ),
    ]);
    addEmptyRow(2);

    // Patients Section
    if (reportData.patients.length > 0) {
      addRow(["New Patients"]);
      addRow(["Name", "Reg Number", "Mobile", "Email", "Registration Date"]);
      reportData.patients.forEach((patient) => {
        addRow([
          patient.name,
          patient.regNumber || "N/A",
          patient.mobile || "N/A",
          patient.email || "N/A",
          formatDate(patient.createdAt),
        ]);
      });
      addEmptyRow(2);
    }

    // Appointments Section
    if (reportData.appointments.length > 0) {
      addRow(["Appointments"]);
      addRow(["Time", "Patient", "Doctor", "Status", "Type", "Reason"]);
      reportData.appointments.forEach((appointment) => {
        const patient = patients?.find((p) => p.id === appointment.patientId);
        const doctor = doctors?.find((d) => d.id === appointment.doctorId);
        const appointmentType = appointmentTypes?.find(
          (at) => at.id === appointment.appointmentTypeId,
        );

        addRow([
          formatTime(appointment.startTime),
          patient?.name || "N/A",
          doctor?.name || "N/A",
          appointment.status,
          appointmentType?.name || "N/A",
          appointment.reason || "N/A",
        ]);
      });
      addEmptyRow(2);
    }

    // Finance Section
    if (reportData.billing.length > 0) {
      addRow(["Finance (Invoices)"]);
      addRow([
        "Invoice #",
        "Patient",
        "Doctor",
        "Amount",
        "Payment Status",
        "Date",
      ]);
      reportData.billing.forEach((billing) => {
        addRow([
          billing.invoiceNumber,
          billing.patientName || "N/A",
          billing.doctorName || "N/A",
          formatCurrency(billing.totalAmount || 0),
          billing.paymentStatus,
          formatDate(billing.date),
        ]);
      });
    }

    // Create worksheet from data
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws["!cols"] = [
      { wch: 25 }, // Column A
      { wch: 25 }, // Column B
      { wch: 20 }, // Column C
      { wch: 25 }, // Column D
      { wch: 20 }, // Column E
      { wch: 30 }, // Column F
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Daily Report");

    // Generate filename
    const filename = `Daily_Report_${dateStr.replace(/\//g, "-")}.xlsx`;

    XLSX.writeFile(wb, filename);

    addToast({
      title: "Export Successful",
      description: "Daily report has been exported to Excel successfully.",
      color: "success",
    });
  } catch (error) {
    console.error("Error exporting daily report to Excel:", error);
    addToast({
      title: "Export Failed",
      description: "Failed to export daily report. Please try again.",
      color: "danger",
    });
  }
};

/**
 * Export daily report to PDF
 */
export const exportDailyReportToPDF = (
  reportData: DailyReportData,
  date: Date,
  clinicName?: string,
  branchName?: string,
  patients?: Patient[],
  doctors?: Doctor[],
  appointmentTypes?: AppointmentType[],
): void => {
  try {
    const doc = new jsPDF();
    const dateStr = formatDate(date);
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let yPosition = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Daily Report", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${dateStr}`, margin, yPosition);
    yPosition += 6;
    if (clinicName) {
      doc.text(`Clinic: ${clinicName}`, margin, yPosition);
      yPosition += 6;
    }
    if (branchName) {
      doc.text(`Branch: ${branchName}`, margin, yPosition);
      yPosition += 6;
    }
    yPosition += 4;

    // Summary Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, yPosition);
    yPosition += 8;

    const summaryData = [
      ["Metric", "Value"],
      ["Total New Patients", reportData.patients.length.toString()],
      ["Total Appointments", reportData.appointments.length.toString()],
      [
        "Scheduled Appointments",
        reportData.appointments
          .filter((a) => a.status === "scheduled")
          .length.toString(),
      ],
      [
        "Completed Appointments",
        reportData.appointments
          .filter((a) => a.status === "completed")
          .length.toString(),
      ],
      [
        "Cancelled Appointments",
        reportData.appointments
          .filter((a) => a.status === "cancelled")
          .length.toString(),
      ],
      ["Total Invoices", reportData.billing.length.toString()],
      [
        "Total Revenue",
        formatCurrency(
          Math.round(
            reportData.billing.reduce(
              (sum, b) => sum + (b.totalAmount || 0),
              0,
            ),
          ),
        ),
      ],
      [
        "Cash Collected",
        formatCurrency(
          Math.round(
            reportData.billing.reduce((sum, b) => sum + (b.paidAmount || 0), 0),
          ),
        ),
      ],
      [
        "Total Due",
        formatCurrency(
          Math.round(
            reportData.billing.reduce(
              (sum, b) => sum + (b.balanceAmount || 0),
              0,
            ),
          ),
        ),
      ],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: margin, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Patients Section
    if (reportData.patients.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("New Patients", margin, yPosition);
      yPosition += 8;

      const patientsData = reportData.patients.map((patient) => [
        patient.name,
        patient.regNumber || "N/A",
        patient.mobile || "N/A",
        patient.email || "N/A",
        formatDate(patient.createdAt),
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Name", "Reg Number", "Mobile", "Email", "Registration Date"]],
        body: patientsData,
        theme: "striped",
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: margin, right: margin },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Appointments Section
    if (reportData.appointments.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Appointments", margin, yPosition);
      yPosition += 8;

      const appointmentsData = reportData.appointments.map((appointment) => {
        const patient = patients?.find((p) => p.id === appointment.patientId);
        const doctor = doctors?.find((d) => d.id === appointment.doctorId);
        const appointmentType = appointmentTypes?.find(
          (at) => at.id === appointment.appointmentTypeId,
        );

        return [
          formatTime(appointment.startTime),
          patient?.name || "N/A",
          doctor?.name || "N/A",
          appointment.status,
          appointmentType?.name || "N/A",
          appointment.reason || "N/A",
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [["Time", "Patient", "Doctor", "Status", "Type", "Reason"]],
        body: appointmentsData,
        theme: "striped",
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: margin, right: margin },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Finance Section
    if (reportData.billing.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Finance (Invoices)", margin, yPosition);
      yPosition += 8;

      const billingData = reportData.billing.map((billing) => [
        billing.invoiceNumber,
        billing.patientName || "N/A",
        billing.doctorName || "N/A",
        formatCurrency(billing.totalAmount || 0),
        billing.paymentStatus,
        formatDate(billing.date),
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [
          [
            "Invoice #",
            "Patient",
            "Doctor",
            "Amount",
            "Payment Status",
            "Date",
          ],
        ],
        body: billingData,
        theme: "striped",
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: margin, right: margin },
      });
    }

    // Footer
    const pageCount = (doc.internal as any).getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin - 20,
        doc.internal.pageSize.getHeight() - 10,
      );
    }

    // Save PDF
    const filename = `Daily_Report_${dateStr.replace(/\//g, "-")}.pdf`;

    doc.save(filename);

    addToast({
      title: "Export Successful",
      description: "Daily report has been exported to PDF successfully.",
      color: "success",
    });
  } catch (error) {
    console.error("Error exporting daily report to PDF:", error);
    addToast({
      title: "Export Failed",
      description: "Failed to export daily report. Please try again.",
      color: "danger",
    });
  }
};

/**
 * Export pharmacy daily report to Excel
 */
export const exportPharmacyDailyReportToExcel = (
  purchases: MedicinePurchase[],
  date: Date,
  clinicName?: string,
): void => {
  try {
    const wb = XLSX.utils.book_new();
    const dateStr = formatDate(date);
    const data: any[][] = [];

    // Helper function to add a row
    const addRow = (row: any[]) => {
      data.push(row);
    };

    // Helper function to add empty row(s)
    const addEmptyRow = (count: number = 1) => {
      for (let i = 0; i < count; i++) {
        addRow([]);
      }
    };

    // Header Section
    addRow(["Pharmacy Daily Sales Report"]);
    addRow(["Date:", dateStr]);
    if (clinicName) {
      addRow(["Clinic:", clinicName]);
    }
    addEmptyRow(2);

    // Calculate summary
    const totalSales = Math.round(
      purchases.reduce((sum, p) => sum + (p.netAmount || 0), 0),
    );
    const totalItems = purchases.reduce(
      (sum, p) =>
        sum + p.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const paidCount = purchases.filter(
      (p) => p.paymentStatus === "paid",
    ).length;
    const unpaidCount = purchases.filter(
      (p) => p.paymentStatus === "unpaid" || p.paymentStatus === "pending",
    ).length;
    const partialCount = purchases.filter(
      (p) => p.paymentStatus === "partial",
    ).length;

    // Summary Section
    addRow(["Summary"]);
    addRow(["Metric", "Value"]);
    addRow(["Total Purchases", purchases.length]);
    addRow(["Total Items Sold", totalItems]);
    addRow(["Total Sales Amount", formatCurrency(totalSales)]);
    addRow(["Paid Purchases", paidCount]);
    addRow(["Unpaid Purchases", unpaidCount]);
    addRow(["Partial Payments", partialCount]);
    addEmptyRow(2);

    // Detailed Purchases Section
    if (purchases.length > 0) {
      addRow(["Daily Sales Records"]);
      addRow([
        "Purchase No",
        "Date",
        "Time",
        "Patient Name",
        "Items Count",
        "Total",
        "Discount",
        "Tax",
        "Net Amount",
        "Payment Status",
        "Payment Type",
      ]);

      purchases.forEach((purchase) => {
        const purchaseDate =
          purchase.purchaseDate instanceof Date
            ? purchase.purchaseDate
            : new Date(purchase.purchaseDate);
        const dateStr = formatDate(purchaseDate);
        const hours = String(purchaseDate.getHours()).padStart(2, "0");
        const minutes = String(purchaseDate.getMinutes()).padStart(2, "0");
        const timeStr = formatTime(`${hours}:${minutes}`);

        addRow([
          purchase.purchaseNo,
          dateStr,
          timeStr,
          purchase.patientName || "Walk-in Customer",
          purchase.items.length,
          formatCurrency(purchase.total),
          formatCurrency(purchase.discount),
          formatCurrency(purchase.taxAmount),
          formatCurrency(purchase.netAmount),
          purchase.paymentStatus.charAt(0).toUpperCase() +
            purchase.paymentStatus.slice(1),
          purchase.paymentType || "N/A",
        ]);
      });
      addEmptyRow(2);

      // Items Breakdown Section
      addRow(["Items Breakdown"]);
      addRow([
        "Purchase No",
        "Item Name",
        "Type",
        "Quantity",
        "Sale Price",
        "Amount",
      ]);

      purchases.forEach((purchase) => {
        purchase.items.forEach((item) => {
          addRow([
            purchase.purchaseNo,
            item.medicineName,
            item.type || "medicine",
            item.quantity,
            formatCurrency(item.salePrice),
            formatCurrency(item.amount),
          ]);
        });
      });
    }

    // Create worksheet from data
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws["!cols"] = [
      { wch: 20 }, // Column A
      { wch: 15 }, // Column B
      { wch: 12 }, // Column C
      { wch: 25 }, // Column D
      { wch: 15 }, // Column E
      { wch: 18 }, // Column F
      { wch: 15 }, // Column G
      { wch: 15 }, // Column H
      { wch: 18 }, // Column I
      { wch: 18 }, // Column J
      { wch: 18 }, // Column K
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Daily Sales Report");

    // Generate filename
    const filename = `Pharmacy_Daily_Report_${dateStr.replace(/\//g, "-")}.xlsx`;

    XLSX.writeFile(wb, filename);

    addToast({
      title: "Export Successful",
      description:
        "Pharmacy daily report has been exported to Excel successfully.",
      color: "success",
    });
  } catch (error) {
    console.error("Error exporting pharmacy daily report to Excel:", error);
    addToast({
      title: "Export Failed",
      description: "Failed to export pharmacy daily report. Please try again.",
      color: "danger",
    });
  }
};

/**
 * Export pharmacy daily report to PDF
 */
export const exportPharmacyDailyReportToPDF = (
  purchases: MedicinePurchase[],
  date: Date,
  clinicName?: string,
): void => {
  try {
    const doc = new jsPDF();
    const dateStr = formatDate(date);
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let yPosition = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Pharmacy Daily Sales Report", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${dateStr}`, margin, yPosition);
    yPosition += 6;
    if (clinicName) {
      doc.text(`Clinic: ${clinicName}`, margin, yPosition);
      yPosition += 6;
    }
    yPosition += 4;

    // Calculate summary
    const totalSales = Math.round(
      purchases.reduce((sum, p) => sum + (p.netAmount || 0), 0),
    );
    const totalItems = purchases.reduce(
      (sum, p) =>
        sum + p.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const paidCount = purchases.filter(
      (p) => p.paymentStatus === "paid",
    ).length;
    const unpaidCount = purchases.filter(
      (p) => p.paymentStatus === "unpaid" || p.paymentStatus === "pending",
    ).length;
    const partialCount = purchases.filter(
      (p) => p.paymentStatus === "partial",
    ).length;

    // Summary Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, yPosition);
    yPosition += 8;

    const summaryData = [
      ["Metric", "Value"],
      ["Total Purchases", purchases.length.toString()],
      ["Total Items Sold", totalItems.toString()],
      ["Total Sales Amount", formatCurrency(totalSales)],
      ["Paid Purchases", paidCount.toString()],
      ["Unpaid Purchases", unpaidCount.toString()],
      ["Partial Payments", partialCount.toString()],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: margin, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Detailed Purchases Section
    if (purchases.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Daily Sales Records", margin, yPosition);
      yPosition += 8;

      const purchasesData = purchases.map((purchase) => {
        const purchaseDate =
          purchase.purchaseDate instanceof Date
            ? purchase.purchaseDate
            : new Date(purchase.purchaseDate);
        const dateStr = formatDate(purchaseDate);
        const hours = String(purchaseDate.getHours()).padStart(2, "0");
        const minutes = String(purchaseDate.getMinutes()).padStart(2, "0");
        const timeStr = formatTime(`${hours}:${minutes}`);

        return [
          purchase.purchaseNo,
          dateStr,
          timeStr,
          purchase.patientName || "Walk-in Customer",
          purchase.items.length.toString(),
          formatCurrency(purchase.total),
          formatCurrency(purchase.discount),
          formatCurrency(purchase.taxAmount),
          formatCurrency(purchase.netAmount),
          purchase.paymentStatus.charAt(0).toUpperCase() +
            purchase.paymentStatus.slice(1),
          purchase.paymentType || "N/A",
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [
          [
            "Purchase No",
            "Date",
            "Time",
            "Patient",
            "Items",
            "Total",
            "Discount",
            "Tax",
            "Net Amount",
            "Payment Status",
            "Payment Type",
          ],
        ],
        body: purchasesData,
        theme: "striped",
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // Items Breakdown Section
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Items Breakdown", margin, yPosition);
      yPosition += 8;

      const itemsData: any[][] = [];

      purchases.forEach((purchase) => {
        purchase.items.forEach((item) => {
          itemsData.push([
            purchase.purchaseNo,
            item.medicineName,
            (item.type || "medicine").charAt(0).toUpperCase() +
              (item.type || "medicine").slice(1),
            item.quantity.toString(),
            formatCurrency(item.salePrice),
            formatCurrency(item.amount),
          ]);
        });
      });

      if (itemsData.length > 0) {
        autoTable(doc, {
          startY: yPosition,
          head: [
            [
              "Purchase No",
              "Item Name",
              "Type",
              "Quantity",
              "Sale Price",
              "Amount",
            ],
          ],
          body: itemsData,
          theme: "striped",
          headStyles: { fillColor: [66, 139, 202] },
          margin: { left: margin, right: margin },
          styles: { fontSize: 8 },
        });
      }
    }

    // Footer
    const pageCount = (doc.internal as any).getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin - 20,
        doc.internal.pageSize.getHeight() - 10,
      );
    }

    // Save PDF
    const filename = `Pharmacy_Daily_Report_${dateStr.replace(/\//g, "-")}.pdf`;

    doc.save(filename);

    addToast({
      title: "Export Successful",
      description:
        "Pharmacy daily report has been exported to PDF successfully.",
      color: "success",
    });
  } catch (error) {
    console.error("Error exporting pharmacy daily report to PDF:", error);
    addToast({
      title: "Export Failed",
      description: "Failed to export pharmacy daily report. Please try again.",
      color: "danger",
    });
  }
};

/**
 * Get medicine cost price helper
 */
const getMedicineCostPrice = (
  medicineId: string,
  medicines: Medicine[],
): number => {
  const medicine = medicines.find((m) => m.id === medicineId);

  return medicine?.costPrice || 0;
};

/**
 * Export daily purchases report to Excel
 */
export const exportDailyPurchasesReportToExcel = (
  purchases: MedicinePurchase[],
  date: Date,
  clinicName?: string,
  medicines: Medicine[] = [],
  refillTransactions: any[] = [],
): void => {
  try {
    const wb = XLSX.utils.book_new();
    const dateStr = formatDate(date);
    const data: any[][] = [];

    // Helper function to add a row
    const addRow = (row: any[]) => {
      data.push(row);
    };

    // Helper function to add empty row(s)
    const addEmptyRow = (count: number = 1) => {
      for (let i = 0; i < count; i++) {
        addRow([]);
      }
    };

    // Header Section
    addRow(["Daily Purchases Report"]);
    addRow(["Date:", dateStr]);
    if (clinicName) {
      addRow(["Clinic:", clinicName]);
    }
    addEmptyRow(2);

    // Calculate summary from refill transactions (clinic purchases from suppliers) only
    let totalPurchaseCost = 0;
    let totalQuantity = 0;
    const uniqueMedicines = new Set<string>();

    refillTransactions.forEach((transaction: StockTransaction) => {
      const costPrice =
        transaction.costPrice ||
        getMedicineCostPrice(transaction.medicineId, medicines);
      const itemCost = transaction.quantity * costPrice;

      totalPurchaseCost += itemCost;
      totalQuantity += transaction.quantity;
      uniqueMedicines.add(transaction.medicineId);
    });

    const averageCostPerMedicine =
      uniqueMedicines.size > 0 ? totalPurchaseCost / uniqueMedicines.size : 0;

    // Summary Section
    addRow(["Summary"]);
    addRow(["Metric", "Value"]);
    addRow(["Total Purchase Cost", formatCurrency(totalPurchaseCost)]);
    addRow(["Total Medicines", uniqueMedicines.size]);
    addRow(["Total Quantity", totalQuantity]);
    addRow([
      "Average Cost per Medicine",
      formatCurrency(averageCostPerMedicine),
    ]);
    addEmptyRow(2);

    // Detailed Purchases Section (refill transactions only)
    if (refillTransactions.length > 0) {
      addRow(["Detailed Purchases"]);
      addRow([
        "Ref/Invoice No",
        "Date",
        "Time",
        "Type",
        "Supplier",
        "Medicine Name",
        "Quantity",
        "Cost Price",
        "Total Cost",
      ]);

      refillTransactions.forEach((transaction: StockTransaction) => {
        const medicine = medicines.find((m) => m.id === transaction.medicineId);
        const medicineName = medicine?.name || "Unknown Medicine";
        const costPrice =
          transaction.costPrice ||
          getMedicineCostPrice(transaction.medicineId, medicines);
        const totalCost = transaction.quantity * costPrice;
        const transactionDate =
          transaction.createdAt instanceof Date
            ? transaction.createdAt
            : new Date(transaction.createdAt);
        const dateStr = formatDate(transactionDate);
        const hours = String(transactionDate.getHours()).padStart(2, "0");
        const minutes = String(transactionDate.getMinutes()).padStart(2, "0");
        const timeStr = formatTime(`${hours}:${minutes}`);

        addRow([
          transaction.invoiceNumber || "N/A",
          dateStr,
          timeStr,
          "Refill",
          "Supplier",
          medicineName,
          transaction.quantity,
          costPrice > 0 ? formatCurrency(costPrice) : "N/A",
          costPrice > 0 ? formatCurrency(totalCost) : "N/A",
        ]);
      });
    }

    // Create worksheet from data
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws["!cols"] = [
      { wch: 20 }, // Column A - Purchase No
      { wch: 15 }, // Column B - Date
      { wch: 12 }, // Column C - Time
      { wch: 25 }, // Column D - Supplier
      { wch: 30 }, // Column E - Medicine Name
      { wch: 12 }, // Column F - Quantity
      { wch: 15 }, // Column G - Cost Price
      { wch: 15 }, // Column H - Total Cost
      { wch: 18 }, // Column I - Purchase Total Cost
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Daily Purchases Report");

    // Generate filename
    const filename = `Daily_Purchases_Report_${dateStr.replace(/\//g, "-")}.xlsx`;

    XLSX.writeFile(wb, filename);

    addToast({
      title: "Export Successful",
      description:
        "Daily purchases report has been exported to Excel successfully.",
      color: "success",
    });
  } catch (error) {
    console.error("Error exporting daily purchases report to Excel:", error);
    addToast({
      title: "Export Failed",
      description: "Failed to export daily purchases report. Please try again.",
      color: "danger",
    });
  }
};

/**
 * Export daily purchases report to PDF
 */
export const exportDailyPurchasesReportToPDF = (
  purchases: MedicinePurchase[],
  date: Date,
  clinicName?: string,
  medicines: Medicine[] = [],
  refillTransactions: any[] = [],
): void => {
  try {
    const doc = new jsPDF();
    const dateStr = formatDate(date);
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let yPosition = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Daily Purchases Report", margin, yPosition);
    yPosition += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${dateStr}`, margin, yPosition);
    yPosition += 6;
    if (clinicName) {
      doc.text(`Clinic: ${clinicName}`, margin, yPosition);
      yPosition += 6;
    }
    yPosition += 4;

    // Calculate summary from refill transactions (clinic purchases from suppliers) only
    let totalPurchaseCost = 0;
    let totalQuantity = 0;
    const uniqueMedicines = new Set<string>();

    refillTransactions.forEach((transaction: StockTransaction) => {
      const costPrice =
        transaction.costPrice ||
        getMedicineCostPrice(transaction.medicineId, medicines);
      const itemCost = transaction.quantity * costPrice;

      totalPurchaseCost += itemCost;
      totalQuantity += transaction.quantity;
      uniqueMedicines.add(transaction.medicineId);
    });

    const averageCostPerMedicine =
      uniqueMedicines.size > 0 ? totalPurchaseCost / uniqueMedicines.size : 0;

    // Summary Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, yPosition);
    yPosition += 8;

    const summaryData = [
      ["Metric", "Value"],
      ["Total Purchase Cost", formatCurrency(totalPurchaseCost)],
      ["Total Medicines", uniqueMedicines.size.toString()],
      ["Total Quantity", totalQuantity.toString()],
      ["Average Cost per Medicine", formatCurrency(averageCostPerMedicine)],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: margin, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Detailed Purchases Section (refill transactions only)
    if (refillTransactions.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Daily Purchases Records", margin, yPosition);
      yPosition += 8;

      const purchasesData: any[][] = [];

      refillTransactions.forEach((transaction: StockTransaction) => {
        const medicine = medicines.find((m) => m.id === transaction.medicineId);
        const medicineName = medicine?.name || "Unknown Medicine";
        const costPrice =
          transaction.costPrice ||
          getMedicineCostPrice(transaction.medicineId, medicines);
        const totalCost = transaction.quantity * costPrice;
        const transactionDate =
          transaction.createdAt instanceof Date
            ? transaction.createdAt
            : new Date(transaction.createdAt);
        const dateStr = formatDate(transactionDate);
        const hours = String(transactionDate.getHours()).padStart(2, "0");
        const minutes = String(transactionDate.getMinutes()).padStart(2, "0");
        const timeStr = formatTime(`${hours}:${minutes}`);

        purchasesData.push([
          transaction.invoiceNumber || "N/A",
          dateStr,
          timeStr,
          "Refill",
          "Supplier",
          medicineName,
          transaction.quantity.toString(),
          costPrice > 0 ? formatCurrency(costPrice) : "N/A",
          costPrice > 0 ? formatCurrency(totalCost) : "N/A",
        ]);
      });

      autoTable(doc, {
        startY: yPosition,
        head: [
          [
            "Ref/Invoice No",
            "Date",
            "Time",
            "Type",
            "Supplier",
            "Medicine Name",
            "Quantity",
            "Cost Price",
            "Total Cost",
          ],
        ],
        body: purchasesData,
        theme: "striped",
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
      });
    }

    // Footer
    const pageCount = (doc.internal as any).getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin - 20,
        doc.internal.pageSize.getHeight() - 10,
      );
    }

    // Save PDF
    const filename = `Daily_Purchases_Report_${dateStr.replace(/\//g, "-")}.pdf`;

    doc.save(filename);

    addToast({
      title: "Export Successful",
      description:
        "Daily purchases report has been exported to PDF successfully.",
      color: "success",
    });
  } catch (error) {
    console.error("Error exporting daily purchases report to PDF:", error);
    addToast({
      title: "Export Failed",
      description: "Failed to export daily purchases report. Please try again.",
      color: "danger",
    });
  }
};
