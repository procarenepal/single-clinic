import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  increment,
  arrayUnion,
  runTransaction,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { PatientPackage } from "../types/models";

const PATIENT_PACKAGES_COLLECTION = "patientPackages";

// Shared mapping/auto-expire logic between getPatientPackages (per-patient)
// and getPatientPackagesByClinic (clinic-wide) — kept in one place so the
// auto-expire persistence behavior can't drift between the two.
function mapPatientPackageDoc(docSnap: any): PatientPackage {
  const data = docSnap.data();
  const expiresAt = data.expiresAt?.toDate();
  let status = data.status;

  // Auto-expire if past validity date. Persisted back (fire-and-forget,
  // not awaited) so every other read path — getPatientPackageById,
  // consumeSession — sees the same "expired" status instead of a
  // stale "active" one that was only ever corrected here for display.
  if (status === "active" && expiresAt && new Date() > expiresAt) {
    status = "expired";
    updateDoc(docSnap.ref, { status: "expired" }).catch((err) =>
      console.error("Error persisting auto-expired package status:", err),
    );
  }

  return {
    id: docSnap.id,
    ...data,
    status,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    expiresAt,
    refundedAt: data.refundedAt?.toDate?.(),
    sessionHistory: data.sessionHistory?.map((h: any) => ({
      ...h,
      consumedAt:
        typeof h.consumedAt?.toDate === "function"
          ? h.consumedAt.toDate()
          : h.consumedAt
            ? new Date(h.consumedAt)
            : new Date(),
    })),
    sessions: data.sessions?.map((s: any) => ({
      ...s,
      consumedAt: s.consumedAt
        ? typeof s.consumedAt?.toDate === "function"
          ? s.consumedAt.toDate()
          : new Date(s.consumedAt)
        : undefined,
    })),
  } as PatientPackage;
}

