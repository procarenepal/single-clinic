import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import {
  IoPeopleOutline,
  IoArrowBackOutline,
  IoAddOutline,
  IoPersonOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoEllipsisVerticalOutline,
  IoTrashOutline,
  IoShieldCheckmarkOutline,
  IoPencilOutline,
  IoKeyOutline,
} from "react-icons/io5";
import { Link } from "@heroui/link";
import { addToast } from "@heroui/toast";

import { User, Role } from "@/types/models";
import { userService } from "@/services/userService";
import { rbacService } from "@/services/rbacService";
import { useAuthContext } from "@/context/AuthContext";
import { title, subtitle } from "@/components/primitives";

export default function StaffManagementPage() {
  const { clinicId, currentUser, userData } = useAuthContext();
  const isBranchAdmin =
    !!userData?.branchId && userData?.role === "clinic-admin";
  const {
    isOpen: isCreateOpen,
    onOpen: onCreateOpen,
    onClose: onCreateClose,
  } = useDisclosure();
  const {
    isOpen: isRoleOpen,
    onOpen: onRoleOpen,
    onClose: onRoleClose,
  } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();

  // State for staff and data
  const [staff, setStaff] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "",
  });

  const [roleUpdateForm, setRoleUpdateForm] = useState({
    userId: "",
    newRole: "",
  });

  // Available basic roles for staff creation
  const availableRoles = [
    ...(isBranchAdmin ? [] : [{ key: "clinic-admin", label: "Clinic Admin" }]),
    { key: "staff", label: "Staff Member" },
  ];

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [clinicId]);

  const loadData = async () => {
    if (!clinicId) return;

    setIsLoading(true);
    try {
      // Prepare filtering options based on current user's role and branch
      const userFilterOptions: any = {};
      const roleFilterOptions: any = {};

      if (isBranchAdmin && userData?.branchId) {
        // Branch clinic admin - filter on server side
        userFilterOptions.branchId = userData.branchId;
        userFilterOptions.excludeRoles = ["system-owner"];

        roleFilterOptions.branchId = userData.branchId;
        roleFilterOptions.isBranchSpecific = true;
        roleFilterOptions.excludeNames = [
          "Clinic Super Admin",
          "Clinic Administrator",
        ];
      }

      const [staffData, rolesData] = await Promise.all([
        isBranchAdmin
          ? rbacService.getClinicUsersWithRoles(clinicId, userFilterOptions)
          : userService.getUsersByClinic(clinicId),
        rbacService.getClinicRoles(clinicId, roleFilterOptions),
      ]);

      // For branch admin, extract just the user data if we got it from RBAC service
      const processedStaffData =
        isBranchAdmin && Array.isArray(staffData) && staffData[0]?.roles
          ? staffData.map((user: any) => ({ ...user, roles: undefined })) // Remove roles from staff view
          : staffData;

      setStaff(processedStaffData);
      setRoles(rolesData);
    } catch (error) {
      console.error("Error loading staff data:", error);
      addToast({
        title: "Error",
        description: "Failed to load staff data",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle staff creation
  const handleCreateStaff = async () => {
    if (!clinicId || !currentUser) return;

    if (
      !createForm.email ||
      !createForm.password ||
      !createForm.displayName ||
      !createForm.role
    ) {
      addToast({
        title: "Error",
        description: "Please fill in all required fields",
        color: "danger",
      });

      return;
    }

    if (createForm.password.length < 6) {
      addToast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        color: "danger",
      });

      return;
    }

    setIsCreating(true);
    try {
      await userService.createUser(createForm.email, createForm.password, {
        displayName: createForm.displayName,
        role: createForm.role as any,
        clinicId: clinicId,
        ...(isBranchAdmin && userData?.branchId
          ? { branchId: userData.branchId }
          : {}),
      });

      addToast({
        title: "Success",
        description: "Staff member created successfully",
        color: "success",
      });

      // Reset form and reload data
      setCreateForm({ email: "", password: "", displayName: "", role: "" });
      onCreateClose();
      await loadData();
    } catch (error) {
      console.error("Error creating staff member:", error);
      addToast({
        title: "Error",
        description: "Failed to create staff member",
        color: "danger",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle role update
  const handleUpdateRole = async () => {
    if (!roleUpdateForm.userId || !roleUpdateForm.newRole) return;

    try {
      await userService.updateUserRole(
        roleUpdateForm.userId,
        roleUpdateForm.newRole,
      );

      addToast({
        title: "Success",
        description: "User role updated successfully",
        color: "success",
      });

      // Reset form and reload data
      setRoleUpdateForm({ userId: "", newRole: "" });
      onRoleClose();
      await loadData();
    } catch (error) {
      console.error("Error updating role:", error);
      addToast({
        title: "Error",
        description: "Failed to update user role",
        color: "danger",
      });
    }
  };

  // Handle user deactivation
  const handleDeactivateUser = async () => {
    if (!selectedUser) return;

    try {
      await userService.deactivateUser(selectedUser.id);

      addToast({
        title: "Success",
        description: "User deactivated successfully",
        color: "success",
      });

      onDeleteClose();
      setSelectedUser(null);
      await loadData();
    } catch (error) {
      console.error("Error deactivating user:", error);
      addToast({
        title: "Error",
        description: "Failed to deactivate user",
        color: "danger",
      });
    }
  };

  // Get role display name
  const getRoleDisplayName = (role: string) => {
    const roleMap: { [key: string]: string } = {
      "clinic-admin": "Clinic Admin",
      staff: "Staff Member",
    };

    return roleMap[role] || role;
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case "clinic-admin":
        return "danger";
      case "staff":
        return "primary";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={title({ size: "lg" })}>Staff & User Management</h1>
            <p className={subtitle({ class: "mt-1" })}>
              Manage clinic staff, roles, and permissions
            </p>
          </div>
        </div>

        <Card shadow="sm">
          <CardBody className="flex items-center justify-center py-12">
            <Spinner label="Loading staff information..." size="lg" />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={title({ size: "lg" })}>Staff & User Management</h1>
            <p className={subtitle({ class: "mt-1" })}>
              Manage clinic staff, roles, and permissions
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              as={Link}
              href="/dashboard/settings"
              startContent={<IoArrowBackOutline />}
              variant="light"
            >
              Back to Settings
            </Button>
            <Button
              color="primary"
              startContent={<IoAddOutline />}
              onPress={onCreateOpen}
            >
              Add Staff Member
            </Button>
          </div>
        </div>

        {/* Staff Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card shadow="sm">
            <CardBody className="flex flex-row items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <IoPeopleOutline className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-stat font-bold">{staff.length}</p>
                <p className="text-sm text-default-500">Total Staff</p>
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm">
            <CardBody className="flex flex-row items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <IoShieldCheckmarkOutline className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-stat font-bold">
                  {staff.filter((s) => s.isActive).length}
                </p>
                <p className="text-sm text-default-500">Active Staff</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Main Content */}
        <Card shadow="sm">
          <CardBody>
            <div className="mt-6">
              {staff.length === 0 ? (
                <div className="text-center py-12">
                  <IoPeopleOutline className="w-16 h-16 mx-auto mb-4 text-default-300" />
                  <h3 className="text-stat-sm font-semibold text-default-600 mb-2">
                    No staff members yet
                  </h3>
                  <p className="text-default-500 mb-6">
                    Get started by adding your first staff member
                  </p>
                  <Button
                    color="primary"
                    startContent={<IoAddOutline />}
                    onPress={onCreateOpen}
                  >
                    Add Staff Member
                  </Button>
                </div>
              ) : (
                <Table aria-label="Staff members table">
                  <TableHeader>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Email</TableColumn>
                    <TableColumn>Role</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <IoPersonOutline className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium">
                              {member.displayName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Chip
                            color={getRoleColor(member.role)}
                            size="sm"
                            variant="flat"
                          >
                            {getRoleDisplayName(member.role)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            color={member.isActive ? "success" : "danger"}
                            size="sm"
                            startContent={
                              member.isActive ? (
                                <IoCheckmarkCircleOutline />
                              ) : (
                                <IoCloseCircleOutline />
                              )
                            }
                            variant="flat"
                          >
                            {member.isActive ? "Active" : "Inactive"}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button isIconOnly size="sm" variant="light">
                                <IoEllipsisVerticalOutline />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu>
                              <DropdownItem
                                key="edit-role"
                                startContent={<IoPencilOutline />}
                                onPress={() => {
                                  setRoleUpdateForm({
                                    userId: member.id,
                                    newRole: member.role,
                                  });
                                  onRoleOpen();
                                }}
                              >
                                Edit Role
                              </DropdownItem>
                              <DropdownItem
                                key="deactivate"
                                className="text-danger"
                                color="danger"
                                startContent={<IoTrashOutline />}
                                onPress={() => {
                                  setSelectedUser(member);
                                  onDeleteOpen();
                                }}
                              >
                                Deactivate
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Create Staff Modal */}
      <Modal isOpen={isCreateOpen} size="md" onClose={onCreateClose}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <IoAddOutline className="w-5 h-5" />
              <h3>Add Staff Member</h3>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                label="Email Address"
                placeholder="staff@example.com"
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />

              <Input
                isRequired
                label="Full Name"
                placeholder="John Doe"
                type="text"
                value={createForm.displayName}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
              />

              <Input
                isRequired
                label="Password"
                placeholder="Enter password (min 6 characters)"
                startContent={<IoKeyOutline className="text-default-400" />}
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />

              <Select
                isRequired
                label="Role"
                placeholder="Select a role"
                selectedKeys={createForm.role ? [createForm.role] : []}
                onSelectionChange={(keys) => {
                  const role = Array.from(keys)[0] as string;

                  setCreateForm((prev) => ({ ...prev, role }));
                }}
              >
                {availableRoles.map((role) => (
                  <SelectItem key={role.key}>{role.label}</SelectItem>
                ))}
              </Select>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  The staff member will be able to log in immediately with these
                  credentials. They can change their password after logging in.
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCreateClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isCreating}
              startContent={!isCreating && <IoAddOutline />}
              onPress={handleCreateStaff}
            >
              Create Staff Member
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Role Modal */}
      <Modal isOpen={isRoleOpen} size="md" onClose={onRoleClose}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <IoPencilOutline className="w-5 h-5" />
              <h3>Update User Role</h3>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select
                isRequired
                label="New Role"
                placeholder="Select a new role"
                selectedKeys={
                  roleUpdateForm.newRole ? [roleUpdateForm.newRole] : []
                }
                onSelectionChange={(keys) => {
                  const role = Array.from(keys)[0] as string;

                  setRoleUpdateForm((prev) => ({ ...prev, newRole: role }));
                }}
              >
                {availableRoles.map((role) => (
                  <SelectItem key={role.key}>{role.label}</SelectItem>
                ))}
              </Select>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Changing a user's role will immediately update their access
                  permissions throughout the system.
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onRoleClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              startContent={<IoCheckmarkCircleOutline />}
              onPress={handleUpdateRole}
            >
              Update Role
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} size="md" onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <IoTrashOutline className="w-5 h-5 text-danger" />
              <h3>Deactivate User</h3>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedUser && (
              <div className="space-y-4">
                <p className="text-default-700">
                  Are you sure you want to deactivate{" "}
                  <strong>{selectedUser.displayName}</strong>?
                </p>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    This will immediately revoke their access to the system.
                    This action can be reversed later if needed.
                  </p>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onDeleteClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              startContent={<IoTrashOutline />}
              onPress={handleDeactivateUser}
            >
              Deactivate User
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
