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
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { ExpertCommission, AppointmentBilling } from "@/types/models";

class ExpertCommissionService {
  private collectionName = "expertCommissions";

  // Create commission records for multiple items across multiple experts in an invoice
  async createCommissionsFromBilling(
    billing: AppointmentBilling,
    defaultExpertCommissionPercent: number,
    createdBy: string,
  ): Promise<string[]> {
    try {
      // Group items by expertId
      const expertGroups: Record<
        string,
        { expertName: string; items: typeof billing.items }
      > = {};

      billing.items.forEach((item) => {
        const eId = item.doctorId || billing.doctorId;
        const eName = item.doctorName || billing.doctorName;

        if (!expertGroups[eId]) {
          expertGroups[eId] = { expertName: eName, items: [] };
        }
        expertGroups[eId].items.push(item);
      });

      const promises = Object.entries(expertGroups).map(
        async ([eId, group]) => {
          // Calculate total commission amount for this expert's items
          const groupCommissionAmount = group.items.reduce((total, item) => {
            const percentage =
              typeof item.commission === "number"
                ? item.commission
                : defaultExpertCommissionPercent;

            if (!percentage || percentage <= 0) {
              return total;
            }

            // Pro-rate the global invoice discount (mainDiscountAmount) onto this item
            const subtotal = billing.subtotal || 1; // Prevent division by zero
            const mainDiscount = billing.mainDiscountAmount || 0;
            const discountRatio = (subtotal - mainDiscount) / subtotal;
            const effectiveItemAmount = item.amount * discountRatio;

            const itemCommissionAmount = (effectiveItemAmount * percentage) / 100;

            return total + itemCommissionAmount;
          }, 0);

          if (groupCommissionAmount <= 0) return null;

          const groupSubtotal = group.items.reduce(
            (sum, item) => sum + item.amount,
            0,
          );
          const effectivePercentage =
            groupSubtotal > 0
              ? (groupCommissionAmount / groupSubtotal) * 100
              : defaultExpertCommissionPercent;

          const commissionData: Omit<ExpertCommission, "id"> = {
            expertId: eId,
            expertName: group.expertName,
            clinicId: billing.clinicId,
            branchId: billing.branchId || "",
            billingId: billing.id,
            billingType: "appointment",
            invoiceNumber: billing.invoiceNumber || "",
            date: billing.invoiceDate,
            patientId: billing.patientId || "",
            patientName: billing.patientName || "Unknown",
            serviceNames: group.items.map((item) => item.appointmentTypeName),
            totalInvoiceAmount: billing.totalAmount, // Total for the whole invoice
            commissionPercentage: effectivePercentage,
            commissionAmount: groupCommissionAmount,
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
          const expertRef = doc(db, "experts", eId);

          await updateDoc(expertRef, {
            totalCommissionEarned: increment(groupCommissionAmount),
            totalCommissionBalance: increment(groupCommissionAmount),
            updatedAt: Timestamp.now(),
          });

          return docRef.id;
        },
      );

      const results = await Promise.all(promises);

      return results.filter((r): r is string => r !== null);
    } catch (error) {
      console.error("Error creating expert commissions from billing:", error);
      throw error;
    }
  }

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
    clinicId: string, // Kept for signature compatibility
  ): Promise<ExpertCommission[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where("expertId", "==", expertId)
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
        const timeA =
          a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime();
        const timeB =
          b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime();

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
