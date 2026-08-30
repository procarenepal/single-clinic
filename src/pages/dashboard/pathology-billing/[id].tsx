/**
 * Pathology Invoice Detail Page — mirrors the Appointment Billing
 * detail page layout (src/pages/dashboard/appointments-billing/[id].tsx)
 * so all billing modules present a consistent invoice-details view.
 */
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useState, useRef } from "react";
import {
  IoArrowBackOutline,
  IoPrintOutline,
  IoCloseOutline,
  IoAddOutline,
  IoCreateOutline,
  IoReceiptOutline,
  IoCashOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoCloseCircleOutline,
} from "react-icons/io5";

import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";
import { ReasonConfirmModal } from "@/components/ui/ReasonConfirmModal";
import { StatusBadge } from "@/components/billing/StatusBadge";
import { IrdSyncBadge } from "@/components/billing/IrdSyncBadge";
import { pathologyBillingService } from "@/services/pathologyBillingService";
import { clinicService } from "@/services/clinicService";
import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { adToBS } from "@/utils/dateConverter";
import { generateInvoiceHTML, PrintFormat } from "@/utils/invoicePrinting";
import {
  getLastPaymentMethod,
  setLastPaymentMethod,
} from "@/utils/lastUsedPreferences";
import { PrintLayoutConfig } from "@/types/printLayout";
import { PathologyBilling } from "@/types/models";
import { Select, SelectItem } from "@/components/ui/select";

function FlatInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  prefixText,
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  prefixText?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[12px] font-medium text-text-muted">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex items-center h-8 border border-[rgb(var(--color-border))] rounded bg-[rgb(var(--color-surface))] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
        {prefixText && (
          <span className="pl-2.5 text-[12px] text-[rgb(var(--color-text-muted))] shrink-0">
            {prefixText}
          </span>
        )}
        <input
          className="flex-1 w-full px-2.5 text-[12.5px] bg-transparent focus:outline-none text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))]"
          placeholder={placeholder}
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
  disabled,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  disabled?: boolean;
}) {
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
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded w-full max-w-lg flex flex-col max-h-[90vh] outline-none"
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

export default function PathologyInvoiceDetailPage() {
  const { id: invoiceId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, clinicId, userData, isLoading: authLoading } =
    useAuthContext();
  const branchId = userData?.branchId ?? null;
  const paymentModal = useModalState(false);

  const [invoice, setInvoice] = useState<PathologyBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [reasonModal, setReasonModal] = useState<
    "cancel" | "creditNote" | null
  >(null);
  const [reasonModalSubmitting, setReasonModalSubmitting] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );
  const [clinic, setClinic] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<PrintFormat>("A4");

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: getLastPaymentMethod("cash"),
    reference: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!invoiceId || authLoading || !clinicId) return;

      try {
        setLoading(true);

        const [clinicData, layoutConfigData, invoiceData] = await Promise.all([
          clinicService.getClinicById(clinicId),
          clinicService.getPrintLayoutConfig(clinicId),
          pathologyBillingService.getBillingById(invoiceId),
        ]);

        if (!invoiceData) {
          addToast({
            title: "Invoice not found",
            description: "The requested invoice could not be found.",
            color: "danger",
          });
          navigate("/dashboard/pathology?tab=billing");

          return;
        }

        if (invoiceData.clinicId !== clinicId) {
          addToast({
            title: "Access denied",
            description: "This invoice does not belong to your clinic.",
            color: "danger",
          });
          navigate("/dashboard/pathology?tab=billing");

          return;
        }

        if (branchId && invoiceData.branchId !== branchId) {
          addToast({
            title: "Access denied",
            description: "You can only view invoices for your branch.",
            color: "danger",
          });
          navigate("/dashboard/pathology?tab=billing");

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

    load();
  }, [invoiceId, clinicId, branchId, navigate, authLoading]);

  // Trigger automatic print if the URL contains `?print=true` once data is loaded
  useEffect(() => {
    if (!loading && invoice && searchParams.get("print") === "true") {
      const timer = setTimeout(() => handlePrint(), 400);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, invoice, searchParams]);

  const formatCurrency = (amount: number) => `NPR ${Math.round(amount).toLocaleString()}`;

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
        bsReadable: `${bsDate.day} ${["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"][bsDate.month - 1]} ${bsDate.year}`,
      };
    } catch (error) {
      console.error("Error converting to BS date:", error);

      return { ad: adDate, bsReadable: "" };
    }
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

  const handlePrint = () => {
    if (!invoice) return;

    const copyNumber = invoice.printCount || 0;

    pathologyBillingService
      .updateBilling(invoice.id, { printCount: (invoice.printCount || 0) + 1 })
      .catch(console.error);

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

    const printedByText = userData
      ? `${userData.displayName} (${userData.role})`
      : "";
    const printContent = generateInvoiceHTML(
      invoice,
      printFormat,
      clinic,
      layoutConfig,
      copyNumber,
      printedByText,
    );

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handlePaymentOpen = () => {
    if (!invoice) return;
    setPaymentForm({
      amount: Math.round(invoice.balanceAmount).toString(),
      method: getLastPaymentMethod("cash"),
      reference: "",
      notes: "",
    });
    paymentModal.open();
  };

  const handlePaymentSubmit = async () => {
    if (!invoice || !currentUser) return;

    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) {
      addToast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        color: "warning",
      });

      return;
    }

    // Rounded to match what's actually shown/pre-filled in this form (the
    // input defaults to Math.round(balanceAmount)) — comparing against the
    // raw, unrounded balance (e.g. 813.6 from tax math) would reject the
    // form's own default amount (814) as "excessive".
    if (amount > Math.round(invoice.balanceAmount)) {
      addToast({
        title: "Excessive Amount",
        description: "Payment amount cannot exceed the balance amount.",
        color: "warning",
      });

      return;
    }

    try {
      setIsSubmitting(true);
      await pathologyBillingService.recordPayment(
        invoice.id,
        amount,
        paymentForm.method,
        paymentForm.reference || undefined,
        paymentForm.notes || undefined,
        currentUser.uid,
      );

      setLastPaymentMethod(paymentForm.method);
      addToast({
        title: "Payment Recorded",
        description: `Payment of ${formatCurrency(amount)} has been recorded successfully.`,
        color: "success",
      });

      const updated = await pathologyBillingService.getBillingById(invoice.id);

      if (updated) setInvoice(updated);
      paymentModal.forceClose();
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

  const handleCancelInvoice = async (reason: string) => {
    if (!invoice) return;

    setReasonModalSubmitting(true);
    try {
      await pathologyBillingService.cancelBilling(invoice.id, reason);
      const updated = await pathologyBillingService.getBillingById(invoice.id);

      setInvoice(updated);
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
      await pathologyBillingService.issueCreditNote(
        invoice.id,
        reason,
        currentUser?.uid || "unknown",
      );
      const updated = await pathologyBillingService.getBillingById(invoice.id);

      setInvoice(updated);
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
            aria-label="Back"
            className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded border border-transparent hover:border-border-base transition-all"
            type="button"
            onClick={() => navigate("/dashboard/pathology?tab=billing")}
          >
            <IoArrowBackOutline className="w-5 h-5" />
          </button>
          <div>
            <h1 className="clarity-page-title">Invoice Details</h1>
            <p className="clarity-page-subtitle">Loading invoice information...</p>
          </div>
        </div>
        <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded p-6 flex items-center justify-center min-h-[200px]">
          <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
            Loading invoice details...
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
            aria-label="Back"
            className="p-2 text-mountain-500 hover:text-teal-600 hover:bg-teal-50 rounded border border-transparent hover:border-mountain-200"
            type="button"
            onClick={() => navigate("/dashboard/pathology?tab=billing")}
          >
            <IoArrowBackOutline className="w-5 h-5" />
          </button>
          <div>
            <h1 className="clarity-page-title">Invoice Not Found</h1>
            <p className="clarity-page-subtitle">
              The requested invoice could not be found
            </p>
          </div>
        </div>
      </div>
    );
  }

  const paymentProgress =
    invoice.totalAmount > 0
      ? (invoice.paidAmount / invoice.totalAmount) * 100
      : invoice.paymentStatus === "paid" || invoice.balanceAmount <= 0
        ? 100
        : 0;

  return (
    <>
      <div className="flex flex-col gap-4 px-4 pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              aria-label="Back"
              className="p-2 text-mountain-500 hover:text-teal-600 hover:bg-teal-50 rounded border border-transparent hover:border-mountain-200"
              type="button"
              onClick={() => navigate("/dashboard/pathology?tab=billing")}
            >
              <IoArrowBackOutline className="w-5 h-5" />
            </button>
            <div>
              <h1 className="clarity-page-title">Invoice Details</h1>
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
            <div className="w-40">
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
            {!invoice.irdSynced &&
              invoice.status !== "cancelled" &&
              !invoice.isCreditNote && (
                <Button
                  color="secondary"
                  size="sm"
                  startContent={<IoCreateOutline className="w-4 h-4" />}
                  variant="flat"
                  onClick={() =>
                    navigate(`/dashboard/pathology-billing/${invoice.id}/edit`)
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
              invoice.status !== "finalized" &&
              invoice.paymentStatus !== "paid" && (
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
                  startContent={<span className="font-bold text-[11px]">CN</span>}
                  variant="light"
                  onClick={() => setReasonModal("creditNote")}
                >
                  Issue Credit Note
                </Button>
              )}
          </div>
        </div>

        {/* Payment status bar */}
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
                  invoiceType="pathology"
                  recordId={invoice.id}
                  synced={Boolean(invoice.irdSynced)}
                  onSynced={async () => {
                    const updated = await pathologyBillingService.getBillingById(
                      invoice.id,
                    );

                    setInvoice(updated);
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
                    <th className="text-left">Test</th>
                    <th className="text-center w-16">Qty</th>
                    <th className="text-right w-24">Price</th>
                    <th className="text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="text-center text-[13px] text-[rgb(var(--color-text-muted))]">
                        {index + 1}
                      </td>
                      <td>
                        <p className="font-medium text-[rgb(var(--color-text))] text-[13px]">
                          {item.testName}
                          {item.testType && (
                            <span className="text-mountain-500 text-[12px]">
                              {" "}
                              ({item.testType})
                            </span>
                          )}
                        </p>
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
              {(invoice.discountAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>Invoice Discount ({invoice.discountType}):</span>
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
                    {invoice.patientId ? (
                      <Link
                        className="text-primary font-semibold hover:underline"
                        to={`/dashboard/patients/${invoice.patientId}`}
                      >
                        {invoice.patientName}
                      </Link>
                    ) : (
                      invoice.patientName
                    )}
                  </p>
                  {invoice.patientAge && (
                    <p>
                      <span className="font-medium">Age:</span>{" "}
                      {invoice.patientAge}
                    </p>
                  )}
                  {invoice.patientGender && (
                    <p>
                      <span className="font-medium">Gender:</span>{" "}
                      <span className="capitalize">{invoice.patientGender}</span>
                    </p>
                  )}
                  {invoice.patientPhone && (
                    <p>
                      <span className="font-medium">Phone:</span>{" "}
                      {invoice.patientPhone}
                    </p>
                  )}
                  {invoice.patientAddress && (
                    <p>
                      <span className="font-medium">Address:</span>{" "}
                      {invoice.patientAddress}
                    </p>
                  )}
                  {invoice.patientPanVat && (
                    <p>
                      <span className="font-medium">PAN/VAT:</span>{" "}
                      {invoice.patientPanVat}
                    </p>
                  )}
                </div>
              </div>

              {invoice.referringDoctors && invoice.referringDoctors.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5">
                    Referring Doctor
                  </h4>
                  <div className="space-y-2">
                    {invoice.referringDoctors.map((doc, idx) => (
                      <div
                        key={idx}
                        className="space-y-0.5 text-[rgb(var(--color-text))] border-l-2 border-primary/30 pl-2"
                      >
                        <p>
                          <span className="font-medium">Name:</span>{" "}
                          {doc.doctorName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                    <span className="font-medium">Status:</span> {invoice.status}
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
                  !paymentForm.amount ||
                  parseFloat(paymentForm.amount) <= 0 ||
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
            <FlatInput
              required
              hint={`Maximum: ${formatCurrency(invoice.balanceAmount)}`}
              label="Payment Amount"
              placeholder="Enter payment amount"
              prefixText="NPR"
              type="number"
              value={paymentForm.amount}
              onChange={(v) => setPaymentForm((p) => ({ ...p, amount: v }))}
            />
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-mountain-700">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                className="h-8 w-full px-2.5 text-[12.5px] border border-mountain-200 rounded bg-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-100 text-mountain-800"
                value={paymentForm.method}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, method: e.target.value }))
                }
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_banking">Mobile Banking</option>
              </select>
            </div>
            <FlatInput
              hint="Transaction ID / Reference"
              label="Reference"
              placeholder="Optional"
              value={paymentForm.reference}
              onChange={(v) => setPaymentForm((p) => ({ ...p, reference: v }))}
            />
            <FlatInput
              label="Notes"
              placeholder="Optional notes"
              value={paymentForm.notes}
              onChange={(v) => setPaymentForm((p) => ({ ...p, notes: v }))}
            />
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
        title={reasonModal === "cancel" ? "Cancel Invoice" : "Issue Credit Note"}
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
