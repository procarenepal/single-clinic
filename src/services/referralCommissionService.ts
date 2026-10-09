import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  addDoc,
  orderBy,
  Timestamp,
  increment,
  runTransaction,
} from "firebase/firestore";

import { auth, db } from "../config/firebase";
import {
  PathologyBilling,
  ReferralPartner,
  ReferralCommission,
} from "../types/models";
import {
  buildClawbackRecord,
  cancellationCounterDeltas,
  partialReversalPlan,
} from "./core/commissionClawbackCore";
import { applyCommissionPayment } from "./core/commissionPaymentCore";
import {
  earnedAmount,
  isClawback,
  summarizeCommissions,
} from "./core/commissionAggregatesCore";

/**
 * Service for managing referral commissions in Firestore
 */
class ReferralCommissionService {
  private collectionName = "referralCommissions";

  /**
   * Create a new commission for a referral partner from a pathology invoice (legacy alias)
   */
  async createPathologyCommission(
    billing: PathologyBilling,
    partner: ReferralPartner,
    commissionAmount: number,
    createdBy: string,
  ): Promise<string | null> {
    return this.createReferralCommission(
      billing as any,
      partner,
      commissionAmount,
      createdBy,
    );
  }

  /**
   * Create a new commission for a referral partner from any billing record (Appointment or Pathology)
   */
  async createReferralCommission(
    billing: any, // Can be AppointmentBilling or PathologyBilling
    partner: ReferralPartner,
    commissionAmount: number,
    createdBy: string,
  ): Promise<string | null> {
    try {
      if (commissionAmount <= 0) return null;

      // Prevent duplicate commissions by checking if any already exist for this billingId
      const existingCommissionsQuery = query(
        collection(db, this.collectionName),
        where("billingId", "==", billing.id),
        where("partnerId", "==", partner.id)
      );
      const existingDocs = await getDocs(existingCommissionsQuery);
      
      if (!existingDocs.empty) {
        console.warn(`Referral commission already exists for partner ${partner.id} on billing ID ${billing.id}. Skipping.`);
        return null;
      }

      const commissionData: Omit<ReferralCommission, "id"> = {
        partnerId: partner.id!,
        partnerName: partner.name,
        clinicId: billing.clinicId,
        branchId: billing.branchId,
        billingId: billing.id,
        invoiceNumber: billing.invoiceNumber,
        invoiceDate:
          billing.invoiceDate instanceof Date
            ? billing.invoiceDate
            : billing.invoiceDate?.toDate
              ? billing.invoiceDate.toDate()
              : new Date(billing.invoiceDate),
        patientId: billing.patientId || "",
        patientName: billing.patientName,
        serviceNames:
          billing.items?.map(
            (item: any) => item.testName || item.appointmentTypeName,
          ) || [],
        totalInvoiceAmount: billing.totalAmount,
        commissionPercentage: partner.defaultCommission || 0,
        commissionAmount: commissionAmount,
        status: "pending",
        paidAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
      };

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...commissionData,
        createdAt: Timestamp.fromDate(commissionData.createdAt),
        updatedAt: Timestamp.fromDate(commissionData.updatedAt),
        invoiceDate: Timestamp.fromDate(commissionData.invoiceDate),
      });

      // Update partner's balance and lifetime earnings
      const partnerRef = doc(db, "referralPartners", partner.id!);

