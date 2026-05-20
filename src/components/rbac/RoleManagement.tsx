import React, { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Textarea,
  Chip,
  Divider,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui";
import { PlusIcon, EditIcon, TrashIcon, MoreVerticalIcon } from "lucide-react";
import { addToast } from "@/components/ui/toast";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@/components/ui/modal";

import { Role, Page } from "../../types/models";
import { rbacService } from "../../services/rbacService";
import { useAuth } from "../../hooks/useAuth";

interface RoleManagementProps {
  clinicId: string;
}

export const RoleManagement: React.FC<RoleManagementProps> = ({ clinicId }) => {
  const { currentUser, userData } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [availablePages, setAvailablePages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
    linkedToDoctor: false,
  });

  useEffect(() => {
    loadData();
  }, [clinicId, userData]);

  const loadData = async () => {
    try {
      setLoading(true);
      const roleFilterOptions: any = {};

      const [rolesData, pagesData] = await Promise.all([
        rbacService.getClinicRoles(clinicId, roleFilterOptions),
        rbacService.getAvailablePagesForClinic(clinicId),
      ]);

      setRoles(rolesData);
      setAvailablePages(pagesData);
    } catch (error) {
      console.error("Error loading data:", error);
      addToast({
        title: "Error",
        description: "Failed to load roles and permissions",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setModalMode("create");
    setSelectedRole(null);
    setFormData({
      name: "",
      description: "",
      permissions: [],
      linkedToDoctor: false,
    });
    onOpen();
  };

  const handleEditRole = (role: Role) => {
    setModalMode("edit");
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      linkedToDoctor: role.linkedToDoctor || false,
    });
    onOpen();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      addToast({
        title: "Missing role name",
        description: "Role name is required",
        color: "danger",
      });

      return;
    }

    try {
      setIsSubmitting(true);

      if (modalMode === "create") {
        // Pre-validate role name uniqueness for better UX (before attempting creation)
        try {
          const nameValidation = await rbacService.validateRoleNameUnique(
            clinicId,
            formData.name,
            undefined, // No branchId in standalone
          );

          if (!nameValidation.valid) {
            console.error("Role name validation failed:", {
              name: formData.name,
              clinicId,
              branchId: undefined,
              validationResult: nameValidation,
            });

            // Log validation failure
            try {
              const { auditLogService } = await import(
                "@/services/auditLogService"
              );

              await auditLogService.logEvent(
                "validation_failed",
                clinicId,
                {
                  operation: "role_creation",
                  validationType: "name_uniqueness",
                  roleName: formData.name,
                  description: formData.description,
                },
                "failure",
                nameValidation.error || "A role with this name already exists",
                {
                  branchId: undefined,
                },
              );
            } catch (logError) {
              console.error("Failed to log validation failure:", logError);
            }

            addToast({
              title: "Role name not unique",
              description:
                nameValidation.error || "A role with this name already exists",
              color: "danger",
            });
            setIsSubmitting(false);

            return;
          }
        } catch (validationError) {
          const errorMessage =
            validationError instanceof Error
              ? validationError.message
              : "Failed to validate role name";

          console.error("Error validating role name:", validationError);

          // Log validation error
          try {
            const { auditLogService } = await import(
              "@/services/auditLogService"
            );

            await auditLogService.logEvent(
              "validation_failed",
              clinicId,
              {
                operation: "role_creation",
                validationType: "name_uniqueness",
                roleName: formData.name,
              },
              "failure",
              errorMessage,
              {
                branchId:
                  false && userData?.branchId
                    ? userData.branchId
                    : undefined,
              },
            );
          } catch (logError) {
            console.error("Failed to log validation error:", logError);
          }

          addToast({
            title: "Validation error",
            description: errorMessage,
            color: "danger",
          });
          setIsSubmitting(false);

          return;
        }

        // Pre-validate permissions if provided
        if (formData.permissions && formData.permissions.length > 0) {
          try {
            const permissionValidation = await rbacService.validatePermissions(
              clinicId,
              formData.permissions,
            );

            if (!permissionValidation.valid) {
              console.error("Permission validation failed:", {
                permissions: formData.permissions,
                clinicId,
                validationResult: permissionValidation,
              });

              // Log validation failure
              try {
                const { auditLogService } = await import(
                  "@/services/auditLogService"
                );

                await auditLogService.logEvent(
                  "validation_failed",
                  clinicId,
                  {
                    operation: "role_creation",
                    validationType: "permission_validation",
                    roleName: formData.name,
                    permissions: formData.permissions,
                    invalidPermissionIds: permissionValidation.invalidIds,
                  },
                  "failure",
                  permissionValidation.error ||
                  "One or more permissions are invalid",
                  {
                    branchId: undefined,
                  },
                );
              } catch (logError) {
                console.error("Failed to log validation failure:", logError);
              }

              addToast({
                title: "Permission validation failed",
                description:
                  permissionValidation.error ||
                  "One or more permissions are invalid",
                color: "danger",
              });
              setIsSubmitting(false);

              return;
            }
          } catch (validationError) {
            const errorMessage =
              validationError instanceof Error
                ? validationError.message
                : "Failed to validate permissions";

            console.error("Error validating permissions:", validationError);

            // Log validation error
            try {
              const { auditLogService } = await import(
                "@/services/auditLogService"
              );

              await auditLogService.logEvent(
                "validation_failed",
                clinicId,
                {
                  operation: "role_creation",
                  validationType: "permission_validation",
                  roleName: formData.name,
                  permissions: formData.permissions,
                },
                "failure",
                errorMessage,
                {
                  branchId: undefined,
                },
              );
            } catch (logError) {
              console.error("Failed to log validation error:", logError);
            }

            addToast({
              title: "Permission validation error",
              description: errorMessage,
              color: "danger",
            });
            setIsSubmitting(false);

            return;
          }
        }

        const roleData = {
          name: formData.name,
          description: formData.description,
          clinicId,
          permissions: formData.permissions,
          isDefault: false,
          isBranchSpecific: false,
          linkedToDoctor: formData.linkedToDoctor,
        };

        try {
          await rbacService.createRole(roleData);
          addToast({
            title: "Role created",
            description: "Role created successfully",
            color: "success",
          });
        } catch (createError) {
          const errorMessage =
            createError instanceof Error
              ? createError.message
              : "Failed to create role";

          console.error("Error creating role:", createError, {
            roleData,
            clinicId,
          });
          addToast({
            title: "Failed to create role",
            description: errorMessage,
            color: "danger",
          });
          setIsSubmitting(false);

          return;
        }
      } else {
        // Update mode - validate name uniqueness (excluding current role)
        if (formData.name !== selectedRole!.name) {
          try {
            const nameValidation = await rbacService.validateRoleNameUnique(
              clinicId,
              formData.name,
              selectedRole!.branchId,
              selectedRole!.id, // Exclude current role
            );

            if (!nameValidation.valid) {
              console.error("Role name validation failed during update:", {
                roleId: selectedRole!.id,
                newName: formData.name,
                validationResult: nameValidation,
              });
              addToast({
                title: "Role name not unique",
                description:
                  nameValidation.error ||
                  "A role with this name already exists",
                color: "danger",
              });
              setIsSubmitting(false);

              return;
            }
          } catch (validationError) {
            const errorMessage =
              validationError instanceof Error
                ? validationError.message
                : "Failed to validate role name";

            console.error(
              "Error validating role name during update:",
              validationError,
            );
            addToast({
              title: "Validation error",
              description: errorMessage,
              color: "danger",
            });
            setIsSubmitting(false);

            return;
          }
        }

        // Validate permissions if being updated
        if (formData.permissions && formData.permissions.length > 0) {
          try {
            const permissionValidation = await rbacService.validatePermissions(
              clinicId,
              formData.permissions,
            );

            if (!permissionValidation.valid) {
              console.error("Permission validation failed during update:", {
                roleId: selectedRole!.id,
                permissions: formData.permissions,
                validationResult: permissionValidation,
              });
              addToast({
                title: "Permission validation failed",
                description:
                  permissionValidation.error ||
                  "One or more permissions are invalid",
                color: "danger",
              });
              setIsSubmitting(false);

              return;
            }
          } catch (validationError) {
            const errorMessage =
              validationError instanceof Error
                ? validationError.message
                : "Failed to validate permissions";

            console.error(
              "Error validating permissions during update:",
              validationError,
            );
            addToast({
              title: "Permission validation error",
              description: errorMessage,
              color: "danger",
            });
            setIsSubmitting(false);

            return;
          }
        }

        try {
          await rbacService.updateRole(selectedRole!.id, {
            name: formData.name,
            description: formData.description,
            permissions: formData.permissions,
            linkedToDoctor: formData.linkedToDoctor,
          });
          addToast({
            title: "Role updated",
            description: "Role updated successfully",
            color: "success",
          });
        } catch (updateError) {
          const errorMessage =
            updateError instanceof Error
              ? updateError.message
              : "Failed to update role";

          console.error("Error updating role:", updateError, {
            roleId: selectedRole!.id,
            updateData: {
              name: formData.name,
              description: formData.description,
              permissions: formData.permissions,
              linkedToDoctor: formData.linkedToDoctor,
            },
          });
          addToast({
            title: "Failed to update role",
            description: errorMessage,
            color: "danger",
          });
          setIsSubmitting(false);

          return;
        }
      }

      await loadData();
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";

      console.error("Error saving role:", error, {
        modalMode,
        roleName: formData.name,
        clinicId,
      });
      addToast({
        title: "Failed to save role",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isDefault) {
      addToast({
        title: "Action not allowed",
        description: "Cannot delete default roles",
        color: "danger",
      });

      return;
    }

    try {
      // First, get all users who have this role assigned
      const usersWithRole = await rbacService.getUsersWithRole(
        role.id,
        clinicId,
      );

      if (usersWithRole.length > 0) {
        const userNames = usersWithRole
          .map((user) => user.displayName)
          .join(", ");

        if (
          !confirm(
            `This role is assigned to ${usersWithRole.length} user(s): ${userNames}. Deleting this role will remove their access until they are reassigned. Continue?`,
          )
        ) {
          return;
        }
      }

      setIsSubmitting(true);

      // Remove role assignments from all users who have this role
      if (usersWithRole.length > 0) {
        const userUpdatePromises = usersWithRole.map(async (user) => {
          // Get current role assignments for this user
          const assignments = await rbacService.getUserRoleAssignments(
            user.id,
            clinicId,
          );
          // Remove the role being deleted
          const remainingRoles = assignments.filter(
            (assignment) => assignment.roleId !== role.id,
          );
          const remainingRoleIds = remainingRoles.map(
            (assignment) => assignment.roleId,
          );

          // Update user's role assignments
          await rbacService.assignRolesToUser(
            user.id,
            remainingRoleIds,
            clinicId,
          );

          // Clear user's permissions cache
          await rbacService.clearUserPermissionsCache(user.id, clinicId);
        });

        const results = await Promise.allSettled(userUpdatePromises);

        // Check for failures and log errors
        const failures = results.filter(
          (result) => result.status === "rejected",
        );

        if (failures.length > 0) {
          console.error(
            `Failed to update ${failures.length} out of ${usersWithRole.length} users:`,
            failures,
          );
          failures.forEach((failure, index) => {
            console.error(`User update ${index} failed:`, failure.reason);
          });

          // Optionally show a warning toast about partial failures
          if (failures.length < usersWithRole.length) {
            addToast({
              title: "Partial update",
              description: `Role deleted but ${failures.length} user(s) could not be updated. Some users may still have this role assigned.`,
              color: "danger",
            });
          }
        }
      }

      // Delete the role
      await rbacService.deleteRole(role.id);

      addToast({
        title: "Role deleted",
        description: `Role "${role.name}" deleted successfully${usersWithRole.length > 0 ? `. ${usersWithRole.length} user(s) affected.` : ""}`,
        color: "success",
      });
      await loadData();
    } catch (error) {
      console.error("Error deleting role:", error);
      addToast({
        title: "Failed to delete role",
        description: "Failed to delete role",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPermissionChips = (permissions: string[]) => {
    const permissionPages = availablePages.filter((page) =>
      permissions.includes(page.id),
    );

    return (
      <div className="flex flex-wrap gap-1">
        {permissionPages.slice(0, 3).map((page) => (
          <Chip key={page.id} color="primary" size="sm" variant="flat">
            {page.name}
          </Chip>
        ))}
        {permissionPages.length > 3 && (
          <Chip color="default" size="sm" variant="flat">
            +{permissionPages.length - 3} more
          </Chip>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold">Role Management</h3>
            <p className="text-sm text-gray-600">
              Manage roles and permissions for your clinic staff
            </p>
          </div>
          <Button
            color="primary"
            startContent={<PlusIcon size={16} />}
            onPress={handleCreateRole}
          >
            {"Create Role"}
          </Button>
        </CardHeader>
        <CardBody>
          <Table aria-label="Roles table">
            <TableHeader>
              <TableRow>
                <TableColumn>NAME</TableColumn>
                <TableColumn>DESCRIPTION</TableColumn>
                <TableColumn>PERMISSIONS</TableColumn>
                <TableColumn>TYPE</TableColumn>
                <TableColumn style={{ width: 80 }}>ACTIONS</TableColumn>
              </TableRow>
            </TableHeader>
            <TableBody emptyContent="No roles found">
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{role.name}</p>
                      {role.isBranchSpecific && (
                        <Chip color="primary" size="sm" variant="flat">
                          Branch Role
                        </Chip>
                      )}
                      {role.linkedToDoctor && (
                        <Chip color="secondary" size="sm" variant="flat">
                          Doctor Linked
                        </Chip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-600 max-w-xs truncate">
                      {role.description}
                    </p>
                  </TableCell>
                  <TableCell>{getPermissionChips(role.permissions)}</TableCell>
                  <TableCell>
                    <Chip
                      color={role.isDefault ? "success" : "default"}
                      size="sm"
                      variant="flat"
                    >
                      {role.isDefault ? "Default" : "Custom"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // Check if branch admin can manage this role
                      const canManage = false
                        ? role.isBranchSpecific &&
                        (!role.branchId ||
                          role.branchId === userData?.branchId) &&
                        !role.isDefault
                        : true;

                      if (!canManage && false) {
                        return (
                          <Chip color="default" size="sm" variant="flat">
                            View Only
                          </Chip>
                        );
                      }

                      return (
                        <Dropdown>
                          <DropdownTrigger>
                            <Button isIconOnly size="sm" variant="light">
                              <MoreVerticalIcon size={16} />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu>
                            <DropdownItem
                              key="edit"
                              startContent={<EditIcon size={14} />}
                              onPress={() => handleEditRole(role)}
                            >
                              Edit Role
                            </DropdownItem>
                            {!role.isDefault && (
                              <DropdownItem
                                key="delete"
                                className="text-danger"
                                color="danger"
                                startContent={<TrashIcon size={14} />}
                                onPress={() => handleDeleteRole(role)}
                              >
                                Delete Role
                              </DropdownItem>
                            )}
                          </DropdownMenu>
                        </Dropdown>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Create/Edit Role Modal */}
      <Modal
        isOpen={isOpen}
        scrollBehavior="inside"
        size="5xl"
        onClose={onClose}
      >
        <ModalContent>
          <ModalHeader>
            {modalMode === "create" ? "Create New Role" : "Edit Role"}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              isRequired
              label="Role Name"
              placeholder="Enter role name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
            />

            <Textarea
              label="Description"
              placeholder="Enter role description"
              rows={2}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />

            <label className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors select-none">
              <div className="flex flex-col">
                <span className="text-[13.5px] font-semibold text-gray-800 dark:text-gray-200">Link to Doctors / Experts</span>
                <span className="text-xs text-gray-500 mt-0.5">
                  When creating users with this role, show doctor/expert selection to auto-fill user details
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.linkedToDoctor}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  formData.linkedToDoctor ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, linkedToDoctor: !prev.linkedToDoctor }))
                }
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    formData.linkedToDoctor ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            <Divider />

            <div>
              <h4 className="text-lg font-medium mb-4">Page Permissions</h4>
              <p className="text-sm text-gray-600 mb-4">
                Select which pages this role can access
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {availablePages.map((page) => {
                  const isChecked = formData.permissions.includes(page.id);
                  return (
                    <label
                      key={page.id}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                        isChecked
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      }`}
                    >
                      <input
                        checked={isChecked}
                        className="sr-only"
                        type="checkbox"
                        onChange={() => {
                          setFormData((prev) => ({
                            ...prev,
                            permissions: isChecked
                              ? prev.permissions.filter((id) => id !== page.id)
                              : [...prev.permissions, page.id],
                          }));
                        }}
                      />
                      <div
                        className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                          isChecked
                            ? "border-purple-600 bg-purple-600"
                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-[12.5px] font-semibold leading-tight truncate ${
                          isChecked ? "text-purple-700 dark:text-purple-300" : "text-gray-800 dark:text-gray-200"
                        }`}>{page.name}</span>
                        <span className="text-[10.5px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{page.path}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isSubmitting}
              onPress={handleSubmit}
            >
              {modalMode === "create" ? "Create Role" : "Update Role"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
