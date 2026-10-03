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
import { AppointmentBilling } from "@/types/models";

/**
 * Shared core behind doctorCommissionService / expertCommissionService.
 * Doctor and expert commissions are ~90% identical logic that only differs
 * in field names (doctorId/doctorName/appointmentDate vs
 * expertId/expertName/date) and which Firestore collections they read/write.
 * This core operates on a generic shape and a per-entity-type config; the
 * two thin wrapper services translate to/from their own public field names
 * at the boundary, so every existing call site and stored Firestore document
 * shape is completely unaffected by this refactor.
 */

export interface ClinicianCommissionConfig {
  entityType: "doctor" | "expert";
  collectionName: string; // "doctorCommissions" | "expertCommissions"
  entityCollection: string; // "doctors" | "experts"
  idField: string; // "doctorId" | "expertId" — the field name stored on the Firestore doc
  nameField: string; // "doctorName" | "expertName"
  dateField: string; // "appointmentDate" | "date"
}

export interface GenericCommissionRecord {
  id: string;
  entityId: string;
  entityName: string;
  clinicId: string;
  branchId: string;
  billingId: string;
  billingType: string;
  invoiceNumber: string;
  serviceDate: Date;
  patientId: string;
  patientName: string;
  serviceNames: string[];
  totalInvoiceAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  status: "pending" | "paid" | "cancelled";
  paidDate?: Date;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  paidBy?: string;
}

function fromDoc(
  config: ClinicianCommissionConfig,
  id: string,
  data: any,
): GenericCommissionRecord {
  return {
    id,
    entityId: data[config.idField],
    entityName: data[config.nameField],
    clinicId: data.clinicId,
    branchId: data.branchId,
    billingId: data.billingId,
    billingType: data.billingType,
    invoiceNumber: data.invoiceNumber,
    serviceDate: data[config.dateField]?.toDate?.() || new Date(),
    patientId: data.patientId,
    patientName: data.patientName,
    serviceNames: data.serviceNames || [],
    totalInvoiceAmount: data.totalInvoiceAmount,
    commissionPercentage: data.commissionPercentage,
    commissionAmount: data.commissionAmount,
    status: data.status,
    paidDate: data.paidDate?.toDate?.(),
    paidAmount: data.paidAmount,
    paymentMethod: data.paymentMethod,
    paymentReference: data.paymentReference,
    paymentNotes: data.paymentNotes,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    createdBy: data.createdBy,
    paidBy: data.paidBy,
  };
}

/**
 * Group an invoice's items by clinician and create one commission record per
 * clinician group — the "auto-group-all-items" variant used by both
 * doctorCommissionService.createCommission and
 * expertCommissionService.createCommissionsFromBilling.
 */