      await updateDoc(partnerRef, {
        totalCommissionEarned: increment(commissionAmount),
        totalCommissionBalance: increment(commissionAmount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating referral commission:", error);
      throw error;
    }
  }

  /**
   * Create a commission record for a referral partner during registration
   * This is used when no full billing record (invoice) exists yet
   */
  async createRegistrationCommission(
    partner: ReferralPartner,
    clinicId: string,
    patientId: string,
    patientName: string,
    appointmentTypeName: string,
    totalAmount: number,
    commissionAmount: number,
    createdBy: string,
  ): Promise<string | null> {
    try {
      if (commissionAmount <= 0) return null;

      const commissionData: Omit<ReferralCommission, "id"> = {
        partnerId: partner.id!,
        partnerName: partner.name,
        clinicId,
        branchId: clinicId,
        billingId: `reg_${Date.now()}`, // Synthetic ID for registration-based commission
        invoiceNumber: "REG-COMM", // Placeholder for registration commission
        invoiceDate: new Date(),
        patientId,
        patientName,
        serviceNames: [appointmentTypeName],
        totalInvoiceAmount: totalAmount,
        commissionPercentage: partner.defaultCommission || 0,
        commissionAmount: commissionAmount,
        status: "pending",
        paidAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
      };

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...commissionData,
        createdAt: Timestamp.fromDate(commissionData.createdAt),
        updatedAt: Timestamp.fromDate(commissionData.updatedAt),
        invoiceDate: Timestamp.fromDate(commissionData.invoiceDate),
      });

      // Update partner's balance and lifetime earnings
      const partnerRef = doc(db, "referralPartners", partner.id!);

      await updateDoc(partnerRef, {
        totalCommissionEarned: increment(commissionAmount),
        totalCommissionBalance: increment(commissionAmount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating registration referral commission:", error);
      throw error;
    }
  }

  /**
   * Get all commissions for a partner
   */
  async getCommissionsByPartner(
    partnerId: string,
    clinicId: string,
  ): Promise<ReferralCommission[]> {
    try {
      const simpleQuery = query(
        collection(db, this.collectionName),
        where("partnerId", "==", partnerId),
        where("clinicId", "==", clinicId),
      );

      let querySnapshot;

      try {
        const orderedQuery = query(
          collection(db, this.collectionName),
          where("partnerId", "==", partnerId),
          where("clinicId", "==", clinicId),
          orderBy("createdAt", "desc"),
        );

        querySnapshot = await getDocs(orderedQuery);
      } catch (indexError) {
        console.warn(
          "Index not found for referral commissions. Falling back to simple query.",
        );
        querySnapshot = await getDocs(simpleQuery);
      }

      const commissions = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          invoiceDate: data.invoiceDate?.toDate() || new Date(),
          paidDate: data.paidDate?.toDate(),
        };
      }) as ReferralCommission[];

      // Always sort client-side as a safeguard
      return commissions.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      console.error("Error getting commissions by partner:", error);

      return [];
    }
  }

  /**
   * Get all commissions for a clinic
   */
  async getCommissionsByClinic(
    clinicId: string,
  ): Promise<ReferralCommission[]> {
    try {
      const simpleQuery = query(collection(db, this.collectionName));

      let querySnapshot;

      try {
        const q = query(
          collection(db, this.collectionName),

          orderBy("createdAt", "desc"),
        );

        querySnapshot = await getDocs(q);
      } catch (indexError) {
        console.warn(
          "Index not found for clinic commissions. Falling back to simple query.",
        );
        querySnapshot = await getDocs(simpleQuery);
      }

      const commissions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        invoiceDate: doc.data().invoiceDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
      })) as ReferralCommission[];

      // Always sort client-side as a safeguard
      return commissions.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      console.error("Error getting commissions by clinic:", error);

      return [];
    }
  }

  /**
   * Pay commission to referral partner
   */
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

      // Read-validate-write inside one transaction — see the identical fix
      // in doctorCommissionService.payCommission for the race it prevents.
      await runTransaction(db, async (transaction) => {
        const commissionDoc = await transaction.get(docRef);

        if (!commissionDoc.exists()) {
          throw new Error("Commission record not found");
        }

        const currentCommission = commissionDoc.data() as ReferralCommission;

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

        const partnerRef = doc(
          db,
          "referralPartners",
          currentCommission.partnerId,
        );

        transaction.update(partnerRef, {
          totalCommissionBalance: increment(applied.balanceDelta),
          updatedAt: Timestamp.now(),
        });
      });
    } catch (error) {
      console.error("Error paying referral commission:", error);
      throw error;
    }
  }

  /**
   * Get commission statistics for a partner
   */
  async getCommissionStats(
    partnerId: string,
    clinicId: string,
  ): Promise<{
    totalCommission: number;
    paidCommission: number;
    pendingCommission: number;
    totalInvoices: number;
    paidInvoices: number;
    pendingInvoices: number;
  }> {
    try {
      const commissions = await this.getCommissionsByPartner(
        partnerId,
        clinicId,
      );

      // Cancelled/reversed commissions must not count toward totals — see
      // the identical fix/rationale in doctorCommissionService.getCommissionStats.
      const liveCommissions = commissions.filter(
        (c) => c.status !== "cancelled",
      );

      const stats = liveCommissions.reduce(
        (acc, commission) => {
          // A clawback (negative, owed back on a reversed invoice) is a
          // receivable, not earnings or an invoice — see
          // commissionAggregatesCore. It shows up in pendingCommission.
          if (isClawback(commission)) return acc;

          acc.totalCommission += earnedAmount(commission);
          acc.paidCommission += commission.paidAmount || 0;
          acc.totalInvoices += 1;

          if (commission.status === "paid") {
            acc.paidInvoices += 1;
          } else if (commission.status === "pending") {
            acc.pendingInvoices += 1;
          }

          return acc;
        },
        {
          totalCommission: 0,
          paidCommission: 0,
          pendingCommission: 0,
          totalInvoices: 0,
          paidInvoices: 0,
          pendingInvoices: 0,
        },
      );

      // Net of anything owed back: this is what the clinic still owes.
      stats.pendingCommission = summarizeCommissions(commissions).outstanding;

      return stats;
    } catch (error) {
      console.error("Error getting referral commission stats:", error);

      return {
        totalCommission: 0,
        paidCommission: 0,
        pendingCommission: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
      };
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
        "Referral commission " +
          originalId +
          " reversed but its paid-out portion could not be recorded as owed back:",
        error,
      );
    }
  }

  /**
   * Update commission status (for cancelling commissions)
   */
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
      
      const commissionData = commissionDoc.data() as ReferralCommission;
      
      const cancelling =
        status === "cancelled" && commissionData.status !== "cancelled";

      if (cancelling) {
        // Balance drops by the WHOLE amount: the unpaid part is no longer
        // owed, and the paid part is now owed back (carried by the clawback
        // below). See commissionClawbackCore.
        const delta = cancellationCounterDeltas(commissionData);
        const partnerRef = doc(db, "referralPartners", commissionData.partnerId);

        await updateDoc(partnerRef, {
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
        await this.recordClawback(commissionData, commissionId);
      }
    } catch (error) {
      console.error("Error updating referral commission status:", error);
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

      const commissionData = commissionDoc.data() as ReferralCommission;

      if (commissionData.status === "cancelled") return;

      const plan = partialReversalPlan(commissionData, reduceByAmount);

      if (!plan) return;

      const partnerRef = doc(db, "referralPartners", commissionData.partnerId);

      await updateDoc(partnerRef, {
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
      console.error("Error reducing referral commission amount:", error);
      throw error;
    }
  }

  /**
   * Get all commissions for a billing (a billing can have multiple
   * referrers, each producing their own commission doc)
   */
  async getCommissionsByBillingId(
    billingId: string,
  ): Promise<ReferralCommission[]> {
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
          invoiceDate: data.invoiceDate?.toDate() || new Date(),
          paidDate: data.paidDate?.toDate(),
        };
      }) as ReferralCommission[];
    } catch (error) {
      console.error("Error getting referral commissions by billing ID:", error);

      return [];
    }
  }

  /**
   * Get commission by billing ID
   */
  async getCommissionByBillingId(
    billingId: string,
  ): Promise<ReferralCommission | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where("billingId", "==", billingId),
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];

      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        invoiceDate: doc.data().invoiceDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
      } as ReferralCommission;
    } catch (error) {
      console.error("Error getting referral commission by billing ID:", error);

      return null;
    }
  }
}

export const referralCommissionService = new ReferralCommissionService();
