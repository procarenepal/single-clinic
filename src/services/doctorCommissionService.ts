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
import {
  ClinicianCommissionConfig,
  GenericCommissionRecord,
  createCommissionGrouped,
  createRegistrationCommission as createRegistrationCommissionCore,
  getCommissionsByEntity,
  payCommission as payCommissionCore,
  updateCommissionStatus as updateCommissionStatusCore,
  reduceCommissionAmount as reduceCommissionAmountCore,
  getCommissionsByBillingId as getCommissionsByBillingIdCore,
} from "@/services/clinicianCommissionService";
import { resolveClinicId } from "./currentClinic";
import {
  earnedAmount,
  isClawback,
  summarizeCommissions,
} from "./core/commissionAggregatesCore";

const DOCTOR_CONFIG: ClinicianCommissionConfig = {
  entityType: "doctor",
  collectionName: "doctorCommissions",
  entityCollection: "doctors",
  idField: "doctorId",
  nameField: "doctorName",
  dateField: "appointmentDate",
};

function toDoctorCommission(r: GenericCommissionRecord): DoctorCommission {
  return {
    id: r.id,
    doctorId: r.entityId,
    doctorName: r.entityName,
    clinicId: r.clinicId,
    branchId: r.branchId,
    billingId: r.billingId,
    billingType: r.billingType as "appointment" | "pathology",
    invoiceNumber: r.invoiceNumber,
    appointmentDate: r.serviceDate,
    patientId: r.patientId,
    patientName: r.patientName,
    serviceNames: r.serviceNames,
    totalInvoiceAmount: r.totalInvoiceAmount,
    commissionPercentage: r.commissionPercentage,
    commissionAmount: r.commissionAmount,
    status: r.status,
    paidDate: r.paidDate,
    paidAmount: r.paidAmount,
    paymentMethod: r.paymentMethod,
    paymentReference: r.paymentReference,
    paymentNotes: r.paymentNotes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    createdBy: r.createdBy,
    paidBy: r.paidBy,
    clawbackOf: r.clawbackOf,
    clawbackReason: r.clawbackReason,
  };
}

class DoctorCommissionService {
  private collectionName = "doctorCommissions";

  // Create commission records when invoice is created — delegates to the
  // shared core (see clinicianCommissionService.ts); doctor- vs
  // expert-specific field names are translated at this boundary only.
  async createCommission(
    billing: AppointmentBilling,
    doctorCommissionPercent: number,
    createdBy: string,
  ): Promise<string[]> {
    return createCommissionGrouped(DOCTOR_CONFIG, billing, doctorCommissionPercent, createdBy);
  }

  /**
   * Create a commission record for a referring doctor during registration
   * This is used when no full billing record (invoice) exists yet
   */
  async createRegistrationCommission(
    doctorId: string,
    doctorName: string,
    clinicId: string,
    patientId: string,
    patientName: string,
    appointmentTypeName: string,
    totalAmount: number,
    commissionAmount: number,
    commissionPercentage: number,
    createdBy: string,
  ): Promise<string | null> {
    return createRegistrationCommissionCore(
      DOCTOR_CONFIG,
      doctorId,
      doctorName,
      clinicId,
      patientId,
      patientName,
      appointmentTypeName,
      totalAmount,
      commissionAmount,
      commissionPercentage,
      createdBy,
    );
  }

  // Create commission records for pathology (supports multiple doctors).
  // Pathology has no real "expert earns pathology commission" use case, so
  // this stays doctor-only and isn't generalized into the shared core.
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

        // Prevent duplicate commissions if finalizeInvoice is ever called
        // twice for the same invoice (retry after a partial failure, a
        // double click before the button disables, etc.) — mirrors the
        // existing guard in referralCommissionService.createReferralCommission.
        const existingQuery = query(
          collection(db, this.collectionName),
          where("billingId", "==", billing.id),
          where("doctorId", "==", refDoc.doctorId),
          // Required for Firestore to authorise the read (see currentClinic.ts).
          // Without it this duplicate guard threw for every non-admin user,
          // which would have let a second commission be written.
          where("clinicId", "==", resolveClinicId(billing.clinicId)),
        );
        const existingDocs = await getDocs(existingQuery);

        if (!existingDocs.empty) {
          console.warn(
            `Pathology commission already exists for doctor ${refDoc.doctorId} on billing ID ${billing.id}. Skipping.`,
          );
          continue;
        }

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
    const records = await getCommissionsByEntity(DOCTOR_CONFIG, doctorId, clinicId);
    return records.map(toDoctorCommission);
  }

  // Get all commissions for a clinic
  async getCommissionsByClinic(clinicId: string): Promise<DoctorCommission[]> {
    try {
      // Since it's a single clinic system, we fetch all commissions and rely on date sorting
      const q = query(
        collection(db, this.collectionName),
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
    return payCommissionCore(
      DOCTOR_CONFIG,
      commissionId,
      paidAmount,
      paymentMethod,
      paymentReference,
      paymentNotes,
      paidBy,
    );
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

      // Cancelled/reversed commissions must not count toward totals — they
      // were never actually earned/collected (updateCommissionStatus already
      // reverses the doctor's own totalCommissionEarned/Balance fields for
      // these; this stats aggregate needs to agree with that, not include
      // reversed records as if they were still live).
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
    return updateCommissionStatusCore(DOCTOR_CONFIG, commissionId, status);
  }

  /**
   * Reduce a still-pending commission by a proportional amount (e.g. a
   * partial package refund for N of T sessions should only claw back N/T of
   * the commission, leaving the clinician's earnings for sessions already
   * delivered intact) — unlike updateCommissionStatus("cancelled"), which is
   * all-or-nothing. Never reduces the record below what has already been
   * paid on it; the reversed share that had already been paid out is
   * recorded as owed back (a clawback, see commissionClawbackCore).
   */
  async reduceCommissionAmount(
    commissionId: string,
    reduceByAmount: number,
  ): Promise<void> {
    return reduceCommissionAmountCore(DOCTOR_CONFIG, commissionId, reduceByAmount);
  }

  // Get all commissions for a billing (a billing can produce multiple
  // commission docs — one per clinician group)
  async getCommissionsByBillingId(
    billingId: string,
  ): Promise<DoctorCommission[]> {
    const records = await getCommissionsByBillingIdCore(DOCTOR_CONFIG, billingId);
    return records.map(toDoctorCommission);
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
