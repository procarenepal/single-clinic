import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";

import { useAuthContext } from "@/context/AuthContext";
import { doctorService } from "@/services/doctorService";
import { Doctor } from "@/types/models";

interface AddPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prescription: any) => void;
}

export default function AddPrescriptionModal({
  isOpen,
  onClose,
  onSubmit,
}: AddPrescriptionModalProps) {
  const { clinicId } = useAuthContext();
  const [prescribedBy, setPrescribedBy] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [medications, setMedications] = useState([
    {
      id: Date.now(),
      medicationName: "",
      dosage: "",
      frequency: "",
      duration: "",
      instructions: "",
      timing: "after-meal",
      startDate: "",
      notes: "",
    },
  ]);

  // Load doctors when modal opens
  useEffect(() => {
    if (isOpen && clinicId) {
      loadDoctors();
    }
  }, [isOpen, clinicId]);

  const loadDoctors = async () => {
    if (!clinicId) return;

    try {
      setDoctorsLoading(true);
      const doctorsData = await doctorService.getDoctorsByClinic(clinicId);

      // Only show active doctors
      setDoctors(doctorsData.filter((doctor) => doctor.isActive));
    } catch (error) {
      console.error("Error loading doctors:", error);
      setDoctors([]);
    } finally {
      setDoctorsLoading(false);
    }
  };

  const addMedication = () => {
    setMedications((prev) => [
      ...prev,
      {
        id: Date.now(),
        medicationName: "",
        dosage: "",
        frequency: "",
        duration: "",
        instructions: "",
        timing: "after-meal",
        startDate: "",
        notes: "",
      },
    ]);
  };

  const removeMedication = (id: number) => {
    setMedications((prev) => prev.filter((med) => med.id !== id));
  };

  const updateMedication = (id: number, field: string, value: string) => {
    setMedications((prev) =>
      prev.map((med) => (med.id === id ? { ...med, [field]: value } : med)),
    );
  };

  const handleSubmit = () => {
    // Get the selected doctor's name
    const selectedDoctor = doctors.find((doctor) => doctor.id === prescribedBy);
    const doctorName = selectedDoctor
      ? `Dr. ${selectedDoctor.name}`
      : prescribedBy;

    const prescriptions = medications.map((medication) => ({
      type: "prescription",
      title: medication.medicationName + " " + medication.dosage,
      description: `${medication.medicationName} ${medication.dosage} - ${medication.frequency} for ${medication.duration}`,
      doctorName: doctorName,
      date: new Date(),
      details: {
        medication: medication.medicationName,
        dosage: medication.dosage,
        frequency: medication.frequency,
        duration: medication.duration,
        instructions: medication.instructions,
        timing: medication.timing,
        startDate: medication.startDate,
      },
    }));

    // Submit each prescription separately or as a batch
    prescriptions.forEach((prescription) => onSubmit(prescription));
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setPrescribedBy("");
    setMedications([
      {
        id: Date.now(),
        medicationName: "",
        dosage: "",
        frequency: "",
        duration: "",
        instructions: "",
        timing: "after-meal",
        startDate: "",
        notes: "",
      },
    ]);
  };

  const isFormValid =
    prescribedBy &&
    medications.every(
      (med) =>
        med.medicationName && med.dosage && med.frequency && med.duration,
    );

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="2xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Add Prescription
        </ModalHeader>
        <ModalBody>
          <div className="space-y-6">
            {/* Doctor Selection - Single field at the top */}
            <div className="border-b pb-4">
              <Autocomplete
                isRequired
                className="max-w-md"
                defaultItems={doctors}
                isLoading={doctorsLoading}
                label="Prescribed By"
                placeholder="Search and select doctor"
                selectedKey={prescribedBy}
                onSelectionChange={(key) => setPrescribedBy(key as string)}
              >
                {(doctor) => (
                  <AutocompleteItem
                    key={doctor.id}
                    textValue={`Dr. ${doctor.name} - ${doctor.speciality}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-small">Dr. {doctor.name}</span>
                      <span className="text-tiny text-default-400">
                        {doctor.speciality}
                      </span>
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>
            </div>

            {/* Medications Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Medications</h3>

              {medications.map((medication, index) => (
                <div
                  key={medication.id}
                  className="border rounded-lg p-4 space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Medication {index + 1}</h4>
                    {medications.length > 1 && (
                      <Button
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() => removeMedication(medication.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      isRequired
                      label="Medication Name"
                      placeholder="Enter medication name"
                      value={medication.medicationName}
                      onChange={(e) =>
                        updateMedication(
                          medication.id,
                          "medicationName",
                          e.target.value,
                        )
                      }
                    />
                    <Input
                      isRequired
                      label="Dosage"
                      placeholder="e.g., 10mg, 500mg"
                      value={medication.dosage}
                      onChange={(e) =>
                        updateMedication(
                          medication.id,
                          "dosage",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      isRequired
                      label="Frequency"
                      placeholder="Select frequency"
                      selectedKeys={
                        medication.frequency ? [medication.frequency] : []
                      }
                      onSelectionChange={(keys) =>
                        updateMedication(
                          medication.id,
                          "frequency",
                          Array.from(keys)[0] as string,
                        )
                      }
                    >
                      <SelectItem key="once-daily">Once daily</SelectItem>
                      <SelectItem key="twice-daily">Twice daily</SelectItem>
                      <SelectItem key="three-times-daily">
                        Three times daily
                      </SelectItem>
                      <SelectItem key="four-times-daily">
                        Four times daily
                      </SelectItem>
                      <SelectItem key="every-6-hours">Every 6 hours</SelectItem>
                      <SelectItem key="every-8-hours">Every 8 hours</SelectItem>
                      <SelectItem key="every-12-hours">
                        Every 12 hours
                      </SelectItem>
                      <SelectItem key="as-needed">As needed</SelectItem>
                    </Select>

                    <Input
                      isRequired
                      label="Duration"
                      placeholder="e.g., 7 days, 2 weeks"
                      value={medication.duration}
                      onChange={(e) =>
                        updateMedication(
                          medication.id,
                          "duration",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Timing"
                      placeholder="Select timing"
                      selectedKeys={
                        medication.timing ? [medication.timing] : []
                      }
                      onSelectionChange={(keys) =>
                        updateMedication(
                          medication.id,
                          "timing",
                          Array.from(keys)[0] as string,
                        )
                      }
                    >
                      <SelectItem key="after-meal">After meal</SelectItem>
                      <SelectItem key="before-meal">Before meal</SelectItem>
                    </Select>

                    <Input
                      label="Start Date"
                      placeholder="YYYY-MM-DD"
                      type="date"
                      value={medication.startDate}
                      onChange={(e) =>
                        updateMedication(
                          medication.id,
                          "startDate",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <Textarea
                    label="Instructions"
                    placeholder="Special instructions for taking the medication"
                    rows={2}
                    value={medication.instructions}
                    onChange={(e) =>
                      updateMedication(
                        medication.id,
                        "instructions",
                        e.target.value,
                      )
                    }
                  />

                  <Textarea
                    label="Additional Notes"
                    placeholder="Any additional notes or comments"
                    rows={2}
                    value={medication.notes}
                    onChange={(e) =>
                      updateMedication(medication.id, "notes", e.target.value)
                    }
                  />
                </div>
              ))}

              {/* Add Medication Button at the end */}
              <div className="flex justify-center pt-4">
                <Button
                  color="primary"
                  startContent={<span>+</span>}
                  variant="flat"
                  onPress={addMedication}
                >
                  Add Another Medication
                </Button>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isDisabled={!isFormValid}
            onPress={handleSubmit}
          >
            Add Prescription{medications.length > 1 ? "s" : ""}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