export async function createCommissionGrouped(
  config: ClinicianCommissionConfig,
  billing: AppointmentBilling,
  defaultCommissionPercent: number,
  createdBy: string,
): Promise<string[]> {
  try {
    const groups: Record<string, { name: string; items: typeof billing.items }> = {};

    billing.items.forEach((item) => {
      const eId = item.doctorId || billing.doctorId;
      const eName = item.doctorName || billing.doctorName;

      if (!groups[eId]) {
        groups[eId] = { name: eName, items: [] };
      }
      groups[eId].items.push(item);
    });

    const promises = Object.entries(groups).map(async ([entityId, group]) => {
      let groupSubtotal = 0;
      const rawCommissionAmount = group.items.reduce((total, item) => {
        if (item.calculateCommission === false) {
          return total;
        }

        const percentage =
          typeof item.commission === "number" && item.commission >= 0
            ? item.commission
            : defaultCommissionPercent;

        const totalItemAmounts = (billing.subtotal || 1) - (billing.itemDiscountAmount || 0);
        const validTotal = totalItemAmounts > 0 ? totalItemAmounts : 1;
        const mainDiscount = billing.mainDiscountAmount || 0;
        const discountRatio = (validTotal - mainDiscount) / validTotal;
        const effectiveItemAmount = item.amount * discountRatio;

        groupSubtotal += effectiveItemAmount;

        if (!percentage || percentage <= 0) {
          return total;
        }

        return total + (effectiveItemAmount * percentage) / 100;
      }, 0);

      const groupCommissionAmount = Math.round(rawCommissionAmount * 100) / 100;
      groupSubtotal = Math.round(groupSubtotal * 100) / 100;

      if (groupCommissionAmount <= 0) return null;

      const existingQuery = query(
        collection(db, config.collectionName),
        where("billingId", "==", billing.id),
        where(config.idField, "==", entityId),
      );
      const existingDocs = await getDocs(existingQuery);

      if (!existingDocs.empty) {
        console.warn(
          `Commission already exists for ${config.entityType} ${entityId} on billing ID ${billing.id}. Skipping.`,
        );
        return null;
      }

      const effectivePercentage =
        groupSubtotal > 0
          ? (groupCommissionAmount / groupSubtotal) * 100
          : defaultCommissionPercent;

      const now = new Date();
      const commissionData: Record<string, any> = {
        [config.idField]: entityId,
        [config.nameField]: group.name,
        clinicId: billing.clinicId,
        branchId: billing.branchId || "",
        billingId: billing.id,
        billingType: "appointment",
        invoiceNumber: billing.invoiceNumber || "",
        [config.dateField]: Timestamp.fromDate(billing.invoiceDate),
        patientId: billing.patientId || "",
        patientName: billing.patientName || "Unknown",
        serviceNames: group.items
          .filter((i) => i.calculateCommission !== false)
          .map((item) => item.appointmentTypeName),
        totalInvoiceAmount: groupSubtotal,
        commissionPercentage: effectivePercentage,
        commissionAmount: groupCommissionAmount,
        status: "pending",
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        createdBy,
      };

      const docRef = await addDoc(collection(db, config.collectionName), commissionData);

      const entityRef = doc(db, config.entityCollection, entityId);

      await updateDoc(entityRef, {
        totalCommissionEarned: increment(groupCommissionAmount),
        totalCommissionBalance: increment(groupCommissionAmount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
    });

    const results = await Promise.all(promises);

    return results.filter((r): r is string => r !== null);
  } catch (error) {
    console.error(`Error creating ${config.entityType} commission:`, error);
    throw error;
  }
}

/**
 * Create a single commission for one clinician, computed only over a
 * caller-supplied, already-filtered subset of the invoice's items (e.g. a
 * referral bonus that must exclude the referrer's own treating items) — the
 * "pre-filtered-subset" variant, currently used by
 * expertCommissionService.createCommission only.
 */
export async function createCommissionFromItems(
  config: ClinicianCommissionConfig,
  entityId: string,
  entityName: string,
  billing: AppointmentBilling,
  commissionPercent: number,
  createdBy: string,
): Promise<string | null> {
  try {
    const existingQuery = query(
      collection(db, config.collectionName),
      where("billingId", "==", billing.id),
      where(config.idField, "==", entityId),
    );
    const existingDocs = await getDocs(existingQuery);

    if (!existingDocs.empty) {
      console.warn(
        `Commission already exists for ${config.entityType} ${entityId} on billing ID ${billing.id}. Skipping.`,
      );
      return null;
    }

    const totalItemAmounts = (billing.subtotal || 1) - (billing.itemDiscountAmount || 0);
    const validTotal = totalItemAmounts > 0 ? totalItemAmounts : 1;
    const mainDiscount = billing.mainDiscountAmount || 0;
    const discountRatio = (validTotal - mainDiscount) / validTotal;
    const effectiveBase = (billing.items || []).reduce(
      (sum, item: any) =>
        item.calculateCommission === false ? sum : sum + item.amount * discountRatio,
      0,
    );
    const commissionAmount = (Math.max(effectiveBase, 0) * commissionPercent) / 100;

    const now = new Date();
    const commissionData: Record<string, any> = {
      [config.idField]: entityId,
      [config.nameField]: entityName,
      clinicId: billing.clinicId,
      branchId: billing.branchId,
      billingId: billing.id,
      billingType: "appointment",
      invoiceNumber: billing.invoiceNumber,
      [config.dateField]: Timestamp.fromDate(billing.invoiceDate),
      patientId: billing.patientId || "",
      patientName: billing.patientName,
      serviceNames: billing.items
        .filter((item: any) => item.calculateCommission !== false)
        .map((item) => item.appointmentTypeName),
      totalInvoiceAmount: effectiveBase,
      commissionPercentage: commissionPercent,
      commissionAmount,
      status: "pending",
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      createdBy,
    };

    const docRef = await addDoc(collection(db, config.collectionName), commissionData);

    const entityRef = doc(db, config.entityCollection, entityId);

    await updateDoc(entityRef, {
      totalCommissionEarned: increment(commissionAmount),
      totalCommissionBalance: increment(commissionAmount),
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error(`Error creating ${config.entityType} commission:`, error);
    throw error;
  }
}

/** Registration-time commission, created before any full billing record exists. */
export async function createRegistrationCommission(
  config: ClinicianCommissionConfig,
  entityId: string,
  entityName: string,
  clinicId: string,
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

    const now = new Date();
    const commissionData: Record<string, any> = {
      [config.idField]: entityId,
      [config.nameField]: entityName,
      clinicId,
      branchId: clinicId,
      billingId: `reg_${Date.now()}`,
      billingType: "appointment",
      invoiceNumber: "REG-COMM",
      [config.dateField]: Timestamp.fromDate(now),
      patientId,
      patientName,
      serviceNames: [appointmentTypeName],
      totalInvoiceAmount: totalAmount,
      commissionPercentage,
      commissionAmount,
      status: "pending",
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      createdBy,
    };

    const docRef = await addDoc(collection(db, config.collectionName), commissionData);

    const entityRef = doc(db, config.entityCollection, entityId);

    await updateDoc(entityRef, {
      totalCommissionEarned: increment(commissionAmount),
      totalCommissionBalance: increment(commissionAmount),
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error(`Error creating registration ${config.entityType} commission:`, error);
    throw error;
  }
}

/** All commissions for one clinician, newest first — sorted in-memory so no composite index is required. */
export async function getCommissionsByEntity(
  config: ClinicianCommissionConfig,
  entityId: string,
  clinicId: string,
): Promise<GenericCommissionRecord[]> {
  try {
    const q = query(
      collection(db, config.collectionName),
      where(config.idField, "==", entityId),
      where("clinicId", "==", clinicId),
    );

    const querySnapshot = await getDocs(q);

    const records = querySnapshot.docs.map((d) => fromDoc(config, d.id, d.data()));

    return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error(`Error getting commissions by ${config.entityType}:`, error);
    return [];
  }
}

/** Pay down a commission; race-safe against concurrent partial payments via a transaction. */
export async function payCommission(
  config: ClinicianCommissionConfig,
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

    const docRef = doc(db, config.collectionName, commissionId);

    await runTransaction(db, async (transaction) => {
      const commissionDoc = await transaction.get(docRef);

      if (!commissionDoc.exists()) {
        throw new Error("Commission record not found");
      }

      const data = commissionDoc.data();
      const remainingAmount = data.commissionAmount - (data.paidAmount || 0);

      if (paidAmount > remainingAmount) {
        throw new Error("Payment amount cannot exceed remaining commission balance.");
      }

      const updateData: any = {
        paidAmount: (data.paidAmount || 0) + paidAmount,
        paymentMethod,
        paidDate: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        status:
          (data.paidAmount || 0) + paidAmount >= data.commissionAmount ? "paid" : "pending",
      };

      if (paymentReference !== undefined) updateData.paymentReference = paymentReference;
      if (paymentNotes !== undefined) updateData.paymentNotes = paymentNotes;
      if (paidBy !== undefined) updateData.paidBy = paidBy;

      transaction.update(docRef, updateData);

      const entityRef = doc(db, config.entityCollection, data[config.idField]);

      transaction.update(entityRef, {
        totalCommissionBalance: increment(-paidAmount),
        updatedAt: Timestamp.now(),
      });
    });
  } catch (error) {
    console.error(`Error paying ${config.entityType} commission:`, error);
    throw error;
  }
}

/** Set a commission's status, reverting the clinician's balances if cancelling. */
export async function updateCommissionStatus(
  config: ClinicianCommissionConfig,
  commissionId: string,
  status: "pending" | "paid" | "cancelled",
): Promise<void> {
  try {
    const docRef = doc(db, config.collectionName, commissionId);
    const commissionDoc = await getDoc(docRef);

    if (!commissionDoc.exists()) {
      throw new Error("Commission not found");
    }

    const data = commissionDoc.data();

    if (status === "cancelled" && data.status !== "cancelled") {
      const entityRef = doc(db, config.entityCollection, data[config.idField]);

      await updateDoc(entityRef, {
        totalCommissionEarned: increment(-data.commissionAmount),
        totalCommissionBalance: increment(-(data.commissionAmount - (data.paidAmount || 0))),
        updatedAt: Timestamp.now(),
      });
    }

    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  } catch (error) {
    console.error(`Error updating ${config.entityType} commission status:`, error);
    throw error;
  }
}

/** Proportionally reduce a still-pending commission (e.g. a partial package refund), never clawing back an already-paid portion. */
export async function reduceCommissionAmount(
  config: ClinicianCommissionConfig,
  commissionId: string,
  reduceByAmount: number,
): Promise<void> {
  if (reduceByAmount <= 0) return;
  try {
    const docRef = doc(db, config.collectionName, commissionId);
    const commissionDoc = await getDoc(docRef);

    if (!commissionDoc.exists()) {
      throw new Error("Commission not found");
    }

    const data = commissionDoc.data();

    if (data.status === "cancelled") return;

    const paidAmount = data.paidAmount || 0;
    const outstanding = Math.max(0, data.commissionAmount - paidAmount);
    const actualReduction = Math.min(reduceByAmount, outstanding);

    if (actualReduction <= 0) return;

    const newCommissionAmount = Math.max(0, data.commissionAmount - actualReduction);

    const entityRef = doc(db, config.entityCollection, data[config.idField]);

    await updateDoc(entityRef, {
      totalCommissionEarned: increment(-actualReduction),
      totalCommissionBalance: increment(-actualReduction),
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, {
      commissionAmount: newCommissionAmount,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  } catch (error) {
    console.error(`Error reducing ${config.entityType} commission amount:`, error);
    throw error;
  }
}

/** All commission docs produced by one billing (a billing can produce one per clinician group). */
export async function getCommissionsByBillingId(
  config: ClinicianCommissionConfig,
  billingId: string,
): Promise<GenericCommissionRecord[]> {
  try {
    const q = query(collection(db, config.collectionName), where("billingId", "==", billingId));

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((d) => fromDoc(config, d.id, d.data()));
  } catch (error) {
    console.error(`Error getting ${config.entityType} commissions by billing ID:`, error);
    return [];
  }
}
