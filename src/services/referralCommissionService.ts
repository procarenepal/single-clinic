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
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  PathologyBilling,
  ReferralPartner,
  ReferralCommission,
} from "../types/models";

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
    branchId: string,
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
        branchId,
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

      );

      let querySnapshot;

      try {
        const orderedQuery = query(
          collection(db, this.collectionName),
          where("partnerId", "==", partnerId),

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
      const simpleQuery = query(
        collection(db, this.collectionName),

      );

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
      const commissionDoc = await getDoc(docRef);

      if (!commissionDoc.exists()) {
        throw new Error("Commission record not found");
      }

      const currentCommission = commissionDoc.data() as ReferralCommission;

      const updateData: any = {
        paidAmount: (currentCommission.paidAmount || 0) + paidAmount,
        paymentMethod,
        paidDate: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        status:
          (currentCommission.paidAmount || 0) + paidAmount >=
          currentCommission.commissionAmount
            ? "paid"
            : "pending",
      };

      if (paymentReference !== undefined)
        updateData.paymentReference = paymentReference;
      if (paymentNotes !== undefined) updateData.paymentNotes = paymentNotes;
      if (paidBy !== undefined) updateData.paidBy = paidBy;

      await updateDoc(docRef, updateData);

      // Update partner's pending balance (decrease it as payment is made)
      const partnerRef = doc(
        db,
        "referralPartners",
        currentCommission.partnerId,
      );

      await updateDoc(partnerRef, {
        totalCommissionBalance: increment(-paidAmount),
        updatedAt: Timestamp.now(),
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

      const stats = commissions.reduce(
        (acc, commission) => {
          acc.totalCommission += commission.commissionAmount;
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

      stats.pendingCommission = stats.totalCommission - stats.paidCommission;

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
   * Update commission status (for cancelling commissions)
   */
  async updateCommissionStatus(
    commissionId: string,
    status: "pending" | "paid" | "cancelled",
  ): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, commissionId);

      await updateDoc(docRef, {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Error updating referral commission status:", error);
      throw error;
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
