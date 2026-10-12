import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { AccountBill, Vendor } from "@/types/models";

const BILLS_COLLECTION = "account_bills";
const VENDORS_COLLECTION = "vendors";

export const accountService = {
  // --- Bill Operations ---

  async createBill(
    bill: Omit<AccountBill, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, BILLS_COLLECTION), {
      ...bill,
      billDate: Timestamp.fromDate(new Date(bill.billDate)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },

  /**
   * Correct a bill the IRD-compliant way (Electronic Invoice Procedure 6(ख)/6(ट)):
   * nothing is edited in place or deleted. The corrected bill is saved as a NEW
   * record and the original is marked no longer effective, with who/when/why.
   * Both writes land together or not at all. Returns the new bill's id.
   */
  async correctBill(
    original: AccountBill,
    corrected: Omit<AccountBill, "id" | "createdAt" | "updatedAt">,
    correction: { reason: string; correctedBy: string; correctedByName?: string },
  ): Promise<string> {
    const newRef = doc(collection(db, BILLS_COLLECTION));
    const batch = writeBatch(db);

    batch.set(newRef, {
      ...corrected,
      billDate: Timestamp.fromDate(new Date(corrected.billDate)),
      correctsBillId: original.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, BILLS_COLLECTION, original.id), {
      isEffective: false,
      correction: {
        reason: correction.reason,
        correctedBy: correction.correctedBy,
        ...(correction.correctedByName && {
          correctedByName: correction.correctedByName,
        }),
        correctedAt: Timestamp.now(),
        replacedByBillId: newRef.id,
        replacedByBillNumber: corrected.billNumber,
      },
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    return newRef.id;
  },

  async updateBill(id: string, bill: Partial<AccountBill>): Promise<void> {
    const docRef = doc(db, BILLS_COLLECTION, id);
    const updateData: any = { ...bill, updatedAt: serverTimestamp() };

    if (bill.billDate) {
      updateData.billDate = Timestamp.fromDate(new Date(bill.billDate));
    }

    await updateDoc(docRef, updateData);
  },

  async getBillsByClinic(
    clinicId: string,
  ): Promise<AccountBill[]> {
    const q = query(
      collection(db, BILLS_COLLECTION),
      where("clinicId", "==", clinicId),
    );

    const querySnapshot = await getDocs(q);
    const bills = querySnapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        billDate: data.billDate?.toDate
          ? data.billDate.toDate()
          : new Date(data.billDate),
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate()
          : new Date(data.updatedAt),
        ...(Array.isArray(data.payments) && {
          payments: data.payments.map((p: any) => ({
            ...p,
            date: p.date?.toDate ? p.date.toDate() : new Date(p.date),
          })),
        }),
        ...(data.correction && {
          correction: {
            ...data.correction,
            correctedAt: data.correction.correctedAt?.toDate
              ? data.correction.correctedAt.toDate()
              : new Date(data.correction.correctedAt),
          },
        }),
      } as AccountBill;
    });

    // Sort by billDate desc in-memory to avoid composite index requirement
    return bills.sort((a, b) => b.billDate.getTime() - a.billDate.getTime());
  },

  // --- Vendor Operations ---

  async createVendor(
    vendor: Omit<Vendor, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, VENDORS_COLLECTION), {
      ...vendor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },

  async getVendorsByClinic(
    clinicId: string,
  ): Promise<Vendor[]> {
    const q = query(
      collection(db, VENDORS_COLLECTION),
      where("clinicId", "==", clinicId),
    );

    const querySnapshot = await getDocs(q);
    const vendors = querySnapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate()
          : new Date(data.updatedAt),
      } as Vendor;
    });

    // Sort by name asc in-memory to avoid composite index requirement
    return vendors.sort((a, b) => a.name.localeCompare(b.name));
  },

  async updateVendor(id: string, vendor: Partial<Vendor>): Promise<void> {
    const docRef = doc(db, VENDORS_COLLECTION, id);

    await updateDoc(docRef, { ...vendor, updatedAt: serverTimestamp() });
  },
};
