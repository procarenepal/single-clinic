import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoBusinessOutline,
  IoCheckmarkCircleOutline,
  IoMailOutline,
  IoCallOutline,
  IoLocationOutline,
  IoPersonOutline,
  IoArrowBackOutline,
  IoSaveOutline,
  IoInformationCircleOutline,
  IoShieldOutline,
  IoKeyOutline,
} from "react-icons/io5";

import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Input,
  Button,
  Divider,
  Select,
  SelectItem,
  Chip,
  Switch,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@/components/ui";
import { title } from "@/components/primitives";
import { clinicService } from "@/services/clinicService";
import { userService } from "@/services/userService";
import { clinicTypeService } from "@/services/clinicTypeService";
import { subscriptionService } from "@/services/subscriptionService";
import { impersonationService } from "@/services/impersonationService";
import { ClinicType, SubscriptionPlan } from "@/types/models";

export default function NewClinicPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [clinicTypes, setClinicTypes] = useState<ClinicType[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<
    SubscriptionPlan[]
  >([]);
  const [selectedPlanFeatures, setSelectedPlanFeatures] = useState<string[]>(
    [],
  );
  const [adminPasswordModal, setAdminPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [pendingClinicData, setPendingClinicData] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    clinicType: "",
    subscriptionPlan: "",
    subscriptionType: "yearly" as "monthly" | "yearly", // Default to yearly
    isMultiBranchEnabled: false,
    maxBranches: 5,
    adminEmail: "",
    adminName: "",
    adminPassword: "",
  });

  // Fetch clinic types and subscription plans when component mounts
  useEffect(() => {
    const fetchClinicTypes = async () => {
      try {
        const types = await clinicTypeService.getActiveClinicTypes();

        setClinicTypes(types);
        // Set default selection if types are available
        if (types.length > 0) {
          setFormData((prev) => ({
            ...prev,
            clinicType: types[0].id,
          }));
        }
      } catch (error) {
        console.error("Error fetching clinic types:", error);
        addToast({
          title: "Error",
          description:
            "Failed to load clinic types. Please refresh and try again.",
        });
      }
    };

    const fetchSubscriptionPlans = async () => {
      try {
        const plans = await subscriptionService.getActiveSubscriptionPlans();

        setSubscriptionPlans(plans);
        // Set default selection if plans are available
        if (plans.length > 0) {
          setFormData((prev) => ({
            ...prev,
            subscriptionPlan: plans[0].id,
          }));

          // Set features of the default selected plan
          setSelectedPlanFeatures(plans[0].features || []);
        }
      } catch (error) {
        console.error("Error fetching subscription plans:", error);
        addToast({
          title: "Error",
          description:
            "Failed to load subscription plans. Please refresh and try again.",
        });
      }
    };

    fetchClinicTypes();
    fetchSubscriptionPlans();
  }, []);

  // Validate Nepali phone number format
  const validateNepaliPhone = (phone: string) => {
    // Nepali phone numbers are typically 10 digits starting with 9
    // or with country code +977 followed by 10 digits
    const nepaliPhoneRegex = /^((\+977|0)[9][6-9]\d{8}|[9][6-9]\d{8})$/;

    return nepaliPhoneRegex.test(phone);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Clear phone error when user types
    if (name === "phone") {
      setPhoneError("");
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (key: string, value: string) => {
    // Update form data with new selection
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));

    // If subscription plan is changed, update features
    if (key === "subscriptionPlan") {
      const selectedPlan = subscriptionPlans.find((plan) => plan.id === value);

      if (selectedPlan) {
        setSelectedPlanFeatures(selectedPlan.features || []);
      } else {
        setSelectedPlanFeatures([]);
      }
    }
  };

  // Validate Nepali phone number
  const validatePhoneNumber = (phone: string) => {
    // Nepali phone numbers are typically 10 digits and start with 9
    // They can optionally have +977 or 0 as prefix
    // Common formats: 9XXXXXXXX, +9779XXXXXXXX, 09XXXXXXXX
    const nepalPhoneRegex = /^(?:(?:\+977|0)?9[6-9]\d{8})$/;

    return nepalPhoneRegex.test(phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!validatePhoneNumber(formData.phone)) {
      addToast({
        title: "Error",
        description:
          "Invalid phone number format. Please enter a valid Nepali phone number.",
      });
      setIsLoading(false);

      return;
    }

    // Validate clinic type selection
    if (!formData.clinicType) {
      addToast({
        title: "Error",
        description: "Please select a clinic type.",
      });
      setIsLoading(false);

      return;
    }

    // Validate subscription plan selection
    if (!formData.subscriptionPlan) {
      addToast({
        title: "Error",
        description: "Please select a subscription plan.",
      });
      setIsLoading(false);

      return;
    }

    try {
      // Create clinic start date (today)
      const startDate = new Date();

      // Calculate end date based on subscription type
      const endDate = new Date(startDate);

      if (formData.subscriptionType === "monthly") {
        endDate.setMonth(endDate.getMonth() + 1); // Add 1 month
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1); // Add 1 year
      }

      // Create the clinic first
      const clinicResult = await clinicService.createClinic({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        city: formData.city,
        clinicType: formData.clinicType,
        subscriptionPlan: formData.subscriptionPlan,
        subscriptionType: formData.subscriptionType,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        subscriptionStatus: "active",
        isMultiBranchEnabled: formData.isMultiBranchEnabled,
        maxBranches: formData.isMultiBranchEnabled
          ? formData.maxBranches
          : undefined,
        totalBranches: formData.isMultiBranchEnabled ? 1 : undefined,
      });

      // Extract clinic ID from the result
      const clinicId =
        typeof clinicResult === "string" ? clinicResult : clinicResult.clinicId;

      // If multi-branch is enabled, create default main branch
      if (formData.isMultiBranchEnabled) {
        try {
          const { branchService } = await import("@/services/branchService");

          await branchService.createDefaultMainBranch(clinicId);
        } catch (error) {
          console.error("Error creating main branch:", error);
          // Continue with clinic creation even if branch creation fails
        }
      }

      // Store clinic data and prompt for admin password
      setPendingClinicData({
        clinicId,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
        adminName: formData.adminName,
        subscriptionPlan: formData.subscriptionPlan,
        subscriptionType: formData.subscriptionType,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        isMultiBranchEnabled: formData.isMultiBranchEnabled,
        maxBranches: formData.maxBranches,
      });

      // Show password modal and reset loading state
      setAdminPasswordModal(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Error creating clinic:", error);
      addToast({
        title: "Error",
        description: "Failed to register clinic. Please try again.",
      });
      setIsLoading(false);
    }
  };

  // Complete the user creation process after getting admin password
  const completeUserCreation = async () => {
    if (!adminPassword || !pendingClinicData) return;

    try {
      // Set loading state for just this operation
      setIsLoading(true);

      // Determine admin role based on multi-branch system
      const adminRole = pendingClinicData.isMultiBranchEnabled
        ? "system-owner"
        : "clinic-admin";

      // Create clinic admin user with the admin password for re-authentication
      const adminId = await userService.createUser(
        pendingClinicData.adminEmail,
        pendingClinicData.adminPassword,
        {
          displayName: pendingClinicData.adminName,
          role: adminRole,
          clinicId: pendingClinicData.clinicId,
        },
        adminPassword, // Pass admin password for re-authentication
      );

      // Automatically store admin credentials for impersonation purposes
      await impersonationService.storeCredentials(
        adminId,
        pendingClinicData.adminEmail,
        pendingClinicData.adminPassword,
      );

      // Initialize RBAC for the clinic
      const { rbacService } = await import("@/services/rbacService");

      await rbacService.createDefaultClinicRoles(pendingClinicData.clinicId);

      // Create and assign appropriate admin role to the user
      const adminRoleId = pendingClinicData.isMultiBranchEnabled
        ? await rbacService.createDefaultSystemOwnerRole(
            pendingClinicData.clinicId,
          )
        : await rbacService.createDefaultClinicAdminRole(
            pendingClinicData.clinicId,
          );

      await rbacService.assignRolesToUser(
        adminId,
        [adminRoleId],
        pendingClinicData.clinicId,
      );

      // Set up the clinic subscription
      if (
        pendingClinicData.subscriptionPlan &&
        pendingClinicData.subscriptionType
      ) {
        // Set up subscription with the subscription service
        await subscriptionService.updateClinicSubscription(
          pendingClinicData.clinicId,
          pendingClinicData.subscriptionPlan,
          pendingClinicData.subscriptionStartDate,
          pendingClinicData.subscriptionEndDate, // Use calculated end date
          "active",
          pendingClinicData.subscriptionType,
        );
      }

      addToast({
        title: "Success",
        description:
          "Clinic registered successfully with impersonation credentials stored",
      });

      navigate("/admin/clinics");
    } catch (error) {
      console.error("Error creating admin:", error);
      addToast({
        title: "Error",
        description: "Failed to create clinic admin. Please try again.",
      });
      // Make sure to set loading to false on error
      setIsLoading(false);
    } finally {
      // Clean up sensitive data
      setAdminPassword("");
      setPendingClinicData(null);
      setAdminPasswordModal(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <form onSubmit={handleSubmit}>
        {/* Header section with breadcrumbs */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ">
            <div className="">
              <div>
                <h1 className={title({ size: "sm" })}>Register New Clinic</h1>
                <p className="text-default-600 mt-1">
                  Register a new healthcare facility and assign an administrator
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0 w-full sm:w-auto justify-end">
              <Button
                className="flex-1 sm:flex-initial"
                color="default"
                startContent={<IoArrowBackOutline />}
                variant="bordered"
                onClick={() => navigate("/admin/clinics")}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 sm:flex-initial"
                color="primary"
                isLoading={isLoading}
                startContent={!isLoading && <IoSaveOutline />}
                type="submit"
              >
                Register Clinic
              </Button>
            </div>
          </div>
        </div>

        {/* Clinic Type warning if none exist */}
        {clinicTypes.length === 0 && (
          <div className="mb-8">
            <div className="bg-warning-50 p-4 rounded-lg border border-warning-200">
              <div className="flex items-center gap-3">
                <div className="min-w-[24px] flex justify-center">
                  <IoInformationCircleOutline className="text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-default-700">
                    No clinic types available
                  </p>
                  <p className="text-sm text-default-600 mt-1">
                    You need to create clinic types before registering a new
                    clinic.
                    <a
                      className="ml-2 inline-flex items-center justify-center h-[26px] px-2.5 text-xs font-medium bg-saffron-100 text-saffron-700 hover:bg-saffron-200 rounded"
                      href="/admin/clinic-types"
                    >
                      Manage Clinic Types
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registration status indicator */}
        <div className="mb-8">
          <div className="bg-default-50 p-4 rounded-lg border border-default-200">
            <div className="flex items-center gap-3">
              <div className="min-w-[24px] flex justify-center">
                <IoInformationCircleOutline className="text-primary" />
              </div>
              <p className="text-sm text-default-700">
                Complete the form below to register a new clinic. Once
                registered, the administrator will receive an email invitation
                to set up their account.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Clinic Information */}
          <Card className="border border-default-200 shadow-sm">
            <CardHeader className="bg-default-50 border-b border-default-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <IoBusinessOutline className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-default-900">
                  Clinic Information
                </h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-5 p-6">
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Clinic Name <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  className="w-full"
                  name="name"
                  placeholder="Enter clinic name"
                  size="md"
                  startContent={
                    <IoBusinessOutline className="text-default-400" />
                  }
                  value={formData.name}
                  variant="bordered"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Email Address <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  className="w-full"
                  name="email"
                  placeholder="clinic@example.com"
                  size="md"
                  startContent={<IoMailOutline className="text-default-400" />}
                  type="email"
                  value={formData.email}
                  variant="bordered"
                  onChange={handleChange}
                />
                <p className="text-xs text-default-500 mt-1">
                  Primary email for clinic communications
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Phone Number <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  className="w-full"
                  name="phone"
                  placeholder="9XXXXXXXX or +9779XXXXXXXX"
                  size="md"
                  startContent={<IoCallOutline className="text-default-400" />}
                  type="tel"
                  value={formData.phone}
                  variant="bordered"
                  onChange={handleChange}
                />
                <p className="text-xs text-default-500 mt-1">
                  Enter Nepali phone number format (e.g., 9801234567 or
                  +9779801234567)
                </p>
                {phoneError && (
                  <p className="text-xs text-danger mt-1">{phoneError}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  City <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  className="w-full"
                  name="city"
                  placeholder="Enter clinic city"
                  size="md"
                  startContent={
                    <IoLocationOutline className="text-default-400" />
                  }
                  value={formData.city}
                  variant="bordered"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Clinic Type <span className="text-danger">*</span>
                </label>
                <Select
                  required
                  className="w-full"
                  name="clinicType"
                  placeholder="Select clinic type"
                  selectedKeys={
                    formData.clinicType ? [formData.clinicType] : []
                  }
                  size="md"
                  variant="bordered"
                  onChange={(e) =>
                    handleSelectChange(
                      "clinicType",
                      (e.target as HTMLSelectElement).value,
                    )
                  }
                >
                  {clinicTypes.length === 0 ? (
                    // @ts-ignore
                    <SelectItem key="no-types" value="">
                      No clinic types available
                    </SelectItem>
                  ) : (
                    clinicTypes.map((type) => (
                      // @ts-ignore
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))
                  )}
                </Select>
                {clinicTypes.length === 0 && (
                  <p className="text-xs text-warning-500 mt-1">
                    No clinic types available. Please create clinic types first.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Subscription Plan <span className="text-danger">*</span>
                </label>
                <Select
                  required
                  className="w-full"
                  name="subscriptionPlan"
                  placeholder="Select subscription plan"
                  selectedKeys={
                    formData.subscriptionPlan ? [formData.subscriptionPlan] : []
                  }
                  size="md"
                  variant="bordered"
                  onChange={(e) =>
                    handleSelectChange(
                      "subscriptionPlan",
                      (e.target as HTMLSelectElement).value,
                    )
                  }
                >
                  {subscriptionPlans.length === 0 ? (
                    // @ts-ignore
                    <SelectItem key="no-plans" value="">
                      No subscription plans available
                    </SelectItem>
                  ) : (
                    subscriptionPlans.map((plan) => (
                      // @ts-ignore
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))
                  )}
                </Select>
                {subscriptionPlans.length === 0 && (
                  <p className="text-xs text-warning-500 mt-1">
                    No subscription plans available. Please create subscription
                    plans first.
                  </p>
                )}

                {/* Display plan price */}
                {formData.subscriptionPlan && subscriptionPlans.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-success-600 font-medium">
                      {(() => {
                        const selectedPlan = subscriptionPlans.find(
                          (plan) => plan.id === formData.subscriptionPlan,
                        );

                        if (!selectedPlan) return null;

                        const price =
                          formData.subscriptionType === "monthly"
                            ? selectedPlan.discountedMonthlyPrice ||
                              selectedPlan.monthlyPrice
                            : selectedPlan.discountedYearlyPrice ||
                              selectedPlan.yearlyPrice;

                        return `Price: NPR ${price.toLocaleString()} ${
                          formData.subscriptionType === "monthly"
                            ? "/ month"
                            : "/ year"
                        }`;
                      })()}
                    </p>
                  </div>
                )}

                {/* Display plan features */}
                {selectedPlanFeatures.length > 0 && (
                  <div className="mt-3 bg-default-50 p-2 rounded-md border border-default-200">
                    <p className="text-xs font-medium text-default-700 mb-1">
                      Plan Features:
                    </p>
                    <ul className="list-disc text-xs text-default-600 pl-5 space-y-1">
                      {selectedPlanFeatures.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Billing Frequency <span className="text-danger">*</span>
                </label>
                <Select
                  required
                  className="w-full"
                  name="subscriptionType"
                  placeholder="Select billing frequency"
                  selectedKeys={[formData.subscriptionType]}
                  size="md"
                  variant="bordered"
                  onChange={(e) =>
                    handleSelectChange(
                      "subscriptionType",
                      (e.target as HTMLSelectElement).value,
                    )
                  }
                >
                  {/* @ts-ignore */}
                  <SelectItem key="monthly" value="monthly">
                    Monthly
                  </SelectItem>
                  {/* @ts-ignore */}
                  <SelectItem key="yearly" value="yearly">
                    Yearly (Save more)
                  </SelectItem>
                </Select>
                <p className="text-xs text-default-500 mt-1">
                  Yearly billing offers better value compared to monthly billing
                </p>

                {/* Display subscription period */}
                <div className="mt-3 p-2 bg-success-50 rounded border border-success-100">
                  <p className="text-xs text-default-700">
                    <span className="font-medium">Subscription Period: </span>
                    {new Date().toLocaleDateString()} —{" "}
                    {formData.subscriptionType === "monthly"
                      ? new Date(
                          new Date().setMonth(new Date().getMonth() + 1),
                        ).toLocaleDateString()
                      : new Date(
                          new Date().setFullYear(new Date().getFullYear() + 1),
                        ).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Divider className="my-4" />

              {/* Multi-Branch Settings */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-sm font-medium text-default-700 block">
                      Multi-Branch System
                    </label>
                    <p className="text-xs text-default-500 mt-1">
                      Enable this clinic to manage multiple branch locations
                    </p>
                  </div>
                  <Switch
                    color="primary"
                    isSelected={formData.isMultiBranchEnabled}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        isMultiBranchEnabled: value,
                      }))
                    }
                  />
                </div>

                {formData.isMultiBranchEnabled && (
                  <div>
                    <label className="text-sm font-medium text-default-700 mb-1.5 block">
                      Maximum Branches
                    </label>
                    <Select
                      className="w-full"
                      name="maxBranches"
                      placeholder="Select max branches"
                      selectedKeys={[formData.maxBranches.toString()]}
                      size="md"
                      variant="bordered"
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          maxBranches: parseInt(
                            (e.target as HTMLSelectElement).value,
                          ),
                        }))
                      }
                    >
                      {/* @ts-ignore */}
                      <SelectItem key="3">3 Branches</SelectItem>
                      {/* @ts-ignore */}
                      <SelectItem key="5">5 Branches</SelectItem>
                      {/* @ts-ignore */}
                      <SelectItem key="10">10 Branches</SelectItem>
                      {/* @ts-ignore */}
                      <SelectItem key="20">20 Branches</SelectItem>
                      {/* @ts-ignore */}
                      <SelectItem key="50">50 Branches</SelectItem>
                    </Select>
                    <p className="text-xs text-default-500 mt-1">
                      Set the maximum number of branches this clinic can create
                    </p>
                  </div>
                )}

                {formData.isMultiBranchEnabled && (
                  <div className="mt-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                    <div className="flex gap-3">
                      <div className="min-w-[20px] mt-0.5">
                        <IoInformationCircleOutline className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-primary-800 font-medium mb-1">
                          Multi-Branch System Enabled
                        </p>
                        <p className="text-xs text-primary-700">
                          • A main branch will be automatically created during
                          setup
                          <br />
                          • Clinic admin can create additional branches up to
                          the limit
                          <br />
                          • Each branch will have its own branch admin and staff
                          <br />• Data will be isolated per branch for security
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Admin Information */}
          <Card className="border border-default-200 shadow-sm">
            <CardHeader className="bg-default-50 border-b border-default-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <IoPersonOutline className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-default-900">
                  Administrator Information
                </h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-5 p-6">
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Admin Name <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  className="w-full"
                  name="adminName"
                  placeholder="Enter admin name"
                  size="md"
                  startContent={
                    <IoPersonOutline className="text-default-400" />
                  }
                  value={formData.adminName}
                  variant="bordered"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Admin Email <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  className="w-full"
                  name="adminEmail"
                  placeholder="admin@example.com"
                  size="md"
                  startContent={<IoMailOutline className="text-default-400" />}
                  type="email"
                  value={formData.adminEmail}
                  variant="bordered"
                  onChange={handleChange}
                />
                <p className="text-xs text-default-500 mt-1">
                  The admin will receive login credentials at this email
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Admin Password <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  className="w-full"
                  name="adminPassword"
                  placeholder="Set admin password"
                  size="md"
                  startContent={
                    <IoShieldOutline className="text-default-400" />
                  }
                  type="password"
                  value={formData.adminPassword}
                  variant="bordered"
                  onChange={handleChange}
                />
                <p className="text-xs text-default-500 mt-1">
                  Set a strong password for the clinic admin
                </p>
              </div>

              <Divider className="my-4" />

              <div className="bg-secondary-50 p-4 rounded-lg border border-secondary-200">
                <div className="flex gap-3">
                  <div className="min-w-[24px] mt-0.5">
                    <IoShieldOutline className="text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-default-800 mb-1">
                      Access Control Information
                    </h3>
                    <p className="text-sm text-default-600">
                      {formData.isMultiBranchEnabled
                        ? "A clinic super admin will be created with full access to manage multiple branches and all clinic operations."
                        : "A clinic admin will be created with access to manage this single clinic's operations."}{" "}
                      The admin will receive an email notification about their
                      account.
                    </p>
                    <p className="text-sm text-default-600 mt-1">
                      <strong>Note:</strong> Admin credentials will be
                      automatically stored for impersonation purposes, allowing
                      you to access the admin account for support without
                      knowing their actual password.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip
                        color={
                          formData.isMultiBranchEnabled ? "warning" : "success"
                        }
                        size="sm"
                        startContent={<IoCheckmarkCircleOutline />}
                        variant="flat"
                      >
                        {formData.isMultiBranchEnabled
                          ? "Clinic Super Admin"
                          : "Clinic Admin"}
                      </Chip>
                      <Chip
                        color="secondary"
                        size="sm"
                        startContent={<IoCheckmarkCircleOutline />}
                        variant="flat"
                      >
                        Password set by super admin
                      </Chip>
                      <Chip
                        color="primary"
                        size="sm"
                        startContent={<IoKeyOutline />}
                        variant="flat"
                      >
                        Impersonation enabled
                      </Chip>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
            <CardFooter className="bg-default-50 border-t border-default-200 px-6 py-4">
              <Button
                fullWidth
                color="primary"
                isLoading={isLoading}
                startContent={!isLoading && <IoSaveOutline />}
                type="submit"
              >
                Complete Registration
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>

      {/* Admin Password Modal */}
      <Modal
        isOpen={adminPasswordModal}
        onClose={() => {
          setAdminPasswordModal(false);
          setIsLoading(false);
          setPendingClinicData(null);
          setAdminPassword("");
        }}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold">Confirm Your Password</h1>
              <p className="text-sm text-default-600">
                Please enter your password to complete the registration
              </p>
            </div>
          </ModalHeader>
          <ModalBody>
            <Input
              description="Required to maintain your session while creating the clinic admin"
              label="Your Password"
              placeholder="Enter your password"
              startContent={<IoShieldOutline className="text-default-400" />}
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="bordered"
              onClick={() => {
                setAdminPasswordModal(false);
                setIsLoading(false);
                setPendingClinicData(null);
                setAdminPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              disabled={!adminPassword}
              isLoading={false}
              onClick={completeUserCreation}
            >
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
