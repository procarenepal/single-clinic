/**
 * Edit Invoice Page — Clinic Clarity, zero HeroUI
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoReceiptOutline,
  IoAddOutline,
  IoTrashOutline,
  IoArrowBackOutline,
  IoSearchOutline,
  IoCloseOutline,
} from "react-icons/io5";

import DashboardNotFoundPage from "../../not-found";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import {
  AppointmentBilling,
  AppointmentBillingItem,
  AppointmentBillingSettings,
  Patient,
  Doctor,
  AppointmentType,
} from "@/types/models";

// ── Types ───────────────────────────────────────────────────────────────────
interface InvoiceFormData {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorType: "regular" | "visitor";
  invoiceDate: string;
  items: AppointmentBillingItem[];
  discountType: "flat" | "percent";
  discountValue: number;
  notes: string;
}

// ── Custom UI Helpers ────────────────────────────────────────────────────────
function SearchSelect({
  label,
  items,
  value,
  onChange,
  disabled,
  required,
  hint,
  placeholder,
  allowCustom,
  onCustomAdd,
  hideLabelDesktop,
}: {
  label?: string;
  hideLabelDesktop?: boolean;
  items: { id: string; primary: string; secondary?: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  allowCustom?: boolean;
  onCustomAdd?: (value: string) => void;
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
    <div className="flex flex-col gap-1.5 relative w-full">
      {label && (
        <label className={`text-[13px] font-medium text-mountain-700 ${hideLabelDesktop ? 'xl:hidden' : ''}`}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex flex-wrap items-center min-h-[38px] border border-mountain-200 rounded focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100 bg-white ${disabled ? "bg-mountain-50" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-3 w-4 h-4 text-mountain-400 shrink-0" />
        <input
          className="flex-1 text-[13.5px] px-2 py-1.5 bg-transparent focus:outline-none text-mountain-800 placeholder:text-mountain-400 w-full"
          disabled={disabled}
          placeholder={
            selected && !open
              ? selected.primary
              : allowCustom && value && value.startsWith("custom_")
                ? items.find(i => i.id === value)?.primary || placeholder || "Custom Service"
                : placeholder || `Search…`
          }
          value={open ? q : selected ? selected.primary : allowCustom && value && value.startsWith("custom_") ? items.find(i => i.id === value)?.primary || "Custom Service" : ""}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && !disabled && (
          <button
            className="mr-3 text-mountain-400 hover:text-mountain-700"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQ("");
            }}
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        )}
      </div>
      {hint && <p className="text-[11.5px] text-mountain-500 mt-0.5">{hint}</p>}
      {open && !disabled && (
        <>
          <div
            className="fixed inset-0 z-[50] bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute z-[60] top-full mt-1 left-0 right-0 bg-white border border-mountain-200 rounded shadow-lg max-h-60 overflow-y-auto">
            {filtered.length === 0 && (!allowCustom || !q) ? (
              <p className="px-3 py-3 text-[13px] text-mountain-500 text-center">
                No results
              </p>
            ) : (
              <>
                {filtered.map((i) => (
                  <button
                    key={i.id}
                    className={`flex flex-col w-full text-left px-3 py-2 hover:bg-teal-50 border-b border-mountain-50 last:border-0 ${i.id === value ? "bg-teal-50/50" : ""}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(i.id);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <span className="text-[13.5px] font-medium text-mountain-800 leading-tight">
                      {i.primary}
                    </span>
                    {i.secondary && (
                      <span className="text-[11.5px] text-mountain-500 mt-0.5 leading-tight">
                        {i.secondary}
                      </span>
                    )}
                  </button>
                ))}
                {allowCustom && q && !items.find(i => i.primary.toLowerCase() === q.toLowerCase()) && (
                  <button
                    className="flex flex-col w-full text-left px-3 py-2 hover:bg-teal-50 border-t border-mountain-100"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onCustomAdd) onCustomAdd(q);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <span className="text-[13.5px] font-medium text-teal-700 leading-tight">
                      + Add custom service: "{q}"
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CustomInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  description,
  disabled,
  readOnly,
  startContent,
  endContent,
  min,
  step,
  className,
  hideLabelDesktop,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full relative ${className || ""}`}>
      {label && (
        <label className={`text-[13px] font-medium text-mountain-700 ${hideLabelDesktop ? 'xl:hidden' : ''}`}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border border-mountain-200 rounded min-h-[38px] bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100 ${disabled || readOnly ? "bg-mountain-50" : ""}`}
      >
        {startContent && (
          <div className="px-3 border-r border-mountain-100 h-full flex items-center bg-mountain-50 text-[12.5px] text-mountain-500">
            {startContent}
          </div>
        )}
        <input
          className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-mountain-800 placeholder:text-mountain-400 disabled:text-mountain-500"
          disabled={disabled}
          min={min}
          name={name}
          placeholder={placeholder}
          readOnly={readOnly}
          required={required}
          step={step}
          type={type}
          value={value}
          onChange={onChange}
        />
        {endContent && (
          <div className="px-3 border-l border-mountain-100 h-full flex items-center bg-mountain-50 text-[12.5px] text-mountain-500">
            {endContent}
          </div>
        )}
      </div>
      {description && (
        <p className="text-[11.5px] text-mountain-500">{description}</p>
      )}
    </div>
  );
}

function CustomSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  required,
}: any) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        className="h-[38px] bg-white border border-mountain-200 text-mountain-800 text-[13.5px] rounded px-3 py-1 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100 transition-shadow disabled:bg-mountain-50 disabled:text-mountain-500"
        disabled={disabled}
        value={value}
        onChange={onChange}
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function EditInvoicePage() {
  const { id: invoiceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser, userData, branchId } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [invoice, setInvoice] = useState<AppointmentBilling | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [billingSettings, setBillingSettings] =
    useState<AppointmentBillingSettings | null>(null);

  // Form data
  const [formData, setFormData] = useState<InvoiceFormData>({
    patientId: "",
    patientName: "",
    doctorId: "",
    doctorName: "",
    doctorType: "regular",
    invoiceDate: new Date().toISOString().split("T")[0],
    items: [],
    discountType: "percent",
    discountValue: 0,
    notes: "",
  });

  // Calculations
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    itemDiscountAmount: 0,
    mainDiscountAmount: 0,
    totalDiscount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    loadData();
  }, [clinicId, invoiceId]);

  useEffect(() => {
    calculateTotals();
  }, [
    formData.items,
    formData.discountType,
    formData.discountValue,
    billingSettings,
  ]);

  const loadData = async () => {
    if (!clinicId || !invoiceId) return;

    try {
      setLoading(true);
      setError(null);

      const settings =
        await appointmentBillingService.getBillingSettings(clinicId);

      if (!settings || !settings.enabledByAdmin || !settings.isActive) {
        setError("Billing is not enabled for this clinic");

        return;
      }
      setBillingSettings(settings);

      const invoiceData =
        await appointmentBillingService.getBillingById(invoiceId);

      if (!invoiceData || invoiceData.clinicId !== clinicId) {
        setError("Invoice not found");

        return;
      }

      if (branchId && invoiceData.branchId !== branchId) {
        setError("You can only edit invoices for your branch.");
        addToast({
          title: "Access denied",
          description: "You can only edit invoices for your branch.",
          color: "danger",
        });
        navigate("/dashboard/appointments-billing");

        return;
      }

      const invoiceBranchId = invoiceData.branchId || undefined;
      const [patientsData, doctorsData, expertsData, appointmentTypesData] =
        await Promise.all([
          patientService.getPatientsByClinic(clinicId, invoiceBranchId),
          doctorService.getDoctorsByClinic(clinicId, invoiceBranchId),
          expertService.getExpertsByClinic(clinicId, invoiceBranchId),
          appointmentTypeService.getAppointmentTypesByClinic(
            clinicId,
            invoiceBranchId,
          ),
        ]);

      const combinedDoctors = [
        ...doctorsData,
        ...expertsData.map(
          (e) =>
            ({
              ...e,
              doctorType: e.expertType,
              nmcNumber: e.licenseNumber,
            }) as unknown as Doctor,
        ),
      ];

      setInvoice(invoiceData);
      setPatients(patientsData);
      setDoctors(combinedDoctors);
      setAppointmentTypes(appointmentTypesData);

      const invoiceDate = new Date(invoiceData.invoiceDate);

      setFormData({
        patientId: invoiceData.patientId,
        patientName: invoiceData.patientName,
        doctorId: invoiceData.doctorId,
        doctorName: invoiceData.doctorName,
        doctorType: invoiceData.doctorType,
        invoiceDate: invoiceDate.toISOString().split("T")[0],
        items: invoiceData.items.map((item) => ({
          ...item,
          id: item.id || `item_${Date.now()}_${Math.random()}`,
        })),
        discountType: invoiceData.discountType,
        discountValue: invoiceData.discountValue,
        notes: invoiceData.notes || "",
      });
    } catch (error) {
      console.error("Error loading invoice data:", error);
      setError("Failed to load invoice data. Please try again.");
      addToast({
        title: "Error",
        description: "Failed to load invoice data. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    if (!formData.items.length || !billingSettings) return;

    const totals = appointmentBillingService.calculateInvoiceTotals(
      formData.items,
      formData.discountType,
      formData.discountValue,
      billingSettings.enableTax ? billingSettings.defaultTaxPercentage : 0,
    );

    setCalculations(totals);
  };

  const addInvoiceItem = () => {
    const newItem: AppointmentBillingItem = {
      id: `item_${Date.now()}`,
      appointmentTypeId: "",
      appointmentTypeName: "",
      price: 0,
      quantity: 1,
      commission: billingSettings?.defaultCommission || 0,
      amount: 0,
    };

    setFormData((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const updateInvoiceItem = (
    index: number,
    updates: Partial<AppointmentBillingItem>,
  ) => {
    setFormData((prev) => {
      const updatedItems = [...prev.items];
      const item = { ...updatedItems[index], ...updates };

      if ("appointmentTypeId" in updates) {
        const appointmentType = appointmentTypes.find(
          (at) => at.id === updates.appointmentTypeId,
        );

        if (appointmentType) {
          item.appointmentTypeName = appointmentType.name;
          item.price = appointmentType.price;
          item.categoryId = appointmentType.categoryId;

          const selectedDoctor = doctors.find(
            (d) => d.id === (item.doctorId || prev.doctorId),
          );

          if (selectedDoctor) {
            item.commission = selectedDoctor.defaultCommission;
          }
        } else {
          // Check if it's a custom item from another row
          const customItem = prev.items.find(i => i.appointmentTypeId === updates.appointmentTypeId);
          if (customItem && updates.appointmentTypeId) {
            item.appointmentTypeName = customItem.appointmentTypeName;
            // Optionally default to the same price as the other row
            item.price = customItem.price || 0;
          }
        }
      }

      // Always recalculate amount
      const baseAmount = item.price * item.quantity;
      let discAmt = 0;
      const dVal = item.discountValue || 0;
      const dType = item.discountType || "percent";

      if (dType === "percent") {
        discAmt = (baseAmount * dVal) / 100;
      } else {
        discAmt = Math.min(dVal, baseAmount);
      }

      item.discountAmount = discAmt;
      item.amount = baseAmount - discAmt;

      updatedItems[index] = item;

      return { ...prev, items: updatedItems };
    });
  };

  const removeInvoiceItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handlePatientChange = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);

    setFormData((prev) => ({
      ...prev,
      patientId,
      patientName: patient ? patient.name : "",
    }));
  };

  const handleDoctorChange = (doctorId: string) => {
    if (!doctorId) return;
    const doctor = doctors.find((d) => d.id === doctorId);

    setFormData((prev) => ({
      ...prev,
      doctorId,
      doctorName: doctor ? doctor.name : "",
      doctorType: doctor
        ? doctor.doctorType === "visiting"
          ? "visitor"
          : "regular"
        : "regular",
    }));
  };

  const handleSubmit = async () => {
    if (!clinicId || !currentUser || !invoice || !billingSettings) return;

    if (!formData.patientId || !formData.doctorId || !formData.items.length) {
      addToast({
        title: "Validation Error",
        description:
          "Please fill in patient, doctor, and at least one invoice item.",
        color: "warning",
      });

      return;
    }

    const hasValidItems = formData.items.every(
      (item) =>
        item.appointmentTypeId &&
        item.quantity > 0 &&
        item.price >= 0,
    );

    if (!hasValidItems) {
      addToast({
        title: "Validation Error",
        description:
          "Please ensure all invoice items have valid services, quantities, and prices.",
        color: "warning",
      });

      return;
    }

    try {
      setSaving(true);

      // Derive root doctor fields from the first item
      const firstItem = formData.items[0];
      const rootDoctorId = firstItem.doctorId || "";
      const rootDoctorName = firstItem.doctorName || "";
      const rootDoctor = doctors.find((d) => d.id === rootDoctorId);
      const rootDoctorType = (
        rootDoctor?.doctorType === "visiting" ? "visitor" : "regular"
      ) as "regular" | "visitor";

      const newTotalAmount = calculations.totalAmount;
      const existingPaidAmount = invoice.paidAmount;
      const newBalanceAmount = Math.max(0, newTotalAmount - existingPaidAmount);

      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";

      if (existingPaidAmount >= newTotalAmount) paymentStatus = "paid";
      else if (existingPaidAmount > 0) paymentStatus = "partial";

      let invoiceStatus = invoice.status;

      if (paymentStatus === "paid" && invoice.status !== "cancelled") {
        invoiceStatus = "paid";
      }

      const updateData: Partial<AppointmentBilling> = {
        patientId: formData.patientId,
        patientName: formData.patientName,
        doctorId: rootDoctorId,
        doctorName: rootDoctorName,
        doctorType: rootDoctorType,
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
        totalAmount: newTotalAmount,
        balanceAmount: newBalanceAmount,
        paymentStatus,
        status: invoiceStatus,
        notes: formData.notes,
      };

      await appointmentBillingService.updateBilling(invoice.id, updateData);
      addToast({
        title: "Success",
        description: "Invoice updated successfully!",
        color: "success",
      });
      navigate(`/dashboard/appointments-billing/${invoice.id}`);
    } catch (error) {
      console.error("Error updating invoice:", error);
      addToast({
        title: "Error",
        description: "Failed to update invoice. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `NPR ${Math.round(amount).toLocaleString()}`;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={title({ size: "sm" })}>Edit Invoice</h1>
        </div>
        <div className="bg-white border border-mountain-200 rounded p-12 flex items-center justify-center shadow-sm">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (
    !billingSettings ||
    !billingSettings.enabledByAdmin ||
    !billingSettings.isActive
  ) {
    return <DashboardNotFoundPage />;
  }

  if (error || !invoice) {
    return (
      <div className="bg-white border border-mountain-200 rounded p-12 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <IoReceiptOutline className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-[15px] font-semibold text-mountain-900 mb-1">
          Error Loading Invoice
        </h3>
        <p className="text-[13.5px] text-mountain-500 mb-6">
          {error || "Invoice not found"}
        </p>
        <div className="flex justify-center gap-3">
          <Button
            variant="bordered"
            onClick={() => navigate(`/dashboard/appointments-billing/${invoiceId}`)}
          >
            Back to Invoice
          </Button>
          <Button color="primary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col justify-between items-start gap-4">
        <div>
          <h1 className={title({ size: "sm" })}>Edit Invoice</h1>
          <p className="text-[13.5px] text-mountain-500 mt-1">
            Invoice:{" "}
            <span className="font-semibold text-mountain-800">
              {invoice.invoiceNumber}
            </span>
          </p>
        </div>
        <Button
          startContent={<IoArrowBackOutline />}
          variant="bordered"
          onClick={() => navigate(`/dashboard/appointments-billing/${invoice.id}`)}
        >
          Back
        </Button>
      </div>

      <div className="bg-white border border-mountain-200 rounded shadow-sm">
        {/* Basic Information */}
        <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
          <h4 className="font-semibold text-[15px] text-mountain-900">
            Basic Information
          </h4>
        </div>
        <div className="p-6 border-b border-mountain-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SearchSelect
              required
              items={patients.map((p) => ({
                id: p.id,
                primary: p.name,
                secondary: `Reg# ${p.regNumber}`,
              }))}
              label="Patient"
              placeholder="Search patient"
              value={formData.patientId}
              onChange={(id) => handlePatientChange(id)}
            />

            <CustomInput
              required
              label="Invoice Date"
              name="invoiceDate"
              type="date"
              value={formData.invoiceDate}
              onChange={(e: any) =>
                setFormData((prev) => ({
                  ...prev,
                  invoiceDate: e.target.value,
                }))
              }
            />
          </div>
        </div>

        {/* Invoice Items */}
        <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50 flex justify-between items-center">
          <h4 className="font-semibold text-[15px] text-mountain-900">
            Invoice Details
          </h4>
          <Button
            color="primary"
            size="sm"
            startContent={<IoAddOutline />}
            onClick={addInvoiceItem}
          >
            Add Item
          </Button>
        </div>
        <div className="p-6 border-b border-mountain-100">
          {(() => {
            const currentCustomItems = formData.items
              .filter(
                (item) =>
                  item.appointmentTypeId &&
                  !appointmentTypes.some((at) => at.id === item.appointmentTypeId)
              )
              .map((item) => ({
                id: item.appointmentTypeId,
                primary: item.appointmentTypeName || "Custom Service",
                secondary: "Custom",
              }));

            const uniqueCustomItems = Array.from(
              new Map(currentCustomItems.map((item) => [item.id, item])).values()
            );

            const availableServiceOptions = appointmentTypes
              .map((at) => ({
                id: at.id,
                primary: at.name,
                secondary: `NPR ${at.price}`,
              }))
              .concat(uniqueCustomItems);

            return formData.items.length > 0 ? (
              <div className="flex flex-col gap-3">
                {/* Table Header (Desktop) */}
                <div className="hidden xl:flex items-center px-4 pb-2 text-[12px] font-semibold text-mountain-500 uppercase tracking-wider">
                  <div className="flex-1 min-w-[160px] px-1">Service</div>
                  <div className="flex-1 min-w-[160px] px-1">Doctor (Optional)</div>
                  <div className="w-[110px] shrink-0 px-1">Price (NPR)</div>
                  <div className="w-[80px] shrink-0 px-1">Qty</div>
                  <div className="w-[100px] shrink-0 px-1">Disc. Type</div>
                  <div className="w-[100px] shrink-0 px-1">Disc. Val</div>
                  <div className="w-[100px] shrink-0 px-1">Comm.</div>
                  <div className="w-[120px] shrink-0 px-1 text-right">Amount</div>
                  <div className="w-[38px] shrink-0 ml-4"></div>
                </div>

                {formData.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-4 xl:p-2 xl:px-4 border border-mountain-200 xl:border-transparent xl:border-b xl:border-mountain-100 xl:rounded-none rounded bg-white gap-4 flex flex-col xl:flex-row xl:items-center group hover:bg-mountain-50/40 transition-colors"
                  >
                    <div className="flex-1 min-w-[160px]">
                      <SearchSelect
                        items={availableServiceOptions}
                        label="Service"
                        hideLabelDesktop={true}
                        placeholder="Select service"
                        value={item.appointmentTypeId}
                        onChange={(id) =>
                          updateInvoiceItem(index, { appointmentTypeId: id })
                        }
                        allowCustom={true}
                        onCustomAdd={(val) => {
                          updateInvoiceItem(index, {
                            appointmentTypeId: `custom_${Date.now()}`,
                            appointmentTypeName: val,
                          });
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-[160px]">
                      <SearchSelect
                        items={doctors.map((d) => ({
                          id: d.id,
                          primary: d.name,
                          secondary: d.speciality || d.doctorType,
                        }))}
                        label="Doctor (Optional)"
                        hideLabelDesktop={true}
                        placeholder="Select doctor"
                        value={item.doctorId || ""}
                        onChange={(id) => {
                          const d = doctors.find((doc) => doc.id === id);

                          updateInvoiceItem(index, {
                            doctorId: id,
                            doctorName: d?.name || "",
                            commission:
                              d?.defaultCommission ??
                              billingSettings?.defaultCommission ??
                              0,
                          });
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 xl:flex gap-3 xl:w-auto">
                      <div className="w-full xl:w-[110px] xl:shrink-0">
                        <CustomInput
                          label="Price"
                          hideLabelDesktop={true}
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.price.toString()}
                          onChange={(e: any) =>
                            updateInvoiceItem(index, {
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>

                      <div className="w-full xl:w-[80px] xl:shrink-0">
                        <CustomInput
                          label="Qty"
                          hideLabelDesktop={true}
                          min="1"
                          type="number"
                          value={item.quantity.toString()}
                          onChange={(e: any) =>
                            updateInvoiceItem(index, {
                              quantity: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>

                      <div className="w-full xl:w-[100px] flex flex-col gap-1.5 relative xl:shrink-0">
                        <label className="text-[13px] font-medium text-mountain-700 xl:hidden">
                          Disc. Type
                        </label>
                        <div className="h-[38px] px-3 bg-white border border-mountain-200 rounded flex items-center focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100 transition-colors">
                          <select
                            className="w-full bg-transparent outline-none text-[13.5px] text-mountain-800"
                            value={item.discountType || "percent"}
                            onChange={(e) =>
                              updateInvoiceItem(index, {
                                discountType: e.target.value as any,
                              })
                            }
                          >
                            <option value="percent">%</option>
                            <option value="flat">Flat</option>
                          </select>
                        </div>
                      </div>

                      <div className="w-full xl:w-[100px] xl:shrink-0">
                        <CustomInput
                          label="Disc. Val"
                          hideLabelDesktop={true}
                          min="0"
                          type="number"
                          value={(item.discountValue || 0).toString()}
                          onChange={(e: any) =>
                            updateInvoiceItem(index, {
                              discountValue: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>

                      <div className="w-full xl:w-[100px] xl:shrink-0">
                        <CustomInput
                          endContent="%"
                          label="Comm."
                          hideLabelDesktop={true}
                          type="number"
                          value={item.commission.toString()}
                          onChange={(e: any) =>
                            updateInvoiceItem(index, {
                              commission: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>

                      <div className="w-full xl:w-[120px] flex flex-col gap-1.5 xl:justify-end xl:shrink-0">
                        <label className="text-[13px] font-medium text-mountain-700 xl:hidden">
                          Amount
                        </label>
                        <div className="h-[38px] flex items-center xl:justify-end px-3 bg-mountain-50 border border-mountain-100 rounded text-mountain-800 font-medium text-[13.5px]">
                          NPR {Math.round(item.amount).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <Button
                      isIconOnly
                      className="w-[38px] h-[38px] shrink-0 xl:ml-1 xl:-mb-0"
                      color="danger"
                      variant="flat"
                      onClick={() => removeInvoiceItem(index)}
                    >
                      <IoTrashOutline className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-mountain-50 flex items-center justify-center mx-auto mb-4 border border-mountain-100">
                  <IoReceiptOutline className="w-6 h-6 text-mountain-400" />
                </div>
                <h3 className="text-[14.5px] font-medium text-mountain-800 mb-1">
                  No services added yet
                </h3>
                <p className="text-[13px] text-mountain-500 mb-4">
                  Start by adding an invoice item.
                </p>
                <Button
                  color="primary"
                  startContent={<IoAddOutline />}
                  onClick={addInvoiceItem}
                >
                  Add Your First Item
                </Button>
              </div>
            )
          })()}
        </div>

        {/* Totals Section */}
        {formData.items.length > 0 && (
          <div className="p-6 bg-mountain-50/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-4">
                <h4 className="font-semibold text-[14.5px] text-mountain-900 border-b border-mountain-200 pb-2">
                  Discount & Extras
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <CustomSelect
                    label="Discount Type"
                    options={[
                      { value: "flat", label: "Flat Amount" },
                      { value: "percent", label: "Percentage" },
                    ]}
                    value={formData.discountType}
                    onChange={(e: any) =>
                      setFormData((prev) => ({
                        ...prev,
                        discountType: e.target.value as any,
                      }))
                    }
                  />
                  <CustomInput
                    endContent={
                      formData.discountType === "percent" ? "%" : "NPR"
                    }
                    label="Discount Value"
                    type="number"
                    value={formData.discountValue.toString()}
                    onChange={(e: any) =>
                      setFormData((prev) => ({
                        ...prev,
                        discountValue: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-[13px] font-medium text-mountain-700">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full text-[13.5px] px-3 py-2 bg-white border border-mountain-200 rounded min-h-[80px] focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100 text-mountain-800 placeholder:text-mountain-400"
                    placeholder="Provide additional details..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="font-semibold text-[14.5px] text-mountain-900 border-b border-mountain-200 pb-2">
                  Summary
                </h4>
                <div className="bg-white rounded border border-mountain-200 p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between text-[13.5px] text-mountain-700">
                    <span>Subtotal:</span>
                    <span className="font-medium text-mountain-900">
                      {formatCurrency(calculations.subtotal)}
                    </span>
                  </div>
                  {calculations.itemDiscountAmount > 0 && (
                    <div className="flex justify-between text-[13.5px] text-health-600">
                      <span>Service Discounts:</span>
                      <span>
                        - {formatCurrency(calculations.itemDiscountAmount)}
                      </span>
                    </div>
                  )}
                  {calculations.mainDiscountAmount > 0 && (
                    <div className="flex justify-between text-[13.5px] text-health-600">
                      <span>Main Discount:</span>
                      <span>
                        - {formatCurrency(calculations.mainDiscountAmount)}
                      </span>
                    </div>
                  )}
                  {billingSettings.enableTax && (
                    <div className="flex justify-between text-[13.5px] text-mountain-700">
                      <span>
                        {billingSettings.taxLabel || "Tax"} (
                        {billingSettings.defaultTaxPercentage}%):
                      </span>
                      <span className="font-medium text-mountain-900">
                        {formatCurrency(calculations.taxAmount)}
                      </span>
                    </div>
                  )}
                  <div className="h-px bg-mountain-200 my-2" />
                  <div className="flex justify-between text-[16px] font-bold text-teal-800">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(calculations.totalAmount)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="bordered"
                    onClick={() => navigate("/dashboard/appointments-billing")}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    isLoading={saving}
                    onClick={handleSubmit}
                  >
                    Update Invoice
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
