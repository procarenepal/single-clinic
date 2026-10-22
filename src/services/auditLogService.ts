import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";

import { db, auth } from "../config/firebase";
import { AuditLog } from "../types/models";
import { resolveClinicId } from "./currentClinic";

const AUDIT_LOGS_COLLECTION = "audit_logs";

export interface AuditLogFilters {
  eventType?: AuditLog["eventType"];
  clinicId?: string;
  branchId?: string;
  performedBy?: string;
  targetUserId?: string;
  targetRoleId?: string;
  status?: AuditLog["status"];
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string; // For searching in details, names, emails
}

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

/**
 * Recursively removes `undefined` values (including inside nested objects
 * and arrays) — Firestore's addDoc/setDoc reject undefined anywhere in the
 * document tree, not just at the top level.
 */
function deepStripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepStripUndefined(item)) as unknown as T;
  }

  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const cleaned: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        cleaned[key] = deepStripUndefined(val);
      }
    }

    return cleaned as T;
  }

  return value;
}

/**
 * Service for managing audit logs
 */
export const auditLogService = {
  /**
   * Create an audit log entry
   */
  async createLog(
    logData: Omit<AuditLog, "id" | "timestamp" | "createdAt">,
  ): Promise<string> {
    try {
      const logsRef = collection(db, AUDIT_LOGS_COLLECTION);

      // Clean up undefined values from logData to prevent Firestore errors.
      // This used to only strip TOP-LEVEL undefined keys — Firestore
      // rejects undefined anywhere in the object tree, not just at the
      // top, so a nested field like details.before (undefined for a
      // brand-new invoice with no prior state to diff against) still
      // slipped through and threw on every logDiscountTaxChange call at
      // invoice creation time. Now strips undefined at every level.
      const sanitizedLogData = deepStripUndefined(logData);

      const logEntry = {
        ...sanitizedLogData,
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(logsRef, logEntry);

      return docRef.id;
    } catch (error) {
      console.error("Error creating audit log:", error);

      // Don't throw error - logging failures shouldn't break the main operation
      return "";
    }
  },

  /**
   * Get audit logs with filtering and pagination
   */
  async getLogs(
    filters?: AuditLogFilters,
    pagination?: PaginationOptions,
  ): Promise<{
    logs: AuditLog[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    try {
      const logsRef = collection(db, AUDIT_LOGS_COLLECTION);
      // Always clinic-scoped. Audit logs are readable only where
      // resource.data.clinicId matches the caller's clinic, so leaving this
      // to an optional filter meant any caller that omitted it got
      // permission-denied rather than an unfiltered list.
      let q = query(
        logsRef,
        where("clinicId", "==", resolveClinicId(filters?.clinicId)),
      );

      if (filters?.branchId) {
        q = query(q, where("branchId", "==", filters.branchId));
      }

      if (filters?.eventType) {
        q = query(q, where("eventType", "==", filters.eventType));
      }

      if (filters?.performedBy) {
        q = query(q, where("performedBy", "==", filters.performedBy));
      }

      if (filters?.targetUserId) {
        q = query(q, where("targetUserId", "==", filters.targetUserId));
      }

      if (filters?.targetRoleId) {
        q = query(q, where("targetRoleId", "==", filters.targetRoleId));
      }

      if (filters?.status) {
        q = query(q, where("status", "==", filters.status));
      }

      if (filters?.startDate) {
        q = query(
          q,
          where("timestamp", ">=", Timestamp.fromDate(filters.startDate)),
        );
      }

      if (filters?.endDate) {
        q = query(
          q,
          where("timestamp", "<=", Timestamp.fromDate(filters.endDate)),
        );
      }

      // Order by timestamp (most recent first)
      q = query(q, orderBy("timestamp", "desc"));

      // Pagination
      const pageSize = pagination?.pageSize || 50;

      if (pagination?.lastDoc) {
        q = query(q, startAfter(pagination.lastDoc));
      }
      q = query(q, limit(pageSize));

      const querySnapshot = await getDocs(q);

      let logs: AuditLog[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        } as AuditLog;
      });

      // Apply search query filter if provided (client-side filtering for text search)
      if (filters?.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();

        logs = logs.filter((log) => {
          const searchableText = [
            log.performedByEmail,
            log.performedByName,
            log.details?.roleName,
            log.details?.userEmail,
            log.details?.userName,
            log.details?.clinicName,
            log.errorMessage,
            log.eventType,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(searchLower);
        });
      }

      const lastDoc =
        querySnapshot.docs.length > 0
          ? querySnapshot.docs[querySnapshot.docs.length - 1]
          : null;

      return { logs, lastDoc };
    } catch (error) {
      console.error("Error getting audit logs:", error);
      throw error;
    }
  },

  /**
   * Get all logs for a clinic (no pagination, for admin view)
   */
  async getClinicLogs(
    clinicId: string,
    limitCount: number = 1000,
  ): Promise<AuditLog[]> {
    try {
      const logsRef = collection(db, AUDIT_LOGS_COLLECTION);
      const q = query(
        logsRef,
        where("clinicId", "==", resolveClinicId(clinicId)),
        orderBy("timestamp", "desc"),
        limit(limitCount),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        } as AuditLog;
      });
    } catch (error: any) {
      // Fallback: If composite index is missing, do client-side sorting
      if (error.message?.includes("requires an index")) {
        console.warn(
          "Firestore index missing. Falling back to client-side sorting.",
          error.message,
        );

        const fallbackQuery = query(
          collection(db, AUDIT_LOGS_COLLECTION),
          where("clinicId", "==", resolveClinicId(clinicId)),
          limit(limitCount),
        );

        const querySnapshot = await getDocs(fallbackQuery);
        const logs = querySnapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
          } as AuditLog;
        });

        // Sort client-side descending
        return logs.sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
        );
      }

      console.error("Error getting clinic audit logs:", error);
      throw error;
    }
  },

  /**
   * Helper function to create a log entry with current user context
   */
  async logEvent(
    eventType: AuditLog["eventType"],
    clinicId: string,
    details: Record<string, any>,
    status: AuditLog["status"] = "success",
    errorMessage?: string,
    options?: {
      branchId?: string;
      targetUserId?: string;
      targetRoleId?: string;
      performedByEmail?: string;
      performedByName?: string;
    },
  ): Promise<void> {
    try {
      const currentUser = auth.currentUser;
      const performedBy = currentUser?.uid || "system";

      // Try to get user details if not provided
      let performedByEmail = options?.performedByEmail;
      let performedByName = options?.performedByName;

      if (!performedByEmail || !performedByName) {
        try {
          const { userService } = await import("./userService");
          const user = await userService.getUserById(performedBy);

          if (user) {
            performedByEmail = performedByEmail || user.email;
            performedByName = performedByName || user.displayName;
          }
        } catch (error) {
          // If we can't get user details, continue without them
          console.warn("Could not fetch user details for audit log:", error);
        }
      }

      await this.createLog({
        eventType,
        performedBy,
        performedByEmail,
        performedByName,
        clinicId,
        branchId: options?.branchId,
        targetUserId: options?.targetUserId,
        targetRoleId: options?.targetRoleId,
        details,
        status,
        errorMessage,
      });
    } catch (error) {
      console.error("Error logging event:", error);
      // Don't throw - logging failures shouldn't break operations
    }
  },

  /**
   * Helper to log payment events
   */
  async logPayment(data: {
    performedBy: string;
    performedByName?: string;
    performedByEmail?: string;
    clinicId: string;
    branchId?: string;
    invoiceNumber: string;
    amountPaid: number;
    paymentMethod: string;
    patientName?: string;
  }): Promise<string> {
    return this.createLog({
      eventType: "payment_recorded",
      performedBy: data.performedBy,
      performedByName: data.performedByName,
      performedByEmail: data.performedByEmail,
      clinicId: data.clinicId,
      branchId: data.branchId,
      status: "success",
      details: {
        invoiceNumber: data.invoiceNumber,
        amountPaid: data.amountPaid,
        paymentMethod: data.paymentMethod,
        patientName: data.patientName,
      },
    });
  },

  /**
   * Helper to log IRD Sync events
   */
  async logIrdSync(data: {
    performedBy?: string;
    clinicId: string;
    invoiceNumber: string;
    status: "success" | "failure";
    responseCode?: string;
    errorMessage?: string;
    details?: any;
  }): Promise<string> {
    return this.createLog({
      eventType: data.status === "success" ? "ird_synced" : "ird_sync_failed",
      performedBy: data.performedBy || "system",
      performedByName: "IRD CBMS Sync Engine",
      clinicId: data.clinicId,
      status: data.status,
      errorMessage: data.errorMessage,
      details: {
        invoiceNumber: data.invoiceNumber,
        responseCode: data.responseCode,
        ...data.details,
      },
    });
  },

  /**
   * Helper to log discount/tax changes on a billing document (creation or edit)
   */
  async logDiscountTaxChange(data: {
    performedBy: string;
    performedByName?: string;
    performedByEmail?: string;
    clinicId: string;
    branchId?: string;
    billingId: string;
    invoiceNumber?: string;
    /** Where the discount was decided — absent means the invoice itself (Settle). */
    source?: "intake" | "settle" | "pharmacy";
    before?: {
      discountType?: string;
      discountValue?: number;
      applyTax?: boolean;
      taxPercentage?: number;
      reason?: string;
    };
    after: {
      discountType?: string;
      discountValue?: number;
      applyTax?: boolean;
      taxPercentage?: number;
      reason?: string;
    };
  }): Promise<string> {
    return this.createLog({
      eventType: "billing_discount_tax_changed",
      performedBy: data.performedBy,
      performedByName: data.performedByName,
      performedByEmail: data.performedByEmail,
      clinicId: data.clinicId,
      branchId: data.branchId,
      status: "success",
      details: {
        billingId: data.billingId,
        invoiceNumber: data.invoiceNumber,
        source: data.source,
        before: data.before,
        after: data.after,
      },
    });
  },

  /**
   * Helper to log a wallet money movement — deposit, spend (deduction), or
   * refund. Collecting a deposit and spending wallet credit were previously
   * the one class of front-office money event with no audit trail at all:
   * every call site in walletService wrote the transaction row and balance
   * change with nothing recording who did it or why, unlike payments and
   * discounts elsewhere in the app.
   */
  async logWalletTransaction(data: {
    performedBy: string;
    performedByName?: string;
    performedByEmail?: string;
    clinicId: string;
    branchId?: string;
    patientId: string;
    patientName?: string;
    type: "deposit" | "deduction" | "refund";
    amount: number;
    notes?: string;
    referenceId?: string;
    referenceType?: string;
  }): Promise<string> {
    return this.createLog({
      eventType: "wallet_transaction",
      performedBy: data.performedBy,
      performedByName: data.performedByName,
      performedByEmail: data.performedByEmail,
      clinicId: data.clinicId,
      branchId: data.branchId,
      status: "success",
      details: {
        patientId: data.patientId,
        patientName: data.patientName,
        type: data.type,
        amount: data.amount,
        notes: data.notes,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
      },
    });
  },

  /**
   * Helper to log a patient package session lifecycle event — sold,
   * started, released back, consumed, or refunded. consumeSession in
   * particular both spends a prepaid session and deducts the matching
   * wallet credit with nothing recording it, the second-most-common
   * front-office money event after payments themselves.
   */
  async logPackageSessionEvent(data: {
    performedBy: string;
    performedByName?: string;
    performedByEmail?: string;
    clinicId: string;
    branchId?: string;
    packageId: string;
    packageName?: string;
    patientId?: string;
    action:
    | "created"
    | "session_started"
    | "session_released"
    | "session_consumed"
    | "refunded";
    details?: Record<string, any>;
  }): Promise<string> {
    return this.createLog({
      eventType: "package_session_event",
      performedBy: data.performedBy,
      performedByName: data.performedByName,
      performedByEmail: data.performedByEmail,
      clinicId: data.clinicId,
      branchId: data.branchId,
      status: "success",
      details: {
        packageId: data.packageId,
        packageName: data.packageName,
        patientId: data.patientId,
        action: data.action,
        ...data.details,
      },
    });
  },

  /**
   * Helper to log a commission lifecycle event — created, paid, cancelled,
   * or clawed back (amount reduced). One shared helper for all four
   * commission services (doctor/expert via their shared core, staff,
   * referral) rather than four separate ones, since the event shape is
   * identical across them — only clinicianType tells them apart.
   */
  async logCommissionEvent(data: {
    performedBy: string;
    performedByName?: string;
    performedByEmail?: string;
    clinicId: string;
    branchId?: string;
    commissionId: string;
    clinicianType: "doctor" | "expert" | "staff" | "referral-partner";
    clinicianId?: string;
    clinicianName?: string;
    action: "created" | "paid" | "cancelled" | "clawed_back";
    amount?: number;
    billingId?: string;
  }): Promise<string> {
    return this.createLog({
      eventType: "commission_event",
      performedBy: data.performedBy,
      performedByName: data.performedByName,
      performedByEmail: data.performedByEmail,
      clinicId: data.clinicId,
      branchId: data.branchId,
      status: "success",
      details: {
        commissionId: data.commissionId,
        clinicianType: data.clinicianType,
        clinicianId: data.clinicianId,
        clinicianName: data.clinicianName,
        action: data.action,
        amount: data.amount,
        billingId: data.billingId,
      },
    });
  },

  /**
   * Helper to log a batch's cost/sale price being changed — pharmacy had no
   * audit trail for this at all before; a price silently edited from 50 to
   * 5 left no forensic record.
   */
  async logPharmacyPriceChange(data: {
    performedBy: string;
    performedByName?: string;
    performedByEmail?: string;
    clinicId: string;
    branchId?: string;
    medicineId: string;
    medicineName?: string;
    batchNumber?: string;
    reason?: string;
    before: { salePrice?: number; costPrice?: number };
    after: { salePrice?: number; costPrice?: number };
  }): Promise<string> {
    return this.createLog({
      eventType: "pharmacy_price_changed",
      performedBy: data.performedBy,
      performedByName: data.performedByName,
      performedByEmail: data.performedByEmail,
      clinicId: data.clinicId,
      branchId: data.branchId,
      status: "success",
      details: {
        medicineId: data.medicineId,
        medicineName: data.medicineName,
        batchNumber: data.batchNumber,
        reason: data.reason,
        before: data.before,
        after: data.after,
      },
    });
  },
};
