import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../config/firebase";
import { Clinic } from "../types/models";

import { PrintLayoutConfig } from "@/types/printLayout";

const CLINICS_COLLECTION = "clinics";

/**
 * Helper function to verify if current user is a system owner
 * @returns {Promise<boolean>} - True if user is system owner
 */
const verifyIsSystemOwner = async (): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;

    if (!currentUser) return false;

    const { userService } = await import("./userService");
    const userData = await userService.getUserById(currentUser.uid);

    return userData?.role === "system-owner";
  } catch (error) {
    console.error("Error verifying super admin status:", error);

    return false;
  }
};

/**
 * Service for managing clinic data in Firestore
 */
export const clinicService = {
  /**
   * Create a new clinic with automatic RBAC setup
   * @param {Partial<Clinic>} clinicData - Data for the new clinic
   * @param {string} adminEmail - Email for the clinic admin user
   * @param {string} adminName - Name for the clinic admin user
   * @returns {Promise<{clinicId: string, adminUserId: string}>} - IDs of created clinic and admin user
   */
  async createClinic(
    clinicData: Partial<Clinic>,
    adminEmail?: string,
    adminName?: string,
  ): Promise<string | { clinicId: string; adminUserId: string }> {
    try {
      // Create the clinic first
      const clinicsRef = collection(db, CLINICS_COLLECTION);

      // Filter out undefined values to avoid Firestore errors
      const cleanedClinicData = Object.fromEntries(
        Object.entries({
          ...clinicData,
          subscriptionStatus: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).filter(([_, value]) => value !== undefined),
      );

      const docRef = await addDoc(clinicsRef, cleanedClinicData);

      const clinicId = docRef.id;

      // If admin details provided, set up RBAC system
      if (adminEmail && adminName) {
        const { rbacService } = await import("./rbacService");
        const { userService } = await import("./userService");

        // Create default clinic admin role with all available pages
        const adminRoleId =
          await rbacService.createDefaultClinicAdminRole(clinicId);

        // Create other default roles
        await rbacService.createDefaultClinicRoles(clinicId);

        // Create clinic admin user
        const temporaryPassword = "ClinicAdmin123!"; // User will get password reset email

        const adminUserId = await userService.createUser(
          adminEmail,
          temporaryPassword,
          {
            displayName: adminName,
            clinicId,
            role: "clinic-admin",
            isActive: true,
          },
        );

        // Assign the clinic admin role to the user
        await rbacService.assignRolesToUser(
          adminUserId,
          [adminRoleId],
          clinicId,
        );

        return { clinicId, adminUserId };
      }

      // Return just clinic ID if no admin setup requested
      return clinicId;
    } catch (error) {
      console.error("Error creating clinic:", error);
      throw error;
    }
  },

  /**
   * Get a clinic by ID
   * @param {string} id - Clinic ID
   * @returns {Promise<Clinic | null>} - Clinic data or null if not found
   */
  async getClinicById(id: string): Promise<Clinic | null> {
    try {
      const docRef = doc(db, CLINICS_COLLECTION, id);
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
        const subscriptionStartDate = data.subscriptionStartDate
          ? new Date(data.subscriptionStartDate.seconds * 1000)
          : new Date();
        const subscriptionEndDate = data.subscriptionEndDate
          ? new Date(data.subscriptionEndDate.seconds * 1000)
          : undefined;

        return {
          id: docSnap.id,
          ...data,
          createdAt,
          updatedAt,
          subscriptionStartDate,
          subscriptionEndDate,
        } as Clinic;
      }

      return null;
    } catch (error) {
      console.error("Error getting clinic:", error);
      throw error;
    }
  },

  /**
   * Get all clinics
   * @returns {Promise<Clinic[]>} - Array of all clinics
   */
  async getAllClinics(): Promise<Clinic[]> {
    try {
      const clinicsRef = collection(db, CLINICS_COLLECTION);
      const querySnapshot = await getDocs(clinicsRef);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        // Convert Firebase Timestamp objects to JavaScript Date objects
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date();
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();
        const subscriptionStartDate = data.subscriptionStartDate
          ? new Date(data.subscriptionStartDate.seconds * 1000)
          : new Date();
        const subscriptionEndDate = data.subscriptionEndDate
          ? new Date(data.subscriptionEndDate.seconds * 1000)
          : undefined;

        return {
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
          subscriptionStartDate,
          subscriptionEndDate,
        } as Clinic;
      });
    } catch (error) {
      console.error("Error getting all clinics:", error);
      throw error;
    }
  },

  /**
   * Update a clinic's information
   * @param {string} id - Clinic ID
   * @param {Partial<Clinic>} updateData - Updated clinic data
   * @returns {Promise<void>}
   */
  async updateClinic(id: string, updateData: Partial<Clinic>): Promise<void> {
    try {
      const docRef = doc(db, CLINICS_COLLECTION, id);

      // Filter out undefined values to avoid Firestore errors
      const cleanedUpdateData = Object.fromEntries(
        Object.entries({
          ...updateData,
          updatedAt: serverTimestamp(),
        }).filter(([_, value]) => value !== undefined),
      );

      await setDoc(docRef, cleanedUpdateData, { merge: true });
    } catch (error) {
      console.error("Error updating clinic:", error);
      throw error;
    }
  },

  /**
   * Update a clinic's subscription status
   * @param {string} id - Clinic ID
   * @param {'active' | 'suspended' | 'cancelled'} status - New status
   * @returns {Promise<void>}
   */
  async updateSubscriptionStatus(
    id: string,
    status: "active" | "suspended" | "cancelled",
  ): Promise<void> {
    try {
      const docRef = doc(db, CLINICS_COLLECTION, id);

      // Filter out undefined values to avoid Firestore errors
      const cleanedUpdateData = Object.fromEntries(
        Object.entries({
          subscriptionStatus: status,
          updatedAt: serverTimestamp(),
        }).filter(([_, value]) => value !== undefined),
      );

      await updateDoc(docRef, cleanedUpdateData);
    } catch (error) {
      console.error("Error updating subscription status:", error);
      throw error;
    }
  },

  /**
   * Delete a clinic (simple - only clinic document)
   */
  async deleteClinic(id: string): Promise<void> {
    try {
      const docRef = doc(db, CLINICS_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting clinic:", error);
      throw error;
    }
  },

  /**
   * Get print layout configuration for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<PrintLayoutConfig | null>} - Print layout configuration or null if not found
   */
  async getPrintLayoutConfig(
    clinicId: string,
  ): Promise<PrintLayoutConfig | null> {
    try {
      const docRef = doc(db, "clinic_print_layouts", clinicId);
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
        } as PrintLayoutConfig;
      }

      return null;
    } catch (error) {
      console.error("Error getting print layout config:", error);
      throw error;
    }
  },

  /**
   * Save print layout configuration for a clinic
   * @param {any} configData - Print layout configuration data
   * @returns {Promise<void>}
   */
  async savePrintLayoutConfig(configData: PrintLayoutConfig): Promise<void> {
    try {
      const docRef = doc(db, "clinic_print_layouts", configData.clinicId);

      // Filter out undefined values to avoid Firestore errors
      const cleanedConfigData = Object.fromEntries(
        Object.entries({
          ...configData,
          updatedAt: serverTimestamp(),
          createdAt: configData.createdAt || serverTimestamp(),
        }).filter(([_, value]) => value !== undefined),
      );

      await setDoc(docRef, cleanedConfigData, { merge: true });
    } catch (error) {
      console.error("Error saving print layout config:", error);
      throw error;
    }
  },

  /**
   * Delete print layout configuration for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<void>}
   */
  async deletePrintLayoutConfig(clinicId: string): Promise<void> {
    try {
      const docRef = doc(db, "clinic_print_layouts", clinicId);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting print layout config:", error);
      throw error;
    }
  },

  /**
   * Enable multi-branch functionality for a clinic
   * @param {string} clinicId - Clinic ID
   * @param {number} maxBranches - Maximum number of branches allowed
   */
  async enableMultiBranch(
    clinicId: string,
    maxBranches?: number,
  ): Promise<void> {
    try {
      const docRef = doc(db, CLINICS_COLLECTION, clinicId);

      await updateDoc(docRef, {
        isMultiBranchEnabled: true,
        maxBranches: maxBranches || 5, // Default to 5 if not provided
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error enabling multi-branch:", error);
      throw error;
    }
  },

  /**
   * Disable multi-branch functionality for a clinic
   */
  async disableMultiBranch(clinicId: string): Promise<void> {
    try {
      const docRef = doc(db, CLINICS_COLLECTION, clinicId);

      await updateDoc(docRef, {
        isMultiBranchEnabled: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error disabling multi-branch:", error);
      throw error;
    }
  },
};
