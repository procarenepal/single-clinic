import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Tabs, Tab } from "@heroui/tabs";
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
import { Spinner } from "@heroui/spinner";
import { Avatar } from "@heroui/avatar";
import { Textarea } from "@heroui/input";
import { addToast } from "@heroui/toast";
import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoArrowBackOutline,
  IoCheckmarkCircleOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { title } from "@/components/primitives";
import { bedService } from "@/services/bedService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import {
  Bed,
  BedCategory,
  BedAllotment,
  Patient,
  Doctor,
} from "@/types/models";

export default function BedManagementPage() {
  const navigate = useNavigate();
  const { clinicId, currentUser, userData } = useAuthContext();
  const branchId = userData?.branchId || userData?.clinicId || clinicId;

  // Active tab state
  const [activeTab, setActiveTab] = useState("beds");

  // Loading state
  const [loading, setLoading] = useState(true);

  // Data states
  const [beds, setBeds] = useState<Bed[]>([]);
  const [categories, setCategories] = useState<BedCategory[]>([]);
  const [allotments, setAllotments] = useState<BedAllotment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Search states
  const [bedsSearchQuery, setBedsSearchQuery] = useState("");
  const [categoriesSearchQuery, setCategoriesSearchQuery] = useState("");
  const [allotmentsSearchQuery, setAllotmentsSearchQuery] = useState("");

  // Modal states
  const bedModalState = useModalState(false);
  const categoryModalState = useModalState(false);
  const allotmentModalState = useModalState(false);
  const deleteConfirmModalState = useModalState(false);

  // Form states
  const [bedForm, setBedForm] = useState({
    id: "",
    bedNumber: "",
    roomNumber: "",
    categoryId: "",
    status: "available" as "available" | "occupied" | "maintenance",
  });

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    description: "",
  });

  const [allotmentForm, setAllotmentForm] = useState({
    id: "",
    bedId: "",
    patientId: "",
    doctorId: "",
    allotmentDate: new Date().toISOString().split("T")[0],
    dischargeDate: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      if (!clinicId || !branchId) return;

      try {
        setLoading(true);
        const [
          bedsData,
          categoriesData,
          allotmentsData,
          patientsData,
          doctorsData,
        ] = await Promise.all([
          bedService.getBedsByClinic(clinicId, branchId),
          bedService.getCategoriesByClinic(clinicId, branchId),
          bedService.getAllotmentsByClinic(clinicId, branchId),
          patientService.getPatientsByClinic(clinicId),
          doctorService.getDoctorsByClinic(clinicId),
        ]);

        setBeds(bedsData);
        setCategories(categoriesData);
        setAllotments(allotmentsData);
        setPatients(patientsData);
        setDoctors(doctorsData);
      } catch (error) {
        console.error("Error loading bed management data:", error);
        addToast({
          title: "Error",
          description: "Failed to load bed management data. Please try again.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clinicId, branchId]);

  // Filtered data
  const filteredBeds = useMemo(() => {
    if (!bedsSearchQuery.trim()) return beds;
    const query = bedsSearchQuery.toLowerCase();

    return beds.filter(
      (bed) =>
        bed.bedNumber.toLowerCase().includes(query) ||
        (bed.roomNumber && bed.roomNumber.toLowerCase().includes(query)) ||
        bed.categoryName.toLowerCase().includes(query) ||
        bed.status.toLowerCase().includes(query),
    );
  }, [beds, bedsSearchQuery]);

  const filteredCategories = useMemo(() => {
    if (!categoriesSearchQuery.trim()) return categories;
    const query = categoriesSearchQuery.toLowerCase();

    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(query) ||
        (cat.description && cat.description.toLowerCase().includes(query)),
    );
  }, [categories, categoriesSearchQuery]);

  const filteredAllotments = useMemo(() => {
    if (!allotmentsSearchQuery.trim()) return allotments;
    const query = allotmentsSearchQuery.toLowerCase();

    return allotments.filter(
      (allotment) =>
        allotment.bedNumber.toLowerCase().includes(query) ||
        allotment.patientName.toLowerCase().includes(query) ||
        (allotment.doctorName &&
          allotment.doctorName.toLowerCase().includes(query)),
    );
  }, [allotments, allotmentsSearchQuery]);

  // Get available beds for allotment dropdown
  const availableBeds = useMemo(() => {
    return beds.filter((bed) => bed.status === "available" && bed.isActive);
  }, [beds]);

  // Bed form handlers
  const resetBedForm = () => {
    setBedForm({
      id: "",
      bedNumber: "",
      roomNumber: "",
      categoryId: "",
      status: "available",
    });
    setIsEditing(false);
  };

  const handleSaveBed = async () => {
    if (!bedForm.bedNumber?.trim() || !bedForm.categoryId) {
      addToast({
        title: "Error",
        description:
          "Please fill in all required fields (Bed Number, Category)",
        color: "danger",
      });

      return;
    }

    try {
      const selectedCategory = categories.find(
        (c) => c.id === bedForm.categoryId,
      );

      const bedData: Omit<Bed, "id" | "createdAt" | "updatedAt"> = {
        bedNumber: bedForm.bedNumber.trim(),
        roomNumber: bedForm.roomNumber?.trim() || undefined,
        categoryId: bedForm.categoryId,
        categoryName: selectedCategory?.name || "",
        status: bedForm.status,
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await bedService.updateBed(bedForm.id, bedData);
        addToast({
          title: "Success",
          description: "Bed updated successfully",
          color: "success",
        });
      } else {
        await bedService.createBed(bedData);
        addToast({
          title: "Success",
          description: "Bed created successfully",
          color: "success",
        });
      }

      const bedsData = await bedService.getBedsByClinic(clinicId!, branchId!);

      setBeds(bedsData);

      bedModalState.forceClose();
      resetBedForm();
    } catch (error) {
      console.error("Error saving bed:", error);
      addToast({
        title: "Error",
        description: "Failed to save bed",
        color: "danger",
      });
    }
  };

  const editBed = (bed: Bed) => {
    setBedForm({
      id: bed.id,
      bedNumber: bed.bedNumber,
      roomNumber: bed.roomNumber || "",
      categoryId: bed.categoryId,
      status: bed.status,
    });
    setIsEditing(true);
    bedModalState.open();
  };

  // Category handlers
  const resetCategoryForm = () => {
    setCategoryForm({ id: "", name: "", description: "" });
    setIsEditing(false);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      addToast({
        title: "Error",
        description: "Please enter category name",
        color: "danger",
      });

      return;
    }

    try {
      const categoryData: Omit<BedCategory, "id" | "createdAt" | "updatedAt"> =
        {
          name: categoryForm.name.trim(),
          description: categoryForm.description?.trim() || undefined,
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        };

      if (isEditing) {
        await bedService.updateCategory(categoryForm.id, categoryData);
        addToast({
          title: "Success",
          description: "Category updated successfully",
          color: "success",
        });
      } else {
        await bedService.createCategory(categoryData);
        addToast({
          title: "Success",
          description: "Category created successfully",
          color: "success",
        });
      }

      const categoriesData = await bedService.getCategoriesByClinic(
        clinicId!,
        branchId!,
      );

      setCategories(categoriesData);

      categoryModalState.forceClose();
      resetCategoryForm();
    } catch (error) {
      console.error("Error saving category:", error);
      addToast({
        title: "Error",
        description: "Failed to save category",
        color: "danger",
      });
    }
  };

  const editCategory = (category: BedCategory) => {
    setCategoryForm({
      id: category.id,
      name: category.name,
      description: category.description || "",
    });
    setIsEditing(true);
    categoryModalState.open();
  };

  // Allotment handlers
  const resetAllotmentForm = () => {
    setAllotmentForm({
      id: "",
      bedId: "",
      patientId: "",
      doctorId: "",
      allotmentDate: new Date().toISOString().split("T")[0],
      dischargeDate: "",
    });
    setIsEditing(false);
  };

  const handleSaveAllotment = async () => {
    if (
      !allotmentForm.bedId ||
      !allotmentForm.patientId ||
      !allotmentForm.allotmentDate
    ) {
      addToast({
        title: "Error",
        description:
          "Please fill in all required fields (Bed, Patient, Allotment Date)",
        color: "danger",
      });

      return;
    }

    // Check if bed is available
    const selectedBed = beds.find((b) => b.id === allotmentForm.bedId);

    if (!selectedBed) {
      addToast({
        title: "Error",
        description: "Selected bed not found",
        color: "danger",
      });

      return;
    }

    if (selectedBed.status !== "available" && !isEditing) {
      addToast({
        title: "Error",
        description: "Selected bed is not available",
        color: "danger",
      });

      return;
    }

    // Validate discharge date if provided
    if (allotmentForm.dischargeDate) {
      const allotmentDate = new Date(allotmentForm.allotmentDate);
      const dischargeDate = new Date(allotmentForm.dischargeDate);

      if (dischargeDate < allotmentDate) {
        addToast({
          title: "Error",
          description: "Discharge date must be after allotment date",
          color: "danger",
        });

        return;
      }
    }

    try {
      const selectedPatient = patients.find(
        (p) => p.id === allotmentForm.patientId,
      );
      const selectedDoctor = allotmentForm.doctorId
        ? doctors.find((d) => d.id === allotmentForm.doctorId)
        : null;

      const allotmentData: Omit<
        BedAllotment,
        "id" | "createdAt" | "updatedAt"
      > = {
        bedId: allotmentForm.bedId,
        bedNumber: selectedBed.bedNumber,
        patientId: allotmentForm.patientId,
        patientName: selectedPatient?.name || "",
        doctorId: allotmentForm.doctorId || undefined,
        doctorName: selectedDoctor?.name || undefined,
        allotmentDate: new Date(allotmentForm.allotmentDate),
        dischargeDate: allotmentForm.dischargeDate
          ? new Date(allotmentForm.dischargeDate)
          : undefined,
        status: allotmentForm.dischargeDate ? "discharged" : "active",
        clinicId: clinicId!,
        branchId: branchId!,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await bedService.updateAllotment(allotmentForm.id, allotmentData);
        addToast({
          title: "Success",
          description: "Allotment updated successfully",
          color: "success",
        });
      } else {
        await bedService.createAllotment(allotmentData);
        addToast({
          title: "Success",
          description: "Allotment created successfully",
          color: "success",
        });
      }

      // Reload data
      const [bedsData, allotmentsData] = await Promise.all([
        bedService.getBedsByClinic(clinicId!, branchId!),
        bedService.getAllotmentsByClinic(clinicId!, branchId!),
      ]);

      setBeds(bedsData);
      setAllotments(allotmentsData);

      allotmentModalState.forceClose();
      resetAllotmentForm();
    } catch (error) {
      console.error("Error saving allotment:", error);
      addToast({
        title: "Error",
        description: "Failed to save allotment",
        color: "danger",
      });
    }
  };

  const editAllotment = (allotment: BedAllotment) => {
    setAllotmentForm({
      id: allotment.id,
      bedId: allotment.bedId,
      patientId: allotment.patientId,
      doctorId: allotment.doctorId || "",
      allotmentDate: new Date(allotment.allotmentDate)
        .toISOString()
        .split("T")[0],
      dischargeDate: allotment.dischargeDate
        ? new Date(allotment.dischargeDate).toISOString().split("T")[0]
        : "",
    });
    setIsEditing(true);
    allotmentModalState.open();
  };

  const handleDischargeAllotment = async (allotment: BedAllotment) => {
    if (allotment.status === "discharged") {
      addToast({
        title: "Error",
        description: "Allotment is already discharged",
        color: "danger",
      });

      return;
    }

    const dischargeDate = new Date();

    try {
      await bedService.dischargeAllotment(allotment.id, dischargeDate);
      addToast({
        title: "Success",
        description: "Patient discharged successfully",
        color: "success",
      });

      // Reload data
      const [bedsData, allotmentsData] = await Promise.all([
        bedService.getBedsByClinic(clinicId!, branchId!),
        bedService.getAllotmentsByClinic(clinicId!, branchId!),
      ]);

      setBeds(bedsData);
      setAllotments(allotmentsData);
    } catch (error) {
      console.error("Error discharging allotment:", error);
      addToast({
        title: "Error",
        description: "Failed to discharge patient",
        color: "danger",
      });
    }
  };

  // Delete handlers
  const openDeleteModal = (type: string, id: string, name: string) => {
    setItemToDelete({ type, id, name });
    deleteConfirmModalState.open();
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === "bed") {
        await bedService.deleteBed(itemToDelete.id);
        addToast({
          title: "Success",
          description: "Bed deleted successfully",
          color: "success",
        });
        const bedsData = await bedService.getBedsByClinic(clinicId!, branchId!);

        setBeds(bedsData);
      } else if (itemToDelete.type === "category") {
        await bedService.deleteCategory(itemToDelete.id);
        addToast({
          title: "Success",
          description: "Category deleted successfully",
          color: "success",
        });
        const categoriesData = await bedService.getCategoriesByClinic(
          clinicId!,
          branchId!,
        );

        setCategories(categoriesData);
      } else if (itemToDelete.type === "allotment") {
        await bedService.deleteAllotment(itemToDelete.id);
        addToast({
          title: "Success",
          description: "Allotment deleted successfully",
          color: "success",
        });
        const [bedsData, allotmentsData] = await Promise.all([
          bedService.getBedsByClinic(clinicId!, branchId!),
          bedService.getAllotmentsByClinic(clinicId!, branchId!),
        ]);

        setBeds(bedsData);
        setAllotments(allotmentsData);
      }

      deleteConfirmModalState.forceClose();
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      addToast({
        title: "Error",
        description: "Failed to delete item",
        color: "danger",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner label="Loading bed management data..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Bed Management
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage beds, bed categories, and bed allotments
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Card
        className="bg-surface border border-border-base rounded-[10px]"
        shadow="none"
      >
        <CardBody className="p-0">
          <Tabs
            aria-label="Bed management tabs"
            classNames={{
              tabList:
                "w-full border-b border-border-base bg-surface-2 p-1 rounded-none",
              cursor: "bg-surface border border-border-base rounded-[10px]",
              tab: "max-w-fit px-6 h-9",
              tabContent:
                "font-semibold text-text-muted group-data-[selected=true]:text-primary",
            }}
            selectedKey={activeTab}
            variant="light"
            onSelectionChange={(key) => setActiveTab(key as string)}
          >
            {/* Beds Tab */}
            <Tab key="beds" title="Beds">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Input
                    className="w-80"
                    classNames={{
                      inputWrapper:
                        "rounded-[10px] border-border-base bg-surface",
                    }}
                    placeholder="Search"
                    startContent={<IoSearchOutline />}
                    value={bedsSearchQuery}
                    onValueChange={setBedsSearchQuery}
                  />
                  <Button
                    className="rounded-[10px]"
                    color="primary"
                    startContent={<IoAddOutline />}
                    onPress={() => {
                      resetBedForm();
                      bedModalState.open();
                    }}
                  >
                    New Bed
                  </Button>
                </div>

                {filteredBeds.length > 0 ? (
                  <Table aria-label="Beds table" shadow="none">
                    <TableHeader className="bg-surface-2">
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        BED NUMBER
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        ROOM NUMBER
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        CATEGORY
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        STATUS
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        ACTIONS
                      </TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredBeds.map((bed) => (
                        <TableRow key={bed.id}>
                          <TableCell className="px-5 py-4">
                            <p className="font-medium text-text-main">
                              {bed.bedNumber}
                            </p>
                          </TableCell>
                          <TableCell>{bed.roomNumber || "—"}</TableCell>
                          <TableCell>
                            <Chip
                              classNames={{
                                base: "bg-primary/10 border-primary/20",
                                content: "text-primary font-semibold",
                              }}
                              size="sm"
                              variant="bordered"
                            >
                              {bed.categoryName}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              classNames={{
                                base:
                                  bed.status === "available"
                                    ? "bg-emerald-500/20 border-emerald-500/30"
                                    : bed.status === "occupied"
                                      ? "bg-rose-500/20 border-rose-500/30"
                                      : "bg-amber-500/20 border-amber-500/30",
                                content:
                                  bed.status === "available"
                                    ? "text-emerald-400 font-semibold"
                                    : bed.status === "occupied"
                                      ? "text-rose-400 font-semibold"
                                      : "text-amber-400 font-semibold",
                              }}
                              size="sm"
                              variant="bordered"
                            >
                              {bed.status.charAt(0).toUpperCase() +
                                bed.status.slice(1)}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                className="h-8 min-w-unit-12 px-unit-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-[10px] font-semibold"
                                size="sm"
                                startContent={
                                  <IoCreateOutline className="w-3.5 h-3.5" />
                                }
                                variant="flat"
                                onPress={() => editBed(bed)}
                              >
                                Edit
                              </Button>
                              <Button
                                className="h-8 min-w-unit-12 px-unit-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20 rounded-[10px] font-semibold"
                                size="sm"
                                startContent={
                                  <IoTrashOutline className="w-3.5 h-3.5" />
                                }
                                variant="flat"
                                onPress={() =>
                                  openDeleteModal("bed", bed.id, bed.bedNumber)
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
                      {bedsSearchQuery ? "No beds found" : "No beds yet"}
                    </p>
                  </div>
                )}
              </div>
            </Tab>

            {/* Bed Categories Tab */}
            <Tab key="categories" title="Bed Categories">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Input
                    className="w-80"
                    classNames={{
                      inputWrapper:
                        "rounded-[10px] border-border-base bg-surface",
                    }}
                    placeholder="Search"
                    startContent={<IoSearchOutline />}
                    value={categoriesSearchQuery}
                    onValueChange={setCategoriesSearchQuery}
                  />
                  <Button
                    className="rounded-[10px]"
                    color="primary"
                    startContent={<IoAddOutline />}
                    onPress={() => {
                      resetCategoryForm();
                      categoryModalState.open();
                    }}
                  >
                    New Category
                  </Button>
                </div>

                {filteredCategories.length > 0 ? (
                  <Table aria-label="Bed categories table" shadow="none">
                    <TableHeader className="bg-surface-2">
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        NAME
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        DESCRIPTION
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        ACTIONS
                      </TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="px-5 py-4">
                            <p className="font-medium text-text-main">
                              {category.name}
                            </p>
                          </TableCell>
                          <TableCell>{category.description || "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                className="h-8 min-w-unit-12 px-unit-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-[10px] font-semibold"
                                size="sm"
                                startContent={
                                  <IoCreateOutline className="w-3.5 h-3.5" />
                                }
                                variant="flat"
                                onPress={() => editCategory(category)}
                              >
                                Edit
                              </Button>
                              <Button
                                className="h-8 min-w-unit-12 px-unit-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20 rounded-[10px] font-semibold"
                                size="sm"
                                startContent={
                                  <IoTrashOutline className="w-3.5 h-3.5" />
                                }
                                variant="flat"
                                onPress={() =>
                                  openDeleteModal(
                                    "category",
                                    category.id,
                                    category.name,
                                  )
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
                      {categoriesSearchQuery
                        ? "No categories found"
                        : "No bed categories yet"}
                    </p>
                  </div>
                )}
              </div>
            </Tab>

            {/* Bed Allotments Tab */}
            <Tab key="allotments" title="Bed Allotments">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Input
                    className="w-80"
                    classNames={{
                      inputWrapper:
                        "rounded-[10px] border-border-base bg-surface",
                    }}
                    placeholder="Search"
                    startContent={<IoSearchOutline />}
                    value={allotmentsSearchQuery}
                    onValueChange={setAllotmentsSearchQuery}
                  />
                  <Button
                    className="rounded-[10px]"
                    color="primary"
                    startContent={<IoAddOutline />}
                    onPress={() => {
                      resetAllotmentForm();
                      allotmentModalState.open();
                    }}
                  >
                    New Allotment
                  </Button>
                </div>

                {filteredAllotments.length > 0 ? (
                  <Table aria-label="Bed allotments table" shadow="none">
                    <TableHeader className="bg-surface-2">
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        BED NUMBER
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        PATIENT
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        DOCTOR
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        ALLOTMENT DATE
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        DISCHARGE DATE
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        STATUS
                      </TableColumn>
                      <TableColumn className="text-[11px] font-semibold text-text-muted tracking-[0.06em] uppercase px-5 py-3">
                        ACTIONS
                      </TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredAllotments.map((allotment) => (
                        <TableRow key={allotment.id}>
                          <TableCell className="px-5 py-4">
                            <p className="font-medium text-text-main">
                              {allotment.bedNumber}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar
                                color="primary"
                                name={allotment.patientName}
                                size="sm"
                              />
                              <div>
                                <p className="text-sm font-medium">
                                  {allotment.patientName}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{allotment.doctorName || "—"}</TableCell>
                          <TableCell>
                            {new Date(
                              allotment.allotmentDate,
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {allotment.dischargeDate
                              ? new Date(
                                  allotment.dischargeDate,
                                ).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              classNames={{
                                base:
                                  allotment.status === "active"
                                    ? "bg-emerald-500/20 border-emerald-500/30"
                                    : allotment.status === "discharged"
                                      ? "bg-slate-500/20 border-slate-500/30"
                                      : "bg-amber-500/20 border-amber-500/30",
                                content:
                                  allotment.status === "active"
                                    ? "text-emerald-400 font-semibold"
                                    : allotment.status === "discharged"
                                      ? "text-slate-400 font-semibold"
                                      : "text-amber-400 font-semibold",
                              }}
                              size="sm"
                              variant="bordered"
                            >
                              {allotment.status.charAt(0).toUpperCase() +
                                allotment.status.slice(1)}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 flex-wrap">
                              {allotment.status === "active" && (
                                <Button
                                  className="h-8 min-w-unit-12 px-unit-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 rounded-[10px] font-semibold"
                                  size="sm"
                                  startContent={
                                    <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                                  }
                                  variant="flat"
                                  onPress={() =>
                                    handleDischargeAllotment(allotment)
                                  }
                                >
                                  Discharge
                                </Button>
                              )}
                              <Button
                                className="h-8 min-w-unit-12 px-unit-3 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 rounded-[10px] font-semibold"
                                size="sm"
                                startContent={
                                  <IoCreateOutline className="w-3.5 h-3.5" />
                                }
                                variant="flat"
                                onPress={() => editAllotment(allotment)}
                              >
                                Edit
                              </Button>
                              <Button
                                className="h-8 min-w-unit-12 px-unit-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20 rounded-[10px] font-semibold"
                                size="sm"
                                startContent={
                                  <IoTrashOutline className="w-3.5 h-3.5" />
                                }
                                variant="flat"
                                onPress={() =>
                                  openDeleteModal(
                                    "allotment",
                                    allotment.id,
                                    `${allotment.patientName} - ${allotment.bedNumber}`,
                                  )
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
                      {allotmentsSearchQuery
                        ? "No allotments found"
                        : "No bed allotments yet"}
                    </p>
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Bed Form Modal */}
      <Modal
        isOpen={bedModalState.isOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={bedModalState.close}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={bedModalState.close}
              >
                <IoArrowBackOutline />
              </Button>
              {isEditing ? "Edit Bed" : "New Bed"}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  isRequired
                  label="Bed Number *"
                  placeholder="Enter bed number"
                  value={bedForm.bedNumber}
                  onValueChange={(value) =>
                    setBedForm((prev) => ({ ...prev, bedNumber: value }))
                  }
                />

                <Input
                  label="Room Number"
                  placeholder="Enter room number"
                  value={bedForm.roomNumber}
                  onValueChange={(value) =>
                    setBedForm((prev) => ({ ...prev, roomNumber: value }))
                  }
                />

                <Autocomplete
                  isRequired
                  defaultItems={categories}
                  label="Category *"
                  placeholder="Search and select category"
                  popoverProps={{
                    shouldCloseOnBlur: false,
                    classNames: {
                      content: "max-h-60 overflow-auto z-[1001]",
                    },
                  }}
                  selectedKey={bedForm.categoryId || null}
                  onOpenChange={bedModalState.handleDropdownInteraction}
                  onSelectionChange={(key) => {
                    const selectedId = key ? key.toString() : "";

                    setBedForm((prev) => ({ ...prev, categoryId: selectedId }));
                  }}
                >
                  {(category) => (
                    <AutocompleteItem
                      key={category.id}
                      textValue={category.name}
                    >
                      {category.name}
                    </AutocompleteItem>
                  )}
                </Autocomplete>

                <Select
                  isRequired
                  label="Status *"
                  placeholder="Select status"
                  selectedKeys={[bedForm.status]}
                  onOpenChange={bedModalState.handleDropdownInteraction}
                  onSelectionChange={(keys) => {
                    const selectedStatus =
                      Array.from(keys)[0]?.toString() || "available";

                    setBedForm((prev) => ({
                      ...prev,
                      status: selectedStatus as
                        | "available"
                        | "occupied"
                        | "maintenance",
                    }));
                  }}
                >
                  <SelectItem key="available">Available</SelectItem>
                  <SelectItem key="occupied">Occupied</SelectItem>
                  <SelectItem key="maintenance">Maintenance</SelectItem>
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={bedModalState.close}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSaveBed}>
              {isEditing ? "Update" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Category Form Modal */}
      <Modal
        isOpen={categoryModalState.isOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={categoryModalState.close}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={categoryModalState.close}
              >
                <IoArrowBackOutline />
              </Button>
              {isEditing ? "Edit Category" : "New Category"}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                label="Category Name *"
                placeholder="Enter category name"
                value={categoryForm.name}
                onValueChange={(value) =>
                  setCategoryForm((prev) => ({ ...prev, name: value }))
                }
              />

              <Textarea
                label="Description"
                placeholder="Enter category description"
                value={categoryForm.description}
                onValueChange={(value) =>
                  setCategoryForm((prev) => ({ ...prev, description: value }))
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={categoryModalState.close}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSaveCategory}>
              {isEditing ? "Update" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Allotment Form Modal */}
      <Modal
        isOpen={allotmentModalState.isOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={allotmentModalState.close}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={allotmentModalState.close}
              >
                <IoArrowBackOutline />
              </Button>
              {isEditing ? "Edit Allotment" : "New Allotment"}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Autocomplete
                  isRequired
                  defaultItems={isEditing ? beds : availableBeds}
                  label="Bed *"
                  placeholder="Search and select bed"
                  popoverProps={{
                    shouldCloseOnBlur: false,
                    classNames: {
                      content: "max-h-60 overflow-auto z-[1001]",
                    },
                  }}
                  selectedKey={allotmentForm.bedId || null}
                  onOpenChange={allotmentModalState.handleDropdownInteraction}
                  onSelectionChange={(key) => {
                    const selectedId = key ? key.toString() : "";

                    setAllotmentForm((prev) => ({
                      ...prev,
                      bedId: selectedId,
                    }));
                  }}
                >
                  {(bed) => (
                    <AutocompleteItem
                      key={bed.id}
                      textValue={`${bed.bedNumber}${bed.roomNumber ? ` - ${bed.roomNumber}` : ""}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-small">{bed.bedNumber}</span>
                        {bed.roomNumber && (
                          <span className="text-tiny text-default-400">
                            Room: {bed.roomNumber}
                          </span>
                        )}
                      </div>
                    </AutocompleteItem>
                  )}
                </Autocomplete>

                <Autocomplete
                  isRequired
                  defaultItems={patients}
                  label="Patient *"
                  placeholder="Search and select patient"
                  popoverProps={{
                    shouldCloseOnBlur: false,
                    classNames: {
                      content: "max-h-60 overflow-auto z-[1001]",
                    },
                  }}
                  selectedKey={allotmentForm.patientId || null}
                  onOpenChange={allotmentModalState.handleDropdownInteraction}
                  onSelectionChange={(key) => {
                    const selectedId = key ? key.toString() : "";

                    setAllotmentForm((prev) => ({
                      ...prev,
                      patientId: selectedId,
                    }));
                  }}
                >
                  {(patient) => (
                    <AutocompleteItem
                      key={patient.id}
                      textValue={`${patient.name} - ${patient.regNumber}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-small">{patient.name}</span>
                        <span className="text-tiny text-default-400">
                          Reg: {patient.regNumber}
                        </span>
                      </div>
                    </AutocompleteItem>
                  )}
                </Autocomplete>

                <Autocomplete
                  defaultItems={doctors}
                  label="Doctor"
                  placeholder="Search and select doctor"
                  popoverProps={{
                    shouldCloseOnBlur: false,
                    classNames: {
                      content: "max-h-60 overflow-auto z-[1001]",
                    },
                  }}
                  selectedKey={allotmentForm.doctorId || null}
                  onOpenChange={allotmentModalState.handleDropdownInteraction}
                  onSelectionChange={(key) => {
                    const selectedId = key ? key.toString() : "";

                    setAllotmentForm((prev) => ({
                      ...prev,
                      doctorId: selectedId,
                    }));
                  }}
                >
                  {(doctor) => (
                    <AutocompleteItem key={doctor.id} textValue={doctor.name}>
                      {doctor.name}
                    </AutocompleteItem>
                  )}
                </Autocomplete>

                <Input
                  isRequired
                  label="Allotment Date *"
                  type="date"
                  value={allotmentForm.allotmentDate}
                  onValueChange={(value) =>
                    setAllotmentForm((prev) => ({
                      ...prev,
                      allotmentDate: value,
                    }))
                  }
                />

                <Input
                  label="Discharge Date"
                  min={allotmentForm.allotmentDate}
                  type="date"
                  value={allotmentForm.dischargeDate}
                  onValueChange={(value) =>
                    setAllotmentForm((prev) => ({
                      ...prev,
                      dischargeDate: value,
                    }))
                  }
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={allotmentModalState.close}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSaveAllotment}>
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
              Are you sure you want to delete {itemToDelete?.name}? This action
              cannot be undone.
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
