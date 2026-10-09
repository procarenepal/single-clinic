import { ExpertCommission, AppointmentBilling } from "@/types/models";
import {
  ClinicianCommissionConfig,
  GenericCommissionRecord,
  createCommissionGrouped,
  createCommissionFromItems,
  createRegistrationCommission as createRegistrationCommissionCore,
  getCommissionsByEntity,
  payCommission as payCommissionCore,
  updateCommissionStatus as updateCommissionStatusCore,
  reduceCommissionAmount as reduceCommissionAmountCore,
  getCommissionsByBillingId as getCommissionsByBillingIdCore,
} from "@/services/clinicianCommissionService";

const EXPERT_CONFIG: ClinicianCommissionConfig = {
  entityType: "expert",
  collectionName: "expertCommissions",
  entityCollection: "experts",
  idField: "expertId",
  nameField: "expertName",
  dateField: "date",
};

function toExpertCommission(r: GenericCommissionRecord): ExpertCommission {
  return {
    id: r.id,
    expertId: r.entityId,
    expertName: r.entityName,
    clinicId: r.clinicId,
    branchId: r.branchId,
    billingId: r.billingId,
    billingType: r.billingType as "appointment" | "pathology" | "other",
    invoiceNumber: r.invoiceNumber,
    date: r.serviceDate,
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

class ExpertCommissionService {
  // Create commission records for multiple items across multiple experts in
  // an invoice — delegates to the shared core (see
  // clinicianCommissionService.ts); this is the same "auto-group-all-items"
  // algorithm as doctorCommissionService.createCommission.
  async createCommissionsFromBilling(
    billing: AppointmentBilling,
    defaultExpertCommissionPercent: number,
    createdBy: string,
  ): Promise<string[]> {
    return createCommissionGrouped(
      EXPERT_CONFIG,
      billing,
      defaultExpertCommissionPercent,
      createdBy,
    );
  }

  // Create commission records when invoice is created, computed only over a
  // caller-supplied pre-filtered subset of items (e.g. a referral bonus that
  // must exclude the referrer's own treating items).
  async createCommission(
    expertId: string,
    expertName: string,
    billing: AppointmentBilling,
    expertCommissionPercent: number,
    createdBy: string,
  ): Promise<string | null> {
    return createCommissionFromItems(
      EXPERT_CONFIG,
      expertId,
      expertName,
      billing,
      expertCommissionPercent,
      createdBy,
    );
  }

  // Get all commissions for an expert
  async getCommissionsByExpert(
    expertId: string,
    clinicId: string,
  ): Promise<ExpertCommission[]> {
    const records = await getCommissionsByEntity(EXPERT_CONFIG, expertId, clinicId);
    return records.map(toExpertCommission);
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
    return payCommissionCore(
      EXPERT_CONFIG,
      commissionId,
      paidAmount,
      paymentMethod,
      paymentReference,
      paymentNotes,
      paidBy,
    );
  }

  // Get all commissions for a billing
  async getCommissionsByBillingId(
    billingId: string,
  ): Promise<ExpertCommission[]> {
    const records = await getCommissionsByBillingIdCore(EXPERT_CONFIG, billingId);
    return records.map(toExpertCommission);
  }

  // Update commission status (for cancelling commissions)
  async updateCommissionStatus(
    commissionId: string,
    status: "pending" | "paid" | "cancelled",
  ): Promise<void> {
    return updateCommissionStatusCore(EXPERT_CONFIG, commissionId, status);
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
    return reduceCommissionAmountCore(EXPERT_CONFIG, commissionId, reduceByAmount);
  }

  /**
   * Create a commission record for a referring expert during registration
   * This is used when no full billing record (invoice) exists yet
   */
  async createRegistrationCommission(
    expertId: string,
    expertName: string,
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
      EXPERT_CONFIG,
      expertId,
      expertName,
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
}

export const expertCommissionService = new ExpertCommissionService();
