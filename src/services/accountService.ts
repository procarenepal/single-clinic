import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { AccountBill, Vendor } from "@/types/models";

const BILLS_COLLECTION = "account_bills";
const VENDORS_COLLECTION = "vendors";

export const accountService = {
  // --- Bill Operations ---
  
  async createBill(bill: Omit<AccountBill, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docRef = await addDoc(collection(db, BILLS_COLLECTION), {
      ...bill,
      billDate: Timestamp.fromDate(new Date(bill.billDate)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateBill(id: string, bill: Partial<AccountBill>): Promise<void> {
    const docRef = doc(db, BILLS_COLLECTION, id);
    const updateData: any = { ...bill, updatedAt: serverTimestamp() };
    
    if (bill.billDate) {
      updateData.billDate = Timestamp.fromDate(new Date(bill.billDate));
    }
    
    await updateDoc(docRef, updateData);
  },

  async getBillsByClinic(clinicId: string, branchId?: string): Promise<AccountBill[]> {
    let q = query(
      collection(db, BILLS_COLLECTION),
      where("clinicId", "==", clinicId)
    );

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    const bills = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        billDate: data.billDate?.toDate ? data.billDate.toDate() : new Date(data.billDate),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      } as AccountBill;
    });

    // Sort by billDate desc in-memory to avoid composite index requirement
    return bills.sort((a, b) => b.billDate.getTime() - a.billDate.getTime());
  },

  // --- Vendor Operations ---

  async createVendor(vendor: Omit<Vendor, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docRef = await addDoc(collection(db, VENDORS_COLLECTION), {
      ...vendor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async getVendorsByClinic(clinicId: string, branchId?: string): Promise<Vendor[]> {
    let q = query(
      collection(db, VENDORS_COLLECTION),
      where("clinicId", "==", clinicId)
    );

    if (branchId) {
      q = query(q, where("branchId", "==", branchId));
    }

    const querySnapshot = await getDocs(q);
    const vendors = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      } as Vendor;
    });

    // Sort by name asc in-memory to avoid composite index requirement
    return vendors.sort((a, b) => a.name.localeCompare(b.name));
  },

  async updateVendor(id: string, vendor: Partial<Vendor>): Promise<void> {
    const docRef = doc(db, VENDORS_COLLECTION, id);
    await updateDoc(docRef, { ...vendor, updatedAt: serverTimestamp() });
  }
};
