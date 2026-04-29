import React, { useState, useEffect, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
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
import { Tab, Tabs } from "@heroui/tabs";
import { addToast } from "@heroui/toast";
import {
  IoAddOutline,
  IoTrashOutline,
  IoEyeOutline,
  IoWalletOutline,
  IoCheckmark,
  IoTime,
  IoClose,
  IoSearchOutline,
  IoPrintOutline,
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
  ReferringDoctor,
  Doctor,
  ReferralPartner,
} from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import { generateInvoiceHTML, PrintFormat } from "@/utils/invoicePrinting";
import { doctorService } from "@/services/doctorService";
import { referralPartnerService } from "@/services/referralPartnerService";

interface PathologyBillingTabProps {
  clinicId: string;
  branchId: string;
}

interface InvoiceFormData {
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
}

export default function PathologyBillingTab({
  clinicId,
  branchId,
}: PathologyBillingTabProps) {
  const { currentUser, userData } = useAuthContext();
  const invoiceModal = useModalState(false);
  const paymentModal = useModalState(false);
  const settingsModal = useModalState(false);

  const [activeTab, setActiveTab] = useState("create");

  // Data states
  const [tests, setTests] = useState<PathologyTest[]>([]);
  const [testTypes, setTestTypes] = useState<PathologyTestType[]>([]);
  const [testNames, setTestNames] = useState<PathologyTest[]>([]);
  const [billings, setBillings] = useState<PathologyBilling[]>([]);
  const [billingSettings, setBillingSettings] =
    useState<PathologyBillingSettings | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );
  const [clinic, setClinic] = useState<any>(null);

  // Form states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBilling, setSelectedBilling] =
    useState<PathologyBilling | null>(null);

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
  });

  const [selectedPrintFormat, setSelectedPrintFormat] =
    useState<PrintFormat>("A4");

  // Calculations
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

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
        testNamesData,
        billingsData,
        settingsData,
        clinicData,
        layoutConfigData,
        doctorsList,
        partnersList,
      ] = await Promise.all([
        pathologyService.getTestsByClinic(clinicId, branchId),
        pathologyService.getTestTypesByClinic(clinicId, branchId),
        pathologyService.getTestsByClinic(clinicId, branchId),
        pathologyBillingService.getBillingByClinic(clinicId, branchId),
        pathologyBillingService.getBillingSettings(clinicId),
        clinicService.getClinicById(clinicId),
        clinicService.getPrintLayoutConfig(clinicId),
        doctorService.getDoctorsByClinic(clinicId),
        referralPartnerService.getReferralPartnersByClinic(clinicId),
      ]);

      setTests(testsData);
      setTestTypes(testTypesData);
      setTestNames(testNamesData);
      setBillings(billingsData);
      setBillingSettings(settingsData);
      setClinic(clinicData);
      setLayoutConfig(layoutConfigData);
      if (layoutConfigData?.defaultPrintFormat) {
        setSelectedPrintFormat(layoutConfigData.defaultPrintFormat as PrintFormat);
      }
      setDoctors(doctorsList);
      setPartners(partnersList);

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
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
      });

      return;
    }

    // Calculate subtotal by summing all item amounts
    const subtotal = formData.items.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );

    // Calculate tax
    const taxPercentage = billingSettings.enableTax
      ? billingSettings.defaultTaxPercentage
      : 0;
    const taxAmount = (subtotal * taxPercentage) / 100;

    // Calculate total
    const totalAmount = subtotal + taxAmount;

    // Recalculate doctor commissions based on new subtotal
    const updatedReferringDoctors = formData.referringDoctors.map((doc) => {
      let calculatedAmount = 0;

      if (doc.commissionType === "percent") {
        calculatedAmount = (subtotal * doc.commissionValue) / 100;
      } else {
        calculatedAmount = doc.commissionValue;
      }

      return { ...doc, calculatedAmount };
    });

    setCalculations({
      subtotal,
      discountAmount: 0,
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
      amount: 0,
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
      updatedItems[index] = {
        ...updatedItems[index],
        testName: value,
        // Keep testId empty for manual entries
        testId: "",
      };
    } else if (field === "testType") {
      const selectedTestType = testTypes.find((tt) => tt.name === value);

      updatedItems[index] = {
        ...updatedItems[index],
        testType: value || "",
        price: selectedTestType
          ? selectedTestType.price
          : updatedItems[index].price,
        amount:
          (selectedTestType
            ? selectedTestType.price
            : updatedItems[index].price) * updatedItems[index].quantity,
      };
    } else if (field === "quantity") {
      const qty = parseFloat(value) || 1;

      updatedItems[index] = {
        ...updatedItems[index],
        quantity: qty,
        amount: updatedItems[index].price * qty,
      };
    } else if (field === "price") {
      const price = parseFloat(value) || 0;

      updatedItems[index] = {
        ...updatedItems[index],
        price: price,
        amount: price * updatedItems[index].quantity,
      };
    } else if (field === "amount") {
      updatedItems[index] = {
        ...updatedItems[index],
        amount: parseFloat(value) || 0,
      };
    } else {
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      };
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

      // Generate invoice number
      const invoiceNumber =
        await pathologyBillingService.generateInvoiceNumber(clinicId);

      // Create billing record
      const billingData: Omit<
        PathologyBilling,
        "id" | "createdAt" | "updatedAt"
      > = {
        invoiceNumber,
        clinicId,
        branchId,
        patientName: formData.patientName.trim(),
        patientEmail: formData.patientEmail.trim() || undefined,
        patientPhone: formData.patientPhone.trim() || undefined,
        patientAddress: formData.patientAddress.trim() || undefined,
        patientAge: formData.patientAge
          ? parseInt(formData.patientAge)
          : undefined,
        patientGender: formData.patientGender.trim() || undefined,
        invoiceDate: new Date(formData.invoiceDate),
        items: formData.items,
        subtotal: calculations.subtotal,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        discountAmount: calculations.discountAmount,
        taxPercentage: billingSettings.enableTax
          ? billingSettings.defaultTaxPercentage
          : 0,
        taxAmount: calculations.taxAmount,
        totalAmount: calculations.totalAmount,
        status: "draft",
        paymentStatus: "unpaid",
        paidAmount: 0,
        balanceAmount: calculations.totalAmount,
        referringDoctors: formData.referringDoctors,
        notes: formData.notes.trim() || undefined,
        createdBy: currentUser.uid,
      };

      await pathologyBillingService.createBilling(billingData);

      addToast({
        title: "Success",
        description: "Pathology invoice created successfully",
        color: "success",
      });

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
      });

      // Reload billings
      await loadData();

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

  const handlePaymentOpen = (billing: PathologyBilling) => {
    setSelectedBillingForPayment(billing);
    setPaymentForm({
      amount: billing.balanceAmount.toString(),
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
        description: `Payment amount cannot exceed balance of ${selectedBillingForPayment.balanceAmount.toLocaleString()}`,
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
      );

      addToast({
        title: "Payment Recorded",
        description: `Payment of ${amount.toLocaleString()} has been recorded successfully.`,
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
    return `NPR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      <Tabs
        className="w-full"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
      >
        {/* Create Invoice Tab */}
        <Tab key="create" title="Create Invoice">
          <div className="space-y-4 py-4">
            <Card className="border border-border-base" shadow="none">
              <CardHeader>
                <h3 className="text-lg font-semibold">New Pathology Invoice</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                {/* Patient Information */}
                <div>
                  <h4 className="text-md font-medium mb-3">
                    Patient Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      isRequired
                      label="Patient Name *"
                      placeholder="Enter patient name"
                      value={formData.patientName}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, patientName: value }))
                      }
                    />
                    <Input
                      label="Phone"
                      placeholder="Enter phone number"
                      value={formData.patientPhone}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          patientPhone: value,
                        }))
                      }
                    />
                    <Input
                      label="Email"
                      placeholder="Enter email address"
                      type="email"
                      value={formData.patientEmail}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          patientEmail: value,
                        }))
                      }
                    />
                    <Input
                      label="Address"
                      placeholder="Enter address"
                      value={formData.patientAddress}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          patientAddress: value,
                        }))
                      }
                    />
                    <Input
                      label="Age"
                      placeholder="Enter age"
                      type="number"
                      value={formData.patientAge}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, patientAge: value }))
                      }
                    />
                    <Select
                      label="Gender"
                      placeholder="Select gender"
                      selectedKeys={
                        formData.patientGender ? [formData.patientGender] : []
                      }
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;

                        setFormData((prev) => ({
                          ...prev,
                          patientGender: selected || "",
                        }));
                      }}
                    >
                      <SelectItem key="male">Male</SelectItem>
                      <SelectItem key="female">Female</SelectItem>
                      <SelectItem key="other">Other</SelectItem>
                    </Select>
                  </div>
                </div>

                {/* Invoice Items */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-md font-medium">Test Items</h4>
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
                      {formData.items.map((item, index) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg"
                        >
                          <div className="col-span-3">
                            <Autocomplete
                              isRequired
                              defaultItems={testNames}
                              label="Test Name *"
                              placeholder="Search and select test name"
                              popoverProps={{
                                shouldCloseOnBlur: false,
                                classNames: {
                                  content: "max-h-60 overflow-auto z-[1001]",
                                },
                              }}
                              selectedKey={item.testName || null}
                              onOpenChange={
                                invoiceModal.handleDropdownInteraction
                              }
                              onSelectionChange={(key) => {
                                const selectedName = key ? key.toString() : "";

                                updateInvoiceItem(
                                  index,
                                  "testName",
                                  selectedName,
                                );
                              }}
                            >
                              {(testName) => (
                                <AutocompleteItem
                                  key={testName.testName}
                                  textValue={testName.testName}
                                >
                                  {testName.testName}
                                </AutocompleteItem>
                              )}
                            </Autocomplete>
                          </div>
                          <div className="col-span-3">
                            <Autocomplete
                              defaultItems={testTypes}
                              label="Test Type"
                              placeholder="Search and select test type"
                              popoverProps={{
                                shouldCloseOnBlur: false,
                                classNames: {
                                  content: "max-h-60 overflow-auto z-[1001]",
                                },
                              }}
                              selectedKey={item.testType || null}
                              onOpenChange={
                                invoiceModal.handleDropdownInteraction
                              }
                              onSelectionChange={(key) => {
                                const selectedName = key ? key.toString() : "";

                                updateInvoiceItem(
                                  index,
                                  "testType",
                                  selectedName || "",
                                );
                              }}
                            >
                              {(testType) => (
                                <AutocompleteItem
                                  key={testType.name}
                                  textValue={`${testType.name} - NPR ${testType.price.toFixed(2)} `}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-small">
                                      {testType.name}
                                    </span>
                                    <span className="text-tiny text-default-400">
                                      NPR {testType.price.toFixed(2)}
                                    </span>
                                  </div>
                                </AutocompleteItem>
                              )}
                            </Autocomplete>
                          </div>
                          <div className="col-span-2">
                            <Input
                              isRequired
                              label="Price *"
                              placeholder="0.00"
                              type="number"
                              value={item.price.toString()}
                              onValueChange={(value) =>
                                updateInvoiceItem(index, "price", value)
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              isRequired
                              label="Quantity *"
                              min={1}
                              placeholder="1"
                              type="number"
                              value={item.quantity.toString()}
                              onValueChange={(value) =>
                                updateInvoiceItem(index, "quantity", value)
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              isRequired
                              label="Amount *"
                              placeholder="0.00"
                              type="number"
                              value={item.amount.toString()}
                              onValueChange={(value) =>
                                updateInvoiceItem(index, "amount", value)
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Button
                              color="danger"
                              size="sm"
                              startContent={<IoTrashOutline />}
                              variant="light"
                              onPress={() => removeInvoiceItem(index)}
                            >
                              Remove
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
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-3 border-b border-default-100">
                    <div>
                      <h3 className="text-lg font-bold text-default-800">
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
                        placeholder="Search doctor or partner..."
                        radius="full"
                        size="sm"
                        startContent={
                          <IoSearchOutline className="text-default-400" />
                        }
                        variant="bordered"
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
                    <div className="flex flex-col items-center justify-center py-12 bg-surface-2/50 rounded-2xl border-2 border-dashed border-border-base transition-all hover:bg-surface-2">
                      <div className="p-4 rounded-full bg-surface shadow-sm mb-3">
                        <IoMedkitOutline className="text-3xl text-primary/60" />
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
                            className="bg-surface border border-border-base rounded-xl p-4 transition-all hover:shadow-md group"
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
                                    <SelectItem
                                      key="percent"
                                      textValue="% Percent"
                                    >
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
                                    NPR{" "}
                                    {refDoc.calculatedAmount.toLocaleString()}
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

                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">
                        {formatCurrency(calculations.subtotal)}
                      </span>
                    </div>
                    {billingSettings?.enableTax &&
                      calculations.taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span>
                            Tax ({billingSettings.defaultTaxPercentage}%):
                          </span>
                          <span>{formatCurrency(calculations.taxAmount)}</span>
                        </div>
                      )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(calculations.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                <Input
                  label="Notes"
                  placeholder="Additional notes (optional)"
                  value={formData.notes}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, notes: value }))
                  }
                />

                <div className="flex justify-end pt-2">
                  <Button
                    className="px-8"
                    color="primary"
                    isDisabled={
                      !formData.patientName.trim() || formData.items.length === 0
                    }
                    isLoading={submitting}
                    size="lg"
                    onPress={handleSubmit}
                  >
                    Create Invoice
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        {/* Manage Invoices Tab */}
        <Tab key="manage" title="Manage Invoices">
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <Input
                className="w-80"
                placeholder="Search by invoice number or patient name..."
                startContent={<IoSearchOutline />}
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
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
        </Tab>
      </Tabs>

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
