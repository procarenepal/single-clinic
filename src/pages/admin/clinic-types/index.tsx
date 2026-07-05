import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoBusinessOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoAddOutline,
  IoTrashOutline,
  IoCreateOutline,
  IoAlertCircleOutline,
  IoInformationCircleOutline,
  IoSearchOutline,
} from "react-icons/io5";

import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  addToast,
} from "@/components/ui";
import { title } from "@/components/primitives";
import { clinicTypeService } from "@/services/clinicTypeService";
import { ClinicType } from "@/types/models";
import { useAuthContext } from "@/context/AuthContext";

export default function ClinicTypesPage() {
  const { userData } = useAuthContext();
  const navigate = useNavigate();

  // State for clinic types and UI
  const [clinicTypes, setClinicTypes] = useState<ClinicType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentClinicType, setCurrentClinicType] = useState<ClinicType | null>(
    null,
  );
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  // Check if user is system-owner
  useEffect(() => {
    if (userData && userData.role !== "system-owner") {
      addToast({
        title: "Access Denied",
        description: "Only super admins can manage clinic types",
      });
      navigate("/admin");
    }
  }, [userData, navigate]);

  // Fetch clinic types when component mounts
  useEffect(() => {
    fetchClinicTypes();
  }, []);

  const fetchClinicTypes = async () => {
    setIsLoading(true);
    try {
      const types = await clinicTypeService.getAllClinicTypes();

      setClinicTypes(types);
    } catch (error) {
      console.error("Error fetching clinic types:", error);
      addToast({
        title: "Error",
        description: "Failed to load clinic types",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openAddModal = () => {
    setCurrentClinicType(null);
    setFormData({
      name: "",
      description: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (clinicType: ClinicType) => {
    setCurrentClinicType(clinicType);
    setFormData({
      name: clinicType.name,
      description: clinicType.description || "",
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (clinicType: ClinicType) => {
    setCurrentClinicType(clinicType);
    setIsDeleteModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      addToast({
        title: "Validation Error",
        description: "Clinic type name is required",
      });

      return;
    }

    setIsLoading(true);
    try {
      if (currentClinicType) {
        // Update existing clinic type
        await clinicTypeService.updateClinicType(currentClinicType.id, {
          name: formData.name,
          description: formData.description,
        });
        addToast({
          title: "Success",
          description: "Clinic type updated successfully",
        });
      } else {
        // Create new clinic type
        await clinicTypeService.createClinicType({
          name: formData.name,
          description: formData.description,
          createdBy: userData?.id || "",
        });
        addToast({
          title: "Success",
          description: "Clinic type created successfully",
        });
      }

      // Close modal and refresh list
      setIsModalOpen(false);
      fetchClinicTypes();
    } catch (error) {
      console.error("Error saving clinic type:", error);
      addToast({
        title: "Error",
        description: "Failed to save clinic type",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentClinicType) return;

    setIsLoading(true);
    try {
      await clinicTypeService.deleteClinicType(currentClinicType.id);
      addToast({
        title: "Success",
        description: "Clinic type deleted successfully",
      });
      setIsDeleteModalOpen(false);
      fetchClinicTypes();
    } catch (error) {
      console.error("Error deleting clinic type:", error);
      addToast({
        title: "Error",
        description: "Failed to delete clinic type",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (clinicType: ClinicType) => {
    setIsLoading(true);
    try {
      await clinicTypeService.toggleClinicTypeStatus(
        clinicType.id,
        !clinicType.isActive,
      );
      addToast({
        title: "Success",
        description: `Clinic type ${clinicType.isActive ? "deactivated" : "activated"} successfully`,
      });
      fetchClinicTypes();
    } catch (error) {
      console.error("Error toggling clinic type status:", error);
      addToast({
        title: "Error",
        description: "Failed to update clinic type status",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter clinic types based on search query
  const filteredClinicTypes = clinicTypes.filter(
    (type) =>
      type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (type.description &&
        type.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={title({ size: "sm" })}>Manage Clinic Types</h1>
            <p className="text-default-600 mt-1">
              Create and manage different types of clinics for your platform
            </p>
          </div>
          <Button
            color="primary"
            startContent={<IoAddOutline />}
            onClick={openAddModal}
          >
            Add Clinic Type
          </Button>
        </div>
      </div>

      {/* Info box */}
      <div className="mb-8">
        <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
          <div className="flex items-center gap-3">
            <div className="min-w-[24px] flex justify-center">
              <IoInformationCircleOutline className="text-primary" />
            </div>
            <p className="text-sm text-default-700">
              Clinic types are categories that define the nature of healthcare
              facilities in your platform. Once created, super admins can select
              these types when registering new clinics.
            </p>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mb-6">
        <Input
          className="max-w-md"
          placeholder="Search clinic types..."
          startContent={<IoSearchOutline className="text-default-400" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Clinic Types Table */}
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="bg-default-50 border-b border-default-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <IoBusinessOutline className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-default-900">
              Clinic Types
            </h2>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <Table aria-label="Clinic types table">
            <TableHeader>
              <TableColumn>NAME</TableColumn>
              <TableColumn>DESCRIPTION</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>CREATED</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent="No clinic types found"
              isLoading={isLoading}
            >
              {filteredClinicTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell>{type.description || "No description"}</TableCell>
                  <TableCell>
                    <Chip
                      color={type.isActive ? "success" : "danger"}
                      size="sm"
                      startContent={
                        type.isActive ? (
                          <IoCheckmarkCircleOutline />
                        ) : (
                          <IoCloseCircleOutline />
                        )
                      }
                      variant="flat"
                    >
                      {type.isActive ? "Active" : "Inactive"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {type.createdAt
                      ? type.createdAt.toLocaleDateString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        isIconOnly
                        color="primary"
                        size="sm"
                        variant="bordered"
                        onClick={() => openEditModal(type)}
                      >
                        <IoCreateOutline />
                      </Button>
                      <Button
                        color="secondary"
                        size="sm"
                        variant="bordered"
                        onClick={() =>
                          navigate(`/admin/clinic-types/pages/${type.id}`)
                        }
                      >
                        Manage Pages
                      </Button>
                      <Button
                        isIconOnly
                        color={type.isActive ? "danger" : "success"}
                        size="sm"
                        variant="bordered"
                        onClick={() => handleToggleStatus(type)}
                      >
                        {type.isActive ? (
                          <IoCloseCircleOutline />
                        ) : (
                          <IoCheckmarkCircleOutline />
                        )}
                      </Button>
                      <Button
                        isIconOnly
                        color="danger"
                        size="sm"
                        variant="bordered"
                        onClick={() => openDeleteModal(type)}
                      >
                        <IoTrashOutline />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ModalContent>
          <ModalHeader>
            {currentClinicType ? "Edit Clinic Type" : "Add Clinic Type"}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Name <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  className="w-full"
                  name="name"
                  placeholder="Enter clinic type name"
                  size="md"
                  value={formData.name}
                  variant="bordered"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Description
                </label>
                <Textarea
                  className="w-full"
                  name="description"
                  placeholder="Enter clinic type description"
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="bordered"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button color="primary" isLoading={isLoading} onClick={handleSave}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2 text-danger">
              <IoAlertCircleOutline />
              <span>Delete Clinic Type</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete the clinic type{" "}
              <strong>{currentClinicType?.name}</strong>?
            </p>
            <p className="text-sm text-danger mt-2">
              This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="bordered"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button color="danger" isLoading={isLoading} onClick={handleDelete}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
