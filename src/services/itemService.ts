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
import { Item } from "../types/models";

const ITEMS_COLLECTION = "items";

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
        where("clinicId", "==", clinicId),
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
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
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
      const data = {
        ...itemData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

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
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
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

      await updateDoc(docRef, {
        ...updates,
        updatedAt: now,
      });

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
        where("clinicId", "==", clinicId),
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
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
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
        where("clinicId", "==", clinicId),
        where("isActive", "==", true),
        orderBy("name"),
      );

      if (branchId) {
        q = query(
          itemsRef,
          where("clinicId", "==", clinicId),
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
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
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
};
