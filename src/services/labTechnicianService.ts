import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { LabTechnician } from "../types/models";

const LAB_TECHNICIANS_COLLECTION = "labTechnicians";

// Helper to strip out undefined values before sending data to Firestore
function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });

  return cleaned as T;
}

/**
 * Service for managing lab technicians
 */
export const labTechnicianService = {
  /**
   * Get all lab technicians for a specific clinic
   */
  async getTechniciansByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<LabTechnician[]> {
    try {
      const techniciansRef = collection(db, LAB_TECHNICIANS_COLLECTION);
      let q = query(
        techniciansRef,
        where("clinicId", "==", clinicId),
        where("isActive", "==", true),
      );

      if (branchId) {
        q = query(
          techniciansRef,
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
          where("isActive", "==", true),
        );
      }

      const querySnapshot = await getDocs(q);
      const technicians: LabTechnician[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        technicians.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as LabTechnician);
      });

      // Sort by name ascending in memory to avoid index error
      return technicians.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting lab technicians by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a lab technician by ID
   */
  async getTechnicianById(id: string): Promise<LabTechnician | null> {
    try {
      const docRef = doc(db, LAB_TECHNICIANS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as LabTechnician;
      }

      return null;
    } catch (error) {
      console.error("Error getting lab technician by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new lab technician
   */
  async createTechnician(
    technicianData: Omit<LabTechnician, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const techniciansRef = collection(db, LAB_TECHNICIANS_COLLECTION);

      const now = Timestamp.now();
      const data = removeUndefinedFields({
        ...technicianData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(techniciansRef, data);

      console.log("Lab technician created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating lab technician:", error);
      throw error;
    }
  },

  /**
   * Update a lab technician
   */
  async updateTechnician(
    id: string,
    updates: Partial<Omit<LabTechnician, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, LAB_TECHNICIANS_COLLECTION, id);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...updates,
        updatedAt: now,
      });

      await updateDoc(docRef, data);

      console.log("Lab technician updated successfully");
    } catch (error) {
      console.error("Error updating lab technician:", error);
      throw error;
    }
  },

  /**
   * Delete a lab technician (soft delete)
   */
  async deleteTechnician(id: string): Promise<void> {
    try {
      const docRef = doc(db, LAB_TECHNICIANS_COLLECTION, id);
      const now = Timestamp.now();

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: now,
      });

      console.log("Lab technician deleted successfully");
    } catch (error) {
      console.error("Error deleting lab technician:", error);
      throw error;
    }
  },
};
