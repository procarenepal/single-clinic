import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoStorefrontOutline,
  IoArrowBackOutline,
  IoSaveOutline,
  IoLocationOutline,
  IoCallOutline,
  IoMailOutline,
  IoCodeSlashOutline,
  IoTimeOutline,
  IoPersonOutline,
  IoShieldOutline,
  IoInformationCircleOutline,
  IoKeyOutline,
} from "react-icons/io5";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { addToast } from "@/components/ui/toast";
import { title } from "@/components/primitives";
import { useAuth } from "@/hooks/useAuth";
import { branchService } from "@/services/branchService";
import { userService } from "@/services/userService";
import { impersonationService } from "@/services/impersonationService";

export default function NewBranchPage() {
  const navigate = useNavigate();
  const { clinicId, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [adminPasswordModal, setAdminPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [pendingBranchData, setPendingBranchData] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    isMainBranch: false,
    // Branch admin details
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    operatingHours: {
      monday: { open: "09:00", close: "17:00", isOpen: true },
      tuesday: { open: "09:00", close: "17:00", isOpen: true },
      wednesday: { open: "09:00", close: "17:00", isOpen: true },
      thursday: { open: "09:00", close: "17:00", isOpen: true },
      friday: { open: "09:00", close: "17:00", isOpen: true },
      saturday: { open: "09:00", close: "13:00", isOpen: true },
      sunday: { open: "09:00", close: "13:00", isOpen: false },
    },
  });

  const isSystemOwner =
    userData?.role === "system-owner" || userData?.role === "clinic-admin";

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOperatingHoursChange = (
    day: string,
    field: string,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day as keyof typeof prev.operatingHours],
          [field]: value,
        },
      },
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      addToast({
        title: "Validation Error",
        description: "Branch name is required",
      });

      return false;
    }

    if (!formData.code.trim()) {
      addToast({
        title: "Validation Error",
        description: "Branch code is required",
      });

      return false;
    }

    if (!formData.address.trim()) {
      addToast({
        title: "Validation Error",
        description: "Address is required",
      });

      return false;
    }

    if (!formData.city.trim()) {
      addToast({
        title: "Validation Error",
        description: "City is required",
      });

      return false;
    }

    if (!formData.phone.trim()) {
      addToast({
        title: "Validation Error",
        description: "Phone number is required",
      });

      return false;
    }

    // Validate branch admin details
    if (!formData.adminName.trim()) {
      addToast({
        title: "Validation Error",
        description: "Branch admin name is required",
      });

      return false;
    }

    if (!formData.adminEmail.trim()) {
      addToast({
        title: "Validation Error",
        description: "Branch admin email is required",
      });

      return false;
    }

    if (!formData.adminPassword.trim()) {
      addToast({
        title: "Validation Error",
        description: "Branch admin password is required",
      });

      return false;
    }

    if (formData.adminPassword.length < 6) {
      addToast({
        title: "Validation Error",
        description: "Branch admin password must be at least 6 characters",
      });

      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clinicId || !validateForm()) return;

    try {
      setLoading(true);

      // Create the branch first
      const branchId = await branchService.createBranch({
        clinicId,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        isMainBranch: formData.isMainBranch,
        isActive: true,
        operatingHours: formData.operatingHours,
      });

      // Store branch data for admin creation
      setPendingBranchData({
        branchId,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
        adminName: formData.adminName,
      });

      // Show password modal and reset loading state
      setAdminPasswordModal(true);
      setLoading(false);
    } catch (error: any) {
      console.error("Error creating branch:", error);
      addToast({
        title: "Error",
        description: error.message || "Failed to create branch",
      });
      setLoading(false);
    }
  };

  // Complete the branch admin creation process after getting clinic super admin password
  const completeBranchAdminCreation = async () => {
    if (!adminPassword || !pendingBranchData) return;

    try {
      setLoading(true);

      // Create branch admin user
      const adminId = await userService.createUser(
        pendingBranchData.adminEmail,
        pendingBranchData.adminPassword,
        {
          displayName: pendingBranchData.adminName,
          role: "clinic-admin",
          clinicId: clinicId!,
          branchId: pendingBranchData.branchId, // Assign to specific branch
        },
        adminPassword, // Pass clinic super admin password for re-authentication
      );

      // Store admin credentials for impersonation purposes
      await impersonationService.storeCredentials(
        adminId,
        pendingBranchData.adminEmail,
        pendingBranchData.adminPassword,
      );

      // Assign full clinic admin role to branch admin (same as individual clinic admins)
      try {
        const { rbacService } = await import("@/services/rbacService");

        // Branch admins should have the same full access as regular clinic admins
        let adminRoleId: string;

        // First try to find existing "Clinic Administrator" role (full access)
        const existingRoles = await rbacService.getClinicRoles(clinicId!);
        const fullAdminRole = existingRoles.find(
          (role) =>
            role.name === "Clinic Administrator" && !role.isBranchSpecific,
        );

        if (fullAdminRole) {
          adminRoleId = fullAdminRole.id;
        } else {
          // Create a new full access clinic admin role
          adminRoleId = await rbacService.createDefaultClinicAdminRole(
            clinicId!,
          );
        }

        // Assign the full admin role to the branch admin
        await rbacService.assignRolesToUser(adminId, [adminRoleId], clinicId!);

        // Also create branch-specific roles for future staff (optional)
        try {
          await rbacService.createBranchRoles(
            clinicId!,
            pendingBranchData.branchId,
          );
        } catch (branchRoleError) {
          console.warn("Branch roles may already exist:", branchRoleError);
        }
      } catch (rbacError) {
        console.error("Error setting up RBAC for branch admin:", rbacError);
        // Continue even if RBAC setup fails
      }

      // Update the branch with the manager ID
      try {
        await branchService.updateBranch(pendingBranchData.branchId, {
          managerId: adminId,
        });
      } catch (updateError) {
        console.error("Error updating branch manager:", updateError);
        // Continue even if update fails
      }

      addToast({
        title: "Success",
        description: "Branch and branch admin created successfully",
      });

      navigate("/dashboard/branches");
    } catch (error: any) {
      console.error("Error creating branch admin:", error);
      addToast({
        title: "Error",
        description: error.message || "Failed to create branch admin",
      });
    } finally {
      setLoading(false);
      setAdminPassword("");
      setPendingBranchData(null);
      setAdminPasswordModal(false);
    }
  };

  if (!isSystemOwner) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="border border-warning/20 bg-warning/5">
          <CardBody className="p-6">
            <div className="flex items-center gap-3">
              <IoStorefrontOutline className="text-warning text-2xl" />
              <div>
                <h3 className="text-lg font-semibold text-warning">
                  Access Restricted
                </h3>
                <p className="text-text-muted">
                  Only clinic super administrators can create branches.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const dayLabels = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Create New Branch
          </h1>
          <p className="text-text-muted mt-1">
            Add a new branch location to your clinic
          </p>
        </div>
        <Button
          startContent={<IoArrowBackOutline />}
          variant="light"
          onPress={() => navigate("/dashboard/branches")}
        >
          Back to Branches
        </Button>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Basic Information */}
        <Card className="border border-border-base">
          <CardHeader className="bg-surface-2/30 border-b border-border-base px-6 py-4">
            <div className="flex items-center gap-3">
              <IoStorefrontOutline className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-text-main">
                Basic Information
              </h2>
            </div>
          </CardHeader>
          <CardBody className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                isRequired
                label="Branch Name"
                placeholder="e.g., Downtown Branch"
                startContent={
                  <IoStorefrontOutline className="text-text-muted/60" />
                }
                value={formData.name}
                variant="bordered"
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
              <Input
                isRequired
                description="Short unique identifier for this branch"
                label="Branch Code"
                placeholder="e.g., DT, MB"
                startContent={
                  <IoCodeSlashOutline className="text-text-muted/60" />
                }
                value={formData.code}
                variant="bordered"
                onChange={(e) =>
                  handleInputChange("code", e.target.value.toUpperCase())
                }
              />
            </div>

            <Textarea
              isRequired
              label="Address"
              placeholder="Enter branch address"
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                isRequired
                label="City"
                placeholder="Enter city"
                startContent={
                  <IoLocationOutline className="text-text-muted/60" />
                }
                value={formData.city}
                variant="bordered"
                onChange={(e) => handleInputChange("city", e.target.value)}
              />
              <Input
                isRequired
                label="Phone Number"
                placeholder="e.g., 9801234567"
                startContent={<IoCallOutline className="text-text-muted/60" />}
                value={formData.phone}
                variant="bordered"
                onChange={(e) => handleInputChange("phone", e.target.value)}
              />
            </div>

            <Input
              label="Email Address (Optional)"
              placeholder="branch@clinic.com"
              startContent={<IoMailOutline className="text-text-muted/60" />}
              value={formData.email}
              variant="bordered"
              onChange={(e) => handleInputChange("email", e.target.value)}
            />

            <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg border border-border-base">
              <div>
                <h4 className="font-medium text-text-main">
                  Set as Main Branch
                </h4>
                <p className="text-sm text-text-muted">
                  This will be the primary branch for your clinic
                </p>
              </div>
              <Switch
                color="primary"
                isSelected={formData.isMainBranch}
                onValueChange={(value) =>
                  handleInputChange("isMainBranch", value)
                }
              />
            </div>
          </CardBody>
        </Card>

        {/* Operating Hours */}
        <Card className="border border-border-base">
          <CardHeader className="bg-surface-2/30 border-b border-border-base px-6 py-4">
            <div className="flex items-center gap-3">
              <IoTimeOutline className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-text-main">
                Operating Hours
              </h2>
            </div>
          </CardHeader>
          <CardBody className="p-6 space-y-4">
            {days.map((day, index) => (
              <div
                key={day}
                className="flex items-center gap-4 p-4 bg-surface-2 rounded-lg"
              >
                <div className="w-24">
                  <p className="font-medium text-text-main">
                    {dayLabels[index]}
                  </p>
                </div>
                <Switch
                  color="success"
                  isSelected={
                    formData.operatingHours[
                      day as keyof typeof formData.operatingHours
                    ]?.isOpen || false
                  }
                  onValueChange={(value) =>
                    handleOperatingHoursChange(day, "isOpen", value)
                  }
                />
                {formData.operatingHours[
                  day as keyof typeof formData.operatingHours
                ]?.isOpen && (
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-32"
                      size="sm"
                      type="time"
                      value={
                        formData.operatingHours[
                          day as keyof typeof formData.operatingHours
                        ]?.open || "09:00"
                      }
                      variant="bordered"
                      onChange={(e) =>
                        handleOperatingHoursChange(day, "open", e.target.value)
                      }
                    />
                    <span className="text-text-muted">to</span>
                    <Input
                      className="w-32"
                      size="sm"
                      type="time"
                      value={
                        formData.operatingHours[
                          day as keyof typeof formData.operatingHours
                        ]?.close || "17:00"
                      }
                      variant="bordered"
                      onChange={(e) =>
                        handleOperatingHoursChange(day, "close", e.target.value)
                      }
                    />
                  </div>
                )}
                {!formData.operatingHours[
                  day as keyof typeof formData.operatingHours
                ]?.isOpen && (
                  <span className="text-text-muted/50 text-sm">Closed</span>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Branch Admin Information */}
        <Card className="border border-border-base">
          <CardHeader className="bg-surface-2/30 border-b border-border-base px-6 py-4">
            <div className="flex items-center gap-3">
              <IoPersonOutline className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-text-main">
                Branch Administrator
              </h2>
            </div>
          </CardHeader>
          <CardBody className="p-6 space-y-4">
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 mb-4">
              <div className="flex gap-3">
                <div className="min-w-[20px] mt-0.5">
                  <IoInformationCircleOutline className="text-primary" />
                </div>
                <div>
                  <p className="text-sm text-primary font-medium mb-1">
                    Branch Administrator Setup
                  </p>
                  <p className="text-xs text-text-muted">
                    Each branch requires a dedicated administrator who will
                    manage day-to-day operations, staff, and branch-specific
                    settings. The admin will receive login credentials and can
                    be impersonated by you if needed.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                isRequired
                label="Admin Name"
                placeholder="Enter branch admin name"
                startContent={
                  <IoPersonOutline className="text-text-muted/60" />
                }
                value={formData.adminName}
                variant="bordered"
                onChange={(e) => handleInputChange("adminName", e.target.value)}
              />
              <Input
                isRequired
                description="Admin will receive login credentials at this email"
                label="Admin Email"
                placeholder="admin@clinic.com"
                startContent={<IoMailOutline className="text-text-muted/60" />}
                type="email"
                value={formData.adminEmail}
                variant="bordered"
                onChange={(e) =>
                  handleInputChange("adminEmail", e.target.value)
                }
              />
            </div>

            <Input
              isRequired
              description="Minimum 6 characters required"
              label="Admin Password"
              placeholder="Set a strong password"
              startContent={<IoShieldOutline className="text-text-muted/60" />}
              type="password"
              value={formData.adminPassword}
              variant="bordered"
              onChange={(e) =>
                handleInputChange("adminPassword", e.target.value)
              }
            />

            <div className="bg-success/5 p-4 rounded-lg border border-success/20">
              <div className="flex gap-3">
                <div className="min-w-[20px] mt-0.5">
                  <IoKeyOutline className="text-success" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-text-main mb-1">
                    Access & Security Features
                  </h4>
                  <ul className="text-xs text-text-muted space-y-1">
                    <li>
                      • Admin will be automatically assigned to this specific
                      branch
                    </li>
                    <li>
                      • Credentials will be stored securely for impersonation
                      support
                    </li>
                    <li>
                      • Admin will have full control over this branch's
                      operations
                    </li>
                    <li>
                      • You can manage admin permissions through the RBAC system
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="light"
            onPress={() => navigate("/dashboard/branches")}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            isLoading={loading}
            startContent={!loading && <IoSaveOutline />}
            type="submit"
          >
            Create Branch & Admin
          </Button>
        </div>
      </form>

      {/* Admin Password Modal */}
      <Modal
        isOpen={adminPasswordModal}
        onClose={() => {
          setAdminPasswordModal(false);
          setLoading(false);
          setPendingBranchData(null);
          setAdminPassword("");
        }}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold">Confirm Your Password</h1>
              <p className="text-sm text-text-muted">
                Please enter your password to complete the branch admin creation
              </p>
            </div>
          </ModalHeader>
          <ModalBody>
            <Input
              description="Required to maintain your session while creating the branch admin"
              label="Your Password"
              placeholder="Enter your password"
              startContent={<IoShieldOutline className="text-text-muted/60" />}
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="bordered"
              onPress={() => {
                setAdminPasswordModal(false);
                setLoading(false);
                setPendingBranchData(null);
                setAdminPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!adminPassword}
              isLoading={loading}
              onPress={completeBranchAdminCreation}
            >
              Create Branch Admin
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
