/**
 * Invoice Detail Page — Clinic Clarity, zero HeroUI
 * Custom UI per src/design/spec.md. Invoice print layout unchanged.
 */
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useState, useMemo, useRef } from "react";
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
import { ReasonConfirmModal } from "@/components/ui/ReasonConfirmModal";
import { StatusBadge } from "@/components/billing/StatusBadge";
import { IrdSyncBadge } from "@/components/billing/IrdSyncBadge";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { billingApi } from "@/services/api/billingApi";
import { appointmentService } from "@/services/appointmentService";
import { clinicService } from "@/services/clinicService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { AppointmentBilling, Patient } from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { adToBS } from "@/utils/dateConverter";
import {
  getLastPaymentMethod,
  setLastPaymentMethod,
} from "@/utils/lastUsedPreferences";
import {
  generateAppointmentInvoiceHTML,
  PrintFormat,
} from "@/utils/invoicePrinting";
import { Select, SelectItem } from "@/components/ui/select";

// ── UI Helpers (spec: flat, compact, border-based) ─────────────────────────
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el =
      document.getElementById("dashboard-scroll-container") || document.body;
    const prev = el.style.overflow;

    el.style.overflow = "hidden";

    return () => {
      el.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled) onClose();
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [onClose, disabled]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 overflow-hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh] outline-none`}
        tabIndex={-1}
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
              aria-label="Close"
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
  // If we arrived via a front-office guided action (e.g. "Settle Billing"),
  // the back button should return there — with the tab the staff member was
  // on — instead of the generic invoice list.
  const cameFromFrontOffice = searchParams.get("from") === "front-office";
  const returnTab = searchParams.get("tab");
  const backDestination = cameFromFrontOffice
    ? `/dashboard/front-office?tab=${returnTab || "billing"}`
    : "/dashboard/appointments-billing";
  const {
    currentUser,
    clinicId,
    userData,
    isLoading: authLoading,
  } = useAuthContext();
  const paymentModal = useModalState(false);
  const branchId = userData?.branchId ?? null;
  const isClinicAdmin = userData?.role === "clinic-admin";

  const [invoice, setInvoice] = useState<AppointmentBilling | null>(null);
  const [reasonModal, setReasonModal] = useState<
    "cancel" | "creditNote" | null
  >(null);
  const [reasonModalSubmitting, setReasonModalSubmitting] = useState(false);
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
  const [unpaidPastInvoices, setUnpaidPastInvoices] = useState<
    AppointmentBilling[]
  >([]);
  const [includePreviousDue, setIncludePreviousDue] = useState(false);

  // Payment form state
  const [paymentSplits, setPaymentSplits] = useState([
    {
      id: "1",
      amount: "",
      method: getLastPaymentMethod("cash"),
      reference: "",
      notes: "",
    },
  ]);
  useEffect(() => {
    if (paymentSplits.length === 1 && invoice) {
      const maxAllowed = includePreviousDue
        ? invoice.balanceAmount + previousDue
        : invoice.balanceAmount;

      setPaymentSplits((prev) => [
        { ...prev[0], amount: maxAllowed > 0 ? maxAllowed.toString() : "" },
      ]);
    }
  }, [includePreviousDue, invoice]);

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
          navigate(backDestination);

          return;
        }

        if (invoiceData.clinicId !== clinicId) {
          addToast({
            title: "Access denied",
            description: "This invoice does not belong to your clinic.",
            color: "danger",
          });
          navigate(backDestination);

          return;
        }

        if (branchId && invoiceData.branchId !== branchId) {
          addToast({
            title: "Access denied",
            description: "You can only view invoices for your branch.",
            color: "danger",
          });
          navigate(backDestination);

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
            const allBilling =
              await appointmentBillingService.getBillingByPatient(
                invoiceData.patientId,
                clinicId,
              );
            const pastUnpaid = allBilling.filter(
              (b) =>
                b.id !== invoiceId &&
                b.createdAt.getTime() < invoiceData.createdAt.getTime() &&
                (b.balanceAmount || 0) > 0,
            );
            const totalDue = Math.round(
              pastUnpaid.reduce((sum, b) => sum + (b.balanceAmount || 0), 0),
            );

            setPreviousDue(totalDue);
            setUnpaidPastInvoices(
              pastUnpaid.sort(
                (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
              ),
            );
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

  // Trigger automatic print if the URL contains `?print=true` once data is
  // loaded — routed through the same handlePrint() the in-page Print button
  // uses (matching pathology/pharmacy's deep links) instead of separately
  // overwriting the current window in place, which skipped the popup
  // window entirely and never incremented printCount, breaking the
  // IRD-required "COPY OF ORIGINAL – N" numbering on this specific path.
  useEffect(() => {
    if (!loading && invoice && searchParams.get("print") === "true") {
      const timer = setTimeout(() => handlePrint(), 400);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, invoice, searchParams]);

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

    const validSplits = paymentSplits.filter((s) => {
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

    const totalPayment = Math.round(
      validSplits.reduce((sum, s) => sum + parseFloat(s.amount), 0),
    );
    // Rounded to match totalPayment (already Math.round'd above) and what's
    // pre-filled in the form (Math.round(balanceAmount)) — comparing a
    // rounded payment against a raw, unrounded balance (e.g. 813.6 from tax
    // math) would reject the form's own default amount as "excessive".
    const maxAllowed = Math.round(
      includePreviousDue
        ? invoice.balanceAmount + previousDue
        : invoice.balanceAmount,
    );

    if (totalPayment > maxAllowed) {
      addToast({
        title: "Excessive Amount",
        description: `Total payment cannot exceed ${includePreviousDue ? "total balance including previous due" : "the balance amount"}.`,
        color: "warning",
      });

      return;
    }

    try {
      setIsSubmitting(true);

      let currentInvoiceRemaining = invoice.balanceAmount;
      const pastInvoicesQueue = unpaidPastInvoices.map((inv) => ({
        id: inv.id,
        remaining: inv.balanceAmount,
        invoiceNumber: inv.invoiceNumber,
      }));
      let totalPaidToOldInvoices = 0;

      for (const split of validSplits) {
        let splitAmountRemaining = parseFloat(split.amount);

        // 1. Pay current invoice first
        if (currentInvoiceRemaining > 0 && splitAmountRemaining > 0) {
          const applyAmount = Math.min(
            splitAmountRemaining,
            currentInvoiceRemaining,
          );

          await appointmentBillingService.recordPayment(
            invoice.id,
            applyAmount,
            split.method,
            split.reference || undefined,
            split.notes || undefined,
          );
          splitAmountRemaining -= applyAmount;
          currentInvoiceRemaining -= applyAmount;
        }

        // 2. Apply rest to previous invoices
        if (includePreviousDue && splitAmountRemaining > 0) {
          for (const oldInv of pastInvoicesQueue) {
            if (splitAmountRemaining <= 0) break;
            if (oldInv.remaining > 0) {
              const applyOld = Math.min(splitAmountRemaining, oldInv.remaining);
              const combinedNotes = split.notes
                ? `${split.notes} (with ${invoice.invoiceNumber})`
                : `Paid with ${invoice.invoiceNumber}`;

              await appointmentBillingService.recordPayment(
                oldInv.id,
                applyOld,
                split.method,
                split.reference || undefined,
                combinedNotes,
              );

              splitAmountRemaining -= applyOld;
              oldInv.remaining -= applyOld;
              totalPaidToOldInvoices += applyOld;
            }
          }
        }
      }

      if (totalPaidToOldInvoices > 0) {
        await appointmentBillingService.updateBilling(invoice.id, {
          previousDuePaidAmount:
            ((invoice as any).previousDuePaidAmount || 0) +
            totalPaidToOldInvoices,
        } as any);
      }

      // Commission generation is now handled safely by appointmentBillingService.recordPayment

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

      setLastPaymentMethod(validSplits[0].method);

      // Close payment modal
      paymentModal.forceClose();
      setPaymentSplits([
        {
          id: Date.now().toString(),
          amount: "",
          method: getLastPaymentMethod("cash"),
          reference: "",
          notes: "",
        },
      ]);
    } catch (error: any) {
      console.error("Error recording payment:", error);
      addToast({
        title: "Payment Error",
        description: error?.message || "Failed to record payment. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentOpen = () => {
    if (!invoice) return;
    setIncludePreviousDue(false);
    setPaymentSplits([
      {
        id: Date.now().toString(),
        amount: invoice.balanceAmount.toString(),
        method: getLastPaymentMethod("cash"),
        reference: "",
        notes: "",
      },
    ]);
    paymentModal.open();
  };

  const handlePrint = () => {
    if (!invoice) return;

    // 0 = original, N = the Nth reprint (IRD requires reprints numbered "Copy of Original – N")
    const copyNumber = invoice.printCount || 0;

    // Update print count in background
    appointmentBillingService.updateBilling(invoice.id, {
      printCount: (invoice.printCount || 0) + 1
    }).catch(console.error);

    // Mirror into the MySQL Schedule 5 ledger too — best-effort, never
    // blocks the print itself.
    if ((invoice as any).javaInvoiceId) {
      billingApi.recordPrint((invoice as any).javaInvoiceId).catch(console.error);
    }

    // Create a new window for printing
    const printWindow = window.open("", "_blank", "width=800,height=600");

    if (printWindow) {
      const printedByText = userData ? `${userData.displayName} (${userData.role})` : "";
      const printContent = generateAppointmentInvoiceHTML(
        invoice,
        clinic,
        layoutConfig,
        patient,
        printFormat,
        undefined,
        copyNumber,
        printedByText
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

  const handleCancelInvoice = async (reason: string) => {
    if (!invoice) return;

    setReasonModalSubmitting(true);
    try {
      await appointmentBillingService.cancelBilling(invoice.id, reason);
      const updatedInvoice = await appointmentBillingService.getBillingById(
        invoice.id,
      );

      setInvoice(updatedInvoice);
      setReasonModal(null);
      addToast({
        title: "Success",
        description: "Invoice cancelled successfully.",
        color: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Error",
        description: err.message || "Failed to cancel invoice.",
        color: "danger",
      });
    } finally {
      setReasonModalSubmitting(false);
    }
  };

  const handleIssueCreditNote = async (reason: string) => {
    if (!invoice) return;

    setReasonModalSubmitting(true);
    try {
      await appointmentBillingService.issueCreditNote(
        invoice.id,
        reason,
        currentUser?.uid || "unknown",
      );
      const updatedInvoice = await appointmentBillingService.getBillingById(
        invoice.id,
      );

      setInvoice(updatedInvoice);
      setReasonModal(null);
      addToast({
        title: "Success",
        description: "Credit Note issued successfully.",
        color: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Error",
        description: err.message || "Failed to issue credit note.",
        color: "danger",
      });
    } finally {
      setReasonModalSubmitting(false);
    }
  };

  if (loading || authLoading || !clinicId) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-12">
        <div className="clarity-page-header flex flex-wrap items-center gap-3">
          <button
            className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded border border-transparent hover:border-border-base transition-all"
            title={cameFromFrontOffice ? "Back to Front Office" : undefined}
            type="button"
            onClick={() => navigate(backDestination)}
          >
            <IoArrowBackOutline className="w-5 h-5" />
          </button>
          <div>
            <h1 className="clarity-page-title">
              Invoice Details
            </h1>
            <p className="clarity-page-subtitle">
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
            title={cameFromFrontOffice ? "Back to Front Office" : undefined}
            type="button"
            onClick={() => navigate(backDestination)}
          >
            <IoArrowBackOutline className="w-5 h-5" />
          </button>
          <div>
            <h1 className="clarity-page-title">
              Invoice Not Found
            </h1>
            <p className="clarity-page-subtitle">
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
              title={cameFromFrontOffice ? "Back to Front Office" : undefined}
              type="button"
              onClick={() => navigate(backDestination)}
            >
              <IoArrowBackOutline className="w-5 h-5" />
            </button>
            <div>
              <h1 className="clarity-page-title">
                Invoice Details
              </h1>
              <div className="clarity-page-subtitle space-y-0.5">
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
              title={
                invoice.printCount
                  ? `Will print as "Copy of Original – ${invoice.printCount}"`
                  : "Will print as the original"
              }
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
                variant="flat"
                onClick={() =>
                  navigate(`/dashboard/appointments-billing/${invoice.id}/edit`)
                }
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
            {invoice.status !== "cancelled" &&
              invoice.status !== "finalized" && (
                <Button
                  color="danger"
                  size="sm"
                  startContent={<IoCloseCircleOutline className="w-4 h-4" />}
                  variant="light"
                  onClick={() => setReasonModal("cancel")}
                >
                  Cancel Invoice
                </Button>
              )}
            {invoice.status === "finalized" &&
              invoice.irdSynced &&
              !invoice.isCreditNote &&
              !invoice.hasCreditNote && (
                <Button
                  color="danger"
                  size="sm"
                  startContent={
                    <span className="font-bold text-[11px]">CN</span>
                  }
                  variant="light"
                  onClick={() => setReasonModal("creditNote")}
                >
                  Issue Credit Note
                </Button>
              )}
          </div>
        </div>

        {/* Payment status bar — clarity-card, no shadow */}
        <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded p-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
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
            <div>
              <p className="text-[12px] text-[rgb(var(--color-text-muted))] mb-0.5">
                IRD Status
              </p>
              <div className="mt-0.5">
                <IrdSyncBadge
                  attempted={Boolean(
                    invoice.irdSynced || invoice.cbmsResponseCode,
                  )}
                  invoiceType="appointment"
                  recordId={invoice.id}
                  synced={Boolean(invoice.irdSynced)}
                  onSynced={async () => {
                    const updatedInvoice =
                      await appointmentBillingService.getBillingById(
                        invoice.id,
                      );

                    setInvoice(updatedInvoice);
                  }}
                />
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
                          {item.doctorName &&
                            item.doctorName !== "Unknown Doctor" &&
                            item.doctorName !== "Expert Cabin" && (
                              <p className="text-[12px] text-mountain-500 mt-0.5">
                                Assigned: {item.doctorName}
                              </p>
                            )}
                          {item.commission > 0 && (
                            <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">
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
                      className="text-primary font-semibold hover:underline"
                      to={`/dashboard/patients/${invoice.patientId}`}
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
                  <p
                    className={
                      invoice.patientPanVat
                        ? undefined
                        : "text-[rgb(var(--color-text-muted))]"
                    }
                    title="This is what prints on the invoice's Purchaser's PAN field — shown here so a missing PAN is caught before printing, not after."
                  >
                    <span className="font-medium">PAN:</span>{" "}
                    {invoice.patientPanVat || patient?.patientPanVat || "—"}
                  </p>
                  {previousDue > 0 && (
                    <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[12px] font-medium flex items-center gap-1.5 no-print">
                      <IoWarningOutline className="w-4 h-4 shrink-0" />
                      <span>
                        Reminder: Patient has a previous due of{" "}
                        {formatCurrency(previousDue)} from past visits.
                      </span>
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
                            {docs.length > 1 &&
                              (doc.isPrimary ? (
                                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 border border-primary/20 rounded">
                                  Primary
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-mountain-500 bg-mountain-500/10 px-1 border border-mountain-500/20 rounded">
                                  Secondary
                                </span>
                              ))}
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
                  <p title="Invoice lifecycle stage — separate from Payment Status above. A 'draft' invoice can still be fully paid; it just means the invoice record hasn't been explicitly finalized.">
                    <span className="font-medium">Invoice Stage:</span>{" "}
                    {invoice.status === "draft"
                      ? "Draft"
                      : invoice.status === "finalized"
                        ? "Finalized"
                        : invoice.status === "cancelled"
                          ? "Cancelled"
                          : invoice.status}
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
                  paymentSplits.some(
                    (s) => !s.amount || parseFloat(s.amount) <= 0,
                  ) ||
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
          size="xl"
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {previousDue > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-[13px] text-amber-800">
                  <input
                    checked={includePreviousDue}
                    className="w-4 h-4 text-primary rounded border-mountain-300 focus:ring-primary"
                    id="includePreviousDue"
                    type="checkbox"
                    onChange={(e) => {
                      const checked = e.target.checked;

                      setIncludePreviousDue(checked);
                      if (
                        checked &&
                        paymentSplits.length === 1 &&
                        parseFloat(paymentSplits[0].amount) ===
                          invoice.balanceAmount
                      ) {
                        setPaymentSplits([
                          {
                            ...paymentSplits[0],
                            amount: (
                              invoice.balanceAmount + previousDue
                            ).toString(),
                          },
                        ]);
                      } else if (
                        !checked &&
                        paymentSplits.length === 1 &&
                        parseFloat(paymentSplits[0].amount) ===
                          invoice.balanceAmount + previousDue
                      ) {
                        setPaymentSplits([
                          {
                            ...paymentSplits[0],
                            amount: invoice.balanceAmount.toString(),
                          },
                        ]);
                      }
                    }}
                  />
                  <label
                    className="font-medium cursor-pointer"
                    htmlFor="includePreviousDue"
                  >
                    Include previous due of {formatCurrency(previousDue)}
                  </label>
                </div>
              )}

              {paymentSplits.map((split, index) => (
                <div
                  key={split.id}
                  className="p-3 border border-border-base rounded-md bg-surface-2/30 relative space-y-3"
                >
                  {paymentSplits.length > 1 && (
                    <button
                      className="absolute top-2 right-2 text-danger hover:text-danger-600"
                      type="button"
                      onClick={() =>
                        setPaymentSplits(
                          paymentSplits.filter((s) => s.id !== split.id),
                        )
                      }
                    >
                      <IoCloseOutline className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FlatInput
                      required
                      hint={
                        index === 0
                          ? `Maximum: ${formatCurrency(includePreviousDue ? invoice.balanceAmount + previousDue : invoice.balanceAmount)}`
                          : undefined
                      }
                      label="Payment Amount"
                      min="0"
                      placeholder="Enter payment amount"
                      prefixText="NPR"
                      step="0.01"
                      type="number"
                      value={split.amount}
                      onChange={(v) =>
                        setPaymentSplits(
                          paymentSplits.map((s) =>
                            s.id === split.id ? { ...s, amount: v } : s,
                          ),
                        )
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
                          setPaymentSplits(
                            paymentSplits.map((s) =>
                              s.id === split.id
                                ? { ...s, method: e.target.value }
                                : s,
                            ),
                          )
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
                        setPaymentSplits(
                          paymentSplits.map((s) =>
                            s.id === split.id ? { ...s, reference: v } : s,
                          ),
                        )
                      }
                    />
                    <FlatInput
                      label="Notes"
                      placeholder="Optional notes"
                      value={split.notes}
                      onChange={(v) =>
                        setPaymentSplits(
                          paymentSplits.map((s) =>
                            s.id === split.id ? { ...s, notes: v } : s,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))}

              <Button
                color="primary"
                size="sm"
                startContent={<IoAddOutline />}
                type="button"
                variant="flat"
                onClick={() =>
                  setPaymentSplits([
                    ...paymentSplits,
                    {
                      id: Date.now().toString(),
                      amount: "",
                      method: getLastPaymentMethod("cash"),
                      reference: "",
                      notes: "",
                    },
                  ])
                }
              >
                Add Split Tender
              </Button>
            </div>
            <div className="lg:col-span-1">
              {(() => {
                // Not rounded — the actual payment application in
                // handlePaymentSubmit uses these exact raw values (parseFloat
                // amount vs. invoice.balanceAmount), so rounding only here
                // desynced this preview from what actually happens: a
                // payment that exactly matches a fractional balance (e.g.
                // 734.5) would round up to 735 for display while the balance
                // stayed 734.5, showing a false "Overpaid by NPR 0.5".
                const totalAmount = paymentSplits.reduce(
                  (sum, s) => sum + (parseFloat(s.amount) || 0),
                  0,
                );

                if (totalAmount > 0) {
                  const effectiveTargetBalance = includePreviousDue
                    ? invoice.balanceAmount + previousDue
                    : invoice.balanceAmount;
                  const newBalance = effectiveTargetBalance - totalAmount;

                  return (
                    <div className="p-3 bg-mountain-50 border border-mountain-100 rounded text-[12px] space-y-1 mt-4">
                      <h4 className="font-semibold text-mountain-900 mb-1.5">
                        Payment Summary
                      </h4>
                      <div className="flex justify-between">
                        <span className="text-mountain-600">
                          Total Invoice:
                        </span>
                        <span>{formatCurrency(invoice.totalAmount)}</span>
                      </div>
                      {includePreviousDue && (
                        <div className="flex justify-between">
                          <span className="text-mountain-600">
                            Previous Due:
                          </span>
                          <span>{formatCurrency(previousDue)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-mountain-600">Already Paid:</span>
                        <span className="text-health-600">
                          {formatCurrency(invoice.paidAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-mountain-200 mt-1 pt-1">
                        <span className="text-mountain-600 font-medium">
                          Total Payable:
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(effectiveTargetBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-mountain-600">
                          Current Payment:
                        </span>
                        <span className="text-teal-700 font-semibold">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>
                      <div className="border-t border-mountain-200 my-1.5 pt-1.5 flex justify-between font-semibold">
                        <span>Remaining Balance:</span>
                        <span
                          className={
                            newBalance < 0
                              ? "text-saffron-600"
                              : newBalance === 0
                                ? "text-health-600"
                                : "text-red-600"
                          }
                        >
                          {newBalance < 0
                            ? `Overpaid by ${formatCurrency(Math.abs(newBalance))}`
                            : formatCurrency(newBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-mountain-500">Status:</span>
                        <span
                          className={
                            newBalance <= 0
                              ? "text-health-600 font-semibold"
                              : "text-saffron-600 font-semibold"
                          }
                        >
                          {newBalance <= 0 ? "Fully Paid" : "Partially Paid"}
                        </span>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          </div>
        </ModalShell>
      )}

      <ReasonConfirmModal
        confirmColor="danger"
        confirmText={
          reasonModal === "cancel" ? "Cancel Invoice" : "Issue Credit Note"
        }
        description={
          reasonModal === "cancel"
            ? "This action cannot be undone."
            : "This will reverse the invoice and create a new negative invoice."
        }
        isOpen={reasonModal !== null}
        isSubmitting={reasonModalSubmitting}
        title={
          reasonModal === "cancel"
            ? "Cancel Invoice"
            : "Issue Credit Note"
        }
        onClose={() => setReasonModal(null)}
        onConfirm={(reason) =>
          reasonModal === "cancel"
            ? handleCancelInvoice(reason)
            : handleIssueCreditNote(reason)
        }
      />
    </>
  );
}
