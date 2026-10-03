import axios from "axios";

import { auth } from "../../config/firebase";
import { computeIdempotencyKey } from "../../utils/idempotencyKey";

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

  /**
   * The Firestore collection + document this invoice is created from. Lets
   * the backend later mirror IRD sync state onto exactly that document, and
   * gives reconciliation an exact join key instead of matching on a number
   * field each module names differently.
   */
  sourceCollection?: string;
  sourceDocId?: string;

  /** True for a sales-return invoice — routes IRD submission to /api/billreturn. */
  isReturn?: boolean;

  /**
   * Required (per IRD's CBMS API) when isReturn is true — the invoice
   * number of the original invoice this credit note reverses. Sent to IRD
   * as ref_invoice_number. Ignored when isReturn is false.
   */
  refInvoiceNumber?: string;

  /**
   * Required (per IRD's CBMS API) when isReturn is true — the stated reason
   * for the return. Sent to IRD as reason_for_return. Ignored when isReturn
   * is false.
   */
  reasonForReturn?: string;

  /**
   * Optional prefix to use instead of the Java backend's hardcoded "INV"
   * default (e.g. the clinic's configured invoicePrefix billing setting,
   * or "CN" for a credit note). Ignored when preAssignedInvoiceNumber is
   * also supplied.
   */
  invoicePrefix?: string;

  /**
   * Client-generated key identifying this specific create-invoice attempt.
   * Lets a retry after a dropped connection return the already-created
   * invoice instead of creating a duplicate — see src/utils/idempotencyKey.ts.
   */
  idempotencyKey?: string;

  items: InvoiceItemDto[];
}

/**
 * Builds the InvoiceRequestDto sent to POST /api/billing/create, including
 * its idempotencyKey. This exact field mapping used to be independently
 * reimplemented at every call site that submits an invoice to the Java
 * backend (appointmentBillingService, pathologyBillingService,
 * pharmacyService's purchase-create and purchase-return flows) —
 * field-for-field identical in three of the four, differing only in how
 * each domain resolves its own totals/items/invoice number beforehand.
 * Callers still compute those domain-specific values themselves; this only
 * centralizes assembling them into the wire payload.
 */
export function buildInvoicePayload(params: {
  clinicId: string;
  patientId?: string;
  patientName?: string;
  patientPanVat?: string;
  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  exemptAmount: number;
  discountAmount?: number;
  paymentMethod?: string;
  irdEnabled: boolean;
  fiscalYear: string;
  /** Pharmacy only — see InvoiceRequestDto.preAssignedInvoiceNumber. */
  preAssignedInvoiceNumber?: string;
  /** e.g. a clinic's configured prefix, or "CN" for a credit note. */
  invoicePrefix?: string;
  /** Firestore collection this invoice is created from, e.g. "medicinePurchases". */
  sourceCollection?: string;
  /** Firestore document id this invoice is created from. */
  sourceDocId?: string;
  /** Stable identity for this filing when no invoice number is reserved yet. */
  idempotencyDiscriminator?: string;
  isReturn?: boolean;
  /** Required when isReturn is true — ignored otherwise. */
  refInvoiceNumber?: string;
  /** Required when isReturn is true — ignored otherwise. */
  reasonForReturn?: string;
  items: InvoiceItemDto[];
}): InvoiceRequestDto {
  const buyerName = params.patientName || "Cash Sales";

  return {
    firebasePatientId: params.patientId || "",
    buyerName,
    buyerPan: params.patientPanVat || "",
    totalAmount: params.totalAmount,
    taxableAmount: params.taxableAmount,
    taxAmount: params.taxAmount,
    exemptAmount: params.exemptAmount,
    discountAmount: params.discountAmount,
    paymentMethod: params.paymentMethod,
    irdEnabled: params.irdEnabled,
    fiscalYear: params.fiscalYear,
    preAssignedInvoiceNumber: params.preAssignedInvoiceNumber,
    isReturn: params.isReturn,
    refInvoiceNumber: params.isReturn ? params.refInvoiceNumber : undefined,
    reasonForReturn: params.isReturn ? params.reasonForReturn : undefined,
    invoicePrefix: params.invoicePrefix,
    sourceCollection: params.sourceCollection,
    sourceDocId: params.sourceDocId,
    // Deterministic per-content key — a network-drop retry of this exact
    // submission reuses it, so the backend returns the already-created
    // invoice instead of minting a duplicate.
    idempotencyKey: computeIdempotencyKey({
      clinicId: params.clinicId,
      buyerName,
      totalAmount: params.totalAmount,
      items: params.items,
      preAssignedInvoiceNumber: params.preAssignedInvoiceNumber,
      uniqueKey: params.idempotencyDiscriminator,
    }),
    items: params.items,
  };
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
  /**
   * The Firestore document this ledger row belongs to, as the backend has it
   * recorded. On a fresh create it is the id the caller just sent. On an
   * idempotent replay it is the id of the document the ORIGINAL create used —
   * which is how a caller can tell the two apart (see resolveReplayTarget).
   * /create returns the whole Invoice entity, so these have always been on
   * the wire; they were simply not declared here.
   */
  sourceCollection?: string;
  sourceDocId?: string;
}

