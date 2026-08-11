import axios from "axios";
import NepaliDate from "nepali-datetime";
import { ClinicSettings, Clinic } from "../types/models";

export interface IrdBillPayload {
  username?: string;
  password?: string;
  seller_pan?: string;
  buyer_pan?: string;
  buyer_name?: string;
  fiscal_year?: string;
  invoice_number?: string;
  invoice_date?: string; // YYYY.MM.DD
  total_sales?: number;
  taxable_sales_vat?: number;
  vat?: number;
  excisable_amount?: number;
  excise?: number;
  taxable_sales_hst?: number;
  hst?: number;
  amount_for_esf?: number;
  esf?: number;
  export_sales?: number;
  tax_exempted_sales?: number;
  isrealtime?: boolean;
  datetimeClient?: string;
}

/**
 * Calculates the Nepali Fiscal Year (e.g., "2080.081") based on the provided date.
 */
export const getNepaliFiscalYear = (date: Date | string): string => {
  const dateObj = new Date(date);
  const nepaliDate = new NepaliDate(dateObj);
  const bsYear = nepaliDate.getYear();
  const bsMonth = nepaliDate.getMonth() + 1; // 0-indexed

  // Fiscal year in Nepal starts from Shrawan (4th month)
  if (bsMonth >= 4) {
    const nextYear = bsYear + 1;
    return `${bsYear}.${nextYear.toString().substring(2)}`;
  } else {
    const prevYear = bsYear - 1;
    return `${prevYear}.${bsYear.toString().substring(2)}`;
  }
};

/**
 * Formats a JS Date to "YYYY.MM.DD" as expected by the IRD API
 */
const formatIrdDate = (date: Date | string): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

export interface SyncInvoiceParams {
  clinicSettings: ClinicSettings;
  clinic: Clinic;
  invoiceData: {
    buyerName: string;
    buyerPan?: string;
    invoiceNumber: string;
    invoiceDate: Date | string;
    totalAmount: number;
    taxAmount: number; // Represents VAT
    isTaxEnabled: boolean; // Flag if tax was enabled on this invoice
  };
  isReturn?: boolean; // True if hitting the api/billreturn endpoint
  panNumberOverride?: string; // Fallback PAN if clinic.panNumber is not set
}

/**
 * Syncs an invoice to the IRD CBMS API.
 * This should be called immediately after an invoice is finalized in Firestore.
 */
export const syncInvoiceToIRD = async ({
  clinicSettings,
  clinic,
  invoiceData,
  isReturn = false,
  panNumberOverride,
}: SyncInvoiceParams): Promise<{ success: boolean; responseCode?: string; message?: string }> => {
  try {
    if (!clinicSettings.irdEnabled) {
      return { success: false, message: "IRD Sync is disabled in settings." };
    }

    if (!clinicSettings.irdApiUrl || !clinicSettings.irdApiUsername || !clinicSettings.irdApiPassword) {
      return { success: false, message: "IRD API credentials are not fully configured." };
    }

    const effectivePan = clinic.panNumber || panNumberOverride;
    if (!effectivePan) {
      return { success: false, message: "Clinic PAN is required for IRD sync. Please set PAN in Clinic Settings or Print Layout." };
    }

    // Determine taxable and exempt sales
    // Assuming if tax is applied, the subtotal is taxable, otherwise it is exempt.
    const vat = invoiceData.taxAmount || 0;
    let taxableSalesVat = 0;
    let taxExemptedSales = 0;

    if (invoiceData.isTaxEnabled && vat > 0) {
      // Calculate taxable amount back from total amount to be safe
      taxableSalesVat = invoiceData.totalAmount - vat;
    } else {
      taxExemptedSales = invoiceData.totalAmount;
    }

    const payload: IrdBillPayload = {
      username: clinicSettings.irdApiUsername,
      password: clinicSettings.irdApiPassword,
      seller_pan: effectivePan,
      buyer_pan: invoiceData.buyerPan || "",
      buyer_name: invoiceData.buyerName || "Cash Sales",
      fiscal_year: getNepaliFiscalYear(invoiceData.invoiceDate),
      invoice_number: invoiceData.invoiceNumber,
      invoice_date: formatIrdDate(invoiceData.invoiceDate),
      total_sales: parseFloat(invoiceData.totalAmount.toFixed(2)),
      taxable_sales_vat: parseFloat(taxableSalesVat.toFixed(2)),
      vat: parseFloat(vat.toFixed(2)),
      excisable_amount: 0,
      excise: 0,
      taxable_sales_hst: 0,
      hst: 0,
      amount_for_esf: 0,
      esf: 0,
      export_sales: 0,
      tax_exempted_sales: parseFloat(taxExemptedSales.toFixed(2)),
      isrealtime: true,
      datetimeClient: new Date().toISOString(),
    };

    // Choose endpoint based on if it's a regular bill or a sales return
    // Default IRD Live endpoint is https://cbapi.ird.gov.np
    const baseUrl = clinicSettings.irdApiUrl.replace(/\/$/, "");
    const endpoint = isReturn ? `${baseUrl}/api/billreturn` : `${baseUrl}/api/bill`;

    // --- LOCAL TESTING MOCK ---
    if (baseUrl.includes("mock") || baseUrl.includes("localhost") || baseUrl === "test") {
      console.log("==== MOCK IRD SYNC ====");
      console.log("Endpoint:", endpoint);
      console.log("Payload:", JSON.stringify(payload, null, 2));
      console.log("=======================");
      return {
        success: true,
        responseCode: "200",
        message: "MOCK: Successfully synced to IRD (Local Test)",
      };
    }
    // --------------------------

    const response = await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 seconds timeout for CBMS
    });

    // IRD returns success typically with code 200
    const responseCode = response.data?.ResponseCode || response.status;
    const isSuccess = responseCode === 200 || responseCode === "200";

    return {
      success: isSuccess,
      responseCode: String(responseCode),
      message: response.data?.Message || "Success",
    };
  } catch (error: any) {
    console.error("Error syncing to IRD:", error);
    return {
      success: false,
      responseCode: error.response?.status ? String(error.response.status) : "500",
      message: error.response?.data?.Message || error.message || "Unknown network error",
    };
  }
};

