import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

import { db, auth } from "../config/firebase";
import { User } from "../types/models";

const USERS_COLLECTION = "users";
const SYSTEM_CONFIG_COLLECTION = "system_config";

/**
 * Service for handling system setup and initialization
 */
export const systemSetupService = {
  /**
   * Check if system has been initialized
   * @returns {Promise<boolean>}
   */
  async isSystemInitialized(): Promise<boolean> {
    try {
      const docRef = doc(db, SYSTEM_CONFIG_COLLECTION, "system_status");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().initialized) {
        return true;
      }

      // Also check if any super admin exists
      const superAdminExists = await this.checkSuperAdminExists();

      return superAdminExists;
    } catch (error) {
      console.error("Error checking system initialization:", error);

      return false;
    }
  },

  /**
   * Check if a super admin user exists in the system
   * @returns {Promise<boolean>}
   */
  async checkSuperAdminExists(): Promise<boolean> {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const q = query(usersRef, where("role", "==", "system-owner"));
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking super admin existence:", error);

      return false;
    }
  },

  /**
   * Create the initial super admin user
   * @param {string} email - Super admin email
   * @param {string} password - Super admin password
   * @param {string} displayName - Super admin display name
   * @returns {Promise<string>} - Super admin user ID
   */
  async createSuperAdmin(
    email: string,
    password: string,
    displayName: string,
  ): Promise<string> {
    try {
      // Check if super admin already exists
      const superAdminExists = await this.checkSuperAdminExists();

      if (superAdminExists) {
        throw new Error("A super admin user already exists in the system");
      }

      // Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const uid = userCredential.user.uid;

      // Update the display name
      await updateProfile(userCredential.user, { displayName });

      // Create the super admin document in Firestore
      const userData: Partial<User> = {
        id: uid,
        email,
        displayName,
        role: "system-owner",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, USERS_COLLECTION, uid), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Initialize system permissions if needed
      // TODO: Implement initializeSystemPermissions in rbacService or use a different seeding mechanism
      // await rbacService.initializeSystemPermissions();

      // Mark system as initialized
      await setDoc(doc(db, SYSTEM_CONFIG_COLLECTION, "system_status"), {
        initialized: true,
        initializedAt: serverTimestamp(),
        initializedBy: uid,
      });

      return uid;
    } catch (error) {
      console.error("Error creating super admin:", error);
      throw error;
    }
  },

  /**
   * Reset system initialization status (for development/testing only)
   * WARNING: This does not delete existing data or users
   * @returns {Promise<void>}
   */
  async resetSystemInitialization(): Promise<void> {
    try {
      await setDoc(doc(db, SYSTEM_CONFIG_COLLECTION, "system_status"), {
        initialized: false,
        resetAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error resetting system initialization:", error);
      throw error;
    }
  },
};
