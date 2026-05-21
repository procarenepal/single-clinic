import { useState, useEffect, useCallback, useMemo } from "react";
import {
  IoBusinessOutline,
  IoArrowBackOutline,
  IoSaveOutline,
  IoLocationOutline,
  IoCallOutline,
  IoMailOutline,
  IoImageOutline,
  IoPencilOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoRefreshOutline,
  IoShieldCheckmarkOutline,
  IoTrashOutline,
} from "react-icons/io5";

import { title, subtitle } from "@/components/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Divider } from "@/components/ui/divider";
import {
  Skeleton,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@/components/ui";
import { Link } from "@/components/ui/link";
import { Clinic, ClinicType, SubscriptionPlan } from "@/types/models";
import { clinicService } from "@/services/clinicService";
import { clinicTypeService } from "@/services/clinicTypeService";
import { subscriptionService } from "@/services/subscriptionService";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { uploadImage } from "@/services/appwriteStorageService";
import { storage, APPWRITE_BUCKET_ID } from "@/config/appwrite";

// Types for better type safety
interface FormData {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  address: string;
  description: string;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  address?: string;
  description?: string;
}

interface LoadingStates {
  data: boolean;
  saving: boolean;
  retrying: boolean;
}

// Validation rule interface
interface ValidationRule {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

// Constants
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const DEBOUNCE_DELAY = 500;

// Validation rules
const VALIDATION_RULES: Record<keyof FormData, ValidationRule> = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-._()]+$/,
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
  },
  phone: {
    required: true,
    pattern: /^(?:(?:\+977|0)?9[6-9]\d{8})$/,
  },
  city: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s\-.']+$/,
  },
  state: {
    required: true,
    minLength: 2,
    maxLength: 50,
  },
  zipCode: {
    required: true,
    minLength: 2,
    maxLength: 20,
  },
  country: {
    required: true,
    minLength: 2,
    maxLength: 50,
  },
  address: {
    required: true,
    minLength: 5,
    maxLength: 200,
  },
  description: {
    required: false,
    maxLength: 500,
  },
};

