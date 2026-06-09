import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
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
  IoTrashOutline,
  IoEyeOutline,
  IoWalletOutline,
  IoCheckmark,
  IoTime,
  IoClose,
  IoCloseOutline,
  IoSearchOutline,
  IoPrintOutline,
  IoPencilOutline,
  IoReceiptOutline,
  IoCloseCircleOutline,
} from "react-icons/io5";
import { IoBusinessOutline, IoMedkitOutline } from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { pathologyBillingService } from "@/services/pathologyBillingService";
import { pathologyService } from "@/services/pathologyService";
import { clinicService } from "@/services/clinicService";
import {
  PathologyBilling,
  PathologyBillingItem,
  PathologyBillingSettings,
  PathologyTest,
  PathologyTestType,
  PathologyCategory,
  PathologyParameter,
  ReferringDoctor,
  Doctor,
  ReferralPartner,
} from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import { generateInvoiceHTML, PrintFormat } from "@/utils/invoicePrinting";
import { doctorService } from "@/services/doctorService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { patientService } from "@/services/patientService";
import { Patient } from "@/types/models";

// ── Flat inline patient search (mirrors SearchSelect in appointments-billing) ─
function PatientSearchBox({
  value,
  patients,
  onSelect,
  onChange,
}: {
  value: string;
  patients: Patient[];
  onSelect: (p: Patient) => void;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const filtered = (
    q
      ? patients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      : patients
  ).slice(0, 80);

  return (
    <div className="relative">
      <div className="flex items-center h-9 border border-border-base rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-surface">
        <IoSearchOutline className="ml-2.5 w-3.5 h-3.5 text-text-muted/50 shrink-0" />
        <input
          className="flex-1 text-[12.5px] px-2 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/40 w-full"
          placeholder="Search patient…"
          value={open ? q : value}
          onChange={(e) => {
            setQ(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && !open && (
          <button
            className="mr-2 text-text-muted hover:text-text-main"
            type="button"
            onClick={() => {
              onChange("");
              setQ("");
            }}
          >
            <IoCloseOutline className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setOpen(false);
              setQ("");
            }}
          />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border-base rounded max-h-48 overflow-y-auto shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-text-muted/70">
                No results
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 hover:bg-surface-2"
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <p className="text-[12.5px] text-text-main">{p.name}</p>
                  <p className="text-[11px] text-text-muted/60">
                    {p.mobile || p.phone || ""}{" "}
                    {p.regNumber ? `• ${p.regNumber}` : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface PathologyBillingTabProps {
  clinicId: string;
  branchId: string;
  onRecordResults?: (billing: PathologyBilling) => void;
}

interface InvoiceFormData {
  patientId?: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientAddress: string;
  patientAge: string;
  patientGender: string;
  invoiceDate: string;
  items: PathologyBillingItem[];
  discountType: "flat" | "percent";
  discountValue: number;
  referringDoctors: ReferringDoctor[];
  notes?: string;
  // Robust fields
  labReferenceNo?: string;
  sampleCollectionDate: string;
  expectedReportDate: string;
  reportStatus:
    | "pending_collection"
    | "collected"
    | "in_lab"
    | "partially_ready"
    | "ready"
    | "delivered";
}

export default function PathologyBillingTab({
  clinicId,
  branchId,
  onRecordResults,
}: PathologyBillingTabProps) {
  const { currentUser, userData } = useAuthContext();
  const invoiceModal = useModalState(false);
  const paymentModal = useModalState(false);
  const settingsModal = useModalState(false);

  const [activeTab, setActiveTab] = useState("create");

  // Data states
  const [tests, setTests] = useState<PathologyTest[]>([]);
  const [testTypes, setTestTypes] = useState<PathologyTestType[]>([]);
  const [categories, setCategories] = useState<PathologyCategory[]>([]);
  const [parameters, setParameters] = useState<PathologyParameter[]>([]);
  const [billings, setBillings] = useState<PathologyBilling[]>([]);
  const [billingSettings, setBillingSettings] =
    useState<PathologyBillingSettings | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );
  const [clinic, setClinic] = useState<any>(null);
  const [patients, setPatients] = useState<Patient[]>([]);

  // Form states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBilling, setSelectedBilling] =
    useState<PathologyBilling | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Payment states
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedBillingForPayment, setSelectedBillingForPayment] =
    useState<PathologyBilling | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
  });

  // Doctors & Partners list
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [partners, setPartners] = useState<ReferralPartner[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Form data
  const [formData, setFormData] = useState<InvoiceFormData>({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    patientAddress: "",
    patientAge: "",
    patientGender: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    items: [],
    discountType: "percent",
    discountValue: 0,
    referringDoctors: [],
    notes: "",
    labReferenceNo: "",
    sampleCollectionDate: new Date().toISOString().split("T")[0],
    expectedReportDate: new Date(Date.now() + 86400000)
      .toISOString()
      .split("T")[0], // Tomorrow
    reportStatus: "pending_collection",
  });

  const [selectedPrintFormat, setSelectedPrintFormat] =
    useState<PrintFormat>("A4");

  // Calculations
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    itemDiscountAmount: 0,
    mainDiscountAmount: 0,
    totalDiscount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  // Unified test catalog for search
  const testCatalog = useMemo(() => {
    const combined = [
      ...categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: "Category",
      })),
      ...parameters.map((p) => ({
        id: p.id,
        name: p.name,
        type: "Parameter",
      })),
    ];

    return combined;
  }, [categories, parameters]);

  // Unified referral sources for search
  const allReferralSources = useMemo(() => {
    const combined = [
      ...doctors.map((d) => ({
        id: d.id,
        name: d.name,
        type: "doctor" as const,
        icon: <IoMedkitOutline className="text-primary" />,
        defaultCommission: d.defaultCommission,
      })),
      ...partners.map((p) => ({
        id: p.id,
        name: p.name,
        type: "partner" as const,
        icon: <IoBusinessOutline className="text-secondary" />,
        defaultCommission: p.defaultCommission,
      })),
    ];

    return combined;
  }, [doctors, partners]);

  useEffect(() => {
    loadData();
  }, [clinicId, branchId]);

  useEffect(() => {
    calculateTotals();
  }, [
    formData.items,
    formData.discountType,
    formData.discountValue,
    billingSettings,
  ]);

  const loadData = async () => {
    if (!clinicId || !branchId) return;

    try {
      setLoading(true);
      const [
        testsData,
        testTypesData,
        categoriesData,
        parametersData,
        billingsData,
        settingsData,
        clinicData,
        layoutConfigData,
        doctorsList,
        partnersList,
        patientsList,
      ] = await Promise.all([
        pathologyService.getTestsByClinic(clinicId, branchId),
        pathologyService.getTestTypesByClinic(clinicId, branchId),
        pathologyService.getCategoriesByClinic(clinicId, branchId),
        pathologyService.getParametersByClinic(clinicId, branchId),
        pathologyBillingService.getBillingByClinic(clinicId, branchId),
        pathologyBillingService.getBillingSettings(clinicId),
        clinicService.getClinicById(clinicId),
        clinicService.getPrintLayoutConfig(clinicId),
        doctorService.getDoctorsByClinic(clinicId),
        referralPartnerService.getReferralPartnersByClinic(clinicId),
        patientService.getPatientsByClinic(clinicId, branchId),
      ]);

      setTests(testsData);
      setTestTypes(testTypesData);
      setCategories(categoriesData);
      setParameters(parametersData);
      setBillings(billingsData);
      setBillingSettings(settingsData);
      setClinic(clinicData);
      setLayoutConfig(layoutConfigData);
      if (layoutConfigData?.defaultPrintFormat) {
        setSelectedPrintFormat(
          layoutConfigData.defaultPrintFormat as PrintFormat,
        );
      }
      setDoctors(doctorsList);
      setPartners(partnersList);
      setPatients(patientsList);

      // Initialize settings if they don't exist
      if (!settingsData && currentUser) {
        const defaultSettings =
          pathologyBillingService.getDefaultBillingSettings(
            clinicId,
            currentUser.uid,
          );

        await pathologyBillingService.updateBillingSettings(
          clinicId,
          branchId,
          defaultSettings,
          currentUser.uid,
        );
        const updatedSettings =
          await pathologyBillingService.getBillingSettings(clinicId);

        if (updatedSettings) {
          setBillingSettings(updatedSettings);
        }
      }

      // Set defaults from settings
      if (settingsData) {
        setFormData((prev) => ({
          ...prev,
          referringDoctors: [],
        }));
      }
    } catch (error) {
      console.error("Error loading pathology billing data:", error);
      addToast({
        title: "Error",
        description: "Failed to load billing data. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    if (!formData.items.length || !billingSettings) {
      setCalculations({
        subtotal: 0,
        itemDiscountAmount: 0,
        mainDiscountAmount: 0,
        totalDiscount: 0,
        taxAmount: 0,
        totalAmount: 0,
      });

      return;
    }

    // Subtotal = sum of (price * quantity) BEFORE any discounts
    const subtotal = formData.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Item-level discounts
    const itemDiscountAmount = formData.items.reduce(
      (sum, item) => sum + (item.discountAmount || 0),
      0,
    );

    // Invoice-level discount applied on amount after item discounts
    const afterItemDiscount = subtotal - itemDiscountAmount;
    let mainDiscountAmount = 0;

    if (formData.discountType === "percent") {
      mainDiscountAmount =
        (afterItemDiscount * (formData.discountValue || 0)) / 100;
    } else {
      mainDiscountAmount = Math.min(
        formData.discountValue || 0,
        afterItemDiscount,
      );
    }

    const totalDiscount = itemDiscountAmount + mainDiscountAmount;
    const afterDiscount = subtotal - totalDiscount;

    const taxPercentage = billingSettings.enableTax
      ? billingSettings.defaultTaxPercentage
      : 0;
    const taxAmount = (afterDiscount * taxPercentage) / 100;
    const totalAmount = afterDiscount + taxAmount;

    // Recalculate doctor commissions based on after-discount subtotal
    const updatedReferringDoctors = formData.referringDoctors.map((doc) => {
      let calculatedAmount = 0;

      if (doc.commissionType === "percent") {
        calculatedAmount = (afterDiscount * doc.commissionValue) / 100;
      } else {
        calculatedAmount = doc.commissionValue;
      }

      return { ...doc, calculatedAmount };
    });

    setCalculations({
      subtotal,
      itemDiscountAmount,
      mainDiscountAmount,
      totalDiscount,
      taxAmount,
      totalAmount,
    });

    setFormData((prev) => ({
      ...prev,
      referringDoctors: updatedReferringDoctors,
    }));
  };

  const addInvoiceItem = () => {
    const newItem: PathologyBillingItem = {
      id: `item_${Date.now()}`,
      testId: "",
      testName: "",
      testType: "",
      price: 0,
      quantity: 1,
      discountType: "percent",
      discountValue: 0,
      discountAmount: 0,
      amount: 0,
      sampleType: "Blood",
      isUrgent: false,
    };

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const updateInvoiceItem = (
    index: number,
    field: keyof PathologyBillingItem,
    value: any,
  ) => {
    const updatedItems = [...formData.items];

    if (field === "testName") {
      // Try to find a matching test type (price) for this name
      const matchingType = testTypes.find(
        (tt) => tt.name.toLowerCase() === value.toLowerCase(),
      );

      updatedItems[index] = {
        ...updatedItems[index],
        testName: value,
        testId: "", // Reset ID for free text
        testType: matchingType ? matchingType.name : value,
        price: matchingType ? matchingType.price : updatedItems[index].price,
        amount:
          (matchingType ? matchingType.price : updatedItems[index].price) *
          updatedItems[index].quantity,
      };
    } else if (field === "quantity") {
      const qty = parseInt(value) || 1;
      const item = updatedItems[index];
      const base = item.price * qty;
      const dType = item.discountType || "percent";
      const dVal = item.discountValue || 0;
      const discAmt =
        dType === "percent" ? (base * dVal) / 100 : Math.min(dVal, base);

      updatedItems[index] = {
        ...item,
        quantity: qty,
        discountAmount: discAmt,
        amount: base - discAmt,
      };
    } else if (field === "price") {
      const price = parseFloat(value) || 0;
      const item = updatedItems[index];
      const base = price * item.quantity;
      const dType = item.discountType || "percent";
      const dVal = item.discountValue || 0;
      const discAmt =
        dType === "percent" ? (base * dVal) / 100 : Math.min(dVal, base);

      updatedItems[index] = {
        ...item,
        price,
        discountAmount: discAmt,
        amount: base - discAmt,
      };
    } else if (field === "discountType") {
      const item = updatedItems[index];
      const base = item.price * item.quantity;
      const dVal = item.discountValue || 0;
      const discAmt =
        value === "percent" ? (base * dVal) / 100 : Math.min(dVal, base);

      updatedItems[index] = {
        ...item,
        discountType: value,
        discountAmount: discAmt,
        amount: base - discAmt,
      };
    } else if (field === "discountValue") {
      const item = updatedItems[index];
      const base = item.price * item.quantity;
      const dVal = parseFloat(value) || 0;
      const dType = item.discountType || "percent";
      const discAmt =
        dType === "percent" ? (base * dVal) / 100 : Math.min(dVal, base);

      updatedItems[index] = {
        ...item,
        discountValue: dVal,
        discountAmount: discAmt,
        amount: base - discAmt,
      };
    } else if (field === "isUrgent") {
      updatedItems[index] = { ...updatedItems[index], isUrgent: value };
    } else if (field === "sampleType") {
      updatedItems[index] = { ...updatedItems[index], sampleType: value };
    } else {
      updatedItems[index] = { ...updatedItems[index], [field]: value };
    }

    setFormData((prev) => ({
      ...prev,
      items: updatedItems,
    }));
  };

  const addReferralSource = (sourceId: string) => {
    const source = allReferralSources.find((s) => s.id === sourceId);

    if (!source) return;

    // Check if already added
    if (formData.referringDoctors.some((rd) => rd.doctorId === source.id)) {
      addToast({
        title: "Warning",
        description: "This referral source is already added.",
        color: "warning",
      });

      return;
    }

    setFormData((prev) => ({
      ...prev,
      referringDoctors: [
        ...prev.referringDoctors,
        {
          type: source.type,
          doctorId: source.id,
          doctorName: source.name,
          commissionType: "percent",
          commissionValue: source.defaultCommission || 0,
          calculatedAmount:
            (calculations.subtotal * (source.defaultCommission || 0)) / 100,
        },
      ],
    }));
  };

  const removeReferringDoctor = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      referringDoctors: prev.referringDoctors.filter((_, i) => i !== index),
    }));
  };

  const updateReferringDoctor = (
    index: number,
    data: Partial<ReferringDoctor>,
  ) => {
    const newDocs = [...formData.referringDoctors];
    const subtotal = calculations.subtotal;

    newDocs[index] = { ...newDocs[index], ...data };

    // Handle type specific updates
    if (data.type) {
      // Reset if type changes
      newDocs[index].doctorId = "";
      newDocs[index].doctorName = "";
      newDocs[index].commissionValue = 0;
    }

    // Recalculate amount for this entry
    const entry = newDocs[index];

    if (entry.commissionType === "percent") {
      entry.calculatedAmount = (subtotal * entry.commissionValue) / 100;
    } else {
      entry.calculatedAmount = entry.commissionValue;
    }

    setFormData((prev) => ({
      ...prev,
      referringDoctors: newDocs,
    }));
  };

  const removeInvoiceItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!clinicId || !currentUser || !billingSettings) return;

    // Validation
    if (!formData.patientName.trim() || !formData.items.length) {
      addToast({
        title: "Validation Error",
        description:
          "Please fill in patient name and add at least one test item.",
        color: "warning",
      });

      return;
    }

    const hasValidItems = formData.items.every(
      (item) =>
        item.testName.trim() &&
        item.quantity > 0 &&
        item.price >= 0 &&
        item.amount >= 0,
    );

    if (!hasValidItems) {
      addToast({
        title: "Validation Error",
        description:
          "Please ensure all invoice items have test name, quantity, price, and amount.",
        color: "warning",
      });

      return;
    }

    try {
      setSubmitting(true);

      // Base billing data for both create and update
      let billingData: any = {
        clinicId,
        branchId,
        patientId: formData.patientId || null,
        patientName: formData.patientName.trim(),
        patientEmail: formData.patientEmail.trim() || null,
        patientPhone: formData.patientPhone.trim() || null,
        patientAddress: formData.patientAddress.trim() || null,
        patientAge: formData.patientAge ? parseInt(formData.patientAge) : null,
        patientGender: formData.patientGender.trim() || null,
        invoiceDate: new Date(formData.invoiceDate),
        items: formData.items,
        subtotal: calculations.subtotal,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        discountAmount: calculations.totalDiscount,
        itemDiscountAmount: calculations.itemDiscountAmount,
        mainDiscountAmount: calculations.mainDiscountAmount,
        taxPercentage: billingSettings.enableTax
          ? billingSettings.defaultTaxPercentage
          : 0,
        taxAmount: calculations.taxAmount,
        totalAmount: calculations.totalAmount,
        referringDoctors: formData.referringDoctors,
        notes: formData.notes?.trim() || null,
        labReferenceNo: formData.labReferenceNo?.trim() || null,
        sampleCollectionDate: new Date(formData.sampleCollectionDate),
        expectedReportDate: new Date(formData.expectedReportDate),
        reportStatus: formData.reportStatus,
      };

      if (editingInvoiceId) {
        // Find existing to get paid amount
        const existing = billings.find((b) => b.id === editingInvoiceId);
        const paidAmount = existing ? existing.paidAmount : 0;
        const balanceAmount = calculations.totalAmount - paidAmount;
        let paymentStatus = "unpaid";

        if (paidAmount >= calculations.totalAmount) {
          paymentStatus = "paid";
        } else if (paidAmount > 0) {
          paymentStatus = "partial";
        }

        billingData = {
          ...billingData,
          balanceAmount,
          paymentStatus,
        };

        await pathologyBillingService.updateBilling(
          editingInvoiceId,
          billingData,
        );
        addToast({
          title: "Success",
          description: "Pathology invoice updated successfully",
          color: "success",
        });
      } else {
        const invoiceNumber =
          await pathologyBillingService.generateInvoiceNumber(clinicId);

        billingData = {
          ...billingData,
          invoiceNumber,
          status: "draft",
          paymentStatus: "unpaid",
          paidAmount: 0,
          balanceAmount: calculations.totalAmount,
          createdBy: currentUser.uid,
        };

        await pathologyBillingService.createBilling(billingData);
        addToast({
          title: "Success",
          description: "Pathology invoice created successfully",
          color: "success",
        });
      }

      // Reset form
      setFormData({
        patientName: "",
        patientEmail: "",
        patientPhone: "",
        patientAddress: "",
        patientAge: "",
        patientGender: "",
        invoiceDate: new Date().toISOString().split("T")[0],
        items: [],
        discountType: billingSettings?.defaultDiscountType || "percent",
        discountValue: billingSettings?.defaultDiscountValue || 0,
        referringDoctors: [],
        notes: "",
        labReferenceNo: "",
        sampleCollectionDate: new Date().toISOString().split("T")[0],
        expectedReportDate: new Date(Date.now() + 86400000)
          .toISOString()
          .split("T")[0],
        reportStatus: "pending_collection",
      });

      // Reload billings
      await loadData();

      setEditingInvoiceId(null);

      // Switch to manage tab
      setActiveTab("manage");
      invoiceModal.forceClose();
    } catch (error) {
      console.error("Error creating pathology invoice:", error);
      addToast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditInvoice = (billing: PathologyBilling) => {
    setEditingInvoiceId(billing.id);

    // Format dates to YYYY-MM-DD for inputs
    const formatDateForInput = (dateValue: any) => {
      if (!dateValue) return new Date().toISOString().split("T")[0];
      const d =
        dateValue instanceof Date
          ? dateValue
          : dateValue.toDate
            ? dateValue.toDate()
            : new Date(dateValue);

      return d.toISOString().split("T")[0];
    };

    setFormData({
      patientId: billing.patientId || undefined,
      patientName: billing.patientName,
      patientEmail: billing.patientEmail || "",
      patientPhone: billing.patientPhone || "",
      patientAddress: billing.patientAddress || "",
      patientAge: billing.patientAge ? billing.patientAge.toString() : "",
      patientGender: billing.patientGender || "",
      invoiceDate: formatDateForInput(billing.invoiceDate),
      items: [...billing.items],
      discountType: billing.discountType || "percent",
      discountValue: billing.discountValue || 0,
      referringDoctors: [...(billing.referringDoctors || [])],
      notes: billing.notes || "",
      labReferenceNo: billing.labReferenceNo || "",
      sampleCollectionDate: formatDateForInput(billing.sampleCollectionDate),
      expectedReportDate: formatDateForInput(billing.expectedReportDate),
      reportStatus: billing.reportStatus || "pending_collection",
    });

    setActiveTab("create");
  };

  const handleCancelInvoice = async (billing: PathologyBilling) => {
    if (
      confirm(
        "Are you sure you want to cancel this invoice? This action cannot be undone.",
      )
    ) {
      setSubmitting(true);
      try {
        await pathologyBillingService.updateBilling(billing.id!, {
          status: "cancelled",
          paymentStatus: "cancelled" as any,
        });
        setBillings((prev) =>
          prev.map((b) =>
            b.id === billing.id
              ? { ...b, status: "cancelled", paymentStatus: "cancelled" as any }
              : b,
          ),
        );
        addToast({
          title: "Success",
          description: "Invoice cancelled successfully.",
          color: "success",
        });
      } catch (err) {
        addToast({
          title: "Error",
          description: "Failed to cancel invoice.",
          color: "danger",
        });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const cancelEdit = () => {
    setEditingInvoiceId(null);
    setFormData({
      patientName: "",
      patientEmail: "",
      patientPhone: "",
      patientAddress: "",
      patientAge: "",
      patientGender: "",
      invoiceDate: new Date().toISOString().split("T")[0],
      items: [],
      discountType: billingSettings?.defaultDiscountType || "percent",
      discountValue: billingSettings?.defaultDiscountValue || 0,
      referringDoctors: [],
      notes: "",
      labReferenceNo: "",
      sampleCollectionDate: new Date().toISOString().split("T")[0],
      expectedReportDate: new Date(Date.now() + 86400000)
        .toISOString()
        .split("T")[0],
      reportStatus: "pending_collection",
    });
    setActiveTab("manage");
  };

  const handlePaymentOpen = (billing: PathologyBilling) => {
    setSelectedBillingForPayment(billing);
    setPaymentForm({
      amount: Math.round(billing.balanceAmount).toString(),
      method: billingSettings?.defaultPaymentMethod || "cash",
      reference: "",
      notes: "",
    });
    paymentModal.open();
  };

  const handlePaymentSubmit = async () => {
    if (!selectedBillingForPayment || !clinicId) return;

    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) {
      addToast({
        title: "Validation Error",
        description: "Please enter a valid payment amount",
        color: "warning",
      });

      return;
    }

    if (amount > selectedBillingForPayment.balanceAmount) {
      addToast({
        title: "Validation Error",
        description: `Payment amount cannot exceed balance of ${Math.round(selectedBillingForPayment.balanceAmount).toLocaleString()}`,
        color: "warning",
      });

      return;
    }

    try {
      setPaymentProcessing(true);

      await pathologyBillingService.recordPayment(
        selectedBillingForPayment.id,
        amount,
        paymentForm.method,
        paymentForm.reference || undefined,
        paymentForm.notes || undefined,
        currentUser.uid,
      );

      addToast({
        title: "Payment Recorded",
        description: `Payment of ${Math.round(amount).toLocaleString()} has been recorded successfully.`,
        color: "success",
      });

      // Reload billings
      const updatedBillings = await pathologyBillingService.getBillingByClinic(
        clinicId,
        branchId,
      );

      setBillings(updatedBillings);

      // Close payment modal
      paymentModal.forceClose();
      setSelectedBillingForPayment(null);
      setPaymentForm({ amount: "", method: "cash", reference: "", notes: "" });
    } catch (error) {
      console.error("Error recording payment:", error);
      addToast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        color: "danger",
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleFinalize = async (billing: PathologyBilling) => {
    if (!currentUser) return;

    try {
      setSubmitting(true);
      await pathologyBillingService.finalizeInvoice(
        billing.id,
        currentUser.uid,
      );

      addToast({
        title: "Invoice Finalized",
        description:
          "Commission details have been synced to referral profiles.",
        color: "success",
      });

      // Reload data
      await loadData();
    } catch (error) {
      console.error("Error finalizing invoice:", error);
      addToast({
        title: "Error",
        description: "Failed to finalize invoice.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };
  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "success";
      case "partial":
        return "warning";
      case "unpaid":
        return "danger";
      default:
        return "default";
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return IoCheckmark;
      case "partial":
        return IoTime;
      case "unpaid":
        return IoClose;
      default:
        return IoTime;
    }
  };

  const filteredBillings = useMemo(() => {
    if (!searchQuery.trim()) return billings;
    const query = searchQuery.toLowerCase();

    return billings.filter(
      (billing) =>
        billing.invoiceNumber.toLowerCase().includes(query) ||
        billing.patientName.toLowerCase().includes(query) ||
        (billing.patientPhone &&
          billing.patientPhone.toLowerCase().includes(query)),
    );
  }, [billings, searchQuery]);

  const formatCurrency = (amount: number) => {
    return `NPR ${Math.round(amount).toLocaleString()}`;
  };

  const getAvailablePaymentMethods = () => {
    if (!billingSettings?.paymentMethods) return [];

    return billingSettings.paymentMethods.filter((method) => method.isEnabled);
  };

  const handlePrint = (billing: PathologyBilling) => {
    if (!billing) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");

    if (!printWindow) {
      addToast({
        title: "Error",
        description:
          "Unable to open print window. Please check your browser settings.",
        color: "danger",
      });

      return;
    }

    const printContent = generateInvoiceHTML(
      billing,
      selectedPrintFormat,
      clinic,
      layoutConfig,
    );

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted">Loading billing data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border-base rounded overflow-hidden">
        {/* Tab Strip */}
        <div className="flex border-b border-border-base bg-surface-2/50">
          {[
            {
              id: "create",
              label: editingInvoiceId ? "Edit Invoice" : "Create Invoice",
              icon: <IoAddOutline className="w-4 h-4" />,
            },
            {
              id: "manage",
              label: "Manage Invoices",
              icon: <IoReceiptOutline className="w-4 h-4" />,
            },
          ].map((t) => (
            <button
              key={t.id}
              className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium border-b-2 transition-colors
              ${activeTab === t.id ? "border-primary text-primary bg-surface" : "border-transparent text-text-muted hover:text-primary hover:bg-surface-2"}`}
              type="button"
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Create Invoice Tab */}
        {activeTab === "create" && (
          <div className="p-5 flex flex-col gap-6">
            {/* Patient Information */}
            <div>
              <h3 className="text-[14px] font-semibold text-primary mb-3">
                Patient Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2 flex flex-col gap-1 relative">
                  <label className="text-[12px] font-medium text-text-muted">
                    Patient Name <span className="text-red-500">*</span>
                  </label>
                  <PatientSearchBox
                    patients={patients}
                    value={formData.patientName}
                    onChange={(v) =>
                      setFormData((prev) => ({
                        ...prev,
                        patientName: v,
                        patientId: undefined,
                      }))
                    }
                    onSelect={(p) =>
                      setFormData((prev) => ({
                        ...prev,
                        patientId: p.id,
                        patientName: p.name,
                        patientPhone: p.mobile || p.phone || "",
                        patientEmail: p.email || "",
                        patientAddress: p.address || "",
                        patientAge: p.age?.toString() || "",
                        patientGender: p.gender || "",
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Phone
                  </label>
                  <input
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    placeholder="Phone"
                    value={formData.patientPhone}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        patientPhone: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Email
                  </label>
                  <input
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    placeholder="Email"
                    type="email"
                    value={formData.patientEmail}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        patientEmail: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="lg:col-span-2 flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Address
                  </label>
                  <input
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    placeholder="Address"
                    value={formData.patientAddress}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        patientAddress: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Age
                  </label>
                  <input
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    placeholder="Age"
                    type="number"
                    value={formData.patientAge}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, patientAge: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Gender
                  </label>
                  <select
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    value={formData.patientGender}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        patientGender: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="border-t border-border-base" />

            {/* Lab Tracking & Reporting */}
            <div>
              <h3 className="text-[14px] font-semibold text-primary mb-3">
                Lab Tracking &amp; Reporting
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Lab Ref No
                  </label>
                  <input
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    placeholder="e.g. LAB-1001"
                    value={formData.labReferenceNo || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        labReferenceNo: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        invoiceDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Collection Date
                  </label>
                  <input
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    type="date"
                    value={formData.sampleCollectionDate}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        sampleCollectionDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Expected Delivery
                  </label>
                  <input
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    type="date"
                    value={formData.expectedReportDate}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        expectedReportDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Report Status
                  </label>
                  <select
                    className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-text-main"
                    value={formData.reportStatus}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        reportStatus: e.target.value as any,
                      }))
                    }
                  >
                    <option value="pending_collection">
                      Pending Collection
                    </option>
                    <option value="collected">Sample Collected</option>
                    <option value="in_lab">In Laboratory</option>
                    <option value="partially_ready">Partially Ready</option>
                    <option value="ready">Report Ready</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="border-t border-border-base" />

            {/* Test Items */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[14px] font-semibold text-primary">
                  Test Items
                </h3>
                <Button
                  color="primary"
                  size="sm"
                  startContent={<IoAddOutline />}
                  onPress={addInvoiceItem}
                >
                  Add Test
                </Button>
              </div>

              {formData.items.length > 0 ? (
                <div className="space-y-2">
                  <datalist id="test-catalog-list">
                    {testCatalog.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.type}
                      </option>
                    ))}
                  </datalist>
                  <datalist id="test-types-list">
                    {testTypes.map((t) => (
                      <option key={t.id} value={t.name} />
                    ))}
                  </datalist>

                  {/* Header row */}
                  <div className="hidden md:grid grid-cols-[3.5fr_1.2fr_0.5fr_1fr_0.75fr_1fr_1fr_1.2fr_auto] gap-3 px-3 pb-2 items-center">
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Test Name
                    </div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Sample
                    </div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider text-center">
                      Urgent
                    </div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Price
                    </div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Qty
                    </div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Disc. Type
                    </div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Disc. Val
                    </div>
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Amount
                    </div>
                    <div className="w-[32px]" />
                  </div>

                  {formData.items.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-[3.5fr_1.2fr_0.5fr_1fr_0.75fr_1fr_1fr_1.2fr_auto] gap-3 items-center p-3 md:p-1.5 border border-border-base rounded-lg md:border-transparent md:rounded-none md:border-b md:border-border-base/50 md:bg-transparent bg-surface-2/20"
                    >
                      <div>
                        <label className="md:hidden text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 block">
                          Test Name
                        </label>
                        <input
                          className="w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main"
                          list="test-types-list"
                          placeholder="Select Test"
                          value={item.testName}
                          onChange={(e) =>
                            updateInvoiceItem(index, "testName", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="md:hidden text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 block">
                          Sample
                        </label>
                        <select
                          className="w-full h-9 px-2 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main"
                          value={item.sampleType || ""}
                          onChange={(e) =>
                            updateInvoiceItem(
                              index,
                              "sampleType",
                              e.target.value,
                            )
                          }
                        >
                          <option value="">Select</option>
                          <option value="Blood">Blood</option>
                          <option value="Urine">Urine</option>
                          <option value="Stool">Stool</option>
                          <option value="Swab">Swab</option>
                          <option value="Sputum">Sputum</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="flex flex-col items-start md:items-center">
                        <label className="md:hidden text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 block">
                          Urgent
                        </label>
                        <input
                          checked={item.isUrgent}
                          className="w-4 h-4 cursor-pointer accent-primary"
                          type="checkbox"
                          onChange={(e) =>
                            updateInvoiceItem(
                              index,
                              "isUrgent",
                              e.target.checked,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="md:hidden text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 block">
                          Price
                        </label>
                        <input
                          className="w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main"
                          placeholder="0"
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            updateInvoiceItem(
                              index,
                              "price",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="md:hidden text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 block">
                          Qty
                        </label>
                        <input
                          className="w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main"
                          min={1}
                          placeholder="1"
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateInvoiceItem(
                              index,
                              "quantity",
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="md:hidden text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 block">
                          Disc. Type
                        </label>
                        <select
                          className="w-full h-9 px-2 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main"
                          value={item.discountType || "percent"}
                          onChange={(e) =>
                            updateInvoiceItem(
                              index,
                              "discountType",
                              e.target.value,
                            )
                          }
                        >
                          <option value="percent">%</option>
                          <option value="flat">Flat</option>
                        </select>
                      </div>
                      <div>
                        <label className="md:hidden text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 block">
                          Disc. Val
                        </label>
                        <input
                          className="w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main"
                          min={0}
                          placeholder="0"
                          type="number"
                          value={item.discountValue || ""}
                          onChange={(e) =>
                            updateInvoiceItem(
                              index,
                              "discountValue",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="md:hidden text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 block">
                          Amount
                        </label>
                        <div className="w-full h-9 flex items-center px-2.5 border border-border-base/50 rounded bg-surface-2 text-[12.5px] font-semibold text-text-main">
                          {item.amount.toFixed(0)}
                        </div>
                      </div>
                      <div className="flex justify-end md:justify-center items-center">
                        <Button
                          isIconOnly
                          color="danger"
                          size="sm"
                          variant="light"
                          onPress={() => removeInvoiceItem(index)}
                        >
                          <IoTrashOutline className="text-[16px]" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-default-500 text-sm">
                  No items added yet. Click "Add Test" to add items.
                </p>
              )}
            </div>

            {/* Referral Source Section */}
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 py-2 border-b border-default-100">
                <div>
                  <h3 className="text-[13px] font-bold text-default-800">
                    Referral Sources
                  </h3>
                  <p className="text-xs text-default-500">
                    Search and add doctors or partners for this invoice
                  </p>
                </div>
                <div className="w-full md:w-80">
                  <Autocomplete
                    aria-label="Add Referral Source"
                    classNames={{
                      base: "max-w-full",
                    }}
                    placeholder="Search source..."
                    radius="lg"
                    size="sm"
                    startContent={
                      <IoSearchOutline className="text-default-400" />
                    }
                    variant="flat"
                    onSelectionChange={(key) => {
                      if (key) addReferralSource(key.toString());
                    }}
                  >
                    {allReferralSources.map((source) => (
                      <AutocompleteItem
                        key={source.id}
                        startContent={
                          <div
                            className={`p-1 rounded-md ${source.type === "doctor" ? "bg-primary-50" : "bg-secondary-50"}`}
                          >
                            {source.icon}
                          </div>
                        }
                        textValue={source.name}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {source.name}
                          </span>
                          <span className="text-xs text-default-400 capitalize">
                            {source.type}
                          </span>
                        </div>
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>
                </div>
              </div>

              {formData.referringDoctors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 bg-surface-2/50 rounded-xl border-2 border-dashed border-border-base transition-all hover:bg-surface-2">
                  <div className="p-2 rounded-full bg-surface shadow-sm mb-2">
                    <IoMedkitOutline className="text-xl text-primary/60" />
                  </div>
                  <p className="text-sm font-medium text-default-600">
                    No referral sources added yet
                  </p>
                  <p className="text-xs text-default-400 mt-1">
                    Use the search bar above to add doctors or partners
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.referringDoctors.map((refDoc, index) => {
                    const sourceInfo = allReferralSources.find(
                      (s) => s.id === refDoc.doctorId,
                    );

                    return (
                      <div
                        key={index}
                        className="bg-surface border border-border-base rounded-lg p-2 transition-all hover:shadow-sm group"
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* Left: Info */}
                          <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                            <div
                              className={`p-2.5 rounded-xl ${refDoc.type === "doctor" ? "bg-primary-50 text-primary" : "bg-secondary-50 text-secondary"}`}
                            >
                              {refDoc.type === "doctor" ? (
                                <IoMedkitOutline size={20} />
                              ) : (
                                <IoBusinessOutline size={20} />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <p className="font-bold text-default-800 truncate">
                                {refDoc.doctorName}
                              </p>
                              <span
                                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${refDoc.type === "doctor" ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-700"}`}
                              >
                                {refDoc.type}
                              </span>
                            </div>
                          </div>

                          {/* Middle: Controls */}
                          <div className="col-span-12 md:col-span-7 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 bg-surface-2 p-1.5 rounded-lg border border-border-base/50">
                              <Select
                                aria-label="Commission Type"
                                className="w-28"
                                selectedKeys={[refDoc.commissionType]}
                                size="sm"
                                variant="flat"
                                onSelectionChange={(keys) => {
                                  const type = Array.from(keys)[0] as
                                    | "percent"
                                    | "flat";

                                  updateReferringDoctor(index, {
                                    commissionType: type,
                                  });
                                }}
                              >
                                <SelectItem key="percent" textValue="% Percent">
                                  % Percent
                                </SelectItem>
                                <SelectItem key="flat" textValue="NPR Flat">
                                  NPR Flat
                                </SelectItem>
                              </Select>
                              <Input
                                aria-label="Commission Value"
                                className="w-20"
                                size="sm"
                                type="number"
                                value={refDoc.commissionValue.toString()}
                                variant="flat"
                                onValueChange={(val) =>
                                  updateReferringDoctor(index, {
                                    commissionValue: parseFloat(val) || 0,
                                  })
                                }
                              />
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[10px] text-default-400 font-bold uppercase tracking-wider">
                                Estimated Earned
                              </span>
                              <span className="text-md font-black text-primary">
                                {Math.round(
                                  refDoc.calculatedAmount,
                                ).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Right: Action */}
                          <div className="col-span-12 md:col-span-1 flex justify-end">
                            <Button
                              isIconOnly
                              className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                              color="danger"
                              size="sm"
                              variant="light"
                              onPress={() => removeReferringDoctor(index)}
                            >
                              <IoTrashOutline className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border-base pt-4">
              <div className="space-y-3">
                <h3 className="text-[14px] font-semibold text-primary">
                  Invoice Discount &amp; Notes
                </h3>
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[12px] font-medium text-text-muted">
                      Discount Type
                    </label>
                    <select
                      className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main"
                      value={formData.discountType}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          discountType: e.target.value as "percent" | "flat",
                        }))
                      }
                    >
                      <option value="percent">Percentage (%)</option>
                      <option value="flat">Flat Amount (NPR)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[12px] font-medium text-text-muted">
                      Discount Value
                    </label>
                    <input
                      className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main"
                      min={0}
                      placeholder="0"
                      type="number"
                      value={formData.discountValue}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          discountValue: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-text-muted">
                    Notes
                  </label>
                  <textarea
                    className="px-2.5 py-2 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary text-text-main resize-none"
                    placeholder="Additional notes (optional)"
                    rows={2}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, notes: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="bg-surface-2/30 p-3 rounded-lg border border-border-base">
                <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">
                  Summary
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-[13px] text-text-muted">
                    <span>Subtotal:</span>
                    <span className="font-medium">
                      {formatCurrency(calculations.subtotal)}
                    </span>
                  </div>
                  {calculations.itemDiscountAmount > 0 && (
                    <div className="flex justify-between text-[13px] text-danger-500">
                      <span>Item Discount:</span>
                      <span>
                        - {formatCurrency(calculations.itemDiscountAmount)}
                      </span>
                    </div>
                  )}
                  {calculations.mainDiscountAmount > 0 && (
                    <div className="flex justify-between text-[13px] text-danger-500">
                      <span>Invoice Discount:</span>
                      <span>
                        - {formatCurrency(calculations.mainDiscountAmount)}
                      </span>
                    </div>
                  )}
                  {calculations.totalDiscount > 0 && (
                    <div className="flex justify-between text-[13px] font-semibold text-danger-600 border-t border-border-base/50 pt-1">
                      <span>Total Discount:</span>
                      <span>
                        - {formatCurrency(calculations.totalDiscount)}
                      </span>
                    </div>
                  )}
                  {billingSettings?.enableTax && calculations.taxAmount > 0 && (
                    <div className="flex justify-between text-[13px] text-text-muted">
                      <span>
                        Tax ({billingSettings.defaultTaxPercentage}%):
                      </span>
                      <span>{formatCurrency(calculations.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[16px] font-black text-primary border-t border-primary/20 pt-1 mt-1">
                    <span>Total:</span>
                    <span>{formatCurrency(calculations.totalAmount)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  {editingInvoiceId && (
                    <Button
                      className="w-full md:w-auto px-6 font-medium"
                      color="default"
                      size="md"
                      variant="flat"
                      onPress={cancelEdit}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    className="w-full md:w-auto px-10 font-bold"
                    color="primary"
                    isDisabled={
                      !formData.patientName.trim() ||
                      formData.items.length === 0
                    }
                    isLoading={submitting}
                    size="md"
                    onPress={handleSubmit}
                  >
                    {editingInvoiceId ? "Update Invoice" : "Create Invoice"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manage Invoices Tab */}
        {activeTab === "manage" && (
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="relative">
                <IoSearchOutline className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/50 w-4 h-4" />
                <input
                  className="pl-8 pr-3 h-9 text-[12.5px] border border-border-base rounded bg-surface focus:outline-none focus:border-primary w-72 text-text-main placeholder:text-text-muted/40"
                  placeholder="Search by invoice number or patient name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filteredBillings.length > 0 ? (
              <Table aria-label="Pathology invoices table">
                <TableHeader>
                  <TableColumn>INVOICE #</TableColumn>
                  <TableColumn>DATE</TableColumn>
                  <TableColumn>PATIENT</TableColumn>
                  <TableColumn>ITEMS</TableColumn>
                  <TableColumn>TOTAL</TableColumn>
                  <TableColumn>PAID</TableColumn>
                  <TableColumn>BALANCE</TableColumn>
                  <TableColumn>STATUS</TableColumn>
                  <TableColumn align="center">Actions</TableColumn>
                </TableHeader>
                <TableBody>
                  {filteredBillings.map((billing) => {
                    const StatusIcon = getPaymentStatusIcon(
                      billing.paymentStatus,
                    );

                    return (
                      <TableRow key={billing.id}>
                        <TableCell>
                          <span className="font-medium">
                            {billing.invoiceNumber}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(billing.invoiceDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{billing.patientName}</p>
                            {billing.patientPhone && (
                              <p className="text-xs text-default-500">
                                {billing.patientPhone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{billing.items.length}</TableCell>
                        <TableCell>
                          {formatCurrency(billing.totalAmount)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(billing.paidAmount)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              billing.balanceAmount > 0
                                ? "text-danger font-semibold"
                                : "text-success font-semibold"
                            }
                          >
                            {formatCurrency(billing.balanceAmount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Chip
                            color={getPaymentStatusColor(billing.paymentStatus)}
                            size="sm"
                            startContent={<StatusIcon size={14} />}
                            variant="flat"
                          >
                            {billing.paymentStatus.toUpperCase()}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            {billing.status === "draft" && (
                              <Button
                                isIconOnly
                                color="primary"
                                isLoading={submitting}
                                size="sm"
                                title="Finalize"
                                variant="light"
                                onPress={() => handleFinalize(billing)}
                              >
                                <IoCheckmark className="text-lg" />
                              </Button>
                            )}
                            <Button
                              isIconOnly
                              color="warning"
                              size="sm"
                              title="Record Test Results"
                              variant="light"
                              onPress={() => onRecordResults?.(billing)}
                            >
                              <IoMedkitOutline className="text-lg" />
                            </Button>
                            {billing.balanceAmount > 0 &&
                              billing.status !== "draft" && (
                                <Button
                                  isIconOnly
                                  color="success"
                                  size="sm"
                                  title="Pay"
                                  variant="light"
                                  onPress={() => handlePaymentOpen(billing)}
                                >
                                  <IoWalletOutline className="text-lg" />
                                </Button>
                              )}
                            {billing.status !== "cancelled" &&
                              billing.status !== "finalized" &&
                              billing.paymentStatus !== "paid" && (
                                <Button
                                  isIconOnly
                                  color="danger"
                                  isLoading={submitting}
                                  size="sm"
                                  title="Cancel Invoice"
                                  variant="light"
                                  onPress={() => handleCancelInvoice(billing)}
                                >
                                  <IoCloseCircleOutline className="text-lg" />
                                </Button>
                              )}
                            <Button
                              isIconOnly
                              size="sm"
                              title="Edit"
                              variant="light"
                              onPress={() => handleEditInvoice(billing)}
                            >
                              <IoPencilOutline className="text-lg text-default-500 hover:text-primary" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              title="Print"
                              variant="light"
                              onPress={() => handlePrint(billing)}
                            >
                              <IoPrintOutline className="text-lg text-default-500 hover:text-primary" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              title="View"
                              variant="light"
                              onPress={() => {
                                setSelectedBilling(billing);
                                invoiceModal.open();
                              }}
                            >
                              <IoEyeOutline className="text-lg text-default-500 hover:text-primary" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <p className="text-default-500">
                  {searchQuery ? "No invoices found" : "No invoices yet"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={paymentModal.isOpen}
        size="lg"
        onClose={paymentModal.close}
      >
        <ModalContent>
          <ModalHeader>Record Payment</ModalHeader>
          <ModalBody className="space-y-4">
            {selectedBillingForPayment && (
              <>
                <div>
                  <p className="text-sm text-default-500">Invoice Number</p>
                  <p className="font-medium">
                    {selectedBillingForPayment.invoiceNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-default-500">Patient</p>
                  <p className="font-medium">
                    {selectedBillingForPayment.patientName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-default-500">Total Amount</p>
                  <p className="font-medium">
                    {formatCurrency(selectedBillingForPayment.totalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-default-500">Balance</p>
                  <p className="font-medium text-danger">
                    {formatCurrency(selectedBillingForPayment.balanceAmount)}
                  </p>
                </div>
                <Input
                  isRequired
                  label="Payment Amount *"
                  type="number"
                  value={paymentForm.amount}
                  onValueChange={(value) =>
                    setPaymentForm((prev) => ({ ...prev, amount: value }))
                  }
                />
                <Select
                  isRequired
                  disallowEmptySelection={false}
                  label="Payment Method *"
                  selectedKeys={
                    paymentForm.method
                      ? new Set([paymentForm.method])
                      : new Set()
                  }
                  onSelectionChange={(keys) => {
                    const selectedKey = Array.from(keys)[0] as string;

                    if (selectedKey) {
                      setPaymentForm((prev) => ({
                        ...prev,
                        method: selectedKey,
                      }));
                    }
                  }}
                >
                  {getAvailablePaymentMethods().map((method) => {
                    const displayText =
                      `${method.icon || ""} ${method.name} `.trim();

                    return (
                      <SelectItem key={method.key} textValue={method.name}>
                        {displayText}
                      </SelectItem>
                    );
                  })}
                </Select>
                <Input
                  label="Reference/Transaction ID"
                  placeholder="Optional"
                  value={paymentForm.reference}
                  onValueChange={(value) =>
                    setPaymentForm((prev) => ({ ...prev, reference: value }))
                  }
                />
                <Input
                  label="Notes"
                  placeholder="Optional payment notes"
                  value={paymentForm.notes}
                  onValueChange={(value) =>
                    setPaymentForm((prev) => ({ ...prev, notes: value }))
                  }
                />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={paymentModal.close}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={paymentProcessing}
              onPress={handlePaymentSubmit}
            >
              Record Payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View Invoice Modal */}
      <Modal
        isOpen={invoiceModal.isOpen}
        size="2xl"
        onClose={invoiceModal.close}
      >
        <ModalContent>
          <ModalHeader>
            Invoice Details - {selectedBilling?.invoiceNumber}
          </ModalHeader>
          <ModalBody>
            {selectedBilling && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-muted">Patient Name</p>
                    <p className="font-medium">{selectedBilling.patientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">Invoice Date</p>
                    <p className="font-medium">
                      {new Date(
                        selectedBilling.invoiceDate,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedBilling.patientPhone && (
                    <div>
                      <p className="text-sm text-text-muted">Phone</p>
                      <p className="font-medium">
                        {selectedBilling.patientPhone}
                      </p>
                    </div>
                  )}
                  {selectedBilling.patientEmail && (
                    <div>
                      <p className="text-sm text-text-muted">Email</p>
                      <p className="font-medium">
                        {selectedBilling.patientEmail}
                      </p>
                    </div>
                  )}
                  {selectedBilling.patientAge && (
                    <div>
                      <p className="text-sm text-text-muted">Age</p>
                      <p className="font-medium">
                        {selectedBilling.patientAge}
                      </p>
                    </div>
                  )}
                  {selectedBilling.patientGender && (
                    <div>
                      <p className="text-sm text-text-muted">Gender</p>
                      <p className="font-medium">
                        {selectedBilling.patientGender.charAt(0).toUpperCase() +
                          selectedBilling.patientGender.slice(1)}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-text-muted mb-2">Test Items</p>
                  <Table>
                    <TableHeader>
                      <TableColumn>Test Name</TableColumn>
                      <TableColumn>Price</TableColumn>
                      <TableColumn>Quantity</TableColumn>
                      <TableColumn>Amount</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {selectedBilling.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.testName}
                            {item.testType && (
                              <span className="text-default-500 text-sm">
                                {" "}
                                ({item.testType})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(item.price)}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(selectedBilling.subtotal)}</span>
                    </div>
                    {selectedBilling.discountAmount > 0 && (
                      <div className="flex justify-between text-warning">
                        <span>Discount:</span>
                        <span>
                          -{formatCurrency(selectedBilling.discountAmount)}
                        </span>
                      </div>
                    )}
                    {selectedBilling.taxAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({selectedBilling.taxPercentage}%):</span>
                        <span>{formatCurrency(selectedBilling.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(selectedBilling.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid:</span>
                      <span className="text-success">
                        {formatCurrency(selectedBilling.paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Balance:</span>
                      <span
                        className={
                          selectedBilling.balanceAmount > 0
                            ? "text-danger font-semibold"
                            : "text-success font-semibold"
                        }
                      >
                        {formatCurrency(selectedBilling.balanceAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedBilling.paymentHistory &&
                  selectedBilling.paymentHistory.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-success/20 bg-success-50/50 p-3 rounded-lg">
                      <h5 className="text-[11px] font-semibold text-success-700 mb-2 uppercase tracking-wider">
                        Payment History
                      </h5>
                      <div className="space-y-2">
                        {selectedBilling.paymentHistory.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="bg-white/60 p-2 rounded text-[11px] flex justify-between items-center border border-success/10"
                          >
                            <div>
                              <p className="font-semibold text-success-800">
                                {formatCurrency(p.amount)}
                              </p>
                              <p className="text-default-500 mt-0.5">
                                {p.method.charAt(0).toUpperCase() +
                                  p.method.slice(1)}{" "}
                                •{" "}
                                {new Date(p.date).toLocaleString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              {p.reference && (
                                <p className="text-default-400 mt-0.5">
                                  Ref: {p.reference}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {selectedBilling.notes && (
                  <div>
                    <p className="text-sm text-default-500">Notes</p>
                    <p className="font-medium">{selectedBilling.notes}</p>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Select
                className="w-48"
                label="Print Format"
                selectedKeys={[selectedPrintFormat]}
                size="sm"
                onOpenChange={invoiceModal.handleDropdownInteraction}
                onSelectionChange={(keys) => {
                  const format = Array.from(keys)[0] as PrintFormat;

                  if (format) setSelectedPrintFormat(format);
                }}
              >
                <SelectItem key="A4">A4 Full Page</SelectItem>
                <SelectItem key="A4_HALF">A4 Half (A5)</SelectItem>
                <SelectItem key="THERMAL_80MM">Thermal 80mm</SelectItem>
                <SelectItem key="THERMAL_58MM">Thermal 58mm</SelectItem>
                <SelectItem key="THERMAL_4INCH">Label (4-inch)</SelectItem>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                color="primary"
                startContent={<IoPrintOutline />}
                onPress={() => {
                  if (selectedBilling) {
                    handlePrint(selectedBilling);
                  }
                }}
              >
                Print Invoice
              </Button>
              <Button variant="light" onPress={invoiceModal.close}>
                Close
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
