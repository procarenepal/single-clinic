import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { TreatmentCategory } from "../types/models";

const TREATMENT_CATEGORIES_COLLECTION = "treatment_categories";

/**
 * Service for managing treatment categories for appointment types
 */
export const treatmentCategoryService = {
  /**
   * Get all treatment categories for a specific clinic
   */
  async getCategoriesByClinic(
    clinicId: string,
    branchId?: string | null,
  ): Promise<TreatmentCategory[]> {
    try {
      const categoriesRef = collection(db, TREATMENT_CATEGORIES_COLLECTION);
      let q;

      if (branchId) {
        q = query(
          categoriesRef,

          where("branchId", "==", branchId),
          where("isActive", "==", true),
        );
      } else {
        q = query(
          categoriesRef,

          where("isActive", "==", true),
        );
      }

      const querySnapshot = await getDocs(q);
      const categories: TreatmentCategory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;

        categories.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as TreatmentCategory);
      });

      // Sort by name in memory to avoid needing a composite index
      return categories.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting treatment categories:", error);
      throw error;
    }
  },

  /**
   * Create a new treatment category
   */
  async createCategory(
    categoryData: Omit<TreatmentCategory, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const categoriesRef = collection(db, TREATMENT_CATEGORIES_COLLECTION);
      const docRef = await addDoc(categoriesRef, {
        ...categoryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating treatment category:", error);
      throw error;
    }
  },

  /**
   * Update an existing treatment category
   */
  async updateCategory(
    id: string,
    updateData: Partial<TreatmentCategory>,
  ): Promise<void> {
    try {
      const docRef = doc(db, TREATMENT_CATEGORIES_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating treatment category:", error);
      throw error;
    }
  },

  /**
   * Delete a treatment category (soft delete)
   */
  async deleteCategory(id: string): Promise<void> {
    try {
      const docRef = doc(db, TREATMENT_CATEGORIES_COLLECTION, id);

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error deleting treatment category:", error);
      throw error;
    }
  },
};
