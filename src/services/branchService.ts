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
  orderBy,
  limit,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { Branch } from "../types/models";

const BRANCHES_COLLECTION = "branches";

/**
 * Service for managing clinic branches
 */
export const branchService = {
  /**
   * Create a new branch for a clinic
   * @param {Partial<Branch>} branchData - Data for the new branch
   * @returns {Promise<string>} - ID of the created branch
   */
  async createBranch(branchData: Partial<Branch>): Promise<string> {
    try {
      const clinicRef = doc(db, "clinics", branchData.clinicId!);
      const clinicSnap = await getDoc(clinicRef);

      if (!clinicSnap.exists()) {
        throw new Error("Clinic not found");
      }

      const clinicData = clinicSnap.data();

      if (!clinicData.isMultiBranchEnabled) {
        throw new Error("Multi-branch feature is not enabled for this clinic");
      }

      const branchesRef = collection(db, BRANCHES_COLLECTION);

      // Filter out undefined values to avoid Firestore errors
      const cleanedBranchData = Object.fromEntries(
        Object.entries({
          ...branchData,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).filter(([_, value]) => value !== undefined),
      );

      const docRef = await addDoc(branchesRef, cleanedBranchData);

      return docRef.id;
    } catch (error) {
      console.error("Error creating branch:", error);
      throw error;
    }
  },

  /**
   * Get a branch by ID
   * @param {string} id - Branch ID
   * @returns {Promise<Branch | null>} - Branch data or null if not found
   */
  async getBranchById(id: string): Promise<Branch | null> {
    try {
      const docRef = doc(db, BRANCHES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Branch;
      }

      return null;
    } catch (error) {
      console.error("Error getting branch:", error);
      throw error;
    }
  },

  /**
   * Get all branches for a clinic
   * @param {string} clinicId - Clinic ID
   * @param {boolean} activeOnly - Whether to return only active branches
   * @returns {Promise<Branch[]>} - Array of branches
   */
  async getClinicBranches(
    _clinicId?: string,
    activeOnly = true,
  ): Promise<Branch[]> {
    try {
      const branchesCollection = collection(db, BRANCHES_COLLECTION);
      let q = query(branchesCollection);

      if (activeOnly) {
        q = query(branchesCollection, where("isActive", "==", true));
      }

      const querySnapshot = await getDocs(q);

      const branches = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Branch;
      });

      // Sort client-side: Main branch first, then alphabetically by name
      return branches.sort((a, b) => {
        if (a.isMainBranch && !b.isMainBranch) return -1;
        if (!a.isMainBranch && b.isMainBranch) return 1;

        return (a.name || "").localeCompare(b.name || "");
      });
    } catch (error) {
      console.error("Error getting clinic branches:", error);
      throw error;
    }
  },

  /**
   * Get the main branch for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<Branch | null>} - Main branch or null if not found
   */
  async getMainBranch(_clinicId?: string): Promise<Branch | null> {
    try {
      const q = query(
        collection(db, BRANCHES_COLLECTION),
        where("isMainBranch", "==", true),
        where("isActive", "==", true),
        limit(1),
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Branch;
      }

      return null;
    } catch (error) {
      console.error("Error getting main branch:", error);
      throw error;
    }
  },

  /**
   * Update a branch's information
   * @param {string} id - Branch ID
   * @param {Partial<Branch>} updateData - Updated branch data
   * @returns {Promise<void>}
   */
  async updateBranch(id: string, updateData: Partial<Branch>): Promise<void> {
    try {
      // If updating branch code, validate uniqueness
      if (updateData.code) {
        const branchRef = doc(db, BRANCHES_COLLECTION, id);
        const branchSnap = await getDoc(branchRef);

        if (!branchSnap.exists()) {
          throw new Error("Branch not found");
        }

        const branchData = branchSnap.data();
        const codeQuery = query(
          collection(db, BRANCHES_COLLECTION),
          where("code", "==", updateData.code),
        );
        const codeSnap = await getDocs(codeQuery);

        // Check if code exists and belongs to a different branch
        if (!codeSnap.empty && codeSnap.docs[0].id !== id) {
          throw new Error("Branch code already exists for this clinic");
        }
      }

      const docRef = doc(db, BRANCHES_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating branch:", error);
      throw error;
    }
  },

  /**
   * Deactivate a branch (soft delete)
   * @param {string} id - Branch ID
   * @returns {Promise<void>}
   */
  async deactivateBranch(id: string): Promise<void> {
    try {
      const branchRef = doc(db, BRANCHES_COLLECTION, id);
      const branchSnap = await getDoc(branchRef);

      if (!branchSnap.exists()) {
        throw new Error("Branch not found");
      }

      const branchData = branchSnap.data();

      // Don't allow deactivating the main branch if it's the only active branch
      if (branchData.isMainBranch) {
        const activeBranchesQuery = query(
          collection(db, BRANCHES_COLLECTION),
          where("isActive", "==", true),
        );
        const activeBranchesSnap = await getDocs(activeBranchesQuery);

        if (activeBranchesSnap.size <= 1) {
          throw new Error(
            "Cannot deactivate the main branch when it is the only active branch",
          );
        }
      }

      await updateDoc(branchRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });

      // Update clinic's total branches count
      const clinicRef = doc(db, "clinics", branchData.clinicId);
      const clinicSnap = await getDoc(clinicRef);

      if (clinicSnap.exists()) {
        const clinicData = clinicSnap.data();

        await updateDoc(clinicRef, {
          totalBranches: Math.max((clinicData.totalBranches || 1) - 1, 0),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error deactivating branch:", error);
      throw error;
    }
  },

  /**
   * Set a branch as the main branch
   * @param {string} branchId - Branch ID to set as main
   * @returns {Promise<void>}
   */
  async setMainBranch(branchId: string): Promise<void> {
    try {
      const branchRef = doc(db, BRANCHES_COLLECTION, branchId);
      const branchSnap = await getDoc(branchRef);

      if (!branchSnap.exists()) {
        throw new Error("Branch not found");
      }

      const branchData = branchSnap.data();

      // First, unset the current main branch
      const currentMainQuery = query(
        collection(db, BRANCHES_COLLECTION),
        where("isMainBranch", "==", true),
      );
      const currentMainSnap = await getDocs(currentMainQuery);

      // Update all current main branches to not be main
      const batch = await import("firebase/firestore").then((m) =>
        m.writeBatch(db),
      );

      currentMainSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          isMainBranch: false,
          updatedAt: serverTimestamp(),
        });
      });

      // Set the new main branch
      batch.update(branchRef, {
        isMainBranch: true,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (error) {
      console.error("Error setting main branch:", error);
      throw error;
    }
  },

  /**
   * Check if a clinic has multi-branch enabled
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<boolean>} - Whether multi-branch is enabled
   */
  async isMultiBranchEnabled(_clinicId?: string): Promise<boolean> {
    try {
      const cid = _clinicId || "standalone";
      const clinicRef = doc(db, "clinics", cid);
      const clinicSnap = await getDoc(clinicRef);

      if (clinicSnap.exists()) {
        return clinicSnap.data().isMultiBranchEnabled || false;
      }

      return false;
    } catch (error) {
      console.error("Error checking multi-branch status:", error);

      return false;
    }
  },

  /**
   * Create a default main branch for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<string>} - ID of the created main branch
   */
  async createDefaultMainBranch(clinicId: string): Promise<string> {
    try {
      const clinicRef = doc(db, "clinics", clinicId);
      const clinicSnap = await getDoc(clinicRef);

      if (!clinicSnap.exists()) {
        throw new Error("Clinic not found");
      }

      const clinicData = clinicSnap.data();

      const branchData = {
        clinicId,
        name: "Main Branch",
        code: "MAIN",
        address: clinicData.address || "Main Address",
        city: clinicData.city || "Default City",
        phone: clinicData.phone || "",
        email: clinicData.email || "",
        isMainBranch: true,
        isActive: true,
        createdBy: "system", // System created
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      return await this.createBranch(branchData);
    } catch (error) {
      console.error("Error creating default main branch:", error);
      throw error;
    }
  },

  /**
   * Get branches with admin information
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<Array>} - Array of branches with admin information
   */
  async getBranchesWithAdmins(
    clinicId: string,
  ): Promise<Array<Branch & { admin?: any }>> {
    try {
      const branches = await this.getClinicBranches(clinicId, false);

      // Import userService here to avoid circular dependency
      const { userService } = await import("./userService");

      // Get admin information for each branch
      const branchesWithAdmins = await Promise.all(
        branches.map(async (branch) => {
          try {
            const admin = await userService.getBranchAdmin(branch.id);

            return {
              ...branch,
              admin: admin,
            };
          } catch (error) {
            console.error(
              `Error getting admin for branch ${branch.id}:`,
              error,
            );

            return {
              ...branch,
              admin: null,
            };
          }
        }),
      );

      return branchesWithAdmins;
    } catch (error) {
      console.error("Error getting branches with admins:", error);
      throw error;
    }
  },
};
