import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  getDoc,
  increment,
  runTransaction,
} from "firebase/firestore";

import { auth, db } from "@/config/firebase";
import { StaffCommission } from "@/types/models";
import {
  buildClawbackRecord,
  cancellationCounterDeltas,
  partialReversalPlan,
} from "./core/commissionClawbackCore";
import { applyCommissionPayment } from "./core/commissionPaymentCore";
import {
  commissionDocId,
  registrationAnchorId,
} from "./core/commissionIdempotencyCore";
import { auditLogService } from "./auditLogService";

class StaffCommissionService {
  private collectionName = "staffCommissions";

  /**
   * Create a commission record for a staff member during registration
   */
  async createRegistrationCommission(
    staffId: string,
    staffName: string,
    clinicId: string,
    patientId: string,
    patientName: string,
    appointmentTypeName: string,
    totalAmount: number,
    commissionAmount: number,
    commissionPercentage: number,
    createdBy: string,
    // The real invoice id this commission is earned on, when one already
    // exists (e.g. a referral bonus recorded at payment time). Omit it for
    // a true registration-time commission, before any invoice exists —
    // the patientId anchors the duplicate guard instead (see
    // registrationAnchorId), rather than leaving that path unguarded.
    billingId?: string,
  ): Promise<string | null> {
    try {
      if (commissionAmount <= 0) return null;

      const anchorId = billingId || registrationAnchorId(patientId);
      const commissionData: Omit<StaffCommission, "id"> = {
        staffId,
        staffName,
        clinicId,
        branchId: clinicId,
        billingId: anchorId,
        billingType: "appointment",
        invoiceNumber: "REG-COMM-STAFF",
        appointmentDate: new Date(),
        patientId,
        patientName,
        serviceNames: [appointmentTypeName],
        totalInvoiceAmount: totalAmount,
        commissionPercentage,
        commissionAmount,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
      };

      // A deterministic id (not addDoc's auto-generated one) turns "does
      // one already exist" into a single get-by-id inside a transaction,
      // which Firestore's optimistic concurrency control makes race-proof
      // — two concurrent calls for the same anchor+staff can no longer
      // both see "nothing yet" and both write. Previously this guard only
      // existed (and only via a race-prone query) when billingId was
      // passed; the true-registration path had none at all.
      const docId = commissionDocId(anchorId, staffId);
      const docRef = doc(db, this.collectionName, docId);
      const staffRef = doc(db, "staff", staffId);
      let created = false;

      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(docRef);

        if (existing.exists()) {
          console.warn(
            `Staff commission already exists for staff ${staffId} on anchor ${anchorId}. Skipping.`,
          );

          return;
        }

        transaction.set(docRef, {
          ...commissionData,
          createdAt: Timestamp.fromDate(commissionData.createdAt),
          updatedAt: Timestamp.fromDate(commissionData.updatedAt),
          appointmentDate: Timestamp.fromDate(commissionData.appointmentDate),
        });
        transaction.update(staffRef, {
          totalCommissionEarned: increment(commissionAmount),
          totalCommissionBalance: increment(commissionAmount),
          updatedAt: Timestamp.now(),
        });
        created = true;
      });

      if (created) {
        await auditLogService.logCommissionEvent({
          performedBy: createdBy,
          clinicId,
          branchId: clinicId,
          commissionId: docId,
          clinicianType: "staff",
          clinicianId: staffId,
          clinicianName: staffName,
          action: "created",
          amount: commissionAmount,
          billingId: anchorId,
        });
      }