/**
 * A row of the authoritative MySQL ledger — the record IRD actually sees.
 * Returned by the invoice-by-number lookup and the reconciliation endpoint.
 */
export interface LedgerRecordDto {
  id: number;
  invoiceNumber: string;
  invoiceDate?: string;
  fiscalYear?: string;
  buyerName?: string;
  totalAmount?: number;
  taxableAmount?: number;
  taxAmount?: number;
  exemptAmount?: number;
  discountAmount?: number;
  irdSynced: boolean;
  irdSyncDate?: string;
  cbmsResponseCode?: string;
  irdSyncAttempts?: number;
  irdNeedsManualReview?: boolean;
  active?: boolean;
  sourceCollection?: string;
  sourceDocId?: string;
}

/**
 * One row of the master invoice/sales table required by IRD's Electronic
 * Billing Procedure, Schedule 5 (अनुसूची ५) — see billing-backend's
 * Schedule5RecordDto for field-by-field provenance. printedTime/printedBy are
 * populated from the invoice's own last_printed_at/last_printed_by columns
 * (see /record-print). Only vatRefundAmount/transactionId are always null:
 * both are "(if any)" in the schedule and belong to the digital-payment VAT
 * rebate flow, which this clinic does not participate in.
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
   * Atomically reserve the next number from the shared invoice sequence
   * WITHOUT creating an invoice row. For callers (currently only pharmacy)
   * that must have a real, IRD-sequence number in hand before some other
   * irreversible state change (e.g. a Firestore stock-deduction transaction)
   * commits — see BillingController.reserveNumber. Throws on failure; the
   * caller is expected to fall back to a clearly-marked degraded path
   * (pharmacy's own local counter) rather than block the sale entirely on
   * this backend being reachable.
   */
  async reserveInvoiceNumber(params: {
    fiscalYear: string;
    prefix?: string;
  }): Promise<string> {
    const response = await billingApiClient.post("/reserve-number", params);

    if (!response.data?.invoiceNumber) {
      throw new Error("Java backend did not return a reserved invoice number");
    }

    return response.data.invoiceNumber;
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
   * Mirror a print/reprint event into the MySQL ledger's Schedule 5 fields
   * (Is_Bill_Printed/Printed_Time/Printed_By), alongside the caller's own
   * Firestore printCount write. Best-effort: a failure here must never
   * block the actual print, so callers should fire-and-forget this (or
   * catch and log, never surface to the user).
   */
  async recordPrint(javaId: number | string): Promise<void> {
    await billingApiClient.post(`/${javaId}/record-print`, {});
  },

  /**
   * Look up one ledger row by invoice number. Returns null when no such row
   * exists — the signal that a sale was never filed with IRD.
   *
   * Fails closed by design: a missing backing endpoint also yields 404, so
   * until that endpoint ships this reports "not filed" for every lookup.
   * That is the safe direction — callers must never mark something
   * IRD-synced without a confirmed ledger row.
   */
  async getInvoiceByNumber(
    invoiceNumber: string,
  ): Promise<LedgerRecordDto | null> {
    try {
      const response = await billingApiClient.get("/invoice-by-number", {
        params: { invoiceNumber },
      });

      return response.data ?? null;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  },

  /**
   * Attach the Firestore document pointer to an existing ledger row and
   * mirror its IRD state onto that document. Used to repair rows created
   * before the pointer existed, whose sync badge the backend otherwise has
   * no way to address. The mapping must come from an exact match, never a
   * guess. Rejected for returns.
   */
  async attachSourcePointer(
    ledgerId: number,
    sourceCollection: string,
    sourceDocId: string,
  ): Promise<LedgerRecordDto> {
    const response = await billingApiClient.post(
      `/${ledgerId}/source-pointer`,
      { sourceCollection, sourceDocId },
    );

    return response.data;
  },

  /**
   * The ledger as reconciliation needs it — exposes the sync
   * attempt/response/review state and source-document pointer that the
   * Schedule 5 report deliberately omits.
   */
  async getReconciliation(params: {
    fiscalYear?: string;
    syncState?: "all" | "unsynced" | "needsReview";
    page?: number;
    size?: number;
  }): Promise<PageResponse<LedgerRecordDto>> {
    const response = await billingApiClient.get("/reconciliation", {
      params: {
        fiscalYear: params.fiscalYear || undefined,
        syncState: params.syncState || "all",
        page: params.page ?? 0,
        size: params.size ?? 200,
      },
    });

    return response.data;
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
