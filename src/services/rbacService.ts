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
  writeBatch,
  orderBy,
} from "firebase/firestore";

import { db, auth } from "../config/firebase";
import { Role, UserRoleAssignment, Page } from "../types/models";

const ROLES_COLLECTION = "roles";
const PERMISSIONS_COLLECTION = "permissions";
const USER_ROLE_ASSIGNMENTS_COLLECTION = "user_role_assignments";
const USERS_COLLECTION = "users";

/**
 * Enhanced RBAC Service for page-based permissions
 */
export const rbacService = {
  // Track in-flight preload requests to deduplicate
  __preloadInflight: new Map<string, Promise<void>>(),

  // =================== VALIDATION HELPERS ===================

  /**
   * Validate that role IDs exist and belong to the clinic
   */
  async validateRoleIds(
    clinicId: string,
    roleIds: string[],
  ): Promise<{ valid: boolean; invalidIds: string[]; error?: string }> {
    try {
      if (!roleIds || roleIds.length === 0) {
        return { valid: false, invalidIds: [], error: "No role IDs provided" };
      }

      // Get all roles for the clinic
      const clinicRoles = await this.getClinicRoles(clinicId);
      const validRoleIds = new Set(clinicRoles.map((role) => role.id));

      const invalidIds = roleIds.filter((roleId) => !validRoleIds.has(roleId));

      if (invalidIds.length > 0) {
        return {
          valid: false,
          invalidIds,
          error: `The following role IDs do not exist or do not belong to this clinic: ${invalidIds.join(", ")}`,
        };
      }

      return { valid: true, invalidIds: [] };
    } catch (error) {
      console.error("Error validating role IDs:", error);

      return {
        valid: false,
        invalidIds: roleIds,
        error: `Failed to validate role IDs: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },

  /**
   * Validate that a user exists
   */
  async validateUserExists(
    userId: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return {
          valid: false,
          error: `User with ID ${userId} does not exist`,
        };
      }

      return { valid: true };
    } catch (error) {
      console.error("Error validating user existence:", error);

      return {
        valid: false,
        error: `Failed to validate user existence: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },

  /**
   * Validate that role name is unique within clinic/branch
   */
  async validateRoleNameUnique(
    clinicId: string,
    name: string,
    branchId?: string,
    excludeId?: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return {
          valid: false,
          error: "Role name cannot be empty",
        };
      }

      // Get all roles for the clinic
      const clinicRoles = await this.getClinicRoles(clinicId);

      // Check for duplicate name (case-insensitive)
      const duplicate = clinicRoles.find((role) => {
        if (excludeId && role.id === excludeId) return false; // Exclude current role when updating

        return role.name.trim().toLowerCase() === trimmedName.toLowerCase();
      });

      if (duplicate) {
        return {
          valid: false,
          error: `A role with the name "${name}" already exists in the system`,
        };
      }

      return { valid: true };
    } catch (error) {
      console.error("Error validating role name uniqueness:", error);

      return {
        valid: false,
        error: `Failed to validate role name uniqueness: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },

  /**
   * Validate that permissions are valid page IDs for the clinic
   */
  async validatePermissions(
    clinicId: string,
    permissionIds: string[],
  ): Promise<{ valid: boolean; invalidIds: string[]; error?: string }> {
    try {
      if (!permissionIds || permissionIds.length === 0) {
        // Empty permissions array is allowed (role with no permissions)
        return { valid: true, invalidIds: [] };
      }

      // Get available pages for the clinic
      const availablePages = await this.getAvailablePagesForClinic(clinicId);
      const validPageIds = new Set(availablePages.map((page) => page.id));

      const invalidIds = permissionIds.filter(
        (pageId) => !validPageIds.has(pageId),
      );

      if (invalidIds.length > 0) {
        return {
          valid: false,
          invalidIds,
          error: `The following permission IDs are not valid page IDs for this clinic: ${invalidIds.join(", ")}`,
        };
      }

      return { valid: true, invalidIds: [] };
    } catch (error) {
      console.error("Error validating permissions:", error);

      return {
        valid: false,
        invalidIds: permissionIds,
        error: `Failed to validate permissions: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },

  // =================== ROLE MANAGEMENT ===================

  /**
   * Create a new role for a clinic
   */
  async createRole(
    roleData: Omit<Role, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    try {
      // Validate required fields
      if (!roleData.name || !roleData.name.trim()) {
        const error = new Error("Role name is required");

        console.error("Error creating role:", error, { roleData });
        throw error;
      }

      if (!roleData.clinicId) {
        const error = new Error("Clinic ID is required");

        console.error("Error creating role:", error, { roleData });
        throw error;
      }

      // Validate role name uniqueness
      const nameValidation = await this.validateRoleNameUnique(
        roleData.clinicId,
        roleData.name,
        roleData.branchId,
      );

      if (!nameValidation.valid) {
        const error = new Error(
          nameValidation.error || "Role name validation failed",
        );

        console.error("Error creating role - name validation failed:", error, {
          roleData,
          validationResult: nameValidation,
        });
        throw error;
      }

      // Validate permissions if provided
      if (roleData.permissions && roleData.permissions.length > 0) {
        const permissionValidation = await this.validatePermissions(
          roleData.clinicId,
          roleData.permissions,
        );

        if (!permissionValidation.valid) {
          const error = new Error(
            permissionValidation.error || "Permission validation failed",
          );

          console.error(
            "Error creating role - permission validation failed:",
            error,
            {
              roleData,
              validationResult: permissionValidation,
            },
          );
          throw error;
        }
      }

      const rolesRef = collection(db, ROLES_COLLECTION);

      // Filter out undefined values to avoid Firestore errors
      const cleanedRoleData = Object.fromEntries(
        Object.entries({
          ...roleData,
          createdBy: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).filter(([_, value]) => value !== undefined),
      );

      const docRef = await addDoc(rolesRef, cleanedRoleData);
      const roleId = docRef.id;

      console.log("Role created successfully:", {
        roleId,
        roleName: roleData.name,
        clinicId: roleData.clinicId,
      });

      // Log role creation event
      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "role_created",
          roleData.clinicId,
          {
            roleId,
            roleName: roleData.name,
            description: roleData.description,
            permissions: roleData.permissions,
            isDefault: roleData.isDefault || false,
            isBranchSpecific: roleData.isBranchSpecific || false,
            linkedToDoctor: roleData.linkedToDoctor || false,
            branchId: roleData.branchId,
          },
          "success",
          undefined,
          {
            branchId: roleData.branchId,
            targetRoleId: roleId,
          },
        );
      } catch (logError) {
        console.error("Failed to log role creation event:", logError);
      }

      return roleId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Error creating role:", error, {
        roleData,
        currentUser: auth.currentUser?.uid,
      });

      // Log role creation failure
      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "operation_failed",
          roleData.clinicId,
          {
            operation: "role_created",
            roleName: roleData.name,
            roleData: roleData,
          },
          "failure",
          errorMessage,
          {
            branchId: roleData.branchId,
          },
        );
      } catch (logError) {
        console.error("Failed to log role creation failure:", logError);
      }

      throw error;
    }
  },

  /**
   * Get a role by ID
   */
  async getRoleById(id: string): Promise<Role | null> {
    try {
      const docRef = doc(db, ROLES_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          updatedAt: docSnap.data().updatedAt?.toDate(),
        } as Role;
      }

      return null;
    } catch (error) {
      console.error("Error getting role:", error);
      throw error;
    }
  },

  /**
   * Get all roles for a specific clinic
   */
  async getClinicRoles(
    clinicId: string,
    options?: {
      excludeNames?: string[];
    },
  ): Promise<Role[]> {
    try {
      const rolesRef = collection(db, ROLES_COLLECTION);
      let q = query(
        rolesRef,
        where("clinicId", "==", clinicId),
        orderBy("name"),
      );
      const querySnapshot = await getDocs(q);

      let roles = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
          }) as Role,
      );

      if (options?.excludeNames?.length) {
        roles = roles.filter(
          (role) => !options.excludeNames!.includes(role.name),
        );
      }

      // Remove duplicates by name
      const uniqueMap = new Map<string, Role>();

      roles.forEach((r) => {
        const key = r.name.toLowerCase();

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, r);
        }
      });

      return Array.from(uniqueMap.values());
    } catch (error) {
      console.error("Error getting clinic roles:", error);
      throw error;
    }
  },

  /**
   * Update a role
   */
  async updateRole(
    id: string,
    updateData: Partial<Omit<Role, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    try {
      // Get existing role to validate against
      const existingRole = await this.getRoleById(id);

      if (!existingRole) {
        const error = new Error(`Role with ID ${id} not found`);

        console.error("Error updating role:", error);
        throw error;
      }

      // Validate role name uniqueness if name is being updated
      if (updateData.name !== undefined) {
        const nameValidation = await this.validateRoleNameUnique(
          existingRole.clinicId,
          updateData.name,
          updateData.branchId !== undefined
            ? updateData.branchId
            : existingRole.branchId,
          id, // Exclude current role from uniqueness check
        );

        if (!nameValidation.valid) {
          const error = new Error(
            nameValidation.error || "Role name validation failed",
          );

          console.error(
            "Error updating role - name validation failed:",
            error,
            {
              roleId: id,
              updateData,
              validationResult: nameValidation,
            },
          );
          throw error;
        }
      }

      // Validate permissions if being updated
      if (
        updateData.permissions !== undefined &&
        updateData.permissions.length > 0
      ) {
        const permissionValidation = await this.validatePermissions(
          existingRole.clinicId,
          updateData.permissions,
        );

        if (!permissionValidation.valid) {
          const error = new Error(
            permissionValidation.error || "Permission validation failed",
          );

          console.error(
            "Error updating role - permission validation failed:",
            error,
            {
              roleId: id,
              updateData,
              validationResult: permissionValidation,
            },
          );
          throw error;
        }
      }

      const docRef = doc(db, ROLES_COLLECTION, id);

      // Filter out undefined values to avoid Firestore errors
      const cleanedUpdateData = Object.fromEntries(
        Object.entries({
          ...updateData,
          updatedAt: serverTimestamp(),
        }).filter(([_, value]) => value !== undefined),
      );

      await updateDoc(docRef, cleanedUpdateData);
      console.log("Role updated successfully:", { roleId: id, updateData });

      // Log role update event
      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "role_updated",
          existingRole.clinicId,
          {
            roleId: id,
            roleName: existingRole.name,
            previousData: {
              name: existingRole.name,
              description: existingRole.description,
              permissions: existingRole.permissions,
              linkedToDoctor: existingRole.linkedToDoctor,
            },
            updatedData: updateData,
          },
          "success",
          undefined,
          {
            branchId: existingRole.branchId,
            targetRoleId: id,
          },
        );
      } catch (logError) {
        console.error("Failed to log role update event:", logError);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Error updating role:", error, {
        roleId: id,
        updateData,
        currentUser: auth.currentUser?.uid,
      });

      // Log role update failure
      try {
        const existingRole = await this.getRoleById(id);

        if (existingRole) {
          const { auditLogService } = await import("./auditLogService");

          await auditLogService.logEvent(
            "operation_failed",
            existingRole.clinicId,
            {
              operation: "role_updated",
              roleId: id,
              roleName: existingRole.name,
              updateData: updateData,
            },
            "failure",
            errorMessage,
            {
              branchId: existingRole.branchId,
              targetRoleId: id,
            },
          );
        }
      } catch (logError) {
        console.error("Failed to log role update failure:", logError);
      }

      throw error;
    }
  },

  /**
   * Delete a role and all its assignments
   */
  async deleteRole(id: string): Promise<void> {
    try {
      const roleRef = doc(db, ROLES_COLLECTION, id);
      const roleSnap = await getDoc(roleRef);

      if (!roleSnap.exists()) {
        throw new Error("Role not found");
      }

      const roleData = roleSnap.data() as Role;
      const clinicId = roleData.clinicId;
      const branchId = roleData.branchId;

      await deleteDoc(roleRef);

      // Log role deletion event
      try {
        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "role_deleted",
          clinicId,
          {
            roleId: id,
            roleName: roleData.name,
            description: roleData.description,
            permissions: roleData.permissions,
            isDefault: roleData.isDefault,
            isBranchSpecific: roleData.isBranchSpecific,
            linkedToDoctor: roleData.linkedToDoctor,
          },
          "success",
          undefined,
          {
            branchId: branchId,
            targetRoleId: id,
          },
        );
      } catch (logError) {
        console.error("Failed to log role deletion event:", logError);
      }

      // Note: User role assignments are not automatically deleted
      // to avoid query permission issues. Orphaned assignments
      // should be cleaned up separately if needed.
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Error deleting role:", error);

      // Log role deletion failure
      try {
        const roleRef = doc(db, ROLES_COLLECTION, id);
        const roleSnap = await getDoc(roleRef);

        if (roleSnap.exists()) {
          const roleData = roleSnap.data() as Role;
          const { auditLogService } = await import("./auditLogService");

          await auditLogService.logEvent(
            "operation_failed",
            roleData.clinicId,
            {
              operation: "role_deleted",
              roleId: id,
              roleName: roleData.name,
            },
            "failure",
            errorMessage,
            {
              branchId: roleData.branchId,
              targetRoleId: id,
            },
          );
        }
      } catch (logError) {
        console.error("Failed to log role deletion failure:", logError);
      }

      throw error;
    }
  },

  // =================== PERMISSION MANAGEMENT ===================

  /**
   * Get available pages for a clinic (based on clinic type) - WITH CACHING
   */
  async getAvailablePagesForClinic(clinicId: string): Promise<Page[]> {
    try {
      // Check cache first
      const { cacheService } = await import("./cacheService");
      const cachedPages = cacheService.getClinicPages(clinicId);

      if (cachedPages) {
        return cachedPages;
      }

      // Cache miss - fetch from database

      // If standalone default clinic, return all pages natively
      if (clinicId === "default") {
        const { pageService } = await import("./pageService");
        const pages = await pageService.getAllPages();
        cacheService.setClinicPages(clinicId, pages);
        return pages;
      }

      // First get the clinic to find its type
      const clinicRef = doc(db, "clinics", clinicId);
      const clinicSnap = await getDoc(clinicRef);

      if (!clinicSnap.exists()) {
        console.warn(`Clinic not found: ${clinicId}, returning empty pages.`);
        return [];
      }

      const clinicType = clinicSnap.data().clinicType;

      // Get pages assigned to this clinic type
      const clinicTypePagesRef = collection(db, "clinic_type_pages");
      const clinicTypePagesQuery = query(
        clinicTypePagesRef,
        where("clinicTypeId", "==", clinicType),
        where("isEnabled", "==", true),
      );
      const clinicTypePagesSnapshot = await getDocs(clinicTypePagesQuery);

      const pageIds = clinicTypePagesSnapshot.docs.map(
        (doc) => doc.data().pageId,
      );

      if (pageIds.length === 0) {
        const emptyResult: Page[] = [];

        cacheService.setClinicPages(clinicId, emptyResult);

        return emptyResult;
      }

      // Get the actual pages
      const pagesRef = collection(db, "pages");
      const pagesQuery = query(
        pagesRef,
        where("isActive", "==", true),
        orderBy("order"),
      );
      const pagesSnapshot = await getDocs(pagesQuery);

      const pages = pagesSnapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate(),
              updatedAt: doc.data().updatedAt?.toDate(),
            }) as Page,
        )
        .filter((page) => pageIds.includes(page.id));

      // Cache the result
      cacheService.setClinicPages(clinicId, pages);

      return pages;
    } catch (error) {
      console.error("Error getting available pages for clinic:", error);
      throw error;
    }
  },

  // =================== USER ROLE ASSIGNMENTS ===================

  /**
   * Assign roles to a user
   */
  async assignRolesToUser(
    userId: string,
    roleIds: string[],
    clinicId: string,
  ): Promise<void> {
    try {
      // Validate inputs
      if (!userId || !userId.trim()) {
        const error = new Error("User ID is required");

        console.error("Error assigning roles to user:", error, {
          userId,
          roleIds,
          clinicId,
        });
        throw error;
      }

      if (!clinicId || !clinicId.trim()) {
        const error = new Error("Clinic ID is required");

        console.error("Error assigning roles to user:", error, {
          userId,
          roleIds,
          clinicId,
        });
        throw error;
      }

      if (!roleIds || roleIds.length === 0) {
        const error = new Error("At least one role ID is required");

        console.error("Error assigning roles to user:", error, {
          userId,
          roleIds,
          clinicId,
        });
        throw error;
      }

      // Validate user exists
      const userValidation = await this.validateUserExists(userId);

      if (!userValidation.valid) {
        const error = new Error(
          userValidation.error || "User validation failed",
        );

        console.error(
          "Error assigning roles to user - user validation failed:",
          error,
          {
            userId,
            roleIds,
            clinicId,
            validationResult: userValidation,
          },
        );
        throw error;
      }

      // Validate role IDs exist and belong to clinic
      const roleValidation = await this.validateRoleIds(clinicId, roleIds);

      if (!roleValidation.valid) {
        const error = new Error(
          roleValidation.error || "Role validation failed",
        );

        console.error(
          "Error assigning roles to user - role validation failed:",
          error,
          {
            userId,
            roleIds,
            clinicId,
            validationResult: roleValidation,
          },
        );
        throw error;
      }

      const batch = writeBatch(db);
      const assignmentsRef = collection(db, USER_ROLE_ASSIGNMENTS_COLLECTION);

      // First, remove existing assignments for this user in this clinic
      const existingQuery = query(
        assignmentsRef,
        where("userId", "==", userId),
        where("clinicId", "==", clinicId),
      );
      const existingSnapshot = await getDocs(existingQuery);

      existingSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Add new assignments
      roleIds.forEach((roleId) => {
        const assignmentRef = doc(assignmentsRef);

        batch.set(assignmentRef, {
          userId,
          roleId,
          clinicId,
          assignedBy: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      console.log("Roles assigned to user successfully:", {
        userId,
        roleIds,
        clinicId,
        assignedBy: auth.currentUser?.uid,
      });

      // Log role assignment event
      try {
        // Get user data to find branchId
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : null;
        const branchId = userData?.branchId;

        // Get role names for logging
        const roles = await Promise.all(
          roleIds.map((roleId) => this.getRoleById(roleId)),
        );
        const roleNames = roles.filter((r) => r !== null).map((r) => r!.name);

        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "roles_assigned",
          clinicId,
          {
            userId,
            userEmail: userData?.email,
            userName: userData?.displayName,
            roleIds,
            roleNames,
            previousRoleIds: existingSnapshot.docs.map(
              (doc) => doc.data().roleId,
            ),
          },
          "success",
          undefined,
          {
            branchId: branchId,
            targetUserId: userId,
          },
        );
      } catch (logError) {
        console.error("Failed to log role assignment event:", logError);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Error assigning roles to user:", error, {
        userId,
        roleIds,
        clinicId,
        currentUser: auth.currentUser?.uid,
      });

      // Log role assignment failure
      try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : null;
        const branchId = userData?.branchId;

        const { auditLogService } = await import("./auditLogService");

        await auditLogService.logEvent(
          "operation_failed",
          clinicId,
          {
            operation: "roles_assigned",
            userId,
            userEmail: userData?.email,
            userName: userData?.displayName,
            roleIds,
          },
          "failure",
          errorMessage,
          {
            branchId: branchId,
            targetUserId: userId,
          },
        );
      } catch (logError) {
        console.error("Failed to log role assignment failure:", logError);
      }

      throw error;
    }
  },

  /**
   * Get user role assignments
   */
  async getUserRoleAssignments(
    userId: string,
    clinicId: string,
  ): Promise<UserRoleAssignment[]> {
    try {
      const assignmentsRef = collection(db, USER_ROLE_ASSIGNMENTS_COLLECTION);
      const q = query(
        assignmentsRef,
        where("userId", "==", userId),
        where("clinicId", "==", clinicId),
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => doc.data() as UserRoleAssignment);
    } catch (error) {
      console.error("Error getting user role assignments:", error);
      throw error;
    }
  },

  /**
   * Get all users for a clinic with their roles
   */
  async getClinicUsersWithRoles(
    clinicId: string,
    options?: { branchId?: string; excludeRoles?: string[] },
  ): Promise<any[]> {
    try {
      // Get users for the clinic, optionally filtered by branch
      const usersRef = collection(db, "users");
      let usersQuery = query(usersRef, where("clinicId", "==", clinicId));

      // Filter by branch if specified
      if (options?.branchId) {
        usersQuery = query(
          usersRef,
          where("clinicId", "==", clinicId),
          where("branchId", "==", options.branchId),
        );
      }

      const usersSnapshot = await getDocs(usersQuery);

      let users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      }));

      // Filter out excluded roles if specified
      if (options?.excludeRoles?.length) {
        users = users.filter(
          (user) => !options.excludeRoles!.includes((user as any).role),
        );
      }

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        users.map(async (user) => {
          const assignments = await this.getUserRoleAssignments(
            user.id,
            clinicId,
          );
          const roleIds = assignments.map((a) => a.roleId);

          // Get role details
          const roles = await Promise.all(
            roleIds.map((roleId) => this.getRoleById(roleId)),
          );

          return {
            ...user,
            roles: roles.filter((role) => role !== null),
          };
        }),
      );

      return usersWithRoles;
    } catch (error) {
      console.error("Error getting clinic users with roles:", error);
      throw error;
    }
  },

  /**
   * Get all users who have a specific role assigned
   */
  async getUsersWithRole(roleId: string, clinicId: string): Promise<any[]> {
    try {
      // Get all role assignments for this specific role in this clinic
      const assignmentsRef = collection(db, USER_ROLE_ASSIGNMENTS_COLLECTION);
      const q = query(
        assignmentsRef,
        where("roleId", "==", roleId),
        where("clinicId", "==", clinicId),
      );
      const querySnapshot = await getDocs(q);

      // Get user IDs from assignments
      const userIds = querySnapshot.docs.map((doc) => doc.data().userId);

      if (userIds.length === 0) {
        return [];
      }

      // Get user details for these users
      const usersRef = collection(db, "users");
      const users: any[] = [];

      // Get users in batches (Firestore has limits on 'in' queries)
      const batchSize = 10;

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const batchQuery = query(usersRef, where("__name__", "in", batch));
        const batchSnapshot = await getDocs(batchQuery);

        batchSnapshot.docs.forEach((doc) => {
          users.push({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
          });
        });
      }

      return users;
    } catch (error) {
      console.error("Error getting users with role:", error);
      throw error;
    }
  },

  /**
   * Check if user has permission to access a specific page - WITH CACHING
   */
  async hasPagePermission(
    userId: string,
    clinicId: string,
    pageId: string,
  ): Promise<boolean> {
    try {
      // Check cache first
      const { cacheService } = await import("./cacheService");
      const cachedResult = cacheService.hasPagePermissionCached(
        userId,
        clinicId,
        pageId,
      );

      if (cachedResult !== null) {
        return cachedResult;
      }

      // Cache miss - ensure user permissions are loaded
      await this.preloadUserPermissions(userId, clinicId);

      // Try cache again after preload
      const cachedResultAfterPreload = cacheService.hasPagePermissionCached(
        userId,
        clinicId,
        pageId,
      );

      if (cachedResultAfterPreload !== null) {
        return cachedResultAfterPreload;
      }

      // Fallback to direct check
      return this.hasPagePermissionDirect(userId, clinicId, pageId);
    } catch (error) {
      console.error("Error checking page permission:", error);

      return false;
    }
  },

  /**
   * Direct page permission check (without cache) - used as fallback
   */
  async hasPagePermissionDirect(
    userId: string,
    clinicId: string,
    pageId: string,
  ): Promise<boolean> {
    try {
      // Get user's role assignments
      const assignments = await this.getUserRoleAssignments(userId, clinicId);

      if (assignments.length === 0) {
        // User has no RBAC role assignments - no permissions
        return false;
      }

      // Get user's roles
      const roles = await Promise.all(
        assignments.map((assignment) => this.getRoleById(assignment.roleId)),
      );

      // Check if any role has permission to the page
      const hasPermission = roles.some(
        (role) => role && role.permissions.includes(pageId),
      );

      return hasPermission;
    } catch (error) {
      console.error("Error in direct page permission check:", error);

      return false;
    }
  },

  /**
   * Preload and cache all user permissions for a clinic
   */
  async preloadUserPermissions(
    userId: string,
    clinicId: string,
  ): Promise<void> {
    try {
      const { cacheService } = await import("./cacheService");

      // Return early if cached
      const existing = cacheService.getUserPermissions(userId, clinicId);

      if (existing) return;

      // Deduplicate concurrent preloads
      const inflightKey = `${userId}:${clinicId}`;
      const existingPromise = this.__preloadInflight.get(inflightKey);

      if (existingPromise) {
        await existingPromise;

        return;
      }

      const preloadPromise = (async () => {
        // Double-check cache inside the in-flight closure
        const cached = cacheService.getUserPermissions(userId, clinicId);

        if (cached) return;

        // Fetch concurrently
        const [accessiblePages, allClinicPages] = await Promise.all([
          this.getAccessiblePagesForUserDirect(userId, clinicId),
          this.getAvailablePagesForClinic(clinicId),
        ]);

        const pagePermissions = new Map<string, boolean>();
        const pathToPageIdMap = new Map<string, string>();

        allClinicPages.forEach((page) => {
          pagePermissions.set(page.id, false);
          pathToPageIdMap.set(page.path, page.id);
        });

        accessiblePages.forEach((page) => {
          pagePermissions.set(page.id, true);
        });

        cacheService.setUserPermissions(userId, clinicId, {
          accessiblePages,
          pagePermissions,
          pathToPageIdMap,
        });
      })();

      this.__preloadInflight.set(inflightKey, preloadPromise);
      try {
        await preloadPromise;
      } finally {
        this.__preloadInflight.delete(inflightKey);
      }
    } catch (error) {
      console.error("Error preloading user permissions:", error);
      throw error;
    }
  },

  /**
   * Get accessible pages for a user based on their roles - WITH CACHING
   */
  async getAccessiblePagesForUser(
    userId: string,
    clinicId: string,
  ): Promise<Page[]> {
    try {
      const { cacheService } = await import("./cacheService");

      // Check cache first
      const cachedPermissions = cacheService.getUserPermissions(
        userId,
        clinicId,
      );

      if (cachedPermissions) {
        return cachedPermissions.accessiblePages;
      }

      // Cache miss - preload permissions
      await this.preloadUserPermissions(userId, clinicId);

      // Get from cache after preload
      const permissionsAfterPreload = cacheService.getUserPermissions(
        userId,
        clinicId,
      );

      if (permissionsAfterPreload) {
        return permissionsAfterPreload.accessiblePages;
      }

      // Fallback to direct call
      return this.getAccessiblePagesForUserDirect(userId, clinicId);
    } catch (error) {
      console.error("Error getting accessible pages for user:", error);

      return [];
    }
  },

  /**
   * Direct accessible pages fetch (without cache) - used as fallback and for preloading
   */
  async getAccessiblePagesForUserDirect(
    userId: string,
    clinicId: string,
  ): Promise<Page[]> {
    try {
      // Check if user has legacy clinic-admin or system-owner role
      // These users should have access to all clinic type pages
      const { userService } = await import("./userService");
      const user = await userService.getUserById(userId);

      if (
        user &&
        (user.role === "clinic-admin" || user.role === "system-owner")
      ) {
        // Legacy admin users get all clinic type pages
        const allPages = await this.getAvailablePagesForClinic(clinicId);

        console.log(
          `[RBAC] User ${userId} has legacy ${user.role} role - granting access to all ${allPages.length} clinic type pages`,
        );
        allPages.sort((a, b) => a.order - b.order);

        return allPages;
      }

      // Get user's role assignments
      const assignments = await this.getUserRoleAssignments(userId, clinicId);

      if (assignments.length === 0) {
        // User has no RBAC role assignments - they have no access
        console.log(
          `User ${userId} has no RBAC role assignments - no access granted`,
        );

        return [];
      }

      // Get user's roles
      const roles = await Promise.all(
        assignments.map((assignment) => this.getRoleById(assignment.roleId)),
      );

      // Collect all permission IDs (page IDs) from all roles
      const allPermissions = new Set<string>();

      roles.forEach((role) => {
        if (role) {
          role.permissions.forEach((permission) =>
            allPermissions.add(permission),
          );
        }
      });

      if (allPermissions.size === 0) {
        return [];
      }

      // Get all pages
      const allPages = await this.getAvailablePagesForClinic(clinicId);

      // Filter pages based on permissions
      const accessiblePages = allPages.filter((page) =>
        allPermissions.has(page.id),
      );

      // Sort by order
      accessiblePages.sort((a, b) => a.order - b.order);

      return accessiblePages;
    } catch (error) {
      console.error("Error getting accessible pages for user (direct):", error);

      return [];
    }
  },

  /**
   * Get page ID by path (from cache)
   */
  async getPageIdByPath(
    userId: string,
    clinicId: string,
    path: string,
  ): Promise<string | null> {
    try {
      const { cacheService } = await import("./cacheService");

      // Check cache first
      const cachedPageId = cacheService.getPageIdByPath(userId, clinicId, path);

      if (cachedPageId) {
        return cachedPageId;
      }

      // Cache miss - preload permissions
      await this.preloadUserPermissions(userId, clinicId);

      // Try cache again
      const cachedPageIdAfterPreload = cacheService.getPageIdByPath(
        userId,
        clinicId,
        path,
      );

      if (cachedPageIdAfterPreload) {
        return cachedPageIdAfterPreload;
      }

      // Fallback: search through all clinic pages
      const allPages = await this.getAvailablePagesForClinic(clinicId);
      const page = allPages.find((p) => p.path === path);

      return page?.id || null;
    } catch (error) {
      console.error("Error getting page ID by path:", error);

      return null;
    }
  },

  /**
   * Clear user permissions cache (call when user roles change)
   */
  async clearUserPermissionsCache(
    userId: string,
    clinicId: string,
  ): Promise<void> {
    try {
      const { cacheService } = await import("./cacheService");

      cacheService.clearUserPermissions(userId, clinicId);
    } catch (error) {
      console.error("Error clearing user permissions cache:", error);
    }
  },

  /**
   * Clear clinic pages cache (call when clinic pages change)
   */
  async clearClinicPagesCache(clinicId: string): Promise<void> {
    try {
      const { cacheService } = await import("./cacheService");

      cacheService.clearClinicPages(clinicId);
    } catch (error) {
      console.error("Error clearing clinic pages cache:", error);
    }
  },

  // =================== INITIALIZATION ===================

  /**
   * Initialize system-level permissions and roles
   */
  async initializeSystemPermissions(): Promise<void> {
    try {
      const rolesRef = collection(db, ROLES_COLLECTION);

      const systemRoles = [
        {
          id: "system-owner",
          name: "System Owner",
          description: "Full access to all system features",
          clinicId: null,
          permissions: ["*"],
          isDefault: true,
          isBranchSpecific: false,
          linkedToDoctor: false,
        },
        {
          id: "clinic-admin",
          name: "Clinic Administrator",
          description: "Full administrative access to a clinic",
          clinicId: null,
          permissions: [
            "dashboard:*",
            "patients:*",
            "appointments:*",
            "doctors:*",
            "settings:*",
          ],
          isDefault: true,
          isBranchSpecific: false,
          linkedToDoctor: false,
        },
      ];

      const batch = writeBatch(db);

      for (const roleData of systemRoles) {
        // Use the ID as the document ID
        const docRef = doc(rolesRef, roleData.id);
        batch.set(docRef, {
          ...roleData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      console.log("System permissions initialized successfully.");
    } catch (error) {
      console.error("Error initializing system permissions:", error);
      throw error;
    }
  },

  /**
   * Create default clinic admin role when a new clinic is created
   */
  async createDefaultClinicAdminRole(clinicId: string): Promise<string> {
    try {
      // Get all available pages for this clinic
      const availablePages = await this.getAvailablePagesForClinic(clinicId);
      const allPageIds = availablePages.map((page) => page.id);

      // Create clinic admin role with access to all available pages
      const roleId = await this.createRole({
        name: "Clinic Administrator",
        description: "Full administrative access to all clinic features",
        clinicId,
        permissions: allPageIds, // Give access to all available pages
        isDefault: true,
        isBranchSpecific: false,
        linkedToDoctor: false,
      });

      return roleId;
    } catch (error) {
      console.error("Error creating default clinic admin role:", error);
      throw error;
    }
  },

  /**
   * Create some default roles for a clinic
   */
  async createDefaultClinicRoles(clinicId: string): Promise<void> {
    try {
      const availablePages = await this.getAvailablePagesForClinic(clinicId);
      const pageMap = new Map(
        availablePages.map((page) => [page.path, page.id]),
      );
      const allPageIds = availablePages.map((page) => page.id);

      // Helper function to get page IDs by paths
      const getPageIds = (paths: string[]) =>
        paths.map((path) => pageMap.get(path)).filter((id) => id) as string[];

      const defaultRoles = [
        {
          name: "Clinic Super Admin",
          description: "Full access to all branches and clinic-wide management",
          permissions: allPageIds, // All available pages
          isBranchSpecific: false,
          linkedToDoctor: false,
        },
        {
          name: "Branch Admin",
          description: "Full administrative access to branch operations",
          permissions: getPageIds([
            "/dashboard",
            "/dashboard/patients",
            "/dashboard/appointments",
            "/dashboard/doctors",
            "/dashboard/settings",
            "/dashboard/medicine-management",
            "/dashboard/front-office",
          ]),
          isBranchSpecific: true,
          linkedToDoctor: false,
        },
      ];

      // Create all default roles
      await Promise.all(
        defaultRoles.map((role) =>
          this.createRole({
            ...role,
            clinicId,
            branchId: undefined, // Will be set when assigning to specific branches
            isDefault: true,
          }),
        ),
      );
    } catch (error) {
      console.error("Error creating default clinic roles:", error);
      throw error;
    }
  },

  /**
   * Create default clinic super admin role for multi-branch clinics
   */
  async createDefaultSystemOwnerRole(clinicId: string): Promise<string> {
    try {
      const availablePages = await this.getAvailablePagesForClinic(clinicId);
      const allPageIds = availablePages.map((page) => page.id);

      const roleId = await this.createRole({
        name: "Clinic Super Admin",
        description: "Full access to all branches and clinic-wide management",
        clinicId,
        branchId: undefined, // Clinic-wide role
        permissions: allPageIds,
        isDefault: true,
        isBranchSpecific: false,
        linkedToDoctor: false,
      });

      return roleId;
    } catch (error) {
      console.error("Error creating clinic super admin role:", error);
      throw error;
    }
  },

  /**
   * Create branch-specific roles for a new branch
   */
  async createBranchRoles(clinicId: string, branchId: string): Promise<void> {
    try {
      const availablePages = await this.getAvailablePagesForClinic(clinicId);
      const pageMap = new Map(
        availablePages.map((page) => [page.path, page.id]),
      );

      const getPageIds = (paths: string[]) =>
        paths.map((path) => pageMap.get(path)).filter((id) => id) as string[];

      const branchRoles = [
        {
          name: "Branch Manager",
          description: "Full administrative access to this branch",
          permissions: getPageIds([
            "/dashboard",
            "/dashboard/patients",
            "/dashboard/appointments",
            "/dashboard/doctors",
            "/dashboard/settings",
            "/dashboard/medicine-management",
            "/dashboard/front-office",
          ]),
          linkedToDoctor: false,
        },
      ];

      // Fetch existing branch roles to avoid duplicates
      const existingRoles = await this.getClinicRoles(clinicId);
      const existingKeys = new Set(
        existingRoles
          .filter((r) => r.branchId === branchId)
          .map((r) => `${r.name}`),
      );

      await Promise.all(
        branchRoles
          .filter((role) => !existingKeys.has(role.name))
          .map((role) =>
            this.createRole({
              ...role,
              clinicId,
              branchId,
              isDefault: true,
              isBranchSpecific: true,
            }),
          ),
      );
    } catch (error) {
      console.error("Error creating branch roles:", error);
      throw error;
    }
  },
};