export const patientPackageService = {
  /**
   * Get all active packages for a patient
   */
  async getPatientPackages(
    patientId: string,
    clinicId: string,
  ): Promise<PatientPackage[]> {
    try {
      const q = query(
        collection(db, PATIENT_PACKAGES_COLLECTION),
        where("patientId", "==", patientId),
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(mapPatientPackageDoc);
    } catch (error) {
      console.error("Error fetching patient packages:", error);
      throw error;
    }
  },

  /**
   * Get every patient package for a clinic (not scoped to one patient) —
   * used by the clinic-wide expiry report.
   */
  async getPatientPackagesByClinic(
    clinicId: string,
  ): Promise<PatientPackage[]> {
    try {
      const constraints = [where("clinicId", "==", clinicId)];

      const q = query(
        collection(db, PATIENT_PACKAGES_COLLECTION),
        ...constraints,
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(mapPatientPackageDoc);
    } catch (error) {
      console.error("Error fetching patient packages by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a single patient package by ID
   */
  async getPatientPackageById(id: string): Promise<PatientPackage | null> {
    try {
      const docRef = doc(db, PATIENT_PACKAGES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();

      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        expiresAt: data.expiresAt?.toDate(),
      } as PatientPackage;
    } catch (error) {
      console.error("Error fetching patient package by ID:", error);

      return null;
    }
  },

  /**
   * Create a new patient package tracking record
   */
  async createPatientPackage(
    pkgData: Omit<PatientPackage, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const now = new Date();

      // Generate explicit session tickets if totalSessions is provided
      const sessions = pkgData.sessions || [];

      if (sessions.length === 0 && pkgData.totalSessions > 0) {
        for (let i = 1; i <= pkgData.totalSessions; i++) {
          sessions.push({
            sessionNumber: i,
            status: "pending",
          });
        }
      }

      const data = {
        ...pkgData,
        sessions,
        expiresAt: pkgData.expiresAt
          ? Timestamp.fromDate(pkgData.expiresAt)
          : null,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      const docRef = await addDoc(
        collection(db, PATIENT_PACKAGES_COLLECTION),
        data,
      );

      return docRef.id;
    } catch (error) {
      console.error("Error creating patient package:", error);
      throw error;
    }
  },

  /**
   * Start a session (mark as in-progress and link to an appointment)
   */
  async startSession(id: string, appointmentId: string): Promise<void> {
    try {
      const docRef = doc(db, PATIENT_PACKAGES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) throw new Error("Package not found");

      const data = docSnap.data() as PatientPackage;
      const sessions = data.sessions || [];

      // Find the first pending session
      const pendingIndex = sessions.findIndex((s) => s.status === "pending");

      if (pendingIndex === -1) {
        // No pending sessions, maybe they are all used or in-progress
        return;
      }

      sessions[pendingIndex] = {
        ...sessions[pendingIndex],
        status: "in-progress",
        appointmentId,
      };

      await updateDoc(docRef, {
        sessions,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error starting session:", error);
      throw error;
    }
  },

  /**
   * Consume a session (increment usedSessions)
   */
  async consumeSession(
    id: string,
    auditData?: {
      appointmentId: string;
      clinicianId?: string;
      clinicianName?: string;
    },
  ): Promise<void> {
    try {
      const docRef = doc(db, PATIENT_PACKAGES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) throw new Error("Package not found");

      const data = docSnap.data() as PatientPackage;
      const currentUsed = data.usedSessions || 0;
      const totalSessions = data.totalSessions || 0;
      const sessions = data.sessions || [];

      // Idempotency guard: consumeSession is called from multiple points in
      // a single visit's lifecycle (consultation-complete, checkout, and
      // the procedure-log/routing flow) with no coordination between them.
      // Without this check, one visit silently burns 2+ session tickets and
      // double-deducts the wallet. If a ticket is already marked completed
      // for this exact appointment, this is a repeat call, not a new
      // consumption — skip cleanly rather than throwing or double-counting.
      if (auditData?.appointmentId) {
        const alreadyConsumedForThisAppointment = sessions.some(
          (s) =>
            s.appointmentId === auditData.appointmentId &&
            s.status === "completed",
        );

        if (alreadyConsumedForThisAppointment) {
          console.warn(
            `Session already consumed for appointment ${auditData.appointmentId} on package ${id} — skipping duplicate consumption.`,
          );

          return;
        }
      }

      // Check expiry directly off expiresAt rather than trusting the stored
      // `status` field — nothing reliably persists "expired" back to the
      // document (see getPatientPackages), so a stale "active" status must
      // not be treated as proof the package hasn't actually expired.
      const expiresAtDate = (data as any).expiresAt?.toDate
        ? (data as any).expiresAt.toDate()
        : data.expiresAt
          ? new Date(data.expiresAt as any)
          : null;
      const isExpired =
        data.status === "expired" ||
        (expiresAtDate && new Date() > expiresAtDate);

      if (isExpired) {
        throw new Error("Cannot consume session: Package is expired");
      }

      if (data.status === "refunded") {
        throw new Error(
          "Cannot consume session: Package has been refunded and closed",
        );
      }

      if (currentUsed >= totalSessions) {
        throw new Error("Cannot consume session: No sessions remaining in this package");
      }

      // Deduct the session's wallet cost BEFORE marking the session
      // consumed, so a failed deduction (e.g. insufficient balance) blocks
      // consumption instead of silently granting a free session. If the
      // deduction succeeds here but the atomic consume-transaction below
      // then fails (e.g. lost a race to another concurrent consumeSession
      // call), the deduction is refunded so money is never taken without a
      // session actually being consumed.
      let deductedSessionCost = 0;

      if (data.packageId && totalSessions > 0) {
        const pkgRef = doc(db, "treatmentPackages", data.packageId);
        const pkgSnap = await getDoc(pkgRef);

        if (pkgSnap.exists()) {
          const pkgData = pkgSnap.data();
          const walletCreditAmount = pkgData.walletCreditAmount || 0;

          if (walletCreditAmount > 0) {
            const sessionCost = Math.round(walletCreditAmount / totalSessions);

            if (sessionCost > 0) {
              const { walletService } = await import("./walletService");

              await walletService.deductFunds(
                data.patientId,
                data.clinicId,
                sessionCost,
                data.id, // using package ticket as reference
                `Consumed 1 session of ${data.packageName} (Ticket #${currentUsed + 1})`,
                auditData?.clinicianId || "system",
              );
              deductedSessionCost = sessionCost;
            }
          }
        }
      }

      try {
        // Re-check-and-write inside a transaction so two concurrent
        // consumeSession calls on this package can't both pass the
        // currentUsed >= totalSessions guard before either commits.
        await runTransaction(db, async (transaction) => {
          const freshSnap = await transaction.get(docRef);

          if (!freshSnap.exists()) throw new Error("Package not found");

          const freshData = freshSnap.data() as PatientPackage;
          const freshUsed = freshData.usedSessions || 0;
          const freshTotal = freshData.totalSessions || 0;
          const freshSessions = freshData.sessions || [];

          if (freshUsed >= freshTotal) {
            throw new Error("Cannot consume session: No sessions remaining in this package");
          }

          const updates: any = {
            usedSessions: increment(1),
            updatedAt: Timestamp.now(),
          };

          if (auditData) {
            // Strip undefined values to prevent Firestore arrayUnion errors
            const cleanAuditData = Object.fromEntries(
              Object.entries(auditData).filter(([_, v]) => v !== undefined),
            );

            updates.sessionHistory = arrayUnion({
              ...cleanAuditData,
              consumedAt: Timestamp.now(),
            });

            // Find the specific session ticket to mark as completed
            // First try to find one linked to this appointment
            let targetIndex = freshSessions.findIndex(
              (s) =>
                s.appointmentId === auditData.appointmentId &&
                s.status !== "completed",
            );

            // If not found, just grab the first pending or in-progress
            if (targetIndex === -1) {
              targetIndex = freshSessions.findIndex((s) => s.status !== "completed");
            }

            if (targetIndex !== -1) {
              freshSessions[targetIndex] = {
                ...freshSessions[targetIndex],
                status: "completed",
                clinicianId: auditData.clinicianId,
                clinicianName: auditData.clinicianName,
                consumedAt: new Date(),
              };
              updates.sessions = freshSessions;
            }
          }

          if (freshUsed + 1 >= freshTotal) {
            updates.status = "completed";
          }

          transaction.update(docRef, updates);
        });
      } catch (consumeErr) {
        if (deductedSessionCost > 0) {
          try {
            const { walletService } = await import("./walletService");

            await walletService.refundFunds(
              data.patientId,
              data.clinicId,
              deductedSessionCost,
              data.id,
              "Session consumption failed after wallet deduction — automatic reversal",
              auditData?.clinicianId || "system",
            );
          } catch (refundErr) {
            console.error(
              "Error reversing wallet deduction after failed session consumption:",
              refundErr,
            );
          }
        }

        throw consumeErr;
      }
    } catch (error) {
      console.error("Error consuming session:", error);
      throw error;
    }
  },

  /**
   * Refund the value of unused sessions back to the patient's wallet and
   * close the package out so it can't be consumed further. The original
   * sale invoice is deliberately left untouched — the package's value was
   * credited to the wallet at sale time and drawn down per session, so
   * refunding unused wallet value is the mechanism that was actually used,
   * not the invoice itself.
   */
  async refundUnusedSessions(
    id: string,
    refundAmount: number,
    reason: string,
    createdBy: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, PATIENT_PACKAGES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) throw new Error("Package not found");

      const data = docSnap.data() as PatientPackage;
      const unusedSessions = Math.max(
        (data.totalSessions || 0) - (data.usedSessions || 0),
        0,
      );

      if (unusedSessions <= 0) {
        throw new Error("No unused sessions remain on this package to refund.");
      }
      if (data.status === "refunded") {
        throw new Error("This package has already been refunded.");
      }
      if (refundAmount <= 0) {
        throw new Error("Refund amount must be greater than 0.");
      }

      // Derive the same per-session wallet value consumeSession uses, so a
      // caller-supplied refundAmount can be capped server-side instead of
      // trusted outright — previously an arbitrary amount unrelated to the
      // actual unused-session value could be typed in and refunded.
      const totalSessions = data.totalSessions || 0;
      // Used below to reverse only a PROPORTIONAL share of the commission
      // earned on the original sale — falls back to unusedSessions/totalSessions
      // when the package's original wallet value can't be read.
      let commissionReversalRatio =
        totalSessions > 0 ? unusedSessions / totalSessions : 1;

      if (data.packageId && totalSessions > 0) {
        const pkgRef = doc(db, "treatmentPackages", data.packageId);
        const pkgSnap = await getDoc(pkgRef);

        if (pkgSnap.exists()) {
          const walletCreditAmount = pkgSnap.data().walletCreditAmount || 0;
          const sessionCost = Math.round(walletCreditAmount / totalSessions);
          const maxRefund = sessionCost * unusedSessions;

          if (refundAmount > maxRefund) {
            throw new Error(
              `Refund amount cannot exceed the value of the ${unusedSessions} unused session(s): NPR ${maxRefund}.`,
            );
          }

          if (walletCreditAmount > 0) {
            commissionReversalRatio = refundAmount / walletCreditAmount;
          }
        }
      }

      const { walletService } = await import("./walletService");

      await walletService.refundFunds(
        data.patientId,
        data.clinicId,
        refundAmount,
        id,
        `Refund for ${unusedSessions} unused session(s) of ${data.packageName}. Reason: ${reason}`,
        createdBy,
      );

      // Reverse the PROPORTIONAL share of commission earned on the original
      // package-sale invoice — every other cancellation/refund path in the
      // system reverses commission (appointment/pathology cancelBilling,
      // issueCreditNote), but this is a PARTIAL refund (unused sessions
      // only): a full reversal would claw back commission for sessions the
      // clinician already delivered, not just the refunded unused ones.
      if ((data as any).billingId) {
        try {
          const { reverseCommissionsForBilling } = await import(
            "./appointmentBillingService"
          );

          await reverseCommissionsForBilling(
            (data as any).billingId,
            commissionReversalRatio,
          );
        } catch (commissionError) {
          console.error(
            "Error reversing commission for refunded package:",
            commissionError,
          );
        }
      }

      await updateDoc(docRef, {
        status: "refunded",
        refundedAt: Timestamp.now(),
        refundedAmount: refundAmount,
        refundReason: reason,
        refundedSessions: unusedSessions,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error refunding unused sessions:", error);
      throw error;
    }
  },
};
