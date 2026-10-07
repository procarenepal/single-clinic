import {
  collection,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  increment,
  runTransaction,
  type Transaction,
  type DocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { WalletTransaction } from "../types/models";

/**
 * Exported so a billing service can deduct from the wallet INSIDE its own
 * payment transaction — invoice, patient balance and ledger row commit
 * together or not at all. The alternative, deducting after the invoice
 * write and "compensating" on failure, left a {method:"wallet"} payment
 * event in paymentHistory that the compensation never removed: the
 * invoice then claimed a wallet payment that never happened, and a later
 * cancellation would refund it.
 */
export const WALLET_TRANSACTIONS_COLLECTION = "walletTransactions";
export const PATIENTS_COLLECTION = "patients";

/** The ledger row a wallet deduction writes; shared with in-transaction callers. */
export function buildWalletDeductionRow(input: {
  patientId: string;
  clinicId: string;
  amount: number;
  referenceId: string;
  referenceType: "invoice" | "package";
  notes: string;
  createdBy: string;
  now: Date;
}): Omit<WalletTransaction, "id"> & { createdAt: Date } {
  return {
    patientId: input.patientId,
    clinicId: input.clinicId,
    branchId: input.clinicId,
    type: "deduction",
    amount: input.amount,
    referenceId: input.referenceId,
    referenceType: input.referenceType,
    notes: input.notes,
    createdAt: input.now,
    createdBy: input.createdBy,
  };
}


export const walletService = {
  /**
   * Add funds (deposit) to a patient's wallet
   */
  async addFunds(
    patientId: string,
    clinicId: string,
    amount: number,
    paymentMethod: string,
    notes: string,
    createdBy: string,
    // Optional tagging, same shape as deductFunds/refundFunds — lets a
    // deposit be tied back to "this visit" (referenceId = appointment id,
    // referenceType = "appointment") for the checkout-time payment gate and
    // dedup. Omitted by the existing manual-top-up caller in PatientWalletTab.tsx.
    referenceId?: string,
    referenceType?: "invoice" | "package" | "appointment",
  ): Promise<string> {
    try {
      const now = new Date();
      const patientRef = doc(db, PATIENTS_COLLECTION, patientId);
      const transactionRef = doc(collection(db, WALLET_TRANSACTIONS_COLLECTION));

      // The ledger row and the balance move together or not at all. This
      // used to be two separate writes — addDoc the row, then updateDoc the
      // balance — so a failure between them left a deposit on record that
      // the balance didn't reflect, and a retry of the whole call would
      // then record the deposit twice. deductFunds has been a single
      // transaction since the deposit model landed; the deposit side of
      // the same ledger was the one left behind. Front-office cash enters
      // the system through exactly this method, so the window mattered.
      const transaction: Omit<WalletTransaction, "id"> = {
        patientId,
        clinicId,
        branchId: clinicId,
        type: "deposit",
        amount,
        paymentMethod,
        notes,
        createdAt: now,
        createdBy,
        ...(referenceId ? { referenceId } : {}),
        ...(referenceType ? { referenceType } : {}),
      };

      await runTransaction(db, async (dbTransaction) => {
        const patientSnap = await dbTransaction.get(patientRef);

        if (!patientSnap.exists()) {
          throw new Error("Patient not found");
        }

        dbTransaction.set(transactionRef, {
          ...transaction,
          createdAt: Timestamp.fromDate(now),
        });
        dbTransaction.update(patientRef, {
          walletBalance: increment(amount),
          updatedAt: Timestamp.now(),
        });
      });

      return transactionRef.id;
    } catch (error) {
      console.error("Error adding funds to wallet:", error);
      throw error;
    }
  },

  /**
   * Deduct funds from a patient's wallet (e.g., paying an invoice)
   */
  async deductFunds(
    patientId: string,
    clinicId: string,
    amount: number,
    invoiceId: string,
    notes: string,
    createdBy: string,
    // Defaults to "invoice" so the existing appointmentBillingService call
    // site (paying an invoice with wallet funds) keeps working unchanged —
    // patientPackageService's session-consumption deduction passes
    // "package" explicitly, since its "invoiceId" argument is actually a
    // patientPackage id with no invoice page to link to.
    referenceType: "invoice" | "package" = "invoice",
  ): Promise<string> {
    try {
      const patientRef = doc(db, PATIENTS_COLLECTION, patientId);

      // The balance check + decrement must be atomic — two concurrent
      // deductions for the same patient could otherwise both read the same
      // pre-deduction balance, both pass the sufficiency check, and both
      // apply increment(-amount), driving the balance negative. The body is
      // deductFundsInTransaction so a billing service can run the very same
      // deduction inside ITS transaction instead of after it.
      return await runTransaction(db, async (dbTransaction) => {
        const patientSnap = await dbTransaction.get(patientRef);

        return walletService.deductFundsInTransaction(dbTransaction, patientSnap, {
          patientId,
          clinicId,
          amount,
          referenceId: invoiceId,
          referenceType,
          notes,
          createdBy,
          now: new Date(),
        });
      });
    } catch (error) {
      console.error("Error deducting funds from wallet:", error);
      throw error;
    }
  },

  /**
   * Deducts from a wallet INSIDE a transaction the caller owns, so the
   * invoice write, the balance move and the ledger row commit together or
   * not at all.
   *
   * This exists because both billing services used to deduct AFTER their
   * own payment transaction and "compensate" by reverting the invoice if
   * the deduction failed — and the compensation never removed the
   * {method:"wallet"} event already written into paymentHistory. The
   * invoice then recorded a wallet payment that never happened, which a
   * later cancellation would refund. With the deduction in the same
   * transaction there is nothing to compensate.
   *
   * Firestore requires every read in a transaction to precede every write,
   * so the caller does transaction.get(patientRef) in its read phase and
   * passes the snapshot; this method only checks and writes. Returns the
   * new ledger row's id.
   */
  deductFundsInTransaction(
    transaction: Transaction,
    patientSnap: DocumentSnapshot<DocumentData>,
    input: {
      patientId: string;
      clinicId: string;
      amount: number;
      referenceId: string;
      referenceType: "invoice" | "package";
      notes: string;
      createdBy: string;
      now: Date;
    },
  ): string {
    if (!patientSnap.exists()) {
      throw new Error("Patient not found");
    }

    const currentBalance = patientSnap.data()?.walletBalance || 0;

    if (currentBalance < input.amount) {
      throw new Error("Insufficient wallet balance");
    }

    const transactionRef = doc(collection(db, WALLET_TRANSACTIONS_COLLECTION));
    const row = buildWalletDeductionRow(input);

    transaction.set(transactionRef, {
      ...row,
      createdAt: Timestamp.fromDate(input.now),
    });
    transaction.update(patientSnap.ref, {
      walletBalance: increment(-input.amount),
      updatedAt: Timestamp.now(),
    });

    return transactionRef.id;
  },

  /**
   * Refund value back to a patient's wallet (e.g., unused package sessions).
   * Same shape as addFunds, but recorded as its own transaction type so
   * refunds are visually distinguishable from ordinary deposits in the
   * patient's wallet history.
   */
  async refundFunds(
    patientId: string,
    clinicId: string,
    amount: number,
    referenceId: string,
    notes: string,
    createdBy: string,
  ): Promise<string> {
    try {
      const now = new Date();
      const patientRef = doc(db, PATIENTS_COLLECTION, patientId);
      const transactionRef = doc(collection(db, WALLET_TRANSACTIONS_COLLECTION));

      // Same reasoning as addFunds: row and balance in one transaction. A
      // refund is what a cancellation puts back, so a half-applied one is
      // a patient told their money was returned when it wasn't.
      const transaction: Omit<WalletTransaction, "id"> = {
        patientId,
        clinicId,
        branchId: clinicId,
        type: "refund",
        amount,
        referenceId,
        notes,
        createdAt: now,
        createdBy,
      };

      await runTransaction(db, async (dbTransaction) => {
        const patientSnap = await dbTransaction.get(patientRef);

        if (!patientSnap.exists()) {
          throw new Error("Patient not found");
        }

        dbTransaction.set(transactionRef, {
          ...transaction,
          createdAt: Timestamp.fromDate(now),
        });
        dbTransaction.update(patientRef, {
          walletBalance: increment(amount),
          updatedAt: Timestamp.now(),
        });
      });

      return transactionRef.id;
    } catch (error) {
      console.error("Error refunding funds to wallet:", error);
      throw error;
    }
  },

  /**
   * Every wallet movement for a clinic within a date range.
   *
   * Front-desk cash now lands here before it ever reaches an invoice, so
   * without a clinic-wide read this money was visible on exactly one
   * screen — an individual patient's wallet tab — and in no report at all.
   * Used by daily reporting to recognise cash on the day it arrived rather
   * than the day the visit happened to check out.
   */
  async getClinicTransactionsInRange(
    clinicId: string,
    start: Date,
    end: Date,
  ): Promise<WalletTransaction[]> {
    try {
      // Filtered by clinic in the query (the security rule authorises a
      // list only when it can prove its clinic scope) and narrowed by date
      // in memory, which avoids requiring a composite index.
      const q = query(
        collection(db, WALLET_TRANSACTIONS_COLLECTION),
        where("clinicId", "==", clinicId),
      );

      const snapshot = await getDocs(q);
      const startTime = start.getTime();
      const endTime = end.getTime();

      return snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as WalletTransaction;
        })
        .filter((t) => {
          const time = t.createdAt.getTime();

          return time >= startTime && time <= endTime;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error("Error fetching clinic wallet transactions:", error);
      throw error;
    }
  },

  /**
   * Get wallet transaction history for a specific patient
   */
  async getPatientTransactions(
    patientId: string,
    clinicId: string,
  ): Promise<WalletTransaction[]> {
    try {
      const q = query(
        collection(db, WALLET_TRANSACTIONS_COLLECTION),
        where("patientId", "==", patientId),
        where("clinicId", "==", clinicId),
      );

      const snapshot = await getDocs(q);

      const transactions = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as WalletTransaction;
      });

      // Sort locally to avoid needing a composite index in Firestore
      return transactions.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      throw error;
    }
  },
};
