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
  ): Promise<string> {
    try {
      const now = new Date();
      const patientRef = doc(db, PATIENTS_COLLECTION, patientId);
      
      const { getDoc } = await import("firebase/firestore");
      const patientSnap = await getDoc(patientRef);
      if (!patientSnap.exists()) {
        throw new Error("Patient not found");
      }
      
      const patientData = patientSnap.data();
      const currentBalance = patientData.walletBalance || 0;
      
      if (currentBalance < amount) {
        throw new Error("Insufficient wallet balance");
      }

      // 1. Record the transaction
      const transaction: Omit<WalletTransaction, "id"> = {
        patientId,
        clinicId,
        branchId: clinicId,
        type: "deduction",
        amount,
        referenceId: invoiceId,
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

      // 2. Update the patient's wallet balance

      await updateDoc(patientRef, {
        // Increment with a negative value to deduct
        walletBalance: increment(-amount),
        updatedAt: Timestamp.now(),
      });

      return docRef.id;
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