export default function ClinicSettingsPage() {
  const { clinicId } = useAuthContext();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // State management
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [clinicTypes, setClinicTypes] = useState<ClinicType[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<
    SubscriptionPlan[]
  >([]);
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    data: true,
    saving: false,
    retrying: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    city: "",
    state: "Bagmati",
    zipCode: "44600",
    country: "Nepal",
    address: "",
    description: "",
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );
  const [touchedFields, setTouchedFields] = useState<Set<keyof FormData>>(
    new Set(),
  );
  const [originalFormData, setOriginalFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    city: "",
    state: "Bagmati",
    zipCode: "44600",
    country: "Nepal",
    address: "",
    description: "",
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Debounced validation
  const debounceTimer = useState<NodeJS.Timeout | null>(null);

  // Utility functions
  const sanitizeInput = useCallback(
    (value: string, type: keyof FormData): string => {
      let sanitized = value.trim();

      switch (type) {
        case "name":
        case "city":
          // Remove special characters except allowed ones
          sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-._()]/g, "");
          break;
        case "email":
          // Convert to lowercase and remove spaces
          sanitized = sanitized.toLowerCase().replace(/\s/g, "");
          break;
        case "phone":
          // Remove all non-digit characters except +
          sanitized = sanitized.replace(/[^\d+]/g, "");
          break;
        case "description":
          // Basic sanitization, keep most characters
          sanitized = sanitized.replace(/[<>]/g, "");
          break;
      }

      return sanitized;
    },
    [],
  );

  const validateField = useCallback(
    (field: keyof FormData, value: string): string | undefined => {
      const rules = VALIDATION_RULES[field];
      const sanitizedValue = sanitizeInput(value, field);

      if (rules.required && !sanitizedValue) {
        return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      }

      if (
        sanitizedValue &&
        rules.minLength !== undefined &&
        sanitizedValue.length < rules.minLength
      ) {
        return `${field.charAt(0).toUpperCase() + field.slice(1)} must be at least ${rules.minLength} characters`;
      }

      if (
        sanitizedValue &&
        rules.maxLength !== undefined &&
        sanitizedValue.length > rules.maxLength
      ) {
        return `${field.charAt(0).toUpperCase() + field.slice(1)} must not exceed ${rules.maxLength} characters`;
      }

      if (
        sanitizedValue &&
        rules.pattern !== undefined &&
        !rules.pattern.test(sanitizedValue)
      ) {
        switch (field) {
          case "email":
            return "Please enter a valid email address";
          case "phone":
            return "Please enter a valid Nepali phone number (9XXXXXXXX or +9779XXXXXXXX)";
          case "name":
            return "Name can only contain letters, numbers, spaces, and basic punctuation";
          case "city":
            return "City name can only contain letters, spaces, and basic punctuation";
          default:
            return "Invalid format";
        }
      }

      return undefined;
    },
    [sanitizeInput],
  );

  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};
    let isValid = true;

    (Object.keys(formData) as Array<keyof FormData>).forEach((field) => {
      const error = validateField(field, formData[field]);

      if (error) {
        errors[field] = error;
        isValid = false;
      }
    });

    setValidationErrors(errors);

    return isValid;
  }, [formData, validateField]);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const retryOperation = async <T,>(
    operation: () => Promise<T>,
    attempts: number = RETRY_ATTEMPTS,
    delay: number = RETRY_DELAY,
  ): Promise<T> => {
    let lastError: Error;

    for (let i = 0; i < attempts; i++) {
      try {
        if (i > 0) {
          setLoadingStates((prev) => ({ ...prev, retrying: true }));
          await sleep(delay * Math.pow(2, i - 1)); // Exponential backoff
        }

        const result = await operation();

        setLoadingStates((prev) => ({ ...prev, retrying: false }));
        setRetryCount(0);

        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${i + 1} failed:`, error);

        if (i === attempts - 1) {
          setLoadingStates((prev) => ({ ...prev, retrying: false }));
          setRetryCount(attempts);
          throw lastError;
        }
      }
    }

    throw lastError!;
  };

  // Load clinic data with retry logic
  const loadClinicData = useCallback(async () => {
    if (!clinicId) return;

    setLoadingStates((prev) => ({ ...prev, data: true }));
    setError(null);

    try {
      const clinicData = await retryOperation(() =>
        clinicService.getClinicById(clinicId),
      );

      if (clinicData) {
        setClinic(clinicData);
        const initialFormData = {
          name: clinicData.name || "",
          email: clinicData.email || "",
          phone: clinicData.phone || "",
          city: clinicData.city || "",
          state: clinicData.state || "Bagmati",
          zipCode: clinicData.zipCode || "44600",
          country: clinicData.country || "Nepal",
          address: clinicData.address || "",
          description: clinicData.description || "",
        };

        setFormData(initialFormData);
        setOriginalFormData(initialFormData);
        setValidationErrors({});
        setTouchedFields(new Set());

        // Get logo preview URL if logo exists
        if (clinicData.logo) {
          if (clinicData.logo.startsWith("http")) {
            setLogoPreview(clinicData.logo);
          } else {
            try {
              const url = storage.getFileView(
                APPWRITE_BUCKET_ID,
                clinicData.logo,
              );

              setLogoPreview(url.toString());
            } catch (err) {
              console.error("Error getting logo preview:", err);
            }
          }
        }

        // Clear any existing validation errors since we're loading fresh data
        setTimeout(() => {
          setValidationErrors({});
        }, 100);
      }
    } catch (error) {
      console.error("Error loading clinic data:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load clinic information";

      setError(errorMessage);

      addToast({
        title: "Error",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, data: false }));
    }
  }, [clinicId]);

  // Load clinic types with retry logic
  const loadClinicTypes = useCallback(async () => {
    try {
      const types = await retryOperation(() =>
        clinicTypeService.getActiveClinicTypes(),
      );

      setClinicTypes(types);
    } catch (error) {
      console.error("Error loading clinic types:", error);
      // Don't show error for clinic types as it's not critical
    }
  }, []);

  // Load subscription plans with retry logic
  const loadSubscriptionPlans = useCallback(async () => {
    try {
      const plans = await retryOperation(() =>
        subscriptionService.getAllSubscriptionPlans(),
      );

      setSubscriptionPlans(plans);
    } catch (error) {
      console.error("Error loading subscription plans:", error);
      // Don't show error for subscription plans as it's not critical
    }
  }, []);

  // Load data on component mount
  useEffect(() => {
    loadClinicData();
    loadClinicTypes();
    loadSubscriptionPlans();
  }, [clinicId, loadClinicData, loadClinicTypes, loadSubscriptionPlans]);

  // Clear validation errors when modal opens
  useEffect(() => {
    if (isOpen) {
      setValidationErrors({});
      setTouchedFields(new Set());
    }
  }, [isOpen]);

  // Handle input changes with debounced validation
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      const fieldName = name as keyof FormData;

      // Clear previous debounce timer
      if (debounceTimer[0]) {
        clearTimeout(debounceTimer[0]);
      }

      // Update form data with raw value (no sanitization during typing)
      setFormData((prev) => ({
        ...prev,
        [fieldName]: value,
      }));

      // Mark field as touched
      setTouchedFields((prev) => new Set(prev).add(fieldName));

      // Debounced validation with sanitized value
      debounceTimer[0] = setTimeout(() => {
        const sanitizedValue = sanitizeInput(value, fieldName);
        const error = validateField(fieldName, sanitizedValue);

        setValidationErrors((prev) => ({
          ...prev,
          [fieldName]: error,
        }));
      }, DEBOUNCE_DELAY);
    },
    [sanitizeInput, validateField],
  );

  // Handle Save
  const handleSave = useCallback(async () => {
    if (!clinicId) return;

    // Validate form
    if (!validateForm()) {
      addToast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        color: "danger",
      });

      return;
    }

    // Check if form has changes
    const hasChanges = Object.keys(formData).some(
      (key) =>
        formData[key as keyof FormData] !==
        originalFormData[key as keyof FormData],
    );

    if (!hasChanges && !isUploadingLogo) {
      // Only check data if no recent upload
      addToast({
        title: "No Changes",
        description: "No changes detected to save",
        color: "default",
      });
      onClose();

      return;
    }

    setLoadingStates((prev) => ({ ...prev, saving: true }));

    try {
      const updateData: Partial<Clinic> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        zipCode: formData.zipCode.trim(),
        country: formData.country.trim(),
        address: formData.address.trim(),
        description: formData.description.trim(),
      };

      await retryOperation(() =>
        clinicService.updateClinic(clinicId, updateData),
      );

      // Update local state immediately so UI reflects changes
      setClinic(
        (prev) =>
          ({
            ...(prev || {
              id: clinicId,
              subscriptionStatus: "active",
              subscriptionPlan: "trial",
              subscriptionStartDate: new Date(),
              isMultiBranchEnabled: false,
              maxBranches: 1,
              createdAt: new Date(),
            }),
            ...updateData,
            updatedAt: new Date(),
          }) as Clinic,
      );

      setOriginalFormData(formData);

      addToast({
        title: "Success",
        description: "Clinic information updated successfully",
        color: "success",
      });

      // Notify other components (Header) to refresh branding
      window.dispatchEvent(new CustomEvent("clinic-branding-updated"));

      onClose();
    } catch (error) {
      console.error("Error updating clinic:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update clinic information";

      addToast({
        title: "Error",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, saving: false }));
    }
  }, [
    clinicId,
    clinic,
    formData,
    originalFormData,
    validateForm,
    onClose,
    isUploadingLogo,
  ]);

  // Handle Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !clinicId) return;

    setIsUploadingLogo(true);
    try {
      // 1. Upload to Appwrite
      const result = await uploadImage(
        file,
        `clinic-logo-${clinicId}-${Date.now()}`,
        400,
        400,
      );

      // 2. Update Clinic Record in Firestore
      await clinicService.updateClinic(clinicId, { logo: result.fileId });

      // 3. Update Local State
      setLogoPreview(result.fileUrl);
      setClinic((prev) => (prev ? { ...prev, logo: result.fileId } : null));

      addToast({
        title: "Logo updated",
        description: "Your clinic logo has been refreshed.",
        color: "success",
      });

      // Notify other components (Header) to refresh branding immediately
      window.dispatchEvent(new CustomEvent("clinic-branding-updated"));
    } catch (error) {
      console.error("Logo upload failed:", error);
      addToast({
        title: "Upload failed",
        description: "Could not update the logo. Please try again.",
        color: "danger",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Handle Logo Removal
  const handleRemoveLogo = async () => {
    if (
      !clinicId ||
      !window.confirm("Are you sure you want to remove the clinic logo?")
    )
      return;

    setLoadingStates((prev) => ({ ...prev, saving: true }));
    try {
      // 1. Update Clinic Record in Firestore (set logo to empty)
      await clinicService.updateClinic(clinicId, { logo: "" });

      // 2. Update Local State
      setLogoPreview(null);
      setClinic((prev) => (prev ? { ...prev, logo: "" } : null));

      addToast({
        title: "Logo removed",
        description: "Your clinic branding has been reset to default.",
        color: "success",
      });

      // Notify header
      window.dispatchEvent(new CustomEvent("clinic-branding-updated"));
    } catch (error) {
      console.error("Logo removal failed:", error);
      addToast({
        title: "Error",
        description: "Could not remove the logo. Please try again.",
        color: "danger",
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, saving: false }));
    }
  };

  // Handle modal close with unsaved changes warning
  const handleModalClose = useCallback(() => {
    const hasUnsavedChanges = Object.keys(formData).some(
      (key) =>
        formData[key as keyof FormData] !==
        originalFormData[key as keyof FormData],
    );

    if (hasUnsavedChanges) {
      if (
        window.confirm(
          "You have unsaved changes. Are you sure you want to close?",
        )
      ) {
        // Reset form data
        setFormData(originalFormData);
        setValidationErrors({});
        setTouchedFields(new Set());
        onClose();
      }
    } else {
      onClose();
    }
  }, [formData, originalFormData, onClose]);

  // Memoized clinic type name lookup
  const getClinicTypeName = useMemo(() => {
    return (typeId: string) => {
      const type = clinicTypes.find((t) => t.id === typeId);

      return type ? type.name : "Unknown";
    };
  }, [clinicTypes]);

  // Memoized subscription plan name lookup
  const getSubscriptionPlanName = useMemo(() => {
    return (planId: string) => {
      const plan = subscriptionPlans.find((p) => p.id === planId);

      return plan ? plan.name : "Unknown Plan";
    };
  }, [subscriptionPlans]);

  // Memoized form validation status
  const formIsValid = useMemo(() => {
    // Check if form data is loaded (not all empty strings)
    const isFormLoaded = Object.values(formData).some(
      (value) => value.trim() !== "",
    );

    if (!isFormLoaded) {
      return false;
    }

    // Check if all required fields are filled
    const requiredFields: Array<keyof FormData> = [
      "name",
      "email",
      "phone",
      "city",
    ];
    const allRequiredFieldsFilled = requiredFields.every(
      (field) => formData[field] && formData[field].trim() !== "",
    );

    if (!allRequiredFieldsFilled) {
      return false;
    }

    // Check if there are any validation errors for touched fields
    const hasValidationErrors = Object.entries(validationErrors).some(
      ([field, error]) => error && touchedFields.has(field as keyof FormData),
    );

    return !hasValidationErrors;
  }, [validationErrors, formData, touchedFields]);

  if (loadingStates.data) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !clinic) {
    return (
      <div
        aria-label="Clinic Settings"
        className="flex flex-col gap-6"
        role="main"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={title({ size: "lg" })}>Clinic Information</h1>
            <p className={subtitle({ class: "mt-1" })}>
              Manage your clinic details and contact information
            </p>
          </div>

          <div className="flex gap-3">
            <Link aria-label="Back to Settings" to="/dashboard/settings">
              <Button startContent={<IoArrowBackOutline />} variant="light">
                Back to Settings
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardBody className="flex items-center justify-center py-12">
            <div className="text-center">
              <IoWarningOutline className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <p className="text-mountain-500 mb-4">{error}</p>
              <Button
                color="primary"
                isLoading={loadingStates.data}
                startContent={<IoRefreshOutline />}
                variant="flat"
                onClick={loadClinicData}
              >
                Retry
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        aria-label="Clinic Settings"
        className="flex flex-col gap-6"
        role="main"
      >
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={title({ size: "lg" })}>Clinic Information</h1>
            <p className={subtitle({ class: "mt-1" })}>
              Manage your clinic details and contact information
            </p>
          </div>

          <div className="flex gap-3">
            <Link aria-label="Back to Settings" to="/dashboard/settings">
              <Button startContent={<IoArrowBackOutline />} variant="light">
                Back to Settings
              </Button>
            </Link>
            {!clinic ? (
              <Button
                aria-label="Setup clinic information"
                color="primary"
                startContent={<IoPencilOutline />}
                onPress={onOpen}
              >
                Setup Clinic
              </Button>
            ) : (
              <Button
                aria-label="Edit clinic information"
                color="primary"
                startContent={<IoPencilOutline />}
                onPress={onOpen}
              >
                Edit Information
              </Button>
            )}
          </div>
        </div>

        {!clinic ? (
          /* Empty State / Setup CTA */
          <Card className="border-dashed border-2 border-mountain-200 bg-mountain-50/30">
            <CardBody className="flex items-center justify-center py-16">
              <div className="text-center max-w-sm mx-auto">
                <div className="w-16 h-16 rounded-full bg-mountain-100 flex items-center justify-center mx-auto mb-4">
                  <IoBusinessOutline className="w-8 h-8 text-mountain-400" />
                </div>
                <h3 className="text-lg font-bold text-mountain-900 mb-2">
                  Setup Your Clinic
                </h3>
                <p className="text-mountain-500 text-sm mb-6">
                  You haven't configured your clinic information yet. Add your
                  clinic name, logo, and contact details to get started.
                </p>
                <Button
                  color="primary"
                  size="lg"
                  startContent={<IoPencilOutline />}
                  onPress={onOpen}
                >
                  Enter Clinic Details
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          /* Current Clinic Information Display */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader className="flex gap-3">
                <IoBusinessOutline className="w-5 h-5 text-[rgb(var(--color-primary))]" />
                <div>
                  <h3 className="text-stat-sm font-semibold text-[rgb(var(--color-text))]">
                    Basic Information
                  </h3>
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">
                    Your clinic's primary details
                  </p>
                </div>
              </CardHeader>
              <Divider className="opacity-50" />
              <CardBody className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-6 mb-2">
                  {/* Logo Section */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] flex items-center justify-center shadow-sm">
                        {isUploadingLogo ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <div className="w-12 h-1 bg-border-base overflow-hidden rounded-full">
                              <div className="h-full bg-primary animate-[shimmer_1.5s_infinite] w-1/2" />
                            </div>
                            <span className="text-[8px] font-bold text-primary uppercase">
                              Uploading
                            </span>
                          </div>
                        ) : logoPreview ? (
                          <img
                            alt="Clinic Logo"
                            className="w-full h-full object-cover"
                            src={logoPreview}
                          />
                        ) : (
                          <IoImageOutline className="w-8 h-8 text-[rgb(var(--color-text-muted))]" />
                        )}
                      </div>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                        <div className="flex gap-2">
                          <div
                            className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                            title="Change logo"
                          >
                            <IoPencilOutline className="text-white w-5 h-5" />
                          </div>
                          {logoPreview && (
                            <div
                              className="p-2 bg-red-500/40 hover:bg-red-500/60 rounded-full transition-colors"
                              title="Remove logo"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRemoveLogo();
                              }}
                            >
                              <IoTrashOutline className="text-white w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <input
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingLogo}
                          type="file"
                          onChange={handleLogoUpload}
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-[rgb(var(--color-text-muted))] text-center font-medium">
                      Click to change logo
                      <br />
                      (Max 2MB)
                    </p>
                  </div>

                  {/* Quick Details */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                        Clinic Name
                      </p>
                      <p className="text-stat-sm font-bold text-[rgb(var(--color-primary))] leading-tight">
                        {clinic.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                        Clinic Type
                      </p>
                      <Chip color="primary" size="sm" variant="flat">
                        {getClinicTypeName(clinic.clinicType)}
                      </Chip>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Description
                  </p>
                  <p className="text-[rgb(var(--color-text))] text-sm leading-relaxed">
                    {clinic.description || "No description provided"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Registration Date
                  </p>
                  <p className="text-[rgb(var(--color-text))] text-sm">
                    {clinic.createdAt?.toLocaleDateString()}
                  </p>
                </div>
              </CardBody>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader className="flex gap-3">
                <IoCallOutline className="w-5 h-5 text-[rgb(var(--color-primary))]" />
                <div>
                  <h3 className="text-stat-sm font-semibold text-[rgb(var(--color-text))]">
                    Contact Information
                  </h3>
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">
                    How patients can reach you
                  </p>
                </div>
              </CardHeader>
              <Divider className="opacity-50" />
              <CardBody className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Email Address
                  </p>
                  <div className="flex items-center gap-2">
                    <IoMailOutline className="w-4 h-4 text-[rgb(var(--color-text-muted))]" />
                    <p className="text-[rgb(var(--color-text))]">
                      {clinic.email}
                    </p>
                    <Chip color="success" size="sm" variant="flat">
                      <IoShieldCheckmarkOutline className="w-3 h-3 mr-1" />
                      Verified
                    </Chip>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Phone Number
                  </p>
                  <div className="flex items-center gap-2">
                    <IoCallOutline className="w-4 h-4 text-[rgb(var(--color-text-muted))]" />
                    <p className="text-[rgb(var(--color-text))]">
                      {clinic.phone}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Location
                  </p>
                  <div className="flex items-center gap-2">
                    <IoLocationOutline className="w-4 h-4 text-[rgb(var(--color-text-muted))]" />
                    <p className="text-[rgb(var(--color-text))]">
                      {clinic.address ? `${clinic.address}, ` : ""}
                      {clinic.city}, {clinic.state} {clinic.zipCode},{" "}
                      {clinic.country}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {!clinic ? (
              /* Empty State / Setup CTA */
              <Card className="border-dashed border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))]">
                <CardBody className="flex items-center justify-center py-16">
                  <div className="text-center max-w-sm mx-auto">
                    <div className="w-16 h-16 rounded-full bg-[rgb(var(--color-surface-3))] flex items-center justify-center mx-auto mb-4">
                      <IoBusinessOutline className="w-8 h-8 text-[rgb(var(--color-text-muted))]" />
                    </div>
                    <h3 className="text-lg font-bold text-[rgb(var(--color-text))] mb-2">
                      Setup Your Clinic
                    </h3>
                    <p className="text-[rgb(var(--color-text-muted))] text-sm mb-6">
                      You haven't configured your clinic information yet. Add
                      your clinic name, logo, and contact details to get
                      started.
                    </p>
                    <Button
                      color="primary"
                      size="lg"
                      startContent={<IoPencilOutline />}
                      onPress={onOpen}
                    >
                      Enter Clinic Details
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : (
              /* ... previous refactored code ... */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Subscription Information */}
                <Card className="lg:col-span-2">
                  <CardHeader className="flex gap-3">
                    <IoCheckmarkCircleOutline className="w-5 h-5 text-health-600" />
                    <div>
                      <h3 className="text-stat-sm font-semibold text-[rgb(var(--color-text))]">
                        Subscription Information
                      </h3>
                      <p className="text-sm text-[rgb(var(--color-text-muted))]">
                        Your current subscription details
                      </p>
                    </div>
                  </CardHeader>
                  <Divider className="opacity-50" />
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                          Status
                        </p>
                        <Chip
                          color={
                            clinic.subscriptionStatus === "active"
                              ? "success"
                              : clinic.subscriptionStatus === "suspended"
                                ? "warning"
                                : "danger"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {clinic.subscriptionStatus
                            ? clinic.subscriptionStatus
                                .charAt(0)
                                .toUpperCase() +
                              clinic.subscriptionStatus.slice(1)
                            : "Unknown"}
                        </Chip>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                          Plan
                        </p>
                        <p className="text-[rgb(var(--color-text))]">
                          {getSubscriptionPlanName(clinic.subscriptionPlan)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                          Billing Type
                        </p>
                        <Chip
                          color={
                            clinic.subscriptionType === "yearly"
                              ? "primary"
                              : "default"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {clinic.subscriptionType === "yearly"
                            ? "Yearly"
                            : "Monthly"}
                        </Chip>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                          Start Date
                        </p>
                        <p className="text-[rgb(var(--color-text))] text-sm">
                          {clinic.subscriptionStartDate?.toLocaleDateString() ||
                            "N/A"}
                        </p>
                      </div>

                      {clinic.subscriptionEndDate && (
                        <div>
                          <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                            End Date
                          </p>
                          <p className="text-[rgb(var(--color-text))] text-sm">
                            {clinic.subscriptionEndDate?.toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Information Modal */}
      <Modal
        hideCloseButton={true}
        isDismissable={false}
        isOpen={isOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={handleModalClose}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <IoPencilOutline className="w-5 h-5" />
              <h3>Edit Clinic Information</h3>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                  Clinic Name <span className="text-red-600">*</span>
                </label>
                <Input
                  isRequired
                  aria-describedby={
                    validationErrors.name ? "name-error" : undefined
                  }
                  errorMessage={
                    touchedFields.has("name") ? validationErrors.name : ""
                  }
                  isInvalid={
                    touchedFields.has("name") && !!validationErrors.name
                  }
                  maxLength={VALIDATION_RULES.name.maxLength}
                  name="name"
                  placeholder="Enter clinic name"
                  startContent={
                    <IoBusinessOutline className="text-[rgb(var(--color-text-muted))]" />
                  }
                  value={formData.name}
                  variant="bordered"
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                  Email Address <span className="text-red-600">*</span>
                </label>
                <Input
                  isRequired
                  aria-describedby={
                    validationErrors.email ? "email-error" : undefined
                  }
                  errorMessage={
                    touchedFields.has("email") ? validationErrors.email : ""
                  }
                  isInvalid={
                    touchedFields.has("email") && !!validationErrors.email
                  }
                  maxLength={VALIDATION_RULES.email.maxLength}
                  name="email"
                  placeholder="clinic@example.com"
                  startContent={
                    <IoMailOutline className="text-[rgb(var(--color-text-muted))]" />
                  }
                  type="email"
                  value={formData.email}
                  variant="bordered"
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <Input
                  isRequired
                  aria-describedby={
                    validationErrors.phone ? "phone-error" : undefined
                  }
                  errorMessage={
                    touchedFields.has("phone") ? validationErrors.phone : ""
                  }
                  isInvalid={
                    touchedFields.has("phone") && !!validationErrors.phone
                  }
                  name="phone"
                  placeholder="9XXXXXXXX or +9779XXXXXXXX"
                  startContent={
                    <IoCallOutline className="text-[rgb(var(--color-text-muted))]" />
                  }
                  type="tel"
                  value={formData.phone}
                  variant="bordered"
                  onChange={handleInputChange}
                />
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
                  Enter Nepali phone number format (10 digits starting with 9)
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                  City <span className="text-red-600">*</span>
                </label>
                <Input
                  isRequired
                  aria-describedby={
                    validationErrors.city ? "city-error" : undefined
                  }
                  errorMessage={
                    touchedFields.has("city") ? validationErrors.city : ""
                  }
                  isInvalid={
                    touchedFields.has("city") && !!validationErrors.city
                  }
                  maxLength={VALIDATION_RULES.city.maxLength}
                  name="city"
                  placeholder="Enter city name"
                  startContent={
                    <IoLocationOutline className="text-[rgb(var(--color-text-muted))]" />
                  }
                  value={formData.city}
                  variant="bordered"
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    State/Province <span className="text-red-600">*</span>
                  </label>
                  <Input
                    isRequired
                    errorMessage={
                      touchedFields.has("state") ? validationErrors.state : ""
                    }
                    isInvalid={
                      touchedFields.has("state") && !!validationErrors.state
                    }
                    name="state"
                    placeholder="Enter state"
                    value={formData.state}
                    variant="bordered"
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    ZIP/Postal Code <span className="text-red-600">*</span>
                  </label>
                  <Input
                    isRequired
                    errorMessage={
                      touchedFields.has("zipCode")
                        ? validationErrors.zipCode
                        : ""
                    }
                    isInvalid={
                      touchedFields.has("zipCode") && !!validationErrors.zipCode
                    }
                    name="zipCode"
                    placeholder="Enter zip code"
                    value={formData.zipCode}
                    variant="bordered"
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                  Country <span className="text-red-600">*</span>
                </label>
                <Input
                  isRequired
                  errorMessage={
                    touchedFields.has("country") ? validationErrors.country : ""
                  }
                  isInvalid={
                    touchedFields.has("country") && !!validationErrors.country
                  }
                  name="country"
                  placeholder="Enter country"
                  value={formData.country}
                  variant="bordered"
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                  Full Address <span className="text-red-600">*</span>
                </label>
                <Textarea
                  isRequired
                  errorMessage={
                    touchedFields.has("address") ? validationErrors.address : ""
                  }
                  isInvalid={
                    touchedFields.has("address") && !!validationErrors.address
                  }
                  name="address"
                  placeholder="Enter full street address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                  Description
                </label>
                <Textarea
                  aria-describedby={
                    validationErrors.description
                      ? "description-error"
                      : undefined
                  }
                  errorMessage={
                    touchedFields.has("description")
                      ? validationErrors.description
                      : ""
                  }
                  isInvalid={
                    touchedFields.has("description") &&
                    !!validationErrors.description
                  }
                  maxLength={VALIDATION_RULES.description.maxLength}
                  name="description"
                  placeholder="Brief description of your clinic"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                />
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
                  {formData.description.length}/
                  {VALIDATION_RULES.description.maxLength} characters
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              aria-label="Cancel editing"
              variant="light"
              onClick={handleModalClose}
            >
              Cancel
            </Button>
            <Button
              aria-label="Save clinic information"
              color="primary"
              isDisabled={!formIsValid || loadingStates.saving}
              isLoading={loadingStates.saving}
              startContent={!loadingStates.saving && <IoSaveOutline />}
              onClick={handleSave}
            >
              {loadingStates.saving ? "Saving..." : "Save Changes"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