/**
 * Retry syncing a failed invoice to IRD.
 */
export const retryIrdSync = async (
  invoiceId: string,
  invoiceType: "appointment" | "pathology" | "pharmacy"
): Promise<{ success: boolean; message: string }> => {
  try {
    const { clinicSettingsService } = await import("./clinicSettingsService");
    const { clinicService } = await import("./clinicService");

    let invoiceData: any = null;
    let clinicId = "";

    // Fetch the invoice based on type
    if (invoiceType === "appointment") {
      const { appointmentBillingService } = await import("./appointmentBillingService");
      invoiceData = await appointmentBillingService.getBillingById(invoiceId);
      if (invoiceData) clinicId = invoiceData.clinicId;
    } else if (invoiceType === "pathology") {
      const { pathologyBillingService } = await import("./pathologyBillingService");
      invoiceData = await pathologyBillingService.getBillingById(invoiceId);
      if (invoiceData) clinicId = invoiceData.clinicId;
    } else if (invoiceType === "pharmacy") {
      const { pharmacyService } = await import("./pharmacyService");
      invoiceData = await pharmacyService.getMedicinePurchaseById(invoiceId);
      if (invoiceData) clinicId = invoiceData.clinicId;
    }

    if (!invoiceData) {
      return { success: false, message: "Invoice not found." };
    }

    // Ensure it's finalized (or paid for pharmacy)
    if (invoiceType === "pharmacy" && invoiceData.paymentStatus !== "paid") {
       return { success: false, message: "Pharmacy invoice is not fully paid." };
    } else if (invoiceType !== "pharmacy" && invoiceData.status !== "finalized") {
       return { success: false, message: "Invoice is not finalized." };
    }

    const clinicSettings = await clinicSettingsService.getClinicSettings(clinicId);
    const clinic = await clinicService.getClinicById(clinicId);

    if (!clinicSettings || !clinic || !clinicSettings.irdEnabled) {
      return { success: false, message: "IRD Sync is not enabled for this clinic." };
    }

    // Try to get PAN from print layout if clinic.panNumber is not set
    let panNumberOverride: string | undefined;
    if (!clinic.panNumber) {
      try {
        const printLayout = await clinicService.getPrintLayoutConfig(clinicId);
        panNumberOverride = printLayout?.panNumber || undefined;
      } catch {
        // Print layout lookup failure is non-fatal
      }
    }

    // Map the fields properly depending on the model
    const irdInvoiceData = {
      buyerName: invoiceData.patientName || "Cash Sales",
      buyerPan: "", 
      invoiceNumber: invoiceType === "pharmacy" ? invoiceData.purchaseNo : invoiceData.invoiceNumber,
      invoiceDate: invoiceType === "pharmacy" ? (invoiceData.purchaseDate || new Date()) : invoiceData.invoiceDate,
      totalAmount: invoiceType === "pharmacy" ? invoiceData.netAmount : invoiceData.totalAmount,
      taxAmount: invoiceData.taxAmount || 0,
      isTaxEnabled: invoiceType === "pharmacy" ? (invoiceData.taxPercentage || 0) > 0 : invoiceData.taxPercentage > 0,
    };

    const result = await syncInvoiceToIRD({
      clinicSettings,
      clinic,
      invoiceData: irdInvoiceData,
      isReturn: false, // Assuming retries are for the main invoice for now
      panNumberOverride,
    });

    if (result.success) {
       // Update the record
       if (invoiceType === "appointment") {
          const { appointmentBillingService } = await import("./appointmentBillingService");
          await appointmentBillingService.updateBilling(invoiceId, { irdSynced: true, irdSyncDate: new Date(), cbmsResponseCode: result.responseCode });
       } else if (invoiceType === "pathology") {
          const { pathologyBillingService } = await import("./pathologyBillingService");
          await pathologyBillingService.updateBilling(invoiceId, { irdSynced: true, irdSyncDate: new Date(), cbmsResponseCode: result.responseCode });
       } else if (invoiceType === "pharmacy") {
          const { pharmacyService } = await import("./pharmacyService");
          await pharmacyService.updateMedicinePurchase(invoiceId, { irdSynced: true, irdSyncDate: new Date(), cbmsResponseCode: result.responseCode });
       }
    }

    return { success: result.success, message: result.message || "Sync attempt finished." };
  } catch (error: any) {
    console.error("Retry sync error:", error);
    return { success: false, message: error.message || "Error during retry sync." };
  }
};
