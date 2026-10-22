import { useState, useEffect, Fragment } from "react";
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
  IoSearchOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import { Link } from "@heroui/link";
import { addToast } from "@heroui/toast";

import { User, UserRole } from "@/types/models";
import { userService } from "@/services/userService";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { specialityService } from "@/services/specialityService";
import { rbacService } from "@/services/rbacService";
import {
  normalizeEmail,
  missingClinicalFields,
  detectEmailCollision,
  emailCollisionMessage,
} from "@/services/core/staffCreationCore";
import { useAuthContext } from "@/context/AuthContext";
import { title, subtitle } from "@/components/primitives";

// A "Doctor"/"Expert" login needs a matching clinical profile — these are
// the extra fields their profile requires that a plain staff login doesn't.
// Collected inline here so Staff Management can create both records in one
// step instead of sending the admin to a separate "Add Doctor"/"Add Expert"
// page afterward (see ClinicalProfileLoginAccess for the reverse case: a
// profile that already exists but has no login yet).
const CLINICAL_ROLES: UserRole[] = ["doctor", "expert"];

export default function StaffManagementPage() {
  const { clinicId, currentUser, userData } = useAuthContext();
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
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Search/filter — this list has no pagination, so once a clinic has more
  // than a handful of staff/doctor/expert logins, finding one person meant
  // scrolling an unfiltered table. Mirrors the pattern already used on
  // doctors.tsx and the separate Settings > RBAC > User Management screen.
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Matches doctors.tsx's page size

  // Form states
  const [createForm, setCreateForm] = useState({
    email: "",
    displayName: "",
    role: "",
    phone: "",
    speciality: "",
    licenseNumber: "",
    practitionerType: "",
    defaultCommission: "",
    consultationCharge: "",
  });

  const [roleUpdateForm, setRoleUpdateForm] = useState({
    userId: "",
    newRole: "",
  });

  const [specialities, setSpecialities] = useState<
    Array<{ key: string; label: string }>
  >([]);

  // Available roles for staff creation. Doctor/Expert are real UserRole
  // values the rest of the app already understands (RBAC, dashboards) — the
  // gap this page used to have wasn't that those roles didn't exist, it's
  // that there was no way to create one here at all.
  const availableRoles = [
    { key: "clinic-admin", label: "Clinic Admin" },
    { key: "staff", label: "Staff Member" },
    { key: "doctor", label: "Doctor" },
    { key: "expert", label: "Expert" },
  ];

  // Role changes stay between non-clinical roles — switching an existing
  // login to/from Doctor or Expert would also need a clinical profile
  // created or reconciled, which "Add Staff Member" already handles
  // properly for a brand-new person. Keeping this list separate avoids a
  // half-built "edit role" path that silently skips the profile step.
  const editableRoles = availableRoles.filter(
    (r) => !CLINICAL_ROLES.includes(r.key as UserRole),
  );

  const isClinicalRole = CLINICAL_ROLES.includes(createForm.role as UserRole);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    specialityService
      .getActiveSpecialitiesForDropdown(clinicId)
      .then((data: Array<{ key: string; label: string }>) =>
        setSpecialities(data),
      )
      .catch((error) =>
        console.error("Error loading specialities:", error),
      );
  }, [clinicId]);

  const loadData = async () => {
    if (!clinicId) return;

    setIsLoading(true);
    try {
      const staffData = await userService.getUsersByClinic(clinicId);

      setStaff(staffData);
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

    if (!createForm.email || !createForm.displayName || !createForm.role) {
      addToast({
        title: "Error",
        description: "Please fill in all required fields",
        color: "danger",
      });

      return;
    }

    const normalizedEmail = normalizeEmail(createForm.email);

    if (isClinicalRole) {
      const missing = missingClinicalFields(createForm);

      if (missing.length > 0) {
        addToast({
          title: "Error",
          description:
            missing.length === 1 && missing[0] === "speciality" &&
            specialities.length === 0
              ? "No specialities are configured yet — add one in Settings > Doctor Speciality first."
              : `Please fill in all required ${createForm.role} fields`,
          color: "danger",
        });

        return;
      }
    }

    setIsCreating(true);
    try {
      const branchId = userData?.branchId || clinicId;

      if (isClinicalRole) {
        // A duplicate-email create used to be caught only after the fact,
        // if at all — it would write a real clinical profile and then
        // surface the collision as a generic "login failed" toast once
        // userService.createUser's own createUserWithEmailAndPassword threw.
        // Checking first means nothing is created at all when the email is
        // already in use, instead of leaving an orphaned/duplicate profile.
        const [existingLogin, existingDoctor, existingExpert] =
          await Promise.all([
            userService.getUserByEmail(normalizedEmail),
            createForm.role === "doctor"
              ? doctorService.getDoctorByEmail(normalizedEmail, clinicId)
              : Promise.resolve(null),
            createForm.role === "expert"
              ? expertService.getExpertByEmail(normalizedEmail, clinicId)
              : Promise.resolve(null),
          ]);
        const collision = detectEmailCollision(
          !!existingLogin,
          !!existingDoctor || !!existingExpert,
        );

        if (collision) {
          addToast({
            title: "Email already in use",
            description: emailCollisionMessage(collision),
            color: "danger",
          });
          setIsCreating(false);

          return;
        }

        // The clinical profile is the record every other screen in the app
        // actually reads (appointments, billing, patient rows) — create it
        // first so a login failure afterward still leaves a usable profile
        // behind (same recovery path ClinicalProfileLoginAccess offers for
        // a profile created without a login in the first place).
        if (createForm.role === "doctor") {
          await doctorService.createDoctor({
            name: createForm.displayName,
            doctorType: createForm.practitionerType as "regular" | "visiting",
            defaultCommission: parseFloat(createForm.defaultCommission) || 0,
            speciality: createForm.speciality,
            phone: createForm.phone,
            email: normalizedEmail,
            nmcNumber: createForm.licenseNumber,
            consultationCharge: parseFloat(createForm.consultationCharge) || 0,
            clinicId,
            branchId,
            createdBy: currentUser.uid,
          });
        } else {
          await expertService.createExpert({
            name: createForm.displayName,
            expertType: createForm.practitionerType as "regular" | "visiting",
            defaultCommission: parseFloat(createForm.defaultCommission) || 0,
            speciality: createForm.speciality,
            phone: createForm.phone,
            email: normalizedEmail,
            licenseNumber: createForm.licenseNumber,
            clinicId,
            branchId,
            createdBy: currentUser.uid,
          });
        }

        try {
          const newUserId = await userService.createUser(
            normalizedEmail,
            undefined,
            {
              displayName: createForm.displayName,
              role: createForm.role as UserRole,
              clinicId,
              branchId,
              phone: createForm.phone,
            },
            undefined,
            "staff-management",
          );

          // Without this, the new login has zero RBAC pages assigned and
          // their own dashboard's links to Patients/Appointments/
          // Prescriptions are all blocked by default — see
          // ensureDefaultClinicalRoleAssigned's doc comment.
          try {
            await rbacService.ensureDefaultClinicalRoleAssigned(
              clinicId,
              newUserId,
              createForm.role as "doctor" | "expert",
            );
            addToast({
              title: "Success",
              description: `${createForm.role === "doctor" ? "Doctor" : "Expert"} created with login and dashboard access.`,
              color: "success",
            });
          } catch (rbacError: any) {
            addToast({
              title: "Login created, access setup incomplete",
              description:
                "The login was created, but their dashboard permissions could not be set automatically. Assign a role from Settings > RBAC > User Management.",
              color: "warning",
            });
          }
        } catch (loginError: any) {
          addToast({
            title: "Profile saved, login failed",
            description:
              loginError?.message ||
              `The ${createForm.role} profile was created, but the login account could not be created. Grant login access later from their edit page.`,
            color: "warning",
          });
        }
      } else {
        const existingLogin = await userService.getUserByEmail(normalizedEmail);

        if (existingLogin) {
          addToast({
            title: "Email already in use",
            description: emailCollisionMessage("login"),
            color: "danger",
          });
          setIsCreating(false);

          return;
        }

        await userService.createUser(
          normalizedEmail,
          undefined,
          {
            displayName: createForm.displayName,
            role: createForm.role as UserRole,
            clinicId: clinicId,
          },
          undefined,
          "staff-management",
        );

        addToast({
          title: "Success",
          description:
            "Staff member created. They can log in immediately, but will see an empty dashboard until you assign them a role in Settings > RBAC > User Management.",
          color: "success",
        });
      }

      // Reset form and reload data
      setCreateForm({
        email: "",
        displayName: "",
        role: "",
        phone: "",
        speciality: "",
        licenseNumber: "",
        practitionerType: "",
        defaultCommission: "",
        consultationCharge: "",
      });
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

  // The deactivate confirmation's own copy promises this is reversible, but
  // until now nothing on this page could actually reverse it — the only
  // working toggle lived on the separate Settings > RBAC > User Management
  // screen.
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const handleActivateUser = async (member: User) => {
    setReactivatingId(member.id);
    try {
      await userService.activateUser(member.id);

      addToast({
        title: "Success",
        description: `${member.displayName} reactivated successfully`,
        color: "success",
      });

      await loadData();
    } catch (error) {
      console.error("Error activating user:", error);
      addToast({
        title: "Error",
        description: "Failed to reactivate user",
        color: "danger",
      });
    } finally {
      setReactivatingId(null);
    }
  };

  // Get role display name
  const getRoleDisplayName = (role: string) => {
    const roleMap: { [key: string]: string } = {
      "clinic-admin": "Clinic Admin",
      staff: "Staff Member",
      doctor: "Doctor",
      expert: "Expert",
      hr: "HR",
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
      case "doctor":
        return "secondary";
      case "expert":
        return "warning";
      default:
        return "default";
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      !searchQuery ||
      member.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || member.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStaff.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredStaff.length);
  const paginatedStaff = filteredStaff.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

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
                <p className="text-stat-sm font-bold">{staff.length}</p>
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
                <p className="text-stat-sm font-bold">
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
            {staff.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <Input
                  className="sm:max-w-xs"
                  placeholder="Search by name or email"
                  startContent={<IoSearchOutline className="text-default-400" />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Select
                  className="sm:max-w-xs"
                  placeholder="All roles"
                  selectedKeys={[roleFilter]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;

                    setRoleFilter(value || "all");
                  }}
                >
                  <SelectItem key="all">All Roles</SelectItem>
                  <SelectItem key="clinic-admin">Clinic Admin</SelectItem>
                  <SelectItem key="staff">Staff Member</SelectItem>
                  <SelectItem key="doctor">Doctor</SelectItem>
                  <SelectItem key="expert">Expert</SelectItem>
                  <SelectItem key="hr">HR</SelectItem>
                </Select>
              </div>
            )}
            <div className="mt-6">
              {staff.length === 0 ? (
                <div className="text-center py-12">
                  <IoPeopleOutline className="w-16 h-16 mx-auto mb-4 text-default-300" />
                  <h3 className="text-lg font-semibold text-default-600 mb-2">
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
              ) : filteredStaff.length === 0 ? (
                <div className="text-center py-12">
                  <IoSearchOutline className="w-12 h-12 mx-auto mb-4 text-default-300" />
                  <p className="text-default-500">
                    No staff match "{searchQuery}"
                    {roleFilter !== "all" ? ` with role ${getRoleDisplayName(roleFilter)}` : ""}.
                  </p>
                </div>
              ) : (
                <>
                <Table aria-label="Staff members table">
                  <TableHeader>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Email</TableColumn>
                    <TableColumn>Role</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {paginatedStaff.map((member) => (
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
                            <DropdownMenu
                              disabledKeys={
                                reactivatingId === member.id
                                  ? ["activate"]
                                  : []
                              }
                            >
                              {/*
                                Edit Role is hidden for an existing
                                doctor/expert rather than shown with a
                                picker that can't actually show "doctor"/
                                "expert" as a selected option (editableRoles
                                deliberately excludes them) — picking
                                anything there would silently demote them out
                                of their clinical role with no clinical-
                                profile reconciliation.
                              */}
                              {!CLINICAL_ROLES.includes(
                                member.role as UserRole,
                              ) ? (
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
                              ) : null}
                              {member.isActive ? (
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
                              ) : (
                                <DropdownItem
                                  key="activate"
                                  className="text-success"
                                  color="success"
                                  startContent={<IoRefreshOutline />}
                                  onPress={() => handleActivateUser(member)}
                                >
                                  Activate
                                </DropdownItem>
                              )}
                            </DropdownMenu>
                          </Dropdown>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-border-base">
                    <span className="text-[12.5px] text-default-500 font-medium">
                      Showing {startIndex + 1} to {endIndex} of{" "}
                      {filteredStaff.length} staff
                    </span>
                    <div className="flex gap-1">
                      <Button
                        isDisabled={currentPage === 1}
                        size="sm"
                        variant="bordered"
                        onPress={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                      >
                        Prev
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - currentPage) <= 1,
                        )
                        .map((p, i, arr) => (
                          <Fragment key={p}>
                            {i > 0 && arr[i - 1] !== p - 1 && (
                              <span className="px-2 text-default-400">
                                ...
                              </span>
                            )}
                            <Button
                              color={currentPage === p ? "primary" : "default"}
                              size="sm"
                              variant={currentPage === p ? "solid" : "bordered"}
                              onPress={() => setCurrentPage(p)}
                            >
                              {p}
                            </Button>
                          </Fragment>
                        ))}
                      <Button
                        isDisabled={currentPage === totalPages}
                        size="sm"
                        variant="bordered"
                        onPress={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
                </>
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

              {isClinicalRole && (
                <>
                  <Input
                    isRequired
                    label="Phone Number"
                    placeholder="Enter phone number"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                  <Select
                    isDisabled={specialities.length === 0}
                    isRequired
                    description={
                      specialities.length === 0
                        ? "No specialities configured yet — add one in Settings > Doctor Speciality first."
                        : undefined
                    }
                    label="Speciality"
                    placeholder={
                      specialities.length === 0
                        ? "No specialities configured"
                        : "Select speciality"
                    }
                    selectedKeys={
                      createForm.speciality ? [createForm.speciality] : []
                    }
                    onSelectionChange={(keys) => {
                      const speciality = Array.from(keys)[0] as string;

                      setCreateForm((prev) => ({ ...prev, speciality }));
                    }}
                  >
                    {specialities.map((s) => (
                      <SelectItem key={s.key}>{s.label}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    isRequired
                    label={
                      createForm.role === "doctor"
                        ? "NMC Number (License)"
                        : "License Number"
                    }
                    placeholder="Enter license #"
                    value={createForm.licenseNumber}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        licenseNumber: e.target.value,
                      }))
                    }
                  />
                  <Select
                    isRequired
                    label={`${createForm.role === "doctor" ? "Doctor" : "Expert"} Type`}
                    placeholder="Select type"
                    selectedKeys={
                      createForm.practitionerType
                        ? [createForm.practitionerType]
                        : []
                    }
                    onSelectionChange={(keys) => {
                      const practitionerType = Array.from(keys)[0] as string;

                      setCreateForm((prev) => ({ ...prev, practitionerType }));
                    }}
                  >
                    <SelectItem key="regular">Regular</SelectItem>
                    <SelectItem key="visiting">Visiting</SelectItem>
                  </Select>
                  <Input
                    label="Default Commission (%)"
                    max="100"
                    min="0"
                    placeholder="Enter %"
                    step="0.01"
                    type="number"
                    value={createForm.defaultCommission}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        defaultCommission: e.target.value,
                      }))
                    }
                  />
                  {createForm.role === "doctor" && (
                    <Input
                      label="Consultation Charge (NPR)"
                      min="0"
                      placeholder="Enter charge amount (e.g. 500)"
                      type="number"
                      value={createForm.consultationCharge}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          consultationCharge: e.target.value,
                        }))
                      }
                    />
                  )}
                </>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  {isClinicalRole
                    ? `This creates both a login and a ${createForm.role} clinical profile, so they'll appear in the ${createForm.role === "doctor" ? "Doctors" : "Experts"} section immediately. No password is set here — they'll be emailed a link to set their own.`
                    : "No password is set here — the staff member will be emailed a link to set their own. They'll see an empty dashboard until you assign them a role in Settings > RBAC > User Management."}
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
                {editableRoles.map((role) => (
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
