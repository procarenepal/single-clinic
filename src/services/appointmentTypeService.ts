import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { AppointmentType } from "../types/models";

import { cacheService } from "@/services/cacheService";

const APPOINTMENT_TYPES_COLLECTION = "appointment_types";

/**
 * Service for managing appointment type data in Firestore
 */
export const appointmentTypeService = {
  /**
   * Create a new appointment type
   * @param {Partial<AppointmentType>} appointmentTypeData - Data for the new appointment type
   * @returns {Promise<string>} - ID of the created appointment type
   */
  async createAppointmentType(
    appointmentTypeData: Partial<AppointmentType>,
  ): Promise<string> {
    try {
      const appointmentTypesRef = collection(db, APPOINTMENT_TYPES_COLLECTION);
      const docRef = await addDoc(appointmentTypesRef, {
        ...appointmentTypeData,
        color: appointmentTypeData.color || "none", // Default to "none" if no color provided
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error creating appointment type:", error);
      throw error;
    }
  },

  /**
   * Get an appointment type by ID
   * @param {string} id - Appointment type ID
   * @returns {Promise<AppointmentType | null>} - Appointment type data or null if not found
   */
  async getAppointmentTypeById(id: string): Promise<AppointmentType | null> {
    try {
      const docRef = doc(db, APPOINTMENT_TYPES_COLLECTION, id);
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
        } as AppointmentType;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error getting appointment type by ID:", error);
      throw error;
    }
  },

  /**
   * Get all appointment types (excluding deleted)
   */
  async getAppointmentTypes(clinicId?: string): Promise<AppointmentType[]> {
    try {
      const cacheKey = clinicId || "standalone";
      const cached = cacheService.getClinicAppointmentTypes(cacheKey);
      if (cached) return cached as AppointmentType[];

      const appointmentTypesRef = collection(db, APPOINTMENT_TYPES_COLLECTION);
      // For single clinic, we fetch all if clinicId is not provided or if we want to be inclusive
      const q = clinicId 
        ? query(appointmentTypesRef, where("clinicId", "==", clinicId))
        : query(appointmentTypesRef);
        
      const querySnapshot = await getDocs(q);

      const appointmentTypes: AppointmentType[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date();
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();

        appointmentTypes.push({
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
        } as AppointmentType);
      });

      cacheService.setClinicAppointmentTypes(cacheKey, appointmentTypes);
      return appointmentTypes;
    } catch (error) {
      console.error("Error getting appointment types:", error);
      throw error;
    }
  },

  /**
   * Alias for backward compatibility
   */
  async getAppointmentTypesByClinic(
    clinicId?: string,
    branchId?: string,
  ): Promise<AppointmentType[]> {
    const types = await this.getAppointmentTypes(clinicId);
    if (branchId) {
      return types.filter((t) => t.branchId === branchId);
    }
    return types;
  },

  /**
   * Alias for backward compatibility
   */
  async getAppointmentTypesByClinicAndBranch(
    _clinicId: string,
    branchId: string,
  ): Promise<AppointmentType[]> {
    return this.getAppointmentTypesByClinic(_clinicId, branchId);
  },

  /**
   * Get all active appointment types
   */
  async getActiveAppointmentTypes(): Promise<AppointmentType[]> {
    const types = await this.getAppointmentTypes();
    return types.filter((t) => t.isActive);
  },

  /**
   * Alias for backward compatibility
   */
  async getActiveAppointmentTypesByClinic(
    _clinicId?: string,
    branchId?: string,
  ): Promise<AppointmentType[]> {
    const types = await this.getActiveAppointmentTypes();
    if (branchId) {
      return types.filter((t) => t.branchId === branchId);
    }
    return types;
  },

  /**
   * Alias for backward compatibility
   */
  async getActiveAppointmentTypesByClinicAndBranch(
    _clinicId: string,
    branchId: string,
  ): Promise<AppointmentType[]> {
    return this.getActiveAppointmentTypesByClinic(_clinicId, branchId);
  },

  /**
   * Update an appointment type's information
   * @param {string} id - Appointment type ID
   * @param {Partial<AppointmentType>} updateData - Updated appointment type data
   * @returns {Promise<void>}
   */
  async updateAppointmentType(
    id: string,
    updateData: Partial<AppointmentType>,
  ): Promise<void> {
    try {
      const docRef = doc(db, APPOINTMENT_TYPES_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating appointment type:", error);
      throw error;
    }
  },

  /**
   * Delete an appointment type
   * @param {string} id - Appointment type ID
   * @returns {Promise<void>}
   */
  async deleteAppointmentType(id: string): Promise<void> {
    try {
      const docRef = doc(db, APPOINTMENT_TYPES_COLLECTION, id);

      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting appointment type:", error);
      throw error;
    }
  },

  /**
   * Soft delete an appointment type (mark as inactive)
   * @param {string} id - Appointment type ID
   * @returns {Promise<void>}
   */
  async deactivateAppointmentType(id: string): Promise<void> {
    try {
      const docRef = doc(db, APPOINTMENT_TYPES_COLLECTION, id);

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error deactivating appointment type:", error);
      throw error;
    }
  },

  /**
   * Activate an appointment type (mark as active)
   * @param {string} id - Appointment type ID
   * @returns {Promise<void>}
   */
  async activateAppointmentType(id: string): Promise<void> {
    try {
      const docRef = doc(db, APPOINTMENT_TYPES_COLLECTION, id);

      await updateDoc(docRef, {
        isActive: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error activating appointment type:", error);
      throw error;
    }
  },

  /**
   * Toggle the active status of an appointment type
   * @param {string} id - Appointment type ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<void>}
   */
  async toggleAppointmentTypeStatus(
    id: string,
    isActive: boolean,
  ): Promise<void> {
    try {
      const docRef = doc(db, APPOINTMENT_TYPES_COLLECTION, id);

      await updateDoc(docRef, {
        isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error toggling appointment type status:", error);
      throw error;
    }
  },

  /**
   * Seed default appointment types for a clinic and optionally a branch
   * @param {string} clinicId - ID of the clinic
   * @param {string} branchId - ID of the branch (optional for individual clinics)
   * @param {string} createdBy - User ID who is creating the defaults
   * @returns {Promise<void>}
   */
  async seedDefaultAppointmentTypes(
    clinicId: string,
    branchId: string | null,
    createdBy: string,
  ): Promise<void> {
    try {
      const defaultTypes = [
        {
          name: "Initial Consultation",
          price: 1500, // NPR 1,500
          color: "none", // Default to no color
          clinicId,
          ...(branchId && { branchId }), // Only include branchId if provided
          createdBy,
        },
        {
          name: "Follow-up",
          price: 1000, // NPR 1,000
          color: "none", // Default to no color
          clinicId,
          ...(branchId && { branchId }), // Only include branchId if provided
          createdBy,
        },
        {
          name: "Emergency",
          price: 3000, // NPR 3,000
          color: "none", // Default to no color
          clinicId,
          ...(branchId && { branchId }), // Only include branchId if provided
          createdBy,
        },
        {
          name: "Routine Check-up",
          price: 800, // NPR 800
          color: "none", // Default to no color
          clinicId,
          ...(branchId && { branchId }), // Only include branchId if provided
          createdBy,
        },
        {
          name: "Vaccination",
          price: 500, // NPR 500
          color: "none", // Default to no color
          clinicId,
          ...(branchId && { branchId }), // Only include branchId if provided
          createdBy,
        },
      ];

      const promises = defaultTypes.map((type) =>
        this.createAppointmentType(type),
      );

      await Promise.all(promises);
    } catch (error) {
      console.error("Error seeding default appointment types:", error);
      throw error;
    }
  },
};
