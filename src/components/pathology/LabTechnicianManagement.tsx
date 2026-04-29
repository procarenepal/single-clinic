import { useState, useEffect, useMemo } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { labTechnicianService } from "@/services/labTechnicianService";
import { LabTechnician } from "@/types/models";

interface LabTechnicianManagementProps {
  clinicId: string;
  branchId: string;
}

export default function LabTechnicianManagement({
  clinicId,
  branchId,
}: LabTechnicianManagementProps) {
  const { currentUser } = useAuthContext();
  const [technicians, setTechnicians] = useState<LabTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const technicianModalState = useModalState(false);
  const deleteConfirmModalState = useModalState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [technicianForm, setTechnicianForm] = useState({
    id: "",
    name: "",
    employeeId: "",
    phone: "",
    email: "",
    address: "",
    specialization: "",
    qualifications: "",
    isActive: true,
  });

  useEffect(() => {
    loadTechnicians();
  }, [clinicId, branchId]);

  const loadTechnicians = async () => {
    if (!clinicId || !branchId) return;

    try {
      setLoading(true);
      const data = await labTechnicianService.getTechniciansByClinic(
        clinicId,
        branchId,
      );

      setTechnicians(data);
    } catch (error) {
      console.error("Error loading lab technicians:", error);
      addToast({
        title: "Error",
        description: "Failed to load lab technicians",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTechnicians = useMemo(() => {
    if (!searchQuery.trim()) return technicians;
    const query = searchQuery.toLowerCase();

    return technicians.filter(
      (tech) =>
        tech.name.toLowerCase().includes(query) ||
        (tech.employeeId && tech.employeeId.toLowerCase().includes(query)) ||
        (tech.specialization &&
          tech.specialization.toLowerCase().includes(query)) ||
        (tech.phone && tech.phone.toLowerCase().includes(query)) ||
        (tech.email && tech.email.toLowerCase().includes(query)),
    );
  }, [technicians, searchQuery]);

  const resetForm = () => {
    setTechnicianForm({
      id: "",
      name: "",
      employeeId: "",
      phone: "",
      email: "",
      address: "",
      specialization: "",
      qualifications: "",
      isActive: true,
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!technicianForm.name.trim()) {
      addToast({
        title: "Error",
        description: "Please enter technician name",
        color: "danger",
      });

      return;
    }

    try {
      // Build technician data object, only including fields with actual values
      const technicianData: Omit<
        LabTechnician,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: technicianForm.name.trim(),
        isActive: technicianForm.isActive,
        clinicId,
        branchId,
        createdBy: currentUser?.uid || "",
        ...(technicianForm.employeeId.trim()
          ? { employeeId: technicianForm.employeeId.trim() }
          : {}),
        ...(technicianForm.phone.trim()
          ? { phone: technicianForm.phone.trim() }
          : {}),
        ...(technicianForm.email.trim()
          ? { email: technicianForm.email.trim() }
          : {}),
        ...(technicianForm.address.trim()
          ? { address: technicianForm.address.trim() }
          : {}),
        ...(technicianForm.specialization.trim()
          ? { specialization: technicianForm.specialization.trim() }
          : {}),
        ...(technicianForm.qualifications.trim()
          ? { qualifications: technicianForm.qualifications.trim() }
          : {}),
      };

      if (isEditing) {
        await labTechnicianService.updateTechnician(
          technicianForm.id,
          technicianData,
        );
        addToast({
          title: "Success",
          description: "Lab technician updated successfully",
          color: "success",
        });
      } else {
        await labTechnicianService.createTechnician(technicianData);
        addToast({
          title: "Success",
          description: "Lab technician created successfully",
          color: "success",
        });
      }

      await loadTechnicians();
      technicianModalState.forceClose();
      resetForm();
    } catch (error) {
      console.error("Error saving lab technician:", error);
      addToast({
        title: "Error",
        description: "Failed to save lab technician",
        color: "danger",
      });
    }
  };

  const editTechnician = (technician: LabTechnician) => {
    setTechnicianForm({
      id: technician.id,
      name: technician.name,
      employeeId: technician.employeeId || "",
      phone: technician.phone || "",
      email: technician.email || "",
      address: technician.address || "",
      specialization: technician.specialization || "",
      qualifications: technician.qualifications || "",
      isActive: technician.isActive,
    });
    setIsEditing(true);
    technicianModalState.open();
  };

  const openDeleteModal = (id: string, name: string) => {
    setItemToDelete({ id, name });
    deleteConfirmModalState.open();
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      await labTechnicianService.deleteTechnician(itemToDelete.id);
      addToast({
        title: "Success",
        description: "Lab technician deleted successfully",
        color: "success",
      });
      await loadTechnicians();
      deleteConfirmModalState.forceClose();
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting lab technician:", error);
      addToast({
        title: "Error",
        description: "Failed to delete lab technician",
        color: "danger",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          className="w-80"
          placeholder="Search technicians..."
          startContent={<IoSearchOutline />}
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <Button
          color="primary"
          startContent={<IoAddOutline />}
          onPress={() => {
            resetForm();
            technicianModalState.open();
          }}
        >
          New Lab Technician
        </Button>
      </div>

      {filteredTechnicians.length > 0 ? (
        <Table aria-label="Lab technicians table">
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>EMPLOYEE ID</TableColumn>
            <TableColumn>PHONE</TableColumn>
            <TableColumn>EMAIL</TableColumn>
            <TableColumn>SPECIALIZATION</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>ACTIONS</TableColumn>
          </TableHeader>
          <TableBody>
            {filteredTechnicians.map((technician) => (
              <TableRow key={technician.id}>
                <TableCell>
                  <p className="font-medium text-text-main">{technician.name}</p>
                </TableCell>
                <TableCell className="text-text-main">{technician.employeeId || "—"}</TableCell>
                <TableCell className="text-text-main">{technician.phone || "—"}</TableCell>
                <TableCell className="text-text-main">{technician.email || "—"}</TableCell>
                <TableCell className="text-text-main">{technician.specialization || "—"}</TableCell>
                <TableCell>
                  <Chip
                    color={technician.isActive ? "success" : "default"}
                    size="sm"
                    variant="flat"
                  >
                    {technician.isActive ? "Active" : "Inactive"}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      color="primary"
                      size="sm"
                      startContent={<IoCreateOutline />}
                      variant="flat"
                      onPress={() => editTechnician(technician)}
                    >
                      Edit
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      startContent={<IoTrashOutline />}
                      variant="flat"
                      onPress={() =>
                        openDeleteModal(technician.id, technician.name)
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-text-muted">
            {searchQuery ? "No technicians found" : "No lab technicians yet"}
          </p>
        </div>
      )}

      {/* Technician Modal */}
      <Modal
        isOpen={technicianModalState.isOpen}
        size="2xl"
        onClose={technicianModalState.close}
      >
        <ModalContent>
          <ModalHeader>
            {isEditing ? "Edit Lab Technician" : "Create Lab Technician"}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                label="Name *"
                placeholder="Enter technician name"
                value={technicianForm.name}
                onValueChange={(value) =>
                  setTechnicianForm((prev) => ({ ...prev, name: value }))
                }
              />
              <Input
                label="Employee ID"
                placeholder="Enter employee ID (optional)"
                value={technicianForm.employeeId}
                onValueChange={(value) =>
                  setTechnicianForm((prev) => ({ ...prev, employeeId: value }))
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Phone"
                  placeholder="Enter phone number"
                  value={technicianForm.phone}
                  onValueChange={(value) =>
                    setTechnicianForm((prev) => ({ ...prev, phone: value }))
                  }
                />
                <Input
                  label="Email"
                  placeholder="Enter email address"
                  type="email"
                  value={technicianForm.email}
                  onValueChange={(value) =>
                    setTechnicianForm((prev) => ({ ...prev, email: value }))
                  }
                />
              </div>
              <Input
                label="Address"
                placeholder="Enter address"
                value={technicianForm.address}
                onValueChange={(value) =>
                  setTechnicianForm((prev) => ({ ...prev, address: value }))
                }
              />
              <Input
                label="Specialization"
                placeholder="Enter specialization area"
                value={technicianForm.specialization}
                onValueChange={(value) =>
                  setTechnicianForm((prev) => ({
                    ...prev,
                    specialization: value,
                  }))
                }
              />
              <Input
                label="Qualifications"
                placeholder="Enter qualifications, certifications"
                value={technicianForm.qualifications}
                onValueChange={(value) =>
                  setTechnicianForm((prev) => ({
                    ...prev,
                    qualifications: value,
                  }))
                }
              />
              <Select
                label="Status"
                selectedKeys={
                  technicianForm.isActive
                    ? new Set(["active"])
                    : new Set(["inactive"])
                }
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;

                  setTechnicianForm((prev) => ({
                    ...prev,
                    isActive: value === "active",
                  }));
                }}
              >
                <SelectItem key="active">Active</SelectItem>
                <SelectItem key="inactive">Inactive</SelectItem>
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={technicianModalState.close}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSave}>
              {isEditing ? "Update" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmModalState.isOpen}
        onClose={deleteConfirmModalState.close}
      >
        <ModalContent>
          <ModalHeader>Confirm Delete</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete{" "}
              <strong>{itemToDelete?.name}</strong>? This action cannot be
              undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={deleteConfirmModalState.close}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
