import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  addDoc,
  serverTimestamp,
  where,
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

      // The clinical-profile fields set here (commission rate, license
      // number) weren't in the audit trail at all before — only the login
      // side (userService.createUser's "user_created") was logged.
      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "expert_profile_created",
          expertData.clinicId || "",
          {
            expertId: docRef.id,
            name: expertData.name,
            speciality: expertData.speciality,
            licenseNumber: expertData.licenseNumber,
            defaultCommission: expertData.defaultCommission,
            email: expertData.email,
          },
          "success",
          undefined,
          {
            branchId: expertData.branchId,
          },
        );
      } catch (logError) {
        console.error("Failed to log expert profile creation event:", logError);
      }

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
      const existingSnap = await getDoc(docRef);
      const existingData = existingSnap.exists() ? existingSnap.data() : null;

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "expert_profile_updated",
          updateData.clinicId || existingData?.clinicId || "",
          {
            expertId: id,
            previousData: existingData
              ? {
                  name: existingData.name,
                  email: existingData.email,
                  speciality: existingData.speciality,
                  licenseNumber: existingData.licenseNumber,
                  defaultCommission: existingData.defaultCommission,
                }
              : undefined,
            updatedData: updateData,
          },
          "success",
        );
      } catch (logError) {
        console.error("Failed to log expert profile update event:", logError);
      }
    } catch (error) {
      console.error("Error updating expert:", error);
      throw error;
    }
  },

  /**
   * Get all experts (excluding deleted). Was previously an always-unfiltered
   * `getDocs(expertsRef)` with clinic scoping applied only client-side after
   * the fact — every clinic's expert records were sent over the wire to
   * every caller regardless of clinicId. Now filters server-side via a real
   * `where` clause, matching the fix already applied to every other
   * service's equivalent leak this session.
   */
  async getExperts(clinicId?: string): Promise<Expert[]> {
    try {
      const expertsRef = collection(db, EXPERTS_COLLECTION);
      const q = clinicId
        ? query(expertsRef, where("clinicId", "==", clinicId))
        : expertsRef;
      const snap = await getDocs(q);

      return snap.docs
        .map((doc) => {
          const data = doc.data() as any;
          const createdAt = data.createdAt
            ? data.createdAt.toDate()
            : new Date();
          const updatedAt = data.updatedAt
            ? data.updatedAt.toDate()
            : new Date();

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
   * Alias for backward compatibility. clinicId goes all the way down to
   * a server-side `where` clause in getExperts (see above).
   */
  async getExpertsByClinic(
    clinicId?: string,
  ): Promise<Expert[]> {
    return await this.getExperts(clinicId);
  },

  /**
   * Get expert by email
   * @param {string} email - Expert email
   * @returns {Promise<Expert | null>} - Matching expert or null
   */
  async getExpertByEmail(
    email: string,
    clinicId?: string,
  ): Promise<Expert | null> {
    try {
      const experts = await this.getExperts(clinicId);
      const term = email.toLowerCase();
      const match = experts.find(
        (expert) => expert.email && expert.email.toLowerCase() === term,
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
    clinicId?: string,
  ): Promise<Expert[]> {
    try {
      const experts = await this.getExperts(clinicId);

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
      const expert = await this.getExpertById(id);

      await this.updateExpert(id, { isActive });

      // The reverse of userService's own sync (deactivating a login also
      // deactivates its matching clinical profile) — without this,
      // deactivating an expert from the Experts list left their login
      // fully functional, able to sign in and see their full dashboard as
      // if nothing had changed.
      if (expert?.email) {
        try {
          const { userService } = await import("./userService");
          const loginUser = await userService.getUserByEmail(expert.email);

          if (loginUser && loginUser.isActive !== isActive) {
            await userService.setUserActive(loginUser.id, isActive);
          }
        } catch (syncError) {
          console.error(
            `toggleExpertStatus: failed to sync login status for ${expert.email}`,
            syncError,
          );
        }
      }
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
