import axios from "axios";

// Configure Axios instance for billing API
const billingApiClient = axios.create({
  baseURL: "http://localhost:8080/api/billing",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptors if needed (e.g., for auth tokens)
billingApiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Interface representing the item fields for an invoice request
 */
export interface InvoiceItemDto {
  itemName: string;
  quantity: number;
  rate: number;
  totalAmount: number;
  isTaxable: boolean;
}

/**
 * Interface representing the payload for an invoice request to the Java backend
 */
export interface InvoiceRequestDto {
  firebasePatientId?: string;
  buyerName?: string;
  buyerPan?: string;
  
  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  exemptAmount: number;
  
  irdEnabled?: boolean;
  irdApiUrl?: string;
  irdApiUsername?: string;
  irdApiPassword?: string;
  sellerPan?: string;
  fiscalYear?: string;
  
  items: InvoiceItemDto[];
}

export const billingApi = {
  /**
   * Submit an invoice payload to the Java backend
   */
  async createInvoice(payload: InvoiceRequestDto): Promise<any> {
    try {
      const response = await billingApiClient.post("/create", payload);
      return response.data;
    } catch (error: any) {
      console.error("Error submitting invoice:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "Failed to submit invoice");
    }
  },

  /**
   * Update IRD sync status on the Java backend SQL DB
   */
  async updateIrdSyncStatus(javaId: number | string, synced: boolean = true, responseCode?: string): Promise<any> {
    try {
      const response = await billingApiClient.put(`/${javaId}/ird-sync`, null, {
        params: { synced, responseCode }
      });
      return response.data;
    } catch (error: any) {
      console.warn("Failed to update IRD sync status in Java backend:", error.message || error);
    }
  },

  /**
   * Retry syncing an invoice with IRD CBMS
   */
  async retryIrdSync(javaId: number | string, irdConfig: any): Promise<any> {
    try {
      const response = await billingApiClient.post(`/${javaId}/retry-sync`, irdConfig);
      return response.data;
    } catch (error: any) {
      console.error("Error retrying IRD sync:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "Failed to retry IRD sync");
    }
  }
};
