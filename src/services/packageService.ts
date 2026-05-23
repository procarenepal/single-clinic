import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { TreatmentPackage } from "../types/models";

const PACKAGES_COLLECTION = "treatmentPackages";

export const packageService = {
  /**
   * Get all active packages for a clinic
   */
  async getPackagesByClinic(clinicId: string, branchId?: string): Promise<TreatmentPackage[]> {
    try {
      const constraints = [
        where("clinicId", "==", clinicId),
        where("isActive", "==", true)
      ];
      
      if (branchId) {
        constraints.push(where("branchId", "==", branchId));
      }

      const q = query(collection(db, PACKAGES_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as TreatmentPackage;
      });
    } catch (error) {
      console.error("Error fetching packages:", error);
      throw error;
    }
  },

  /**
   * Create a new package
   */
  async createPackage(pkgData: Omit<TreatmentPackage, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const now = new Date();
      const data = {
        ...pkgData,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      const docRef = await addDoc(collection(db, PACKAGES_COLLECTION), data);
      return docRef.id;
    } catch (error) {
      console.error("Error creating package:", error);
      throw error;
    }
  },

  /**
   * Update an existing package
   */
  async updatePackage(id: string, updates: Partial<TreatmentPackage>): Promise<void> {
    try {
      const docRef = doc(db, PACKAGES_COLLECTION, id);
      const data = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      // Remove id if present to avoid storing it in the document
      delete (data as any).id;
      
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Error updating package:", error);
      throw error;
    }
  },

  /**
   * Delete a package (soft delete by setting isActive = false)
   */
  async deletePackage(id: string): Promise<void> {
    try {
      const docRef = doc(db, PACKAGES_COLLECTION, id);
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error deleting package:", error);
      throw error;
    }
  }
};
