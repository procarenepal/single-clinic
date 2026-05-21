import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { Bed, BedCategory, BedAllotment } from "../types/models";

const BED_CATEGORIES_COLLECTION = "bedCategories";
const BEDS_COLLECTION = "beds";
const BED_ALLOTMENTS_COLLECTION = "bedAllotments";

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
 * Service for managing bed data
 */
export const bedService = {
  // ============= BED CATEGORIES =============

  /**
   * Get all bed categories for a specific clinic
   */
  async getCategoriesByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<BedCategory[]> {
    try {
      const categoriesRef = collection(db, BED_CATEGORIES_COLLECTION);
      const constraints: any[] = [
        where("clinicId", "==", clinicId),
        where("isActive", "==", true),
      ];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(categoriesRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const categories: BedCategory[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as BedCategory;
      });

      // Sort by name in memory
      return categories.sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );
    } catch (error) {
      console.error("Error getting bed categories by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a bed category by ID
   */
  async getCategoryById(id: string): Promise<BedCategory | null> {
    try {
      const categoryRef = doc(db, BED_CATEGORIES_COLLECTION, id);
      const categorySnap = await getDoc(categoryRef);

      if (categorySnap.exists()) {
        const data = categorySnap.data();

        return {
          id: categorySnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as BedCategory;
      }

      return null;
    } catch (error) {
      console.error("Error getting bed category by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new bed category
   */
  async createCategory(
    categoryData: Omit<BedCategory, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const categoriesRef = collection(db, BED_CATEGORIES_COLLECTION);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...categoryData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(categoriesRef, data);

      console.log("Bed category created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating bed category:", error);
      throw error;
    }
  },

  /**
   * Update a bed category
   */
  async updateCategory(
    id: string,
    categoryData: Partial<Omit<BedCategory, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const categoryRef = doc(db, BED_CATEGORIES_COLLECTION, id);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...categoryData,
        updatedAt: now,
      });

      await updateDoc(categoryRef, data);
      console.log("Bed category updated successfully");
    } catch (error) {
      console.error("Error updating bed category:", error);
      throw error;
    }
  },

  /**
   * Delete a bed category (soft delete)
   */
  async deleteCategory(id: string): Promise<void> {
    try {
      const categoryRef = doc(db, BED_CATEGORIES_COLLECTION, id);

      await updateDoc(categoryRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
      });
      console.log("Bed category deleted successfully");
    } catch (error) {
      console.error("Error deleting bed category:", error);
      throw error;
    }
  },

  // ============= BEDS =============

  /**
   * Get all beds for a specific clinic
   */
  async getBedsByClinic(clinicId: string, branchId?: string): Promise<Bed[]> {
    try {
      const bedsRef = collection(db, BEDS_COLLECTION);
      const constraints: any[] = [
        where("clinicId", "==", clinicId),
        where("isActive", "==", true),
      ];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(bedsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const beds: Bed[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Bed;
      });

      // Sort by bedNumber in memory
      return beds.sort((a, b) =>
        (a.bedNumber || "").localeCompare(b.bedNumber || ""),
      );
    } catch (error) {
      console.error("Error getting beds by clinic:", error);
      throw error;
    }
  },

  /**
   * Get available beds for a specific clinic
   */
  async getAvailableBedsByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<Bed[]> {
    try {
      const bedsRef = collection(db, BEDS_COLLECTION);
      const constraints: any[] = [
        where("clinicId", "==", clinicId),
        where("status", "==", "available"),
        where("isActive", "==", true),
      ];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(bedsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const beds: Bed[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Bed;
      });

      // Sort by bedNumber in memory
      return beds.sort((a, b) =>
        (a.bedNumber || "").localeCompare(b.bedNumber || ""),
      );
    } catch (error) {
      console.error("Error getting available beds by clinic:", error);
      throw error;
    }
  },

  /**
   * Get a bed by ID
   */
  async getBedById(id: string): Promise<Bed | null> {
    try {
      const bedRef = doc(db, BEDS_COLLECTION, id);
      const bedSnap = await getDoc(bedRef);

      if (bedSnap.exists()) {
        const data = bedSnap.data();

        return {
          id: bedSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Bed;
      }

      return null;
    } catch (error) {
      console.error("Error getting bed by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new bed
   */
  async createBed(
    bedData: Omit<Bed, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const bedsRef = collection(db, BEDS_COLLECTION);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...bedData,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const docRef = await addDoc(bedsRef, data);

      console.log("Bed created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating bed:", error);
      throw error;
    }
  },

  /**
   * Update a bed
   */
  async updateBed(
    id: string,
    bedData: Partial<Omit<Bed, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      const bedRef = doc(db, BEDS_COLLECTION, id);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...bedData,
        updatedAt: now,
      });

      await updateDoc(bedRef, data);
      console.log("Bed updated successfully");
    } catch (error) {
      console.error("Error updating bed:", error);
      throw error;
    }
  },

  /**
   * Update bed status
   */
  async updateBedStatus(
    id: string,
    status: "available" | "occupied" | "maintenance",
  ): Promise<void> {
    try {
      const bedRef = doc(db, BEDS_COLLECTION, id);

      await updateDoc(bedRef, {
        status,
        updatedAt: Timestamp.now(),
      });
      console.log("Bed status updated successfully");
    } catch (error) {
      console.error("Error updating bed status:", error);
      throw error;
    }
  },

  /**
   * Delete a bed (soft delete)
   */
  async deleteBed(id: string): Promise<void> {
    try {
      const bedRef = doc(db, BEDS_COLLECTION, id);

      await updateDoc(bedRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
      });
      console.log("Bed deleted successfully");
    } catch (error) {
      console.error("Error deleting bed:", error);
      throw error;
    }
  },

  // ============= BED ALLOTMENTS =============

  /**
   * Get all bed allotments for a specific clinic
   */
  async getAllotmentsByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<BedAllotment[]> {
    try {
      const allotmentsRef = collection(db, BED_ALLOTMENTS_COLLECTION);
      const constraints: any[] = [where("clinicId", "==", clinicId)];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(allotmentsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const allotments: BedAllotment[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          allotmentDate: data.allotmentDate?.toDate(),
          dischargeDate: data.dischargeDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as BedAllotment;
      });

      // Sort by createdAt desc in memory
      return allotments.sort((a, b) => {
        const dateA = a.createdAt
          ? a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime()
          : 0;
        const dateB = b.createdAt
          ? b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime()
          : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting bed allotments by clinic:", error);
      throw error;
    }
  },

  /**
   * Get active bed allotments for a specific clinic
   */
  async getActiveAllotmentsByClinic(
    clinicId: string,
    branchId?: string,
  ): Promise<BedAllotment[]> {
    try {
      const allotmentsRef = collection(db, BED_ALLOTMENTS_COLLECTION);
      const constraints: any[] = [
        where("clinicId", "==", clinicId),
        where("status", "==", "active"),
      ];

      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(allotmentsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const allotments: BedAllotment[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          allotmentDate: data.allotmentDate?.toDate(),
          dischargeDate: data.dischargeDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as BedAllotment;
      });

      // Sort by createdAt desc in memory
      return allotments.sort((a, b) => {
        const dateA = a.createdAt
          ? a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime()
          : 0;
        const dateB = b.createdAt
          ? b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime()
          : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting active bed allotments by clinic:", error);
      throw error;
    }
  },

  /**
   * Get bed allotments for a specific bed
   */
  async getAllotmentsByBed(bedId: string): Promise<BedAllotment[]> {
    try {
      const allotmentsRef = collection(db, BED_ALLOTMENTS_COLLECTION);
      const q = query(allotmentsRef, where("bedId", "==", bedId));

      const querySnapshot = await getDocs(q);
      const allotments: BedAllotment[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          allotmentDate: data.allotmentDate?.toDate(),
          dischargeDate: data.dischargeDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as BedAllotment;
      });

      // Sort by createdAt desc in memory
      return allotments.sort((a, b) => {
        const dateA = a.createdAt
          ? a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime()
          : 0;
        const dateB = b.createdAt
          ? b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime()
          : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting bed allotments by bed:", error);
      throw error;
    }
  },

  /**
   * Get bed allotments for a specific patient
   */
  async getAllotmentsByPatient(patientId: string): Promise<BedAllotment[]> {
    try {
      const allotmentsRef = collection(db, BED_ALLOTMENTS_COLLECTION);
      const q = query(allotmentsRef, where("patientId", "==", patientId));

      const querySnapshot = await getDocs(q);
      const allotments: BedAllotment[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          allotmentDate: data.allotmentDate?.toDate(),
          dischargeDate: data.dischargeDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as BedAllotment;
      });

      // Sort by createdAt desc in memory
      return allotments.sort((a, b) => {
        const dateA = a.createdAt
          ? a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime()
          : 0;
        const dateB = b.createdAt
          ? b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime()
          : 0;

        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting bed allotments by patient:", error);
      throw error;
    }
  },

  /**
   * Get a bed allotment by ID
   */
  async getAllotmentById(id: string): Promise<BedAllotment | null> {
    try {
      const allotmentRef = doc(db, BED_ALLOTMENTS_COLLECTION, id);
      const allotmentSnap = await getDoc(allotmentRef);

      if (allotmentSnap.exists()) {
        const data = allotmentSnap.data();

        return {
          id: allotmentSnap.id,
          ...data,
          allotmentDate: data.allotmentDate?.toDate(),
          dischargeDate: data.dischargeDate?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as BedAllotment;
      }

      return null;
    } catch (error) {
      console.error("Error getting bed allotment by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new bed allotment (also updates bed status to 'occupied')
   */
  async createAllotment(
    allotmentData: Omit<BedAllotment, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      const allotmentsRef = collection(db, BED_ALLOTMENTS_COLLECTION);
      const now = Timestamp.now();

      const data = removeUndefinedFields({
        ...allotmentData,
        status: "active",
        createdAt: now,
        updatedAt: now,
        allotmentDate: Timestamp.fromDate(allotmentData.allotmentDate),
        dischargeDate: allotmentData.dischargeDate
          ? Timestamp.fromDate(allotmentData.dischargeDate)
          : undefined,
      });

      const docRef = await addDoc(allotmentsRef, data);

      // Update bed status to 'occupied'
      await this.updateBedStatus(allotmentData.bedId, "occupied");

      console.log("Bed allotment created with ID:", docRef.id);

      return docRef.id;
    } catch (error) {
      console.error("Error creating bed allotment:", error);
      throw error;
    }
  },

  /**
   * Update a bed allotment
   */
  async updateAllotment(
    id: string,
    allotmentData: Partial<
      Omit<BedAllotment, "id" | "createdAt" | "updatedAt">
    >,
  ): Promise<void> {
    try {
      const allotmentRef = doc(db, BED_ALLOTMENTS_COLLECTION, id);
      const now = Timestamp.now();

      const data: any = {
        ...allotmentData,
        updatedAt: now,
      };

      // Convert dates to Timestamps if present
      if (allotmentData.allotmentDate) {
        data.allotmentDate = Timestamp.fromDate(allotmentData.allotmentDate);
      }
      if (allotmentData.dischargeDate !== undefined) {
        data.dischargeDate = allotmentData.dischargeDate
          ? Timestamp.fromDate(allotmentData.dischargeDate)
          : null;
      }

      const cleanedData = removeUndefinedFields(data);

      await updateDoc(allotmentRef, cleanedData);
      console.log("Bed allotment updated successfully");
    } catch (error) {
      console.error("Error updating bed allotment:", error);
      throw error;
    }
  },

  /**
   * Discharge a bed allotment (updates bed status to 'available')
   */
  async dischargeAllotment(id: string, dischargeDate: Date): Promise<void> {
    try {
      const allotmentRef = doc(db, BED_ALLOTMENTS_COLLECTION, id);
      const allotmentSnap = await getDoc(allotmentRef);

      if (!allotmentSnap.exists()) {
        throw new Error("Bed allotment not found");
      }

      const allotment = allotmentSnap.data() as BedAllotment;

      // Update allotment status and discharge date
      await updateDoc(allotmentRef, {
        status: "discharged",
        dischargeDate: Timestamp.fromDate(dischargeDate),
        updatedAt: Timestamp.now(),
      });

      // Update bed status to 'available'
      await this.updateBedStatus(allotment.bedId, "available");

      console.log("Bed allotment discharged successfully");
    } catch (error) {
      console.error("Error discharging bed allotment:", error);
      throw error;
    }
  },

  /**
   * Delete a bed allotment (updates bed status back to 'available')
   */
  async deleteAllotment(id: string): Promise<void> {
    try {
      const allotmentRef = doc(db, BED_ALLOTMENTS_COLLECTION, id);
      const allotmentSnap = await getDoc(allotmentRef);

      if (!allotmentSnap.exists()) {
        throw new Error("Bed allotment not found");
      }

      const allotment = allotmentSnap.data() as BedAllotment;

      // Delete the allotment
      await deleteDoc(allotmentRef);

      // Update bed status to 'available' if it was active
      if (allotment.status === "active") {
        await this.updateBedStatus(allotment.bedId, "available");
      }

      console.log("Bed allotment deleted successfully");
    } catch (error) {
      console.error("Error deleting bed allotment:", error);
      throw error;
    }
  },
};
