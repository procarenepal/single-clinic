import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { Clinic } from "../types/models";

import { PrintLayoutConfig } from "@/types/printLayout";

const CLINICS_COLLECTION = "clinics";

/**
 * Service for managing clinic data in Firestore
 */
export const clinicService = {
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
};