      return created ? docId : null;
    } catch (error) {
      console.error("Error creating registration staff commission:", error);
      throw error;
    }
  }

  // Get all commissions for a staff member
  async getCommissionsByStaff(
    staffId: string,
    clinicId: string,
  ): Promise<StaffCommission[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where("staffId", "==", staffId),
        where("clinicId", "==", clinicId),
      );

      const querySnapshot = await getDocs(q);

      const commissions = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          appointmentDate: data.appointmentDate?.toDate() || new Date(),
          paidDate: data.paidDate?.toDate(),
        };
      }) as StaffCommission[];

      return commissions.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      console.error("Error getting commissions by staff:", error);

      return [];
    }
  }

  // Get all commissions for a billing
  async getCommissionsByBillingId(
    billingId: string,
  ): Promise<StaffCommission[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where("billingId", "==", billingId),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          appointmentDate: data.appointmentDate?.toDate() || new Date(),
          paidDate: data.paidDate?.toDate(),
        };
      }) as StaffCommission[];
    } catch (error) {
      console.error("Error getting staff commissions by billing ID:", error);

      return [];
    }
  }

  /**
   * Money that already left the clinic is owed back. Record that as a
   * negative pending commission naming the original, so the next payout
   * nets it (see commissionClawbackCore). Never throws: the reversal that
   * called this is already durable, and a failure here is loud, not fatal.
   */
  private async recordClawback(
    original: object,
    originalId: string,
    owedBack?: number,
    reason?: string,
  ): Promise<void> {
    try {
      const now = new Date();
      const clawback = buildClawbackRecord(
        original,
        originalId,
        auth.currentUser?.uid || "system",
        now,
        reason,
        owedBack,
      );

      if (!clawback) return;

      await addDoc(collection(db, this.collectionName), {
        ...clawback,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
    } catch (error) {
      console.error(
        "Staff commission " +
          originalId +
          " reversed but its paid-out portion could not be recorded as owed back:",
        error,
      );
    }
  }

  // Update commission status (for cancelling commissions)
  async updateCommissionStatus(
    commissionId: string,
    status: "pending" | "paid" | "cancelled",
  ): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, commissionId);
      const commissionDoc = await getDoc(docRef);

      if (!commissionDoc.exists()) {
        throw new Error("Commission not found");
      }

      const commissionData = commissionDoc.data() as StaffCommission;

      const cancelling =
        status === "cancelled" && commissionData.status !== "cancelled";

      if (cancelling) {
        // Balance drops by the WHOLE amount: the unpaid part is no longer
        // owed, and the paid part is now owed back (carried by the clawback
        // below). See commissionClawbackCore.
        const delta = cancellationCounterDeltas(commissionData);
        const staffRef = doc(db, "staff", commissionData.staffId);

        await updateDoc(staffRef, {
          totalCommissionEarned: increment(delta.earned),
          totalCommissionBalance: increment(delta.balance),
          updatedAt: Timestamp.now(),
        });
      }

      await updateDoc(docRef, {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      if (cancelling) {
        await auditLogService.logCommissionEvent({
          performedBy: auth.currentUser?.uid || "system",
          clinicId: commissionData.clinicId,
          branchId: commissionData.branchId,
          commissionId,
          clinicianType: "staff",
          clinicianId: commissionData.staffId,
          clinicianName: commissionData.staffName,
          action: "cancelled",
          amount: commissionData.commissionAmount,
          billingId: commissionData.billingId,
        });

        await this.recordClawback(commissionData, commissionId);
      }
    } catch (error) {
      console.error("Error updating staff commission status:", error);
      throw error;
    }
  }

  /**
   * Reduce a still-pending commission by a proportional amount (e.g. a
   * partial package refund) rather than fully cancelling it. Never reduces
   * below what has already been paid on it; the reversed share that had
   * already been paid out is recorded as owed back (a clawback, see
   * commissionClawbackCore).
   */
  async reduceCommissionAmount(
    commissionId: string,
    reduceByAmount: number,
  ): Promise<void> {
    if (reduceByAmount <= 0) return;
    try {
      const docRef = doc(db, this.collectionName, commissionId);
      const commissionDoc = await getDoc(docRef);

      if (!commissionDoc.exists()) {
        throw new Error("Commission not found");
      }

      const commissionData = commissionDoc.data() as StaffCommission;

      if (commissionData.status === "cancelled") return;

      const plan = partialReversalPlan(commissionData, reduceByAmount);

      if (!plan) return;

      const staffRef = doc(db, "staff", commissionData.staffId);

      await updateDoc(staffRef, {
        totalCommissionEarned: increment(plan.earnedDelta),
        totalCommissionBalance: increment(plan.balanceDelta),
        updatedAt: Timestamp.now(),
      });

      // The paid share of the reversed part moves onto the clawback below,
      // so a later full cancel cannot claw it back a second time.
      await updateDoc(docRef, {
        commissionAmount: plan.newCommissionAmount,
        paidAmount: plan.newPaidAmount,
        status: plan.newStatus,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      await auditLogService.logCommissionEvent({
        performedBy: auth.currentUser?.uid || "system",
        clinicId: commissionData.clinicId,
        branchId: commissionData.branchId,
        commissionId,
        clinicianType: "staff",
        clinicianId: commissionData.staffId,
        clinicianName: commissionData.staffName,
        action: "clawed_back",
        amount: reduceByAmount,
        billingId: commissionData.billingId,
      });

      // The reversed share that had already been paid out is owed back.
      if (plan.overpaid > 0) {
        await this.recordClawback(
          commissionData,
          commissionId,
          plan.overpaid,
          "Invoice partially reversed after this commission was paid out",
        );
      }
    } catch (error) {
      console.error("Error reducing staff commission amount:", error);
      throw error;
    }
  }

  // Get all commissions for a clinic
  async getCommissionsByClinic(clinicId: string): Promise<StaffCommission[]> {
    try {
      const q = query(collection(db, this.collectionName));

      const querySnapshot = await getDocs(q);

      const commissions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        appointmentDate: doc.data().appointmentDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
      })) as StaffCommission[];

      return commissions.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      console.error("Error getting commissions by clinic:", error);

      return [];
    }
  }

  // Pay commission to staff
  async payCommission(
    commissionId: string,
    paidAmount: number,
    paymentMethod: string,
    paymentReference?: string,
    paymentNotes?: string,
    paidBy?: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, commissionId);
      let committed: StaffCommission | null = null;

      // Read-validate-write inside one transaction — see the identical fix
      // in doctorCommissionService.payCommission for the race it prevents.
      await runTransaction(db, async (transaction) => {
        const commissionDoc = await transaction.get(docRef);

        if (!commissionDoc.exists()) {
          throw new Error("Commission record not found");
        }

        const currentCommission = commissionDoc.data() as StaffCommission;

        if (currentCommission.status === "cancelled") {
          throw new Error("This commission has been cancelled.");
        }

        // Handles both directions: an ordinary payout, and recovering a
        // clawback (negative commission). See commissionPaymentCore.
        const applied = applyCommissionPayment(currentCommission, paidAmount);

        const updateData: any = {
          paidAmount: applied.paidAmount,
          paymentMethod,
          paidDate: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
          status: applied.status,
        };

        if (paymentReference !== undefined)
          updateData.paymentReference = paymentReference;
        if (paymentNotes !== undefined) updateData.paymentNotes = paymentNotes;
        if (paidBy !== undefined) updateData.paidBy = paidBy;

        transaction.update(docRef, updateData);

        const staffRef = doc(db, "staff", currentCommission.staffId);

        transaction.update(staffRef, {
          totalCommissionBalance: increment(applied.balanceDelta),
          updatedAt: Timestamp.now(),
        });
        committed = currentCommission;
      });

      await auditLogService.logCommissionEvent({
        performedBy: paidBy || auth.currentUser?.uid || "system",
        clinicId: committed?.clinicId,
        branchId: committed?.branchId,
        commissionId,
        clinicianType: "staff",
        clinicianId: committed?.staffId,
        clinicianName: committed?.staffName,
        action: "paid",
        amount: paidAmount,
        billingId: committed?.billingId,
      });
    } catch (error) {
      console.error("Error paying staff commission:", error);
      throw error;
    }
  }
}

export const staffCommissionService = new StaffCommissionService();
