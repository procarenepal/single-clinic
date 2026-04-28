import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { DoctorSpeciality } from "@/types/models";

/**
 * Service for managing doctor specialities in Firestore
 */
export const specialityService = {
  /**
   * Create a new doctor speciality
   * @param {Partial<DoctorSpeciality>} specialityData - Speciality data to create
   * @returns {Promise<string>} - ID of the created speciality
   */
  async createSpeciality(
    specialityData: Partial<DoctorSpeciality>,
  ): Promise<string> {
    try {
      const specialitiesCollection = collection(db, "doctor_specialities");

      const docRef = await addDoc(specialitiesCollection, {
        isActive: true,
        ...specialityData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating speciality:", error);
      throw error;
    }
  },

  /**
   * Get a speciality by ID
   * @param {string} id - Speciality ID
   * @returns {Promise<DoctorSpeciality | null>} - Speciality data or null if not found
   */
  async getSpecialityById(id: string): Promise<DoctorSpeciality | null> {
    try {
      const docRef = doc(db, "doctor_specialities", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as DoctorSpeciality;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error getting speciality:", error);
      throw error;
    }
  },

  /**
   * Update a speciality
   * @param {string} id - Speciality ID
   * @param {Partial<DoctorSpeciality>} updateData - Fields to update
   * @returns {Promise<void>}
   */
  async updateSpeciality(
    id: string,
    updateData: Partial<DoctorSpeciality>,
  ): Promise<void> {
    try {
      const docRef = doc(db, "doctor_specialities", id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating speciality:", error);
      throw error;
    }
  },

  /**
   * Delete a speciality
   * @param {string} id - Speciality ID
   * @returns {Promise<void>}
   */
  async deleteSpeciality(id: string): Promise<void> {
    try {
      const docRef = doc(db, "doctor_specialities", id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting speciality:", error);
      throw error;
    }
  },

  /**
   * Get all specialities.
   * Scoping by clinicId/branchId is ignored in standalone mode.
   * @param {boolean} activeOnly - Whether to return only active specialities
   * @returns {Promise<DoctorSpeciality[]>} - Array of specialities
   */
  async getSpecialities(
    activeOnly: boolean = false,
  ): Promise<DoctorSpeciality[]> {
    try {
      const specialitiesCollection = collection(db, "doctor_specialities");
      const querySnapshot = await getDocs(specialitiesCollection);

      let specialities: DoctorSpeciality[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();

        specialities.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as DoctorSpeciality);
      });

      // Filter by active status in memory
      if (activeOnly) {
        specialities = specialities.filter((s) => s.isActive === true);
      }

      // Sort by name in memory
      specialities.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      return specialities;
    } catch (error) {
      console.error("Error getting specialities:", error);
      throw error;
    }
  },

  /**
   * Alias for backward compatibility during migration
   */
  async getSpecialitiesByClinic(
    _clinicId?: string,
    activeOnly: boolean = false,
    _branchId?: string,
  ): Promise<DoctorSpeciality[]> {
    return this.getSpecialities(activeOnly);
  },

  /**
   * Get active specialities for dropdown usage.
   * @returns {Promise<Array<{key: string, label: string}>>} - Array of key-label pairs
   */
  async getActiveSpecialitiesForDropdown(
    _clinicId?: string,
    _branchId?: string,
  ): Promise<Array<{ key: string; label: string }>> {
    try {
      const specialities = await this.getSpecialities(true);

      return specialities.map((speciality) => ({
        key: speciality.key || speciality.id,
        label: speciality.name,
      }));
    } catch (error) {
      console.error("Error getting specialities for dropdown:", error);
      throw error;
    }
  },

  /**
   * Check if a speciality key already exists
   * @param {string} key - Speciality key to check
   * @param {string} excludeId - ID to exclude from check (for updates)
   * @returns {Promise<boolean>} - True if key exists
   */
  async isKeyExists(
    key: string,
    _excludeId?: string,
  ): Promise<boolean> {
    try {
      const specialitiesCollection = collection(db, "doctor_specialities");
      const q = query(
        specialitiesCollection,
        where("key", "==", key),
      );

      const querySnapshot = await getDocs(q);

      if (_excludeId) {
        return querySnapshot.docs.some(doc => doc.id !== _excludeId);
      }

      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking if key exists:", error);
      throw error;
    }
  },

  /**
   * Toggle speciality active status
   * @param {string} id - Speciality ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<void>}
   */
  async toggleSpecialityStatus(id: string, isActive: boolean): Promise<void> {
    try {
      await this.updateSpeciality(id, { isActive });
    } catch (error) {
      console.error("Error toggling speciality status:", error);
      throw error;
    }
  },
};
