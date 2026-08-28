import axios from "axios";

import { auth } from "../../config/firebase";

// Configure Axios instance for billing API
const billingApiClient = axios.create({
  baseURL:
    import.meta.env.VITE_BILLING_API_URL || "http://localhost:8080/api/billing",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach a fresh Firebase ID token to every request — the Java backend
// resolves clinicId from this token server-side, it is never sent by the client.
billingApiClient.interceptors.request.use(
  async (config) => {
    const currentUser = auth.currentUser;

    if (currentUser) {
      const token = await currentUser.getIdToken();

      config.headers.Authorization = `Bearer ${token}`;
    }

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
 * Interface representing the payload for an invoice request to the Java backend.
 * IRD credentials are NOT part of this payload — the backend resolves them
 * server-side per clinic. Only `irdEnabled` (intent) is sent.
 */
export interface InvoiceRequestDto {
  firebasePatientId?: string;
  buyerName?: string;
  buyerPan?: string;

  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  exemptAmount: number;

  /** Optional — Schedule 5 field (IRD Electronic Billing Procedure clause 6(ङ)). */
  discountAmount?: number;
  /** Optional — Schedule 5 field. Often not known yet for an unpaid invoice at creation time. */
  paymentMethod?: string;

  irdEnabled?: boolean;
  fiscalYear: string;

  /**
   * Optional pre-assigned invoice/receipt number for flows (e.g. pharmacy)
   * that must allocate their own number atomically alongside other state.
   * Omit to let the Java backend allocate the next sequential number.
   */
  preAssignedInvoiceNumber?: string;

  /** True for a sales-return invoice — routes IRD submission to /api/billreturn. */
  isReturn?: boolean;

  /**
   * Client-generated key identifying this specific create-invoice attempt.
   * Lets a retry after a dropped connection return the already-created
   * invoice instead of creating a duplicate — see src/utils/idempotencyKey.ts.
   */
  idempotencyKey?: string;

  items: InvoiceItemDto[];
}

export interface ClinicIrdConfigRequest {
  sellerPan?: string;
  irdEnvironment: "mock" | "sandbox" | "live";
  irdApiUrl?: string;
  irdApiUsername?: string;
  /** Write-only. Omit to leave the currently-stored password unchanged. */
  irdApiPassword?: string;
  enabled: boolean;
}

export interface ClinicIrdConfigResponse {
  sellerPan?: string;
  irdEnvironment: string;
  irdApiUrl?: string;
  irdApiUsername?: string;
  hasPassword: boolean;
  enabled: boolean;
}

export interface InvoiceResponseDto {
  id: number;
  invoiceNumber: string;
  irdSynced: boolean;
  irdSyncDate?: string;
  cbmsResponseCode?: string;
}

/**
 * One row of the master invoice/sales table required by IRD's Electronic
 * Billing Procedure, Schedule 5 (अनुसूची ५) — see billing-backend's
 * Schedule5RecordDto for field-by-field provenance. printedTime/printedBy
 * and vatRefundAmount/transactionId are always null for now (not yet
 * tracked in the Java backend / Schedule 8 not yet implemented).
 */
export interface Schedule5Record {
  fiscalYear: string;
  billNo: string;
  customerName: string;
  customerPan?: string;
  billDate: string;
  amount: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  syncWithIrd: boolean;
  billPrinted: boolean | null;
  billActive: boolean;
  printedTime: string | null;
  enteredBy: string;
  printedBy: string | null;
  realtime: boolean | null;
  paymentMethod?: string;
  vatRefundAmount: number | null;
  transactionId: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * One row of the billing backend's automatic log-archive of every write
 * action against billing data — see billing-backend's AuditLog entity.
 * Required to be viewable/printable per IRD clause 6(ट).
 */
export interface BillingAuditLogEntry {
  id: number;
  entityName: string;
  entityId: string;
  action: string;
  performedByUid: string;
  clinicId: string;
  performedAt: string;
  details?: string;
}

export const billingApi = {
  /**
   * Submit an invoice payload to the Java backend
   */
  async createInvoice(payload: InvoiceRequestDto): Promise<InvoiceResponseDto> {
    try {
      const response = await billingApiClient.post("/create", payload);

      return response.data;
    } catch (error: any) {
      console.error(
        "Error submitting invoice:",
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.message || "Failed to submit invoice",
      );
    }
  },

  /**
   * Retry syncing an invoice with IRD CBMS. Credentials are resolved
   * server-side from the invoice's clinic — only fiscalYear/isReturn travel here.
   */
  async retryIrdSync(
    javaId: number | string,
    params: { fiscalYear: string; isReturn?: boolean },
  ): Promise<any> {
    try {
      const response = await billingApiClient.post(`/${javaId}/retry-sync`, {
        fiscalYear: params.fiscalYear,
        isReturn: params.isReturn || false,
      });

      return response.data;
    } catch (error: any) {
      console.error(
        "Error retrying IRD sync:",
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.message || "Failed to retry IRD sync",
      );
    }
  },

  /**
   * Read the current clinic's IRD config (never includes the password itself).
   */
  async getClinicIrdConfig(): Promise<ClinicIrdConfigResponse> {
    const response = await billingApiClient.get("/clinic-config");

    return response.data;
  },

  /**
   * Upsert the current clinic's IRD config. Omit irdApiPassword to keep the existing one.
   */
  async saveClinicIrdConfig(
    payload: ClinicIrdConfigRequest,
  ): Promise<ClinicIrdConfigResponse> {
    const response = await billingApiClient.put("/clinic-config", payload);

    return response.data;
  },

  /**
   * Cancel an invoice with a mandatory documented reason (IRD clause 6(झ)).
   * Never deletes/edits the invoice's financial fields — only flips it
   * inactive; the original data submitted to IRD is preserved as-is.
   */
  async cancelInvoice(
    javaId: number | string,
    reason: string,
  ): Promise<InvoiceResponseDto> {
    try {
      const response = await billingApiClient.post(`/${javaId}/cancel`, {
        reason,
      });

      return response.data;
    } catch (error: any) {
      console.error(
        "Error cancelling invoice:",
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.message || "Failed to cancel invoice",
      );
    }
  },

  /**
   * Fetch the Schedule 5 master invoice table (IRD Electronic Billing
   * Procedure clause 6(ङ)), optionally scoped to one fiscal year.
   */
  async getSchedule5Report(params: {
    fiscalYear?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<Schedule5Record>> {
    const response = await billingApiClient.get("/schedule5-report", {
      params: {
        fiscalYear: params.fiscalYear || undefined,
        page: params.page ?? 0,
        size: params.size ?? 50,
      },
    });

    return response.data;
  },

  /**
   * The billing backend's automatic log-archive of every write action
   * (IRD clause 6(ग)/6(ट)) — invoice creation, IRD retry-sync, cancellations,
   * and clinic IRD config changes.
   */
  async getAuditLog(params: {
    page?: number;
    size?: number;
  } = {}): Promise<PageResponse<BillingAuditLogEntry>> {
    const response = await billingApiClient.get("/audit-log", {
      params: {
        page: params.page ?? 0,
        size: params.size ?? 25,
      },
    });

    return response.data;
  },
};
