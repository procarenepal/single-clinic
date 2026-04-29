import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  IoAddOutline,
  IoSearchOutline,
  IoTrashOutline,
  IoArrowBackOutline,
  IoArrowUpOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { patientService } from "@/services/patientService";
import { pathologyService } from "@/services/pathologyService";
import { labTechnicianService } from "@/services/labTechnicianService";
import { pathologyBillingService } from "@/services/pathologyBillingService";
import { clinicService } from "@/services/clinicService";
import LabTechnicianManagement from "@/components/pathology/LabTechnicianManagement";
import PathologyBillingTab from "@/components/pathology/PathologyBillingTab";
import PathologyTestsTab from "@/components/pathology/PathologyTestsTab";
import PathologyCategoriesTab from "@/components/pathology/PathologyCategoriesTab";
import PathologyUnitsTab from "@/components/pathology/PathologyUnitsTab";
import PathologyParametersTab from "@/components/pathology/PathologyParametersTab";
import PathologyTestTypesTab from "@/components/pathology/PathologyTestTypesTab";
import PathologyDailyReportTab from "@/components/pathology/PathologyDailyReportTab";
import {
  PathologyTest,
  PathologyCategory,
  PathologyUnit,
  PathologyParameter,
  PathologyTestParameter,
  PathologyTestType,
  LabTechnician,
  PathologyBilling,
  Patient,
} from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";

const TAB_KEYS = [
  "tests",
  "category",
  "units",
  "parameters",
  "testPrices",
  "technicians",
  "billing",
  "dailyReport",
] as const;

