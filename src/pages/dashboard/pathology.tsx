import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  IoAddOutline,
  IoSearchOutline,
  IoTrashOutline,
  IoArrowBackOutline,
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
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
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
            value={open ? q : selected ? selected.primary : value || ""}
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
            />
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
  const { clinicId, currentUser, userData, isClinicAdmin, isSystemOwner } =
    useAuthContext();
  const branchId = userData?.branchId || userData?.clinicId || clinicId;
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);

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
    patientType: "OPD", // Default to OPD
    sampleNumber: "",
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
        resultType: "numeric",
        options: [],
        minValue: undefined,
        maxValue: undefined,
        criticalLow: undefined,
        criticalHigh: undefined,
      } as PathologyTestParameter,
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
    parameters: [] as any[],
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
    resultType: "numeric" as any,
    options: "",
    minValue: "",
    maxValue: "",
    minValueMale: "",
    maxValueMale: "",
    minValueFemale: "",
    maxValueFemale: "",
    referenceRangeMale: "",
    referenceRangeFemale: "",
    criticalLow: "",
    criticalHigh: "",
    defaultValue: "",
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

  // Quick unit state
  const [showQuickUnit, setShowQuickUnit] = useState(false);
  const [quickUnitName, setQuickUnitName] = useState("");

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      if (!clinicId || !branchId || !userData) return;

      try {
        setLoading(true);

        const isAdmin = isClinicAdmin() || isSystemOwner();
        let doctorId: string | null = null;
        let allowedPatientIds: Set<string> | null = null;

        if (!isAdmin && userData.email) {
          try {
            const [matchingDoctor, matchingExpert] = await Promise.all([
              doctorService.getDoctorByEmail(userData.email),
              expertService.getExpertByEmail(userData.email),
            ]);
            const matchingProvider = matchingDoctor || matchingExpert;

            if (matchingProvider) {
              doctorId = matchingProvider.id;
              setCurrentDoctorId(doctorId);
              // Fetch only their patients
              const doctorPatients = await patientService.getPatientsByDoctor(
                doctorId,
                clinicId,
              );

              allowedPatientIds = new Set(doctorPatients.map((p) => p.id));
            }
          } catch (error) {
            console.error("Error checking provider linkage:", error);
          }
        }

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
          doctorId && allowedPatientIds
            ? patientService.getPatientsByDoctor(doctorId, clinicId)
            : patientService.getPatientsByClinic(clinicId, branchId),
        ]);

        let filteredTests = testsData;
        let filteredBillings = billingsData;

        if (allowedPatientIds) {
          filteredTests = testsData.filter(
            (t) => t.patientId && allowedPatientIds?.has(t.patientId),
          );
          filteredBillings = billingsData.filter(
            (b) => b.patientId && allowedPatientIds?.has(b.patientId),
          );
        }

        setTests(filteredTests);
        setCategories(categoriesData);
        setUnits(unitsData);
        setParameters(parametersData);
        setTestTypes(testTypesData);
        setLabTechnicians(techniciansData);
        setBillings(filteredBillings);
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
  }, [clinicId, branchId, userData, isClinicAdmin, isSystemOwner]);

  // Refresh billings and tests when switching to daily report tab
  useEffect(() => {
    if (activeTab === "dailyReport" && clinicId) {
      Promise.all([
        pathologyBillingService.getBillingByClinic(clinicId, branchId),
        pathologyService.getTestsByClinic(clinicId, branchId),
      ]).then(([newBillings, newTests]) => {
        if (currentDoctorId) {
          // If we are filtering by doctor, we need their patient IDs to filter these fresh fetches
          patientService
            .getPatientsByDoctor(currentDoctorId, clinicId)
            .then((doctorPatients) => {
              const allowedIds = new Set(doctorPatients.map((p) => p.id));

              setBillings(
                newBillings.filter(
                  (b) => b.patientId && allowedIds.has(b.patientId),
                ),
              );
              setTests(
                newTests.filter(
                  (t) => t.patientId && allowedIds.has(t.patientId),
                ),
              );
            });
        } else {
          setBillings(newBillings);
          setTests(newTests);
        }
      });
    }
  }, [activeTab, clinicId, branchId, currentDoctorId]);

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

  // Update parameter reference ranges when gender changes
  useEffect(() => {
    if (testForm.parameters.length > 0 && testForm.patientGender) {
      setTestForm((prev) => {
        const isMale = prev.patientGender === "male";
        const isFemale = prev.patientGender === "female";

        let hasChanges = false;
        const newParameters = prev.parameters.map((p) => {
          const op = parameters.find((param) => param.id === p.parameterId);

          if (!op) return p;

          const refRange =
            isMale && op.referenceRangeMale
              ? op.referenceRangeMale
              : isFemale && op.referenceRangeFemale
                ? op.referenceRangeFemale
                : op.referenceRange;

          const minVal =
            isMale && op.minValueMale !== undefined
              ? op.minValueMale
              : isFemale && op.minValueFemale !== undefined
                ? op.minValueFemale
                : op.minValue;

          const maxVal =
            isMale && op.maxValueMale !== undefined
              ? op.maxValueMale
              : isFemale && op.maxValueFemale !== undefined
                ? op.maxValueFemale
                : op.maxValue;

          if (
            p.referenceRange !== refRange ||
            p.minValue !== minVal ||
            p.maxValue !== maxVal
          ) {
            hasChanges = true;

            return {
              ...p,
              referenceRange: refRange,
              minValue: minVal,
              maxValue: maxVal,
            };
          }

          return p;
        });

        if (hasChanges) {
          return { ...prev, parameters: newParameters };
        }

        return prev;
      });
    }
  }, [testForm.patientGender, parameters]);

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
    const validBillings = dailyBillings.filter((b) => b.status !== "cancelled");
    const revenueBillings = validBillings.filter((b) => b.status !== "draft");

    const totalTests = dailyTests.length;
    const totalBillings = validBillings.length;

    const totalRevenue = revenueBillings.reduce(
      (sum, billing) => sum + (billing.totalAmount || 0),
      0,
    );
    const totalPaid = revenueBillings.reduce(
      (sum, billing) => sum + (billing.paidAmount || 0),
      0,
    );
    const totalPending = revenueBillings.reduce(
      (sum, billing) => sum + (billing.balanceAmount || 0),
      0,
    );

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
      patientType: "OPD",
      sampleNumber: "",
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
          resultType: "numeric",
          options: [],
          minValue: undefined,
          maxValue: undefined,
          criticalLow: undefined,
          criticalHigh: undefined,
        } as PathologyTestParameter,
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
          resultType: "numeric",
          options: [],
          minValue: undefined,
          maxValue: undefined,
          criticalLow: undefined,
          criticalHigh: undefined,
        } as PathologyTestParameter,
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
          const isMale = testForm.patientGender === "male";
          const isFemale = testForm.patientGender === "female";

          updated[index].parameterName = selectedParam.name;
          updated[index].referenceRange =
            isMale && selectedParam.referenceRangeMale
              ? selectedParam.referenceRangeMale
              : isFemale && selectedParam.referenceRangeFemale
                ? selectedParam.referenceRangeFemale
                : selectedParam.referenceRange;

          updated[index].resultType = selectedParam.resultType;
          updated[index].options = selectedParam.options;

          updated[index].minValue =
            isMale && selectedParam.minValueMale !== undefined
              ? selectedParam.minValueMale
              : isFemale && selectedParam.minValueFemale !== undefined
                ? selectedParam.minValueFemale
                : selectedParam.minValue;

          updated[index].maxValue =
            isMale && selectedParam.maxValueMale !== undefined
              ? selectedParam.maxValueMale
              : isFemale && selectedParam.maxValueFemale !== undefined
                ? selectedParam.maxValueFemale
                : selectedParam.maxValue;

          updated[index].criticalLow = selectedParam.criticalLow;
          updated[index].criticalHigh = selectedParam.criticalHigh;
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

  const getResultFlag = (param: any, result: string) => {
    if (!result || param.resultType !== "numeric") return null;
    const val = parseFloat(result);

    if (isNaN(val)) return null;

    if (param.criticalLow !== undefined && val <= param.criticalLow)
      return { label: "CRITICAL LOW", color: "danger", icon: "!!" };
    if (param.criticalHigh !== undefined && val >= param.criticalHigh)
      return { label: "CRITICAL HIGH", color: "danger", icon: "!!" };
    if (param.minValue !== undefined && val < param.minValue)
      return { label: "LOW", color: "warning", icon: "↓" };
    if (param.maxValue !== undefined && val > param.maxValue)
      return { label: "HIGH", color: "warning", icon: "↑" };

    return { label: "NORMAL", color: "success", icon: "✓" };
  };

  // Normalization helper to ensure numeric ages have units
  const normalizeAge = (age: string): string => {
    if (!age) return "";
    const trimmed = age.trim();

    if (/^\d+$/.test(trimmed)) return `${trimmed} Years`;

    return trimmed;
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
      // ── Uniqueness Checks ──────────────────────────────────────────────────
      const [mobileExists] = await Promise.all([
        patientService.checkMobileExists(quickPatientForm.mobile, clinicId!),
      ]);

      if (
        mobileExists &&
        quickPatientForm.mobile &&
        quickPatientForm.mobile !== "N/A"
      ) {
        addToast({
          title: "Duplicate Mobile",
          description: "A patient with this mobile number already exists.",
          color: "danger",
        });
        setLoading(false);

        return;
      }

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
        patientData.age = normalizeAge(quickPatientForm.age);

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
        // ── Uniqueness Checks ──────────────────────────────────────────────────
        const [mobileExists] = await Promise.all([
          patientService.checkMobileExists(testForm.walkInPhone, clinicId!),
        ]);

        if (
          mobileExists &&
          testForm.walkInPhone &&
          testForm.walkInPhone !== "N/A"
        ) {
          addToast({
            title: "Duplicate Mobile",
            description: "A patient with this mobile number already exists.",
            color: "danger",
          });

          return;
        }

        const patientData = {
          name: testForm.patientName,
          mobile: testForm.walkInPhone || "N/A",
          age: normalizeAge(testForm.patientAge) || undefined,
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
          ? normalizeAge(testForm.patientAge)
          : undefined,
        patientGender:
          (testForm.patientGender as "male" | "female" | "other") || "other",
        patientType: testForm.patientType,
        sampleNumber: testForm.sampleNumber,
        testName: testForm.testType || testForm.shortName || "Unknown Test",
        categoryName: testForm.categoryId
          ? testForm.categoryId
              .split(", ")
              .map(
                (id) =>
                  categories.find((c) => c.id === id.trim())?.name || id.trim(),
              )
              .join(", ")
          : "Unknown Category",
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
        labTechnicianName:
          labTechnicians.find((lt) => lt.id === testForm.labTechnicianId)
            ?.name || "",
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
      patientType: test.patientType || "OPD",
      sampleNumber: test.sampleNumber || "",
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

  const handleRecordResultsFromBilling = (billing: PathologyBilling) => {
    resetTestForm();

    // 1. Resolve Patient ID or Fallback to Name Search
    let finalPatientId = billing.patientId || "";

    // Safety: If the patientId is not in our current patients list, treat as walk-in to ensure name shows
    const isPatientInList = patients.some((p) => p.id === finalPatientId);
    let finalIsWalkIn = !finalPatientId || !isPatientInList;

    if (!finalPatientId || !isPatientInList) {
      // Fallback: Try to find a matching patient in the system by name + phone
      const match = patients.find(
        (p) =>
          p.name.toLowerCase() === billing.patientName.toLowerCase() &&
          (p.mobile === billing.patientPhone ||
            p.phone === billing.patientPhone),
      );

      if (match) {
        finalPatientId = match.id;
        finalIsWalkIn = false;
      }
    }

    // 2. Aggregate parameters for ALL tests in the invoice
    const allParameters: any[] = [];
    const testNames: string[] = [];
    const testTypeNames: string[] = [];
    let totalCharge = 0;

    billing.items.forEach((item) => {
      if (item.testName) {
        testNames.push(item.testName);
        if (item.testType) testTypeNames.push(item.testType);
        totalCharge += item.amount || 0;

        // Find category to load its specific parameters
        const category = categories.find(
          (c) => c.name.toLowerCase() === item.testName.toLowerCase(),
        );

        if (category) {
          const catParams = parameters.filter(
            (p) => p.categoryId === category.id,
          );

          allParameters.push(
            ...catParams.map((p) => {
              const isMale = billing.patientGender === "male";
              const isFemale = billing.patientGender === "female";

              const refRange =
                isMale && p.referenceRangeMale
                  ? p.referenceRangeMale
                  : isFemale && p.referenceRangeFemale
                    ? p.referenceRangeFemale
                    : p.referenceRange;

              const minVal =
                isMale && p.minValueMale !== undefined
                  ? p.minValueMale
                  : isFemale && p.minValueFemale !== undefined
                    ? p.minValueFemale
                    : p.minValue;

              const maxVal =
                isMale && p.maxValueMale !== undefined
                  ? p.maxValueMale
                  : isFemale && p.maxValueFemale !== undefined
                    ? p.maxValueFemale
                    : p.maxValue;

              return {
                parameterId: p.id,
                parameterName: p.name,
                categoryId: p.categoryId || "",
                patientResult: p.defaultValue || "",
                referenceRange: refRange,
                unit: units.find((u) => u.id === p.unit)?.name || p.unit || "",
                // Include meta for validation/UI
                resultType: p.resultType,
                options: p.options,
                minValue: minVal,
                maxValue: maxVal,
                criticalLow: p.criticalLow,
                criticalHigh: p.criticalHigh,
              };
            }),
          );
        }
      }
    });

    // 3. Set Form State
    setTestForm((prev) => ({
      ...prev,
      isWalkIn: finalIsWalkIn,
      patientId: finalPatientId,
      patientName: billing.patientName,
      patientAge: billing.patientAge?.toString() || "",
      patientGender: billing.patientGender || "",
      testName: testNames.join(", "),
      testType:
        testTypeNames.length > 0
          ? testTypeNames.join(", ")
          : testNames.join(", "),
      parameters: allParameters,
      standardCharge: totalCharge.toString(),
      // Join category names for display in the SearchSelect
      categoryId: testNames.join(", "),
      categoryName: testNames.join(", "),
    }));

    setActiveTab("tests");
    testModalState.open();
  };

  // Category handlers
  const resetCategoryForm = () => {
    setCategoryForm({ id: "", name: "", parameters: [] });
    setIsEditing(false);
  };

  const addCategoryParameter = () => {
    setCategoryForm((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        {
          name: "",
          referenceRange: "",
          unit: "",
          resultType: "numeric",
          options: "",
          minValue: "",
          maxValue: "",
          criticalLow: "",
          criticalHigh: "",
          defaultValue: "",
        },
      ],
    }));
  };

  const removeCategoryParameter = (index: number) => {
    setCategoryForm((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  };

  const updateCategoryParameter = (
    index: number,
    field: string,
    value: any,
  ) => {
    setCategoryForm((prev) => {
      const updated = [...prev.parameters];
      let newValues = { [field]: value };

      // Smart Sync: Parse range string if field is referenceRange
      if (field === "referenceRange" && value) {
        const regex = /([\d.]+)\s*(?:-|to)\s*([\d.]+)/i;
        const match = value.match(regex);

        if (match) {
          newValues = {
            ...newValues,
            minValue: match[1],
            maxValue: match[2],
          };
        }
      }

      updated[index] = { ...updated[index], ...newValues };

      return { ...prev, parameters: updated };
    });
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
        const categoryId = await pathologyService.createCategory(categoryData);

        // Create parameters if any
        if (categoryForm.parameters.length > 0) {
          await Promise.all(
            categoryForm.parameters.map((param) => {
              const parameterData: Omit<
                PathologyParameter,
                "id" | "createdAt" | "updatedAt"
              > = {
                name: param.name.trim(),
                categoryId: categoryId,
                referenceRange: param.referenceRange.trim(),
                unit: param.unit,
                resultType: param.resultType,
                options: param.options
                  ? param.options.split(",").map((o: string) => o.trim())
                  : undefined,
                minValue: param.minValue
                  ? parseFloat(param.minValue)
                  : undefined,
                maxValue: param.maxValue
                  ? parseFloat(param.maxValue)
                  : undefined,
                criticalLow: param.criticalLow
                  ? parseFloat(param.criticalLow)
                  : undefined,
                criticalHigh: param.criticalHigh
                  ? parseFloat(param.criticalHigh)
                  : undefined,
                defaultValue: param.defaultValue || undefined,
                clinicId: clinicId!,
                branchId: branchId!,
                isActive: true,
                createdBy: currentUser?.uid || "",
              };

              return pathologyService.createParameter(parameterData);
            }),
          );
        }

        addToast({
          title: "Success",
          description: `Category and ${categoryForm.parameters.length} parameters created successfully`,
          color: "success",
        });
      }

      // Refresh both
      const [categoriesData, parametersData] = await Promise.all([
        pathologyService.getCategoriesByClinic(clinicId!, branchId!),
        pathologyService.getParametersByClinic(clinicId!, branchId!),
      ]);

      setCategories(categoriesData);
      setParameters(parametersData);

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
    setCategoryForm({ id: category.id, name: category.name, parameters: [] });
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

  const handleQuickUnitSave = async () => {
    if (!quickUnitName.trim()) return;

    try {
      // Check if a unit with the same name already exists (case-insensitive)
      const existing = units.find(
        (u) =>
          u.name.toLowerCase().trim() === quickUnitName.toLowerCase().trim(),
      );

      if (existing) {
        // Reuse the existing unit instead of creating a duplicate
        if (parameterModalState.isOpen) {
          setParameterForm((prev) => ({ ...prev, unit: existing.id }));
        }
        setQuickUnitName("");
        setShowQuickUnit(false);
        addToast({
          title: "Unit already exists",
          description: `"${existing.name}" has been selected`,
          color: "default",
        });

        return existing.id;
      }

      const unitData: Omit<PathologyUnit, "id" | "createdAt" | "updatedAt"> = {
        name: quickUnitName.trim(),
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      const newUnitId = await pathologyService.createUnit(unitData);

      const unitsData = await pathologyService.getUnitsByClinic(
        clinicId!,
        branchId!,
      );

      setUnits(unitsData);

      // Auto-select the new unit in the parameter form if that's what's open
      if (parameterModalState.isOpen) {
        setParameterForm((prev) => ({ ...prev, unit: newUnitId }));
      }

      setQuickUnitName("");
      setShowQuickUnit(false);

      addToast({
        title: "Success",
        description: "Unit added successfully",
        color: "success",
      });

      return newUnitId;
    } catch (error) {
      console.error("Error quick saving unit:", error);
      addToast({
        title: "Error",
        description: "Failed to add unit",
        color: "danger",
      });

      return null;
    }
  };

  // Parameter handlers
  const resetParameterForm = () => {
    setParameterForm({
      id: "",
      categoryId: "",
      name: "",
      referenceRange: "",
      unit: "",
      resultType: "numeric",
      options: "",
      minValue: "",
      maxValue: "",
      minValueMale: "",
      maxValueMale: "",
      minValueFemale: "",
      maxValueFemale: "",
      referenceRangeMale: "",
      referenceRangeFemale: "",
      criticalLow: "",
      criticalHigh: "",
      defaultValue: "",
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
        resultType: parameterForm.resultType,
        options: parameterForm.options
          ? parameterForm.options.split(",").map((o) => o.trim())
          : undefined,
        minValue: parameterForm.minValue
          ? parseFloat(parameterForm.minValue)
          : undefined,
        maxValue: parameterForm.maxValue
          ? parseFloat(parameterForm.maxValue)
          : undefined,
        minValueMale: parameterForm.minValueMale
          ? parseFloat(parameterForm.minValueMale)
          : undefined,
        maxValueMale: parameterForm.maxValueMale
          ? parseFloat(parameterForm.maxValueMale)
          : undefined,
        minValueFemale: parameterForm.minValueFemale
          ? parseFloat(parameterForm.minValueFemale)
          : undefined,
        maxValueFemale: parameterForm.maxValueFemale
          ? parseFloat(parameterForm.maxValueFemale)
          : undefined,
        referenceRangeMale:
          parameterForm.referenceRangeMale?.trim() || undefined,
        referenceRangeFemale:
          parameterForm.referenceRangeFemale?.trim() || undefined,
        criticalLow: parameterForm.criticalLow
          ? parseFloat(parameterForm.criticalLow)
          : undefined,
        criticalHigh: parameterForm.criticalHigh
          ? parseFloat(parameterForm.criticalHigh)
          : undefined,
        defaultValue: parameterForm.defaultValue || undefined,
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
      resultType: parameter.resultType || "numeric",
      options: parameter.options?.join(", ") || "",
      minValue: parameter.minValue?.toString() || "",
      maxValue: parameter.maxValue?.toString() || "",
      minValueMale: parameter.minValueMale?.toString() || "",
      maxValueMale: parameter.maxValueMale?.toString() || "",
      minValueFemale: parameter.minValueFemale?.toString() || "",
      maxValueFemale: parameter.maxValueFemale?.toString() || "",
      referenceRangeMale: parameter.referenceRangeMale || "",
      referenceRangeFemale: parameter.referenceRangeFemale || "",
      criticalLow: parameter.criticalLow?.toString() || "",
      criticalHigh: parameter.criticalHigh?.toString() || "",
      defaultValue: parameter.defaultValue || "",
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
    options?: { hideLetterhead?: boolean; categories?: PathologyCategory[] },
  ) => {
    const hideLetterhead = options?.hideLetterhead ?? false;

    const configuredTopMargin =
      layoutConfig?.contentTopMarginWithoutLetterheadMm;
    const topMarginMm = hideLetterhead
      ? typeof configuredTopMargin === "number" &&
        !Number.isNaN(configuredTopMargin)
        ? configuredTopMargin
        : 10
      : 10;

    // Group parameters by category
    const groupedParameters: {
      [key: string]: { name: string; params: PathologyTestParameter[] };
    } = {};

    test.parameters?.forEach((param) => {
      const catId = param.categoryId || "general";

      if (!groupedParameters[catId]) {
        const cat = options?.categories?.find((c) => c.id === catId);

        groupedParameters[catId] = {
          name:
            cat?.name ||
            (catId === "general"
              ? "General Parameters"
              : "Other Investigation"),
          params: [],
        };
      }
      groupedParameters[catId].params.push(param);
    });

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

    const infofields = [
      { label: "Patient Name", value: test.patientName },
      { label: "Patient ID", value: test.patientId || "WALK-IN" },
      {
        label: "Age / Gender",
        value: `${test.patientAge ? test.patientAge : ""} / ${test.patientGender ? test.patientGender.charAt(0).toUpperCase() + test.patientGender.slice(1) : ""}`,
      },
      { label: "Patient Type", value: test.patientType || "OPD" },
      { label: "Investigation", value: test.testName },
      { label: "Sample Number", value: test.sampleNumber },
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

    const reportsHtml = Object.values(groupedParameters)
      .map((group, index, arr) => {
        const rows = group.params
          .map((param) => {
            let flagLabel = "";
            let flagClass = "";
            let flagIcon = "";

            // Robust Value Parsing (Handle commas in numbers like 1,000)
            const resultVal = param.patientResult
              ? parseFloat(
                  param.patientResult
                    .toString()
                    .replace(/,/g, "")
                    .replace(/[^0-9.]/g, ""),
                )
              : NaN;

            if (!isNaN(resultVal)) {
              // Attempt to get bounds from explicit fields or parse from referenceRange string
              let min =
                param.minValue !== undefined && param.minValue !== null
                  ? Number(param.minValue)
                  : NaN;
              let max =
                param.maxValue !== undefined && param.maxValue !== null
                  ? Number(param.maxValue)
                  : NaN;

              // Fail-safe: Smart Contextual Parsing from referenceRange text
              if (isNaN(min) || isNaN(max)) {
                const rangeText = (param.referenceRange || "").replace(
                  /,/g,
                  "",
                );

                // 1. Check for explicit Label-based thresholds (e.g., "Low: < 40", "High: > 60")
                const lowMatch = rangeText.match(
                  /low:?\s*(?:<|>)?\s*([\d.]+)/i,
                );
                const highMatch = rangeText.match(
                  /high:?\s*(?:<|>)?\s*([\d.]+)/i,
                );

                if (lowMatch && isNaN(min)) min = parseFloat(lowMatch[1]);
                if (highMatch && isNaN(max)) max = parseFloat(highMatch[1]);

                // 2. Fallback to standard range parsing if still missing
                if (isNaN(min) || isNaN(max)) {
                  // Standard "X - Y"
                  const rangeMatch = rangeText.match(
                    /([\d.]+)\s*(?:-|to)\s*([\d.]+)/,
                  );

                  if (rangeMatch) {
                    if (isNaN(min)) min = parseFloat(rangeMatch[1]);
                    if (isNaN(max)) max = parseFloat(rangeMatch[2]);
                  }

                  // Only apply general < or > if we didn't find specific labels
                  if (isNaN(max) && !highMatch) {
                    const maxOnly = rangeText.match(/<\s*([\d.]+)/);

                    if (maxOnly) max = parseFloat(maxOnly[1]);
                  }
                  if (isNaN(min) && !lowMatch) {
                    const minOnly = rangeText.match(/>\s*([\d.]+)/);

                    if (minOnly) min = parseFloat(minOnly[1]);
                  }
                }
              }

              // Flagging Logic
              const cLow =
                param.criticalLow !== undefined && param.criticalLow !== null
                  ? Number(param.criticalLow)
                  : NaN;
              const cHigh =
                param.criticalHigh !== undefined && param.criticalHigh !== null
                  ? Number(param.criticalHigh)
                  : NaN;

              if (!isNaN(cLow) && resultVal <= cLow) {
                flagLabel = "CRITICAL LOW";
                flagClass = "flag-critical";
                flagIcon = "!!";
              } else if (!isNaN(cHigh) && resultVal >= cHigh) {
                flagLabel = "CRITICAL HIGH";
                flagClass = "flag-critical";
                flagIcon = "!!";
              } else if (!isNaN(min) && resultVal < min) {
                flagLabel = "LOW";
                flagClass = "flag-low";
                flagIcon = "↓";
              } else if (!isNaN(max) && resultVal > max) {
                flagLabel = "HIGH";
                flagClass = "flag-high";
                flagIcon = "↑";
              } else {
                flagLabel = "NORMAL";
                flagClass = "flag-normal";
                flagIcon = "✓";
              }
            }

            const flagHtml = flagLabel
              ? `<span class="flag ${flagClass}">${flagIcon} ${flagLabel}</span>`
              : "";
            const isAbnormal = flagLabel && flagLabel !== "NORMAL";

            return `
          <tr class="parameter-row ${isAbnormal ? "row-abnormal" : ""}">
            <td style="font-weight: 500;">${param.parameterName}</td>
            <td class="result-cell" style="font-weight: ${isAbnormal ? "700" : "400"};">
              ${param.patientResult}
            </td>
            <td style="text-align: center;">${flagHtml}</td>
            <td style="font-size: 11px; color: #111827;">${param.referenceRange}</td>
            <td class="unit-cell">${param.unit}</td>
          </tr>
        `;
          })
          .join("");

        const isLast = index === arr.length - 1;

        return `
        <div class="report-page" style="${!isLast ? "page-break-after: always;" : ""}">
          <div class="print-container">
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
                <table class="parameters-table">
                  <thead class="parameters-header">
                    <tr class="category-header-row">
                      <th colspan="5" class="category-title">${group.name}</th>
                    </tr>
                    <tr class="column-header-row">
                      <th style="width: 25%;">Parameter</th>
                      <th style="width: 10%;">Result</th>
                      <th style="width: 13%; text-align: center;">Flag</th>
                      <th style="width: 40%;">Reference Range</th>
                      <th style="width: 12%;">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
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
                  ${test.labTechnicianName ? `<p style="margin:0; font-weight:700; font-size:13px; color:#000000;">${test.labTechnicianName}</p><p style="margin:0; font-size:11px; color:#111827; margin-bottom:8px;">Lab Technician</p>` : ""}
                  <div class="sign-line">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig) : "";
    const headerHtml = hideLetterhead
      ? ""
      : clinic && layoutConfig
        ? getPrintHeaderHTML(layoutConfig, clinic)
        : "";
    const footerHtml = hideLetterhead
      ? ""
      : layoutConfig
        ? getPrintFooterHTML(layoutConfig)
        : "";
    const headerHeight =
      layoutConfig?.headerHeight === "compact"
        ? 140
        : layoutConfig?.headerHeight === "expanded"
          ? 220
          : 180;

    return `<!DOCTYPE html>
  <html>
    <head>
      <title>Pathology Report - ${test.patientName}</title>
      <style>
        @page { margin: 0; size: A4; }
        ${brandingCSS}
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
        .header-fixed { position: fixed; top: 0; width: 100%; z-index: 1000; background: white; }
        .footer-fixed { position: fixed; bottom: 0; width: 100%; z-index: 1000; background: white; }
        .report-table { width: 100%; border-collapse: collapse; }
        .header-spacer { height: ${headerHtml ? `${headerHeight}px` : `${topMarginMm}mm`}; }
        .footer-spacer { height: ${footerHtml ? 60 : 20}px; }
        .report-page { width: 100%; page-break-after: always; }
        .report-page:last-child { page-break-after: auto; }
        .print-container { width: 100%; padding: 0 4mm; box-sizing: border-box; display: flex; flex-direction: column; }
        .content { padding: 0; width: 100%; }
        
        .document-title { text-align: center; margin: 4px 0 8px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 4px 0; }
        .document-title h2 { font-size: 14px; font-weight: 500; margin: 0; text-transform: uppercase; letter-spacing: 0.12em; color: #000000; }
        
        .section { margin-bottom: 10px; }
        .section-header { font-size: 10px; font-weight: 500; color: #111827; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 30px; margin-bottom: 10px; background: #f8fafc; padding: 8px 12px; border-radius: 4px; border: 1px solid #f1f5f9; }
        .info-item { display: flex; justify-content: space-between; font-size: 10.5px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 2px; }
        .info-label { font-weight: 400; color: #111827; }
        .info-value { font-weight: 500; color: #000000; text-align: right; }
        
        .flag { 
          font-weight: 700; 
          font-size: 8px; 
          padding: 2px 5px; 
          border-radius: 2px; 
          display: inline-block; 
          vertical-align: middle; 
          text-transform: uppercase;
          border: 1px solid #cbd5e1;
          color: #000000;
          background: #ffffff;
        }
        .flag-high, .flag-low, .flag-critical, .flag-normal { 
          color: #000000;
        }
        .flag-normal { 
          border-color: #e2e8f0; 
          color: #374151; 
          font-weight: 600;
        }
        .flag-critical { border-width: 2px; }
        
        .row-abnormal { background: transparent; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }
        
        table.parameters-table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
        th { 
          background: #f8fafc !important; 
          color: #111827; 
          font-weight: 600; 
          text-align: left; 
          padding: 6px 10px; 
          border: 1px solid #cbd5e1; 
          font-size: 9.5px; 
          text-transform: uppercase; 
          letter-spacing: 0.05em; 
        }
        td { 
          padding: 6px 10px; 
          border: 1px solid #cbd5e1; 
          font-size: 11.5px; 
          color: #000000; 
          vertical-align: middle;
        }
        .category-header-row th { background: #f1f5f9 !important; padding: 8px 10px !important; }
        .category-title { font-weight: 700; color: #000000; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; }
        .result-cell { font-size: 12.5px; }
        .unit-cell { color: #111827; font-weight: 500; }
        .font-bold { font-weight: 700; }
        .footer-section { margin-top: 20px; padding: 0; }
        .signature-block { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; break-inside: avoid; }
        .technician-info { text-align: right; }
        .sign-line { width: 180px; border-top: 1px solid #000000; margin-top: 25px; padding-top: 6px; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #111827; text-align: center; }
        .meta-text { font-size: 10px; color: #374151; margin: 2px 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .print-container { padding: 0 4mm; width: 100%; }
          .info-grid { background: #f8fafc !important; border: 1px solid #f1f5f9 !important; }
          .parameters-table th { background: #f8fafc !important; }
          .category-header-row th { background: #f1f5f9 !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      </style>
    </head>
    <body>
      <div class="header-fixed">${headerHtml}</div>
      <div class="footer-fixed">${footerHtml}</div>
      <table class="report-table">
        <thead><tr><td><div class="header-spacer"></div></td></tr></thead>
        <tbody><tr><td>${reportsHtml}</td></tr></tbody>
        <tfoot><tr><td><div class="footer-spacer"></div></td></tr></tfoot>
      </table>

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
                <div class="card-value">NPR ${Math.round(reportData.totalRevenue).toLocaleString()}</div>
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
                    <td class="text-right">${new Date(test.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
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
                    <td class="text-right font-bold">${Math.round(billing.totalAmount).toLocaleString()}</td>
                    <td class="text-right">${billing.status.toUpperCase()}</td>
                    <td class="text-right">${new Date(billing.invoiceDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
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
      categories,
    });

    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

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

  // Restrict administrative pathology tabs for clinical staff (doctors & experts)
  const isClinicalStaff =
    userData?.role === "doctor" || userData?.role === "expert";

  if (isClinicalStaff) {
    delete tabLabels.billing;
    delete tabLabels.dailyReport;
  }

  const unpaidBillingsCount = billings.filter(
    (b) =>
      b.status === "draft" ||
      (b.balanceAmount > 0 && b.status !== "cancelled" && b.status !== "paid"),
  ).length;

  const seedHIVTest = async () => {
    if (!clinicId || !branchId) return;
    setSeeding(true);
    try {
      // 1. Check if category already exists
      let categoryId = categories.find(
        (c) => c.name.toLowerCase() === "hiv screening",
      )?.id;

      if (!categoryId) {
        categoryId = await pathologyService.createCategory({
          name: "HIV Screening",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      // 2. Seed parameters
      const params = [
        {
          name: "Anti-HIV 1 & 2 (Ab)",
          referenceRange: "Non-Reactive",
          resultType: "boolean" as const,
          unit: "",
          minValue: undefined,
          maxValue: undefined,
          criticalLow: undefined,
          criticalHigh: undefined,
        },
        {
          name: "p24 Antigen",
          referenceRange: "Non-Reactive",
          resultType: "boolean" as const,
          unit: "",
          minValue: undefined,
          maxValue: undefined,
          criticalLow: undefined,
          criticalHigh: undefined,
        },
        {
          name: "CD4 Count",
          referenceRange: "500 - 1500",
          resultType: "numeric" as const,
          unit: "cells/μL",
          minValue: 500,
          maxValue: 1500,
          criticalLow: 200,
          criticalHigh: undefined,
        },
        {
          name: "CD8 Count",
          referenceRange: "150 - 1000",
          resultType: "numeric" as const,
          unit: "cells/μL",
          minValue: 150,
          maxValue: 1000,
          criticalLow: undefined,
          criticalHigh: undefined,
        },
        {
          name: "CD4/CD8 Ratio",
          referenceRange: "1.0 - 3.5",
          resultType: "numeric" as const,
          unit: "",
          minValue: 1.0,
          maxValue: 3.5,
          criticalLow: 0.5,
          criticalHigh: undefined,
        },
        {
          name: "HIV Viral Load",
          referenceRange: "<20",
          resultType: "numeric" as const,
          unit: "copies/mL",
          minValue: 0,
          maxValue: 20,
          criticalLow: undefined,
          criticalHigh: 100000,
        },
      ];

      // Find or create the unit "cells/μL"
      let cellUnit = units.find((u) => u.name.toLowerCase() === "cells/μl");
      let cellUnitId = cellUnit?.id;

      if (!cellUnitId) {
        cellUnitId = await pathologyService.createUnit({
          name: "cells/μL",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      let copiesUnit = units.find((u) => u.name.toLowerCase() === "copies/ml");
      let copiesUnitId = copiesUnit?.id;

      if (!copiesUnitId) {
        copiesUnitId = await pathologyService.createUnit({
          name: "copies/mL",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      const existingParams = parameters.filter(
        (p) => p.categoryId === categoryId,
      );

      await Promise.all(
        params.map((p) => {
          const alreadyExists = existingParams.some(
            (ep) => ep.name.toLowerCase() === p.name.toLowerCase(),
          );

          if (alreadyExists) return Promise.resolve();

          return pathologyService.createParameter({
            name: p.name,
            categoryId: categoryId!,
            referenceRange: p.referenceRange,
            resultType: p.resultType,
            options: (p as any).options,
            unit:
              p.unit === "cells/μL"
                ? cellUnitId!
                : p.unit === "copies/mL"
                  ? copiesUnitId!
                  : "",
            minValue: p.minValue,
            maxValue: p.maxValue,
            criticalLow: p.criticalLow,
            criticalHigh: p.criticalHigh,
            clinicId: clinicId!,
            branchId: branchId!,
            isActive: true,
            createdBy: currentUser?.uid || "",
          });
        }),
      );

      // Refresh
      const [cats, params2, units2] = await Promise.all([
        pathologyService.getCategoriesByClinic(clinicId!, branchId!),
        pathologyService.getParametersByClinic(clinicId!, branchId!),
        pathologyService.getUnitsByClinic(clinicId!, branchId!),
      ]);

      setCategories(cats);
      setParameters(params2);
      setUnits(units2);

      setSeeded(true);
      addToast({
        title: "HIV Screening seeded",
        description: "Category and 6 parameters created successfully.",
        color: "success",
      });
    } catch (e) {
      console.error(e);
      addToast({
        title: "Seed failed",
        description: String(e),
        color: "danger",
      });
    } finally {
      setSeeding(false);
    }
  };

  const seedSugarTest = async () => {
    if (!clinicId || !branchId) return;
    setSeeding(true);
    try {
      let categoryId = categories.find(
        (c) => c.name.toLowerCase() === "sugar & diabetes",
      )?.id;

      if (!categoryId) {
        categoryId = await pathologyService.createCategory({
          name: "Sugar & Diabetes",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      const params = [
        {
          name: "Glucose (Fasting)",
          referenceRange: "70 - 100",
          resultType: "numeric" as const,
          unit: "mg/dL",
          minValue: 70,
          maxValue: 100,
          criticalLow: 50,
          criticalHigh: 400,
        },
        {
          name: "Glucose (Post Prandial / PP)",
          referenceRange: "70 - 140",
          resultType: "numeric" as const,
          unit: "mg/dL",
          minValue: 70,
          maxValue: 140,
          criticalLow: 50,
          criticalHigh: 400,
        },
        {
          name: "Glucose (Random)",
          referenceRange: "70 - 140",
          resultType: "numeric" as const,
          unit: "mg/dL",
          minValue: 70,
          maxValue: 140,
          criticalLow: 50,
          criticalHigh: 400,
        },
        {
          name: "HbA1c (Glycated Hemoglobin)",
          referenceRange: "4.0 - 5.6",
          resultType: "numeric" as const,
          unit: "%",
          minValue: 4.0,
          maxValue: 5.6,
          criticalLow: undefined,
          criticalHigh: 15,
        },
      ];

      // Units
      let mgDlUnit = units.find((u) => u.name.toLowerCase() === "mg/dl");
      let mgDlUnitId = mgDlUnit?.id;

      if (!mgDlUnitId) {
        mgDlUnitId = await pathologyService.createUnit({
          name: "mg/dL",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      let percentUnit = units.find((u) => u.name === "%");
      let percentUnitId = percentUnit?.id;

      if (!percentUnitId) {
        percentUnitId = await pathologyService.createUnit({
          name: "%",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      const existingParams = parameters.filter(
        (p) => p.categoryId === categoryId,
      );

      await Promise.all(
        params.map((p) => {
          const alreadyExists = existingParams.some(
            (ep) => ep.name.toLowerCase() === p.name.toLowerCase(),
          );

          if (alreadyExists) return Promise.resolve();

          return pathologyService.createParameter({
            name: p.name,
            categoryId: categoryId!,
            referenceRange: p.referenceRange,
            resultType: p.resultType,
            unit: p.unit === "mg/dL" ? mgDlUnitId! : percentUnitId!,
            minValue: p.minValue,
            maxValue: p.maxValue,
            criticalLow: p.criticalLow,
            criticalHigh: p.criticalHigh,
            clinicId: clinicId!,
            branchId: branchId!,
            isActive: true,
            createdBy: currentUser?.uid || "",
          });
        }),
      );

      const [cats, params2, units2] = await Promise.all([
        pathologyService.getCategoriesByClinic(clinicId!, branchId!),
        pathologyService.getParametersByClinic(clinicId!, branchId!),
        pathologyService.getUnitsByClinic(clinicId!, branchId!),
      ]);

      setCategories(cats);
      setParameters(params2);
      setUnits(units2);

      addToast({
        title: "Sugar Test seeded",
        description: "Category and 4 parameters created successfully.",
        color: "success",
      });
    } catch (e) {
      console.error(e);
      addToast({
        title: "Seed failed",
        description: String(e),
        color: "danger",
      });
    } finally {
      setSeeding(false);
    }
  };

  const seedCBC = async () => {
    if (!clinicId || !branchId) return;
    setSeeding(true);
    try {
      let categoryId = categories.find(
        (c) =>
          c.name.toLowerCase().includes("cbc") ||
          c.name.toLowerCase().includes("complete blood count"),
      )?.id;

      if (!categoryId) {
        categoryId = await pathologyService.createCategory({
          name: "Complete Blood Count (CBC)",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      // Ensure units exist
      const requiredUnits = ["g/dL", "million/cmm", "/cmm", "%", "fL", "pg"];
      const unitMap: Record<string, string> = {};

      for (const uName of requiredUnits) {
        let u = units.find((unit) => unit.name === uName);

        if (u) {
          unitMap[uName] = u.id;
        } else {
          const id = await pathologyService.createUnit({
            name: uName,
            clinicId: clinicId!,
            branchId: branchId!,
            isActive: true,
            createdBy: currentUser?.uid || "",
          });

          unitMap[uName] = id;
        }
      }

      const params = [
        {
          name: "Hemoglobin (Hb)",
          referenceRange: "12.0 - 17.5",
          referenceRangeMale: "13.5 - 17.5",
          referenceRangeFemale: "12.0 - 15.5",
          unit: unitMap["g/dL"],
          resultType: "numeric" as const,
          minValue: 12.0,
          maxValue: 17.5,
          minValueMale: 13.5,
          maxValueMale: 17.5,
          minValueFemale: 12.0,
          maxValueFemale: 15.5,
          criticalLow: 7.0,
          criticalHigh: 20.0,
        },
        {
          name: "Total Leucocyte Count (TLC/WBC)",
          referenceRange: "4000 - 11000",
          unit: unitMap["/cmm"],
          resultType: "numeric" as const,
          minValue: 4000,
          maxValue: 11000,
          criticalLow: 2000,
          criticalHigh: 30000,
        },
        {
          name: "Red Blood Cell (RBC) Count",
          referenceRange: "3.8 - 5.5",
          referenceRangeMale: "4.5 - 5.5",
          referenceRangeFemale: "3.8 - 4.8",
          unit: unitMap["million/cmm"],
          resultType: "numeric" as const,
          minValue: 3.8,
          maxValue: 5.5,
          minValueMale: 4.5,
          maxValueMale: 5.5,
          minValueFemale: 3.8,
          maxValueFemale: 4.8,
        },
        {
          name: "Platelet Count",
          referenceRange: "150000 - 450000",
          unit: unitMap["/cmm"],
          resultType: "numeric" as const,
          minValue: 150000,
          maxValue: 450000,
          criticalLow: 50000,
          criticalHigh: 1000000,
        },
        {
          name: "Packed Cell Volume (PCV/Hematocrit)",
          referenceRange: "36 - 50",
          referenceRangeMale: "40 - 50",
          referenceRangeFemale: "36 - 46",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 36,
          maxValue: 50,
          minValueMale: 40,
          maxValueMale: 50,
          minValueFemale: 36,
          maxValueFemale: 46,
        },
        {
          name: "MCV",
          referenceRange: "80 - 100",
          unit: unitMap["fL"],
          resultType: "numeric" as const,
          minValue: 80,
          maxValue: 100,
        },
        {
          name: "MCH",
          referenceRange: "27 - 32",
          unit: unitMap["pg"],
          resultType: "numeric" as const,
          minValue: 27,
          maxValue: 32,
        },
        {
          name: "MCHC",
          referenceRange: "32 - 36",
          unit: unitMap["g/dL"],
          resultType: "numeric" as const,
          minValue: 32,
          maxValue: 36,
        },
        {
          name: "Neutrophils",
          referenceRange: "40 - 75",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 40,
          maxValue: 75,
        },
        {
          name: "Lymphocytes",
          referenceRange: "20 - 45",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 20,
          maxValue: 45,
        },
        {
          name: "Monocytes",
          referenceRange: "2 - 10",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 2,
          maxValue: 10,
        },
        {
          name: "Eosinophils",
          referenceRange: "1 - 6",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 1,
          maxValue: 6,
        },
        {
          name: "Basophils",
          referenceRange: "0 - 1",
          unit: unitMap["%"],
          resultType: "numeric" as const,
          minValue: 0,
          maxValue: 1,
        },
      ];

      const existingParams = parameters.filter(
        (p) => p.categoryId === categoryId,
      );

      await Promise.all(
        params.map((p) => {
          const alreadyExists = existingParams.some(
            (ep) => ep.name.toLowerCase() === p.name.toLowerCase(),
          );

          if (alreadyExists) return Promise.resolve();

          return pathologyService.createParameter({
            ...p,
            categoryId: categoryId!,
            clinicId: clinicId!,
            branchId: branchId!,
            isActive: true,
            createdBy: currentUser?.uid || "",
          });
        }),
      );

      // Create Test Price configuration for CBC
      const existingTestTypes = await pathologyService.getTestTypesByClinic(
        clinicId!,
        branchId!,
      );
      const testTypeExists = existingTestTypes.some(
        (tt) =>
          tt.name.toLowerCase().includes("cbc") ||
          tt.name.toLowerCase().includes("complete blood count"),
      );

      if (!testTypeExists) {
        await pathologyService.createTestType({
          name: "Complete Blood Count (CBC)",
          price: 500,
          targetType: "category",
          targetId: categoryId!,
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      const [cats, params2, units2, tt2] = await Promise.all([
        pathologyService.getCategoriesByClinic(clinicId!, branchId!),
        pathologyService.getParametersByClinic(clinicId!, branchId!),
        pathologyService.getUnitsByClinic(clinicId!, branchId!),
        pathologyService.getTestTypesByClinic(clinicId!, branchId!),
      ]);

      setCategories(cats);
      setParameters(params2);
      setUnits(units2);
      setTestTypes(tt2);

      addToast({
        title: "CBC Test seeded",
        description:
          "Category, parameters, units and price configuration created successfully.",
        color: "success",
      });
    } catch (e) {
      console.error(e);
      addToast({
        title: "Seed failed",
        description: String(e),
        color: "danger",
      });
    } finally {
      setSeeding(false);
    }
  };

  const seedLipidProfile = async () => {
    if (!clinicId || !branchId) return;
    setSeeding(true);
    try {
      let categoryId = categories.find(
        (c) => c.name.toLowerCase() === "lipid profile",
      )?.id;

      if (!categoryId) {
        categoryId = await pathologyService.createCategory({
          name: "Lipid Profile",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      const params = [
        {
          name: "Triglycerides",
          referenceRange:
            "Normal: <150, Borderline high: 150-199, High: 200-499, Very high: >= 500",
          resultType: "numeric" as const,
          unit: "mg/dl",
          minValue: 0,
          maxValue: 150,
          criticalLow: undefined,
          criticalHigh: 500,
        },
        {
          name: "Total Cholesterol",
          referenceRange:
            "Desirable: <200, Borderline High: 200-239, High: >240",
          resultType: "numeric" as const,
          unit: "mg/dl",
          minValue: 0,
          maxValue: 200,
          criticalLow: undefined,
          criticalHigh: 240,
        },
        {
          name: "HDL Cholesterol (Direct)",
          referenceRange: "High: >60, Low: <40",
          resultType: "numeric" as const,
          unit: "mg/dl",
          minValue: 40,
          maxValue: 1000,
          criticalLow: 40,
          criticalHigh: undefined,
        },
        {
          name: "LDL Cholesterol (Direct)",
          referenceRange:
            "Optimal: <100, Near optimal: 100-129, Borderline high: 130-159, High: 160-189, Very high: >190",
          resultType: "numeric" as const,
          unit: "mg/dl",
          minValue: 0,
          maxValue: 100,
          criticalLow: undefined,
          criticalHigh: 190,
        },
      ];

      // Units
      let mgDlUnit = units.find((u) => u.name.toLowerCase() === "mg/dl");
      let mgDlUnitId = mgDlUnit?.id;

      if (!mgDlUnitId) {
        mgDlUnitId = await pathologyService.createUnit({
          name: "mg/dl",
          clinicId: clinicId!,
          branchId: branchId!,
          isActive: true,
          createdBy: currentUser?.uid || "",
        });
      }

      const existingParams = parameters.filter(
        (p) => p.categoryId === categoryId,
      );

      await Promise.all(
        params.map((p) => {
          const alreadyExists = existingParams.some(
            (ep) => ep.name.toLowerCase() === p.name.toLowerCase(),
          );

          if (alreadyExists) return Promise.resolve();

          return pathologyService.createParameter({
            name: p.name,
            categoryId: categoryId!,
            referenceRange: p.referenceRange,
            resultType: p.resultType,
            unit: mgDlUnitId!,
            minValue: p.minValue,
            maxValue: p.maxValue,
            criticalLow: p.criticalLow,
            criticalHigh: p.criticalHigh,
            clinicId: clinicId!,
            branchId: branchId!,
            isActive: true,
            createdBy: currentUser?.uid || "",
          });
        }),
      );

      const [cats, params2, units2] = await Promise.all([
        pathologyService.getCategoriesByClinic(clinicId!, branchId!),
        pathologyService.getParametersByClinic(clinicId!, branchId!),
        pathologyService.getUnitsByClinic(clinicId!, branchId!),
      ]);

      setCategories(cats);
      setParameters(params2);
      setUnits(units2);

      addToast({
        title: "Lipid Profile seeded",
        description: "Category and 4 parameters created successfully.",
        color: "success",
      });
    } catch (e) {
      console.error(e);
      addToast({
        title: "Seed failed",
        description: String(e),
        color: "danger",
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Pathology
            </h1>
            <p className="text-text-muted mt-2 text-[13.5px]">
              Manage pathology tests, categories, units, and parameters
            </p>
          </div>
          <div className="flex gap-2">
            {!seeded && (
              <Button
                color="default"
                isDisabled={seeding}
                size="sm"
                variant="flat"
                onClick={seedHIVTest}
              >
                {seeding ? "Seeding…" : "🧪 Seed HIV Test"}
              </Button>
            )}
            <Button
              color="default"
              isDisabled={seeding}
              size="sm"
              variant="flat"
              onClick={seedCBC}
            >
              {seeding ? "Seeding…" : "🩸 Seed CBC Test"}
            </Button>
            <Button
              color="default"
              isDisabled={seeding}
              size="sm"
              variant="flat"
              onClick={seedSugarTest}
            >
              {seeding ? "Seeding…" : "🩸 Seed Sugar Test"}
            </Button>
            <Button
              color="default"
              isDisabled={seeding}
              size="sm"
              variant="flat"
              onClick={seedLipidProfile}
            >
              {seeding ? "Seeding…" : "🧪 Seed Lipid Profile"}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-surface border border-border-base rounded">
          {/* Tab header */}
          <div className="border-b border-border-base overflow-x-auto">
            <div className="inline-flex rounded-t">
              {TAB_KEYS.filter((key) => key in tabLabels).map((key) => (
                <button
                  key={key}
                  className={`px-4 py-3 flex items-center gap-2 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                    activeTab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-text-muted hover:text-text-main hover:border-border-base"
                  }`}
                  type="button"
                  onClick={() => setActiveTab(key)}
                >
                  {tabLabels[key]}
                  {key === "billing" && unpaidBillingsCount > 0 && (
                    <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-bold text-white bg-danger rounded-full">
                      {unpaidBillingsCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {activeTab === "tests" && (
              <PathologyTestsTab
                canEdit={!isClinicalStaff}
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
                canEdit={!isClinicalStaff}
                filteredCategories={filteredCategories}
                parameters={parameters}
                searchQuery={categoriesSearchQuery}
                units={units}
                onAdd={() => {
                  resetCategoryForm();
                  categoryModalState.open();
                }}
                onAddSubCategory={(cat) => {
                  resetParameterForm();
                  setParameterForm((prev) => ({ ...prev, categoryId: cat.id }));
                  parameterModalState.open();
                }}
                onDelete={(cat) =>
                  openDeleteModal("category", cat.id, cat.name)
                }
                onDeleteParameter={(p) =>
                  openDeleteModal("parameter", p.id, p.name)
                }
                onEdit={editCategory}
                onEditParameter={editParameter}
                onSearchChange={setCategoriesSearchQuery}
              />
            )}
            {activeTab === "units" && (
              <PathologyUnitsTab
                canEdit={!isClinicalStaff}
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
                canEdit={!isClinicalStaff}
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
                canEdit={!isClinicalStaff}
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
                canEdit={!isClinicalStaff}
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
              <PathologyBillingTab
                branchId={branchId!}
                clinicId={clinicId!}
                onRecordResults={handleRecordResultsFromBilling}
              />
            )}
          </div>
        </div>

        {/* Test Form Modal - custom overlay */}
        {testModalState.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-mountain-900/40 backdrop-blur-sm"
                onClick={testModalState.close}
              />
              <div className="relative z-10 bg-surface border border-border-base rounded-lg w-full max-w-6xl mx-4 max-h-[92vh] flex flex-col shadow-2xl">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2 flex items-center justify-between shrink-0">
                  <h2 className="text-[14px] font-semibold text-text-main">
                    {isEditing
                      ? "Edit Pathology Test"
                      : "Create Pathology Tests"}
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
                              setTestForm((prev) => ({
                                ...prev,
                                patientName: v,
                              }))
                            }
                          />
                          <Input
                            label="Phone Number"
                            placeholder="Phone Number"
                            value={testForm.walkInPhone}
                            onValueChange={(v) =>
                              setTestForm((prev) => ({
                                ...prev,
                                walkInPhone: v,
                              }))
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

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-medium text-text-muted">
                          Patient Type
                        </label>
                        <select
                          className="h-[32px] border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          value={testForm.patientType}
                          onChange={(e) =>
                            setTestForm((prev) => ({
                              ...prev,
                              patientType: e.target.value,
                            }))
                          }
                        >
                          <option value="OPD">OPD</option>
                          <option value="IPD">IPD</option>
                          <option value="Emergency">Emergency</option>
                          <option value="Health Camp">Health Camp</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <Input
                        label="Sample Number"
                        placeholder="e.g. S-101"
                        value={testForm.sampleNumber}
                        onValueChange={(v) =>
                          setTestForm((prev) => ({ ...prev, sampleNumber: v }))
                        }
                      />

                      <Input
                        disabled
                        label="Patient ID"
                        placeholder="Auto-generated"
                        value={testForm.patientId || "WALK-IN"}
                      />

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
                        onChange={(id) => {
                          const cat = categories.find((c) => c.id === id);
                          const catParams = parameters.filter(
                            (p) => p.categoryId === id,
                          );

                          setTestForm((prev) => ({
                            ...prev,
                            categoryId: id,
                            categoryName: cat?.name || "",
                            // Auto-load parameters when category is selected
                            parameters: catParams.map((p) => {
                              const isMale = testForm.patientGender === "male";
                              const isFemale =
                                testForm.patientGender === "female";

                              const refRange =
                                isMale && p.referenceRangeMale
                                  ? p.referenceRangeMale
                                  : isFemale && p.referenceRangeFemale
                                    ? p.referenceRangeFemale
                                    : p.referenceRange;
                              const minVal =
                                isMale && p.minValueMale !== undefined
                                  ? p.minValueMale
                                  : isFemale && p.minValueFemale !== undefined
                                    ? p.minValueFemale
                                    : p.minValue;
                              const maxVal =
                                isMale && p.maxValueMale !== undefined
                                  ? p.maxValueMale
                                  : isFemale && p.maxValueFemale !== undefined
                                    ? p.maxValueFemale
                                    : p.maxValue;

                              return {
                                parameterId: p.id,
                                parameterName: p.name,
                                categoryId: p.categoryId || "",
                                patientResult: "",
                                referenceRange: refRange,
                                minValue: minVal,
                                maxValue: maxVal,
                                unit:
                                  units.find((u) => u.id === p.unit)?.name ||
                                  p.unit ||
                                  "",
                              };
                            }),
                          }));
                        }}
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
                          setTestForm((prev) => ({
                            ...prev,
                            standardCharge: v,
                          }))
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

                    {/* Parameters Section */}
                    <div className="mt-8 border-t border-border-base/30 pt-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                          <div className="w-1.5 h-6 bg-primary rounded-full" />
                          Parameter Fields
                        </h3>
                        <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-1 rounded uppercase tracking-wider">
                          {testForm.parameters.length} Parameters
                        </span>
                      </div>

                      <div className="space-y-4">
                        {testForm.parameters.map((param, index) => {
                          // Show a heading if this is the first parameter of a category
                          const prevParam =
                            index > 0 ? testForm.parameters[index - 1] : null;
                          const showHeading =
                            index === 0 ||
                            prevParam?.categoryId !== param.categoryId;

                          const category = categories.find(
                            (c) => c.id === param.categoryId,
                          );
                          const categoryName =
                            category?.name ||
                            param.categoryId ||
                            "General Parameters";

                          const flag = getResultFlag(
                            param,
                            param.patientResult,
                          );
                          const isAbnormal = flag && flag.label !== "NORMAL";
                          const rowBg =
                            flag?.color === "danger"
                              ? "bg-danger-50/40"
                              : flag?.color === "warning"
                                ? "bg-warning-50/40"
                                : "bg-surface";
                          const rowBorder = isAbnormal
                            ? flag?.color === "danger"
                              ? "border-danger-200"
                              : "border-warning-200"
                            : "border-border-base/50";

                          return (
                            <div key={index} className="space-y-3">
                              {showHeading && (
                                <div className="bg-surface-2 px-3 py-2 rounded-lg border border-border-base/50 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary/40" />
                                    <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider">
                                      {categoryName}
                                    </h4>
                                  </div>
                                  <span className="text-[10px] text-text-muted font-bold uppercase">
                                    Test Group
                                  </span>
                                </div>
                              )}
                              <div
                                className={`grid grid-cols-12 gap-3 p-3 ${rowBg} border ${rowBorder} rounded-xl transition-all hover:border-primary/30 group`}
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
                                      updateTestParameter(
                                        index,
                                        "categoryId",
                                        id,
                                      );
                                      updateTestParameter(
                                        index,
                                        "parameterId",
                                        "",
                                      );
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
                                        secondary: `${p.referenceRange} ${units.find((u) => u.id === p.unit)?.name || p.unit || ""}`,
                                      }))}
                                    label="Parameter *"
                                    placeholder="Select parameter"
                                    value={param.parameterId}
                                    onChange={(id, primary) => {
                                      const p = parameters.find(
                                        (p) => p.id === id,
                                      );

                                      if (p) {
                                        const isMale =
                                          testForm.patientGender === "male";
                                        const isFemale =
                                          testForm.patientGender === "female";

                                        const refRange =
                                          isMale && p.referenceRangeMale
                                            ? p.referenceRangeMale
                                            : isFemale && p.referenceRangeFemale
                                              ? p.referenceRangeFemale
                                              : p.referenceRange;
                                        const minVal =
                                          isMale && p.minValueMale !== undefined
                                            ? p.minValueMale
                                            : isFemale &&
                                                p.minValueFemale !== undefined
                                              ? p.minValueFemale
                                              : p.minValue;
                                        const maxVal =
                                          isMale && p.maxValueMale !== undefined
                                            ? p.maxValueMale
                                            : isFemale &&
                                                p.maxValueFemale !== undefined
                                              ? p.maxValueFemale
                                              : p.maxValue;

                                        setTestForm((prev) => {
                                          const updated = [...prev.parameters];

                                          updated[index] = {
                                            ...updated[index],
                                            parameterId: id,
                                            parameterName: primary,
                                            referenceRange: refRange,
                                            unit:
                                              units.find((u) => u.id === p.unit)
                                                ?.name ||
                                              p.unit ||
                                              "",
                                            resultType: p.resultType,
                                            options: p.options,
                                            minValue: minVal,
                                            maxValue: maxVal,
                                            criticalLow: p.criticalLow,
                                            criticalHigh: p.criticalHigh,
                                          };

                                          return {
                                            ...prev,
                                            parameters: updated,
                                          };
                                        });
                                      }
                                    }}
                                  />
                                </div>
                                <div className="col-span-2">
                                  {param.resultType === "select" ? (
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                        Result *
                                      </label>
                                      <select
                                        className="h-9 border border-border-base rounded px-2 text-[13.5px] bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        value={param.patientResult}
                                        onChange={(e) =>
                                          updateTestParameter(
                                            index,
                                            "patientResult",
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <option value="">Select</option>
                                        {param.options?.map((opt) => (
                                          <option
                                            key={opt.trim()}
                                            value={opt.trim()}
                                          >
                                            {opt.trim()}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : param.resultType === "boolean" ? (
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                        Result *
                                      </label>
                                      <select
                                        className="h-9 border border-border-base rounded px-2 text-[13.5px] bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        value={param.patientResult}
                                        onChange={(e) =>
                                          updateTestParameter(
                                            index,
                                            "patientResult",
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <option value="">Select</option>
                                        <option value="Positive">
                                          Positive
                                        </option>
                                        <option value="Negative">
                                          Negative
                                        </option>
                                        <option value="Reactive">
                                          Reactive
                                        </option>
                                        <option value="Non-Reactive">
                                          Non-Reactive
                                        </option>
                                      </select>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                        Result *
                                      </label>
                                      <input
                                        className="w-full h-9 border border-border-base rounded px-3 text-[14px] font-bold text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-center"
                                        data-index={index}
                                        placeholder="Enter Result"
                                        value={param.patientResult}
                                        onChange={(e) =>
                                          updateTestParameter(
                                            index,
                                            "patientResult",
                                            e.target.value,
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            const nextInput =
                                              document.querySelector(
                                                `input[data-index="${index + 1}"]`,
                                              ) as HTMLInputElement;

                                            if (nextInput) {
                                              nextInput.focus();
                                              nextInput.select();
                                            }
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    label="Ref. Range"
                                    value={param.referenceRange}
                                    onValueChange={(v) =>
                                      updateTestParameter(
                                        index,
                                        "referenceRange",
                                        v,
                                      )
                                    }
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    label="Unit"
                                    value={param.unit}
                                    onValueChange={(v) =>
                                      updateTestParameter(index, "unit", v)
                                    }
                                  />
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                  {param.resultType === "numeric" &&
                                    param.patientResult &&
                                    (() => {
                                      const flag = getResultFlag(
                                        param,
                                        param.patientResult,
                                      );

                                      if (!flag) return null;

                                      return (
                                        <span
                                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-sm ${
                                            flag.color === "danger"
                                              ? "bg-danger-50 text-danger-700 border-danger-200"
                                              : flag.color === "warning"
                                                ? "bg-warning-50 text-warning-700 border-warning-200"
                                                : "bg-success-50 text-success-700 border-success-200"
                                          }`}
                                        >
                                          {flag.icon} {flag.label}
                                        </span>
                                      );
                                    })()}
                                </div>
                                <div className="col-span-1 flex items-center justify-end">
                                  <Button
                                    isIconOnly
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    color="danger"
                                    size="sm"
                                    variant="light"
                                    onClick={() => removeTestParameter(index)}
                                  >
                                    <IoTrashOutline className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-center mt-6">
                        <Button
                          className="bg-surface border-2 border-dashed border-border-base hover:border-primary/50 hover:bg-primary/5 h-12 px-10 rounded-xl transition-all"
                          color="default"
                          startContent={<IoAddOutline className="w-5 h-5" />}
                          variant="flat"
                          onClick={addTestParameter}
                        >
                          <span className="font-bold text-primary">
                            Add Another Parameter
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-border-base/50 bg-surface-2 flex justify-end gap-3 shrink-0">
                  <Button
                    className="font-bold"
                    variant="flat"
                    onClick={testModalState.close}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="font-bold px-8"
                    color="primary"
                    onClick={handleSaveTest}
                  >
                    {isEditing ? "Update Report" : "Save Report"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {categoryModalState.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-mountain-900/60 backdrop-blur-md"
                onClick={categoryModalState.close}
              />
              <div className="relative z-10 bg-surface border border-border-base rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2 flex items-center justify-between shrink-0">
                  <h2 className="text-[14px] font-bold text-text-main">
                    {isEditing
                      ? "Edit Pathology Category"
                      : "New Pathology Category"}
                  </h2>
                  <button
                    className="text-text-muted hover:text-text-main"
                    type="button"
                    onClick={categoryModalState.close}
                  >
                    <IoCloseOutline className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                  <div className="space-y-6">
                    <div className="bg-surface-2/30 p-4 rounded-lg border border-border-base/50">
                      <Input
                        isRequired
                        label="Category Name *"
                        placeholder="e.g. Complete Blood Count (CBC)"
                        value={categoryForm.name}
                        onValueChange={(v) =>
                          setCategoryForm((prev) => ({ ...prev, name: v }))
                        }
                      />
                    </div>

                    {!isEditing && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <div>
                            <h3 className="text-[13px] font-bold text-text-main uppercase tracking-wider">
                              Category Parameters
                            </h3>
                            <p className="text-[11px] text-text-muted">
                              Define the sub-tests included in this category
                            </p>
                          </div>
                          <Button
                            color="primary"
                            size="sm"
                            startContent={<IoAddOutline />}
                            variant="flat"
                            onClick={addCategoryParameter}
                          >
                            Add Parameter
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                          {categoryForm.parameters.map((param, index) => (
                            <div
                              key={index}
                              className="bg-surface-2 border border-border-base rounded-lg p-4 shadow-sm relative group hover:border-primary/30 transition-all flex flex-col gap-4"
                            >
                              <div className="flex justify-between items-center pb-2 border-b border-border-base/50">
                                <span className="text-[11px] font-extrabold text-primary uppercase tracking-widest">
                                  PARAMETER #{index + 1}
                                </span>
                                <button
                                  className="text-text-muted hover:text-danger p-1 rounded-full hover:bg-danger/10 transition-colors"
                                  type="button"
                                  onClick={() => removeCategoryParameter(index)}
                                >
                                  <IoTrashOutline className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <div className="col-span-2">
                                  <Input
                                    isRequired
                                    label="Parameter Name *"
                                    placeholder="e.g. Hemoglobin"
                                    size="sm"
                                    value={param.name}
                                    onValueChange={(v) =>
                                      updateCategoryParameter(index, "name", v)
                                    }
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-text-muted uppercase">
                                    Type
                                  </label>
                                  <select
                                    className="w-full h-8 border border-border-base rounded px-2 text-[12px] bg-surface focus:outline-none focus:border-primary"
                                    value={param.resultType}
                                    onChange={(e) =>
                                      updateCategoryParameter(
                                        index,
                                        "resultType",
                                        e.target.value,
                                      )
                                    }
                                  >
                                    <option value="numeric">Numeric</option>
                                    <option value="boolean">Pos/Neg</option>
                                    <option value="select">Dropdown</option>
                                    <option value="text">Text</option>
                                    <option value="richText">Rich Text</option>
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold text-text-muted uppercase">
                                      Unit
                                    </label>
                                    <button
                                      className="text-[10px] text-primary hover:underline font-bold"
                                      type="button"
                                      onClick={() =>
                                        setShowQuickUnit(!showQuickUnit)
                                      }
                                    >
                                      + NEW
                                    </button>
                                  </div>

                                  {showQuickUnit ? (
                                    <div className="flex gap-1">
                                      <input
                                        autoFocus
                                        className="flex-1 h-8 border border-border-base rounded px-2 text-[12px] bg-surface focus:outline-none focus:border-primary"
                                        placeholder="Unit"
                                        value={quickUnitName}
                                        onChange={(e) =>
                                          setQuickUnitName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleQuickUnitSave().then((id) => {
                                              if (id)
                                                updateCategoryParameter(
                                                  index,
                                                  "unit",
                                                  id,
                                                );
                                            });
                                          }
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <select
                                      className="w-full h-8 border border-border-base rounded px-2 text-[12px] bg-surface focus:outline-none focus:border-primary"
                                      value={param.unit}
                                      onChange={(e) =>
                                        updateCategoryParameter(
                                          index,
                                          "unit",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="">No Unit</option>
                                      {units.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                <div className="col-span-2">
                                  <Input
                                    isRequired
                                    label="Reference Range String *"
                                    placeholder="e.g. 13.5 - 17.5"
                                    size="sm"
                                    value={param.referenceRange}
                                    onValueChange={(v) =>
                                      updateCategoryParameter(
                                        index,
                                        "referenceRange",
                                        v,
                                      )
                                    }
                                  />
                                </div>

                                {param.resultType === "numeric" && (
                                  <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-surface p-3 rounded-md border border-border-base/50">
                                    <Input
                                      label="Lower Range (Min)"
                                      placeholder="0.00"
                                      size="sm"
                                      type="number"
                                      value={param.minValue}
                                      onValueChange={(v) =>
                                        updateCategoryParameter(
                                          index,
                                          "minValue",
                                          v,
                                        )
                                      }
                                    />
                                    <Input
                                      label="Upper Range (Max)"
                                      placeholder="0.00"
                                      size="sm"
                                      type="number"
                                      value={param.maxValue}
                                      onValueChange={(v) =>
                                        updateCategoryParameter(
                                          index,
                                          "maxValue",
                                          v,
                                        )
                                      }
                                    />
                                    <Input
                                      label="Critical Low"
                                      placeholder="Panic"
                                      size="sm"
                                      type="number"
                                      value={param.criticalLow}
                                      onValueChange={(v) =>
                                        updateCategoryParameter(
                                          index,
                                          "criticalLow",
                                          v,
                                        )
                                      }
                                    />
                                    <Input
                                      label="Critical High"
                                      placeholder="Panic"
                                      size="sm"
                                      type="number"
                                      value={param.criticalHigh}
                                      onValueChange={(v) =>
                                        updateCategoryParameter(
                                          index,
                                          "criticalHigh",
                                          v,
                                        )
                                      }
                                    />
                                  </div>
                                )}

                                {param.resultType === "select" && (
                                  <div className="col-span-2">
                                    <Input
                                      label="Dropdown Options (comma separated)"
                                      placeholder="Nil, Trace, 1+, 2+"
                                      size="sm"
                                      value={param.options}
                                      onValueChange={(v) =>
                                        updateCategoryParameter(
                                          index,
                                          "options",
                                          v,
                                        )
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {categoryForm.parameters.length === 0 && (
                          <div className="py-8 border-2 border-dashed border-border-base rounded-lg flex flex-col items-center justify-center text-text-muted">
                            <p className="text-[13px]">
                              No parameters added yet
                            </p>
                            <button
                              className="text-[12px] text-primary font-bold mt-1 hover:underline"
                              onClick={addCategoryParameter}
                            >
                              Click here to add the first parameter
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-border-base/50 bg-surface-2 flex justify-end gap-2 shrink-0">
                  <Button variant="light" onClick={categoryModalState.close}>
                    Cancel
                  </Button>
                  <Button color="primary" onClick={handleSaveCategory}>
                    {isEditing
                      ? "Update Category"
                      : "Save Category & Parameters"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* Unit Form Modal */}
        {unitModalState.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-mountain-900/60 backdrop-blur-md"
                onClick={unitModalState.close}
              />
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
            </div>,
            document.body,
          )}

        {parameterModalState.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-mountain-900/60 backdrop-blur-md"
                onClick={parameterModalState.close}
              />
              <div className="relative z-10 bg-surface border border-border-base rounded-lg w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-3 border-b border-border-base/50 bg-surface-2 flex items-center justify-between shrink-0">
                  <h2 className="text-[14px] font-bold text-text-main">
                    {isEditing
                      ? "Edit Parameter Configuration"
                      : "New Parameter Configuration"}
                  </h2>
                  <button
                    className="text-text-muted hover:text-text-main"
                    type="button"
                    onClick={parameterModalState.close}
                  >
                    <IoCloseOutline className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 overflow-y-auto max-h-[80vh]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category & Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                        Category
                      </label>
                      <select
                        className="h-9 border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
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
                      label="Parameter Name *"
                      placeholder="e.g. Hemoglobin"
                      value={parameterForm.name}
                      onValueChange={(v) =>
                        setParameterForm((prev) => ({ ...prev, name: v }))
                      }
                    />

                    {/* Result Type & Default */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                        Result Type
                      </label>
                      <select
                        className="h-9 border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        value={parameterForm.resultType}
                        onChange={(e) =>
                          setParameterForm((prev) => ({
                            ...prev,
                            resultType: e.target.value as any,
                          }))
                        }
                      >
                        <option value="numeric">Numeric (Range-based)</option>
                        <option value="boolean">Binary (Pos/Neg)</option>
                        <option value="select">Dropdown (Options)</option>
                        <option value="text">Short Text</option>
                        <option value="richText">Rich Text/Notes</option>
                      </select>
                    </div>
                    <Input
                      label="Default Value"
                      placeholder="Optional"
                      value={parameterForm.defaultValue}
                      onValueChange={(v) =>
                        setParameterForm((prev) => ({
                          ...prev,
                          defaultValue: v,
                        }))
                      }
                    />

                    {/* Conditional: Select Options */}
                    {parameterForm.resultType === "select" && (
                      <div className="col-span-2">
                        <Input
                          isRequired
                          label="Options (Comma separated) *"
                          placeholder="Nil, Trace, 1+, 2+"
                          value={parameterForm.options}
                          onValueChange={(v) =>
                            setParameterForm((prev) => ({
                              ...prev,
                              options: v,
                            }))
                          }
                        />
                      </div>
                    )}

                    {/* Common: Range & Unit */}
                    <Input
                      isRequired
                      label="Reference Range String *"
                      placeholder="e.g. 13.5 - 17.5"
                      value={parameterForm.referenceRange}
                      onValueChange={(v) => {
                        const newForm = { ...parameterForm, referenceRange: v };
                        const regex = /([\d.]+)\s*(?:-|to)\s*([\d.]+)/i;
                        const match = v.match(regex);

                        if (match) {
                          newForm.minValue = match[1];
                          newForm.maxValue = match[2];
                        }
                        setParameterForm(newForm);
                      }}
                    />
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          Unit
                        </label>
                        <button
                          className={`text-[10px] font-bold uppercase transition-colors ${showQuickUnit ? "text-danger hover:text-danger-600" : "text-primary hover:text-primary-600"}`}
                          type="button"
                          onClick={() => setShowQuickUnit(!showQuickUnit)}
                        >
                          {showQuickUnit ? "Cancel" : "+ Quick Add"}
                        </button>
                      </div>

                      {showQuickUnit ? (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            className="flex-1 h-9 border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            placeholder="e.g. mg/dL"
                            value={quickUnitName}
                            onChange={(e) => setQuickUnitName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleQuickUnitSave();
                              }
                            }}
                          />
                          <Button
                            isIconOnly
                            color="primary"
                            size="sm"
                            onClick={handleQuickUnitSave}
                          >
                            <IoAddOutline className="text-lg" />
                          </Button>
                        </div>
                      ) : (
                        <select
                          className="h-9 border border-border-base rounded px-3 text-[13.5px] text-text-main bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
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
                      )}
                    </div>

                    {/* Conditional: Numeric Ranges */}
                    {parameterForm.resultType === "numeric" && (
                      <>
                        <Input
                          label="Lower Range (Min)"
                          placeholder="0.00"
                          type="number"
                          value={parameterForm.minValue}
                          onValueChange={(v) =>
                            setParameterForm((prev) => ({
                              ...prev,
                              minValue: v,
                            }))
                          }
                        />
                        <Input
                          label="Upper Range (Max)"
                          placeholder="0.00"
                          type="number"
                          value={parameterForm.maxValue}
                          onValueChange={(v) =>
                            setParameterForm((prev) => ({
                              ...prev,
                              maxValue: v,
                            }))
                          }
                        />

                        <Input
                          label="Critical Low (Panic)"
                          placeholder="Panic value"
                          type="number"
                          value={parameterForm.criticalLow}
                          onValueChange={(v) =>
                            setParameterForm((prev) => ({
                              ...prev,
                              criticalLow: v,
                            }))
                          }
                        />
                        <Input
                          label="Critical High (Panic)"
                          placeholder="Panic value"
                          type="number"
                          value={parameterForm.criticalHigh}
                          onValueChange={(v) =>
                            setParameterForm((prev) => ({
                              ...prev,
                              criticalHigh: v,
                            }))
                          }
                        />

                        {/* Gender Specific Sections - Toned down version */}
                        <div className="col-span-full mt-6 border-t border-border-base/50 pt-6">
                          <h3 className="text-[13px] font-bold text-text-main mb-6 flex items-center gap-2">
                            <div className="w-1 h-4 bg-primary/40 rounded-full" />
                            Gender Specific Standards
                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Male Specific */}
                            <div className="space-y-4">
                              <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                Male Standards
                              </h4>
                              <Input
                                label="Male Reference Range String"
                                placeholder="e.g. 13.5 - 17.5"
                                value={parameterForm.referenceRangeMale}
                                onValueChange={(v) =>
                                  setParameterForm((prev) => ({
                                    ...prev,
                                    referenceRangeMale: v,
                                  }))
                                }
                              />
                              <div className="grid grid-cols-2 gap-4">
                                <Input
                                  label="Male Min"
                                  placeholder="0.00"
                                  type="number"
                                  value={parameterForm.minValueMale}
                                  onValueChange={(v) =>
                                    setParameterForm((prev) => ({
                                      ...prev,
                                      minValueMale: v,
                                    }))
                                  }
                                />
                                <Input
                                  label="Male Max"
                                  placeholder="0.00"
                                  type="number"
                                  value={parameterForm.maxValueMale}
                                  onValueChange={(v) =>
                                    setParameterForm((prev) => ({
                                      ...prev,
                                      maxValueMale: v,
                                    }))
                                  }
                                />
                              </div>
                            </div>

                            {/* Female Specific */}
                            <div className="space-y-4">
                              <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                Female Standards
                              </h4>
                              <Input
                                label="Female Reference Range String"
                                placeholder="e.g. 12.0 - 15.5"
                                value={parameterForm.referenceRangeFemale}
                                onValueChange={(v) =>
                                  setParameterForm((prev) => ({
                                    ...prev,
                                    referenceRangeFemale: v,
                                  }))
                                }
                              />
                              <div className="grid grid-cols-2 gap-4">
                                <Input
                                  label="Female Min"
                                  placeholder="0.00"
                                  type="number"
                                  value={parameterForm.minValueFemale}
                                  onValueChange={(v) =>
                                    setParameterForm((prev) => ({
                                      ...prev,
                                      minValueFemale: v,
                                    }))
                                  }
                                />
                                <Input
                                  label="Female Max"
                                  placeholder="0.00"
                                  type="number"
                                  value={parameterForm.maxValueFemale}
                                  onValueChange={(v) =>
                                    setParameterForm((prev) => ({
                                      ...prev,
                                      maxValueFemale: v,
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                          <p className="mt-6 text-[11px] text-text-muted italic border-l-2 border-border-base pl-3">
                            Note: If these specific ranges are left blank, the
                            system will default to the general reference range
                            defined above.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-border-base/50 bg-surface-2 flex justify-end gap-2 shrink-0">
                  <Button variant="light" onClick={parameterModalState.close}>
                    Cancel
                  </Button>
                  <Button color="primary" onClick={handleSaveParameter}>
                    {isEditing ? "Update Configuration" : "Save Parameter"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* Test Type Form Modal */}
        {testTypeModalState.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={testTypeModalState.close}
            />
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
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmModalState.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-mountain-900/40 backdrop-blur-sm"
              onClick={deleteConfirmModalState.close}
            />
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
                <Button
                  className="bg-danger text-white hover:bg-danger/90"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Quick Patient Creation Modal */}
        {quickPatientModalState.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-mountain-900/40 backdrop-blur-sm"
                onClick={quickPatientModalState.close}
              />
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
          )}
      </div>
    </>
  );
}
