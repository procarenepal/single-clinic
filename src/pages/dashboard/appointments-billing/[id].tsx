/**
 * Invoice Detail Page — Clinic Clarity, zero HeroUI
 * Custom UI per src/design/spec.md. Invoice print layout unchanged.
 */
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  IoArrowBackOutline,
  IoPrintOutline,
  IoCloseOutline,
  IoCreateOutline,
} from "react-icons/io5";
import {
  IoReceiptOutline,
  IoAddOutline,
  IoCashOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoCloseCircleOutline,
  IoCard,
  IoCash,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { appointmentService } from "@/services/appointmentService";
import { clinicService } from "@/services/clinicService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { patientPackageService } from "@/services/patientPackageService";
import { AppointmentBilling, Patient } from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import { useAuth } from "@/hooks/useAuth";
import { useModalState } from "@/hooks/useModalState";
import { adToBS } from "@/utils/dateConverter";
import {
  generateAppointmentInvoiceHTML,
  PrintFormat,
} from "@/utils/invoicePrinting";
import { Select, SelectItem } from "@/components/ui/select";

// ── UI Helpers (spec: flat, compact, border-based) ─────────────────────────
function StatusBadge({
  status,
  type = "payment",
}: {
  status: string;
  type?: "status" | "payment";
}) {
  const S_COLORS: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    finalized: "bg-primary/10 text-primary border-primary/20",
    partial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    unpaid: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    default:
      "bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))]",
  };
  const color = S_COLORS[status] || S_COLORS.default;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border capitalize ${color}`}
    >
      {status}
    </span>
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
        className={`flex items-center h-8 border border-[rgb(var(--color-border))] rounded bg-[rgb(var(--color-surface))] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10 ${disabled ? "opacity-60" : ""}`}
      >
        {prefixText && (
          <span className="pl-2.5 text-[12px] text-[rgb(var(--color-text-muted))] shrink-0">
            {prefixText}
          </span>
        )}
        <input
          className="flex-1 w-full px-2.5 text-[12.5px] bg-transparent focus:outline-none text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] disabled:opacity-50"
          disabled={disabled}
          min={min}
          placeholder={placeholder}
          step={step}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
      {hint && (
        <p className="text-[10.5px] text-[rgb(var(--color-text-muted))]">
          {hint}
        </p>
      )}
    </div>
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
  size?: "md" | "lg" | "xl";
  disabled?: boolean;
}) {
  const widthMap = { md: "max-w-md", lg: "max-w-2xl", xl: "max-w-3xl" };

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
        className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-[rgb(var(--color-border))] shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-[rgb(var(--color-text))]">
              {title}
            </h3>
            {subtitle && (
              <div className="mt-1 text-[12px] text-[rgb(var(--color-text-muted))]">
                {subtitle}
              </div>
            )}
          </div>
          {!disabled && (
            <button
              className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] mt-0.5 transition-colors"
              type="button"
              onClick={onClose}
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))]/50 shrink-0">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function InvoiceDetailPage() {
  const { id: invoiceId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, clinicId, userData, isLoading: authLoading } = useAuth();
  const paymentModal = useModalState(false);
  const branchId = userData?.branchId ?? null;
  const isClinicAdmin = userData?.role === "system-owner";

  const [invoice, setInvoice] = useState<AppointmentBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );
  const [clinic, setClinic] = useState<any>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [previousDue, setPreviousDue] = useState<number>(0);
  const [doctor, setDoctor] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<PrintFormat>("A4");

  // Payment form state
  const [paymentSplits, setPaymentSplits] = useState([
    { id: "1", amount: "", method: "cash", reference: "", notes: "" }
  ]);

  // Available payment methods (would come from billing settings in real app)
  const availablePaymentMethods = [
    { key: "cash", name: "Cash", icon: "💵" },
    { key: "card", name: "Card", icon: "💳" },
    { key: "bank_transfer", name: "Bank Transfer", icon: "🏦" },
    { key: "mobile_banking", name: "Mobile Banking", icon: "📱" },
  ];

  if (patient && (patient.walletBalance || 0) > 0) {
    availablePaymentMethods.push({
      key: "wallet",
      name: `Wallet Balance (NPR ${patient.walletBalance?.toLocaleString()})`,
      icon: "💰",
    });
  }

  useEffect(() => {
    const loadInvoiceDetails = async () => {
      if (!invoiceId) return;

      if (authLoading || !clinicId) return;

      try {
        setLoading(true);

        const [clinicData, layoutConfigData, invoiceData] = await Promise.all([
          clinicService.getClinicById(clinicId),
          clinicService.getPrintLayoutConfig(clinicId),
          appointmentBillingService.getBillingById(invoiceId),
        ]);

        if (!invoiceData) {
          addToast({
            title: "Invoice not found",
            description: "The requested invoice could not be found.",
            color: "danger",
          });
          navigate("/dashboard/appointments-billing");

          return;
        }

        if (invoiceData.clinicId !== clinicId) {
          addToast({
            title: "Access denied",
            description: "This invoice does not belong to your clinic.",
            color: "danger",
          });
          navigate("/dashboard/appointments-billing");

          return;
        }

        if (branchId && invoiceData.branchId !== branchId) {
          addToast({
            title: "Access denied",
            description: "You can only view invoices for your branch.",
            color: "danger",
          });
          navigate("/dashboard/appointments-billing");

          return;
        }

        setInvoice(invoiceData);
        if (clinicData) setClinic(clinicData);
        if (layoutConfigData) {
          setLayoutConfig(layoutConfigData);
          const formatParam = searchParams.get("format") as PrintFormat;

          if (formatParam) {
            setPrintFormat(formatParam);
          } else if (layoutConfigData.defaultPrintFormat) {
            setPrintFormat(layoutConfigData.defaultPrintFormat as PrintFormat);
          }
        }

        try {
          const patientData = await patientService.getPatientById(
            invoiceData.patientId,
          );

          if (patientData) {
            setPatient(patientData);
            
            // Calculate previous due from appointment billing
            const allBilling = await appointmentBillingService.getBillingByPatient(
              invoiceData.patientId,
              clinicId
            );
            const totalDue = Math.round(allBilling.reduce((sum, b) => {
              if (b.id === invoiceId) return sum; // exclude current invoice
              if (b.createdAt.getTime() >= invoiceData.createdAt.getTime()) return sum; // exclude future invoices
              return sum + (b.balanceAmount || 0);
            }, 0));
            setPreviousDue(totalDue);
          }
        } catch (error) {
          console.error("Error loading patient data:", error);
        }

        try {
          let docIdToFetch = invoiceData.doctorId;

          if (
            (!docIdToFetch || docIdToFetch === "unassigned") &&
            invoiceData.patientId
          ) {
            const patientAppts =
              await appointmentService.getAppointmentsByPatient(
                invoiceData.patientId,
              );
            const matchingAppt = patientAppts.find(
              (a) =>
                a.billingId === invoiceId ||
                a.consultationBillingId === invoiceId,
            );

            if (
              matchingAppt &&
              matchingAppt.assignedExpertId &&
              matchingAppt.assignedExpertId !== "unassigned"
            ) {
              docIdToFetch = matchingAppt.assignedExpertId;
            } else if (
              matchingAppt &&
              matchingAppt.doctorId &&
              matchingAppt.doctorId !== "unassigned"
            ) {
              docIdToFetch = matchingAppt.doctorId;
            }
          }

          if (docIdToFetch && docIdToFetch !== "unassigned") {
            const docData = await doctorService.getDoctorById(docIdToFetch);

            if (docData) {
              setDoctor(docData);
            } else {
              const expData = await expertService.getExpertById(docIdToFetch);

              if (expData) setDoctor(expData);
            }
          }
        } catch (error) {
          console.error("Error loading doctor data:", error);
        }
      } catch (error) {
        console.error("Error loading invoice details:", error);
        addToast({
          title: "Error",
          description: "Failed to load invoice details",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadInvoiceDetails();
  }, [invoiceId, clinicId, branchId, navigate, authLoading]);

  // Trigger automatic print if the URL contains `?print=true` once data is loaded
  useEffect(() => {
    if (!loading && invoice && searchParams.get("print") === "true") {
      // Overwrite current window with the generated invoice HTML
      const html = generateAppointmentInvoiceHTML(
        invoice,
        clinic,
        layoutConfig,
        patient,
        printFormat,
        doctor,
      );

      document.open();
      document.write(html);
      document.close();
    }
  }, [loading, invoice, searchParams, clinic, layoutConfig, patient, doctor]);

  const formatCurrency = (amount: number) => {
    return `NPR ${amount.toLocaleString()}`;
  };

  const formatDateWithBS = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const adDate = dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    try {
      const bsDate = adToBS(dateObj);

      return {
        ad: adDate,
        bs: bsDate.formatted,
        bsReadable: `${bsDate.day} ${["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"][bsDate.month - 1]} ${bsDate.year}`,
      };
    } catch (error) {
      console.error("Error converting to BS date:", error);

      return {
        ad: adDate,
        bs: "",
        bsReadable: "",
      };
    }
  };

  // Calculate age from date of birth or use stored age
  const getPatientAge = (p: Patient | null): string | number | null => {
    if (!p) return null;

    // Prefer explicitly stored age
    if (p.age) {
      return p.age;
    }

    // Fallback to DOB-based calculation
    if (p.dob) {
      const today = new Date();
      const birthDate = new Date(p.dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      return age;
    }

    return null;
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <IoCheckmarkCircleOutline className="w-5 h-5" />;
      case "partial":
        return <IoWarningOutline className="w-5 h-5" />;
      case "unpaid":
        return <IoCloseCircleOutline className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getPaymentMethodIcon = (iconText?: string) => {
    switch (iconText) {
      case "💵":
        return IoCash;
      case "💳":
      case "📱":
      case "🏦":
        return IoCard;
      default:
        return IoCard;
    }
  };

  const handlePaymentSubmit = async () => {
    if (!invoice || !currentUser) return;

    const validSplits = paymentSplits.filter(s => {
      const amt = parseFloat(s.amount);
      return !isNaN(amt) && amt > 0;
    });

    if (validSplits.length === 0) {
      addToast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        color: "warning",
      });
      return;
    }

    const totalPayment = Math.round(validSplits.reduce((sum, s) => sum + parseFloat(s.amount), 0));

    if (totalPayment > invoice.balanceAmount) {
      addToast({
        title: "Excessive Amount",
        description: "Total payment cannot exceed the balance amount.",
        color: "warning",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      for (const split of validSplits) {
        await appointmentBillingService.recordPayment(
          invoice.id,
          parseFloat(split.amount),
          split.method,
          split.reference || undefined,
          split.notes || undefined,
        );
      }

      addToast({
        title: "Payment Recorded",
        description: `Total payment of ${formatCurrency(totalPayment)} has been recorded successfully.`,
        color: "success",
      });

      const updatedInvoice = await appointmentBillingService.getBillingById(
        invoiceId!,
      );

      if (updatedInvoice) {
        setInvoice(updatedInvoice);
      }

      // Close payment modal
      paymentModal.forceClose();
      setPaymentSplits([{ id: Date.now().toString(), amount: "", method: "cash", reference: "", notes: "" }]);
    } catch (error) {
      console.error("Error recording payment:", error);
      addToast({
        title: "Payment Error",
        description: "Failed to record payment. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentOpen = () => {
    if (!invoice) return;
    setPaymentSplits([{
      id: Date.now().toString(),
      amount: invoice.balanceAmount.toString(),
      method: "cash",
      reference: "",
      notes: "",
    }]);
    paymentModal.open();
  };

  const handlePrint = () => {
    if (!invoice) return;

    // Create a new window for printing
    const printWindow = window.open("", "_blank", "width=800,height=600");

    if (printWindow) {
      const printContent = generateAppointmentInvoiceHTML(
        invoice,
        clinic,
        layoutConfig,
        patient,
        printFormat,
      );

      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      addToast({
        title: "Error",
        description:
          "Unable to open print window. Please check your browser settings.",
        color: "danger",
      });
    }
  };

  if (loading || authLoading || !clinicId) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-12">
        <div className="clarity-page-header flex flex-wrap items-center gap-3">
          <button
            className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded border border-transparent hover:border-border-base transition-all"
            type="button"
            onClick={() => navigate(-1)}
          >
            <IoArrowBackOutline className="w-5 h-5" />
          </button>
          <div>
            <h1 className="clarity-page-title text-[15px] font-bold text-text-main tracking-tight">
              Invoice Details
            </h1>
            <p className="clarity-page-subtitle text-[12.5px] text-text-muted mt-0.5">
              {authLoading
                ? "Authenticating..."
                : !clinicId
                  ? "Setting up clinic..."
                  : "Loading invoice information..."}
            </p>
          </div>
        </div>
        <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded p-6 flex items-center justify-center min-h-[200px]">
          <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
            {authLoading
              ? "Authenticating..."
              : !clinicId
                ? "Setting up clinic..."
                : "Loading invoice details..."}
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-12">
        <div className="clarity-page-header flex flex-wrap items-center gap-3">
          <button
            className="p-2 text-mountain-500 hover:text-teal-600 hover:bg-teal-50 rounded border border-transparent hover:border-mountain-200"
            type="button"
            onClick={() => navigate(-1)}
          >
            <IoArrowBackOutline className="w-5 h-5" />
          </button>
          <div>
            <h1 className="clarity-page-title text-[15px] font-bold text-text-main tracking-tight">
              Invoice Not Found
            </h1>
            <p className="clarity-page-subtitle text-[12.5px] text-text-muted mt-0.5">
              The requested invoice could not be found
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate payment progress (treat fully paid / zero balance as 100% even when total is 0)
  const paymentProgress =
    invoice.totalAmount > 0
      ? (invoice.paidAmount / invoice.totalAmount) * 100
      : invoice.paymentStatus === "paid" || invoice.balanceAmount <= 0
        ? 100
        : 0;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .print-only { display: none !important; }
          @media print {
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            body { margin: 0 !important; padding: 0 !important; }
            .print-only { margin: 0 !important; padding: 5mm !important; width: 100% !important; height: 100% !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; }
          }
        `,
        }}
      />
      <div className="flex flex-col gap-4 px-4 pb-12 no-print">
        {/* Page header — spec: clarity-page-header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              className="p-2 text-mountain-500 hover:text-teal-600 hover:bg-teal-50 rounded border border-transparent hover:border-mountain-200"
              type="button"
              onClick={() => navigate(-1)}
            >
              <IoArrowBackOutline className="w-5 h-5" />
            </button>
            <div>
              <h1 className="clarity-page-title text-[15px] font-bold text-text-main tracking-tight">
                Invoice Details
              </h1>
              <div className="clarity-page-subtitle text-[12.5px] text-text-muted mt-0.5 space-y-0.5">
                <p>
                  {invoice.invoiceNumber} •{" "}
                  {formatDateWithBS(invoice.invoiceDate).ad}
                </p>
                {formatDateWithBS(invoice.invoiceDate).bsReadable && (
                  <p className="text-[11px] italic">
                    {formatDateWithBS(invoice.invoiceDate).bsReadable} BS
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="w-40 no-print">
              <Select
                selectedKeys={[printFormat]}
                size="sm"
                onSelectionChange={(keys) => {
                  const format = Array.from(keys)[0] as PrintFormat;

                  setPrintFormat(format);
                }}
              >
                <SelectItem key="A4">A4 Full Page</SelectItem>
                <SelectItem key="A4_HALF">A4 Half (A5)</SelectItem>
                <SelectItem key="THERMAL_80MM">Thermal 80mm</SelectItem>
                <SelectItem key="THERMAL_58MM">Thermal 58mm</SelectItem>
                <SelectItem key="THERMAL_4INCH">Label (4-inch)</SelectItem>
              </Select>
            </div>
            <Button
              color="default"
              size="sm"
              startContent={<IoPrintOutline className="w-4 h-4" />}
              variant="bordered"
              onClick={handlePrint}
            >
              Print Invoice
            </Button>
            {invoice.balanceAmount > 0 && invoice.paidAmount === 0 && (
              <Button
                color="secondary"
                size="sm"
                startContent={<IoCreateOutline className="w-4 h-4" />}
                onClick={() => navigate(`/dashboard/appointments-billing/${invoice.id}/edit`)}
                variant="flat"
              >
                Edit Invoice
              </Button>
            )}
            {invoice.balanceAmount > 0 && (
              <Button
                color="primary"
                size="sm"
                startContent={<IoAddOutline className="w-4 h-4" />}
                onClick={handlePaymentOpen}
              >
                Record Payment
              </Button>
            )}
          </div>
        </div>

        {/* Payment status bar — clarity-card, no shadow */}
        <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded p-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-[12px] text-[rgb(var(--color-text-muted))] mb-0.5">
                Total Amount
              </p>
              <p className="text-stat-sm text-[rgb(var(--color-text))] tracking-tight">
                {formatCurrency(invoice.totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[rgb(var(--color-text-muted))] mb-0.5">
                Paid Amount
              </p>
              <p className="text-[22px] font-bold text-primary tracking-tight">
                {formatCurrency(invoice.paidAmount)}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[rgb(var(--color-text-muted))] mb-0.5">
                Balance Amount
              </p>
              <p
                className={`text-[22px] font-bold tracking-tight ${invoice.balanceAmount > 0 ? "text-rose-400" : "text-primary"}`}
              >
                {formatCurrency(invoice.balanceAmount)}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[rgb(var(--color-text-muted))] mb-0.5">
                Payment Status
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {getPaymentStatusIcon(invoice.paymentStatus)}
                <StatusBadge status={invoice.paymentStatus} />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[12px] text-[rgb(var(--color-text-muted))]">
                Payment Progress
              </span>
              <span className="text-[12px] font-medium text-[rgb(var(--color-text))]">
                {paymentProgress.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-[rgb(var(--color-surface-2))] rounded overflow-hidden">
              <div
                className="h-full rounded transition-[width] ease-out"
                style={{
                  width: `${Math.min(100, paymentProgress)}%`,
                  backgroundColor:
                    paymentProgress >= 100
                      ? "rgb(var(--color-primary))"
                      : paymentProgress > 0
                        ? "rgb(217 119 6)"
                        : "rgb(225 29 72)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Invoice details — two cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Invoice Items — clarity-table */}
          <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded overflow-hidden">
            <div className="px-4 py-3 bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] flex items-center gap-2">
              <IoReceiptOutline className="w-4 h-4 text-primary" />
              <h3 className="text-[13px] font-semibold text-[rgb(var(--color-text))] uppercase tracking-wide">
                Invoice Items
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full clarity-table border-collapse">
                <thead>
                  <tr>
                    <th className="text-center w-10">S.N.</th>
                    <th className="text-left">Service</th>
                    <th className="text-center w-16">Qty</th>
                    <th className="text-right w-24">Price</th>
                    <th className="text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={index}>
                      <td className="text-center text-[13px] text-[rgb(var(--color-text-muted))]">
                        {index + 1}
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-[rgb(var(--color-text))] text-[13px]">
                            {item.appointmentTypeName}
                          </p>
                          {item.commission > 0 && (
                            <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                              Commission: {item.commission}%
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-center text-[13px]">
                        {item.quantity}
                      </td>
                      <td className="text-right text-[13px]">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="text-right text-[13px]">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))]/60 space-y-1.5 text-[13px] text-[rgb(var(--color-text))]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {(invoice.itemDiscountAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>Service Discounts:</span>
                  <span className="text-rose-400">
                    - {formatCurrency(invoice.itemDiscountAmount || 0)}
                  </span>
                </div>
              )}
              {(invoice.mainDiscountAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>Invoice Discount ({invoice.discountType}):</span>
                  <span className="text-rose-400">
                    - {formatCurrency(invoice.mainDiscountAmount || 0)}
                  </span>
                </div>
              )}
              {(invoice.itemDiscountAmount || 0) === 0 &&
                (invoice.mainDiscountAmount || 0) === 0 &&
                invoice.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount ({invoice.discountType}):</span>
                    <span className="text-rose-400">
                      - {formatCurrency(invoice.discountAmount)}
                    </span>
                  </div>
                )}
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({invoice.taxPercentage}%):</span>
                  <span>{formatCurrency(invoice.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[rgb(var(--color-text))] text-[14px] pt-1.5 border-t border-[rgb(var(--color-border))] mt-1.5">
                <span>Total Amount:</span>
                <span>{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Invoice Information */}
          <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded overflow-hidden">
            <div className="px-4 py-3 bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] flex items-center gap-2">
              <IoCashOutline className="w-4 h-4 text-primary" />
              <h3 className="text-[13px] font-semibold text-[rgb(var(--color-text))] uppercase tracking-wide">
                Invoice Information
              </h3>
            </div>
            <div className="p-4 space-y-5 text-[13px]">
              <div>
                <h4 className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5">
                  Patient Information
                </h4>
                <div className="space-y-0.5 text-[rgb(var(--color-text))]">
                  <p>
                    <span className="font-medium">Name:</span>{" "}
                    <Link
                      to={`/dashboard/patients/${invoice.patientId}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      {patient?.name || invoice.patientName}
                    </Link>
                  </p>
                  {getPatientAge(patient) !== null && (
                    <p>
                      <span className="font-medium">Age:</span>{" "}
                      {getPatientAge(patient)}
                    </p>
                  )}
                  {patient?.gender && (
                    <p>
                      <span className="font-medium">Gender:</span>{" "}
                      <span className="capitalize">{patient.gender}</span>
                    </p>
                  )}
                  {patient?.address && (
                    <p>
                      <span className="font-medium">Address:</span>{" "}
                      {patient.address}
                    </p>
                  )}
                  {previousDue > 0 && (
                    <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[12px] font-medium flex items-center gap-1.5 no-print">
                      <IoWarningOutline className="w-4 h-4 shrink-0" />
                      <span>Reminder: Patient has a previous due of {formatCurrency(previousDue)} from past visits.</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5">
                  {((): boolean => {
                    const docIds = new Set(
                      invoice.items
                        .filter((i) => i.doctorId)
                        .map((i) => i.doctorId),
                    );

                    if (invoice.doctorId) docIds.add(invoice.doctorId);

                    return docIds.size > 1;
                  })()
                    ? "Clinical Team"
                    : "Doctor Information"}
                </h4>
                <div className="space-y-3">
                  {(() => {
                    const uniqueDocs = new Map();

                    // Add items' doctors
                    invoice.items.forEach((item) => {
                      if (item.doctorId && !uniqueDocs.has(item.doctorId)) {
                        uniqueDocs.set(item.doctorId, {
                          id: item.doctorId,
                          name: item.doctorName,
                          isPrimary: item.doctorId === invoice.doctorId,
                        });
                      }
                    });
                    // Ensure primary doctor is in list if not already
                    if (invoice.doctorId && !uniqueDocs.has(invoice.doctorId)) {
                      uniqueDocs.set(invoice.doctorId, {
                        id: invoice.doctorId,
                        name: invoice.doctorName,
                        isPrimary: true,
                      });
                    }

                    const docs = Array.from(uniqueDocs.values());

                    return docs.map((doc, idx) => {
                      const resolvedName = (() => {
                        // 1. If we have a resolved doctor/expert state matching doc.id, use its name
                        if (
                          doctor &&
                          (doc.id === doctor.id ||
                            (doc.id === "unassigned" &&
                              doctor.id !== "unassigned"))
                        ) {
                          if (
                            doctor.name &&
                            doctor.name !== "Unknown Doctor" &&
                            doctor.name !== "Expert Cabin"
                          ) {
                            return doctor.name;
                          }
                        }

                        // 2. If the stored doc.name is valid (not "Unknown Doctor" and not "Expert Cabin"), use it
                        if (
                          doc.name &&
                          doc.name !== "Unknown Doctor" &&
                          doc.name !== "Expert Cabin"
                        ) {
                          return doc.name;
                        }

                        // 3. Fallback to doctor state if available
                        if (
                          doctor?.name &&
                          doctor.name !== "Unknown Doctor" &&
                          doctor.name !== "Expert Cabin"
                        ) {
                          return doctor.name;
                        }

                        // 4. Default fallbacks
                        if (doc.id === "unassigned") return "Expert Cabin";

                        return doc.name || "Unknown Doctor";
                      })();

                      return (
                        <div
                          key={idx}
                          className="space-y-0.5 text-[rgb(var(--color-text))] border-l-2 border-primary/30 pl-2"
                        >
                          <p className="flex items-center gap-2">
                            <span className="font-medium">Name:</span>{" "}
                            {resolvedName}
                            {doc.isPrimary && docs.length > 1 && (
                              <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 border border-primary/20 rounded">
                                Primary
                              </span>
                            )}
                          </p>
                          {doc.isPrimary && (
                            <p>
                              <span className="font-medium text-mountain-500">
                                Type:
                              </span>{" "}
                              {invoice.doctorType}
                            </p>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5">
                  Invoice Details
                </h4>
                <div className="space-y-0.5 text-[rgb(var(--color-text))]">
                  <p>
                    <span className="font-medium">Invoice Number:</span>{" "}
                    {invoice.invoiceNumber}
                  </p>
                  <div>
                    <p>
                      <span className="font-medium">Invoice Date:</span>{" "}
                      {formatDateWithBS(invoice.invoiceDate).ad}
                    </p>
                    {formatDateWithBS(invoice.invoiceDate).bsReadable && (
                      <p className="text-[11px] text-mountain-500 ml-4 italic">
                        {formatDateWithBS(invoice.invoiceDate).bsReadable} BS
                      </p>
                    )}
                  </div>
                  <p>
                    <span className="font-medium">Status:</span>{" "}
                    {invoice.status}
                  </p>
                  {invoice.paymentMethod && (
                    <p>
                      <span className="font-medium">Payment Method:</span>{" "}
                      {invoice.paymentMethod.replace("_", " ")}
                    </p>
                  )}
                  {invoice.paymentReference && (
                    <p>
                      <span className="font-medium">Payment Reference:</span>{" "}
                      {invoice.paymentReference}
                    </p>
                  )}
                </div>
              </div>
              {invoice.notes && (
                <div>
                  <h4 className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5">
                    Notes
                  </h4>
                  <p className="text-mountain-600 text-[12.5px]">
                    {invoice.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Recording Modal — custom ModalShell */}
      {paymentModal.isOpen && invoice && (
        <ModalShell
          disabled={isSubmitting}
          footer={
            <>
              <Button
                color="default"
                disabled={isSubmitting}
                size="sm"
                variant="bordered"
                onClick={paymentModal.close}
              >
                Cancel
              </Button>
              <Button
                color="secondary"
                disabled={
                  paymentSplits.length === 0 ||
                  paymentSplits.some(s => !s.amount || parseFloat(s.amount) <= 0) ||
                  isSubmitting
                }
                isLoading={isSubmitting}
                size="sm"
                onClick={handlePaymentSubmit}
              >
                {isSubmitting ? "Recording…" : "Record Payment"}
              </Button>
            </>
          }
          size="md"
          subtitle={
            <div className="space-y-0.5 text-[12px]">
              <p>
                <span className="font-medium text-mountain-700">Invoice:</span>{" "}
                {invoice.invoiceNumber}
              </p>
              <p>
                <span className="font-medium text-mountain-700">Patient:</span>{" "}
                {invoice.patientName}
              </p>
              <p className="text-red-600 font-semibold">
                <span className="font-medium text-mountain-700">Balance:</span>{" "}
                {formatCurrency(invoice.balanceAmount)}
              </p>
            </div>
          }
          title="Record Payment"
          onClose={paymentModal.close}
        >
          <div className="space-y-4">
            {paymentSplits.map((split, index) => (
              <div key={split.id} className="p-3 border border-border-base rounded-md bg-surface-2/30 relative space-y-3">
                {paymentSplits.length > 1 && (
                  <button 
                    type="button" 
                    className="absolute top-2 right-2 text-danger hover:text-danger-600" 
                    onClick={() => setPaymentSplits(paymentSplits.filter(s => s.id !== split.id))}
                  >
                    <IoCloseOutline className="w-4 h-4"/>
                  </button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FlatInput
                    required
                    hint={index === 0 ? `Maximum: ${formatCurrency(invoice.balanceAmount)}` : undefined}
                    label="Payment Amount"
                    min="0"
                    placeholder="Enter payment amount"
                    prefixText="NPR"
                    step="0.01"
                    type="number"
                    value={split.amount}
                    onChange={(v) =>
                      setPaymentSplits(paymentSplits.map(s => s.id === split.id ? { ...s, amount: v } : s))
                    }
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-medium text-mountain-700">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="h-8 w-full px-2.5 text-[12.5px] border border-mountain-200 rounded bg-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-100 text-mountain-800"
                      value={split.method}
                      onChange={(e) =>
                        setPaymentSplits(paymentSplits.map(s => s.id === split.id ? { ...s, method: e.target.value } : s))
                      }
                    >
                      {availablePaymentMethods.map((method) => (
                        <option key={method.key} value={method.key}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FlatInput
                    hint="Transaction ID / Reference"
                    label="Reference"
                    placeholder="Optional"
                    value={split.reference}
                    onChange={(v) =>
                      setPaymentSplits(paymentSplits.map(s => s.id === split.id ? { ...s, reference: v } : s))
                    }
                  />
                  <FlatInput
                    label="Notes"
                    placeholder="Optional notes"
                    value={split.notes}
                    onChange={(v) =>
                      setPaymentSplits(paymentSplits.map(s => s.id === split.id ? { ...s, notes: v } : s))
                    }
                  />
                </div>
              </div>
            ))}

            <Button 
              type="button" 
              variant="flat" 
              color="primary" 
              size="sm" 
              startContent={<IoAddOutline />} 
              onClick={() => setPaymentSplits([...paymentSplits, { id: Date.now().toString(), amount: "", method: "cash", reference: "", notes: "" }])}
            >
              Add Split Tender
            </Button>

            {(() => {
              const totalAmount = Math.round(paymentSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0));
              if (totalAmount > 0) {
                const newBalance = invoice.balanceAmount - totalAmount;
                return (
                  <div className="p-3 bg-mountain-50 border border-mountain-100 rounded text-[12px] space-y-1 mt-4">
                    <h4 className="font-semibold text-mountain-900 mb-1.5">
                      Payment Summary
                    </h4>
                    <div className="flex justify-between">
                      <span className="text-mountain-600">Total Invoice:</span>
                      <span>{formatCurrency(invoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mountain-600">Already Paid:</span>
                      <span className="text-health-600">
                        {formatCurrency(invoice.paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mountain-600">Current Payment:</span>
                      <span className="text-teal-700 font-semibold">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                    <div className="border-t border-mountain-200 my-1.5 pt-1.5 flex justify-between font-semibold">
                      <span>New Balance:</span>
                      <span className={newBalance <= 0 ? "text-health-600" : "text-red-600"}>
                        {formatCurrency(newBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-mountain-500">Status:</span>
                      <span className={newBalance <= 0 ? "text-health-600 font-semibold" : "text-saffron-600 font-semibold"}>
                        {newBalance <= 0 ? "Fully Paid" : "Partially Paid"}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </ModalShell>
      )}
    </>
  );
}
