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
import { StaffCommission } from "@/types/models";

class StaffCommissionService {
  private collectionName = "staffCommissions";

  /**
   * Create a commission record for a staff member during registration
   */
  async createRegistrationCommission(
    staffId: string,
    staffName: string,
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

      const commissionData: Omit<StaffCommission, "id"> = {
        staffId,
        staffName,
        clinicId,
        branchId,
        billingId: `reg_staff_${Date.now()}`,
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

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...commissionData,
        createdAt: Timestamp.fromDate(commissionData.createdAt),
        updatedAt: Timestamp.fromDate(commissionData.updatedAt),
        appointmentDate: Timestamp.fromDate(commissionData.appointmentDate),
      });

      // Update staff's balance and lifetime earnings
      const staffRef = doc(db, "staff", staffId);

      await updateDoc(staffRef, {
        totalCommissionEarned: increment(commissionAmount),
        totalCommissionBalance: increment(commissionAmount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
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
      const commissionDoc = await getDoc(docRef);

      if (!commissionDoc.exists()) {
        throw new Error("Commission record not found");
      }

      const currentCommission = commissionDoc.data() as StaffCommission;

      if (paidAmount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      const remainingAmount = currentCommission.commissionAmount - (currentCommission.paidAmount || 0);
      if (paidAmount > remainingAmount) {
        throw new Error("Payment amount cannot exceed remaining commission balance.");
      }

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

      // Update staff's pending balance
      const staffRef = doc(db, "staff", currentCommission.staffId);

      await updateDoc(staffRef, {
        totalCommissionBalance: increment(-paidAmount),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error paying staff commission:", error);
      throw error;
    }
  }
}

export const staffCommissionService = new StaffCommissionService();
