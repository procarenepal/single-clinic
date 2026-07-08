import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { Item, ItemPurchase } from "../types/models";

const ITEMS_COLLECTION = "items";
const ITEM_PURCHASES_COLLECTION = "itemPurchases";

/**
 * Service for managing inventory items (non-medicines)
 */
export const itemService = {
  /**
   * Get all items for a specific clinic
   */
  async getItemsByClinic(clinicId: string, branchId?: string): Promise<Item[]> {
    try {
      const itemsRef = collection(db, ITEMS_COLLECTION);
      const constraints: any[] = [

        where("isActive", "==", true),
      ];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(itemsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const items: Item[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        items.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          purchaseDate: data.purchaseDate?.toDate(),
        } as Item);
      });

      // Sort in memory by name
      return items.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting items by clinic:", error);
      throw error;
    }
  },

  /**
   * Create a new item
   */
  async createItem(
    itemData: Omit<Item, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const itemsRef = collection(db, ITEMS_COLLECTION);

      const now = Timestamp.now();

      // Sanitize undefined fields
      const sanitize = (obj: any) => {
        const cleaned: any = {};

        Object.keys(obj).forEach((key) => {
          if (obj[key] !== undefined) cleaned[key] = obj[key];
        });

        return cleaned;
      };

      const data = sanitize({
        ...itemData,
        purchaseDate: itemData.purchaseDate
          ? itemData.purchaseDate instanceof Timestamp
            ? itemData.purchaseDate
            : Timestamp.fromDate(new Date(itemData.purchaseDate))
          : null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(itemsRef, data);

      console.log("Item created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating item:", error);
      throw error;
    }
  },

  /**
   * Get an item by ID
   */
  async getItemById(id: string): Promise<Item | null> {
    try {
      const docRef = doc(db, ITEMS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          purchaseDate: data.purchaseDate?.toDate(),
        } as Item;
      }

      return null;
    } catch (error) {
      console.error("Error getting item by ID:", error);
      throw error;
    }
  },

  /**
   * Update an item
   */
  async updateItem(
    id: string,
    updates: Partial<Omit<Item, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, ITEMS_COLLECTION, id);
      const now = Timestamp.now();

      // Sanitize undefined fields
      const sanitize = (obj: any) => {
        const cleaned: any = {};

        Object.keys(obj).forEach((key) => {
          if (obj[key] !== undefined) cleaned[key] = obj[key];
        });

        return cleaned;
      };

      await updateDoc(
        docRef,
        sanitize({
          ...updates,
          purchaseDate: updates.purchaseDate
            ? updates.purchaseDate instanceof Timestamp
              ? updates.purchaseDate
              : Timestamp.fromDate(new Date(updates.purchaseDate as any))
            : undefined,
          updatedAt: now,
        }),
      );

      console.log("Item updated successfully");
    } catch (error) {
      console.error("Error updating item:", error);
      throw error;
    }
  },

  /**
   * Delete an item (soft delete by setting isActive to false)
   */
  async deleteItem(id: string): Promise<void> {
    try {
      const docRef = doc(db, ITEMS_COLLECTION, id);
      const now = Timestamp.now();

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: now,
      });

      console.log("Item deleted successfully");
    } catch (error) {
      console.error("Error deleting item:", error);
      throw error;
    }
  },

  /**
   * Get items by category
   */
  async getItemsByCategory(
    clinicId: string,
    category: string,
    branchId?: string,
  ): Promise<Item[]> {
    try {
      const itemsRef = collection(db, ITEMS_COLLECTION);
      const constraints: any[] = [

        where("category", "==", category),
        where("isActive", "==", true),
      ];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(itemsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const items: Item[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        items.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          purchaseDate: data.purchaseDate?.toDate(),
        } as Item);
      });

      // Sort in memory by name
      return items.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting items by category:", error);
      throw error;
    }
  },

  /**
   * Search items by name
   */
  async searchItems(
    clinicId: string,
    searchTerm: string,
    branchId?: string,
  ): Promise<Item[]> {
    try {
      const itemsRef = collection(db, ITEMS_COLLECTION);
      let q = query(
        itemsRef,

        where("isActive", "==", true),
        orderBy("name"),
      );

      if (branchId) {
        q = query(
          itemsRef,

          where("branchId", "==", branchId),
          where("isActive", "==", true),
          orderBy("name"),
        );
      }

      const querySnapshot = await getDocs(q);
      const items: Item[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const item = {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          purchaseDate: data.purchaseDate?.toDate(),
        } as Item;

        // Client-side filtering by name (case-insensitive)
        if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          items.push(item);
        }
      });

      return items;
    } catch (error) {
      console.error("Error searching items:", error);
      throw error;
    }
  },

  /**
   * Get item categories for a clinic
   */
  async getItemCategories(
    clinicId: string,
    branchId?: string,
  ): Promise<string[]> {
    try {
      const items = await this.getItemsByClinic(clinicId, branchId);
      const categories = new Set<string>();

      items.forEach((item) => {
        if (item.category) {
          categories.add(item.category);
        }
      });

      return Array.from(categories).sort();
    } catch (error) {
      console.error("Error getting item categories:", error);
      throw error;
    }
  },

  /**
   * Log an item purchase / refill bill
   */
  async createItemPurchase(
    purchaseData: Omit<ItemPurchase, "id" | "createdAt">,
  ): Promise<string> {
    try {
      const purchasesRef = collection(db, ITEM_PURCHASES_COLLECTION);
      const now = Timestamp.now();

      const data = {
        ...purchaseData,
        purchaseDate: purchaseData.purchaseDate
          ? purchaseData.purchaseDate instanceof Timestamp
            ? purchaseData.purchaseDate
            : Timestamp.fromDate(new Date(purchaseData.purchaseDate))
          : now,
        createdAt: now,
      };

      const docRef = await addDoc(purchasesRef, data);

      return docRef.id;
    } catch (error) {
      console.error("Error creating item purchase log:", error);
      throw error;
    }
  },

  /**
   * Get purchase logs (refill history) by clinic
   */
  async getItemPurchasesByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<ItemPurchase[]> {
    try {
      const purchasesRef = collection(db, ITEM_PURCHASES_COLLECTION);
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(purchasesRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const purchases: ItemPurchase[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        purchases.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate(),
          purchaseDate: data.purchaseDate?.toDate(),
        } as ItemPurchase);
      });

      // Sort in memory by createdAt desc to avoid requiring a composite index in Firestore
      return purchases.sort((a, b) => {
        const dateA = a.createdAt ? a.createdAt.getTime() : 0;
        const dateB = b.createdAt ? b.createdAt.getTime() : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting item purchases:", error);
      throw error;
    }
  },
};
