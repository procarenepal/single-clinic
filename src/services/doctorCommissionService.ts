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
import {
  DoctorCommission,
  AppointmentBilling,
  PathologyBilling,
} from "@/types/models";

class DoctorCommissionService {
  private collectionName = "doctorCommissions";

  // Create commission records when invoice is created
  async createCommission(
    billing: AppointmentBilling,
    doctorCommissionPercent: number,
    createdBy: string,
  ): Promise<string[]> {
    try {
      // Group items by doctorId (fallback to billing.doctorId if not specified on item)
      const doctorGroups: Record<
        string,
        { doctorName: string; items: typeof billing.items }
      > = {};

      billing.items.forEach((item) => {
        const dId = item.doctorId || billing.doctorId;
        const dName = item.doctorName || billing.doctorName;

        if (!doctorGroups[dId]) {
          doctorGroups[dId] = { doctorName: dName, items: [] };
        }
        doctorGroups[dId].items.push(item);
      });

      const promises = Object.entries(doctorGroups).map(
        async ([dId, group]) => {
          // Calculate total commission amount for this doctor's items
          const groupCommissionAmount = group.items.reduce((total, item) => {
            const percentage =
              typeof item.commission === "number"
                ? item.commission
                : doctorCommissionPercent;

            if (!percentage || percentage <= 0) {
              return total;
            }

            const itemCommissionAmount = (item.amount * percentage) / 100;

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
              : doctorCommissionPercent;

          const commissionData: Omit<DoctorCommission, "id"> = {
            doctorId: dId,
            doctorName: group.doctorName,
            clinicId: billing.clinicId,
            branchId: billing.branchId || "",
            billingId: billing.id,
            billingType: "appointment",
            invoiceNumber: billing.invoiceNumber || "",
            appointmentDate: billing.invoiceDate,
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
            appointmentDate: Timestamp.fromDate(commissionData.appointmentDate),
          });

          // Update doctor's balance and lifetime earnings
          const doctorRef = doc(db, "doctors", dId);

          await updateDoc(doctorRef, {
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
      console.error("Error creating commission:", error);
      throw error;
    }
  }

  /**
   * Create a commission record for a referring doctor during registration
   * This is used when no full billing record (invoice) exists yet
   */
  async createRegistrationCommission(
    doctorId: string,
    doctorName: string,
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

      const commissionData: Omit<DoctorCommission, "id"> = {
        doctorId,
        doctorName,
        clinicId,
        branchId,
        billingId: `reg_${Date.now()}`, // Synthetic ID for registration-based commission
        billingType: "appointment",
        invoiceNumber: "REG-COMM", // Placeholder for registration commission
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

      // Update doctor's balance and lifetime earnings
      const doctorRef = doc(db, "doctors", doctorId);

      await updateDoc(doctorRef, {
        totalCommissionEarned: increment(commissionAmount),
        totalCommissionBalance: increment(commissionAmount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating registration doctor commission:", error);
      throw error;
    }
  }

  // Create commission records for pathology (supports multiple doctors)
  async createPathologyCommissions(
    billing: PathologyBilling,
    createdBy: string,
  ): Promise<string[]> {
    try {
      if (!billing.referringDoctors || billing.referringDoctors.length === 0) {
        return [];
      }

      const commissionIds: string[] = [];
      const now = new Date();
      const serviceNames = billing.items.map((item) => item.testName);

      for (const refDoc of billing.referringDoctors) {
        if (refDoc.calculatedAmount <= 0) continue;

        const commissionData: Omit<DoctorCommission, "id"> = {
          doctorId: refDoc.doctorId,
          doctorName: refDoc.doctorName,
          clinicId: billing.clinicId,
          branchId: billing.branchId,
          billingId: billing.id,
          billingType: "pathology",
          invoiceNumber: billing.invoiceNumber,
          appointmentDate: billing.invoiceDate, // Using invoiceDate as appointmentDate
          patientId: "", // Pathology might not always have a patient link in our model yet
          patientName: billing.patientName,
          serviceNames: serviceNames,
          totalInvoiceAmount: billing.totalAmount,
          commissionPercentage:
            refDoc.commissionType === "percent" ? refDoc.commissionValue : 0,
          commissionAmount: refDoc.calculatedAmount,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          createdBy,
        };

        const docRef = await addDoc(collection(db, this.collectionName), {
          ...commissionData,
          createdAt: Timestamp.fromDate(commissionData.createdAt),
          updatedAt: Timestamp.fromDate(commissionData.updatedAt),
          appointmentDate: Timestamp.fromDate(commissionData.appointmentDate),
        });

        // Update doctor's balance and lifetime earnings
        const doctorRef = doc(db, "doctors", refDoc.doctorId);

        await updateDoc(doctorRef, {
          totalCommissionEarned: increment(refDoc.calculatedAmount),
          totalCommissionBalance: increment(refDoc.calculatedAmount),
          updatedAt: Timestamp.now(),
        });

        commissionIds.push(docRef.id);
      }

      return commissionIds;
    } catch (error) {
      console.error("Error creating pathology commissions:", error);
      throw error;
    }
  }

  // Get all commissions for a doctor
  async getCommissionsByDoctor(
    doctorId: string,
    clinicId: string,
  ): Promise<DoctorCommission[]> {
    try {
      // Try ordered query first, fallback to simple query if index doesn't exist
      const simpleQuery = query(
        collection(db, this.collectionName),
        where("doctorId", "==", doctorId),
        where("clinicId", "==", clinicId),
      );

      let querySnapshot;

      try {
        // Try with orderBy for proper sorting
        const orderedQuery = query(
          collection(db, this.collectionName),
          where("doctorId", "==", doctorId),
          where("clinicId", "==", clinicId),
          orderBy("createdAt", "desc"),
        );

        querySnapshot = await getDocs(orderedQuery);
      } catch (indexError) {
        // Fallback to simple query if index doesn't exist
        querySnapshot = await getDocs(simpleQuery);
      }

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
      }) as DoctorCommission[];

      return commissions;
    } catch (error) {
      console.error("Error getting commissions by doctor:", error);

      return [];
    }
  }

  // Get all commissions for a clinic
  async getCommissionsByClinic(clinicId: string): Promise<DoctorCommission[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where("clinicId", "==", clinicId),
        orderBy("createdAt", "desc"),
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        appointmentDate: doc.data().appointmentDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
      })) as DoctorCommission[];
    } catch (error) {
      console.error("Error getting commissions by clinic:", error);

      return [];
    }
  }

  // Pay commission to doctor
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

      // Get current commission data
      const commissionDoc = await getDoc(docRef);

      if (!commissionDoc.exists()) {
        throw new Error("Commission record not found");
      }

      const currentCommission = commissionDoc.data() as DoctorCommission;

      // Validate payment amount
      if (paidAmount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      if (paidAmount > currentCommission.commissionAmount) {
        throw new Error("Payment amount cannot exceed commission amount");
      }

      // Update the commission record
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

      // Only include optional fields if they have values
      if (paymentReference !== undefined) {
        updateData.paymentReference = paymentReference;
      }
      if (paymentNotes !== undefined) {
        updateData.paymentNotes = paymentNotes;
      }
      if (paidBy !== undefined) {
        updateData.paidBy = paidBy;
      }

      await updateDoc(docRef, updateData);

      // Update doctor's pending balance (decrease it as payment is made)
      const doctorRef = doc(db, "doctors", currentCommission.doctorId);

      await updateDoc(doctorRef, {
        totalCommissionBalance: increment(-paidAmount),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error paying commission:", error);
      throw error;
    }
  }

  // Get commission statistics for a doctor
  async getCommissionStats(
    doctorId: string,
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
      const commissions = await this.getCommissionsByDoctor(doctorId, clinicId);

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
      console.error("Error getting commission stats:", error);

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

  // Update commission status (for cancelling commissions)
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
      console.error("Error updating commission status:", error);
      throw error;
    }
  }

  // Get commission by billing ID
  async getCommissionByBillingId(
    billingId: string,
  ): Promise<DoctorCommission | null> {
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
        appointmentDate: doc.data().appointmentDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
      } as DoctorCommission;
    } catch (error) {
      console.error("Error getting commission by billing ID:", error);

      return null;
    }
  }
}

export const doctorCommissionService = new DoctorCommissionService();
