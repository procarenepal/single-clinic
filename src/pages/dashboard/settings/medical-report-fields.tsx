import { useState, useEffect } from "react";
import {
  IoMedicalOutline,
  IoArrowBackOutline,
  IoAddOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoSaveOutline,
  IoChevronUpOutline,
  IoChevronDownOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import {
  Card,
  CardBody,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch,
  Chip,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Link,
  addToast,
} from "@/components/ui";
import { useModalState } from "@/hooks/useModalState";
import { MedicalReportField } from "@/types/models";
import { medicalReportFieldService } from "@/services/medicalReportFieldService";
import { useAuthContext } from "@/context/AuthContext";

const FIELD_TYPES = [
  { key: "text", label: "Text Input" },
  { key: "textarea", label: "Text Area" },
  { key: "number", label: "Number" },
  { key: "date", label: "Date" },
  { key: "select", label: "Dropdown" },
  { key: "radio", label: "Radio Buttons" },
  { key: "checkbox", label: "Checkboxes" },
  { key: "yes-no", label: "Yes/No Question" },
];

export default function MedicalReportFieldsPage() {
  const { clinicId, branchId, currentUser } = useAuthContext();
  const modalState = useModalState(false);
  const [fields, setFields] = useState<MedicalReportField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [editingField, setEditingField] = useState<MedicalReportField | null>(
    null,
  );
  const [formData, setFormData] = useState({
    label: "",
    key: "",
    fieldType: "text" as MedicalReportField["fieldType"],
    description: "",
    required: false,
    placeholder: "",
    options: [] as string[],
    displayOrder: 0,
  });
  const [optionInput, setOptionInput] = useState("");

  // Load fields
  useEffect(() => {
    if (clinicId) {
      loadFields();
    }
  }, [clinicId]);

  const loadFields = async () => {
    try {
      setIsLoadingData(true);
      const fieldsData = await medicalReportFieldService.getFields(clinicId!);

      setFields(fieldsData);
    } catch (error) {
      console.error("Error loading fields:", error);
      addToast({
        title: "Error",
        description: "Failed to load medical report fields",
        color: "danger",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const openAddModal = () => {
    setEditingField(null);
    setFormData({
      label: "",
      key: "",
      fieldType: "text",
      description: "",
      required: false,
      placeholder: "",
      options: [],
      displayOrder: fields.length,
    });
    setOptionInput("");
    modalState.open();
  };
  const openEditModal = (field: MedicalReportField) => {
    setEditingField(field);
    setFormData({
      label: field.fieldLabel,
      key: field.fieldKey,
      fieldType: field.fieldType,
      description: field.description || "",
      required: field.isRequired,
      placeholder: field.placeholder || "",
      options: field.options || [],
      displayOrder: field.displayOrder,
    });
    setOptionInput("");
    modalState.open();
  };

  const generateKey = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .trim();
  };

  const handleLabelChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      label: value,
      key: !editingField ? generateKey(value) : prev.key,
    }));
  };

  const addOption = () => {
    if (optionInput.trim() && !formData.options.includes(optionInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        options: [...prev.options, optionInput.trim()],
      }));
      setOptionInput("");
    }
  };

  const removeOption = (option: string) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((o) => o !== option),
    }));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.label.trim()) {
      addToast({
        title: "Error",
        description: "Field label is required",
        color: "danger",
      });

      return;
    }

    if (!formData.key.trim()) {
      addToast({
        title: "Error",
        description: "Field key is required",
        color: "danger",
      });

      return;
    } // Check if key is unique (except when editing the same field)
    if (!editingField || editingField.fieldKey !== formData.key) {
      const isKeyUnique = await medicalReportFieldService.isKeyUnique(
        clinicId!,
        formData.key,
      );

      if (!isKeyUnique) {
        addToast({
          title: "Error",
          description: "Field key must be unique",
          color: "danger",
        });

        return;
      }
    }

    // Validate options for certain field types
    if (
      ["select", "radio", "checkbox"].includes(formData.fieldType) &&
      formData.options.length === 0
    ) {
      addToast({
        title: "Error",
        description: "At least one option is required for this field type",
        color: "danger",
      });

      return;
    }
    setIsLoading(true);
    try {
      const fieldData: Omit<
        MedicalReportField,
        "id" | "createdAt" | "updatedAt"
      > = {
        clinicId: clinicId!,
        branchId: branchId!,
        fieldLabel: formData.label.trim(),
        fieldKey: formData.key.trim(),
        fieldType: formData.fieldType,
        isRequired: formData.required,
        displayOrder: formData.displayOrder,
        isActive: true,
        createdBy: currentUser?.uid || "", // Using the actual user ID
      };

      // Only add optional fields if they have values
      if (formData.description.trim()) {
        fieldData.description = formData.description.trim();
      }

      if (formData.placeholder.trim()) {
        fieldData.placeholder = formData.placeholder.trim();
      }

      if (
        ["select", "radio", "checkbox"].includes(formData.fieldType) &&
        formData.options.length > 0
      ) {
        fieldData.options = formData.options;
      }

      if (editingField) {
        await medicalReportFieldService.updateField(editingField.id, fieldData);
        addToast({
          title: "Success",
          description: "Field updated successfully",
          color: "success",
        });
      } else {
        await medicalReportFieldService.createField(fieldData);
        addToast({
          title: "Success",
          description: "Field created successfully",
          color: "success",
        });
      }

      await loadFields();
      modalState.forceClose();
    } catch (error) {
      console.error("Error saving field:", error);
      addToast({
        title: "Error",
        description: "Failed to save field",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this field? This action cannot be undone.",
      )
    ) {
      return;
    }
    try {
      await medicalReportFieldService.deleteField(fieldId);
      await loadFields();
      addToast({
        title: "Success",
        description: "Field deleted successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Error deleting field:", error);
      addToast({
        title: "Error",
        description: "Failed to delete field",
        color: "danger",
      });
    }
  };
  const moveField = async (fieldId: string, direction: "up" | "down") => {
    const field = fields.find((f) => f.id === fieldId);

    if (!field) return;

    const newOrder =
      direction === "up" ? field.displayOrder - 1 : field.displayOrder + 1;

    if (newOrder < 0 || newOrder >= fields.length) return;

    try {
      await medicalReportFieldService.updateFieldOrder(fieldId, newOrder);
      await loadFields();
    } catch (error) {
      console.error("Error updating field order:", error);
      addToast({
        title: "Error",
        description: "Failed to update field order",
        color: "danger",
      });
    }
  };

  const getFieldTypeLabel = (type: string) => {
    const fieldType = FIELD_TYPES.find((ft) => ft.key === type);

    return fieldType ? fieldType.label : type;
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
            <h1 className={title({ size: "lg" })}>Medical Report Fields</h1>
            <p className="mt-1 text-mountain-500">
              Configure custom fields for patient medical reports
            </p>
          </div>

          <div className="flex gap-3">
            <Link to="/dashboard/settings">
              <Button startContent={<IoArrowBackOutline />} variant="light">
                Back to Settings
              </Button>
            </Link>
            <Button
              color="primary"
              startContent={<IoAddOutline />}
              onPress={openAddModal}
            >
              Add Field
            </Button>
          </div>
        </div>

        {/* Fields List */}
        <Card>
          <CardBody>
            {fields.length === 0 ? (
              <div className="text-center py-8">
                <IoMedicalOutline className="mx-auto text-mountain-300 text-6xl mb-4" />
                <h3 className="text-lg font-medium text-mountain-600 mb-2">
                  No fields configured
                </h3>
                <p className="text-mountain-500 mb-4">
                  Add your first medical report field to get started.
                </p>
                <Button
                  color="primary"
                  startContent={<IoAddOutline />}
                  onPress={openAddModal}
                >
                  Add Field
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-4 p-3 border border-mountain-200 rounded-md bg-white"
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        isIconOnly
                        isDisabled={index === 0}
                        size="sm"
                        variant="light"
                        onPress={() => moveField(field.id, "up")}
                      >
                        <IoChevronUpOutline className="w-4 h-4" />
                      </Button>
                      <Button
                        isIconOnly
                        isDisabled={index === fields.length - 1}
                        size="sm"
                        variant="light"
                        onPress={() => moveField(field.id, "down")}
                      >
                        <IoChevronDownOutline className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-mountain-900">
                          {field.fieldLabel}
                        </h4>
                        {field.isRequired && (
                          <Chip color="danger" size="sm" variant="flat">
                            Required
                          </Chip>
                        )}
                        <Chip color="primary" size="sm" variant="flat">
                          {getFieldTypeLabel(field.fieldType)}
                        </Chip>
                      </div>
                      <p className="text-sm text-mountain-600">
                        Key: {field.fieldKey}
                      </p>
                      {field.description && (
                        <p className="text-sm text-mountain-500 mt-1">
                          {field.description}
                        </p>
                      )}
                      {field.options && field.options.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {field.options.map((option) => (
                            <Chip key={option} size="sm" variant="flat">
                              {option}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => openEditModal(field)}
                      >
                        <IoPencilOutline className="w-4 h-4" />
                      </Button>
                      <Button
                        isIconOnly
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() => handleDelete(field.id)}
                      >
                        <IoTrashOutline className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Add/Edit Field Modal */}
      <Modal
        hideCloseButton={isLoading}
        isDismissable={!isLoading}
        isOpen={modalState.isOpen}
        size="2xl"
        onClose={modalState.close}
      >
        <ModalContent>
          <ModalHeader>
            {editingField ? "Edit Field" : "Add New Field"}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                isRequired
                label="Field Label"
                placeholder="Enter field label"
                value={formData.label}
                onValueChange={handleLabelChange}
              />

              <Input
                isRequired
                description="Unique identifier for this field"
                label="Field Key"
                placeholder="field_key"
                value={formData.key}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, key: value }))
                }
              />

              <Select
                isRequired
                className="mt-0.5"
                classNames={{
                  trigger: "px-2 py-1",
                  value: "text-xs",
                }}
                label="Field Type"
                placeholder="Choose input control"
                selectedKeys={[formData.fieldType]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const fieldType = Array.from(
                    keys,
                  )[0] as MedicalReportField["fieldType"];

                  setFormData((prev) => ({ ...prev, fieldType, options: [] }));
                }}
              >
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.key}>{type.label}</SelectItem>
                ))}
              </Select>

              <div className="flex items-center">
                <Switch
                  isSelected={formData.required}
                  label="Required field"
                  onValueChange={(checked) =>
                    setFormData((prev) => ({ ...prev, required: checked }))
                  }
                />
              </div>
            </div>

            <Textarea
              label="Description"
              placeholder="Optional description for this field"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />

            <Input
              label="Placeholder Text"
              placeholder="Enter placeholder text"
              value={formData.placeholder}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, placeholder: value }))
              }
            />

            {/* Options for select, radio, checkbox */}
            {["select", "radio", "checkbox"].includes(formData.fieldType) && (
              <div>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add option"
                    value={optionInput}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                    onValueChange={setOptionInput}
                  />
                  <Button onPress={addOption}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.options.map((option) => (
                    <Chip
                      key={option}
                      variant="flat"
                      onClose={() => removeOption(option)}
                    >
                      {option}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={isLoading}
              variant="light"
              onPress={modalState.close}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={isLoading}
              isLoading={isLoading}
              startContent={<IoSaveOutline />}
              onPress={handleSave}
            >
              {editingField ? "Update" : "Create"} Field
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
