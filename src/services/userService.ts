import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";

import { app, db, auth } from "../config/firebase";
import { User } from "../types/models";

const USERS_COLLECTION = "users";
// Name of the secondary Firebase app used only to create staff accounts.
const STAFF_CREATION_APP = "staff-creation";

/**
 * Service for managing user data in Firestore
 */
export const userService = {
  /**
   * Create a new user with Firebase Authentication and Firestore record
   * @param {string} email - User email
   * @param {string} password - Initial password
   * @param {Partial<User>} userData - Additional user data
   * @param {string} adminPassword - Password of the current admin user for re-authentication
   * @returns {Promise<string>} - ID of the created user
   */
  async createUser(
    email: string,
    password: string,
    userData: Partial<User>,
    _adminPassword?: string,
  ): Promise<string> {
    if (!auth.currentUser) {
      throw new Error("No authenticated user found");
    }

    try {
      // The account is created on a second Firebase app instance, so the
      // signed-in administrator keeps their session and is the one who
      // writes the user record. Creating it on the main instance signed
      // the administrator out in favour of the new account, and the record
      // was then written AS that new account — a self-created document
      // with an arbitrary role, which the security rules no longer permit.
      const secondary =
        getApps().find((a) => a.name === STAFF_CREATION_APP) ??
        initializeApp(app.options, STAFF_CREATION_APP);
      const secondaryAuth = getAuth(secondary);
      let uid: string;

      try {
        const credential = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password,
        );

        uid = credential.user.uid;
        // The person sets their own password from the email; the one
        // typed by the administrator is never the lasting one.
        await sendPasswordResetEmail(secondaryAuth, email);
      } finally {
        await signOut(secondaryAuth).catch(() => undefined);
      }

      await setDoc(doc(db, USERS_COLLECTION, uid), {
        ...userData,
        email,
        id: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
      });

      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "user_created",
          userData.clinicId || "",
          {
            userId: uid,
            email,
            displayName: userData.displayName,
            role: userData.role,
            branchId: userData.branchId,
            isActive: true,
          },
          "success",
          undefined,
          {
            branchId: userData.branchId,
            targetUserId: uid,
          },
        );
      } catch (logError) {
        console.error("Failed to log user creation event:", logError);
      }

      return uid;
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Error creating user:", error);

      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "operation_failed",
          userData.clinicId || "",
          {
            operation: "user_created",
            email,
            displayName: userData.displayName,
            userData: userData,
          },
          "failure",
          errorMessage,
          {
            branchId: userData.branchId,
          },
        );
      } catch (logError) {
        console.error("Failed to log user creation failure:", logError);
      }
      throw error;
    }
  },

  /**
   * Get a user by ID
   * @param {string} id - User ID
   * @returns {Promise<User | null>} - User data or null if not found
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as User;
      }

      return null;
    } catch (error) {
      console.error("Error getting user:", error);
      throw error;
    }
  },

  /**
   * Get all users for a specific clinic
   * @param {string} clinicId - ID of the clinic
   * @returns {Promise<User[]>} - Array of users in the clinic
   */
  async getClinicUsers(clinicId?: string): Promise<User[]> {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const q = clinicId
        ? query(usersRef, where("clinicId", "==", clinicId))
        : usersRef;
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as User,
      );
    } catch (error) {
      console.error("Error getting users:", error);
      throw error;
    }
  },

  /**
   * Update a user's information
   * @param {string} id - User ID
   * @param {Partial<User>} updateData - Updated user data
   * @returns {Promise<void>}
   */
  async updateUser(id: string, updateData: Partial<User>): Promise<void> {
    try {
      // Get existing user data for logging
      const existingUser = await this.getUserById(id);

      if (!existingUser) {
        throw new Error("User not found");
      }

      const docRef = doc(db, USERS_COLLECTION, id);

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      // Log user update event
      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "user_updated",
          existingUser.clinicId || "",
          {
            userId: id,
            userEmail: existingUser.email,
            userName: existingUser.displayName,
            previousData: {
              displayName: existingUser.displayName,
              role: existingUser.role,
              isActive: existingUser.isActive,
            },
            updatedData: updateData,
          },
          "success",
          undefined,
          {
            branchId: existingUser.branchId,
            targetUserId: id,
          },
        );
      } catch (logError) {
        console.error("Failed to log user update event:", logError);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Error updating user:", error);

      // Log user update failure
      try {
        const existingUser = await this.getUserById(id);

        if (existingUser) {
          const { auditLogService } = await import("./auditLogService");

          await auditLogService.logEvent(
            "operation_failed",
            existingUser.clinicId || "",
            {
              operation: "user_updated",
              userId: id,
              userEmail: existingUser.email,
              userName: existingUser.displayName,
              updateData: updateData,
            },
            "failure",
            errorMessage,
            {
              branchId: existingUser.branchId,
              targetUserId: id,
            },
          );
        }
      } catch (logError) {
        console.error("Failed to log user update failure:", logError);
      }

      throw error;
    }
  },

  /**
   * Update a user's clinic assignment
   * @param {string} userId - User ID
   * @param {string} clinicId - New clinic ID
   * @returns {Promise<void>}
   */
  async updateUserClinic(userId: string, clinicId: string): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, userId);

      await updateDoc(docRef, {
        clinicId,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating user clinic:", error);
      throw error;
    }
  },

  /**
   * Activate or deactivate a user
   * @param {string} id - User ID
   * @param {boolean} isActive - Whether user should be active
   * @returns {Promise<void>}
   */
  async setUserActive(id: string, isActive: boolean): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);

      await updateDoc(docRef, {
        isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating user status:", error);
      throw error;
    }
  },

  /**
   * Get all users for a specific clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<User[]>} - Array of users for the clinic
   */
  async getUsersByClinic(clinicId?: string): Promise<User[]> {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const q = clinicId
        ? query(usersRef, where("clinicId", "==", clinicId))
        : usersRef;
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
          }) as User,
      );
    } catch (error) {
      console.error("Error getting users:", error);
      throw error;
    }
  },

  /**
   * Update a user's role
   * @param {string} userId - User ID
   * @param {string} newRole - New role to assign
   * @returns {Promise<void>}
   */
  async updateUserRole(userId: string, newRole: string): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, userId);

      await updateDoc(docRef, {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      throw error;
    }
  },

  /**
   * Deactivate a user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deactivateUser(userId: string): Promise<void> {
    try {
      // Get existing user data for logging
      const existingUser = await this.getUserById(userId);

      if (!existingUser) {
        throw new Error("User not found");
      }

      const docRef = doc(db, USERS_COLLECTION, userId);

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });

      // Log user deactivation event
      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "user_deactivated",
          existingUser.clinicId || "",
          {
            userId,
            userEmail: existingUser.email,
            userName: existingUser.displayName,
            role: existingUser.role,
          },
          "success",
          undefined,
          {
            branchId: existingUser.branchId,
            targetUserId: userId,
          },
        );
      } catch (logError) {
        console.error("Failed to log user deactivation event:", logError);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Error deactivating user:", error);

      // Log user deactivation failure
      try {
        const existingUser = await this.getUserById(userId);

        if (existingUser) {
          const { auditLogService } = await import("./auditLogService");

          await auditLogService.logEvent(
            "operation_failed",
            existingUser.clinicId || "",
            {
              operation: "user_deactivated",
              userId,
              userEmail: existingUser.email,
              userName: existingUser.displayName,
            },
            "failure",
            errorMessage,
            {
              branchId: existingUser.branchId,
              targetUserId: userId,
            },
          );
        }
      } catch (logError) {
        console.error("Failed to log user deactivation failure:", logError);
      }

      throw error;
    }
  },

  /**
   * Activate a user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async activateUser(userId: string): Promise<void> {
    try {
      // Get existing user data for logging
      const existingUser = await this.getUserById(userId);

      if (!existingUser) {
        throw new Error("User not found");
      }

      const docRef = doc(db, USERS_COLLECTION, userId);

      await updateDoc(docRef, {
        isActive: true,
        updatedAt: serverTimestamp(),
      });

      // Log user activation event
      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "user_activated",
          existingUser.clinicId || "",
          {
            userId,
            userEmail: existingUser.email,
            userName: existingUser.displayName,
            role: existingUser.role,
          },
          "success",
          undefined,
          {
            branchId: existingUser.branchId,
            targetUserId: userId,
          },
        );
      } catch (logError) {
        console.error("Failed to log user activation event:", logError);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Error activating user:", error);

      // Log user activation failure
      try {
        const existingUser = await this.getUserById(userId);

        if (existingUser) {
          const { auditLogService } = await import("./auditLogService");

          await auditLogService.logEvent(
            "operation_failed",
            existingUser.clinicId || "",
            {
              operation: "user_activated",
              userId,
              userEmail: existingUser.email,
              userName: existingUser.displayName,
            },
            "failure",
            errorMessage,
            {
              branchId: existingUser.branchId,
              targetUserId: userId,
            },
          );
        }
      } catch (logError) {
        console.error("Failed to log user activation failure:", logError);
      }

      throw error;
    }
  },

  /**
   * Get all clinic admins
   * @returns {Promise<User[]>} - Array of clinic admin users
   */
  async getClinicAdmins(): Promise<User[]> {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const q = query(usersRef, where("role", "==", "clinic-admin"));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as User,
      );
    } catch (error) {
      console.error("Error getting clinic admins:", error);
      throw error;
    }
  },

  /**
   * Get user by email address
   * @param {string} email - User email
   * @returns {Promise<User | null>} - User data or null if not found
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];

        return {
          id: doc.id,
          ...doc.data(),
        } as User;
      }

      return null;
    } catch (error) {
      console.error("Error getting user by email:", error);
      throw error;
    }
  },

  /**
   * Get branch admin for a specific branch
   * @param {string} branchId - Branch ID
   * @returns {Promise<User | null>} - Branch admin user or null if not found
   */
  async getBranchAdmin(branchId: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where("branchId", "==", branchId),
        where("role", "==", "clinic-admin"),
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
        } as User;
      }

      return null;
    } catch (error) {
      console.error("Error getting branch admin:", error);
      throw error;
    }
  },

  /**
   * Create a branch admin user
   * @param {string} email - Admin email
   * @param {string} password - Admin password
   * @param {string} displayName - Admin display name
   * @param {string} clinicId - Clinic ID
   * @param {string} branchId - Branch ID
   * @param {string} adminPassword - Current admin password for re-authentication
   * @returns {Promise<string>} - Created user ID
   */
  async createBranchAdmin(
    email: string,
    password: string,
    displayName: string,
    clinicId: string,
    adminPassword?: string,
  ): Promise<string> {
    return this.createUser(
      email,
      password,
      {
        displayName,
        email,
        role: "clinic-admin",
        clinicId,
        branchId: clinicId,
        isActive: true,
      },
      adminPassword,
    );
  },
};
