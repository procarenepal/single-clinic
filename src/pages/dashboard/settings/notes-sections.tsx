import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Switch } from "@heroui/switch";
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
  IoDocumentTextOutline,
  IoArrowBackOutline,
  IoAddOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoSaveOutline,
  IoChevronUpOutline,
  IoChevronDownOutline,
} from "react-icons/io5";
import { Link } from "@heroui/link";
import { addToast } from "@heroui/toast";

import { NotesSection } from "@/types/models";
import { notesSectionService } from "@/services/notesSectionService";
import { useAuthContext } from "@/context/AuthContext";
import { title, subtitle } from "@/components/primitives";

export default function NotesSectionsPage() {
  const { clinicId, currentUser } = useAuthContext();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [sections, setSections] = useState<NotesSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [editingSection, setEditingSection] = useState<NotesSection | null>(
    null,
  );
  const [formData, setFormData] = useState({
    label: "",
    key: "",
    description: "",
    isActive: true,
    displayOrder: 0,
  });

  // Load sections
  useEffect(() => {
    if (clinicId) {
      loadSections();
    }
  }, [clinicId]);

  const loadSections = async () => {
    try {
      setIsLoadingData(true);
      const sectionsData = await notesSectionService.getSections(clinicId!);

      setSections(sectionsData);
    } catch (error) {
      console.error("Error loading sections:", error);
      addToast({
        title: "Error",
        description: "Failed to load notes sections",
        color: "danger",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const openAddModal = () => {
    setEditingSection(null);
    setFormData({
      label: "",
      key: "",
      description: "",
      isActive: true,
      displayOrder: sections.length,
    });
    onOpen();
  };

  const openEditModal = (section: NotesSection) => {
    setEditingSection(section);
    setFormData({
      label: section.sectionLabel,
      key: section.sectionKey,
      description: section.description || "",
      isActive: section.isActive,
      displayOrder: section.displayOrder,
    });
    onOpen();
  };

  const handleSave = async () => {
    // Validation
    if (!formData.label.trim()) {
      addToast({
        title: "Error",
        description: "Section label is required",
        color: "danger",
      });

      return;
    }

    if (!formData.key.trim()) {
      addToast({
        title: "Error",
        description: "Section key is required",
        color: "danger",
      });

      return;
    }

    // Check if key is unique (except when editing the same section)
    if (!editingSection || editingSection.sectionKey !== formData.key) {
      const isKeyUnique = await notesSectionService.isKeyUnique(
        clinicId!,
        formData.key,
      );

      if (!isKeyUnique) {
        addToast({
          title: "Error",
          description: "Section key must be unique",
          color: "danger",
        });

        return;
      }
    }

    setIsLoading(true);
    try {
      const sectionData: Omit<NotesSection, "id" | "createdAt" | "updatedAt"> =
        {
          clinicId: clinicId!,
          branchId: "",
          sectionLabel: formData.label.trim(),
          sectionKey: formData.key.trim(),
          isActive: formData.isActive,
          displayOrder: formData.displayOrder,
          createdBy: currentUser?.uid || "",
        };

      // Only add description if it has value
      if (formData.description.trim()) {
        sectionData.description = formData.description.trim();
      }

      if (editingSection) {
        await notesSectionService.updateSection(editingSection.id, sectionData);
        addToast({
          title: "Success",
          description: "Section updated successfully",
          color: "success",
        });
      } else {
        await notesSectionService.createSection(sectionData);
        addToast({
          title: "Success",
          description: "Section created successfully",
          color: "success",
        });
      }

      await loadSections();
      onClose();
    } catch (error) {
      console.error("Error saving section:", error);
      addToast({
        title: "Error",
        description: "Failed to save section",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (sectionId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this section? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await notesSectionService.deleteSection(sectionId);
      await loadSections();
      addToast({
        title: "Success",
        description: "Section deleted successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Error deleting section:", error);
      addToast({
        title: "Error",
        description: "Failed to delete section",
        color: "danger",
      });
    }
  };

  const moveSection = async (sectionId: string, direction: "up" | "down") => {
    const section = sections.find((s) => s.id === sectionId);

    if (!section) return;

    const newOrder =
      direction === "up" ? section.displayOrder - 1 : section.displayOrder + 1;

    if (newOrder < 0 || newOrder >= sections.length) return;

    try {
      await notesSectionService.updateSectionOrder(sectionId, newOrder);
      await loadSections();
    } catch (error) {
      console.error("Error updating section order:", error);
      addToast({
        title: "Error",
        description: "Failed to update section order",
        color: "danger",
      });
    }
  };

  const generateKeyFromLabel = (label: string) => {
    const generatedKey = notesSectionService.generateKeyFromName(label);

    setFormData((prev) => ({ ...prev, key: generatedKey }));
  };

  if (isLoadingData) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              className="flex items-center gap-2 mb-2"
              color="foreground"
              href="/dashboard/settings"
            >
              <IoArrowBackOutline />
              Back to Settings
            </Link>
            <h1 className={title()}>Notes Sections</h1>
            <p className={subtitle({ class: "mt-2" })}>
              Configure customizable note sections for patient records
            </p>
          </div>
          <Button
            color="primary"
            startContent={<IoAddOutline />}
            onPress={openAddModal}
          >
            Add Section
          </Button>
        </div>

        {/* Sections List */}
        {sections.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <IoDocumentTextOutline className="mx-auto text-default-300 text-6xl mb-4" />
              <h3 className="text-lg font-semibold text-default-600 mb-2">
                No sections configured
              </h3>
              <p className="text-default-500 mb-4">
                Create your first notes section to get started.
              </p>
              <Button
                color="primary"
                startContent={<IoAddOutline />}
                onPress={openAddModal}
              >
                Add Section
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sections.map((section, index) => (
              <Card key={section.id}>
                <CardBody>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {section.sectionLabel}
                        </h3>
                        <Chip
                          color={section.isActive ? "success" : "default"}
                          size="sm"
                          variant="flat"
                        >
                          {section.isActive ? "Active" : "Inactive"}
                        </Chip>
                      </div>
                      <p className="text-sm text-default-500 mb-2">
                        Key:{" "}
                        <code className="bg-default-100 px-1 rounded">
                          {section.sectionKey}
                        </code>
                      </p>
                      {section.description && (
                        <p className="text-sm text-default-600">
                          {section.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        isIconOnly
                        isDisabled={index === 0}
                        size="sm"
                        variant="light"
                        onPress={() => moveSection(section.id, "up")}
                      >
                        <IoChevronUpOutline />
                      </Button>
                      <Button
                        isIconOnly
                        isDisabled={index === sections.length - 1}
                        size="sm"
                        variant="light"
                        onPress={() => moveSection(section.id, "down")}
                      >
                        <IoChevronDownOutline />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => openEditModal(section)}
                      >
                        <IoPencilOutline />
                      </Button>
                      <Button
                        isIconOnly
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() => handleDelete(section.id)}
                      >
                        <IoTrashOutline />
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={isOpen} size="lg" onClose={onClose}>
        <ModalContent>
          <ModalHeader>
            {editingSection ? "Edit Section" : "Add New Section"}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                label="Section Label"
                placeholder="Enter section label"
                value={formData.label}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, label: value }));
                  if (!editingSection) {
                    generateKeyFromLabel(value);
                  }
                }}
              />

              <Input
                isRequired
                description="Unique identifier for this section (auto-generated from label)"
                label="Section Key"
                placeholder="Enter unique key"
                value={formData.key}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, key: value }))
                }
              />

              <Textarea
                label="Description"
                maxRows={4}
                minRows={2}
                placeholder="Enter section description (optional)"
                value={formData.description}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, description: value }))
                }
              />

              <Switch
                isSelected={formData.isActive}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, isActive: value }))
                }
              >
                Active
              </Switch>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isLoading}
              startContent={<IoSaveOutline />}
              onPress={handleSave}
            >
              {editingSection ? "Update" : "Create"} Section
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
