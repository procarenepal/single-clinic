/**
 * PatientBillingTab — Clinic Clarity, zero HeroUI
 * Replaced: Card, Button, Chip, Spinner, Divider, Input, Select, Autocomplete,
 *           Modal + ModalContent, useTheme, addToast (heroui).
 * All business logic / service calls / form state preserved exactly.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoWalletOutline,
  IoAddOutline,
  IoEyeOutline,
  IoReceiptOutline,
  IoCash,
  IoTimeOutline,
  IoTrashOutline,
  IoSearchOutline,
  IoCloseOutline,
} from "react-icons/io5";
import { createPortal } from "react-dom";

import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { doctorCommissionService } from "@/services/doctorCommissionService";
import { patientService } from "@/services/patientService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { referralCommissionService } from "@/services/referralCommissionService";
import {
  AppointmentBilling,
  AppointmentBillingSettings,
  AppointmentBillingItem,
  Doctor,
  AppointmentType,
  Patient,
  ReferralPartner,
} from "@/types/models";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PatientBillingTabProps {
  patientId: string;
}

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

// ── Design helpers ────────────────────────────────────────────────────────────
const PAY_STATUS: Record<string, string> = {
  paid: "bg-health-500/10 text-health-500 border-health-500/20",
  partial: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  unpaid: "bg-red-500/10 text-red-400 border-red-500/20",
};

function PayBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${PAY_STATUS[status] || "bg-surface-2 text-text-muted border-border-base"}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-surface border border-border-base rounded p-3 text-center">
      <p className="text-[18px] font-bold text-text-main">{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
      <p className="text-[11.5px] text-text-muted mt-0.5">{label}</p>
    </div>
  );
}

// ── Searchable dropdown ───────────────────────────────────────────────────────
function SearchSelect({
  label,
  items,
  value,
  onChange,
  disabled,
  required,
  hint,
  placeholder,
  emptyContent,
}: {
  label: string;
  items: { id: string; primary: string; secondary?: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  emptyContent?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = q
    ? items.filter((i) => i.primary.toLowerCase().includes(q.toLowerCase()))
    : items;
  const selected = items.find((i) => i.id === value);

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-[12px] font-medium text-text-main">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className={`flex items-center h-9 border border-border-base rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10 bg-surface ${disabled ? "bg-surface-2" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-2.5 w-3.5 h-3.5 text-text-muted/60 shrink-0" />
        <input
          className="flex-1 text-[12.5px] px-2 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/40"
          disabled={disabled}
          placeholder={placeholder || `Search ${label.toLowerCase()}…`}
          value={selected && !open ? selected.primary : q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && !disabled && (
          <button
            className="mr-2 text-text-muted/60 hover:text-text-muted"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQ("");
            }}
          >
            <IoCloseOutline className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {hint && <p className="text-[10.5px] text-text-muted/60">{hint}</p>}
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border-base rounded max-h-48 overflow-y-auto shadow-xl">
            {filtered.length === 0
              ? emptyContent || (
                  <p className="px-3 py-2 text-[12px] text-text-muted/60">
                    No results
                  </p>
                )
              : filtered.map((i) => (
                  <button
                    key={i.id}
                    className={`w-full text-left px-3 py-2 hover:bg-primary/10 ${i.id === value ? "bg-primary/10" : ""}`}
                    type="button"
                    onClick={() => {
                      onChange(i.id);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <p className="text-[12.5px] text-text-main">{i.primary}</p>
                    {i.secondary && (
                      <p className="text-[11px] text-text-muted">
                        {i.secondary}
                      </p>
                    )}
                  </button>
                ))}
          </div>
        </>
      )}
    </div>
  );
}

function FlatInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  prefixText,
  suffixText,
  hint,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  prefixText?: string;
  suffixText?: string;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-text-main">{label}</label>
      <div className="flex items-center h-9 border border-border-base rounded bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
        {prefixText && (
          <span className="pl-2.5 text-[12px] text-text-muted shrink-0">
            {prefixText}
          </span>
        )}
        <input
          className="flex-1 px-2.5 text-[12.5px] bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/40 disabled:text-text-muted"
          disabled={disabled || readOnly}
          placeholder={placeholder}
          readOnly={readOnly}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {suffixText && (
          <span className="pr-2.5 text-[12px] text-text-muted shrink-0">
            {suffixText}
          </span>
        )}
      </div>
      {hint && <p className="text-[10.5px] text-text-muted/60">{hint}</p>}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "lg",
  disabled,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  size?: "md" | "lg" | "xl" | "5xl";
  disabled?: boolean;
}) {
  const widthMap = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
    "5xl": "max-w-5xl",
  };

  // Lock the real scroll container while modal is open
  React.useEffect(() => {
    // Target the dashboard inner scroller; fall back to body
    const el = (document.getElementById("dashboard-scroll-container") ??
      document.body) as HTMLElement;
    const prev = el.style.overflow;

    el.style.overflow = "hidden";

    return () => {
      el.style.overflow = prev;
    };
  }, []);

  return createPortal(
    /* Overlay rendered at document.body via portal — always full-viewport */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 overflow-hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose();
      }}
    >
      {/* Modal panel */}
      <div
        className={`bg-surface border border-border-base rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh] shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header — pinned */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border-base/50 shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-text-main">
              {title}
            </h3>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          {!disabled && (
            <button
              className="text-text-muted/60 hover:text-text-main mt-0.5"
              type="button"
              onClick={onClose}
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Body — scrolls internally */}
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {/* Footer — pinned */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-base/50 shrink-0">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function PatientBillingTab({
  patientId,
}: PatientBillingTabProps) {
  const { clinicId, currentUser, userData } = useAuthContext();
  const navigate = useNavigate();
  const paymentModal = useModalState(false);
  const invoiceModal = useModalState(false);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Data
  const [billings, setBillings] = useState<AppointmentBilling[]>([]);
  const [billingSettings, setBillingSettings] =
    useState<AppointmentBillingSettings | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [patient, setPatient] = useState<Patient | null>(null);
  const [referralPartner, setReferralPartner] =
    useState<ReferralPartner | null>(null);

  // UI
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "partial" | "unpaid"
  >("all");
  const [selectedBilling, setSelectedBilling] =
    useState<AppointmentBilling | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
  });

  // Invoice form
  const emptyForm: InvoiceFormData = {
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
  };
  const [formData, setFormData] = useState<InvoiceFormData>(emptyForm);
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    itemDiscountAmount: 0,
    mainDiscountAmount: 0,
    totalDiscount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  // ── Load ────────────────────────────────────────────────────────────────────
  const handleSeedServices = async () => {
    if (!clinicId || !currentUser?.uid) return;
    try {
      setLoading(true);
      await appointmentTypeService.seedDefaultAppointmentTypes(
        clinicId,
        userData?.branchId || undefined,
        currentUser.uid,
      );
      addToast({
        title: "Services Seeded",
        description: "Default appointment types have been added successfully.",
        color: "success",
      });
      await loadBillingData(); // Refresh
    } catch (error) {
      console.error("Error seeding services:", error);
      addToast({
        title: "Seed Failed",
        description: "Could not add default services.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBillingData = async () => {
    if (!clinicId || !patientId) return;
    setLoading(true);
    try {
      const settings =
        await appointmentBillingService.getBillingSettings(clinicId);

      if (!settings?.enabledByAdmin || !settings?.isActive) {
        setBillings([]);
        setBillingSettings(null);

        return;
      }
      setBillingSettings(settings);
      const [patientBillings, doctorsData, typesData, patientData] =
        await Promise.all([
          appointmentBillingService.getBillingByPatient(patientId, clinicId),
          doctorService.getDoctorsByClinic(clinicId),
          appointmentTypeService.getAppointmentTypesByClinic(clinicId),
          patientService.getPatientById(patientId),
        ]);

      setBillings(patientBillings || []);
      setDoctors(doctorsData);
      setAppointmentTypes(typesData);
      setPatient(patientData);

      if (patientData?.referralPartnerId) {
        referralPartnerService
          .getReferralPartnerById(patientData.referralPartnerId)
          .then(setReferralPartner)
          .catch(console.error);
      }

      setFormData((p) => ({
        ...p,
        patientId: patientData?.id || "",
        patientName: patientData?.name || "",
        discountType: settings.defaultDiscountType,
        discountValue: settings.defaultDiscountValue,
      }));
    } catch {
      addToast({
        title: "Error",
        description: "Failed to load billing records.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [patientId, clinicId]);

  // ── Calculate totals ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!formData.items.length || !billingSettings) return;
    const totals = appointmentBillingService.calculateInvoiceTotals(
      formData.items,
      formData.discountType,
      formData.discountValue,
      billingSettings.enableTax ? billingSettings.defaultTaxPercentage : 0,
    );

    setCalculations(totals);
  }, [
    formData.items,
    formData.discountType,
    formData.discountValue,
    billingSettings,
  ]);

  // ── Invoice item helpers ────────────────────────────────────────────────────
  const addItem = () => {
    setFormData((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: `item_${Date.now()}`,
          appointmentTypeId: "",
          appointmentTypeName: "",
          price: 0,
          quantity: 1,
          commission: billingSettings?.defaultCommission || 0,
          amount: 0,
        },
      ],
    }));
  };

  const updateItem = (
    index: number,
    updates: Partial<AppointmentBillingItem>,
  ) => {
    setFormData((p) => {
      const items = [...p.items];
      const item = { ...items[index], ...updates };

      if ("appointmentTypeId" in updates) {
        const at = appointmentTypes.find(
          (t) => t.id === updates.appointmentTypeId,
        );

        if (at) {
          item.appointmentTypeName = at.name;
          item.price = at.price;
          item.categoryId = at.categoryId;

          const doc = doctors.find(
            (d) => d.id === (item.doctorId || p.doctorId),
          );

          item.commission = doc?.defaultCommission || 0;
        }
      }

      item.amount = item.price * item.quantity;

      // Note: Recalculate based on individual item discount if it exists in data
      if (item.discountType === "percent") {
        item.discountAmount =
          (item.price * item.quantity * (item.discountValue || 0)) / 100;
      } else if (item.discountType === "flat") {
        item.discountAmount = item.discountValue || 0;
      }

      if (item.discountAmount) {
        item.amount = item.price * item.quantity - item.discountAmount;
      }

      items[index] = item;

      return { ...p, items };
    });
  };

  const removeItem = (index: number) =>
    setFormData((p) => ({
      ...p,
      items: p.items.filter((_, i) => i !== index),
    }));

  const handleDoctorChange = (doctorId: string) => {
    const doc = doctors.find((d) => d.id === doctorId);

    setFormData((p) => ({
      ...p,
      doctorId,
      doctorName: doc?.name || "",
      doctorType: (doc?.doctorType === "visiting" ? "visitor" : "regular") as
        | "regular"
        | "visitor",
    }));
  };

  // ── Invoice submit ──────────────────────────────────────────────────────────
  const handleInvoiceSubmit = async () => {
    if (!clinicId || !currentUser || !billingSettings) return;
    if (!formData.patientId || !formData.items.length) {
      addToast({ title: "Fill all required fields", color: "warning" });

      return;
    }
    if (
      !formData.items.every(
        (i) =>
          i.appointmentTypeId && i.quantity > 0 && i.price > 0 && i.doctorId,
      )
    ) {
      addToast({ title: "Select doctor for all items", color: "warning" });

      return;
    }
    setSubmitting(true);
    try {
      const invoiceNumber =
        await appointmentBillingService.generateInvoiceNumber(clinicId);

      // Derive root doctor fields from the first item
      const firstItem = formData.items[0];
      const rootDoctorId = firstItem.doctorId || "";
      const rootDoctorName = firstItem.doctorName || "";
      const rootDoctor = doctors.find((d) => d.id === rootDoctorId);
      const rootDoctorType = (
        rootDoctor?.doctorType === "visiting" ? "visitor" : "regular"
      ) as "regular" | "visitor";

      const billingData = {
        invoiceNumber,
        clinicId,
        branchId: userData?.branchId || "",
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
        totalAmount: calculations.totalAmount,
        status: "draft" as const,
        paymentStatus: "unpaid" as const,
        paidAmount: 0,
        balanceAmount: calculations.totalAmount,
        notes: formData.notes,
        createdBy: currentUser.uid,
        referralPartnerId: referralPartner?.id || "",
        referralCommissionAmount: referralPartner
          ? (calculations.totalAmount *
              (referralPartner.defaultCommission || 0)) /
            100
          : 0,
      };
      const billingId =
        await appointmentBillingService.createBilling(billingData);

      try {
        if (billingData.items.some((i) => (i.commission || 0) > 0)) {
          await doctorCommissionService.createCommission(
            {
              id: billingId,
              ...billingData,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            rootDoctor?.defaultCommission || 0,
            currentUser.uid,
          );
        }

        // Create referral commission record
        if (referralPartner && billingData.referralCommissionAmount > 0) {
          await referralCommissionService.createReferralCommission(
            {
              id: billingId,
              ...billingData,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            referralPartner,
            billingData.referralCommissionAmount,
            currentUser.uid,
          );
        }
      } catch (err) {
        console.error("Commission processing error:", err);
        addToast({
          title: "Warning",
          description: "Invoice created, but some commission records failed.",
          color: "warning",
        });
      }
      addToast({ title: "Invoice created", color: "success" });
      setFormData({
        ...emptyForm,
        patientId: patient?.id || "",
        patientName: patient?.name || "",
        discountType: billingSettings.defaultDiscountType,
        discountValue: billingSettings.defaultDiscountValue,
      });
      setShowInvoiceModal(false);
      loadBillingData();
    } catch {
      addToast({ title: "Failed to create invoice", color: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Payment submit ──────────────────────────────────────────────────────────
  const handlePaymentSubmit = async () => {
    if (!selectedBilling || !clinicId) return;
    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) {
      addToast({ title: "Enter valid amount", color: "warning" });

      return;
    }
    if (amount > selectedBilling.balanceAmount) {
      addToast({ title: "Exceeds balance", color: "warning" });

      return;
    }
    const method = availableMethods.find((m) => m.key === paymentForm.method);

    if (method?.requiresReference && !paymentForm.reference.trim()) {
      addToast({
        title: `${method.name} requires a reference`,
        color: "warning",
      });

      return;
    }
    setPaymentProcessing(true);
    try {
      await appointmentBillingService.recordPayment(
        selectedBilling.id,
        amount,
        paymentForm.method,
        paymentForm.reference || undefined,
        paymentForm.notes || undefined,
      );
      addToast({
        title: `Payment of ${fmtCur(amount)} recorded`,
        color: "success",
      });
      const updated = await appointmentBillingService.getBillingByPatient(
        patientId,
        clinicId,
      );

      setBillings(updated || []);
      setShowPaymentModal(false);
      setSelectedBilling(null);
      setPaymentForm({ amount: "", method: "cash", reference: "", notes: "" });
    } catch {
      addToast({ title: "Payment failed", color: "danger" });
    } finally {
      setPaymentProcessing(false);
    }
  };

  const openPayment = (b: AppointmentBilling) => {
    setSelectedBilling(b);
    setPaymentForm({
      amount: b.balanceAmount.toString(),
      method:
        billingSettings?.defaultPaymentMethod ||
        availableMethods[0]?.key ||
        "cash",
      reference: "",
      notes: "",
    });
    setShowPaymentModal(true);
  };

  // ── Data helpers ────────────────────────────────────────────────────────────
  const availableMethods =
    billingSettings?.paymentMethods?.filter((m) => m.isEnabled) || [];
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const fmtCur = (n: number) => `NPR ${n.toLocaleString()}`;

  const filtered = billings.filter(
    (b) => statusFilter === "all" || b.paymentStatus === statusFilter,
  );
  const pendingInvs = billings.filter((b) => b.paymentStatus !== "paid");

  const stats = {
    total: billings.length,
    totalAmount: billings.reduce((s, b) => s + b.totalAmount, 0),
    paid: billings.reduce((s, b) => s + b.paidAmount, 0),
    pending: billings.reduce((s, b) => s + b.balanceAmount, 0),
    unpaid: billings.filter((b) => b.paymentStatus === "unpaid").length,
  };

  const newBalance = selectedBilling
    ? selectedBilling.balanceAmount - (parseFloat(paymentForm.amount) || 0)
    : 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading billing…" size="lg" />
      </div>
    );

  if (!billingSettings?.enabledByAdmin || !billingSettings?.isActive) {
    return (
      <div className="py-16 text-center">
        <IoWalletOutline className="mx-auto w-12 h-12 text-text-muted/30 mb-3" />
        <h3 className="text-[13px] font-semibold text-text-main mb-1">
          Billing Not Available
        </h3>
        <p className="text-[12px] text-text-muted">
          The billing system is not enabled for this clinic.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-section-title text-text-main">
            Billing & Payments
          </h2>
          <p className="text-[12.5px] text-text-muted/60">
            Invoices, payments, and financial records
          </p>
        </div>
        <Button
          color="primary"
          size="sm"
          startContent={<IoAddOutline className="w-3.5 h-3.5" />}
          onClick={() => {
            setShowInvoiceModal(true);
            if (formData.items.length === 0) {
              addItem();
            }
          }}
        >
          Create Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Invoices" value={stats.total} />
        <StatCard label="Total Amount" value={fmtCur(stats.totalAmount)} />
        <StatCard label="Paid" value={fmtCur(stats.paid)} />
        <StatCard label="Pending" value={fmtCur(stats.pending)} />
        <StatCard label="Unpaid Invoices" value={stats.unpaid} />
      </div>

      {/* Pending summary banner */}
      {pendingInvs.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-amber-500/10 bg-amber-500/5">
            <IoTimeOutline className="w-4 h-4 text-amber-500" />
            <h4 className="text-[13px] font-semibold text-amber-500">
              Pending Payments
            </h4>
          </div>
          <div className="p-3 space-y-2">
            {pendingInvs.slice(0, 3).map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between bg-surface-2/50 border border-amber-500/10 rounded px-3 py-2"
              >
                <div>
                  <p className="text-[12.5px] font-medium text-text-main">
                    {inv.invoiceNumber}
                  </p>
                  <p className="text-[11.5px] text-text-muted">
                    {inv.doctorName}
                  </p>
                  <p className="text-[11px] text-text-muted/60">
                    Date: {fmtDate(inv.invoiceDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-text-main">
                    {fmtCur(inv.totalAmount)}
                  </p>
                  <PayBadge status={inv.paymentStatus} />
                </div>
              </div>
            ))}
            {pendingInvs.length > 3 && (
              <p className="text-[11px] text-center text-text-muted/60">
                +{pendingInvs.length - 3} more pending
              </p>
            )}
          </div>
        </div>
      )}

      {/* Billing list */}
      <div className="bg-surface dark:bg-surface-2 border border-border-base rounded overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-surface-2 border-b border-border-base/50">
          <h4 className="text-[13px] font-semibold text-text-main">
            Billing History
          </h4>
          <select
            className="h-8 px-2 text-[12px] bg-surface text-text-main border border-border-base rounded focus:outline-none focus:border-primary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        <div className="p-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <IoWalletOutline className="mx-auto w-10 h-10 text-text-muted/30 mb-3" />
              <p className="text-[13px] font-medium text-text-muted">
                No billing records found
              </p>
              <p className="text-[12px] text-text-muted/60">
                No billing history for this patient.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between border border-border-base/50 rounded px-3 py-3 hover:bg-surface-2/30 gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/5 border border-primary/10 rounded shrink-0">
                      <IoReceiptOutline className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <p className="text-[13px] font-semibold text-text-main">
                          {b.invoiceNumber}
                        </p>
                        <PayBadge status={b.paymentStatus} />
                      </div>
                      <p className="text-[12px] text-text-muted">
                        {b.doctorName} —{" "}
                        {b.items.map((i) => i.appointmentTypeName).join(", ")}
                      </p>
                      <div className="flex flex-wrap gap-3 text-[11.5px] text-text-muted/60 mt-0.5">
                        <span>Date: {fmtDate(b.invoiceDate)}</span>
                        {b.paymentMethod && (
                          <span>
                            Method: {b.paymentMethod.replace("_", " ")}
                          </span>
                        )}
                        {b.paidAmount > 0 && (
                          <span className="text-health-600">
                            Paid: {fmtCur(b.paidAmount)}
                          </span>
                        )}
                        {b.balanceAmount > 0 && (
                          <span className="text-red-500">
                            Balance: {fmtCur(b.balanceAmount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="text-[18px] font-bold text-text-main">
                      {fmtCur(b.totalAmount)}
                    </p>
                    <div className="flex gap-1.5">
                      <Button
                        color="default"
                        size="sm"
                        startContent={<IoEyeOutline className="w-3 h-3" />}
                        variant="bordered"
                        onClick={() =>
                          navigate(`/dashboard/appointments-billing/${b.id}`)
                        }
                      >
                        View
                      </Button>
                      {b.balanceAmount > 0 && (
                        <Button
                          color="primary"
                          size="sm"
                          startContent={<IoCash className="w-3 h-3" />}
                          variant="bordered"
                          onClick={() => openPayment(b)}
                        >
                          Pay
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Invoice creation modal ── */}
      {showInvoiceModal && (
        <ModalShell
          disabled={submitting}
          footer={
            <>
              <Button
                color="default"
                disabled={submitting}
                size="sm"
                variant="bordered"
                onClick={() => setShowInvoiceModal(false)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                disabled={
                  formData.items.length === 0 || !formData.items[0].doctorId
                }
                isLoading={submitting}
                size="sm"
                onClick={handleInvoiceSubmit}
              >
                {submitting ? "Creating…" : "Create Invoice"}
              </Button>
            </>
          }
          size="5xl"
          subtitle={
            <p className="text-[11.5px] text-text-muted/60">
              For {patient?.name || "Patient"} ({patient?.regNumber || "..."})
            </p>
          }
          title="Create New Invoice"
          onClose={() => setShowInvoiceModal(false)}
        >
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
              <FlatInput
                label="Invoice Date *"
                type="date"
                value={formData.invoiceDate}
                onChange={(v) => setFormData((p) => ({ ...p, invoiceDate: v }))}
              />
            </div>

            <div className="border-t border-border-base/50" />

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-semibold text-text-main">
                  Invoice Details
                </h4>
                <Button
                  color="primary"
                  size="sm"
                  startContent={<IoAddOutline className="w-3.5 h-3.5" />}
                  onClick={addItem}
                >
                  Add Item
                </Button>
              </div>

              {formData.items.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-border-base rounded bg-surface-2/30">
                  <IoReceiptOutline className="mx-auto w-8 h-8 text-text-muted/30 mb-2" />
                  <p className="text-[12.5px] text-text-main mb-3">
                    No items added yet
                  </p>
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<IoAddOutline className="w-3.5 h-3.5" />}
                    onClick={addItem}
                  >
                    Add First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="border border-border-base rounded-lg p-4 bg-surface-2/20"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                        {/* Row 1: Type, Price, Doctor */}
                        <div className="sm:col-span-4">
                          <SearchSelect
                            emptyContent={
                              <div className="p-4 text-center">
                                <p className="text-[12px] text-text-muted mb-2">
                                  No services found.
                                </p>
                                <Button
                                  className="w-full h-8 text-[11px]"
                                  color="primary"
                                  isLoading={loading}
                                  size="sm"
                                  onClick={handleSeedServices}
                                >
                                  Seed Default Services
                                </Button>
                              </div>
                            }
                            items={appointmentTypes.map((t) => ({
                              id: t.id,
                              primary: t.name,
                              secondary: `NPR ${t.price.toLocaleString()}`,
                            }))}
                            label="Appointment Type"
                            placeholder="Search or seed services..."
                            value={item.appointmentTypeId}
                            onChange={(id) =>
                              updateItem(idx, { appointmentTypeId: id })
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <FlatInput
                            readOnly
                            label="Price"
                            prefixText="NPR"
                            value={item.price.toString()}
                          />
                        </div>
                        <div className="sm:col-span-6">
                          <SearchSelect
                            items={doctors.map((d) => ({
                              id: d.id,
                              primary: d.name,
                              secondary: d.speciality || d.doctorType,
                            }))}
                            label="Doctor"
                            placeholder="Select Doctor"
                            value={item.doctorId || ""}
                            onChange={(id) => {
                              const d = doctors.find((doc) => doc.id === id);

                              updateItem(idx, {
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

                        {/* Row 2: Qty, Commission, Amount, Action */}
                        <div className="sm:col-span-2">
                          <FlatInput
                            label="Quantity"
                            type="number"
                            value={item.quantity.toString()}
                            onChange={(v) =>
                              updateItem(idx, { quantity: parseInt(v) || 1 })
                            }
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <FlatInput
                            label="Commission (%)"
                            suffixText="%"
                            type="number"
                            value={item.commission.toString()}
                            onChange={(v) =>
                              updateItem(idx, {
                                commission: parseFloat(v) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <FlatInput
                            readOnly
                            label="Amount"
                            value={fmtCur(item.amount)}
                          />
                        </div>
                        <div className="sm:col-span-2 flex justify-end">
                          <button
                            className="p-2.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50/50 transition-colors border border-transparent hover:border-red-100"
                            type="button"
                            onClick={() => removeItem(idx)}
                          >
                            <IoTrashOutline className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discount + Summary */}
            {formData.items.length > 0 && (
              <>
                <div className="border-t border-border-base/50" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-[13px] font-semibold text-text-main">
                      Discount & Tax
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[12px] font-medium text-text-muted">
                          Discount Type
                        </label>
                        <select
                          className="h-9 px-2.5 text-[12.5px] border border-border-base rounded focus:outline-none focus:border-primary bg-surface"
                          value={formData.discountType}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              discountType: e.target.value as
                                | "flat"
                                | "percent",
                            }))
                          }
                        >
                          <option value="flat">Flat Amount</option>
                          <option value="percent">Percentage</option>
                        </select>
                      </div>
                      <FlatInput
                        label="Discount Value"
                        suffixText={
                          formData.discountType === "percent" ? "%" : "NPR"
                        }
                        type="number"
                        value={formData.discountValue.toString()}
                        onChange={(v) =>
                          setFormData((p) => ({
                            ...p,
                            discountValue: parseFloat(v) || 0,
                          }))
                        }
                      />
                    </div>
                    <FlatInput
                      label="Notes"
                      placeholder="Additional notes (optional)"
                      value={formData.notes}
                      onChange={(v) => setFormData((p) => ({ ...p, notes: v }))}
                    />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-text-main mb-2">
                      Summary
                    </h4>
                    <div className="bg-surface-2 border border-border-base/50 rounded p-3 space-y-1.5 text-[12.5px]">
                      {[
                        ["Subtotal", fmtCur(calculations.subtotal)],
                        ...(calculations.itemDiscountAmount > 0
                          ? [
                              [
                                "Service Discounts",
                                `– ${fmtCur(calculations.itemDiscountAmount)}`,
                              ],
                            ]
                          : []),
                        ...(calculations.mainDiscountAmount > 0
                          ? [
                              [
                                "Main Discount",
                                `– ${fmtCur(calculations.mainDiscountAmount)}`,
                              ],
                            ]
                          : []),
                        ...(billingSettings?.enableTax
                          ? [
                              [
                                `${billingSettings.taxLabel} (${billingSettings.defaultTaxPercentage}%)`,
                                fmtCur(calculations.taxAmount),
                              ],
                            ]
                          : []),
                      ].map(([l, v]) => (
                        <div
                          key={String(l)}
                          className="flex justify-between text-text-muted"
                        >
                          <span>{l}</span>
                          <span>{v}</span>
                        </div>
                      ))}
                      <div className="border-t border-border-base pt-1.5 flex justify-between font-bold text-text-main text-[13px]">
                        <span>Total</span>
                        <span>{fmtCur(calculations.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ModalShell>
      )}

      {/* ── Payment modal ── */}
      {showPaymentModal && selectedBilling && (
        <ModalShell
          disabled={paymentProcessing}
          footer={
            <>
              <Button
                color="default"
                disabled={paymentProcessing}
                size="sm"
                variant="bordered"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                disabled={
                  !paymentForm.amount || parseFloat(paymentForm.amount) <= 0
                }
                isLoading={paymentProcessing}
                size="sm"
                onClick={handlePaymentSubmit}
              >
                {paymentProcessing ? "Processing…" : "Record Payment"}
              </Button>
            </>
          }
          size="md"
          subtitle={
            <div className="space-y-0.5 text-[11.5px] text-text-muted">
              <p>
                <span className="font-medium text-text-muted">Invoice:</span>{" "}
                {selectedBilling.invoiceNumber}
              </p>
              <p>
                <span className="font-medium text-text-muted">Patient:</span>{" "}
                {selectedBilling.patientName}
              </p>
              <p className="text-red-600 font-semibold">
                Balance: {fmtCur(selectedBilling.balanceAmount)}
              </p>
            </div>
          }
          title="Record Payment"
          onClose={() => setShowPaymentModal(false)}
        >
          <div className="space-y-3">
            {/* Amount */}
            <FlatInput
              hint={`Max: ${fmtCur(selectedBilling.balanceAmount)}`}
              label="Payment Amount *"
              prefixText="NPR"
              type="number"
              value={paymentForm.amount}
              onChange={(v) => setPaymentForm((p) => ({ ...p, amount: v }))}
            />

            {/* Method */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-text-muted">
                Payment Method *
              </label>
              <select
                className="h-9 px-2.5 text-[12.5px] border border-border-base rounded focus:outline-none focus:border-primary bg-surface"
                value={paymentForm.method}
                onChange={(e) =>
                  setPaymentForm((p) => ({
                    ...p,
                    method: e.target.value,
                    reference: "",
                  }))
                }
              >
                {availableMethods.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Conditional reference */}
            {availableMethods.find((m) => m.key === paymentForm.method)
              ?.requiresReference && (
              <FlatInput
                hint="Required for this payment method"
                label="Transaction Reference *"
                placeholder="Transaction ID / cheque number"
                value={paymentForm.reference}
                onChange={(v) =>
                  setPaymentForm((p) => ({ ...p, reference: v }))
                }
              />
            )}

            <FlatInput
              label="Notes"
              placeholder="Optional notes"
              value={paymentForm.notes}
              onChange={(v) => setPaymentForm((p) => ({ ...p, notes: v }))}
            />

            {/* Summary */}
            {paymentForm.amount && (
              <div className="bg-surface-2 border border-border-base/50 rounded p-3 space-y-1.5 text-[12px]">
                <h4 className="text-[12px] font-semibold text-text-main mb-2">
                  Payment Summary
                </h4>
                {[
                  ["Total Invoice", fmtCur(selectedBilling.totalAmount), ""],
                  [
                    "Already Paid",
                    fmtCur(selectedBilling.paidAmount),
                    "text-health-600",
                  ],
                  [
                    "Current Payment",
                    fmtCur(parseFloat(paymentForm.amount) || 0),
                    "text-primary/80 font-semibold",
                  ],
                ].map(([l, v, cls]) => (
                  <div
                    key={String(l)}
                    className="flex justify-between text-text-muted"
                  >
                    <span>{l}</span>
                    <span className={cls}>{v}</span>
                  </div>
                ))}
                <div className="border-t border-border-base pt-1.5 flex justify-between font-semibold">
                  <span className="text-text-muted">New Balance</span>
                  <span
                    className={
                      newBalance <= 0 ? "text-health-600" : "text-red-600"
                    }
                  >
                    {fmtCur(newBalance)}
                  </span>
                </div>
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-text-muted">Status after payment</span>
                  <span
                    className={`font-semibold ${newBalance <= 0 ? "text-health-600" : "text-saffron-600"}`}
                  >
                    {newBalance <= 0 ? "Fully Paid" : "Partially Paid"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
