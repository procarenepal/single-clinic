/**
 * IRD Service for interacting with Inland Revenue Department (Nepal) CBMS API.
 * This service handles payload construction and syncing with the IRD backend.
 */

import { Clinic, AppointmentBilling } from "../types/models";

export interface IrdSyncResponse {
  success: boolean;
  message?: string;
  responseCode?: string; // IRD specific codes (e.g., 200 for success)
  data?: any;
}

export class IrdService {
  /**
   * Sync a standard sales invoice to the IRD API
   */
  public static async syncInvoice(
    billing: AppointmentBilling,
    settings: Clinic
  ): Promise<IrdSyncResponse> {
    if (!settings.irdEnabled) {
      return { success: false, message: "IRD Sync is disabled in settings." };
    }

    if (!settings.panNumber) {
      return { success: false, message: "Clinic PAN number is missing." };
    }

    // Construct the payload as per IRD specifications
    const payload = this.constructIrdPayload(billing, settings);

    try {
      // Note: This API call should ideally be proxied through a secure backend (e.g. Firebase Functions or Appwrite Functions)
      // to avoid CORS issues and expose credentials. For now, we are providing the structure.
      const url = `${settings.irdApiUrl || "https://cbms.ird.gov.np/api"}/bill`;

      console.log("Mock syncing IRD payload:", payload);

      // MOCK API CALL
      // const response = await fetch(url, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify(payload),
      // });

      // if (!response.ok) {
      //   throw new Error(`IRD API responded with ${response.status}`);
      // }

      // const data = await response.json();

      return {
        success: true,
        message: "Successfully synced with IRD CBMS (Mocked)",
        responseCode: "200",
        data: { payload_sent: payload },
      };
    } catch (error) {
      console.error("Failed to sync with IRD:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Constructs the JSON payload required by the IRD CBMS API.
   */
  private static constructIrdPayload(billing: AppointmentBilling, settings: Clinic) {
    // Determine taxable vs non-taxable amounts
    // In Nepal, medical services might be VAT exempt, but for demonstration, we will calculate based on taxPercentage
    const taxRate = billing.taxPercentage || 0;
    let taxableAmount = 0;
    let vatAmount = 0;
    let taxExemptedAmount = 0;

    if (taxRate > 0) {
      // E.g., if there's tax, the amount before tax is taxable
      taxableAmount = billing.subtotal - billing.discountAmount;
      vatAmount = billing.taxAmount;
    } else {
      // If no tax, it's tax exempted
      taxExemptedAmount = billing.subtotal - billing.discountAmount;
    }

    const dateStr = new Date(billing.invoiceDate).toISOString().split('T')[0];

    return {
      seller_pan: settings.panNumber,
      buyer_pan: billing.buyerPan || "",
      buyer_name: billing.patientName,
      invoice_number: billing.invoiceNumber,
      invoice_date: dateStr,
      total_sales: billing.totalAmount,
      taxable_sales_vat: taxableAmount,
      vat: vatAmount,
      excisable_amount: 0,
      export_sales: 0,
      tax_exempted_sales: taxExemptedAmount,
      isrealtime: true, // true if synced immediately
      datetime_client: new Date().toISOString(),
    };
  }
}
