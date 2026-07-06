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
import { Doctor } from "../types/models";

import { cacheService } from "@/services/cacheService";

const DOCTORS_COLLECTION = "doctors";

/**
 * Service for managing doctor data in Firestore
 */
export const doctorService = {
  // Deduplicate in-flight fetches per key
  __inflight: new Map<string, Promise<any[]>>(),
  /**
   * Create a new doctor
   * @param {Partial<Doctor>} doctorData - Data for the new doctor
   * @returns {Promise<string>} - ID of the created doctor
   */
  async createDoctor(doctorData: Partial<Doctor>): Promise<string> {
    try {
      const doctorsRef = collection(db, DOCTORS_COLLECTION);
      const docRef = await addDoc(doctorsRef, {
        ...doctorData,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (doctorData.clinicId) {
        cacheService.invalidateClinicDoctors(doctorData.clinicId);
      }

      return docRef.id;
    } catch (error) {
      console.error("Error creating doctor:", error);
      throw error;
    }
  },

  /**
   * Get a doctor by ID
   * @param {string} id - Doctor ID
   * @returns {Promise<Doctor | null>} - Doctor data or null if not found
   */
  async getDoctorById(id: string): Promise<Doctor | null> {
    try {
      const docRef = doc(db, DOCTORS_COLLECTION, id);
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
        } as Doctor;
      }

      return null;
    } catch (error) {
      console.error("Error getting doctor:", error);
      throw error;
    }
  },

  /**
   * Update a doctor
   * @param {string} id - Doctor ID
   * @param {Partial<Doctor>} updateData - Fields to update
   * @returns {Promise<void>}
   */
  async updateDoctor(id: string, updateData: Partial<Doctor>): Promise<void> {
    try {
      const docRef = doc(db, DOCTORS_COLLECTION, id);
      
      let clinicId = updateData.clinicId;
      if (!clinicId) {
        const doctorSnap = await getDoc(docRef);
        if (doctorSnap.exists()) {
          clinicId = doctorSnap.data().clinicId;
        }
      }

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
      
      if (clinicId) {
        cacheService.invalidateClinicDoctors(clinicId);
      }
    } catch (error) {
      console.error("Error updating doctor:", error);
      throw error;
    }
  },

  /**
   * Get all doctors for a clinic (excluding deleted doctors).
   * Optionally filter by branch for branch-aware views.
   * @param {string} clinicId - Clinic ID
   * @param {string} [branchId] - Optional branch ID to filter doctors by
   * @returns {Promise<Doctor[]>} - Array of doctors (excluding deleted)
   */
  async getDoctors(clinicId?: string): Promise<Doctor[]> {
    try {
      const cacheKey = clinicId || "standalone";
      const cached = cacheService.getClinicDoctors(cacheKey);

      if (cached) return cached as Doctor[];

      const doctorsRef = collection(db, DOCTORS_COLLECTION);
      const constraints: any[] = [];

      if (clinicId && clinicId !== "standalone" && clinicId !== "default") {
        constraints.push(where("clinicId", "==", clinicId));
      }
      const q = query(doctorsRef, ...constraints);

      const querySnapshot = await getDocs(q);

      const doctors = querySnapshot.docs
        .map((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt
            ? new Date(data.createdAt.seconds * 1000)
            : new Date();
          const updatedAt = data.updatedAt
            ? new Date(data.updatedAt.seconds * 1000)
            : new Date();

          return {
            id: doc.id,
            ...data,
            createdAt,
            updatedAt,
          } as Doctor;
        })
        .filter((doctor) => !doctor.isDeleted);

      cacheService.setClinicDoctors(cacheKey, doctors);

      return doctors;
    } catch (error) {
      console.error("Error getting doctors:", error);
      throw error;
    }
  },

  /**
   * Alias for backward compatibility
   */
  async getDoctorsByClinic(
    clinicId?: string,
    _branchId?: string,
  ): Promise<Doctor[]> {
    return this.getDoctors(clinicId);
  },

  /**
   * Get a doctor by email within a clinic (more efficient than fetching all doctors)
   */
  async getDoctorByEmail(
    email: string,
    _clinicId?: string,
  ): Promise<Doctor | null> {
    try {
      const doctorsRef = collection(db, DOCTORS_COLLECTION);
      const qy = query(doctorsRef, where("email", "==", email.toLowerCase()));
      const snap = await getDocs(qy);

      if (snap.empty) return null;
      const first = snap.docs[0];
      const data = first.data();
      const createdAt = data.createdAt
        ? new Date(data.createdAt.seconds * 1000)
        : new Date();
      const updatedAt = data.updatedAt
        ? new Date(data.updatedAt.seconds * 1000)
        : new Date();

      return { id: first.id, ...data, createdAt, updatedAt } as Doctor;
    } catch (error) {
      console.error("Error getting doctor by email:", error);

      return null;
    }
  },

  /**
   * Search doctors by name, speciality, or NMC number
   * @param {string} searchTerm - Search term
   * @param {string} [clinicId] - Optional Clinic ID for backward compatibility
   * @returns {Promise<Doctor[]>} - Array of matching doctors
   */
  async searchDoctors(
    searchTerm: string,
    clinicId?: string,
  ): Promise<Doctor[]> {
    try {
      const doctors = await this.getDoctors();

      if (!searchTerm) {
        return doctors;
      }

      const term = searchTerm.toLowerCase();

      return doctors.filter(
        (doctor) =>
          doctor.name.toLowerCase().includes(term) ||
          doctor.speciality.toLowerCase().includes(term) ||
          doctor.nmcNumber.toLowerCase().includes(term) ||
          (doctor.email && doctor.email.toLowerCase().includes(term)),
      );
    } catch (error) {
      console.error("Error searching doctors:", error);
      throw error;
    }
  },

  /**
   * Toggle doctor active status
   * @param {string} id - Doctor ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<void>}
   */
  async toggleDoctorStatus(id: string, isActive: boolean): Promise<void> {
    try {
      await this.updateDoctor(id, { isActive });
    } catch (error) {
      console.error("Error toggling doctor status:", error);
      throw error;
    }
  },

  /**
   * Delete a doctor (soft delete - sets isDeleted to true)
   * Deleted doctors won't show in the list, but inactive doctors will still show
   * @param {string} id - Doctor ID
   * @returns {Promise<void>}
   */
  async deleteDoctor(id: string): Promise<void> {
    try {
      // Get doctor first to get clinicId for cache clearing
      const doctor = await this.getDoctorById(id);

      if (!doctor) {
        throw new Error("Doctor not found");
      }

      await this.updateDoctor(id, { isDeleted: true });

      // Clear cache to force refresh on next load
      if (doctor.clinicId) {
        const key = `clinic:${doctor.clinicId}`;

        this.__inflight.delete(key);
        // Clear from cache service by setting empty array (will be refreshed on next load)
        cacheService.setClinicDoctors(doctor.clinicId, []);
      }
    } catch (error) {
      console.error("Error deleting doctor:", error);
      throw error;
    }
  },
};
