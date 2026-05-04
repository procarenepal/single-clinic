/**
 * Doctor Specialities Settings — Clinic Clarity, custom UI only (no HeroUI).
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoAddOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoSearchOutline,
  IoEllipsisVerticalOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { useAuth } from "@/hooks/useAuth";
import { specialityService } from "@/services/specialityService";
import { DoctorSpeciality } from "@/types/models";
import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@/components/ui/modal";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown";

interface SpecialityFormData {
  name: string;
  key: string;
  description: string;
  isActive: boolean;
}

const DoctorSpecialityPage: React.FC = () => {
  const { clinicId, currentUser, userData } = useAuth();
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();

  const effectiveBranchId = userData?.branchId ?? undefined;

  const [specialities, setSpecialities] = useState<DoctorSpeciality[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSpeciality, setEditingSpeciality] =
    useState<DoctorSpeciality | null>(null);
  const [formData, setFormData] = useState<SpecialityFormData>({
    name: "",
    key: "",
    description: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Partial<SpecialityFormData>>({});
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadSpecialities();
  }, [clinicId, effectiveBranchId]);

  const loadSpecialities = async () => {
    if (!clinicId) return;

    try {
      setLoading(true);
      const specialitiesData = await specialityService.getSpecialitiesByClinic(
        clinicId,
        false,
        effectiveBranchId,
      );

      setSpecialities(specialitiesData);
    } catch (error) {
      console.error("Error loading specialities:", error);
      addToast({
        title: "Error",
        description: "Failed to load specialities. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateKeyFromName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleInputChange = (
    field: keyof SpecialityFormData,
    value: string | boolean | number,
  ) => {
    const newFormData = { ...formData, [field]: value };

    if (field === "name" && typeof value === "string") {
      newFormData.key = generateKeyFromName(value);
    }

    setFormData(newFormData);

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Partial<SpecialityFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.key.trim()) {
      newErrors.key = "Key is required";
    } else {
      const keyExists = await specialityService.isKeyExists(
        formData.key,
        editingSpeciality?.id,
      );

      if (keyExists) {
        newErrors.key = "This key already exists";
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !currentUser) return;

    try {
      setFormLoading(true);

      const isValid = await validateForm();

      if (!isValid) return;

      const specialityData = {
        name: formData.name.trim(),
        key: formData.key.trim(),
        description: formData.description.trim(),
        isActive: formData.isActive,
        clinicId,
        createdBy: currentUser.uid,
        ...(editingSpeciality
          ? {}
          : { branchId: userData?.branchId || "" }),
      };

      if (editingSpeciality) {
        await specialityService.updateSpeciality(
          editingSpeciality.id,
          specialityData,
        );

        addToast({
          title: "Success",
          description: "Speciality updated successfully.",
          color: "success",
        });
      } else {
        await specialityService.createSpeciality(specialityData);

        addToast({
          title: "Success",
          description: "Speciality created successfully.",
          color: "success",
        });
      }

      await loadSpecialities();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving speciality:", error);
      addToast({
        title: "Error",
        description: "Failed to save speciality. Please try again.",
        color: "danger",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingSpeciality(null);
    setFormData({
      name: "",
      key: "",
      description: "",
      isActive: true,
    });
    setErrors({});
    onOpen();
  };

  const handleEdit = (speciality: DoctorSpeciality) => {
    setEditingSpeciality(speciality);
    setFormData({
      name: speciality.name,
      key: speciality.key,
      description: speciality.description || "",
      isActive: speciality.isActive,
    });
    setErrors({});
    onOpen();
  };

  const handleCloseModal = () => {
    setEditingSpeciality(null);
    setFormData({
      name: "",
      key: "",
      description: "",
      isActive: true,
    });
    setErrors({});
    onClose();
  };

  const handleToggleStatus = async (
    specialityId: string,
    currentStatus: boolean,
  ) => {
    try {
      setActionLoading(specialityId);
      await specialityService.toggleSpecialityStatus(
        specialityId,
        !currentStatus,
      );

      setSpecialities((prev) =>
        prev.map((speciality) =>
          speciality.id === specialityId
            ? { ...speciality, isActive: !currentStatus }
            : speciality,
        ),
      );

      addToast({
        title: "Success",
        description: `Speciality ${!currentStatus ? "activated" : "deactivated"} successfully.`,
        color: "success",
      });
    } catch (error) {
      console.error("Error updating speciality status:", error);
      addToast({
        title: "Error",
        description: "Failed to update speciality status. Please try again.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (specialityId: string, specialityName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${specialityName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      setActionLoading(specialityId);
      await specialityService.deleteSpeciality(specialityId);

      setSpecialities((prev) =>
        prev.filter((speciality) => speciality.id !== specialityId),
      );

      addToast({
        title: "Success",
        description: "Speciality deleted successfully.",
        color: "success",
      });
    } catch (error) {
      console.error("Error deleting speciality:", error);
      addToast({
        title: "Error",
        description: "Failed to delete speciality. Please try again.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredSpecialities = specialities.filter(
    (speciality) =>
      speciality.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      speciality.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (speciality.description &&
        speciality.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase())),
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Page header — spec: clarity-page-header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Doctor Specialities
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              Manage medical specialities and subspecialties for doctors
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              className="inline-flex items-center justify-center h-[30px] px-3 text-xs font-medium gap-1.5 rounded border border-mountain-200 bg-white text-mountain-700 hover:bg-mountain-50 transition-colors"
              to="/dashboard/settings"
            >
              <IoArrowBackOutline className="w-4 h-4" />
              Back to Settings
            </Link>

            <Button
              color="primary"
              size="sm"
              startContent={<IoAddOutline className="w-4 h-4" />}
              onClick={handleAddNew}
            >
              Add Speciality
            </Button>
          </div>
        </div>

        {/* Main card — clarity-card, no shadow */}
        <div className="bg-white border border-mountain-200 rounded-md overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-3 border-b border-mountain-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mountain-400 pointer-events-none">
                <IoSearchOutline className="w-4 h-4" />
              </span>
              <input
                className="clarity-input h-8 w-full pl-8 pr-2 text-[13px] border border-mountain-200 rounded bg-white text-mountain-800 placeholder:text-mountain-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100"
                placeholder="Search specialities..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Spinner size="lg" />
              </div>
            ) : filteredSpecialities.length === 0 ? (
              <div className="py-12 text-center">
                <IoCreateOutline className="mx-auto text-mountain-300 w-14 h-14 mb-4" />
                <p className="text-[13px] text-mountain-500 mb-4">
                  {searchQuery
                    ? "No specialities found matching your search."
                    : "No specialities found. Create your first speciality."}
                </p>
                {!searchQuery && (
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<IoAddOutline className="w-4 h-4" />}
                    onClick={handleAddNew}
                  >
                    Add First Speciality
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSpecialities.map((speciality) => (
                  <div
                    key={speciality.id}
                    className="bg-white border border-mountain-200 rounded-md p-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-semibold text-mountain-900 truncate">
                          {speciality.name}
                        </h4>
                        <p className="text-[12px] text-mountain-500 font-mono mt-0.5">
                          {speciality.key}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`clarity-badge inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${speciality.isActive
                            ? "bg-teal-100 text-teal-700 border-teal-200"
                            : "bg-red-100 text-red-700 border-red-200"
                            }`}
                        >
                          {speciality.isActive ? (
                            <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                          ) : (
                            <IoCloseCircleOutline className="w-3.5 h-3.5" />
                          )}
                          {speciality.isActive ? "Active" : "Inactive"}
                        </span>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button
                              isIconOnly
                              className="min-w-8 w-8 h-8"
                              isLoading={actionLoading === speciality.id}
                              size="sm"
                              variant="light"
                            >
                              {actionLoading !== speciality.id && (
                                <IoEllipsisVerticalOutline className="w-4 h-4 text-mountain-600" />
                              )}
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Speciality actions">
                            <DropdownItem
                              startContent={
                                <IoCreateOutline className="w-4 h-4" />
                              }
                              onClick={() => handleEdit(speciality)}
                            >
                              Edit
                            </DropdownItem>
                            <DropdownItem
                              color={
                                speciality.isActive ? "warning" : "primary"
                              }
                              startContent={
                                speciality.isActive ? (
                                  <IoEyeOffOutline className="w-4 h-4" />
                                ) : (
                                  <IoEyeOutline className="w-4 h-4" />
                                )
                              }
                              onClick={() =>
                                handleToggleStatus(
                                  speciality.id,
                                  speciality.isActive,
                                )
                              }
                            >
                              {speciality.isActive ? "Deactivate" : "Activate"}
                            </DropdownItem>
                            <DropdownItem
                              color="danger"
                              startContent={
                                <IoTrashOutline className="w-4 h-4" />
                              }
                              onClick={() =>
                                handleDelete(speciality.id, speciality.name)
                              }
                            >
                              Delete
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </div>
                    {speciality.description && (
                      <p className="text-[12px] text-mountain-600 mt-2 line-clamp-2">
                        {speciality.description}
                      </p>
                    )}
                    <div className="flex justify-end items-center mt-2 text-[11px] text-mountain-400">
                      Created: {speciality.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal — custom UI modal */}
      <Modal
        hideCloseButton={formLoading}
        isDismissable={!formLoading}
        isOpen={isOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={handleCloseModal}
      >
        <ModalContent>
          <form onSubmit={handleSubmit}>
            <ModalHeader>
              {editingSpeciality ? "Edit Speciality" : "Add New Speciality"}
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    fullWidth
                    isRequired
                    errorMessage={errors.name}
                    isInvalid={!!errors.name}
                    label="Name *"
                    placeholder="e.g., General Medicine"
                    size="md"
                    value={formData.name}
                    onValueChange={(v) => handleInputChange("name", v)}
                  />

                  <Input
                    fullWidth
                    isRequired
                    description="Unique identifier (auto-generated from name)"
                    errorMessage={errors.key}
                    isInvalid={!!errors.key}
                    label="Key *"
                    placeholder="e.g., general-medicine"
                    size="md"
                    value={formData.key}
                    onValueChange={(v) => handleInputChange("key", v)}
                  />
                </div>

                <Textarea
                  fullWidth
                  label="Description"
                  placeholder="Optional description of the speciality"
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                />

                <div className="flex items-center gap-3">
                  <Switch
                    isSelected={formData.isActive}
                    label="Active"
                    onValueChange={(checked) =>
                      handleInputChange("isActive", checked)
                    }
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                disabled={formLoading}
                size="sm"
                type="button"
                variant="light"
                onClick={handleCloseModal}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                disabled={formLoading}
                isLoading={formLoading}
                size="sm"
                type="submit"
              >
                {editingSpeciality ? "Update" : "Create"} Speciality
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};

export default DoctorSpecialityPage;
