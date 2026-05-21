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

      // Clean up undefined values from logData to prevent Firestore errors
      const sanitizedLogData = Object.fromEntries(
        Object.entries(logData).filter(([_, value]) => value !== undefined),
      );

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
      let q = query(logsRef);

      // Apply filters
      if (filters?.clinicId) {
        q = query(q, where("clinicId", "==", filters.clinicId));
      }

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
        where("clinicId", "==", clinicId),
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
          where("clinicId", "==", clinicId),
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
};
