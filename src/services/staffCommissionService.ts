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
    patientId: string,
    patientName: string,
    appointmentTypeName: string,
    totalAmount: number,
    commissionAmount: number,
    commissionPercentage: number,
    createdBy: string,
    // The real invoice id this commission is earned on. Optional only for
    // backward compatibility with any caller that hasn't been updated —
    // omitting it disables the duplicate-guard below, since a synthesized
    // per-call id can never collide. Every real call site should pass this.
    billingId?: string,
  ): Promise<string | null> {
    try {
      if (commissionAmount <= 0) return null;

      // Prevent duplicate commissions if this is ever called twice for the
      // same invoice (retry after a partial failure, a double click, etc.)
      // — previously impossible to guard at all, since billingId was
      // synthesized fresh (`reg_staff_${Date.now()}`) on every single call
      // regardless of which real invoice it came from.
      if (billingId) {
        const existingQuery = query(
          collection(db, this.collectionName),
          where("billingId", "==", billingId),
          where("staffId", "==", staffId),
        );
        const existingDocs = await getDocs(existingQuery);

        if (!existingDocs.empty) {
          console.warn(
            `Staff commission already exists for staff ${staffId} on billing ID ${billingId}. Skipping.`,
          );

          return null;
        }
      }

      const commissionData: Omit<StaffCommission, "id"> = {
        staffId,
        staffName,
        clinicId,
        branchId: clinicId,
        billingId: billingId || `reg_staff_${Date.now()}`,
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

      if (status === "cancelled" && commissionData.status !== "cancelled") {
        const staffRef = doc(db, "staff", commissionData.staffId);

        await updateDoc(staffRef, {
          totalCommissionEarned: increment(-commissionData.commissionAmount),
          totalCommissionBalance: increment(
            -(commissionData.commissionAmount - (commissionData.paidAmount || 0)),
          ),
          updatedAt: Timestamp.now(),
        });
      }

      await updateDoc(docRef, {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Error updating staff commission status:", error);
      throw error;
    }
  }

  /**
   * Reduce a still-pending commission by a proportional amount (e.g. a
   * partial package refund) rather than fully cancelling it. Never reduces
   * below 0, and never claws back an already-paid-out portion.
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

      const paidAmount = commissionData.paidAmount || 0;
      const outstanding = Math.max(
        0,
        commissionData.commissionAmount - paidAmount,
      );
      const actualReduction = Math.min(reduceByAmount, outstanding);

      if (actualReduction <= 0) return;

      const newCommissionAmount = Math.max(
        0,
        commissionData.commissionAmount - actualReduction,
      );

      const staffRef = doc(db, "staff", commissionData.staffId);

      await updateDoc(staffRef, {
        totalCommissionEarned: increment(-actualReduction),
        totalCommissionBalance: increment(-actualReduction),
        updatedAt: Timestamp.now(),
      });

      await updateDoc(docRef, {
        commissionAmount: newCommissionAmount,
        updatedAt: Timestamp.fromDate(new Date()),
      });
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
      if (paidAmount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      const docRef = doc(db, this.collectionName, commissionId);

      // Read-validate-write inside one transaction — see the identical fix
      // in doctorCommissionService.payCommission for the race it prevents.
      await runTransaction(db, async (transaction) => {
        const commissionDoc = await transaction.get(docRef);

        if (!commissionDoc.exists()) {
          throw new Error("Commission record not found");
        }

        const currentCommission = commissionDoc.data() as StaffCommission;
        const remainingAmount =
          currentCommission.commissionAmount - (currentCommission.paidAmount || 0);

        if (paidAmount > remainingAmount) {
          throw new Error(
            "Payment amount cannot exceed remaining commission balance.",
          );
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

        transaction.update(docRef, updateData);

        const staffRef = doc(db, "staff", currentCommission.staffId);

        transaction.update(staffRef, {
          totalCommissionBalance: increment(-paidAmount),
          updatedAt: Timestamp.now(),
        });
      });
    } catch (error) {
      console.error("Error paying staff commission:", error);
      throw error;
    }
  }
}

export const staffCommissionService = new StaffCommissionService();
