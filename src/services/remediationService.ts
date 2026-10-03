import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/config/firebase";
import { buildInvoicePayload } from "@/services/api/billingApi";

/**
 * Filing sales that were never recorded in the official ledger.
 *
 * These are real sales — stock left the shelf, money changed hands — whose
 * ledger row was never created, so IRD has no record of them. Filing one is
 * creating a tax document after the fact, which is consequential enough that
 * it is proposed by one person and released by another: a proposal is parked
 * as `awaiting_approval`, which the backend poller ignores entirely, and only
 * an approval by a different user moves it to `pending` where the poller will
 * act on it.
 */

const OUTBOX = "billingSyncOutbox";

export interface PendingRemediation {
  id: string;
  invoiceNumber: string;
  status: string;
  requestedBy?: string;
  requestedByName?: string;
  approvedBy?: string;
  totalAmount?: number;
  backfillInvoiceDate?: string;
  sourceCollection?: string;
  sourceDocId?: string;
  lastError?: string | null;
}

/** The Firestore collection each module's documents live in. */
const COLLECTION_OF: Record<string, string> = {
  appointment: "appointmentBilling",
  pathology: "pathologyBilling",
  pharmacy: "medicinePurchases",
};

export interface UnfiledSale {
  module: string;
  docId: string;
  invoiceNumber: string;
  /** ISO date (YYYY-MM-DD) the sale actually happened. */
  saleDate?: string;
  fiscalYear: string;
  clinicId: string;
  patientName?: string;
  patientPanVat?: string;
  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  exemptAmount: number;
  discountAmount?: number;
  paymentMethod?: string;
  items: Array<{
    itemName: string;
    quantity: number;
    rate: number;
    totalAmount: number;
    isTaxable: boolean;
  }>;
}

/**
 * Propose filing a sale that never reached the ledger. Creates nothing in the
 * ledger itself — it parks a fully-rendered proposal for a second person to
 * review and release.
 */
export async function queueSaleForFiling(
  sale: UnfiledSale,
  irdEnabled: boolean,
): Promise<string> {
  const uid = auth.currentUser?.uid;

  if (!uid) throw new Error("You must be signed in to queue a filing.");

  const sourceCollection = COLLECTION_OF[sale.module];

  if (!sourceCollection) {
    throw new Error(
      `Cannot queue a ${sale.module} record — returns are filed against their purchase, not on their own.`,
    );
  }

  const payload = buildInvoicePayload({
    clinicId: sale.clinicId,
    patientName: sale.patientName,
    patientPanVat: sale.patientPanVat,
    totalAmount: sale.totalAmount,
    taxableAmount: sale.taxableAmount,
    taxAmount: sale.taxAmount,
    exemptAmount: sale.exemptAmount,
    discountAmount: sale.discountAmount,
    paymentMethod: sale.paymentMethod,
    irdEnabled,
    fiscalYear: sale.fiscalYear,
    preAssignedInvoiceNumber: sale.invoiceNumber,
    sourceCollection,
    sourceDocId: sale.docId,
    items: sale.items,
  });

  const entry = await addDoc(collection(db, OUTBOX), {
    clinicId: sale.clinicId,
    // The poller ignores this state — proposing a filing files nothing.
    status: "awaiting_approval",
    attempts: 0,
    lastError: null,
    requestedBy: uid,
    requestedByName: auth.currentUser?.displayName || auth.currentUser?.email || uid,
    requestedAt: serverTimestamp(),
    invoiceNumber: sale.invoiceNumber,
    sourceCollection,
    sourceDocId: sale.docId,
    // Undefined is rejected by Firestore, and buildInvoicePayload leaves
    // optional fields unset.
    payload: JSON.parse(JSON.stringify(payload)),
    backfillInvoiceDate: sale.saleDate || null,
    isRemediation: true,
  });

  return entry.id;
}

/**
 * Release a proposed filing to the backend poller. Firestore rules enforce
 * that this is a different person than the one who proposed it — this check
 * is here only to fail with a clear message rather than a bare permission
 * error.
 */
export async function approveFiling(entryId: string, requestedBy?: string): Promise<void> {
  const uid = auth.currentUser?.uid;

  if (!uid) throw new Error("You must be signed in to approve a filing.");
  if (requestedBy && requestedBy === uid) {
    throw new Error(
      "A filing must be approved by someone other than the person who proposed it.",
    );
  }

  await updateDoc(doc(db, OUTBOX, entryId), {
    status: "pending",
    approvedBy: uid,
    approvedAt: serverTimestamp(),
  });
}

/** Proposed filings still waiting for a second person. */
export async function listAwaitingApproval(
  clinicId: string,
): Promise<PendingRemediation[]> {
  const snap = await getDocs(
    query(
      collection(db, OUTBOX),
      where("clinicId", "==", clinicId),
      where("status", "==", "awaiting_approval"),
    ),
  );

  return snap.docs.map((d) => {
    const x = d.data() as any;

    return {
      id: d.id,
      invoiceNumber: x.invoiceNumber,
      status: x.status,
      requestedBy: x.requestedBy,
      requestedByName: x.requestedByName,
      approvedBy: x.approvedBy,
      totalAmount: x.payload?.totalAmount,
      backfillInvoiceDate: x.backfillInvoiceDate,
      sourceCollection: x.sourceCollection,
      sourceDocId: x.sourceDocId,
      lastError: x.lastError ?? null,
    };
  });
}
