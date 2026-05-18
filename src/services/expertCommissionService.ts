import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
  increment,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { ExpertCommission, AppointmentBilling } from "@/types/models";

class ExpertCommissionService {
  private collectionName = "expertCommissions";

  // Create commission records when invoice is created
  async createCommission(
    expertId: string,
    expertName: string,
    billing: AppointmentBilling,
    expertCommissionPercent: number,
    createdBy: string,
  ): Promise<string> {
    try {
      const commissionData: Omit<ExpertCommission, "id"> = {
        expertId,
        expertName,
        clinicId: billing.clinicId,
        branchId: billing.branchId,
        billingId: billing.id,
        billingType: "appointment",
        invoiceNumber: billing.invoiceNumber,
        date: billing.invoiceDate,
        patientId: billing.patientId || "",
        patientName: billing.patientName,
        serviceNames: billing.items.map((item) => item.appointmentTypeName),
        totalInvoiceAmount: billing.totalAmount,
        commissionPercentage: expertCommissionPercent,
        commissionAmount: (billing.totalAmount * expertCommissionPercent) / 100,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
      };

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...commissionData,
        createdAt: Timestamp.fromDate(commissionData.createdAt),
        updatedAt: Timestamp.fromDate(commissionData.updatedAt),
        date: Timestamp.fromDate(commissionData.date),
      });

      // Update expert's balance and lifetime earnings
      const expertRef = doc(db, "experts", expertId);

      await updateDoc(expertRef, {
        totalCommissionEarned: increment(commissionData.commissionAmount),
        totalCommissionBalance: increment(commissionData.commissionAmount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating expert commission:", error);
      throw error;
    }
  }

  // Get all commissions for an expert
  async getCommissionsByExpert(
    expertId: string,
    clinicId: string,
  ): Promise<ExpertCommission[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where("expertId", "==", expertId),
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
          date: data.date?.toDate() || new Date(),
          paidDate: data.paidDate?.toDate(),
        };
      }) as ExpertCommission[];

      // Sort in-memory to bypass Firestore composite index requirement
      return commissions.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
    } catch (error) {
      console.error("Error getting commissions by expert:", error);

      return [];
    }
  }

  // Pay commission to expert
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

      const currentCommission = commissionDoc.data() as ExpertCommission;

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

      if (paymentReference) updateData.paymentReference = paymentReference;
      if (paymentNotes) updateData.paymentNotes = paymentNotes;
      if (paidBy) updateData.paidBy = paidBy;

      await updateDoc(docRef, updateData);

      // Update expert's pending balance
      const expertRef = doc(db, "experts", currentCommission.expertId);

      await updateDoc(expertRef, {
        totalCommissionBalance: increment(-paidAmount),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error paying expert commission:", error);
      throw error;
    }
  }

  /**
   * Create a commission record for a referring expert during registration
   * This is used when no full billing record (invoice) exists yet
   */
  async createRegistrationCommission(
    expertId: string,
    expertName: string,
    clinicId: string,
    branchId: string,
    patientId: string,
    patientName: string,
    appointmentTypeName: string,
    totalAmount: number,
    commissionAmount: number,
    commissionPercentage: number,
    createdBy: string,
  ): Promise<string | null> {
    try {
      if (commissionAmount <= 0) return null;

      const commissionData: Omit<ExpertCommission, "id"> = {
        expertId,
        expertName,
        clinicId,
        branchId,
        billingId: `reg_${Date.now()}`,
        billingType: "appointment",
        invoiceNumber: "REG-COMM",
        date: new Date(),
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

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...commissionData,
        createdAt: Timestamp.fromDate(commissionData.createdAt),
        updatedAt: Timestamp.fromDate(commissionData.updatedAt),
        date: Timestamp.fromDate(commissionData.date),
      });

      // Update expert's balance and lifetime earnings
      const expertRef = doc(db, "experts", expertId);

      await updateDoc(expertRef, {
        totalCommissionEarned: increment(commissionAmount),
        totalCommissionBalance: increment(commissionAmount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating registration expert commission:", error);
      throw error;
    }
  }
}

export const expertCommissionService = new ExpertCommissionService();
