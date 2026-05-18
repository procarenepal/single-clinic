import { useState, useEffect } from "react";
import clsx from "clsx";
import {
  IoTimeOutline,
  IoAddOutline,
  IoTrashOutline,
  IoArrowBackOutline,
  IoPencilOutline,
  IoSparklesOutline,
} from "react-icons/io5";

import { title, subtitle } from "@/components/primitives";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Checkbox,
  Chip,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Link,
} from "@/components/ui";
import { AppointmentType } from "@/types/models";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { useAuthContext } from "@/context/AuthContext";
import {
  APPOINTMENT_COLORS,
  getAppointmentColorById,
} from "@/utils/appointmentColors";
import { useModalState } from "@/hooks/useModalState";
import { useTheme } from "@/context/ThemeContext";

export default function AppointmentSettingsPage() {
  const modalState = useModalState(false);
  const { clinicId, branchId, currentUser, userData, isClinicAdmin } =
    useAuthContext();
  const { isDark } = useTheme();
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [editingType, setEditingType] = useState<AppointmentType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showInactive, setShowInactive] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Filter appointment types based on status
  const filteredAppointmentTypes = appointmentTypes.filter((type) =>
    showInactive ? true : type.isActive,
  );

  // Load appointment types on component mount
  useEffect(() => {
    if (clinicId) {
      loadAppointmentTypes();
    }
  }, [clinicId]);

  const loadAppointmentTypes = async () => {
    if (!clinicId) return;

    setIsLoadingData(true);
    try {
      console.log(
        "Loading appointment types directly from Firebase for clinic:",
        clinicId,
        "branch:",
        branchId,
      );

      // Always fetch directly from Firebase - bypass cache completely
      const { collection, getDocs, query, where } = await import(
        "firebase/firestore"
      );
      const { db } = await import("@/config/firebase");

      console.log("Fetching directly from Firestore...");
      const appointmentTypesRef = collection(db, "appointment_types");

      // For individual clinics, we only filter by clinicId
      // For multi-branch clinics, we may need to filter by branchId too
      let q;

      if (branchId) {
        // User has a specific branch - filter by both clinicId and branchId
        q = query(
          appointmentTypesRef,
          where("clinicId", "==", clinicId),
          where("branchId", "==", branchId),
        );
      } else {
        // Individual clinic or system-owner - show all for clinic
        q = query(appointmentTypesRef, where("clinicId", "==", clinicId));
      }

      const querySnapshot = await getDocs(q);
      const types: AppointmentType[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        const createdAt = data.createdAt
          ? new Date(data.createdAt.seconds * 1000)
          : new Date();
        const updatedAt = data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000)
          : new Date();

        types.push({
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
        } as AppointmentType);
      });

      console.log("Direct fetch from Firestore completed:", types);
      setAppointmentTypes(types);
    } catch (error) {
      console.error("Error loading appointment types:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveAppointmentType = async (type: Partial<AppointmentType>) => {
    if (!clinicId || !currentUser) return;

    setIsLoading(true);
    try {
      console.log("Saving appointment type:", type);
      console.log("User data:", userData);
      console.log("Branch ID:", branchId);

      let savedId: string | undefined;

      if (editingType && editingType.id) {
        // Update existing type
        console.log("Updating existing type with ID:", editingType.id);
        await appointmentTypeService.updateAppointmentType(editingType.id, {
          name: type.name,
          price: type.price,
          isActive: type.isActive,
          color: type.color,
        });
        savedId = editingType.id;
      } else {
        // Add new type
        console.log("Creating new appointment type");

        const newTypeData: any = {
          name: type.name!,
          price: type.price!,
          isActive: type.isActive ?? true,
          color: type.color || "none",
          clinicId,
          createdBy: currentUser.uid,
        };

        // Only include branchId if the user has one (for multi-branch clinics)
        if (branchId) {
          newTypeData.branchId = branchId;
        }

        console.log("New type data:", newTypeData);
        savedId =
          await appointmentTypeService.createAppointmentType(newTypeData);
        console.log("Created appointment type with ID:", savedId);
      }

      // Invalidate appointment types cache for this clinic so billing gets fresh data
      console.log("Invalidating appointment types cache for clinic:", clinicId);
      const { cacheService } = await import("@/services/cacheService");

      if (clinicId) {
        cacheService.invalidateClinicAppointmentTypes(clinicId);
      }

      // Wait for database write completion
      console.log("Waiting for database write completion...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify the saved appointment type exists in database
      if (savedId) {
        console.log("Verifying saved appointment type exists...");
        try {
          const savedType =
            await appointmentTypeService.getAppointmentTypeById(savedId);

          console.log("Verified saved appointment type:", savedType);
        } catch (verifyError) {
          console.error("Error verifying saved appointment type:", verifyError);
        }
      }

      // Reload appointment types directly from Firebase
      console.log("Reloading appointment types directly from Firebase...");
      await loadAppointmentTypes();
      console.log("Appointment types reloaded successfully");

      // Only close the modal and reset state after successful database operation and reload
      modalState.forceClose();
      setEditingType(null);
    } catch (error) {
      console.error("Error saving appointment type:", error);
      // Don't close modal on error - let user try again or manually close
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAppointmentType = async (typeId: string) => {
    if (!confirm("Are you sure you want to delete this appointment type?"))
      return;

    try {
      await appointmentTypeService.deleteAppointmentType(typeId);
      // Reload the appointment types
      await loadAppointmentTypes();
    } catch (error) {
      console.error("Error deleting appointment type:", error);
    }
  };

  const handleSeedSkincareTypes = async () => {
    if (!clinicId || !currentUser) return;
    if (
      !confirm(
        "Are you sure you want to seed 10 skincare hospital appointment types? This will replace your current appointment types."
      )
    )
      return;

    setIsLoadingData(true);
    try {
      console.log("Seeding skincare appointment types for clinic:", clinicId);

      const {
        collection,
        getDocs,
        deleteDoc,
        doc,
        addDoc,
        query,
        where,
        serverTimestamp,
      } = await import("firebase/firestore");
      const { db } = await import("@/config/firebase");

      const appointmentTypesRef = collection(db, "appointment_types");

      // 1. Delete existing types
      const q = query(appointmentTypesRef, where("clinicId", "==", clinicId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const deletePromises = snapshot.docs.map((docSnap) =>
          deleteDoc(doc(db, "appointment_types", docSnap.id))
        );
        await Promise.all(deletePromises);
      }

      // 2. Add the 10 skincare types
      const skincareTypes = [
        { name: "Acne Consultation & Care", price: 1200, color: "cyan" },
        { name: "Botox & Anti-Aging Consultation", price: 3000, color: "purple" },
        { name: "Advanced Chemical Peel", price: 2500, color: "orange" },
        { name: "Laser Hair Reduction Consultation", price: 1500, color: "blue" },
        { name: "Platelet-Rich Plasma (PRP) Therapy", price: 4500, color: "pink" },
        { name: "Microdermabrasion & Facial Rejuvenation", price: 3500, color: "emerald" },
        { name: "Mole & Skin Tag Removal (Electrocautery)", price: 2000, color: "red" },
        { name: "Hyperpigmentation & Melasma Treatment", price: 1800, color: "amber" },
        { name: "Eczema, Psoriasis & Allergy Management", price: 1000, color: "default" },
        { name: "Customized Skincare Routine & Product Audit", price: 800, color: "teal" }
      ];

      const addPromises = skincareTypes.map((type) => {
        const newType: any = {
          ...type,
          clinicId,
          isActive: true,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (branchId) {
          newType.branchId = branchId;
        }
        return addDoc(appointmentTypesRef, newType);
      });

      await Promise.all(addPromises);

      // Invalidate cache
      const { cacheService } = await import("@/services/cacheService");
      cacheService.invalidateClinicAppointmentTypes(clinicId);

      // Reload
      await loadAppointmentTypes();
      alert("Successfully seeded 10 professional skincare hospital appointment types!");
    } catch (error) {
      console.error("Error seeding skincare types:", error);
      alert(
        "Failed to seed appointment types: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTypes.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedTypes.size} appointment type(s)? This action cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    setIsBatchDeleting(true);
    try {
      console.log(
        "Batch deleting appointment types:",
        Array.from(selectedTypes),
      );

      // Delete all selected types in parallel
      const deletePromises = Array.from(selectedTypes).map((typeId) =>
        appointmentTypeService.deleteAppointmentType(typeId),
      );

      await Promise.all(deletePromises);

      // Clear selection
      setSelectedTypes(new Set());

      // Reload the appointment types directly from Firebase
      await loadAppointmentTypes();

      console.log("Batch delete completed successfully");
    } catch (error) {
      console.error("Error batch deleting appointment types:", error);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleSelectType = (typeId: string, isSelected: boolean) => {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev);

      if (isSelected) {
        newSet.add(typeId);
      } else {
        newSet.delete(typeId);
      }

      return newSet;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const allTypeIds = filteredAppointmentTypes.map((type) => type.id);

      setSelectedTypes(new Set(allTypeIds));
    } else {
      setSelectedTypes(new Set());
    }
  };

  const isAllSelected =
    filteredAppointmentTypes.length > 0 &&
    filteredAppointmentTypes.every((type) => selectedTypes.has(type.id));
  const isIndeterminate = selectedTypes.size > 0 && !isAllSelected;

  const handleEditAppointmentType = (type: AppointmentType) => {
    setEditingType(type);
    modalState.open();
  };

  const handleToggleStatus = async (typeId: string, currentStatus: boolean) => {
    try {
      await appointmentTypeService.toggleAppointmentTypeStatus(
        typeId,
        !currentStatus,
      );
      // Reload the appointment types
      await loadAppointmentTypes();
    } catch (error) {
      console.error("Error toggling appointment type status:", error);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>Appointment Configuration</h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              Manage appointment types and pricing in Nepali Rupees (NPR)
            </p>
          </div>

          <div className="flex gap-3">
            <Link to="/dashboard/settings">
              <Button startContent={<IoArrowBackOutline />} variant="light">
                Back to Settings
              </Button>
            </Link>
          </div>
        </div>
        <Card>
          <CardBody className="flex items-center justify-center py-12">
            <Spinner label="Loading appointment types..." size="lg" />
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
            <h1 className={`${title({ size: "lg" })} text-primary`}>Appointment Configuration</h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              Manage appointment types and pricing in Nepali Rupees (NPR)
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              isDisabled={isLoadingData}
              startContent={<IoTimeOutline />}
              variant="light"
              onClick={() => loadAppointmentTypes()}
            >
              Refresh
            </Button>
            <Link to="/dashboard/settings">
              <Button startContent={<IoArrowBackOutline />} variant="light">
                Back to Settings
              </Button>
            </Link>
            <Button
              color="warning"
              variant="flat"
              startContent={<IoSparklesOutline className="text-warning-500" />}
              onClick={handleSeedSkincareTypes}
              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 font-medium"
            >
              Seed Skincare Types
            </Button>
            <Button
              color="primary"
              startContent={<IoAddOutline />}
              onClick={() => {
                setEditingType(null);
                modalState.open();
              }}
            >
              Add New Type
            </Button>
          </div>
        </div>

        {/* Appointment Types */}
        <Card>
          <CardHeader className="flex justify-between">
            <div className="flex items-center gap-2">
              <IoTimeOutline className="w-5 h-5" />
              <div>
                <h3 className="text-lg font-semibold">Appointment Types</h3>
                <p className="text-sm text-mountain-500">
                  {appointmentTypes.filter((t) => t.isActive).length} active of{" "}
                  {appointmentTypes.length} total
                  {selectedTypes.size > 0 &&
                    ` • ${selectedTypes.size} selected`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedTypes.size > 0 && (
                <Button
                  color="danger"
                  isDisabled={isBatchDeleting}
                  isLoading={isBatchDeleting}
                  size="sm"
                  startContent={<IoTrashOutline />}
                  variant="flat"
                  onClick={handleBatchDelete}
                >
                  Delete Selected ({selectedTypes.size})
                </Button>
              )}
              <Checkbox
                color="primary"
                isSelected={showInactive}
                onValueChange={setShowInactive}
              >
                Show inactive
              </Checkbox>
            </div>
          </CardHeader>
          <CardBody>
            {filteredAppointmentTypes.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-mountain-400 mb-4">
                  <IoTimeOutline className="w-16 h-16 mx-auto mb-2" />
                </div>
                <h3 className="text-lg font-semibold text-mountain-600 mb-2">
                  {appointmentTypes.length === 0
                    ? "No appointment types found"
                    : "No appointment types match the current filter"}
                </h3>
                <p className="text-mountain-500 mb-6">
                  {appointmentTypes.length === 0
                    ? "Get started by creating your first appointment type with pricing."
                    : showInactive
                      ? "All appointment types are currently active."
                      : "Toggle 'Show inactive' to see inactive appointment types."}
                </p>
                {appointmentTypes.length === 0 && (
                  <Button
                    color="primary"
                    startContent={<IoAddOutline />}
                    onClick={() => {
                      setEditingType(null);
                      modalState.open();
                    }}
                  >
                    Add Your First Type
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Select All Checkbox */}
                {filteredAppointmentTypes.length > 0 && (
                  <div className="flex items-center gap-3 px-2 py-2 border-b border-mountain-200">
                    <Checkbox
                      isIndeterminate={isIndeterminate}
                      isSelected={isAllSelected}
                      onValueChange={handleSelectAll}
                    >
                      <span className="text-sm font-medium">
                        {isAllSelected ? "Deselect All" : "Select All"}
                        {selectedTypes.size > 0 &&
                          ` (${selectedTypes.size} selected)`}
                      </span>
                    </Checkbox>
                  </div>
                )}

                {filteredAppointmentTypes.map((type) => (
                  <Card
                    key={type.id}
                    className={`border border-mountain-200 ${!type.isActive ? "opacity-60" : ""} ${selectedTypes.has(type.id)
                      ? "ring-2 ring-teal-200 bg-teal-50/30"
                      : ""
                      }`}
                  >
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Selection Checkbox */}
                          <Checkbox
                            color="primary"
                            isSelected={selectedTypes.has(type.id)}
                            size="sm"
                            onValueChange={(isSelected) =>
                              handleSelectType(type.id, isSelected)
                            }
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              {type.color !== "none" ? (
                                <div
                                  style={{
                                    backgroundColor: isDark ? getAppointmentColorById(type.color).darkColor : getAppointmentColorById(type.color).lightColor,
                                    boxShadow: `0 0 0 2px ${isDark ? getAppointmentColorById(type.color).darkBg : getAppointmentColorById(type.color).lightBg}`,
                                  }}
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-dashed border-border-base bg-surface-2" />
                              )}
                              <h4 className="font-semibold text-text-main">{type.name}</h4>
                              <Chip
                                color={type.isActive ? "success" : "default"}
                                size="sm"
                                variant="flat"
                              >
                                {type.isActive ? "Active" : "Inactive"}
                              </Chip>
                            </div>
                            <p className="text-sm text-mountain-500">
                              NPR {type.price.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            isSelected={type.isActive}
                            onValueChange={() =>
                              handleToggleStatus(type.id, type.isActive)
                            }
                          >
                            {type.isActive ? "Active" : "Inactive"}
                          </Checkbox>
                          <Button
                            size="sm"
                            startContent={
                              <IoPencilOutline className="w-4 h-4" />
                            }
                            variant="light"
                            onClick={() => handleEditAppointmentType(type)}
                          >
                            Edit
                          </Button>
                          <Button
                            color="danger"
                            size="sm"
                            startContent={
                              <IoTrashOutline className="w-4 h-4" />
                            }
                            variant="light"
                            onClick={() => handleDeleteAppointmentType(type.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Add/Edit Appointment Type Modal */}
      <Modal
        hideCloseButton={isLoading}
        isDismissable={!isLoading}
        isOpen={modalState.isOpen}
        size="2xl"
        onClose={modalState.close}
      >
        <ModalContent>
          <AppointmentTypeModal
            isDark={isDark}
            isLoading={isLoading}
            modalState={modalState}
            type={editingType}
            onClose={modalState.close}
            onSave={handleSaveAppointmentType}
          />
        </ModalContent>
      </Modal>
    </>
  );
}

// Separate component for the appointment type modal
function AppointmentTypeModal({
  type,
  onSave,
  onClose,
  modalState,
  isLoading,
  isDark,
}: {
  type: AppointmentType | null;
  onSave: (type: Partial<AppointmentType>) => void;
  onClose: () => void;
  modalState: ReturnType<typeof useModalState>;
  isLoading: boolean;
  isDark: boolean;
}) {
  const [formData, setFormData] = useState<Partial<AppointmentType>>(
    type || {
      name: "",
      price: 0,
      isActive: true,
      color: "none",
    },
  );

  // Reset form data when type changes
  useEffect(() => {
    const defaultFormData = {
      name: "",
      price: 0,
      isActive: true,
      color: "none",
    };

    setFormData(type || defaultFormData);
    console.log("Form data reset:", type || defaultFormData);
  }, [type]);

  const handleSubmit = () => {
    console.log("Form submission attempted with data:", formData);
    if (!formData.name?.trim()) {
      console.error("Name is required");

      return;
    }
    if (!formData.price || formData.price <= 0) {
      console.error("Price must be greater than 0");

      return;
    }
    console.log("Form validation passed, calling onSave");
    onSave(formData);
  };

  return (
    <>
      <ModalHeader>
        <h3>{type ? "Edit" : "Add"} Appointment Type</h3>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <Input
            isRequired
            label="Type Name"
            placeholder="e.g., Initial Consultation"
            value={formData.name || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                name: e.target.value,
              }))
            }
          />
          <Input
            isRequired
            label="Price (NPR)"
            min="0"
            placeholder="0"
            step="1"
            type="number"
            value={formData.price?.toString() || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                price: parseInt(e.target.value) || 0,
              }))
            }
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-mountain-700">
              Color Theme
            </label>

            {/* Selected color preview */}
            <div className="flex items-center gap-2 rounded border border-border-base bg-surface-2 px-3 py-2">
              {(() => {
                const selected = getAppointmentColorById(
                  formData.color || "none",
                );

                if (!selected || selected.id === "none") {
                  return (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-dashed border-border-base bg-surface-3" />
                      <span className="text-xs text-text-muted">
                        No specific color — uses default styling
                      </span>
                    </>
                  );
                }

                return (
                  <>
                    <div
                      className="w-4 h-4 rounded-full border border-border-base"
                      style={{
                        backgroundColor: isDark ? selected.darkColor : selected.lightColor,
                        boxShadow: `0 0 0 2px ${isDark ? selected.darkBg : selected.lightBg}`,
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text-main">
                        {selected.name}
                      </span>
                      {selected.description && (
                        <span className="text-[11px] text-text-muted">
                          {selected.description}
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Color swatch grid */}
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {APPOINTMENT_COLORS.map((color) => {
                const isSelected = (formData.color || "none") === color.id;
                const isNone = color.id === "none";

                return (
                  <button
                    key={color.id}
                    className={clsx(
                      "flex items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors",
                      "bg-surface-2 hover:bg-surface-3",
                      isSelected
                        ? "border-primary ring-1 ring-primary/40"
                        : "border-border-base",
                    )}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        color: color.id,
                      }))
                    }
                  >
                    {isNone ? (
                      <div className="w-4 h-4 rounded-full border-2 border-dashed border-border-base bg-surface-3" />
                    ) : (
                      <div
                        className="w-4 h-4 rounded-full border border-border-base flex-shrink-0"
                        style={{
                          backgroundColor: isDark ? color.darkColor : color.lightColor,
                          boxShadow: `0 0 0 2px ${isDark ? color.darkBg : color.lightBg}`,
                        }}
                      />
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text-main">
                        {color.name}
                      </span>
                      {color.description && (
                        <span className="text-[10px] text-text-muted">
                          {color.description}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              isSelected={formData.isActive ?? true}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  isActive: value,
                }))
              }
            >
              Active
            </Checkbox>
            <span className="text-sm text-mountain-500">
              {formData.isActive
                ? "This appointment type will be available for scheduling"
                : "This appointment type will be hidden from scheduling"}
            </span>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          isDisabled={isLoading}
          variant="light"
          onClick={modalState.close}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          isDisabled={
            isLoading ||
            !formData.name?.trim() ||
            !formData.price ||
            formData.price <= 0
          }
          isLoading={isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? "Saving..." : type ? "Update Type" : "Create Type"}
        </Button>
      </ModalFooter>
    </>
  );
}
