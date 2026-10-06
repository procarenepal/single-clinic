import {
  collection,
  doc,
  getDocs,
  addDoc,
  query,
  where,
  Timestamp,
  updateDoc,
  increment,
  runTransaction,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { WalletTransaction } from "../types/models";

const WALLET_TRANSACTIONS_COLLECTION = "walletTransactions";
const PATIENTS_COLLECTION = "patients";

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

      // 1. Record the transaction
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

      const docRef = await addDoc(
        collection(db, WALLET_TRANSACTIONS_COLLECTION),
        {
          ...transaction,
          createdAt: Timestamp.fromDate(now),
        },
      );

      // 2. Update the patient's wallet balance
      const patientRef = doc(db, PATIENTS_COLLECTION, patientId);

      await updateDoc(patientRef, {
        walletBalance: increment(amount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
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
      const now = new Date();
      const patientRef = doc(db, PATIENTS_COLLECTION, patientId);
      const transactionRef = doc(collection(db, WALLET_TRANSACTIONS_COLLECTION));

      // The balance check + decrement must be atomic — two concurrent
      // deductions for the same patient (e.g. two invoices paid via wallet
      // at nearly the same moment, or the double-payment race in
      // appointmentBillingService.recordPayment) could otherwise both read
      // the same pre-deduction balance, both pass the sufficiency check,
      // and both apply increment(-amount), driving the balance negative.
      // Mirrors the same pattern already used correctly in
      // patientPackageService's session-consumption transaction.
      await runTransaction(db, async (dbTransaction) => {
        const patientSnap = await dbTransaction.get(patientRef);

        if (!patientSnap.exists()) {
          throw new Error("Patient not found");
        }

        const patientData = patientSnap.data();
        const currentBalance = patientData.walletBalance || 0;

        if (currentBalance < amount) {
          throw new Error("Insufficient wallet balance");
        }

        const transactionData: Omit<WalletTransaction, "id"> = {
          patientId,
          clinicId,
          branchId: clinicId,
          type: "deduction",
          amount,
          referenceId: invoiceId,
          referenceType,
          notes,
          createdAt: now,
          createdBy,
        };

        dbTransaction.set(transactionRef, {
          ...transactionData,
          createdAt: Timestamp.fromDate(now),
        });

        dbTransaction.update(patientRef, {
          // Increment with a negative value to deduct
          walletBalance: increment(-amount),
          updatedAt: Timestamp.now(),
        });
      });

      return transactionRef.id;
    } catch (error) {
      console.error("Error deducting funds from wallet:", error);
      throw error;
    }
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

      const docRef = await addDoc(
        collection(db, WALLET_TRANSACTIONS_COLLECTION),
        {
          ...transaction,
          createdAt: Timestamp.fromDate(now),
        },
      );

      const patientRef = doc(db, PATIENTS_COLLECTION, patientId);

      await updateDoc(patientRef, {
        walletBalance: increment(amount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
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
