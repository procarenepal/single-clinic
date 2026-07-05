import React, { useState, useEffect } from "react";
import {
  PlusIcon,
  EditIcon,
  UserIcon,
  ShieldIcon,
  MoreVerticalIcon,
  SearchIcon,
} from "lucide-react";

import { Role, UserRole, Doctor, Expert } from "../../types/models";
import { rbacService } from "../../services/rbacService";
import { userService } from "../../services/userService";
import { doctorService } from "../../services/doctorService";
import { expertService } from "../../services/expertService";
import { useAuthContext } from "../../context/AuthContext";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@/components/ui/modal";
import { addToast } from "@/components/ui/toast";
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
  Select,
  SelectItem,
  Chip,
  Avatar,
  CheckboxGroup,
  Checkbox,
  Divider,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui";

interface UserManagementProps {
  clinicId: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ clinicId }) => {
  const { currentUser, userData } = useAuthContext();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isRoleModalOpen,
    onOpen: onRoleModalOpen,
    onClose: onRoleModalClose,
  } = useDisclosure();

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  const [formData, setFormData] = useState({
    email: "",
    displayName: "",
    password: "",
    adminPassword: "",
    selectedRoles: [] as string[],
    linkedProfileId: "", // New field for doctor/expert selection
  });

  useEffect(() => {
    loadData();
  }, [clinicId, userData]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Prepare filtering options based on current user's role and branch
      const userFilterOptions: any = {};
      const roleFilterOptions: any = {};

      const [usersData, rolesData, doctorsData, expertsData] =
        await Promise.all([
          rbacService.getClinicUsersWithRoles(clinicId, userFilterOptions),
          rbacService.getClinicRoles(clinicId, roleFilterOptions),
          doctorService.getDoctorsByClinic(clinicId),
          expertService.getExpertsByClinic(clinicId),
        ]);

      setUsers(usersData);
      setRoles(rolesData);
      setDoctors(doctorsData.filter((doc) => doc.isActive));
      setExperts(expertsData.filter((exp) => exp.isActive));
    } catch (error) {
      console.error("Error loading data:", error);
      addToast({
        title: "Error",
        description: "Failed to load users and roles",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setModalMode("create");
    setSelectedUser(null);
    setFormData({
      email: "",
      displayName: "",
      password: "",
      adminPassword: "",
      selectedRoles: [],
      linkedProfileId: "",
    });
    onOpen();
  };

  const handleEditUser = (user: any) => {
    setModalMode("edit");
    setSelectedUser(user);
    setFormData({
      email: user.email,
      displayName: user.displayName,
      password: "", // Don't pre-fill password for editing
      adminPassword: "", // Not needed for editing
      selectedRoles: user.roles.map((role: Role) => role.id),
      linkedProfileId: "",
    });
    onOpen();
  };

  const handleManageRoles = (user: any) => {
    setSelectedUser(user);
    setFormData((prev) => ({
      ...prev,
      selectedRoles: user.roles.map((role: Role) => role.id),
    }));
    onRoleModalOpen();
  };

  const handleDoctorSelection = (doctorId: string) => {
    const selectedDoctor = doctors.find((doc) => doc.id === doctorId);

    if (selectedDoctor) {
      setFormData((prev) => ({
        ...prev,
        linkedProfileId: doctorId,
        // Only update email if the selected doctor has an email, otherwise preserve existing email
        email: selectedDoctor.email ? selectedDoctor.email : prev.email,
        displayName: selectedDoctor.name,
      }));
    }
  };

  const handleExpertSelection = (expertId: string) => {
    const selectedExpert = experts.find((exp) => exp.id === expertId);

    if (selectedExpert) {
      setFormData((prev) => ({
        ...prev,
        linkedProfileId: expertId,
        email: selectedExpert.email ? selectedExpert.email : prev.email,
        displayName: selectedExpert.name,
      }));
    }
  };

  // Check if any of the selected roles are linked to doctors/experts
  const isRoleLinkedToDoctor = () => {
    return formData.selectedRoles.some((roleId) => {
      const role = roles.find((r) => r.id === roleId);

      return role?.linkedToDoctor || false;
    });
  };

  // Check if the linked role is an Expert role (with fallback for legacy roles)
  const isRoleLinkedToExpert = () => {
    return formData.selectedRoles.some((roleId) => {
      const role = roles.find((r) => r.id === roleId);

      return (
        role?.linkedToExpert ||
        (role?.linkedToDoctor && role?.name.toLowerCase().includes("expert")) ||
        false
      );
    });
  };

  const handleSubmit = async () => {
    if (!formData.email.trim() || !formData.displayName.trim()) {
      addToast({
        title: "Missing information",
        description: "Email and display name are required",
        color: "danger",
      });

      return;
    }

    if (modalMode === "create" && !formData.password.trim()) {
      addToast({
        title: "Invalid password",
        description: "Password is required for new users",
        color: "danger",
      });

      return;
    }

    if (modalMode === "create" && formData.password.length < 6) {
      addToast({
        title: "Weak password",
        description: "Password must be at least 6 characters long",
        color: "danger",
      });

      return;
    }

    if (modalMode === "create" && !formData.adminPassword.trim()) {
      addToast({
        title: "Admin password required",
        description: "Your admin password is required to create new users",
        color: "danger",
      });

      return;
    }

    try {
      setIsSubmitting(true);

      if (modalMode === "create") {
        // Validate that at least one RBAC role is selected
        if (formData.selectedRoles.length === 0) {
          addToast({
            title: "Roles required",
            description: "Please select at least one role for the user",
            color: "danger",
          });
          setIsSubmitting(false);

          return;
        }

        // Validate roles BEFORE creating user to avoid rollback scenarios
        try {
          const roleValidation = await rbacService.validateRoleIds(
            clinicId,
            formData.selectedRoles,
          );

          if (!roleValidation.valid) {
            const errorMessage =
              roleValidation.error || "One or more selected roles are invalid";

            console.error("Role validation failed before user creation:", {
              clinicId,
              selectedRoles: formData.selectedRoles,
              validationResult: roleValidation,
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
                  operation: "user_creation",
                  validationType: "role_validation",
                  selectedRoles: formData.selectedRoles,
                  invalidRoleIds: roleValidation.invalidIds,
                  userEmail: formData.email,
                  userName: formData.displayName,
                },
                "failure",
                errorMessage,
                {
                  branchId: undefined,
                },
              );
            } catch (logError) {
              console.error("Failed to log validation failure:", logError);
            }

            addToast({
              title: "Role validation failed",
              description: errorMessage,
              color: "danger",
            });
            setIsSubmitting(false);

            return;
          }
        } catch (validationError) {
          const errorMessage =
            validationError instanceof Error
              ? validationError.message
              : "Failed to validate roles. Please try again.";

          console.error(
            "Error validating roles before user creation:",
            validationError,
            {
              clinicId,
              selectedRoles: formData.selectedRoles,
            },
          );

          // Log validation error
          try {
            const { auditLogService } = await import(
              "@/services/auditLogService"
            );

            await auditLogService.logEvent(
              "validation_failed",
              clinicId,
              {
                operation: "user_creation",
                validationType: "role_validation",
                selectedRoles: formData.selectedRoles,
                userEmail: formData.email,
                userName: formData.displayName,
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
            title: "Role validation error",
            description: errorMessage,
            color: "danger",
          });
          setIsSubmitting(false);

          return;
        }

        // Prepare user data with appropriate branch assignment
        const newUserData: any = {
          displayName: formData.displayName,
          clinicId,
          role: "staff" as UserRole, // Default role for system access
          isActive: true,
        };

        // If current user is a branch admin, assign new user to the same branch
        if (userData && userData.branchId) {
          newUserData.branchId = userData.branchId;
        }

        let userId: string;

        try {
          // Create new user with provided password (using complex approach to maintain admin session)
          userId = await userService.createUser(
            formData.email,
            formData.password,
            newUserData,
            formData.adminPassword, // Pass admin password to maintain session
          );
        } catch (userCreationError) {
          const errorMessage =
            userCreationError instanceof Error
              ? userCreationError.message
              : "Failed to create user account";

          console.error("Error creating user:", userCreationError, {
            email: formData.email,
            clinicId,
          });

          addToast({
            title: "User creation failed",
            description: errorMessage,
            color: "danger",
          });
          setIsSubmitting(false);

          return;
        }

        // Assign RBAC roles to the user (roles already validated above)
        try {
          await rbacService.assignRolesToUser(
            userId,
            formData.selectedRoles,
            clinicId,
          );
        } catch (roleAssignmentError) {
          // If role assignment fails after user creation, deactivate the user
          try {
            await userService.deactivateUser(userId);
            console.warn(
              "User created but role assignment failed. User has been deactivated:",
              {
                userId,
                email: formData.email,
              },
            );
          } catch (deactivateError) {
            console.error(
              "Failed to deactivate user after role assignment failure:",
              deactivateError,
            );
          }

          const errorMessage =
            roleAssignmentError instanceof Error
              ? roleAssignmentError.message
              : "Failed to assign roles to user";

          console.error("Error assigning roles to user:", roleAssignmentError, {
            userId,
            selectedRoles: formData.selectedRoles,
            clinicId,
          });
          addToast({
            title: "Role assignment failed",
            description: `User created but role assignment failed: ${errorMessage}. The user account has been deactivated. Please contact support.`,
            color: "danger",
          });
          setIsSubmitting(false);
          await loadData(); // Reload to show the deactivated user

          return;
        }

        // Sync doctor/expert profile email if linked
        if (formData.linkedProfileId) {
          try {
            if (isRoleLinkedToExpert()) {
              await expertService.updateExpert(formData.linkedProfileId, {
                email: formData.email,
              });
            } else if (isRoleLinkedToDoctor()) {
              await doctorService.updateDoctor(formData.linkedProfileId, {
                email: formData.email,
              });
            }
          } catch (syncError) {
            console.error("Error syncing profile email:", syncError);
          }
        }

        addToast({
          title: "User created",
          description: "User created successfully with the provided password.",
          color: "success",
        });
      } else {
        // Update existing user
        try {
          await userService.updateUser(selectedUser!.id, {
            displayName: formData.displayName,
          });
        } catch (updateError) {
          const errorMessage =
            updateError instanceof Error
              ? updateError.message
              : "Failed to update user information";

          console.error("Error updating user:", updateError, {
            userId: selectedUser!.id,
          });

          addToast({
            title: "Update failed",
            description: errorMessage,
            color: "danger",
          });
          setIsSubmitting(false);

          return;
        }

        // Validate roles before assignment
        if (formData.selectedRoles.length > 0) {
          try {
            const roleValidation = await rbacService.validateRoleIds(
              clinicId,
              formData.selectedRoles,
            );

            if (!roleValidation.valid) {
              const errorMessage =
                roleValidation.error ||
                "One or more selected roles are invalid";

              console.error("Role validation failed during user update:", {
                userId: selectedUser!.id,
                selectedRoles: formData.selectedRoles,
                validationResult: roleValidation,
              });
              addToast({
                title: "Role validation failed",
                description: errorMessage,
                color: "danger",
              });
              setIsSubmitting(false);

              return;
            }
          } catch (validationError) {
            const errorMessage =
              validationError instanceof Error
                ? validationError.message
                : "Failed to validate roles";

            console.error(
              "Error validating roles during user update:",
              validationError,
            );
            addToast({
              title: "Role validation error",
              description: errorMessage,
              color: "danger",
            });
            setIsSubmitting(false);

            return;
          }
        }

        // Update RBAC role assignments
        try {
          await rbacService.assignRolesToUser(
            selectedUser!.id,
            formData.selectedRoles,
            clinicId,
          );
        } catch (roleAssignmentError) {
          const errorMessage =
            roleAssignmentError instanceof Error
              ? roleAssignmentError.message
              : "Failed to update role assignments";

          console.error(
            "Error updating role assignments:",
            roleAssignmentError,
            {
              userId: selectedUser!.id,
              selectedRoles: formData.selectedRoles,
              clinicId,
            },
          );

          addToast({
            title: "Role assignment failed",
            description: errorMessage,
            color: "danger",
          });
          setIsSubmitting(false);

          return;
        }

        // Sync doctor/expert profile email if linked
        if (formData.linkedProfileId) {
          try {
            if (isRoleLinkedToExpert()) {
              await expertService.updateExpert(formData.linkedProfileId, {
                email: selectedUser!.email,
              });
            } else if (isRoleLinkedToDoctor()) {
              await doctorService.updateDoctor(formData.linkedProfileId, {
                email: selectedUser!.email,
              });
            }
          } catch (syncError) {
            console.error("Error syncing profile email:", syncError);
          }
        }

        addToast({
          title: "User updated",
          description: "User updated successfully",
          color: "success",
        });
      }

      await loadData();
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";

      console.error("Error saving user:", error, {
        modalMode,
        email: formData.email,
        clinicId,
      });
      addToast({
        title: "Failed to save user",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRoles = async () => {
    if (!selectedUser) return;

    try {
      setIsSubmitting(true);
      await rbacService.assignRolesToUser(
        selectedUser.id,
        formData.selectedRoles,
        clinicId,
      );
      addToast({
        title: "Roles updated",
        description: "User roles updated successfully",
        color: "success",
      });
      await loadData();
      onRoleModalClose();
    } catch (error) {
      console.error("Error updating roles:", error);
      addToast({
        title: "Failed to update roles",
        description: "Failed to update user roles",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (user: any) => {
    try {
      await userService.setUserActive(user.id, !user.isActive);
      addToast({
        title: "User status updated",
        description: `User ${user.isActive ? "deactivated" : "activated"} successfully`,
        color: "success",
      });
      await loadData();
    } catch (error) {
      console.error("Error toggling user status:", error);
      addToast({
        title: "Failed to update status",
        description: "Failed to update user status",
        color: "danger",
      });
    }
  };

  const getUserRoleChips = (userRoles: Role[]) => {
    return (
      <div className="flex flex-wrap gap-1">
        {userRoles.slice(0, 2).map((role) => (
          <Chip key={role.id} color="primary" size="sm" variant="flat">
            {role.name}
          </Chip>
        ))}
        {userRoles.length > 2 && (
          <Chip color="default" size="sm" variant="flat">
            +{userRoles.length - 2} more
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

  const filteredUsers = users.filter((user) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower);

    // Role filter
    const matchesRole =
      roleFilter === "all" || user.roles.some((r: any) => r.id === roleFilter);

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <Card className="shadow-none border border-divider">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-semibold">User Management</h3>
            <p className="text-sm text-gray-600">
              Create and manage clinic staff with role-based permissions
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Input
              className="w-full sm:w-64"
              placeholder="Search users..."
              startContent={<SearchIcon className="text-gray-400" size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select
              className="w-full sm:w-48"
              placeholder="Filter by role"
              selectedKeys={[roleFilter]}
              onSelectionChange={(keys) =>
                setRoleFilter(Array.from(keys)[0] as string)
              }
            >
              <SelectItem key="all" value="all">
                All Roles
              </SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </Select>
            <Button
              color="primary"
              startContent={<PlusIcon size={16} />}
              onPress={handleCreateUser}
            >
              Create User
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Users table">
            <TableHeader>
              <TableRow>
                <TableColumn>USER</TableColumn>
                <TableColumn>EMAIL</TableColumn>
                <TableColumn>ROLES</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn style={{ width: 80 }}>ACTIONS</TableColumn>
              </TableRow>
            </TableHeader>
            <TableBody emptyContent="No users found matching your filters.">
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={user.displayName}
                        size="sm"
                        src={user.photoURL}
                      />
                      <div>
                        <p className="font-medium">{user.displayName}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{user.email}</p>
                  </TableCell>
                  <TableCell>
                    {user.roles.length > 0 ? (
                      <div className="flex items-center gap-2">
                        {getUserRoleChips(user.roles)}
                      </div>
                    ) : (
                      <Chip color="warning" size="sm" variant="flat">
                        No roles assigned
                      </Chip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={user.isActive ? "success" : "danger"}
                      size="sm"
                      variant="flat"
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Chip>
                  </TableCell>
                  <TableCell>
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
                          onPress={() => handleEditUser(user)}
                        >
                          Edit User
                        </DropdownItem>
                        <DropdownItem
                          key="roles"
                          startContent={<ShieldIcon size={14} />}
                          onPress={() => handleManageRoles(user)}
                        >
                          Manage Roles
                        </DropdownItem>
                        <DropdownItem
                          key="toggle"
                          startContent={<UserIcon size={14} />}
                          onPress={() => handleToggleUserStatus(user)}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Create/Edit User Modal */}
      <Modal
        isOpen={isOpen}
        scrollBehavior="inside"
        size="lg"
        onClose={onClose}
      >
        <ModalContent>
          <ModalHeader>
            {modalMode === "create" ? "Create New User" : "Edit User"}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <h4 className="text-lg font-medium mb-2">
                Role Assignments (Required)
              </h4>
              <div className="bg-green-50 p-3 rounded-lg border border-green-200 mb-4">
                <p className="text-sm text-green-800">
                  <strong>User Permissions:</strong> Select roles that control
                  which pages and features this user can access. You can assign
                  multiple roles for combined permissions. At least one role is
                  required.
                </p>
              </div>

              <CheckboxGroup
                className="space-y-2"
                value={formData.selectedRoles}
                onValueChange={(values) => {
                  setFormData((prev) => ({
                    ...prev,
                    selectedRoles: values,
                    linkedProfileId: "", // Reset profile selection when roles change
                  }));
                }}
              >
                {roles.map((role) => (
                  <Checkbox
                    key={role.id}
                    className="max-w-none"
                    value={role.id}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.name}</span>
                        {(role.linkedToDoctor || role.linkedToExpert) && (
                          <Chip color="secondary" size="sm" variant="flat">
                            {role.linkedToExpert ||
                            (role.linkedToDoctor &&
                              role.name.toLowerCase().includes("expert"))
                              ? "Expert Linked"
                              : "Doctor Linked"}
                          </Chip>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {role.description}
                      </span>
                    </div>
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </div>

            {/* Doctor/Expert Selection for roles linked to doctors/experts */}
            {modalMode === "create" &&
              (isRoleLinkedToDoctor() || isRoleLinkedToExpert()) && (
                <div>
                  {isRoleLinkedToExpert() ? (
                    <Select
                      description="Selecting an expert will automatically fill email and display name"
                      label="Select Expert (Auto-fill Details)"
                      placeholder="Choose an expert to auto-fill user details"
                      selectedKeys={
                        formData.linkedProfileId
                          ? [formData.linkedProfileId]
                          : []
                      }
                      onSelectionChange={(keys) => {
                        const expertId = Array.from(keys)[0] as string;

                        handleExpertSelection(expertId);
                      }}
                    >
                      {experts.map((expert) => (
                        <SelectItem key={expert.id}>
                          {expert.name} ({expert.speciality})
                        </SelectItem>
                      ))}
                    </Select>
                  ) : (
                    <Select
                      description="Selecting a doctor will automatically fill email and display name"
                      label="Select Doctor (Auto-fill Details)"
                      placeholder="Choose a doctor to auto-fill user details"
                      selectedKeys={
                        formData.linkedProfileId
                          ? [formData.linkedProfileId]
                          : []
                      }
                      onSelectionChange={(keys) => {
                        const doctorId = Array.from(keys)[0] as string;

                        handleDoctorSelection(doctorId);
                      }}
                    >
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id}>
                          {doctor.name} ({doctor.speciality})
                        </SelectItem>
                      ))}
                    </Select>
                  )}
                </div>
              )}

            <Divider />

            <Input
              isRequired
              isDisabled={modalMode === "edit"}
              label="Email"
              placeholder="Enter user email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
            />

            <Input
              isRequired
              label="Display Name"
              placeholder="Enter display name"
              value={formData.displayName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  displayName: e.target.value,
                }))
              }
            />

            {modalMode === "create" && (
              <>
                <Input
                  isRequired
                  description="Minimum 6 characters"
                  label="Password"
                  placeholder="Enter password for new user"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />

                <Input
                  isRequired
                  color="warning"
                  description="Required to maintain your admin session while creating the user"
                  label="Your Admin Password"
                  placeholder="Enter your current admin password"
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      adminPassword: e.target.value,
                    }))
                  }
                />
              </>
            )}
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
              {modalMode === "create" ? "Create User" : "Update User"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Manage Roles Modal */}
      <Modal isOpen={isRoleModalOpen} size="lg" onClose={onRoleModalClose}>
        <ModalContent>
          <ModalHeader>
            Manage Roles for {selectedUser?.displayName}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>Role Assignments:</strong> Select roles that control
                  which pages and features this user can access. Multiple roles
                  can be assigned for combined permissions.
                </p>
              </div>

              <CheckboxGroup
                className="space-y-2"
                value={formData.selectedRoles}
                onValueChange={(values) =>
                  setFormData((prev) => ({
                    ...prev,
                    selectedRoles: values,
                  }))
                }
              >
                {roles.map((role) => (
                  <Checkbox
                    key={role.id}
                    className="max-w-none"
                    value={role.id}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.name}</span>
                        {(role.linkedToDoctor || role.linkedToExpert) && (
                          <Chip color="secondary" size="sm" variant="flat">
                            {role.linkedToExpert ||
                            (role.linkedToDoctor &&
                              role.name.toLowerCase().includes("expert"))
                              ? "Expert Linked"
                              : "Doctor Linked"}
                          </Chip>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {role.description}
                      </span>
                    </div>
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onRoleModalClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isSubmitting}
              onPress={handleUpdateRoles}
            >
              Update Roles
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