function PathologySearchSelect({
  label,
  items,
  value,
  onChange,
  onInputChange,
  onAddNew,
  required,
  placeholder,
}: {
  label: string;
  items: { id: string; primary: string; secondary?: string }[];
  value: string;
  onChange: (id: string, primary: string) => void;
  onInputChange?: (value: string) => void;
  onAddNew?: (q: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = (
    q
      ? items.filter((i) =>
        (i.primary + (i.secondary || ""))
          .toLowerCase()
          .includes(q.toLowerCase()),
      )
      : items
  ).slice(0, 100);
  const selected = items.find((i) => i.id === value);

  return (
    <>
      <div className="flex flex-col gap-1.5 relative">
        {(label || required) && (
          <label className="text-[13px] font-medium text-text-muted">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div
          className="flex flex-wrap items-center min-h-[32px] border border-border-base rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-surface"
          onClick={() => setOpen(true)}
        >
          <IoSearchOutline className="ml-3 w-4 h-4 text-text-muted shrink-0" />
          <input
            className="flex-1 text-[13.5px] px-2 py-1.5 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted w-full min-w-0"
            placeholder={
              selected && !open ? selected.primary : placeholder || "Search…"
            }
            value={open ? q : selected ? selected.primary : ""}
            onChange={(e) => {
              const val = e.target.value;

              setQ(val);
              setOpen(true);
              if (onInputChange) onInputChange(val);
            }}
            onFocus={() => setOpen(true)}
          />
          {value && (
            <button
              className="mr-3 text-text-muted hover:text-text-main"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("", "");
                setQ("");
                if (onInputChange) onInputChange("");
              }}
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            ></div>
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border-base rounded shadow-lg max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
                  <p className="text-[13px] text-text-muted">
                    No results found for "{q}"
                  </p>
                  {onAddNew && q && (
                    <Button
                      color="primary"
                      size="sm"
                      startContent={<IoAddOutline className="w-4 h-4" />}
                      variant="flat"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddNew(q);
                        setOpen(false);
                      }}
                    >
                      Create New
                    </Button>
                  )}
                </div>
              ) : (
                filtered.map((i) => (
                  <button
                    key={i.id}
                    className={`flex flex-col w-full text-left px-3 py-2 hover:bg-primary/5 border-b border-border-base/50 last:border-0 ${i.id === value ? "bg-primary/10" : ""}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(i.id, i.primary);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <span className="text-[13.5px] font-medium text-text-main leading-tight">
                      {i.primary}
                    </span>
                    {i.secondary && (
                      <span className="text-[11.5px] text-text-muted mt-0.5 leading-tight">
                        {i.secondary}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function PathologyPage() {
  const { clinicId, currentUser, userData } = useAuthContext();
  const branchId = userData?.branchId || userData?.clinicId || clinicId;

  // Active tab state
  const [activeTab, setActiveTab] = useState("tests");

  // Loading state
  const [loading, setLoading] = useState(true);

  // Data states
  const [tests, setTests] = useState<PathologyTest[]>([]);
  const [categories, setCategories] = useState<PathologyCategory[]>([]);
  const [units, setUnits] = useState<PathologyUnit[]>([]);
  const [parameters, setParameters] = useState<PathologyParameter[]>([]);
  const [testTypes, setTestTypes] = useState<PathologyTestType[]>([]);
  const [labTechnicians, setLabTechnicians] = useState<LabTechnician[]>([]);
  const [billings, setBillings] = useState<PathologyBilling[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinic, setClinic] = useState<any>(null);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );

  // Daily Report state
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Search states
  const [testsSearchQuery, setTestsSearchQuery] = useState("");
  const [categoriesSearchQuery, setCategoriesSearchQuery] = useState("");
  const [unitsSearchQuery, setUnitsSearchQuery] = useState("");
  const [parametersSearchQuery, setParametersSearchQuery] = useState("");
  const [testTypesSearchQuery, setTestTypesSearchQuery] = useState("");

  // Modal states
  const testModalState = useModalState(false);
  const categoryModalState = useModalState(false);
  const unitModalState = useModalState(false);
  const parameterModalState = useModalState(false);
  const testTypeModalState = useModalState(false);
  const quickPatientModalState = useModalState(false);
  const deleteConfirmModalState = useModalState(false);

  // Form states
  const [testForm, setTestForm] = useState({
    id: "",
    isWalkIn: false,
    walkInPhone: "",
    patientId: "",
    patientName: "",
    patientAge: "",
    patientGender: "",
    shortName: "",
    testType: "",
    categoryId: "",
    unit: "",
    subCategory: "",
    method: "",
    reportDays: "",
    chargeCategory: "",
    standardCharge: "",
    labTechnicianId: "",
    parameters: [
      {
        categoryId: "",
        parameterId: "",
        parameterName: "",
        patientResult: "",
        referenceRange: "",
        unit: "",
      },
    ],
  });
  const [quickPatientForm, setQuickPatientForm] = useState({
    name: "",
    age: "",
    gender: "",
    mobile: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
  });

  const [unitForm, setUnitForm] = useState({
    id: "",
    name: "",
  });

  const [parameterForm, setParameterForm] = useState({
    id: "",
    categoryId: "",
    name: "",
    referenceRange: "",
    unit: "",
  });

  const [testTypeForm, setTestTypeForm] = useState({
    id: "",
    targetType: "category" as "category" | "parameter",
    categoryId: "",
    parameterId: "",
    price: "",
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
          testsData,
          categoriesData,
          unitsData,
          parametersData,
          testTypesData,
          techniciansData,
          billingsData,
          clinicData,
          layoutConfigData,
          patientsData,
        ] = await Promise.all([
          pathologyService.getTestsByClinic(clinicId, branchId),
          pathologyService.getCategoriesByClinic(clinicId, branchId),
          pathologyService.getUnitsByClinic(clinicId, branchId),
          pathologyService.getParametersByClinic(clinicId, branchId),
          pathologyService.getTestTypesByClinic(clinicId, branchId),
          labTechnicianService.getTechniciansByClinic(clinicId, branchId),
          pathologyBillingService.getBillingByClinic(clinicId, branchId),
          clinicService.getClinicById(clinicId),
          clinicService.getPrintLayoutConfig(clinicId),
          patientService.getPatientsByClinic(clinicId, branchId),
        ]);

        setTests(testsData);
        setCategories(categoriesData);
        setUnits(unitsData);
        setParameters(parametersData);
        setTestTypes(testTypesData);
        setLabTechnicians(techniciansData);
        setBillings(billingsData);
        setClinic(clinicData);
        setLayoutConfig(layoutConfigData);
        setPatients(patientsData);
      } catch (error) {
        console.error("Error loading pathology data:", error);
        addToast({
          title: "Error",
          description: "Failed to load pathology data. Please try again.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clinicId, branchId]);

  // Filtered data
  const filteredTests = useMemo(() => {
    if (!testsSearchQuery.trim()) return tests;
    const query = testsSearchQuery.toLowerCase();

    return tests.filter(
      (test) =>
        test.testName.toLowerCase().includes(query) ||
        (test.shortName && test.shortName.toLowerCase().includes(query)) ||
        test.patientName.toLowerCase().includes(query) ||
        test.categoryName.toLowerCase().includes(query) ||
        (test.labTechnicianName &&
          test.labTechnicianName.toLowerCase().includes(query)),
    );
  }, [tests, testsSearchQuery]);

  const filteredCategories = useMemo(() => {
    if (!categoriesSearchQuery.trim()) return categories;
    const query = categoriesSearchQuery.toLowerCase();

    return categories.filter((cat) => cat.name.toLowerCase().includes(query));
  }, [categories, categoriesSearchQuery]);

  const filteredUnits = useMemo(() => {
    if (!unitsSearchQuery.trim()) return units;
    const query = unitsSearchQuery.toLowerCase();

    return units.filter((unit) => unit.name.toLowerCase().includes(query));
  }, [units, unitsSearchQuery]);

  const filteredParameters = useMemo(() => {
    if (!parametersSearchQuery.trim()) return parameters;
    const query = parametersSearchQuery.toLowerCase();

    return parameters.filter(
      (param) =>
        param.name.toLowerCase().includes(query) ||
        param.referenceRange.toLowerCase().includes(query),
    );
  }, [parameters, parametersSearchQuery]);

  const filteredTestTypes = useMemo(() => {
    if (!testTypesSearchQuery.trim()) return testTypes;
    const query = testTypesSearchQuery.toLowerCase();

    return testTypes.filter(
      (testType) =>
        testType.name && testType.name.toLowerCase().includes(query),
    );
  }, [testTypes, testTypesSearchQuery]);

  // Daily Report filtered data
  const dailyReportData = useMemo(() => {
    const selectedDateObj = new Date(selectedDate);
    const startOfDay = new Date(selectedDateObj.setHours(0, 0, 0, 0));
    const endOfDay = new Date(selectedDateObj.setHours(23, 59, 59, 999));

    // Filter tests by date
    const dailyTests = tests.filter((test) => {
      const testDate = new Date(test.createdAt);

      return testDate >= startOfDay && testDate <= endOfDay;
    });

    // Filter billings by invoice date
    const dailyBillings = billings.filter((billing) => {
      const invoiceDate = new Date(billing.invoiceDate);

      return invoiceDate >= startOfDay && invoiceDate <= endOfDay;
    });

    // Calculate statistics
    const totalTests = dailyTests.length;
    const totalBillings = dailyBillings.length;
    const totalRevenue = dailyBillings.reduce(
      (sum, billing) => sum + (billing.totalAmount || 0),
      0,
    );
    const totalPaid = dailyBillings
      .filter((b) => b.status === "paid")
      .reduce((sum, billing) => sum + (billing.totalAmount || 0), 0);
    const totalPending = dailyBillings
      .filter((b) => b.status === "draft" || b.status === "finalized")
      .reduce((sum, billing) => sum + (billing.totalAmount || 0), 0);

    // Test types breakdown
    const testTypeBreakdown: Record<string, number> = {};

    dailyTests.forEach((test) => {
      const type = test.testType || "Unknown";

      testTypeBreakdown[type] = (testTypeBreakdown[type] || 0) + 1;
    });

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};

    dailyTests.forEach((test) => {
      const category = test.categoryName || "Unknown";

      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    });

    // Lab technician breakdown
    const technicianBreakdown: Record<string, number> = {};

    dailyTests.forEach((test) => {
      const technician = test.labTechnicianName || "Unassigned";

      technicianBreakdown[technician] =
        (technicianBreakdown[technician] || 0) + 1;
    });

    // Patient statistics
    const uniquePatients = new Set(dailyTests.map((test) => test.patientName));
    const totalPatients = uniquePatients.size;

    return {
      dailyTests,
      dailyBillings,
      totalTests,
      totalBillings,
      totalRevenue,
      totalPaid,
      totalPending,
      testTypeBreakdown,
      categoryBreakdown,
      technicianBreakdown,
      totalPatients,
    };
  }, [tests, billings, selectedDate]);

  // Test form handlers
  const resetTestForm = () => {
    setTestForm({
      id: "",
      isWalkIn: false,
      walkInPhone: "",
      patientId: "",
      patientName: "",
      patientAge: "",
      patientGender: "",
      shortName: "",
      testType: "",
      categoryId: "",
      unit: "",
      subCategory: "",
      method: "",
      reportDays: "",
      chargeCategory: "",
      standardCharge: "",
      labTechnicianId: "",
      parameters: [
        {
          categoryId: "",
          parameterId: "",
          parameterName: "",
          patientResult: "",
          referenceRange: "",
          unit: "",
        },
      ],
    });
    setIsEditing(false);
  };

  const addTestParameter = () => {
    setTestForm((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        {
          categoryId: "",
          parameterId: "",
          parameterName: "",
          patientResult: "",
          referenceRange: "",
          unit: "",
        },
      ],
    }));
  };

  const removeTestParameter = (index: number) => {
    setTestForm((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  };

  const updateTestParameter = (
    index: number,
    field: keyof PathologyTestParameter,
    value: string,
  ) => {
    setTestForm((prev) => {
      const updated = [...prev.parameters];

      updated[index] = { ...updated[index], [field]: value };

      // If parameter is selected, populate name and reference range
      if (field === "parameterId") {
        const selectedParam = parameters.find((p) => p.id === value);

        if (selectedParam) {
          updated[index].parameterName = selectedParam.name;
          updated[index].referenceRange = selectedParam.referenceRange;
          // Find unit name
          const unitObj = units.find((u) => u.id === selectedParam.unit);

          updated[index].unit = unitObj?.name || "";
        }
      }

      return { ...prev, parameters: updated };
    });
  };

  const moveTestParameter = (index: number, direction: "up" | "down") => {
    setTestForm((prev) => {
      const updated = [...prev.parameters];

      if (direction === "up" && index > 0) {
        [updated[index - 1], updated[index]] = [
          updated[index],
          updated[index - 1],
        ];
      } else if (direction === "down" && index < updated.length - 1) {
        [updated[index], updated[index + 1]] = [
          updated[index + 1],
          updated[index],
        ];
      }

      return { ...prev, parameters: updated };
    });
  };

  const handleSaveQuickPatient = async () => {
    if (!quickPatientForm.name.trim()) {
      addToast({
        title: "Error",
        description: "Please enter patient name",
        color: "danger",
      });

      return;
    }
    setLoading(true);
    try {
      const regNumber = await patientService.getNextRegistrationNumber(
        clinicId!,
      );
      const patientData: any = {
        regNumber,
        name: quickPatientForm.name.trim(),
        mobile: quickPatientForm.mobile.trim() || "N/A",
        gender: quickPatientForm.gender || "other",
        clinicId: clinicId!,
        branchId: branchId || clinicId!,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser?.uid || "",
      };

      if (quickPatientForm.age)
        patientData.age = parseInt(quickPatientForm.age);

      const patientId = await patientService.createPatient(patientData);

      // Update local patients list
      const updatedPatients = await patientService.getPatientsByClinic(
        clinicId!,
        branchId!,
      );

      setPatients(updatedPatients);

      // Select the new patient
      setTestForm((prev) => ({
        ...prev,
        patientId: patientId,
        patientName: quickPatientForm.name,
        patientAge: quickPatientForm.age || prev.patientAge,
        patientGender: quickPatientForm.gender || prev.patientGender,
      }));

      addToast({
        title: "Success",
        description: "Patient created successfully",
        color: "success",
      });
      quickPatientModalState.close();
      setQuickPatientForm({ name: "", age: "", gender: "", mobile: "" });
    } catch (error) {
      console.error("Error creating quick patient:", error);
      addToast({
        title: "Error",
        description: "Failed to create patient",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTest = async () => {
    // Create walk-in patient if needed
    let finalPatientId = testForm.patientId;
    let finalPatientName = testForm.patientName;

    if (testForm.isWalkIn) {
      if (!testForm.patientName) {
        addToast({
          title: "Error",
          description: "Walk-in patient name is required",
          color: "danger",
        });

        return;
      }
      try {
        const patientData = {
          name: testForm.patientName,
          mobile: testForm.walkInPhone || "N/A",
          age: parseInt(testForm.patientAge) || undefined,
          gender:
            (testForm.patientGender as "male" | "female" | "other") || "other",
          clinicId: clinicId!,
          branchId: branchId!,
        };
        const newPatientId = await patientService.createPatient(patientData);

        finalPatientId = newPatientId;
        finalPatientName = testForm.patientName;
        // Optionally update local patients list
        const updatedPatients = await patientService.getPatientsByClinic(
          clinicId!,
          branchId!,
        );

        setPatients(updatedPatients);
      } catch (err) {
        console.error("Failed to create walk-in patient", err);
        addToast({
          title: "Error",
          description: "Could not create walk-in patient",
          color: "danger",
        });

        return;
      }
    } else if (!finalPatientId) {
      addToast({
        title: "Error",
        description: "Please select an existing patient",
        color: "danger",
      });

      return;
    }

    try {
      const testData: Omit<PathologyTest, "id" | "createdAt" | "updatedAt"> = {
        patientId: finalPatientId,
        patientName: finalPatientName,
        patientAge: testForm.patientAge
          ? parseInt(testForm.patientAge)
          : undefined,
        patientGender:
          (testForm.patientGender as "male" | "female" | "other") || "other",
        testName: testForm.testType || testForm.shortName || "Unknown Test",
        categoryName:
          categories.find((c) => c.id === testForm.categoryId)?.name ||
          "Unknown Category",
        shortName: testForm.shortName,
        testType: testForm.testType,
        categoryId: testForm.categoryId,
        unit: testForm.unit,
        subCategory: testForm.subCategory,
        method: testForm.method,
        reportDays: testForm.reportDays
          ? parseInt(testForm.reportDays)
          : undefined,
        chargeCategory: testForm.chargeCategory,
        standardCharge: testForm.standardCharge
          ? parseFloat(testForm.standardCharge)
          : 0,
        labTechnicianId: testForm.labTechnicianId,
        parameters: testForm.parameters
          .filter((p) => p.parameterId)
          .map((p) => ({
            parameterId: p.parameterId,
            parameterName:
              parameters.find((param) => param.id === p.parameterId)?.name ||
              "",
            categoryId: p.categoryId,
            patientResult: p.patientResult,
            referenceRange: p.referenceRange,
            unit: p.unit,
          })),
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await pathologyService.updateTest(testForm.id, testData);
        addToast({
          title: "Success",
          description: "Pathology test updated successfully",
          color: "success",
        });
      } else {
        await pathologyService.createTest(testData);
        addToast({
          title: "Success",
          description: "Pathology test created successfully",
          color: "success",
        });
      }

      // Reload data
      const [testsData, techniciansData] = await Promise.all([
        pathologyService.getTestsByClinic(clinicId!, branchId!),
        labTechnicianService.getTechniciansByClinic(clinicId!, branchId!),
      ]);

      setTests(testsData);
      setLabTechnicians(techniciansData);

      testModalState.forceClose();
      resetTestForm();
    } catch (error) {
      console.error("Error saving test:", error);
      addToast({
        title: "Error",
        description: "Failed to save pathology test",
        color: "danger",
      });
    }
  };

  const editTest = (test: PathologyTest) => {
    setTestForm({
      id: test.id,
      isWalkIn: false,
      walkInPhone: "",
      patientId: test.patientId || "",
      patientName: test.patientName || "",
      patientAge: test.patientAge?.toString() || "",
      patientGender: test.patientGender || "",
      shortName: test.shortName || "",
      testType: test.testType || "",
      categoryId: test.categoryId,
      unit: test.unit || "",
      subCategory: test.subCategory || "",
      method: test.method || "",
      reportDays: test.reportDays?.toString() || "",
      chargeCategory: test.chargeCategory || "",
      standardCharge: test.standardCharge?.toString() || "",
      labTechnicianId: test.labTechnicianId || "",
      parameters: test.parameters
        ? test.parameters.map((p) => {
          // If unit is an ID, try to resolve it to a name
          let displayUnit = p.unit;

          if (p.unit && units.find((u) => u.id === p.unit)) {
            displayUnit = units.find((u) => u.id === p.unit)?.name || p.unit;
          }

          return { ...p, unit: displayUnit, categoryId: p.categoryId || "" };
        })
        : [],
    });
    setIsEditing(true);
    testModalState.open();
  };

  // Category handlers
  const resetCategoryForm = () => {
    setCategoryForm({ id: "", name: "" });
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
      const categoryData: Omit<
        PathologyCategory,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: categoryForm.name.trim(),
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await pathologyService.updateCategory(categoryForm.id, categoryData);
        addToast({
          title: "Success",
          description: "Category updated successfully",
          color: "success",
        });
      } else {
        await pathologyService.createCategory(categoryData);
        addToast({
          title: "Success",
          description: "Category created successfully",
          color: "success",
        });
      }

      const categoriesData = await pathologyService.getCategoriesByClinic(
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

  const editCategory = (category: PathologyCategory) => {
    setCategoryForm({ id: category.id, name: category.name });
    setIsEditing(true);
    categoryModalState.open();
  };

  // Unit handlers
  const resetUnitForm = () => {
    setUnitForm({ id: "", name: "" });
    setIsEditing(false);
  };

  const handleSaveUnit = async () => {
    if (!unitForm.name.trim()) {
      addToast({
        title: "Error",
        description: "Please enter unit name",
        color: "danger",
      });

      return;
    }

    try {
      const unitData: Omit<PathologyUnit, "id" | "createdAt" | "updatedAt"> = {
        name: unitForm.name.trim(),
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await pathologyService.updateUnit(unitForm.id, unitData);
        addToast({
          title: "Success",
          description: "Unit updated successfully",
          color: "success",
        });
      } else {
        await pathologyService.createUnit(unitData);
        addToast({
          title: "Success",
          description: "Unit created successfully",
          color: "success",
        });
      }

      const unitsData = await pathologyService.getUnitsByClinic(
        clinicId!,
        branchId!,
      );

      setUnits(unitsData);

      unitModalState.forceClose();
      resetUnitForm();
    } catch (error) {
      console.error("Error saving unit:", error);
      addToast({
        title: "Error",
        description: "Failed to save unit",
        color: "danger",
      });
    }
  };

  const editUnit = (unit: PathologyUnit) => {
    setUnitForm({ id: unit.id, name: unit.name });
    setIsEditing(true);
    unitModalState.open();
  };

  // Parameter handlers
  const resetParameterForm = () => {
    setParameterForm({
      id: "",
      categoryId: "",
      name: "",
      referenceRange: "",
      unit: "",
    });
    setIsEditing(false);
  };

  const handleSaveParameter = async () => {
    if (!parameterForm.name.trim() || !parameterForm.referenceRange.trim()) {
      addToast({
        title: "Error",
        description: "Please fill in all required fields",
        color: "danger",
      });

      return;
    }

    try {
      const parameterData: Omit<
        PathologyParameter,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: parameterForm.name.trim(),
        categoryId: parameterForm.categoryId || undefined,
        referenceRange: parameterForm.referenceRange.trim(),
        unit: parameterForm.unit,
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await pathologyService.updateParameter(parameterForm.id, parameterData);
        addToast({
          title: "Success",
          description: "Parameter updated successfully",
          color: "success",
        });
      } else {
        await pathologyService.createParameter(parameterData);
        addToast({
          title: "Success",
          description: "Parameter created successfully",
          color: "success",
        });
      }

      const parametersData = await pathologyService.getParametersByClinic(
        clinicId!,
        branchId!,
      );

      setParameters(parametersData);

      parameterModalState.forceClose();
      resetParameterForm();
    } catch (error) {
      console.error("Error saving parameter:", error);
      addToast({
        title: "Error",
        description: "Failed to save parameter",
        color: "danger",
      });
    }
  };

  const editParameter = (parameter: PathologyParameter) => {
    setParameterForm({
      id: parameter.id,
      categoryId: parameter.categoryId || "",
      name: parameter.name,
      referenceRange: parameter.referenceRange,
      unit: parameter.unit,
    });
    setIsEditing(true);
    parameterModalState.open();
  };

  // Test Type handlers
  const resetTestTypeForm = () => {
    setTestTypeForm({
      id: "",
      targetType: "category",
      categoryId: "",
      parameterId: "",
      price: "",
    });
    setIsEditing(false);
  };

  const handleSaveTestType = async () => {
    if (!testTypeForm.price.trim()) {
      addToast({
        title: "Error",
        description: "Please enter a price",
        color: "danger",
      });

      return;
    }

    if (testTypeForm.targetType === "category" && !testTypeForm.categoryId) {
      addToast({
        title: "Error",
        description: "Please select a category",
        color: "danger",
      });

      return;
    }

    if (testTypeForm.targetType === "parameter" && !testTypeForm.parameterId) {
      addToast({
        title: "Error",
        description: "Please select a parameter",
        color: "danger",
      });

      return;
    }

    const priceValue = parseFloat(testTypeForm.price);

    if (isNaN(priceValue) || priceValue < 0) {
      addToast({
        title: "Error",
        description: "Please enter a valid price",
        color: "danger",
      });

      return;
    }

    let targetName = "Unknown";
    let targetId = "";

    if (testTypeForm.targetType === "category") {
      targetName =
        categories.find((c) => c.id === testTypeForm.categoryId)?.name ||
        "Unknown";
      targetId = testTypeForm.categoryId;
    } else {
      targetName =
        parameters.find((p) => p.id === testTypeForm.parameterId)?.name ||
        "Unknown";
      targetId = testTypeForm.parameterId;
    }

    try {
      const testTypeData: Omit<
        PathologyTestType,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: targetName,
        targetId: targetId,
        targetType: testTypeForm.targetType,
        price: priceValue,
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await pathologyService.updateTestType(testTypeForm.id, testTypeData);
        addToast({
          title: "Success",
          description: "Test type updated successfully",
          color: "success",
        });
      } else {
        await pathologyService.createTestType(testTypeData);
        addToast({
          title: "Success",
          description: "Test type created successfully",
          color: "success",
        });
      }

      const testTypesData = await pathologyService.getTestTypesByClinic(
        clinicId!,
        branchId!,
      );

      setTestTypes(testTypesData);

      testTypeModalState.forceClose();
      resetTestTypeForm();
    } catch (error) {
      console.error("Error saving test type:", error);
      addToast({
        title: "Error",
        description: "Failed to save test type",
        color: "danger",
      });
    }
  };

  const editTestType = (testType: PathologyTestType) => {
    const isCategory = testType.targetType === "category";

    setTestTypeForm({
      id: testType.id,
      targetType:
        (testType.targetType as "category" | "parameter") || "category",
      categoryId: isCategory ? testType.targetId || "" : "",
      parameterId: !isCategory ? testType.targetId || "" : "",
      price: testType.price.toString(),
    });
    setIsEditing(true);
    testTypeModalState.open();
  };

  // Delete handlers
  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      switch (itemToDelete.type) {
        case "test":
          await pathologyService.deleteTest(itemToDelete.id);
          const testsData = await pathologyService.getTestsByClinic(
            clinicId!,
            branchId!,
          );

          setTests(testsData);
          break;
        case "category":
          await pathologyService.deleteCategory(itemToDelete.id);
          const categoriesData = await pathologyService.getCategoriesByClinic(
            clinicId!,
            branchId!,
          );

          setCategories(categoriesData);
          break;
        case "unit":
          await pathologyService.deleteUnit(itemToDelete.id);
          const unitsData = await pathologyService.getUnitsByClinic(
            clinicId!,
            branchId!,
          );

          setUnits(unitsData);
          break;
        case "parameter":
          await pathologyService.deleteParameter(itemToDelete.id);
          const parametersData = await pathologyService.getParametersByClinic(
            clinicId!,
            branchId!,
          );

          setParameters(parametersData);
          break;
        case "testType":
          await pathologyService.deleteTestType(itemToDelete.id);
          const testTypesData = await pathologyService.getTestTypesByClinic(
            clinicId!,
            branchId!,
          );

          setTestTypes(testTypesData);
          break;
      }

      addToast({
        title: "Success",
        description: "Item deleted successfully",
        color: "success",
      });

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

  const openDeleteModal = (type: string, id: string, name: string) => {
    setItemToDelete({ type, id, name });
    deleteConfirmModalState.open();
  };

  const buildPathologyReportHtml = (
    test: PathologyTest,
    clinic?: any,
    layoutConfig?: PrintLayoutConfig | null,
    options?: { hideLetterhead?: boolean },
  ) => {
    const hideLetterhead = options?.hideLetterhead ?? false;

    const configuredTopMargin =
      layoutConfig?.contentTopMarginWithoutLetterheadMm;
    const topMarginMm = hideLetterhead
      ? typeof configuredTopMargin === "number" &&
        !Number.isNaN(configuredTopMargin)
        ? configuredTopMargin
        : 20
      : 10;

    const parametersRows =
      test.parameters && test.parameters.length > 0
        ? test.parameters
          .map(
            (param) => `
            <tr>
              <td>${param.parameterName}</td>
              <td class="result-cell">${param.patientResult}</td>
              <td>${param.referenceRange}</td>
              <td class="unit-cell">${param.unit}</td>
            </tr>
          `,
          )
          .join("")
        : `
        <tr>
          <td colspan="4" style="text-align:center; padding:24px; color: #6B7280;">
            No parameter data provided.
          </td>
        </tr>
      `;

    const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig) : "";
    const headerHtml = hideLetterhead
      ? ""
      : layoutConfig
        ? getPrintHeaderHTML(layoutConfig, clinic)
        : "";

    const footerHtml = hideLetterhead
      ? ""
      : layoutConfig
        ? getPrintFooterHTML(layoutConfig)
        : "";

    // Helper to check if a value is meaningful
    const isValid = (val: any) => {
      if (!val) return false;
      const s = String(val).toLowerCase();

      return (
        s !== "—" &&
        s !== "unknown" &&
        !s.includes("unknown test") &&
        !s.includes("unknown category")
      );
    };

    // Filtered fields for investigation report
    const infofields = [
      { label: "Patient Name", value: test.patientName },
      {
        label: "Age",
        value: test.patientAge ? `${test.patientAge} Years` : "",
      },
      {
        label: "Gender",
        value: test.patientGender
          ? test.patientGender.charAt(0).toUpperCase() +
          test.patientGender.slice(1)
          : "",
      },
      { label: "Test Name", value: test.testName },
      { label: "Category", value: test.categoryName },
      { label: "Test Type", value: test.testType },
      {
        label: "Sample Date",
        value: test.createdAt
          ? new Date(test.createdAt).toLocaleDateString()
          : "",
      },
      { label: "Report Date", value: new Date().toLocaleDateString() },
    ].filter((f) => isValid(f.value));

    const infoGridHtml = infofields
      .map(
        (f) => `
      <div class="info-item">
        <span class="info-label">${f.label}:</span>
        <span class="info-value">${f.value}</span>
      </div>
    `,
      )
      .join("");

    return `<!DOCTYPE html>
  <html>
    <head>
      <title>Pathology Report - ${test.patientName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        @page { margin: 0; size: A4; }
        body {
          font-family: 'Inter', -apple-system, sans-serif;
          margin: 0;
          padding: 0;
          background: white;
          color: #111827;
          line-height: 1.5;
        }

        ${brandingCSS}

        .print-container {
          width: 100%;
          padding: ${topMarginMm}mm 20mm 20mm 20mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        
        .content {
            padding: 0;
        }

        .document-title {
          text-align: center;
          margin: 10px 0 20px;
          border-bottom: 2px solid #475569;
          padding-bottom: 5px;
        }

        .document-title h2 {
          font-size: 20px;
          font-weight: 800;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #475569;
        }

        .section-header {
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
          border-left: 4px solid #475569;
          padding-left: 10px;
        }

        /* Rest of pathology specific styles */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px 40px;
          margin-bottom: 30px;
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          font-size: 13.5px;
          border-bottom: 1px dashed #e5e7eb;
          padding-bottom: 4px;
        }

        .info-label { font-weight: 600; color: #4B5563; }
        .info-value { font-weight: 700; color: #111827; text-align: right; }

        .parameters-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        .parameters-table th {
          background: #f3f4f6;
          color: #374151;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          padding: 12px 10px;
          border-top: 2px solid #374151;
          border-bottom: 1px solid #d1d5db;
          text-align: left;
        }

        .parameters-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 13.5px;
          color: #1F2937;
        }

        .parameters-table tr:last-child td {
          border-bottom: 2px solid #374151;
        }

        .unit-cell { color: #6B7280; font-size: 12px; }
        .result-cell { font-weight: 700; font-size: 14px; }

        .footer-section {
          margin-top: auto;
          margin-bottom: 20px;
          padding: 0 15mm;
        }

        .signature-block {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 50px;
        }

        .technician-info { text-align: right; }

        .sign-line {
          width: 200px;
          border-top: 1px solid #111827;
          margin-top: 40px;
          padding-top: 8px;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          color: #4B5563;
          text-align: center;
        }

        .meta-text { font-size: 11px; color: #9CA3AF; }
        
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .print-container { padding: ${topMarginMm}mm 0 10mm 0; }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        ${headerHtml}
        
        <div class="document-title">
          <h2>Clinical Investigation Report</h2>
        </div>
        
        <div class="content">
          <div class="section">
            <div class="section-header">Patient & Investigation Details</div>
            <div class="info-grid">
              ${infoGridHtml}
            </div>
          </div>

          <div class="section">
            <div class="section-header">Test Parameters & Results</div>
            <table class="parameters-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Observation / Result</th>
                  <th>Reference Range</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                ${parametersRows}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer-section">
          <div class="signature-block">
            <div>
              <p class="meta-text">Report generated via ProCare Platform</p>
              <p class="meta-text">Generated on: ${new Date().toLocaleString()}</p>
            </div>
            <div class="technician-info">
              ${test.labTechnicianName ? `<p style="margin:0; font-weight:700; font-size:14px; color:#111827;">${test.labTechnicianName}</p><p style="margin:0; font-size:12px; color:#6B7280; margin-bottom:10px;">Lab Technician</p>` : ""}
              <div class="sign-line">Authorized Signatory</div>
            </div>
          </div>
        </div>
        
        ${footerHtml}
      </div>

      <script>
        window.addEventListener('load', function() {
          setTimeout(function() {
            window.print();
          }, 500);
        });
        window.addEventListener('afterprint', function() {
          window.close();
        });
        window.addEventListener('beforeunload', function() {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage('printComplete', '*');
          }
        });
      </script>
    </body>
  </html>`;
  };

  const buildDailyReportHtml = (
    reportData: {
      dailyTests: PathologyTest[];
      dailyBillings: PathologyBilling[];
      totalTests: number;
      totalBillings: number;
      totalRevenue: number;
      totalPaid: number;
      totalPending: number;
      testTypeBreakdown: Record<string, number>;
      categoryBreakdown: Record<string, number>;
      technicianBreakdown: Record<string, number>;
      totalPatients: number;
    },
    date: string,
    clinic?: any,
    layoutConfig?: PrintLayoutConfig | null,
  ) => {
    const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig) : "";
    const headerHtml = layoutConfig
      ? getPrintHeaderHTML(layoutConfig, clinic)
      : "";
    const footerHtml = layoutConfig ? getPrintFooterHTML(layoutConfig) : "";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Pathology Report - ${date}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: white; color: #333; line-height: 1.5; font-size: 11px; }
          .print-container { max-width: 100%; margin: 0; background: white; display: flex; flex-direction: column; padding: 0; box-sizing: border-box; }
          .content { flex: 1; padding: 15mm; min-height: 0; }
          
          ${brandingCSS}
          
          .document-title { text-align: center; margin: 10px 0 25px 0; }
          .document-title h2 { font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; }
          .document-subtitle { font-size: 13px; color: #64748b; margin: 5px 0; font-weight: 500; }

          .report-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; }
          .meta-item { display: flex; gap: 8px; align-items: baseline; }
          .meta-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; white-space: nowrap; }
          .meta-value { font-size: 11px; color: #1e293b; font-weight: 600; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; }
          th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 10px 8px; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; font-size: 9px; }
          td { padding: 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
          .font-bold { font-weight: 700; }
          .text-right { text-align: right; }
          
          .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 30px; }
          .summary-card { padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; }
          .card-value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 5px; }
          .card-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }

          @media print { .content { padding: 10mm; } .summary-card { border: 1px solid #ddd; } }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${headerHtml}
          
          <div class="content">
            <div class="document-title">
              <h2>Pathology Daily Report</h2>
              <p class="document-subtitle">Comprehensive Billing & Test Summary</p>
            </div>

            <div class="report-meta">
              <div class="meta-item"><span class="meta-label">Report Date:</span><span class="meta-value">${date}</span></div>
              <div class="meta-item"><span class="meta-label">Generated:</span><span class="meta-value">${new Date().toLocaleString()}</span></div>
            </div>

            <div class="summary-cards" style="margin-bottom: 30px;">
              <div class="summary-card">
                <div class="card-label">Total Tests</div>
                <div class="card-value">${reportData.totalTests}</div>
              </div>
              <div class="summary-card">
                <div class="card-label">Total Patients</div>
                <div class="card-value">${reportData.totalPatients}</div>
              </div>
              <div class="summary-card">
                <div class="card-label">Total Revenue</div>
                <div class="card-value">NPR ${reportData.totalRevenue.toLocaleString()}</div>
              </div>
              <div class="summary-card">
                <div class="card-label">Total Invoices</div>
                <div class="card-value">${reportData.totalBillings}</div>
              </div>
            </div>

            <h3 style="font-size: 14px; color: #475569; margin-bottom: 10px; border-left: 4px solid #38bdf8; padding-left: 10px;">Tests Performed</h3>
            <table>
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Patient</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Technician</th>
                  <th class="text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.dailyTests
        .map(
          (test) => `
                  <tr>
                    <td class="font-bold">${test.testName}</td>
                    <td>${test.patientName}${test.patientAge ? ` (${test.patientAge}${test.patientGender ? `, ${test.patientGender}` : ""})` : ""}</td>
                    <td>${test.testType || "—"}</td>
                    <td>${test.categoryName}</td>
                    <td>${test.labTechnicianName || "—"}</td>
                    <td class="text-right">${new Date(test.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                `,
        )
        .join("")}
              </tbody>
            </table>

            <h3 style="font-size: 14px; color: #475569; margin-top: 30px; margin-bottom: 10px; border-left: 4px solid #38bdf8; padding-left: 10px;">Invoices Issued</h3>
            <table>
              <thead>
                <tr>
                  <th>Inv #</th>
                  <th>Patient Name</th>
                  <th>Items</th>
                  <th class="text-right">Amount</th>
                  <th class="text-right">Status</th>
                  <th class="text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.dailyBillings
        .map(
          (billing) => `
                  <tr>
                    <td class="font-bold">${billing.invoiceNumber}</td>
                    <td>${billing.patientName}</td>
                    <td>${billing.items.length} tests</td>
                    <td class="text-right font-bold">${billing.totalAmount.toLocaleString()}</td>
                    <td class="text-right">${billing.status.toUpperCase()}</td>
                    <td class="text-right">${new Date(billing.invoiceDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                `,
        )
        .join("")}
              </tbody>
            </table>
          </div>

          ${footerHtml}
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintTest = (
    test: PathologyTest,
    options?: { hideLetterhead?: boolean },
  ) => {
    const defaultHide =
      layoutConfig?.defaultPathologyPrintWithoutLetterhead ?? false;
    const hideLetterhead = options?.hideLetterhead ?? defaultHide;

    const printWindow = window.open("", "_blank", "width=900,height=1200");

    if (!printWindow) {
      addToast({
        title: "Error",
        description:
          "Unable to open print window. Please allow popups and try again.",
        color: "danger",
      });

      return;
    }

    const reportHtml = buildPathologyReportHtml(test, clinic, layoutConfig, {
      hideLetterhead,
    });

    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner label="Loading pathology data..." size="lg" />
      </div>
    );
  }

  const tabLabels: Record<string, string> = {
    tests: "Pathology Tests",
    category: "Pathology Category",
    units: "Pathology Units",
    parameters: "Pathology Parameters",
    testPrices: "Test Prices",
    technicians: "Lab Technicians",
    billing: "Billing",
    dailyReport: "Daily Report",
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className={title()}>Pathology</h1>
            <p className="text-text-muted mt-2 text-[13.5px]">
              Manage pathology tests, categories, units, and parameters
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-surface border border-border-base rounded">
          {/* Tab header */}
          <div className="border-b border-border-base overflow-x-auto">
            <div className="inline-flex rounded-t">
              {TAB_KEYS.map((key) => (
                <button
                  key={key}
                  className={`px-4 py-3 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${activeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-text-muted hover:text-text-main hover:border-border-base"
                    }`}
                  type="button"
                  onClick={() => setActiveTab(key)}
                >
                  {tabLabels[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {activeTab === "tests" && (
              <PathologyTestsTab
                filteredTests={filteredTests}
                searchQuery={testsSearchQuery}
                onAdd={() => {
                  resetTestForm();
                  testModalState.open();
                }}
                onDelete={(test) =>
                  openDeleteModal("test", test.id, test.testName)
                }
                onEdit={editTest}
                onPrint={handlePrintTest}
                onSearchChange={setTestsSearchQuery}
              />
            )}
            {activeTab === "category" && (
              <PathologyCategoriesTab
                filteredCategories={filteredCategories}
                searchQuery={categoriesSearchQuery}
                onAdd={() => {
                  resetCategoryForm();
                  categoryModalState.open();
                }}
                onAddSubCategory={(cat) => {
                  resetParameterForm();
                  setParameterForm((prev) => ({ ...prev, categoryId: cat.id }));
                  parameterModalState.open();
                }}
                onDelete={(cat) => openDeleteModal("category", cat.id, cat.name)}
                onEdit={editCategory}
                onSearchChange={setCategoriesSearchQuery}
              />
            )}
            {activeTab === "units" && (
              <PathologyUnitsTab
                filteredUnits={filteredUnits}
                searchQuery={unitsSearchQuery}
                onAdd={() => {
                  resetUnitForm();
                  unitModalState.open();
                }}
                onDelete={(u) => openDeleteModal("unit", u.id, u.name)}
                onEdit={editUnit}
                onSearchChange={setUnitsSearchQuery}
              />
            )}
            {activeTab === "parameters" && (
              <PathologyParametersTab
                categories={categories}
                filteredParameters={filteredParameters}
                searchQuery={parametersSearchQuery}
                units={units}
                onAdd={() => {
                  resetParameterForm();
                  parameterModalState.open();
                }}
                onDelete={(p) => openDeleteModal("parameter", p.id, p.name)}
                onEdit={editParameter}
                onSearchChange={setParametersSearchQuery}
              />
            )}
            {activeTab === "testPrices" && (
              <PathologyTestTypesTab
                filteredTestTypes={filteredTestTypes}
                searchQuery={testTypesSearchQuery}
                onAdd={() => {
                  resetTestTypeForm();
                  testTypeModalState.open();
                }}
                onDelete={(tt) =>
                  openDeleteModal(
                    "testType",
                    tt.id,
                    tt.name || "Price Configuration",
                  )
                }
                onEdit={editTestType}
                onSearchChange={setTestTypesSearchQuery}
              />
            )}
            {activeTab === "technicians" && (
              <LabTechnicianManagement
                branchId={branchId!}
                clinicId={clinicId!}
              />
            )}
            {activeTab === "dailyReport" && (
              <PathologyDailyReportTab
                dailyReportData={dailyReportData}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onPrintReport={() => {
                  const printWindow = window.open(
                    "",
                    "_blank",
                    "width=900,height=1200",
                  );

                  if (printWindow) {
                    const reportHtml = buildDailyReportHtml(
                      dailyReportData,
                      selectedDate,
                      clinic,
                      layoutConfig,
                    );

                    printWindow.document.write(reportHtml);
                    printWindow.document.close();
                  }
                }}
              />
            )}
            {activeTab === "billing" && (
              <PathologyBillingTab branchId={branchId!} clinicId={clinicId!} />
            )}
          </div>
        </div>

        {/* Test Form Modal - custom overlay */}
        {
          testModalState.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-mountain-900/40 backdrop-blur-sm"
                onClick={testModalState.close}
              ></div>
              <div className="relative z-10 bg-surface border border-border-base rounded-lg w-full max-w-6xl mx-4 max-h-[92vh] flex flex-col shadow-2xl">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2 flex items-center justify-between shrink-0">
                  <h2 className="text-[14px] font-semibold text-text-main">
                    {isEditing ? "Edit Pathology Test" : "Create Pathology Tests"}
                  </h2>
                  <button
                    className="text-text-muted hover:text-text-main"
                    type="button"
                    onClick={testModalState.close}
                  >
                    <IoArrowBackOutline className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                  <div className="space-y-6">
                    {/* Test Details Section */}
                    <h3 className="text-lg font-semibold mb-4">Test Details</h3>

                    {/* Walk-in vs Existing Patient Toggle */}
                    <div className="flex bg-surface-2 p-1 rounded-md w-max mb-4 border border-border-base">
                      <button
                        className={`px-4 py-1.5 text-sm rounded ${!testForm.isWalkIn ? "bg-surface shadow-sm text-text-main font-medium border border-border-base" : "text-text-muted hover:text-text-main"}`}
                        type="button"
                        onClick={() =>
                          setTestForm((prev) => ({
                            ...prev,
                            isWalkIn: false,
                            patientId: "",
                            patientName: "",
                            patientAge: "",
                            patientGender: "",
                            walkInPhone: "",
                          }))
                        }
                      >
                        Existing Patient
                      </button>
                      <button
                        className={`px-4 py-1.5 text-sm rounded ${testForm.isWalkIn ? "bg-surface shadow-sm text-text-main font-medium border border-border-base" : "text-text-muted hover:text-text-main"}`}
                        type="button"
                        onClick={() =>
                          setTestForm((prev) => ({
                            ...prev,
                            isWalkIn: true,
                            patientId: "",
                            patientName: "",
                            patientAge: "",
                            patientGender: "",
                            walkInPhone: "",
                          }))
                        }
                      >
                        Walk-In Client
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {!testForm.isWalkIn ? (
                        <PathologySearchSelect
                          required
                          items={patients.map((p) => ({
                            id: p.id,
                            primary: p.name,
                            secondary: `${p.mobile || ""} ${p.age ? `(${p.age}y)` : ""} `,
                          }))}
                          label="Patient Name *"
                          placeholder="Search or enter patient name"
                          value={testForm.patientId}
                          onChange={(id, primary) => {
                            const patient = patients.find((p) => p.id === id);

                            setTestForm((prev) => ({
                              ...prev,
                              patientId: id,
                              patientName: primary,
                              patientAge:
                                patient?.age?.toString() || prev.patientAge,
                              patientGender:
                                patient?.gender || prev.patientGender,
                            }));
                          }}
                          onInputChange={(val) =>
                            setTestForm((prev) => ({
                              ...prev,
                              patientName: val,
                              patientId: "",
                            }))
                          }
                        />
                      ) : (
                        <>
                          <Input
                            isRequired
                            label="Patient Name *"
                            placeholder="Walk-In Name"
                            value={testForm.patientName}
                            onValueChange={(v) =>
                              setTestForm((prev) => ({ ...prev, patientName: v }))
                            }
                          />
                          <Input
                            label="Phone Number"
                            placeholder="Phone Number"
                            value={testForm.walkInPhone}
                            onValueChange={(v) =>
                              setTestForm((prev) => ({ ...prev, walkInPhone: v }))
                            }
                          />
                        </>
                      )}

                      <Input
                        label="Patient Age"
                        placeholder="Enter patient age"
                        type="number"
                        value={testForm.patientAge}
                        onValueChange={(v) =>
                          setTestForm((prev) => ({ ...prev, patientAge: v }))
                        }
                      />
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-medium text-text-muted">
                          Patient Gender
                        </label>
                        <select
                          className="h-[32px] border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          value={testForm.patientGender}
                          onChange={(e) =>
                            setTestForm((prev) => ({
                              ...prev,
                              patientGender: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <Input
                        label="Short Name"
                        placeholder="Short Name"
                        value={testForm.shortName}
                        onValueChange={(v) =>
                          setTestForm((prev) => ({ ...prev, shortName: v }))
                        }
                      />

                      <PathologySearchSelect
                        items={testTypes.map((tt) => ({
                          id: tt.name,
                          primary: tt.name,
                          secondary: `NPR ${tt.price.toFixed(2)} `,
                        }))}
                        label="Test Type"
                        placeholder="Search and select test type"
                        value={testForm.testType}
                        onChange={(id, primary) => {
                          const tt = testTypes.find((t) => t.name === primary);

                          setTestForm((prev) => ({
                            ...prev,
                            testType: primary,
                            standardCharge: tt
                              ? tt.price.toString()
                              : prev.standardCharge,
                          }));
                        }}
                      />

                      <PathologySearchSelect
                        items={categories.map((c) => ({
                          id: c.id,
                          primary: c.name,
                        }))}
                        label="Category Name"
                        placeholder="Search and select category"
                        value={testForm.categoryId}
                        onChange={(id) =>
                          setTestForm((prev) => ({ ...prev, categoryId: id }))
                        }
                      />

                      <Input
                        label="Unit"
                        placeholder="Unit"
                        value={testForm.unit}
                        onValueChange={(v) =>
                          setTestForm((prev) => ({ ...prev, unit: v }))
                        }
                      />

                      <Input
                        label="Sub Category"
                        placeholder="Sub Category"
                        value={testForm.subCategory}
                        onValueChange={(v) =>
                          setTestForm((prev) => ({ ...prev, subCategory: v }))
                        }
                      />

                      <Input
                        label="Method"
                        placeholder="Method"
                        value={testForm.method}
                        onValueChange={(v) =>
                          setTestForm((prev) => ({ ...prev, method: v }))
                        }
                      />

                      <Input
                        label="Report Days"
                        placeholder="Report Days"
                        type="number"
                        value={testForm.reportDays}
                        onValueChange={(v) =>
                          setTestForm((prev) => ({ ...prev, reportDays: v }))
                        }
                      />

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-medium text-text-muted">
                          Charge Category
                        </label>
                        <select
                          className="h-[32px] border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          value={testForm.chargeCategory}
                          onChange={(e) =>
                            setTestForm((prev) => ({
                              ...prev,
                              chargeCategory: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select Charge Category</option>
                          <option value="lab">Lab</option>
                          <option value="fee">Fee</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <Input
                        label="Standard Charge (NPR)"
                        placeholder="Standard Charge"
                        type="number"
                        value={testForm.standardCharge}
                        onValueChange={(v) =>
                          setTestForm((prev) => ({ ...prev, standardCharge: v }))
                        }
                      />

                      <PathologySearchSelect
                        items={labTechnicians.map((t) => ({
                          id: t.id,
                          primary: t.name,
                          secondary: t.employeeId
                            ? `(${t.employeeId})`
                            : undefined,
                        }))}
                        label="Lab Technician (Optional)"
                        placeholder="Search and select lab technician"
                        value={testForm.labTechnicianId}
                        onChange={(id) =>
                          setTestForm((prev) => ({
                            ...prev,
                            labTechnicianId: id,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Parameters Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Parameter Fields
                    </h3>
                    {testForm.parameters.map((param, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-12 gap-2 mb-4 items-end bg-surface-2/50 p-2 rounded border border-border-base/50"
                      >
                        <div className="col-span-2">
                          <PathologySearchSelect
                            items={categories.map((c) => ({
                              id: c.id,
                              primary: c.name,
                            }))}
                            label="Category"
                            placeholder="Select category"
                            value={param.categoryId}
                            onChange={(id) => {
                              updateTestParameter(index, "categoryId", id);
                              updateTestParameter(index, "parameterId", ""); // Reset parameter when category changes
                            }}
                          />
                        </div>
                        <div className="col-span-2">
                          <PathologySearchSelect
                            required
                            items={parameters
                              .filter(
                                (p) =>
                                  !param.categoryId ||
                                  p.categoryId === param.categoryId,
                              )
                              .map((p) => ({
                                id: p.id,
                                primary: p.name,
                                secondary: p.referenceRange
                                  ? `Range: ${p.referenceRange} `
                                  : undefined,
                              }))}
                            label="Parameter *"
                            placeholder="Select sub-category"
                            value={param.parameterId}
                            onChange={(id) =>
                              updateTestParameter(index, "parameterId", id)
                            }
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            isRequired
                            label="Patient Result *"
                            placeholder="Result (e.g. 10.5 or Text)"
                            value={param.patientResult}
                            onValueChange={(v) =>
                              updateTestParameter(index, "patientResult", v)
                            }
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            label="Ref. Range"
                            placeholder="Range"
                            value={param.referenceRange}
                            onValueChange={(v) =>
                              updateTestParameter(index, "referenceRange", v)
                            }
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            label="Unit"
                            placeholder="Unit"
                            value={param.unit}
                            onValueChange={(v) =>
                              updateTestParameter(index, "unit", v)
                            }
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center h-[32px] gap-1">
                          <Button
                            isIconOnly
                            color="default"
                            disabled={index === 0}
                            size="sm"
                            variant="light"
                            onClick={() => moveTestParameter(index, "up")}
                          >
                            <IoArrowUpOutline className="text-text-muted" />
                          </Button>
                          <Button
                            isIconOnly
                            color="danger"
                            size="sm"
                            variant="light"
                            onClick={() => removeTestParameter(index)}
                          >
                            <IoTrashOutline />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-center mt-4">
                      <Button
                        color="default"
                        startContent={<IoAddOutline />}
                        variant="bordered"
                        onClick={addTestParameter}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-border-base/50 bg-surface-2 flex justify-end gap-2 shrink-0">
                  <Button variant="light" onClick={testModalState.close}>
                    Cancel
                  </Button>
                  <Button color="primary" onClick={handleSaveTest}>
                    {isEditing ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        }

        {/* Category Form Modal */}
        {
          categoryModalState.isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={categoryModalState.close}
              ></div>
              <div className="relative z-10 bg-surface border border-border-base rounded-md w-full max-w-md mx-4">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2">
                  <h2 className="text-[14px] font-semibold text-text-main">
                    {isEditing
                      ? "Edit Pathology Category"
                      : "New Pathology Category"}
                  </h2>
                </div>
                <div className="p-5">
                  <Input
                    isRequired
                    label="Name *"
                    placeholder="Category Name"
                    value={categoryForm.name}
                    onValueChange={(v) =>
                      setCategoryForm((prev) => ({ ...prev, name: v }))
                    }
                  />
                </div>
                <div className="px-5 py-3 border-t border-border-base/50 bg-surface-2 flex justify-end gap-2">
                  <Button variant="light" onClick={categoryModalState.close}>
                    Cancel
                  </Button>
                  <Button color="primary" onClick={handleSaveCategory}>
                    {isEditing ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          )
        }

        {/* Unit Form Modal */}
        {
          unitModalState.isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={unitModalState.close}
              ></div>
              <div className="relative z-10 bg-surface border border-border-base rounded-md w-full max-w-md mx-4">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2">
                  <h2 className="text-[14px] font-semibold text-text-main">
                    {isEditing ? "Edit Pathology Unit" : "New Pathology Unit"}
                  </h2>
                </div>
                <div className="p-5">
                  <Input
                    isRequired
                    label="Name *"
                    placeholder="Unit Name"
                    value={unitForm.name}
                    onValueChange={(v) =>
                      setUnitForm((prev) => ({ ...prev, name: v }))
                    }
                  />
                </div>
                <div className="px-5 py-3 border-t border-border-base/50 bg-surface-2 flex justify-end gap-2">
                  <Button variant="light" onClick={unitModalState.close}>
                    Cancel
                  </Button>
                  <Button color="primary" onClick={handleSaveUnit}>
                    {isEditing ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          )
        }

        {/* Parameter Form Modal */}
        {
          parameterModalState.isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={parameterModalState.close}
              ></div>
              <div className="relative z-10 bg-surface border border-border-base rounded-md w-full max-w-md mx-4">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2">
                  <h2 className="text-[14px] font-semibold text-text-main">
                    {isEditing
                      ? "Edit Pathology Parameter"
                      : "New Pathology Parameter"}
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-text-muted">
                      Category Name
                    </label>
                    <select
                      className="h-[32px] border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      value={parameterForm.categoryId}
                      onChange={(e) =>
                        setParameterForm((prev) => ({
                          ...prev,
                          categoryId: e.target.value,
                        }))
                      }
                    >
                      <option value="">No Category Selected</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    isRequired
                    label="Name *"
                    placeholder="Parameter Name"
                    value={parameterForm.name}
                    onValueChange={(v) =>
                      setParameterForm((prev) => ({ ...prev, name: v }))
                    }
                  />
                  <Input
                    isRequired
                    label="Reference Range *"
                    placeholder="Reference Range"
                    value={parameterForm.referenceRange}
                    onValueChange={(v) =>
                      setParameterForm((prev) => ({ ...prev, referenceRange: v }))
                    }
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-text-muted">
                      Unit
                    </label>
                    <select
                      className="h-[32px] border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      value={parameterForm.unit}
                      onChange={(e) =>
                        setParameterForm((prev) => ({
                          ...prev,
                          unit: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select Unit</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-border-base/50 bg-surface-2 flex justify-end gap-2">
                  <Button variant="light" onClick={parameterModalState.close}>
                    Cancel
                  </Button>
                  <Button color="primary" onClick={handleSaveParameter}>
                    {isEditing ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          )
        }

        {/* Test Type Form Modal */}
        {
          testTypeModalState.isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={testTypeModalState.close}
              ></div>
              <div className="relative z-10 bg-surface border border-border-base rounded-md w-full max-w-md mx-4 overflow-visible">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2">
                  <h2 className="text-[14px] font-semibold text-text-main">
                    {isEditing
                      ? "Edit Price Configuration"
                      : "New Price Configuration"}
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-text-muted">
                      Setting Price For *
                    </label>
                    <select
                      className="h-[32px] border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      value={testTypeForm.targetType}
                      onChange={(e) =>
                        setTestTypeForm((prev) => ({
                          ...prev,
                          targetType: e.target.value as "category" | "parameter",
                          categoryId: "",
                          parameterId: "",
                        }))
                      }
                    >
                      <option value="category">Full Category Package</option>
                      <option value="parameter">
                        Individual Sub-Category (Parameter)
                      </option>
                    </select>
                  </div>

                  {testTypeForm.targetType === "category" ? (
                    <div className="z-50 relative">
                      <PathologySearchSelect
                        required
                        items={categories.map((c) => ({
                          id: c.id,
                          primary: c.name,
                        }))}
                        label="Category (e.g. CBC) *"
                        placeholder="Search and select category"
                        value={testTypeForm.categoryId}
                        onChange={(id) =>
                          setTestTypeForm((prev) => ({ ...prev, categoryId: id }))
                        }
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="z-40 relative">
                        <PathologySearchSelect
                          items={categories.map((c) => ({
                            id: c.id,
                            primary: c.name,
                          }))}
                          label="Category (Optional)"
                          placeholder="Filter parameters by category"
                          value={testTypeForm.categoryId}
                          onChange={(id) =>
                            setTestTypeForm((prev) => ({
                              ...prev,
                              categoryId: id,
                              parameterId: "",
                            }))
                          }
                        />
                      </div>
                      <div className="z-50 relative">
                        <PathologySearchSelect
                          required
                          items={parameters
                            .filter(
                              (p) =>
                                !testTypeForm.categoryId ||
                                p.categoryId === testTypeForm.categoryId,
                            )
                            .map((p) => ({
                              id: p.id,
                              primary: p.name,
                              secondary: p.referenceRange
                                ? `Range: ${p.referenceRange} `
                                : undefined,
                            }))}
                          label="Sub Category (Parameter) *"
                          placeholder="Search and select sub category"
                          value={testTypeForm.parameterId}
                          onChange={(id) =>
                            setTestTypeForm((prev) => ({
                              ...prev,
                              parameterId: id,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  <Input
                    isRequired
                    label="Price (NPR) *"
                    placeholder="0.00"
                    type="number"
                    value={testTypeForm.price}
                    onValueChange={(v) =>
                      setTestTypeForm((prev) => ({ ...prev, price: v }))
                    }
                  />
                </div>
                <div className="px-5 py-3 border-t border-border-base/50 bg-surface-2 flex justify-end gap-2">
                  <Button variant="light" onClick={testTypeModalState.close}>
                    Cancel
                  </Button>
                  <Button color="primary" onClick={handleSaveTestType}>
                    {isEditing ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          )
        }

        {/* Delete Confirmation Modal */}
        {
          deleteConfirmModalState.isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-mountain-900/40 backdrop-blur-sm"
                onClick={deleteConfirmModalState.close}
              ></div>
              <div className="relative z-10 bg-surface border border-border-base rounded-md w-full max-w-md mx-4">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2">
                  <h2 className="text-[14px] font-semibold text-text-main">
                    Confirm Delete
                  </h2>
                </div>
                <div className="p-5">
                  <p className="text-[13.5px] text-text-main">
                    Are you sure you want to delete{" "}
                    <strong>{itemToDelete?.name}</strong>? This action cannot be
                    undone.
                  </p>
                </div>
                <div className="px-5 py-3 border-t border-border-base/50 bg-surface-2 flex justify-end gap-2">
                  <Button variant="light" onClick={deleteConfirmModalState.close}>
                    Cancel
                  </Button>
                  <Button color="danger" onClick={handleDelete}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )
        }
        {/* Quick Patient Creation Modal */}
        {
          quickPatientModalState.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-mountain-900/40 backdrop-blur-sm"
                onClick={quickPatientModalState.close}
              ></div>
              <div className="relative z-10 bg-surface border border-border-base rounded-lg w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border-base/50 bg-surface-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold text-text-main">
                      Quick Create Patient
                    </h2>
                    <p className="text-[12px] text-text-muted">
                      Register a new patient to continue with the test
                    </p>
                  </div>
                  <button
                    className="p-1.5 rounded-full hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors"
                    type="button"
                    onClick={quickPatientModalState.close}
                  >
                    <IoCloseOutline className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  <Input
                    className="text-[14px]"
                    label="Full Name *"
                    placeholder="e.g. John Doe"
                    value={quickPatientForm.name}
                    onValueChange={(v) =>
                      setQuickPatientForm((prev) => ({ ...prev, name: v }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-6">
                    <Input
                      label="Age"
                      placeholder="e.g. 25"
                      type="number"
                      value={quickPatientForm.age}
                      onValueChange={(v) =>
                        setQuickPatientForm((prev) => ({ ...prev, age: v }))
                      }
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-text-muted">
                        Gender
                      </label>
                      <select
                        className="h-9 border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-sm"
                        value={quickPatientForm.gender}
                        onChange={(e) =>
                          setQuickPatientForm((prev) => ({
                            ...prev,
                            gender: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <Input
                    label="Mobile Number"
                    placeholder="e.g. +977 98XXXXXXXX"
                    value={quickPatientForm.mobile}
                    onValueChange={(v) =>
                      setQuickPatientForm((prev) => ({ ...prev, mobile: v }))
                    }
                  />
                </div>
                <div className="px-6 py-4 border-t border-border-base/50 bg-surface-2 flex justify-end gap-3">
                  <Button variant="flat" onClick={quickPatientModalState.close}>
                    Cancel
                  </Button>
                  <Button
                    className="px-8 font-medium"
                    color="primary"
                    onClick={handleSaveQuickPatient}
                  >
                    Create Patient
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        }
      </div>
    </>
  );
}

