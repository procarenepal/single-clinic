import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { Expert } from "../types/models";

const EXPERTS_COLLECTION = "experts";

/**
 * Service for managing expert data in Firestore
 */
export const expertService = {
  // Deduplicate in-flight fetches per key
  __inflight: new Map<string, Promise<any[]>>(),
  /**
   * Create a new expert
   * @param {Partial<Expert>} expertData - Data for the new expert
   * @returns {Promise<string>} - ID of the created expert
   */
  async createExpert(expertData: Partial<Expert>): Promise<string> {
    try {
      const expertsRef = collection(db, EXPERTS_COLLECTION);
      const docRef = await addDoc(expertsRef, {
        ...expertData,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating expert:", error);
      throw error;
    }
  },

  /**
   * Get an expert by ID
   * @param {string} id - Expert ID
   * @returns {Promise<Expert | null>} - Expert data or null if not found
   */
  async getExpertById(id: string): Promise<Expert | null> {
    try {
      const docRef = doc(db, EXPERTS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Convert Firebase Timestamp objects to JavaScript Date objects
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date();
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();

        return {
          id: docSnap.id,
          ...data,
          createdAt,
          updatedAt,
        } as Expert;
      }

      return null;
    } catch (error) {
      console.error("Error getting expert:", error);
      throw error;
    }
  },

  /**
   * Update an expert
   * @param {string} id - Expert ID
   * @param {Partial<Expert>} updateData - Fields to update
   * @returns {Promise<void>}
   */
  async updateExpert(id: string, updateData: Partial<Expert>): Promise<void> {
    try {
      const docRef = doc(db, EXPERTS_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating expert:", error);
      throw error;
    }
  },

  /**
   * Get all experts (excluding deleted)
   */
  async getExperts(): Promise<Expert[]> {
    try {
      const expertsRef = collection(db, EXPERTS_COLLECTION);
      const snap = await getDocs(expertsRef);

      return snap.docs
        .map((doc) => {
          const data = doc.data() as any;
          const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
          const updatedAt = data.updatedAt ? data.updatedAt.toDate() : new Date();

          return {
            id: doc.id,
            ...data,
            createdAt,
            updatedAt,
          } as Expert;
        })
        .filter((expert) => !expert.isDeleted);
    } catch (error) {
      console.error("Error getting experts:", error);
      throw error;
    }
  },

  /**
   * Alias for backward compatibility
   */
  async getExpertsByClinic(
    _clinicId?: string,
    branchId?: string,
  ): Promise<Expert[]> {
    const experts = await this.getExperts();

    if (branchId) {
      return experts.filter((e) => e.branchId === branchId);
    }

    return experts;
  },

  /**
   * Get expert by email
   * @param {string} email - Expert email
   * @returns {Promise<Expert | null>} - Matching expert or null
   */
  async getExpertByEmail(email: string): Promise<Expert | null> {
    try {
      const experts = await this.getExperts();
      const term = email.toLowerCase();
      const match = experts.find(
        (expert) => expert.email && expert.email.toLowerCase() === term
      );
      return match || null;
    } catch (error) {
      console.error("Error getting expert by email:", error);
      throw error;
    }
  },

  /**
   * Search experts by name, speciality, or license number
   * @param {string} searchTerm - Search term
   * @param {string} clinicId - Clinic ID to filter by
   * @returns {Promise<Expert[]>} - Array of matching experts
   */
  async searchExperts(
    searchTerm: string,
    _clinicId?: string,
  ): Promise<Expert[]> {
    try {
      const experts = await this.getExperts();

      if (!searchTerm) {
        return experts;
      }

      const term = searchTerm.toLowerCase();

      return experts.filter(
        (expert) =>
          expert.name.toLowerCase().includes(term) ||
          expert.speciality.toLowerCase().includes(term) ||
          expert.licenseNumber.toLowerCase().includes(term) ||
          (expert.email && expert.email.toLowerCase().includes(term)),
      );
    } catch (error) {
      console.error("Error searching experts:", error);
      throw error;
    }
  },

  /**
   * Toggle expert active status
   * @param {string} id - Expert ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<void>}
   */
  async toggleExpertStatus(id: string, isActive: boolean): Promise<void> {
    try {
      await this.updateExpert(id, { isActive });
    } catch (error) {
      console.error("Error toggling expert status:", error);
      throw error;
    }
  },

  /**
   * Delete an expert (soft delete - sets isDeleted to true)
   * @param {string} id - Expert ID
   * @returns {Promise<void>}
   */
  async deleteExpert(id: string): Promise<void> {
    try {
      await this.updateExpert(id, { isDeleted: true });
    } catch (error) {
      console.error("Error deleting expert:", error);
      throw error;
    }
  },
};
