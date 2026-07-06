/**
 * Appointment Billing Page — Clinic Clarity, zero HeroUI
 * Replaced: Card, Button, Input, Select, Autocomplete, Table, Chip,
 *           Divider, Pagination, Modal, Switch, Tabs (@heroui)
 */
import type { Branch } from "@/types/models";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IoReceiptOutline,
  IoAddOutline,
  IoTrashOutline,
  IoEyeOutline,
  IoCash,
  IoSettings,
  IoStatsChartOutline,
  IoSearchOutline,
  IoPencilOutline,
  IoPrintOutline,
  IoCloseOutline,
  IoChevronDown,
} from "react-icons/io5";

import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown";
import { useAuthContext } from "@/context/AuthContext";
import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

// Services
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { doctorCommissionService } from "@/services/doctorCommissionService";
import { expertCommissionService } from "@/services/expertCommissionService";
import { referralCommissionService } from "@/services/referralCommissionService";
import { staffCommissionService } from "@/services/staffCommissionService";
import { branchService } from "@/services/branchService";
import { treatmentCategoryService } from "@/services/treatmentCategoryService";
import {
  AppointmentBilling,
  AppointmentBillingItem,
  AppointmentBillingSettings,
  Patient,
  Doctor,
  AppointmentType,
  TreatmentCategory,
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

// ── UI Helpers ─────────────────────────────────────────────────────────────
function StatusBadge({
  status,
  type = "status",
}: {
  status: string;
  type?: "status" | "payment";
}) {
  const S_COLORS: Record<string, string> = {
    paid: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    finalized:
      "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    partial:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    unpaid: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    default: "bg-surface-2 text-text-muted border-border-base",
  };
  const color = S_COLORS[status] || S_COLORS.default;

  return (
    <span
      className={`text-[10.5px] font-semibold px-2 py-0.5 rounded border capitalize ${color}`}
    >
      {status}
    </span>
  );
}

function SearchSelect({
  label,
  items,
  value,
  onChange,
  disabled,
  required,
  hint,
  placeholder,
}: {
  label: string;
  items: { id: string; primary: string; secondary?: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = (
    q
      ? items.filter((i) => i.primary.toLowerCase().includes(q.toLowerCase()))
      : items
  ).slice(0, 100);
  const selected = items.find((i) => i.id === value);

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-[12px] font-medium text-text-muted">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className={`flex items-center h-9 border border-border-base rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-surface ${disabled ? "bg-surface-2" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-2.5 w-3.5 h-3.5 text-text-muted/50 shrink-0" />
        <input
          className="flex-1 text-[12.5px] px-2 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/40 w-full"
          disabled={disabled}
          placeholder={placeholder || `Search…`}
          value={selected && !open ? selected.primary : q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && !disabled && (
          <button
            className="mr-2 text-text-muted hover:text-text-main"
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
      {hint && <p className="text-[10.5px] text-text-muted/70">{hint}</p>}
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border-base rounded max-h-48 overflow-y-auto shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-text-muted/70">
                No results
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`w-full text-left px-3 py-2 hover:bg-surface-2 ${i.id === value ? "bg-primary/5" : ""}`}
                  type="button"
                  onClick={() => {
                    onChange(i.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <p className="text-[12.5px] text-text-main">{i.primary}</p>
                  {i.secondary && (
                    <p className="text-[11px] text-text-muted/60">
                      {i.secondary}
                    </p>
                  )}
                </button>
              ))
            )}
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
  required,
  min,
  step,
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
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[12px] font-medium text-text-muted">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className={`flex items-center h-9 border border-border-base rounded bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 ${disabled ? "bg-surface-2" : ""}`}
      >
        {prefixText && (
          <span className="pl-2.5 text-[12px] text-text-muted/50 shrink-0">
            {prefixText}
          </span>
        )}
        <input
          className="flex-1 w-full px-2.5 text-[12.5px] bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/40 disabled:text-text-muted/30"
          disabled={disabled}
          min={min}
          placeholder={placeholder}
          step={step}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {suffixText && (
          <span className="pr-2.5 text-[12px] text-text-muted/50 shrink-0">
            {suffixText}
          </span>
        )}
      </div>
      {hint && <p className="text-[10.5px] text-text-muted/70">{hint}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        className={`relative inline-flex items-center w-10 h-[22px] rounded-full transition-colors duration-200 ease-in-out ${checked
          ? "bg-primary border border-primary"
          : "bg-gray-200 border border-gray-300 dark:bg-gray-600 dark:border-gray-500"
          }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ease-in-out ${checked ? "translate-x-[18px]" : "translate-x-0"
            }`}
        />
      </div>
      <span className="text-[12.5px] text-text-main">{label}</span>
      <input
        checked={checked}
        className="sr-only"
        type="checkbox"
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "lg",
  disabled,
}: {
  title: React.ReactNode;
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

  useEffect(() => {
    const el =
      document.getElementById("dashboard-scroll-container") || document.body;
    const prev = el.style.overflow;

    el.style.overflow = "hidden";

    return () => {
      el.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 overflow-hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose();
      }}
    >
      <div
        className={`bg-surface border border-border-base rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh] shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-border-base shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-text-main">
              {title}
            </h3>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          {!disabled && (
            <button
              className="text-text-muted hover:text-text-main mt-0.5"
              type="button"
              onClick={onClose}
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-base shrink-0 bg-surface-2/50">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AppointmentBillingPage() {
  const { clinicId, currentUser, userData } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterDate = searchParams.get("date");

  const branchId = userData?.branchId ?? null;
  const isClinicAdmin =
    userData?.role === "clinic-admin" || userData?.role === "system-owner";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const mainBranchId = branches.find((b) => b.isMainBranch)?.id ?? null;
  const effectiveBranchId =
    branchId ??
    (mainBranchId && selectedBranchId === mainBranchId
      ? undefined
      : (selectedBranchId ?? undefined));

  // Tabs: 'create' | 'manage' | 'settings'
  const [activeTab, setActiveTab] = useState(filterDate ? "manage" : "create");

  // Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [experts, setExperts] = useState<any[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [billings, setBillings] = useState<AppointmentBilling[]>([]);
  const [billingSettings, setBillingSettings] =
    useState<AppointmentBillingSettings | null>(null);
  const [treatmentCategories, setTreatmentCategories] = useState<
    TreatmentCategory[]
  >([]);

  // States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedBilling, setSelectedBilling] =
    useState<AppointmentBilling | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedBillingForPayment, setSelectedBillingForPayment] =
    useState<AppointmentBilling | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingBilling, setDeletingBilling] =
    useState<AppointmentBilling | null>(null);

  // Form Data (Create)
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
  const [patientDue, setPatientDue] = useState(0);

  // Settings tab form
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: "",
    key: "",
    description: "",
    requiresReference: false,
    icon: "💳",
  });
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);

  // Load branches for clinic-wide admins (no fixed branchId)
  useEffect(() => {
    if (!clinicId || !isClinicAdmin || branchId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await branchService.getClinicBranches(clinicId, true);

        if (cancelled) return;
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId((prev) => prev ?? data[0].id);
        } else {
          setSelectedBranchId(null);
        }
      } catch {
        if (!cancelled) {
          setBranches([]);
          setSelectedBranchId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicId, isClinicAdmin, branchId]);

  useEffect(() => {
    if (branchId) setSelectedBranchId(null);
  }, [branchId]);

  useEffect(() => {
    loadData();
  }, [clinicId, filterDate, effectiveBranchId]);
  useEffect(() => {
    if (filterDate) setActiveTab("manage");
  }, [filterDate]);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  useEffect(() => {
    calculateTotals();
  }, [
    formData.items,
    formData.discountType,
    formData.discountValue,
    billingSettings,
  ]);

  const loadData = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const settings =
        await appointmentBillingService.getBillingSettings(clinicId);

      if (!settings?.enabledByAdmin || !settings?.isActive) return;
      setBillingSettings(settings);

      const [pData, dData, expData, aData, bData, tcData] = await Promise.all([
        patientService.getPatientsByClinic(clinicId, effectiveBranchId),
        doctorService.getDoctorsByClinic(clinicId, effectiveBranchId),
        expertService.getExpertsByClinic(clinicId, effectiveBranchId),
        appointmentTypeService.getAppointmentTypesByClinic(
          clinicId,
          effectiveBranchId,
        ),
        appointmentBillingService.getBillingByClinic(
          clinicId,
          effectiveBranchId,
        ),
        treatmentCategoryService.getCategoriesByClinic(
          clinicId,
          effectiveBranchId,
        ),
      ]);

      setPatients(pData);
      setDoctors(dData);
      setExperts(expData || []);
      setAppointmentTypes(aData);
      setTreatmentCategories(tcData);
      let filtered = bData || [];

      if (filterDate) {
        const d = new Date(filterDate);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          23,
          59,
          59,
        );

        filtered = filtered.filter((b) => {
          if (!b.invoiceDate) return false;
          const bd = new Date(b.invoiceDate);

          return bd >= start && bd <= end;
        });
      }
      setBillings(filtered);
      setFormData((p) => ({
        ...p,
        discountType: settings.defaultDiscountType,
        discountValue: settings.defaultDiscountValue,
      }));
    } catch (e) {
      addToast({ title: "Error loading data", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    if (!formData.items.length || !billingSettings) return;
    setCalculations(
      appointmentBillingService.calculateInvoiceTotals(
        formData.items,
        formData.discountType,
        formData.discountValue,
        billingSettings.enableTax ? billingSettings.defaultTaxPercentage : 0,
      ),
    );
  };

  // ── Create Invoice Logic ───────────────────────────────────────────────────
  const handlePatientChange = async (id: string) => {
    const p = patients.find((x) => x.id === id);

    if (p) {
      setFormData((prev) => ({ ...prev, patientId: id, patientName: p.name }));
      // Fetch patient's previous due amount
      try {
        const patientInvoices =
          await appointmentBillingService.getBillingByPatient(id, clinicId!);
        const totalDue = patientInvoices.reduce(
          (sum, inv) => sum + (inv.balanceAmount || 0),
          0,
        );

        setPatientDue(totalDue);
      } catch (e) {
        console.error("Error fetching patient due balance:", e);
        setPatientDue(0);
      }
    } else {
      setFormData((prev) => ({ ...prev, patientId: "", patientName: "" }));
      setPatientDue(0);
    }
  };

  const handleDoctorChange = (id: string) => {
    const d = doctors.find((x) => x.id === id);

    if (d) {
      const type =
        (d.doctorType || "regular").toLowerCase() === "visitor"
          ? "visitor"
          : "regular";

      setFormData((prev) => ({
        ...prev,
        doctorId: id,
        doctorName: d.name,
        doctorType: type as "regular" | "visitor",
      }));

      // Update items that were using the previous main doctor
      setFormData((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          !item.doctorId || item.doctorId === ""
            ? { ...item, doctorId: id, doctorName: d.name }
            : item,
        ),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        doctorId: "",
        doctorName: "",
        doctorType: "regular",
      }));
    }
  };

  const addInvoiceItem = () => {
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
          commission:
            (doctors.find((d) => d.id === formData.doctorId) || experts.find((e) => e.id === formData.doctorId))
              ?.defaultCommission ??
            billingSettings?.defaultCommission ??
            0,
          doctorId: formData.doctorId,
          doctorName: formData.doctorName,
          discountType: "percent",
          discountValue: 0,
          discountAmount: 0,
          amount: 0,
        },
      ],
    }));
  };

  const removeInvoiceItem = (index: number) => {
    setFormData((p) => {
      const newItems = [...p.items];

      newItems.splice(index, 1);

      return { ...p, items: newItems };
    });
  };

  const updateInvoiceItem = (
    index: number,
    updates: Partial<AppointmentBillingItem>,
  ) => {
    setFormData((p) => {
      const items = [...p.items];
      const item = { ...items[index], ...updates };

      // Auto-fetch price and category if appointment type changes
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
          const exp = experts.find(
            (e) => e.id === (item.doctorId || p.doctorId),
          );
          const clinician = doc || exp;

          item.commission = clinician?.defaultCommission || 0;
        }
      }

      // Recalculate discount and final amount
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

      items[index] = item;

      return { ...p, items };
    });
  };

  const handleCreateSubmit = async () => {
    if (!clinicId || !currentUser || !billingSettings) return;
    if (!formData.patientId || !formData.items.length) {
      addToast({ title: "Fill required fields", color: "warning" });

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

    try {
      setSubmitting(true);
      const invoiceNumber =
        await appointmentBillingService.generateInvoiceNumber(clinicId);

      // Derive root doctor fields from the first item
      const firstItem = formData.items[0];
      const rootDoctorId = firstItem.doctorId || "";
      const rootDoctorName = firstItem.doctorName || "";
      const rootDoctor = doctors.find((d) => d.id === rootDoctorId);
      const rootExpert = experts.find((e) => e.id === rootDoctorId);
      const rootClinician = rootDoctor || rootExpert;
      const rootDoctorType = (
        rootDoctor?.doctorType === "visiting" ? "visitor" : "regular"
      ) as "regular" | "visitor";
      // Sanitize items to remove undefined values for Firebase
      const cleanItems = formData.items.map((item) => {
        const cleaned: any = { ...item };

        Object.keys(cleaned).forEach((key) => {
          if (cleaned[key] === undefined) {
            delete cleaned[key];
          }
        });

        return cleaned;
      });

      const data: Omit<AppointmentBilling, "id" | "createdAt" | "updatedAt"> = {
        invoiceNumber,
        clinicId,
        branchId: effectiveBranchId || userData?.branchId || "",
        ...formData,
        doctorId: rootDoctorId,
        doctorName: rootDoctorName,
        doctorType: rootDoctorType,
        items: cleanItems,
        invoiceDate: new Date(formData.invoiceDate),
        subtotal: calculations.subtotal,
        discountAmount: calculations.totalDiscount,
        itemDiscountAmount: calculations.itemDiscountAmount,
        mainDiscountAmount: calculations.mainDiscountAmount,
        taxPercentage: billingSettings.enableTax
          ? billingSettings.defaultTaxPercentage
          : 0,
        taxAmount: calculations.taxAmount,
        totalAmount: calculations.totalAmount,
        status: "draft",
        paymentStatus: "unpaid",
        paidAmount: 0,
        balanceAmount: calculations.totalAmount,
        createdBy: currentUser.uid,
      };

      const id = await appointmentBillingService.createBilling(data);

      // Update patient's assigned clinician to ensure they appear in Expert/Doctor profiles
      if (formData.patientId && formData.patientId !== "walk-in") {
        try {
          const isExpertRoot = experts.some(e => e.id === rootDoctorId);
          const isDoctorRoot = doctors.some(d => d.id === rootDoctorId);
          
          if (isExpertRoot) {
            await patientService.updatePatient(formData.patientId, { assignedExpertId: rootDoctorId });
          } else if (isDoctorRoot) {
            await patientService.updatePatient(formData.patientId, { doctorId: rootDoctorId });
          }
        } catch (err) {
          console.error("Failed to update patient clinician assignment:", err);
        }
      }
      addToast({ title: "Invoice created", color: "success" });
      setFormData({
        ...emptyForm,
        discountType: billingSettings.defaultDiscountType,
        discountValue: billingSettings.defaultDiscountValue,
      });
      setPatientDue(0);
      const up = await appointmentBillingService.getBillingByClinic(
        clinicId,
        effectiveBranchId,
      );

      if (up) setBillings(up);
      setActiveTab("manage");
    } catch (e) {
      addToast({ title: "Failed to create invoice", color: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Manage Invoices Logic ──────────────────────────────────────────────────
  const fmtCur = (n: number) => `NPR ${n.toLocaleString()}`;
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const filteredBillings = searchQuery.trim()
    ? billings.filter((b) => {
      const patientName =
        b.patientName === "Unknown Patient" || !b.patientName
          ? patients.find((p) => p.id === b.patientId)?.name ||
          b.patientName ||
          "Unknown Patient"
          : b.patientName;

      return (
        patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    : billings;

  const totalPages = Math.ceil(filteredBillings.length / itemsPerPage) || 1;
  const currentBillings = filteredBillings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleDelete = async () => {
    if (!deletingBilling || !clinicId) return;
    try {
      setIsDeleting(true);
      await appointmentBillingService.deleteBilling(deletingBilling.id);
      addToast({ title: "Invoice deleted", color: "success" });
      setBillings((b) => b.filter((x) => x.id !== deletingBilling.id));
      setShowDeleteModal(false);
      setDeletingBilling(null);
    } catch (e) {
      addToast({ title: "Delete failed", color: "danger" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedBillingForPayment || !clinicId) return;
    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) {
      addToast({ title: "Invalid amount", color: "warning" });

      return;
    }
    if (amount > selectedBillingForPayment.balanceAmount) {
      addToast({ title: "Exceeds balance", color: "warning" });

      return;
    }

    const methodInfo = availableMethods.find(
      (m) => m.key === paymentForm.method,
    );

    if (methodInfo?.requiresReference && !paymentForm.reference.trim()) {
      addToast({ title: "Reference required", color: "warning" });

      return;
    }

    try {
      setPaymentProcessing(true);
      await appointmentBillingService.recordPayment(
        selectedBillingForPayment.id,
        amount,
        paymentForm.method,
        paymentForm.reference || undefined,
        paymentForm.notes || undefined,
      );

      // Only generate commissions on the FIRST payment to avoid duplicates
      if (selectedBillingForPayment.paymentStatus === "unpaid") {
        try {
          const billingDataForCommission = {
            ...selectedBillingForPayment,
            createdAt: selectedBillingForPayment.createdAt instanceof Date ? selectedBillingForPayment.createdAt : new Date(),
            updatedAt: new Date(),
          } as AppointmentBilling;

          // Group invoice items by unique clinician ID
          const clinicianMap = new Map<string, { isExpert: boolean; items: typeof selectedBillingForPayment.items }>();
          for (const item of selectedBillingForPayment.items) {
            const cId = item.doctorId || selectedBillingForPayment.doctorId;
            if (!cId) continue;
            const sanitizedItem = {
              ...item,
              commission: parseFloat(item.commission as any) || 0,
              amount: parseFloat(item.amount as any) || 0,
            };
            if (!clinicianMap.has(cId)) {
              // Determine type: check in-memory arrays; default to doctor if not found in either
              const isExpert = experts.some((e) => e.id === cId) && !doctors.some((d) => d.id === cId);
              clinicianMap.set(cId, { isExpert, items: [] });
            }
            clinicianMap.get(cId)!.items.push(sanitizedItem);
          }

          // Create commissions for each clinician
          for (const [cId, group] of clinicianMap.entries()) {
            const clinician = doctors.find((d) => d.id === cId) || experts.find((e) => e.id === cId);
            const defaultPct = clinician?.defaultCommission || 0;
            const billingForClinician = { ...billingDataForCommission, items: group.items };
            console.log(`[Commission] clinicianId=${cId} isExpert=${group.isExpert} items=${group.items.length} defaultPct=${defaultPct}`);
            if (group.isExpert) {
              try {
                await expertCommissionService.createCommissionsFromBilling(billingForClinician, defaultPct, currentUser.uid);
                console.log(`[Commission] Expert commission created for ${cId}`);
              } catch (err) {
                console.error(`[Commission] Expert commission error for ${cId}:`, err);
              }
            } else {
              try {
                await doctorCommissionService.createCommission(billingForClinician, defaultPct, currentUser.uid);
                console.log(`[Commission] Doctor commission created for ${cId}`);
              } catch (err) {
                console.error(`[Commission] Doctor commission error for ${cId}:`, err);
              }
            }
          }

          // 2) Log Polymorphic Referrer Commissions
          const processedReferrals = selectedBillingForPayment.referrals || [];
          for (const r of processedReferrals) {
            if (r.commissionAmount <= 0) continue;
            try {
              if (r.type === "referral-partner") {
                await referralCommissionService.createReferralCommission(
                  billingDataForCommission,
                  {
                    id: r.id,
                    name: r.name,
                    defaultCommission: r.commissionPercentage,
                  } as any,
                  r.commissionAmount,
                  currentUser.uid,
                );
              } else if (r.type === "doctor") {
                await doctorCommissionService.createCommission(
                  { ...billingDataForCommission, doctorId: r.id, doctorName: r.name },
                  r.commissionPercentage,
                  currentUser.uid,
                );
              } else if (r.type === "expert") {
                await expertCommissionService.createCommission(
                  r.id,
                  r.name,
                  billingDataForCommission,
                  r.commissionPercentage,
                  currentUser.uid,
                );
              } else if (r.type === "staff") {
                await staffCommissionService.createRegistrationCommission(
                  r.id,
                  r.name,
                  billingDataForCommission.clinicId,
                  billingDataForCommission.branchId,
                  billingDataForCommission.patientId || "",
                  billingDataForCommission.patientName,
                  `Invoice Payment - Staff Referral`,
                  billingDataForCommission.totalAmount,
                  r.commissionAmount,
                  r.commissionPercentage,
                  currentUser.uid,
                );
              }
            } catch (err) {
              console.error("Error generating referrer commission:", err);
            }
          }
        } catch (e) {
          console.error("Error generating commission on payment:", e);
          addToast({
            title: "Warning",
            description: "Payment recorded but commission logic failed.",
            color: "warning",
          });
        }
      }

      addToast({ title: "Payment recorded", color: "success" });
      const up = await appointmentBillingService.getBillingByClinic(
        clinicId,
        effectiveBranchId,
      );

      if (up) setBillings(up);
      setShowPaymentModal(false);
      setSelectedBillingForPayment(null);
      setPaymentForm({ amount: "", method: "cash", reference: "", notes: "" });
      if (showInvoiceModal) setShowInvoiceModal(false); // Close view modal if open
    } catch (e) {
      addToast({ title: "Payment failed", color: "danger" });
    } finally {
      setPaymentProcessing(false);
    }
  };

  // ── Settings Logic ─────────────────────────────────────────────────────────
  const handleAddPaymentMethod = async () => {
    if (!clinicId || !currentUser) return;
    if (!paymentMethodForm.name.trim() || !paymentMethodForm.key.trim()) return;
    if (
      billingSettings?.paymentMethods?.some(
        (m) => m.key.toLowerCase() === paymentMethodForm.key.toLowerCase(),
      )
    ) {
      addToast({ title: "Duplicate key", color: "warning" });

      return;
    }
    try {
      setIsAddingPaymentMethod(true);
      await appointmentBillingService.addPaymentMethod(
        clinicId,
        {
          name: paymentMethodForm.name.trim(),
          key: paymentMethodForm.key.toLowerCase().replace(/\s+/g, "_"),
          description: paymentMethodForm.description.trim(),
          requiresReference: paymentMethodForm.requiresReference,
          icon: paymentMethodForm.icon,
          isEnabled: true,
          isCustom: true,
        },
        currentUser.uid,
      );
      addToast({ title: "Method added", color: "success" });
      setPaymentMethodForm({
        name: "",
        key: "",
        description: "",
        requiresReference: false,
        icon: "💳",
      });
      const s = await appointmentBillingService.getBillingSettings(clinicId);

      if (s) setBillingSettings(s);
    } catch (e) {
      addToast({ title: "Failed to add method", color: "danger" });
    } finally {
      setIsAddingPaymentMethod(false);
    }
  };

  const handleToggleMethod = async (id: string, current: boolean) => {
    if (!clinicId || !currentUser) return;
    try {
      await appointmentBillingService.updatePaymentMethod(
        clinicId,
        id,
        { isEnabled: !current },
        currentUser.uid,
      );
      const s = await appointmentBillingService.getBillingSettings(clinicId);

      if (s) setBillingSettings(s);
    } catch (e) {
      addToast({ title: "Delete failed", color: "danger" });
    }
  };

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const handleAddCategory = async () => {
    if (!clinicId || !currentUser || !categoryForm.name.trim()) return;
    try {
      setIsAddingCategory(true);
      await treatmentCategoryService.createCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        clinicId,
        branchId: effectiveBranchId || undefined,
        isActive: true,
        createdBy: currentUser.uid,
      });
      addToast({ title: "Category added", color: "success" });
      setCategoryForm({ name: "", description: "" });
      const cats = await treatmentCategoryService.getCategoriesByClinic(
        clinicId,
        effectiveBranchId,
      );

      setTreatmentCategories(cats);
    } catch (e) {
      addToast({ title: "Failed to add category", color: "danger" });
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!clinicId) return;
    try {
      await treatmentCategoryService.deleteCategory(id);
      addToast({ title: "Category deleted", color: "success" });
      setTreatmentCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      addToast({ title: "Delete failed", color: "danger" });
    }
  };

  const handleDeleteMethod = async (id: string) => {
    if (!clinicId || !currentUser) return;
    try {
      await appointmentBillingService.deletePaymentMethod(
        clinicId,
        id,
        currentUser.uid,
      );
      const s = await appointmentBillingService.getBillingSettings(clinicId);

      if (s) setBillingSettings(s);
    } catch (e) {
      addToast({ title: "Delete failed", color: "danger" });
    }
  };

  const availableMethods =
    billingSettings?.paymentMethods?.filter((method) => method.isEnabled) || [];

  // ── Rendering ──────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="p-8 text-center text-text-muted">Loading billing…</div>
    );

  return (
    <div className="flex flex-col gap-5 px-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Appointment Billing
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Create and manage appointment invoices
          </p>
        </div>
        {!branchId && isClinicAdmin && branches.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">Branch</span>
            <select
              className="h-8 px-2.5 py-0 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              value={selectedBranchId ?? ""}
              onChange={(e) => setSelectedBranchId(e.target.value || null)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.isMainBranch ? " (all branches)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border-base rounded overflow-hidden">
        {/* Tab Strip */}
        <div className="flex border-b border-border-base bg-surface-2/50">
          {[
            {
              id: "create",
              label: "Create Invoice",
              icon: <IoAddOutline className="w-4 h-4" />,
            },
            {
              id: "manage",
              label: "Manage Invoices",
              icon: <IoStatsChartOutline className="w-4 h-4" />,
            },
            {
              id: "settings",
              label: "Settings",
              icon: <IoSettings className="w-4 h-4" />,
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

        {/* Create Tab */}
        {activeTab === "create" && (
          <div className="p-5 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SearchSelect
                required
                items={patients.map((p) => ({
                  id: p.id,
                  primary: p.name,
                  secondary: p.regNumber,
                }))}
                label="Patient"
                value={formData.patientId}
                onChange={(id) => handlePatientChange(id)}
              />

              <FlatInput
                required
                label="Invoice Date"
                type="date"
                value={formData.invoiceDate}
                onChange={(v) => setFormData((p) => ({ ...p, invoiceDate: v }))}
              />
            </div>
            <div className="border-t border-border-base" />

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[14px] font-semibold text-primary">
                  Invoice Items
                </h3>
                <Button
                  color="primary"
                  size="sm"
                  startContent={<IoAddOutline />}
                  onClick={addInvoiceItem}
                >
                  Add Item
                </Button>
              </div>

              {formData.items.length === 0 ? (
                <div className="py-10 text-center border dashed border-border-base rounded-lg bg-surface-2/30">
                  <IoReceiptOutline className="mx-auto w-10 h-10 text-text-muted/30 mb-2" />
                  <p className="text-[13px] text-text-muted mb-4">
                    No invoice items added
                  </p>
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<IoAddOutline />}
                    onClick={addInvoiceItem}
                  >
                    Add First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.items.map((item, i) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 border border-border-base rounded-lg items-end bg-surface-2/40 shadow-none"
                    >
                      <div className="md:col-span-3">
                        <SearchSelect
                          items={appointmentTypes.map((t) => ({
                            id: t.id,
                            primary: t.name,
                            secondary: fmtCur(t.price),
                          }))}
                          label="Appointment Type"
                          value={item.appointmentTypeId}
                          onChange={(id) =>
                            updateInvoiceItem(i, { appointmentTypeId: id })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <SearchSelect
                          items={[
                            ...doctors.filter((_d: any) => _d.isActive !== false).map((d) => ({
                              id: d.id,
                              primary: d.name,
                              secondary: `Doctor ${d.speciality ? `• ${d.speciality}` : ""}`,
                            })),
                            ...experts.filter((_e: any) => _e.isActive !== false).map((e) => ({
                              id: e.id,
                              primary: e.name,
                              secondary: `Expert ${e.specialty || e.speciality ? `• ${e.specialty || e.speciality}` : ""}`,
                            }))
                          ]}
                          label="Clinician"
                          placeholder="Select Doctor or Expert"
                          value={item.doctorId || ""}
                          onChange={(id) => {
                            const d = doctors.find((doc) => doc.id === id);
                            const e = experts.find((exp) => exp.id === id);
                            const clinician = d || e;

                            updateInvoiceItem(i, {
                              doctorId: id,
                              doctorName: clinician?.name || "",
                              commission:
                                clinician?.defaultCommission ??
                                billingSettings?.defaultCommission ??
                                0,
                            });
                          }}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <FlatInput
                          label="Price (NPR)"
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.price.toString()}
                          onChange={(v) =>
                            updateInvoiceItem(i, { price: parseFloat(v) || 0 })
                          }
                        />
                      </div>
                      <div className="md:col-span-1">
                        <FlatInput
                          label="Qty"
                          min="1"
                          type="number"
                          value={item.quantity.toString()}
                          onChange={(v) =>
                            updateInvoiceItem(i, { quantity: parseInt(v) || 1 })
                          }
                        />
                      </div>
                      <div className="md:col-span-1">
                        <div className="flex flex-col gap-1">
                          <label className="text-[12px] font-medium text-text-muted">
                            Disc. Type
                          </label>
                          <select
                            className="h-9 px-1 text-[11.5px] border border-border-base rounded bg-surface shadow-none"
                            value={item.discountType || "percent"}
                            onChange={(e) =>
                              updateInvoiceItem(i, {
                                discountType: e.target.value as any,
                              })
                            }
                          >
                            <option value="percent">%</option>
                            <option value="flat">Flat</option>
                          </select>
                        </div>
                      </div>
                      <div className="md:col-span-1">
                        <FlatInput
                          label="Disc. Val"
                          type="number"
                          value={(item.discountValue || 0).toString()}
                          onChange={(v) =>
                            updateInvoiceItem(i, {
                              discountValue: parseFloat(v) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-1">
                        <FlatInput
                          label="Comm."
                          suffixText="%"
                          type="number"
                          value={item.commission.toString()}
                          onChange={(v) =>
                            updateInvoiceItem(i, {
                              commission: parseFloat(v) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end gap-2">
                        <div className="flex-1">
                          <FlatInput
                            disabled
                            label="Final Amount"
                            value={fmtCur(item.amount)}
                          />
                        </div>
                        <button
                          className="w-10 h-10 flex items-center justify-center text-red-500 border border-red-500/20 rounded hover:bg-red-500/5 shrink-0 transition-colors"
                          type="button"
                          onClick={() => removeInvoiceItem(i)}
                        >
                          <IoTrashOutline />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formData.items.length > 0 && (
              <>
                <div className="border-t border-border-base" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-[13px] font-semibold text-text-main">
                      Discount & Tax
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[12px] font-medium text-text-muted">
                          Discount Type
                        </label>
                        <select
                          className="h-9 px-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main"
                          value={formData.discountType}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              discountType: e.target.value as any,
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
                      placeholder="Optional notes"
                      value={formData.notes}
                      onChange={(v) => setFormData((p) => ({ ...p, notes: v }))}
                    />
                  </div>
                  <div className="bg-surface-2 border border-border-base rounded p-4 text-[13px] space-y-2 text-text-muted">
                    <h4 className="font-semibold text-primary mb-2">Summary</h4>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{fmtCur(calculations.subtotal)}</span>
                    </div>
                    {patientDue > 0 && (
                      <div className="flex justify-between text-saffron-600 font-medium">
                        <span>Previous Due:</span>
                        <span>{fmtCur(patientDue)}</span>
                      </div>
                    )}
                    {calculations.itemDiscountAmount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted/60 italic ml-2">
                          Item-level Discounts:
                        </span>
                        <span className="text-red-400">
                          - {fmtCur(calculations.itemDiscountAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Invoice Discount:</span>
                      <span className="text-red-500">
                        - {fmtCur(calculations.mainDiscountAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border-base mt-1 pt-1 font-semibold">
                      <span>Total Discount:</span>
                      <span className="text-red-500">
                        - {fmtCur(calculations.totalDiscount)}
                      </span>
                    </div>
                    {billingSettings.enableTax && (
                      <div className="flex justify-between">
                        <span>
                          {billingSettings.taxLabel} (
                          {billingSettings.defaultTaxPercentage}%):
                        </span>
                        <span>{fmtCur(calculations.taxAmount)}</span>
                      </div>
                    )}
                    <div className="border-t border-border-base pt-2 flex justify-between font-bold text-text-main text-[14px]">
                      <span>Total:</span>
                      <span>{fmtCur(calculations.totalAmount)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    color="default"
                    variant="bordered"
                    onClick={() => {
                      setFormData({ ...emptyForm });
                      setPatientDue(0);
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    color="primary"
                    isLoading={submitting}
                    onClick={handleCreateSubmit}
                  >
                    Create Invoice
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Manage Tab */}
        {activeTab === "manage" && (
          <div className="p-5 flex flex-col gap-4">
            {billings.length > 0 && (
              <div className="w-64">
                <div className="flex items-center h-9 border border-border-base rounded bg-surface focus-within:border-primary">
                  <IoSearchOutline className="ml-2.5 w-4 h-4 text-text-muted/50" />
                  <input
                    className="flex-1 px-2 text-[12.5px] bg-transparent focus:outline-none placeholder:text-text-muted/40 text-text-main"
                    placeholder="Search invoices…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            )}

            {filteredBillings.length === 0 ? (
              <div className="text-center py-12">
                <IoReceiptOutline className="mx-auto w-12 h-12 text-text-muted/30 mb-3" />
                <p className="text-[14px] font-medium text-text-main">
                  No invoices found
                </p>
                {searchQuery ? (
                  <Button
                    className="mt-3"
                    color="default"
                    size="sm"
                    variant="bordered"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                ) : (
                  <Button
                    className="mt-3"
                    color="primary"
                    size="sm"
                    startContent={<IoAddOutline />}
                    onClick={() => setActiveTab("create")}
                  >
                    Create Invoice
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto border border-border-base rounded">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border-base">
                        {[
                          "INVOICE #",
                          "PATIENT",
                          "DOCTOR",
                          "DATE",
                          "AMOUNT",
                          "STATUS",
                          "PAYMENT",
                          "ACTIONS",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-[10.5px] font-semibold text-primary uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base bg-transparent">
                      {currentBillings.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-surface-2 transition-colors"
                        >
                          <td className="px-3 py-2.5 text-[12.5px] font-mono text-text-main">
                            {b.invoiceNumber}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-text-main">
                            {b.patientName === "Unknown Patient" ||
                              !b.patientName
                              ? patients.find((p) => p.id === b.patientId)
                                ?.name ||
                              b.patientName ||
                              "Unknown Patient"
                              : b.patientName}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px]">
                            <p className="text-text-main">
                              {(() => {
                                // 1. Try to find a valid doctor/expert name using doctorId
                                const docId =
                                  b.doctorId && b.doctorId !== "unassigned"
                                    ? b.doctorId
                                    : b.items?.find(
                                      (i) =>
                                        i.doctorId &&
                                        i.doctorId !== "unassigned",
                                    )?.doctorId;

                                if (docId) {
                                  const foundDoc = doctors.find(
                                    (d) => d.id === docId,
                                  );

                                  if (
                                    foundDoc &&
                                    foundDoc.name !== "Unknown Doctor" &&
                                    foundDoc.name !== "Expert Cabin"
                                  )
                                    return foundDoc.name;
                                  const foundExp = experts.find(
                                    (e) => e.id === docId,
                                  );

                                  if (
                                    foundExp &&
                                    foundExp.name !== "Unknown Doctor" &&
                                    foundExp.name !== "Expert Cabin"
                                  )
                                    return foundExp.name;
                                }

                                // 2. If the stored b.doctorName is valid (not "Unknown Doctor" and not "Expert Cabin"), use it
                                if (
                                  b.doctorName &&
                                  b.doctorName !== "Unknown Doctor" &&
                                  b.doctorName !== "Expert Cabin"
                                ) {
                                  return b.doctorName;
                                }

                                // 3. Try to find in items
                                const itemName = b.items?.find(
                                  (i) =>
                                    i.doctorName &&
                                    i.doctorName !== "Unknown Doctor" &&
                                    i.doctorName !== "Expert Cabin",
                                )?.doctorName;

                                if (itemName) return itemName;

                                // 4. Default fallback
                                return b.doctorName === "Unknown Doctor" ||
                                  !b.doctorName
                                  ? "Expert Cabin"
                                  : b.doctorName;
                              })()}
                            </p>
                            {(() => {
                              const otherDoctors = Array.from(
                                new Set(
                                  b.items
                                    ? b.items
                                      .filter(
                                        (i) =>
                                          i.doctorId &&
                                          i.doctorId !== b.doctorId,
                                      )
                                      .map((i) => i.doctorName)
                                    : [],
                                ),
                              );

                              if (otherDoctors.length > 0) {
                                return (
                                  <span className="text-[10px] text-teal-600 font-medium bg-teal-50 px-1 rounded">
                                    + {otherDoctors.length} more clinician
                                    {otherDoctors.length > 1 ? "s" : ""}
                                  </span>
                                );
                              }

                              return (
                                <span className="text-[10px] text-text-muted/60">
                                  {b.doctorType}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-text-muted">
                            {fmtDate(b.invoiceDate)}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] font-semibold text-text-main">
                            {fmtCur(b.totalAmount)}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-1 items-start">
                              <StatusBadge
                                status={b.paymentStatus}
                                type="payment"
                              />
                              {b.paymentStatus !== "paid" && (
                                <span className="text-[10.5px] text-text-muted">
                                  Bal: {fmtCur(b.balanceAmount)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded"
                                title="View"
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/dashboard/appointments-billing/${b.id}`,
                                  )
                                }
                              >
                                <IoEyeOutline />
                              </button>
                              <Dropdown>
                                <DropdownTrigger>
                                  <button
                                    className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded flex items-center gap-0.5"
                                    title="Print"
                                    type="button"
                                  >
                                    <IoPrintOutline />
                                    <IoChevronDown className="w-2.5 h-2.5 opacity-50" />
                                  </button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label="Print Formats">
                                  <DropdownItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(
                                        `/dashboard/appointments-billing/${b.id}?print=true&format=A4`,
                                        "_blank",
                                      );
                                    }}
                                  >
                                    A4 Full Page
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(
                                        `/dashboard/appointments-billing/${b.id}?print=true&format=A4_HALF`,
                                        "_blank",
                                      );
                                    }}
                                  >
                                    A4 Half Page
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(
                                        `/dashboard/appointments-billing/${b.id}?print=true&format=THERMAL_80MM`,
                                        "_blank",
                                      );
                                    }}
                                  >
                                    Thermal (80mm)
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(
                                        `/dashboard/appointments-billing/${b.id}?print=true&format=THERMAL_58MM`,
                                        "_blank",
                                      );
                                    }}
                                  >
                                    Thermal (58mm)
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(
                                        `/dashboard/appointments-billing/${b.id}?print=true&format=THERMAL_4INCH`,
                                        "_blank",
                                      );
                                    }}
                                  >
                                    Label (4-inch)
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
                              <button
                                className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded"
                                title="Edit"
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/dashboard/appointments-billing/${b.id}/edit`,
                                  )
                                }
                              >
                                <IoPencilOutline />
                              </button>
                              {b.paymentStatus !== "paid" && (
                                <button
                                  className="p-1.5 text-text-muted hover:text-green-600 hover:bg-green-500/10 rounded"
                                  title="Pay"
                                  type="button"
                                  onClick={() => {
                                    setSelectedBillingForPayment(b);
                                    setPaymentForm((p) => ({
                                      ...p,
                                      amount: b.balanceAmount.toString(),
                                    }));
                                    setShowPaymentModal(true);
                                  }}
                                >
                                  <IoCash />
                                </button>
                              )}
                              <button
                                className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-500/10 rounded"
                                title="Delete"
                                type="button"
                                onClick={() => {
                                  setDeletingBilling(b);
                                  setShowDeleteModal(true);
                                }}
                              >
                                <IoTrashOutline />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Custom basic Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-[12.5px] text-text-muted mt-2">
                    <span>
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        filteredBillings.length,
                      )}{" "}
                      of {filteredBillings.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        className="px-2 py-1 border border-border-base rounded hover:bg-surface-2 disabled:opacity-50 text-text-main"
                        disabled={currentPage === 1}
                        type="button"
                        onClick={() => setCurrentPage((p) => p - 1)}
                      >
                        Prev
                      </button>
                      <button
                        className="px-2 py-1 border border-border-base rounded hover:bg-surface-2 disabled:opacity-50 text-text-main"
                        disabled={currentPage === totalPages}
                        type="button"
                        onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="p-5 space-y-8">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Add form */}
              <div className="flex-1 w-full border border-border-base rounded overflow-hidden bg-surface">
                <div className="px-4 py-3 bg-surface-2 border-b border-border-base">
                  <h4 className={title({ size: "sm", color: "primary" })}>
                    Add Payment Method
                  </h4>
                </div>
                {/* ... existing payment method form content ... */}
                <div className="p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FlatInput
                      required
                      label="Method Name"
                      value={paymentMethodForm.name}
                      onChange={(v) =>
                        setPaymentMethodForm((p) => ({
                          ...p,
                          name: v,
                          key: v
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, "_")
                            .replace(/_+/g, "_")
                            .replace(/^_|_$/g, ""),
                        }))
                      }
                    />
                    <FlatInput
                      required
                      hint="Auto-generated"
                      label="Method Key"
                      value={paymentMethodForm.key}
                      onChange={(v) =>
                        setPaymentMethodForm((p) => ({
                          ...p,
                          key: v.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                        }))
                      }
                    />
                  </div>
                  <FlatInput
                    label="Description"
                    value={paymentMethodForm.description}
                    onChange={(v) =>
                      setPaymentMethodForm((p) => ({ ...p, description: v }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-medium text-text-muted">
                        Icon
                      </label>
                      <select
                        className="h-9 px-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main"
                        value={paymentMethodForm.icon}
                        onChange={(e) =>
                          setPaymentMethodForm((p) => ({
                            ...p,
                            icon: e.target.value,
                          }))
                        }
                      >
                        {[
                          "💳 Card",
                          "💵 Cash",
                          "📱 Mobile",
                          "📲 Digital Wallet",
                          "🏦 Bank",
                          "📋 Cheque",
                        ].map((i) => (
                          <option key={i.charAt(0)} value={i.charAt(0)}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center mt-6">
                      <Toggle
                        checked={paymentMethodForm.requiresReference}
                        label="Requires Reference"
                        onChange={(c) =>
                          setPaymentMethodForm((p) => ({
                            ...p,
                            requiresReference: c,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <Button
                      color="primary"
                      disabled={!paymentMethodForm.name}
                      isLoading={isAddingPaymentMethod}
                      size="sm"
                      onClick={handleAddPaymentMethod}
                    >
                      Add Method
                    </Button>
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 w-full border border-border-base rounded overflow-hidden bg-surface">
                <div className="px-4 py-3 bg-surface-2 border-b border-border-base">
                  <h4 className={title({ size: "sm", color: "primary" })}>
                    Current Methods
                  </h4>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {billingSettings?.paymentMethods?.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 border border-border-base rounded bg-surface-2/30"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[20px]">{m.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-medium text-text-main">
                              {m.name}
                            </span>
                            {m.isCustom && (
                              <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted/60">
                            Key: {m.key} •{" "}
                            {m.requiresReference ? "Ref Req." : "No Ref"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Toggle
                          checked={m.isEnabled}
                          label=""
                          onChange={() => handleToggleMethod(m.id, m.isEnabled)}
                        />
                        {m.isCustom && (
                          <button
                            className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded text-text-muted"
                            type="button"
                            onClick={() => handleDeleteMethod(m.id)}
                          >
                            <IoTrashOutline />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border-base pt-8 mt-8">
              <h3
                className={title({
                  size: "md",
                  color: "primary",
                  fullWidth: true,
                })}
              >
                Treatment Categories
              </h3>
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1 w-full border border-border-base rounded overflow-hidden bg-surface">
                  <div className="px-4 py-3 bg-surface-2 border-b border-border-base">
                    <h4 className={title({ size: "sm", color: "primary" })}>
                      Add Category
                    </h4>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                    <FlatInput
                      required
                      label="Category Name"
                      value={categoryForm.name}
                      onChange={(v) =>
                        setCategoryForm((p) => ({ ...p, name: v }))
                      }
                    />
                    <FlatInput
                      label="Description"
                      value={categoryForm.description}
                      onChange={(v) =>
                        setCategoryForm((p) => ({ ...p, description: v }))
                      }
                    />
                    <div className="mt-2 text-right">
                      <Button
                        color="primary"
                        disabled={!categoryForm.name}
                        isLoading={isAddingCategory}
                        size="sm"
                        onClick={handleAddCategory}
                      >
                        Add Category
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full border border-border-base rounded overflow-hidden bg-surface">
                  <div className="px-4 py-3 bg-surface-2 border-b border-border-base">
                    <h4 className={title({ size: "sm", color: "primary" })}>
                      Current Categories
                    </h4>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    {treatmentCategories.length === 0 ? (
                      <p className="text-center py-4 text-text-muted/50 text-[12.5px]">
                        No categories yet.
                      </p>
                    ) : (
                      treatmentCategories.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3 border border-border-base rounded bg-surface-2/30 shadow-none"
                        >
                          <div>
                            <span className="text-[13px] font-bold text-text-main">
                              {c.name}
                            </span>
                            {c.description && (
                              <p className="text-[11px] text-text-muted mt-0.5">
                                {c.description}
                              </p>
                            )}
                          </div>
                          <button
                            className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-500/10 rounded transition-colors"
                            onClick={() => handleDeleteCategory(c.id)}
                          >
                            <IoTrashOutline />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* View Modal */}
      {showInvoiceModal && selectedBilling && (
        <ModalShell
          footer={
            <>
              <Button
                color="default"
                size="sm"
                variant="bordered"
                onClick={() => setShowInvoiceModal(false)}
              >
                Close
              </Button>
              {selectedBilling.paymentStatus !== "paid" && (
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setSelectedBillingForPayment(selectedBilling);
                    setPaymentForm((p) => ({
                      ...p,
                      amount: selectedBilling.balanceAmount.toString(),
                    }));
                    setShowPaymentModal(true);
                  }}
                >
                  Record Payment
                </Button>
              )}
              <Button
                color="primary"
                size="sm"
                variant="bordered"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(
                    `/dashboard/appointments-billing/${selectedBilling.id}?print=true`,
                    "_blank",
                  );
                }}
              >
                Print
              </Button>
            </>
          }
          size="xl"
          subtitle={
            <span className="text-text-muted/60 font-mono text-[11.5px]">
              {selectedBilling.invoiceNumber}
            </span>
          }
          title="Invoice Details"
          onClose={() => setShowInvoiceModal(false)}
        >
          <div className="space-y-4 text-[13px] text-text-main">
            <div className="grid grid-cols-2 gap-3 bg-surface-2 p-3 rounded border border-border-base">
              <div>
                <p className="text-[11px] text-text-muted">Patient</p>
                <p className="font-semibold">{selectedBilling.patientName}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">Doctor</p>
                <p className="font-semibold">
                  {selectedBilling.doctorName} ({selectedBilling.doctorType})
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">Date</p>
                <p>{fmtDate(selectedBilling.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">Status</p>
                <StatusBadge status={selectedBilling.status} />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-text-main border-b border-border-base pb-1">
                Items
              </h4>
              <div className="space-y-1">
                {selectedBilling.items.map((i, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-surface border border-border-base p-2 rounded"
                  >
                    <div>
                      <p className="font-medium">{i.appointmentTypeName}</p>
                      <p className="text-[11.5px] text-text-muted">
                        {fmtCur(i.price)} × {i.quantity}
                      </p>
                    </div>
                    <span>{fmtCur(i.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col items-end border-t border-border-base pt-3">
              <p className="w-48 flex justify-between text-text-muted">
                <span>Subtotal:</span>
                <span>{fmtCur(selectedBilling.subtotal)}</span>
              </p>
              <p className="w-48 flex justify-between text-text-muted">
                <span>Discount:</span>
                <span className="text-red-500">
                  - {fmtCur(selectedBilling.discountAmount)}
                </span>
              </p>
              {selectedBilling.taxAmount > 0 && (
                <p className="w-48 flex justify-between text-text-muted">
                  <span>Tax:</span>
                  <span>{fmtCur(selectedBilling.taxAmount)}</span>
                </p>
              )}
              <p className="w-48 flex justify-between font-bold text-text-main mt-1 border-t border-border-base pt-1">
                <span>Total:</span>
                <span>{fmtCur(selectedBilling.totalAmount)}</span>
              </p>
            </div>

            {selectedBilling.paidAmount > 0 && (
              <div className="bg-green-500/5 p-3 rounded border border-green-500/10 space-y-1 mt-4">
                <h4 className="font-semibold text-green-600 border-b border-green-500/10 pb-1 mb-2">
                  Payment Summary
                </h4>
                <p className="flex justify-between text-text-muted">
                  <span>Total:</span>
                  <span>{fmtCur(selectedBilling.totalAmount)}</span>
                </p>
                <p className="flex justify-between font-bold text-green-600">
                  <span>Paid:</span>
                  <span>{fmtCur(selectedBilling.paidAmount)}</span>
                </p>
                {selectedBilling.balanceAmount > 0 && (
                  <p className="flex justify-between text-red-600 font-semibold mt-1 border-t border-border-base pt-1">
                    <span>Due:</span>
                    <span>{fmtCur(selectedBilling.balanceAmount)}</span>
                  </p>
                )}

                {selectedBilling.paymentHistory &&
                  selectedBilling.paymentHistory.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-green-500/20">
                      <h5 className="text-[11px] font-semibold text-green-700 mb-2 uppercase tracking-wider">
                        Payment History
                      </h5>
                      <div className="space-y-2">
                        {selectedBilling.paymentHistory.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="bg-white/60 p-2 rounded text-[11px] flex justify-between items-center border border-green-500/10"
                          >
                            <div>
                              <p className="font-semibold text-green-800">
                                {fmtCur(p.amount)}
                              </p>
                              <p className="text-text-muted/80 mt-0.5">
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
                                <p className="text-text-muted/60 mt-0.5">
                                  Ref: {p.reference}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBillingForPayment && (
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
                disabled={!paymentForm.amount}
                isLoading={paymentProcessing}
                size="sm"
                onClick={handlePaymentSubmit}
              >
                Record Payment
              </Button>
            </>
          }
          size="md"
          subtitle={
            <span className="text-text-muted/60 text-[11.5px]">
              Invoice: {selectedBillingForPayment.invoiceNumber} — Bal:{" "}
              {fmtCur(selectedBillingForPayment.balanceAmount)}
            </span>
          }
          title="Record Payment"
          onClose={() => setShowPaymentModal(false)}
        >
          <div className="space-y-4">
            <FlatInput
              required
              hint={`Max: ${fmtCur(selectedBillingForPayment.balanceAmount)}`}
              label="Amount (NPR)"
              type="number"
              value={paymentForm.amount}
              onChange={(v) => setPaymentForm((p) => ({ ...p, amount: v }))}
            />
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-text-muted">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                className="h-9 px-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
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
            {availableMethods.find((m) => m.key === paymentForm.method)
              ?.requiresReference && (
                <FlatInput
                  required
                  label="Reference ID"
                  value={paymentForm.reference}
                  onChange={(v) =>
                    setPaymentForm((p) => ({ ...p, reference: v }))
                  }
                />
              )}
            <FlatInput
              label="Notes"
              value={paymentForm.notes}
              onChange={(v) => setPaymentForm((p) => ({ ...p, notes: v }))}
            />
          </div>
        </ModalShell>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deletingBilling && (
        <ModalShell
          disabled={isDeleting}
          footer={
            <>
              <Button
                color="default"
                disabled={isDeleting}
                size="sm"
                variant="bordered"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                isLoading={isDeleting}
                size="sm"
                onClick={handleDelete}
              >
                Delete Invoice
              </Button>
            </>
          }
          size="md"
          title="Delete Invoice"
          onClose={() => setShowDeleteModal(false)}
        >
          <div className="text-[13px] text-text-muted">
            <p>
              Are you sure you want to delete invoice{" "}
              <strong className="font-mono text-text-main">
                {deletingBilling.invoiceNumber}
              </strong>
              ?
            </p>
            <div className="mt-3 p-3 bg-red-500/5 border border-red-500/10 rounded text-red-500">
              <p className="font-semibold flex items-center gap-1">
                <IoTrashOutline /> This action cannot be undone.
              </p>
              <p className="text-[12px] mt-1">
                This will permanently remove the invoice and any associated
                ledger records.
              </p>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
