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
import { ItemCategory } from "../types/models";

const ITEM_CATEGORIES_COLLECTION = "itemCategories";

/**
 * Service for managing item categories
 */
export const itemCategoryService = {
  /**
   * Get all item categories for a specific clinic
   */
  async getCategoriesByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<ItemCategory[]> {
    try {
      const categoriesRef = collection(db, ITEM_CATEGORIES_COLLECTION);
      const constraints: any[] = [
        where("clinicId", "==", clinicId),
        where("isActive", "==", true),
      ];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(categoriesRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const categories: ItemCategory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        categories.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as ItemCategory);
      });

      // Sort in memory by name
      return categories.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting categories by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a specific item category by ID
   */
  async getCategoryById(categoryId: string): Promise<ItemCategory | null> {
    try {
      const categoryRef = doc(db, ITEM_CATEGORIES_COLLECTION, categoryId);
      const categorySnap = await getDoc(categoryRef);

      if (categorySnap.exists()) {
        const data = categorySnap.data();

        return {
          id: categorySnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as ItemCategory;
      }

      return null;
    } catch (error) {
      console.error("Error getting category by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new item category
   */
  async createCategory(
    categoryData: Omit<ItemCategory, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const categoriesRef = collection(db, ITEM_CATEGORIES_COLLECTION);
      const now = Timestamp.now();

      const docRef = await addDoc(categoriesRef, {
        ...categoryData,
        createdAt: now,
        updatedAt: now,
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  },

  /**
   * Update an existing item category
   */
  async updateCategory(
    categoryId: string,
    categoryData: Partial<Omit<ItemCategory, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const categoryRef = doc(db, ITEM_CATEGORIES_COLLECTION, categoryId);

      await updateDoc(categoryRef, {
        ...categoryData,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  },

  /**
   * Delete an item category (soft delete)
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const categoryRef = doc(db, ITEM_CATEGORIES_COLLECTION, categoryId);

      await updateDoc(categoryRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  },

  /**
   * Check if category name exists for a clinic
   */
  async checkCategoryNameExists(
    clinicId: string,
    branchId: string,
    categoryName: string,
    excludeId?: string,
  ): Promise<boolean> {
    try {
      const categoriesRef = collection(db, ITEM_CATEGORIES_COLLECTION);
      const q = query(
        categoriesRef,
        where("clinicId", "==", clinicId),
        where("branchId", "==", branchId),
        where("name", "==", categoryName),
        where("isActive", "==", true),
      );

      const querySnapshot = await getDocs(q);

      if (excludeId) {
        return querySnapshot.docs.some((doc) => doc.id !== excludeId);
      }

      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking category name exists:", error);
      throw error;
    }
  },
};
