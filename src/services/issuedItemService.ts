import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { IssuedItem } from "../types/models";

const ISSUED_ITEMS_COLLECTION = "issuedItems";

/**
 * Service for managing issued items
 */
export const issuedItemService = {
  /**
   * Get all issued items for a specific clinic
   */
  async getIssuedItemsByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<IssuedItem[]> {
    try {
      const issuedItemsRef = collection(db, ISSUED_ITEMS_COLLECTION);
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(issuedItemsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const issuedItems: IssuedItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        issuedItems.push({
          id: doc.id,
          ...data,
          issuedDate: data.issuedDate?.toDate(),
          returnDate: data.returnDate?.toDate(),
          expectedReturnDate: data.expectedReturnDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as IssuedItem);
      });

      // Sort in memory by issuedDate (descending)
      return issuedItems.sort(
        (a, b) =>
          (b.issuedDate?.getTime() || 0) - (a.issuedDate?.getTime() || 0),
      );
    } catch (error) {
      console.error("Error getting issued items by clinic:", error);
      throw error;
    }
  },

  /**
   * Get issued items by status
   */
  async getIssuedItemsByStatus(
    clinicId: string,
    status: "issued" | "returned" | "overdue",
    branchId?: string,
  ): Promise<IssuedItem[]> {
    try {
      const issuedItemsRef = collection(db, ISSUED_ITEMS_COLLECTION);
      const constraints: any[] = [where("status", "==", status)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(issuedItemsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const issuedItems: IssuedItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        issuedItems.push({
          id: doc.id,
          ...data,
          issuedDate: data.issuedDate?.toDate(),
          returnDate: data.returnDate?.toDate(),
          expectedReturnDate: data.expectedReturnDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as IssuedItem);
      });

      // Sort in memory by issuedDate (descending)
      return issuedItems.sort(
        (a, b) =>
          (b.issuedDate?.getTime() || 0) - (a.issuedDate?.getTime() || 0),
      );
    } catch (error) {
      console.error("Error getting issued items by status:", error);
      throw error;
    }
  },

  /**
   * Get a specific issued item by ID
   */
  async getIssuedItemById(issuedItemId: string): Promise<IssuedItem | null> {
    try {
      const issuedItemRef = doc(db, ISSUED_ITEMS_COLLECTION, issuedItemId);
      const issuedItemSnap = await getDoc(issuedItemRef);

      if (issuedItemSnap.exists()) {
        const data = issuedItemSnap.data();

        return {
          id: issuedItemSnap.id,
          ...data,
          issuedDate: data.issuedDate?.toDate(),
          returnDate: data.returnDate?.toDate(),
          expectedReturnDate: data.expectedReturnDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as IssuedItem;
      }

      return null;
    } catch (error) {
      console.error("Error getting issued item by ID:", error);
      throw error;
    }
  },

  /**
   * Issue a new item
   */
  async issueItem(
    issuedItemData: Omit<IssuedItem, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const issuedItemsRef = collection(db, ISSUED_ITEMS_COLLECTION);
      const now = Timestamp.now();

      // Helper to handle both Date and Timestamp
      const toTimestamp = (date: any) => {
        if (!date) return null;
        if (date instanceof Timestamp) return date;

        return Timestamp.fromDate(new Date(date));
      };

      // Sanitize undefined fields
      const sanitize = (obj: any) => {
        const cleaned: any = {};

        Object.keys(obj).forEach((key) => {
          if (obj[key] !== undefined) cleaned[key] = obj[key];
        });

        return cleaned;
      };

      const docRef = await addDoc(
        issuedItemsRef,
        sanitize({
          ...issuedItemData,
          issuedDate: toTimestamp(issuedItemData.issuedDate),
          expectedReturnDate: toTimestamp(issuedItemData.expectedReturnDate),
          createdAt: now,
          updatedAt: now,
        }),
      );

      return docRef.id;
    } catch (error) {
      console.error("Error issuing item:", error);
      throw error;
    }
  },

  /**
   * Create an issued item record (internal or manual)
   */
  async createIssuedItem(
    issuedItemData: Omit<IssuedItem, "id">,
  ): Promise<string> {
    try {
      const issuedItemsRef = collection(db, ISSUED_ITEMS_COLLECTION);
      const now = Timestamp.now();
      const { id, ...dataToSave } = issuedItemData as any;

      const toTimestamp = (date: any) => {
        if (!date) return null;
        if (date instanceof Timestamp) return date;

        return Timestamp.fromDate(new Date(date));
      };

      // Sanitize undefined fields
      const sanitize = (obj: any) => {
        const cleaned: any = {};

        Object.keys(obj).forEach((key) => {
          if (obj[key] !== undefined) cleaned[key] = obj[key];
        });

        return cleaned;
      };

      const docRef = await addDoc(
        issuedItemsRef,
        sanitize({
          ...dataToSave,
          issuedDate: toTimestamp(issuedItemData.issuedDate),
          returnDate: toTimestamp(issuedItemData.returnDate),
          expectedReturnDate: toTimestamp(issuedItemData.expectedReturnDate),
          createdAt: issuedItemData.createdAt
            ? toTimestamp(issuedItemData.createdAt)
            : now,
          updatedAt: now,
        }),
      );

      return docRef.id;
    } catch (error) {
      console.error("Error creating issued item:", error);
      throw error;
    }
  },

  /**
   * Return an issued item
   */
  async returnItem(
    issuedItemId: string,
    returnedBy: string,
    returnDate?: Date,
  ): Promise<void> {
    try {
      const issuedItemRef = doc(db, ISSUED_ITEMS_COLLECTION, issuedItemId);

      await updateDoc(issuedItemRef, {
        status: "returned",
        returnDate: Timestamp.fromDate(returnDate || new Date()),
        returnedBy: returnedBy,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error returning item:", error);
      throw error;
    }
  },

  /**
   * Update an issued item
   */
  async updateIssuedItem(
    issuedItemId: string,
    issuedItemData: Partial<Omit<IssuedItem, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const issuedItemRef = doc(db, ISSUED_ITEMS_COLLECTION, issuedItemId);

      const toTimestamp = (date: any) => {
        if (!date) return null;
        if (date instanceof Timestamp) return date;

        return Timestamp.fromDate(new Date(date));
      };

      // Sanitize undefined fields
      const sanitize = (obj: any) => {
        const cleaned: any = {};

        Object.keys(obj).forEach((key) => {
          if (obj[key] !== undefined) cleaned[key] = obj[key];
        });

        return cleaned;
      };

      const updateData: any = {
        ...issuedItemData,
        updatedAt: Timestamp.now(),
      };

      // Convert dates to Timestamp objects if provided
      if (issuedItemData.issuedDate) {
        updateData.issuedDate = toTimestamp(issuedItemData.issuedDate);
      }
      if (issuedItemData.returnDate) {
        updateData.returnDate = toTimestamp(issuedItemData.returnDate);
      }
      if (issuedItemData.expectedReturnDate) {
        updateData.expectedReturnDate = toTimestamp(
          issuedItemData.expectedReturnDate,
        );
      }

      await updateDoc(issuedItemRef, sanitize(updateData));
    } catch (error) {
      console.error("Error updating issued item:", error);
      throw error;
    }
  },

  /**
   * Delete an issued item
   */
  async deleteIssuedItem(issuedItemId: string): Promise<void> {
    try {
      const issuedItemRef = doc(db, ISSUED_ITEMS_COLLECTION, issuedItemId);

      await deleteDoc(issuedItemRef);
    } catch (error) {
      console.error("Error deleting issued item:", error);
      throw error;
    }
  },

  /**
   * Update overdue items status
   */
  async updateOverdueItems(clinicId: string, branchId?: string): Promise<void> {
    try {
      const issuedItemsRef = collection(db, ISSUED_ITEMS_COLLECTION);
      let q = query(
        issuedItemsRef,

        where("status", "==", "issued"),
      );

      if (branchId) {
        q = query(
          issuedItemsRef,

          where("branchId", "==", branchId),
          where("status", "==", "issued"),
        );
      }

      const querySnapshot = await getDocs(q);
      const now = new Date();
      const batch = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        if (data.expectedReturnDate && data.expectedReturnDate.toDate() < now) {
          batch.push(
            updateDoc(doc.ref, {
              status: "overdue",
              updatedAt: Timestamp.now(),
            }),
          );
        }
      });

      await Promise.all(batch);
    } catch (error) {
      console.error("Error updating overdue items:", error);
      throw error;
    }
  },
};
