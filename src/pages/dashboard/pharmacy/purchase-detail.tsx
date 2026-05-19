import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { addDays, differenceInCalendarDays } from "date-fns";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoArrowBackOutline,
  IoPrintOutline,
  IoReceiptOutline,
  IoCreateOutline,
  IoAddOutline,
  IoCashOutline,
  IoSearchOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { pharmacyService } from "@/services/pharmacyService";
import { clinicService } from "@/services/clinicService";
import { medicineService } from "@/services/medicineService";
import { MedicinePurchase } from "@/types/models";
import { PrintLayoutConfig } from "@/types/printLayout";
import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";
import { useAuthContext } from "@/context/AuthContext";

// Custom Clinic Clarity UI
import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui";
import { title } from "@/components/primitives";

interface DisplayItem {
  id: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  salePrice: number;
  amount: number;
  expiryDate?: string;
  originalItem: any;
}

const getDisplayItems = (items: any[]): DisplayItem[] => {
  const displayItems: DisplayItem[] = [];
  items.forEach((item) => {
    const batchStr = item.batchNumber || "";
    if (batchStr.includes("@ NPR") || (batchStr.includes("(") && batchStr.includes("x"))) {
      const batches = batchStr.split(", ");
      let parsedSuccessfully = true;
      const parsedBatches: { batchNumber: string; qty: number; price: number; expiryDate?: string }[] = [];
      
      batches.forEach((bStr: string) => {
        const match = bStr.match(/^([^\(]+)\s*\(x(\d+)\s*@\s*NPR\s*([\d\.]+)\)$/i);
        if (match) {
          const rawBatch = match[1].trim();
          let batchNumber = rawBatch;
          let expiryDate = item.expiryDate;
          if (rawBatch.includes("|Exp:")) {
            const parts = rawBatch.split("|Exp:");
            batchNumber = parts[0].trim();
            expiryDate = parts[1].trim();
          }
          parsedBatches.push({
            batchNumber,
            qty: parseInt(match[2]) || 0,
            price: parseFloat(match[3]) || 0,
            expiryDate,
          });
        } else {
          const simpleMatch = bStr.match(/^([^\(]+)\s*\(x(\d+)\)$/i);
          if (simpleMatch) {
            const rawBatch = simpleMatch[1].trim();
            let batchNumber = rawBatch;
            let expiryDate = item.expiryDate;
            if (rawBatch.includes("|Exp:")) {
              const parts = rawBatch.split("|Exp:");
              batchNumber = parts[0].trim();
              expiryDate = parts[1].trim();
            }
            parsedBatches.push({
              batchNumber,
              qty: parseInt(simpleMatch[2]) || 0,
              price: item.salePrice,
              expiryDate,
            });
          } else {
            parsedSuccessfully = false;
          }
        }
      });
      
      if (parsedSuccessfully && parsedBatches.length > 0) {
        parsedBatches.forEach((batch, idx) => {
          displayItems.push({
            id: `${item.id}_batch_${idx}`,
            medicineName: item.medicineName,
            batchNumber: batch.batchNumber,
            quantity: batch.qty,
            salePrice: batch.price,
            amount: batch.qty * batch.price,
            expiryDate: batch.expiryDate,
            originalItem: item,
          });
        });
        return;
      }
    }
    
    let fallbackBatchNumber = batchStr;
    let fallbackExpiryDate = item.expiryDate;
    if (batchStr.includes("|Exp:")) {
      const parts = batchStr.split("|Exp:");
      fallbackBatchNumber = parts[0].trim();
      fallbackExpiryDate = parts[1].trim();
    }

    displayItems.push({
      id: item.id,
      medicineName: item.medicineName,
      batchNumber: fallbackBatchNumber || "DEFAULT",
      quantity: item.quantity,
      salePrice: item.salePrice,
      amount: item.amount,
      expiryDate: fallbackExpiryDate,
      originalItem: item,
    });
  });
  return displayItems;
};

// --- Components ---
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
  size?: "md" | "lg" | "xl" | "2xl" | "5xl";
  disabled?: boolean;
}) {
  const widthMap = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
    "2xl": "max-w-xl",
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
        className={`bg-white border border-mountain-200 rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-mountain-100 shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-mountain-900">
              {title}
            </h3>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          {!disabled && (
            <button
              className="text-mountain-400 hover:text-mountain-700 mt-0.5"
              type="button"
              onClick={onClose}
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-mountain-100 shrink-0">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
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
  items: {
    id: string;
    primary: string;
    secondary?: string;
    icon?: React.ReactNode;
  }[];
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
    <div className="flex flex-col gap-1 relative w-full">
      <label className="text-[12px] font-medium text-mountain-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className={`flex items-center h-8 border border-mountain-200 rounded focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100 bg-white ${disabled ? "bg-mountain-50" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-2.5 w-3.5 h-3.5 text-mountain-400 shrink-0" />
        <input
          className="flex-1 text-[13px] px-2 bg-transparent focus:outline-none text-mountain-800 placeholder:text-mountain-300 w-full h-full"
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
            className="mr-2 text-mountain-400 hover:text-mountain-700"
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
      {hint && <p className="text-[10.5px] text-mountain-400">{hint}</p>}
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-mountain-200 rounded max-h-48 overflow-y-auto shadow-sm">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-mountain-400">
                No results
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`w-full text-left px-3 py-2 hover:bg-teal-50 flex items-center gap-2 ${i.id === value ? "bg-teal-50" : ""}`}
                  type="button"
                  onClick={() => {
                    onChange(i.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  {i.icon && <span className="text-base">{i.icon}</span>}
                  <div>
                    <p className="text-[12.5px] text-mountain-800">
                      {i.primary}
                    </p>
                    {i.secondary && (
                      <p className="text-[11px] text-mountain-400">
                        {i.secondary}
                      </p>
                    )}
                  </div>
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
  max,
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
  min?: string | number;
  step?: string;
  max?: string | number;
}) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[12px] font-medium text-mountain-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className={`flex items-center h-8 border border-mountain-200 rounded bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100 ${disabled ? "bg-mountain-50" : ""}`}
      >
        {prefixText && (
          <span className="pl-2.5 text-[12px] text-mountain-400 shrink-0">
            {prefixText}
          </span>
        )}
        <input
          className="flex-1 w-full px-2.5 text-[13px] bg-transparent focus:outline-none text-mountain-800 placeholder:text-mountain-300 disabled:text-mountain-400 h-full"
          disabled={disabled}
          max={max}
          min={min}
          placeholder={placeholder}
          step={step}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {suffixText && (
          <span className="pr-2.5 text-[12px] text-mountain-400 shrink-0">
            {suffixText}
          </span>
        )}
      </div>
      {hint && <p className="text-[10.5px] text-mountain-400">{hint}</p>}
    </div>
  );
}

function StatusBadge({
  status,
  type = "status",
}: {
  status: string;
  type?: "status" | "payment";
}) {
  const S_COLORS: Record<string, string> = {
    paid: "bg-purple-100 text-purple-700 border-purple-200",
    finalized: "bg-teal-100 text-teal-700 border-teal-200",
    partial: "bg-saffron-100 text-saffron-700 border-saffron-200",
    unpaid: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    default: "bg-mountain-100 text-mountain-600 border-mountain-200",
  };
  const color = S_COLORS[status] || S_COLORS.default;

  return (
    <span
      className={`text-[10.5px] font-semibold px-2 py-0.5 rounded border capitalize ${color}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

interface PaymentMethod {
  id: string;
  key: string;
  name: string;
  description?: string;
  icon?: string;
  requiresReference: boolean;
  isEnabled: boolean;
  isCustom: boolean;
}

interface PharmacySettings {
  id: string;
  clinicId: string;
  branchId: string;
  enableTax: boolean;
  defaultTaxPercentage: number;
  taxLabel?: string;
  enableDiscount: boolean;
  defaultDiscountPercentage?: number;
  defaultPaymentMethod: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  enabledPaymentMethods: PaymentMethod[];
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  paymentDate: Date;
  /** Payment method key stored in the purchase (e.g. "cash", "card", "esewa"). */
  paymentMethod: string;
  reference?: string;
  notes?: string;
  recordedBy: string;
}

const getMedicationCourseInfo = (purchase?: MedicinePurchase | null) => {
  if (!purchase?.medicationDurationDays || !purchase.purchaseDate) {
    return null;
  }

  const startDate =
    purchase.purchaseDate instanceof Date
      ? purchase.purchaseDate
      : new Date(purchase.purchaseDate);

  const endDate = addDays(startDate, purchase.medicationDurationDays);
  const daysRemaining = differenceInCalendarDays(endDate, new Date());

  return {
    startDate,
    endDate,
    daysRemaining,
    isEndingSoon: daysRemaining < 7 && daysRemaining >= 0,
    isExpired: daysRemaining < 0,
  };
};

export default function PurchaseDetailPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, clinicId, userData } = useAuthContext();
  const branchId = userData?.branchId ?? null;

  const [purchase, setPurchase] = useState<MedicinePurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );
  const [clinic, setClinic] = useState<any>(null);
  const [pharmacySettings, setPharmacySettings] =
    useState<PharmacySettings | null>(null);
  /** LIFO unit price per purchase line (item id -> price). Populated after purchase load. */
  const [itemLifoPrices, setItemLifoPrices] = useState<Record<string, number>>(
    {},
  );

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentMethod: "cash" as string,
    reference: "",
    notes: "",
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const handleOpenPaymentModal = () => {
    setPaymentForm((prev) => ({
      ...prev,
      amount: dueAmount,
      reference: "",
      notes: "",
    }));
    setIsPaymentModalOpen(true);
  };

  const [receiptFormat, setReceiptFormat] = useState<string>("Thermal");
  const medicationCourseInfo = getMedicationCourseInfo(purchase);

  // Get available payment methods from pharmacy settings
  const getAvailablePaymentMethods = () => {
    if (!pharmacySettings?.enabledPaymentMethods) {
      return [];
    }

    return pharmacySettings.enabledPaymentMethods.filter(
      (method) => method.isEnabled,
    );
  };

  // Check if selected payment method requires reference
  const selectedPaymentMethodRequiresReference = () => {
    const selectedMethod = getAvailablePaymentMethods().find(
      (method) => method.key === paymentForm.paymentMethod,
    );

    return selectedMethod?.requiresReference || false;
  };

  useEffect(() => {
    const loadPurchaseDetails = async () => {
      if (!purchaseId) return;

      try {
        setLoading(true);

        const purchaseData =
          await pharmacyService.getMedicinePurchaseById(purchaseId);

        if (!purchaseData) {
          addToast({
            title: "Error",
            description: "Purchase record not found",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }
        if (clinicId && purchaseData.clinicId !== clinicId) {
          addToast({
            title: "Access denied",
            description: "This purchase does not belong to your clinic.",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }
        if (branchId && purchaseData.branchId !== branchId) {
          addToast({
            title: "Access denied",
            description: "You can only view purchases for your branch.",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }

        let clinicData = null;
        let layoutConfigData = null;

        if (clinicId) {
          [clinicData, layoutConfigData] = await Promise.all([
            clinicService.getClinicById(clinicId),
            clinicService.getPrintLayoutConfig(clinicId),
          ]);
        }

        if (clinicId) {
          const settingsData = await pharmacyService.getPharmacySettings(
            clinicId,
            purchaseData.branchId,
          );

          let finalSettings = settingsData;
          if (!finalSettings) {
            finalSettings = pharmacyService.getDefaultPharmacySettings();
          }

          if (finalSettings) {
            setPharmacySettings(finalSettings as PharmacySettings);
            const enabledMethods =
              finalSettings.enabledPaymentMethods?.filter(
                (pm) => pm.isEnabled,
              ) || [];

            if (enabledMethods.length > 0) {
              setPaymentForm((prev) => ({
                ...prev,
                paymentMethod:
                  finalSettings.defaultPaymentMethod || enabledMethods[0].key,
              }));
            }
          }
        }

        setPurchase(purchaseData);

        if (purchaseData.paymentStatus === "paid") {
          setPayments([
            {
              id: "1",
              amount: purchaseData.netAmount,
              paymentDate: purchaseData.purchaseDate,
              paymentMethod: purchaseData.paymentType,
              notes: "Full payment on purchase",
              recordedBy: purchaseData.createdBy,
            },
          ]);
        } else if (purchaseData.paymentStatus === "partial") {
          setPayments([
            {
              id: "1",
              amount: purchaseData.netAmount * 0.6,
              paymentDate: purchaseData.purchaseDate,
              paymentMethod: purchaseData.paymentType,
              notes: "Partial payment",
              recordedBy: purchaseData.createdBy,
            },
          ]);
        }

        // Set clinic and layout data
        if (clinicData) {
          setClinic(clinicData);
        }

        if (layoutConfigData) {
          setLayoutConfig(layoutConfigData);
          if (layoutConfigData.defaultPrintFormat) {
            setReceiptFormat(layoutConfigData.defaultPrintFormat);
          }
        }
      } catch (error) {
        console.error("Error loading purchase details:", error);
        addToast({
          title: "Error",
          description: "Failed to load purchase details",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPurchaseDetails();
  }, [purchaseId, clinicId, userData?.branchId, navigate]);

  // Trigger automatic print if the URL contains `?print=true` once ALL data is loaded
  const [lifoPricesReady, setLifoPricesReady] = useState(false);

  useEffect(() => {
    if (!loading && purchase) setLifoPricesReady(true);
  }, [loading, purchase, itemLifoPrices]);

  useEffect(() => {
    if (
      !loading &&
      purchase &&
      lifoPricesReady &&
      searchParams.get("print") === "true"
    ) {
      const timer = setTimeout(() => window.print(), 400);

      return () => clearTimeout(timer);
    }
  }, [loading, purchase, lifoPricesReady, searchParams]);

  // Compute LIFO price per medicine line from stock transactions (latest purchase at or before purchase date)
  useEffect(() => {
    if (!purchase?.items?.length) {
      setItemLifoPrices({});

      return;
    }
    const purchaseDate =
      purchase.purchaseDate instanceof Date
        ? purchase.purchaseDate
        : new Date(purchase.purchaseDate);
    const medicineItems = purchase.items.filter(
      (item): item is typeof item & { medicineId: string } =>
        !!(item as { medicineId?: string }).medicineId,
    );
    const uniqueMedicineIds = [
      ...new Set(medicineItems.map((i) => i.medicineId)),
    ];

    const loadLifoPrices = async () => {
      try {
        const transactionsByMedicine = await Promise.all(
          uniqueMedicineIds.map(async (medId) => {
            const transactions = await medicineService.getStockTransactions(
              medId,
              50,
            );

            return { medId, transactions };
          }),
        );
        const txMap: Record<
          string,
          {
            medId: string;
            transactions: Awaited<
              ReturnType<typeof medicineService.getStockTransactions>
            >;
          }
        > = {};

        transactionsByMedicine.forEach(({ medId, transactions }) => {
          txMap[medId] = { medId, transactions };
        });

        const lifoMap: Record<string, number> = {};

        for (const item of purchase.items) {
          const medId = (item as { medicineId?: string }).medicineId;

          if (!medId) continue;
          const { transactions } = txMap[medId] ?? {};

          if (!transactions?.length) continue;

          const stockType = (item as { stockType?: string }).stockType;
          const wantScheme = stockType === "scheme";
          const purchaseTx = transactions
            .filter(
              (t) =>
                t.type === "purchase" &&
                (t.createdAt
                  ? new Date(t.createdAt).getTime() <= purchaseDate.getTime()
                  : true),
            )
            .filter((t) =>
              wantScheme ? t.isSchemeStock === true : t.isSchemeStock !== true,
            )
            .sort((a, b) => {
              const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;

              return bT - aT;
            });
          const latest = purchaseTx[0];

          if (!latest) continue;
          const price =
            wantScheme && latest.isSchemeStock
              ? (latest.schemePrice ?? latest.salePrice ?? 0)
              : (latest.salePrice ?? 0);

          lifoMap[item.id] = price;
        }
        setItemLifoPrices(lifoMap);
      } catch (err) {
        console.warn("Could not load LIFO prices for purchase items:", err);
        setItemLifoPrices({});
      }
    };

    loadLifoPrices();
  }, [purchase?.id, purchase?.purchaseDate, purchase?.items]);

  // Calculate payment amounts
  const totalAmount = Math.round(purchase?.netAmount || 0);
  const totalReturnedAmount = Math.round(
    purchase?.totalReturnedAmount && purchase.totalReturnedAmount > 0
      ? purchase.totalReturnedAmount
      : (purchase?.returns ?? []).reduce(
        (sum, r) => sum + Math.abs(r.totalAmount || 0),
        0,
      )
  );
  const netAfterReturns = Math.max(0, totalAmount - totalReturnedAmount);
  const paidAmount = Math.round(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const dueAmount = Math.max(0, netAfterReturns - paidAmount);
  const paymentProgress =
    totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  const isPaidInFull = paymentProgress >= 100;
  const isPartiallyPaid = paymentProgress > 0;
  const hasDue = dueAmount > 0;

  // Determine payment status
  const getPaymentStatus = () => {
    if (paidAmount === 0) return "unpaid";
    if (isPaidInFull) return "paid";

    return "partial";
  };

  const handleAddPayment = async () => {
    if (!purchase || !currentUser) return;

    // Check if any payment methods are available
    if (getAvailablePaymentMethods().length === 0) {
      addToast({
        title: "Configuration Error",
        description:
          "No payment methods are configured. Please contact your administrator.",
        color: "warning",
      });

      return;
    }

    // Validate payment amount
    if (paymentForm.amount <= 0) {
      addToast({
        title: "Validation Error",
        description: "Payment amount must be greater than 0",
        color: "warning",
      });

      return;
    }

    if (paymentForm.amount > dueAmount) {
      addToast({
        title: "Validation Error",
        description: `Payment amount cannot exceed due amount (NPR ${dueAmount.toLocaleString()})`,
        color: "warning",
      });

      return;
    }

    // Check if the selected payment method requires a reference and if so, ensure it's provided
    if (selectedPaymentMethodRequiresReference() && !paymentForm.reference) {
      addToast({
        title: "Validation Error",
        description: "Reference number is required for this payment method",
        color: "warning",
      });

      return;
    }

    try {
      setIsSubmitting(true);

      // Create new payment record
      const newPayment: PaymentRecord = {
        id: crypto.randomUUID(),
        amount: paymentForm.amount,
        paymentDate: new Date(),
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
        recordedBy: currentUser.uid,
      };

      // Add to local state (in a real app, this would be saved to database)
      const updatedPayments = [...payments, newPayment];

      setPayments(updatedPayments);

      // Calculate new totals
      const newPaidAmount = updatedPayments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      const newStatus =
        newPaidAmount >= totalAmount
          ? "paid"
          : newPaidAmount > 0
            ? "partial"
            : "pending";

      // Update purchase record with new payment status
      await pharmacyService.updateMedicinePurchase(purchase.id, {
        paymentStatus: newStatus,
      });

      // Update local purchase state
      setPurchase((prev) =>
        prev ? { ...prev, paymentStatus: newStatus } : null,
      );

      addToast({
        title: "Success",
        description: "Payment recorded successfully",
        color: "success",
      });

      // Reset form and close modal
      setPaymentForm({
        amount: 0,
        paymentMethod: "cash",
        reference: "",
        notes: "",
      });
      setIsPaymentModalOpen(false);
    } catch (error) {
      console.error("Error recording payment:", error);
      addToast({
        title: "Error",
        description: "Failed to record payment",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = (format: string = "A4") => {
    if (!purchase) return;

    const isThermal = format.startsWith("THERMAL") || format === "Thermal" || format === "THERMAL_4INCH";

    // Use config-defined width if available and format is thermal
    let thermalWidth = "80mm";
    if (format === "THERMAL_80MM" || format === "Thermal") thermalWidth = "80mm";
    else if (format === "THERMAL_58MM") thermalWidth = "58mm";
    else if (format === "THERMAL_4INCH") thermalWidth = "104mm";
    else if (isThermal && layoutConfig?.thermalPaperWidthMm) {
      thermalWidth = `${layoutConfig.thermalPaperWidthMm}mm`;
    }

    // Create a new window for printing
    const printWindow = window.open("", "_blank", "width=800,height=600");

    if (printWindow) {
      // Build the table rows for Items
      const displayItems = getDisplayItems(purchase.items);
      const itemsHtml = displayItems.map((item, index) => {
        const price = item.salePrice;
        const formattedPrice = price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        return `<tr>
          <td style="text-align: center;">${index + 1}</td>
          <td>
            <div style="font-weight: bold;">${item.medicineName}</div>
            ${item.batchNumber || item.expiryDate ? `
              <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
                ${item.expiryDate ? `<strong>Exp:</strong> ${item.expiryDate}` : ""}
                ${item.batchNumber ? `${item.expiryDate ? " | " : ""}<strong>Batch:</strong> ${item.batchNumber}` : ""}
              </div>` : ""}
          </td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">NPR ${formattedPrice}</td>
          <td style="text-align: right;">NPR ${item.amount.toLocaleString()}</td>
        </tr>`;
      }).join("");

      // Build the summary rows (right side)
      const summaryRowsHtml = `
        <tr>
          <td style="text-align: left; padding: 4px 0;">Subtotal</td>
          <td style="text-align: right; padding: 4px 0;">NPR ${Math.round(purchase.total).toLocaleString()}</td>
        </tr>
        ${purchase.discount > 0 ? `
        <tr>
          <td style="text-align: left; padding: 4px 0;">Discount</td>
          <td style="text-align: right; padding: 4px 0;">- NPR ${Math.round(purchase.discount).toLocaleString()}</td>
        </tr>` : ""}
        ${purchase.taxAmount > 0 ? `
        <tr>
          <td style="text-align: left; padding: 4px 0;">Tax (${purchase.taxPercentage}%)</td>
          <td style="text-align: right; padding: 4px 0;">NPR ${Math.round(purchase.taxAmount).toLocaleString()}</td>
        </tr>` : ""}
        <tr style="font-weight: bold; font-size: 14px;">
          <td style="text-align: left; padding: 8px 0; border-top: 1px solid #e2e8f0;">Total</td>
          <td style="text-align: right; padding: 8px 0; border-top: 1px solid #e2e8f0;">NPR ${Math.round(purchase.netAmount).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="text-align: left; padding: 4px 0;">Paid (${purchase.paymentType.toUpperCase()})</td>
          <td style="text-align: right; padding: 4px 0;">NPR ${Math.round(paidAmount).toLocaleString()}</td>
        </tr>
        <tr style="font-weight: bold; font-size: 14px;">
          <td style="text-align: left; padding: 4px 0;">Balance</td>
          <td style="text-align: right; padding: 4px 0;">NPR ${Math.round(dueAmount).toLocaleString()}</td>
        </tr>
      `;

      // Use Global Branding Utility
      const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig, isThermal) : "";
      const headerHTML = layoutConfig ? getPrintHeaderHTML(layoutConfig, clinic, isThermal) : "";
      const footerHTML = layoutConfig ? getPrintFooterHTML(layoutConfig) : "";

      // Generate the HTML content for printing with dynamic clinic data
      const printContent = `<!DOCTYPE html>
<html>
<head>
  <title>Purchase Receipt - ${purchase.purchaseNo}</title>
  <style>
    @page { 
      margin: 0; 
      size: ${isThermal ? `${thermalWidth} auto` : "A4"}; 
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      -webkit-print-color-adjust: exact;
      width: 100%;
    }
    body {
      font-family: Arial, sans-serif;
      color: #333;
      font-size: ${isThermal ? "11px" : "13px"};
    }
    .print-container {
      width: ${isThermal ? thermalWidth : "100%"};
      margin: 0 auto;
      background: white;
      display: flex;
      flex-direction: column;
      padding: ${isThermal ? "5mm" : "15mm"};
      box-sizing: border-box;
    }
    
    ${brandingCSS}

    .document-title {
      text-align: center;
      margin: 8px 0 2px 0;
      border-bottom: 2px solid #7c3aed;
      padding-bottom: 4px;
    }
    .document-title h2 {
      font-size: 16px;
      font-weight: 800;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #7c3aed;
    }
    
    .invoice-info-section {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      margin: 8px 0;
      gap: 12px;
    }

    .bill-to-block {
      flex: 1;
      background-color: #f8fafc;
      border-radius: 6px;
      padding: 8px 12px;
      border: 1px dashed #cbd5e1;
    }
    .bill-to-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .bill-to-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .bill-to-detail {
      font-size: 11px;
      color: #475569;
      margin-top: 1px;
    }

    .invoice-details-block {
      width: 240px;
      background-color: #f8fafc;
      border-radius: 6px;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
    .detail-label {
      color: #64748b;
      font-weight: 600;
    }
    .detail-val {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .items-table th {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    .items-table td {
      border: 1px solid #e2e8f0;
      padding: 12px 10px;
      font-size: 12px;
      color: #334155;
    }

    .summary-container {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
    .summary-table {
      width: 250px;
      border-collapse: collapse;
    }
    .summary-table td {
      font-size: 13px;
      color: #334155;
    }
    
    .footer-note {
      text-align: center;
      margin-top: 40px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #94a3b8;
      font-weight: 600;
    }
    
    ${brandingCSS}

    .document-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        margin-top: 5px;
        font-size: 11px;
    }
  </style>
</head>
<body>
    <div class="print-container">
      ${headerHTML}
    
    <div class="document-title">
      <h2>Invoice</h2>
    </div>

    <div class="invoice-info-section">
      <div class="bill-to-block">
        <div class="bill-to-title">Bill To</div>
        <div class="bill-to-name">${purchase.patientName || "Cash Customer"}</div>
        ${purchase.patientPhone ? `<div class="bill-to-detail">Phone: ${purchase.patientPhone}</div>` : ""}
        ${purchase.patientAddress ? `<div class="bill-to-detail">Address: ${purchase.patientAddress}</div>` : ""}
      </div>
      
      <div class="invoice-details-block">
        <div class="detail-row">
          <span class="detail-label">Invoice No:</span>
          <span class="detail-val">#${purchase.purchaseNo}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-val">${purchase.purchaseDate.toLocaleDateString()}</span>
        </div>
        ${clinic?.panNumber ? `
        <div class="detail-row">
          <span class="detail-label">Clinic PAN:</span>
          <span class="detail-val">${clinic.panNumber}</span>
        </div>
        ` : ""}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50px;">S.N.</th>
          <th style="text-align: left;">Medicine</th>
          <th style="width: 60px;">Qty</th>
          <th style="width: 100px; text-align: right;">Price</th>
          <th style="width: 110px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="summary-container">
      <table class="summary-table">
        <tbody>
          ${summaryRowsHtml}
        </tbody>
      </table>
    </div>

    <div style="margin-top: 30px; text-align: center;">
      ${!layoutConfig?.showFooter ? '<div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; font-weight: 600;">Thank you for choosing us.</div>' : ""}
      <div style="font-size: 9.5px; margin-top: 10px; color: #64748b; text-align: right; font-weight: 500;">
        Print Date: ${new Date().toLocaleString()}
      </div>
    </div>

    ${footerHTML}
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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="flat"
            onClick={() => navigate("/dashboard/pharmacy")}
          >
            <IoArrowBackOutline />
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Purchase Details
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              Loading purchase information...
            </p>
          </div>
        </div>
        <div className="clarity-card bg-white flex items-center justify-center py-12 border border-mountain-200 text-mountain-500 rounded text-[13px]">
          Loading purchase details...
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="flat"
            onClick={() => navigate("/dashboard/pharmacy")}
          >
            <IoArrowBackOutline />
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Purchase Not Found
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              The requested purchase record could not be found
            </p>
          </div>
        </div>
      </div>
    );
  }

  const courseStatusClass = medicationCourseInfo
    ? medicationCourseInfo.isExpired
      ? "text-danger"
      : medicationCourseInfo.isEndingSoon
        ? "text-warning-500"
        : "text-success"
    : "";

  const courseStatusLabel = medicationCourseInfo
    ? medicationCourseInfo.isExpired
      ? medicationCourseInfo.daysRemaining === 0
        ? "Course ended today"
        : `Course ended ${Math.abs(medicationCourseInfo.daysRemaining)} day${Math.abs(medicationCourseInfo.daysRemaining) === 1 ? "" : "s"} ago`
      : medicationCourseInfo.daysRemaining === 0
        ? "Ends today"
        : `${medicationCourseInfo.daysRemaining} day${medicationCourseInfo.daysRemaining === 1 ? "" : "s"} remaining`
    : "";

  const currentPaymentStatus = getPaymentStatus();

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          ${receiptFormat === "A4" && layoutConfig ? getPrintBrandingCSS(layoutConfig) : ""}
          
          .print-only {
            display: none !important;
          }
          @media print {
            @page {
              size: ${receiptFormat === "Thermal" ? "80mm auto" : "A4 portrait"};
              margin: ${receiptFormat === "Thermal" ? "0" : "15mm"};
            }
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
              position: ${receiptFormat === "Thermal" ? "fixed" : "absolute"};
              top: 0;
              left: 0;
              right: 0;
              width: 100% !important;
              margin: 0 !important;
              padding: ${receiptFormat === "Thermal" ? "2mm" : "0"} !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: white !important;
              z-index: 99999;
            }
            body, html {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            .print-only * {
              color: #000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `,
        }}
      />
      <div className="flex flex-col gap-6 no-print">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="bordered"
              onClick={() => navigate("/dashboard/pharmacy")}
            >
              <IoArrowBackOutline />
            </Button>
            <div>
              <h1 className={`${title({ size: "lg" })} text-primary`}>
                Purchase Details
              </h1>
              <p className="text-[13.5px] text-text-muted mt-1">
                {purchase.purchaseNo} •{" "}
                {purchase.purchaseDate.toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <div className="w-32">
              <Select
                size="sm"
                selectedKeys={[receiptFormat]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  if (val) setReceiptFormat(val);
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
              startContent={<IoPrintOutline />}
              variant="bordered"
              onClick={() => handlePrint(receiptFormat)}
            >
              Print Receipt
            </Button>
            {netAfterReturns > 0 && (
              <Button
                color="primary"
                startContent={<IoCreateOutline />}
                variant="flat"
                onClick={() =>
                  navigate(`/dashboard/pharmacy/purchase/${purchase.id}/return`)
                }
              >
                Return Items
              </Button>
            )}
            {dueAmount > 0 && (
              <Button
                color="primary"
                startContent={<IoAddOutline />}
                onClick={handleOpenPaymentModal}
              >
                Add Payment
              </Button>
            )}
          </div>
        </div>

        {/* Payment Status Bar */}
        <div className="clarity-card bg-white border border-mountain-200 rounded p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Total Amount */}
            <div className="text-center lg:text-left">
              <p className="text-[12.5px] text-mountain-500 mb-1">
                Total Amount
              </p>
              <p className="text-stat-sm font-bold text-mountain-900">
                NPR {totalAmount.toLocaleString()}
              </p>
              {totalReturnedAmount > 0 && (
                <p className="text-[11px] text-saffron-600 mt-1">
                  Returned: NPR {totalReturnedAmount.toLocaleString()}
                </p>
              )}
            </div>

            {/* Paid Amount */}
            <div className="text-center lg:text-left">
              <p className="text-[12.5px] text-mountain-500 mb-1">
                Paid Amount
              </p>
              <p className="text-stat-sm font-bold text-purple-600">
                NPR {paidAmount.toLocaleString()}
              </p>
            </div>

            {/* Due Amount */}
            <div className="text-center lg:text-left">
              <p className="text-[12.5px] text-mountain-500 mb-1">Due Amount</p>
              <p
                className={`text-stat-sm font-bold ${dueAmount > 0 ? "text-red-500" : "text-purple-600"}`}
              >
                NPR {dueAmount.toLocaleString()}
              </p>
              {totalReturnedAmount > 0 && (
                <p className="text-[11px] text-purple-600 mt-1">
                  Net after returns: NPR {netAfterReturns.toLocaleString()}
                </p>
              )}
            </div>

            {/* Payment Status */}
            <div className="text-center lg:text-left flex flex-col items-center lg:items-start justify-center">
              <p className="text-[12.5px] text-mountain-500 mb-1">
                Payment Status
              </p>
              <StatusBadge status={currentPaymentStatus} />
            </div>
          </div>

          {/* Payment Progress */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12.5px] text-mountain-500">
                Payment Progress
              </span>
              <span className="text-[12.5px] font-medium text-mountain-900">
                {paymentProgress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-mountain-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${isPaidInFull ? "bg-purple-500" : isPartiallyPaid ? "bg-saffron-500" : "bg-red-500"}`}
                style={{ width: `${paymentProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Purchase Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Purchase Items */}
          {/* Purchase Items */}
          <div className="clarity-card bg-white border border-mountain-200 rounded overflow-hidden lg:col-span-2">
            <div className="px-4 py-3 bg-mountain-50 border-b border-mountain-100 flex items-center gap-2">
              <IoReceiptOutline className="w-4 h-4 text-teal-700" />
              <h3 className="text-[13.5px] font-semibold text-mountain-900">
                Purchase Items
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="clarity-table w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-mountain-50 border-b border-mountain-200">
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                      Medicine
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                      Qty Sold
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                      Qty Returned
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                      Qty Net
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider text-right">
                      Unit Price
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider text-right">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mountain-100 bg-white">
                  {getDisplayItems(purchase.items).map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-mountain-25 transition-colors"
                    >
                      <td className="px-3 py-2">
                        <div>
                          <p className="text-[12.5px] font-medium text-mountain-800">
                            {item.medicineName}
                          </p>
                          <p className="text-[11.5px] text-mountain-500 font-medium">
                            Exp: {item.expiryDate} {item.batchNumber && `| Batch: ${item.batchNumber}`}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[12.5px] text-mountain-800">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2 text-[12.5px] text-mountain-800">
                        {(() => {
                          const totalReturnedForItem = (
                            purchase.returns ?? []
                          ).reduce(
                            (sum, r) =>
                              sum +
                              r.items.reduce((inner, it) => {
                                if (it.purchaseItemId === item.originalItem.id) {
                                  return inner + it.quantity;
                                }

                                return inner;
                              }, 0),
                            0,
                          );

                          return totalReturnedForItem;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-[12.5px] text-mountain-800">
                        {(() => {
                          const totalReturnedForItem = (
                            purchase.returns ?? []
                          ).reduce(
                            (sum, r) =>
                              sum +
                              r.items.reduce((inner, it) => {
                                if (it.purchaseItemId === item.originalItem.id) {
                                  return inner + it.quantity;
                                }

                                return inner;
                              }, 0),
                            0,
                          );

                          return Math.max(
                            0,
                            item.quantity - totalReturnedForItem,
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-[12.5px] text-mountain-800 text-right">
                        NPR{" "}
                        {item.salePrice.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-[12.5px] text-mountain-800 text-right">
                        NPR {item.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Purchase Summary */}
              <div className="p-4 border-t border-mountain-200 bg-mountain-50 text-[13px] text-mountain-700 space-y-2">
                {purchase.patientName && (
                  <div className="flex justify-between pb-2 border-b border-mountain-200">
                    <span className="font-medium text-mountain-900">
                      Patient Name:
                    </span>
                    <span className="text-mountain-800">
                      {purchase.patientName}
                    </span>
                  </div>
                )}
                {medicationCourseInfo && (
                  <div className="flex justify-between pb-2 border-b border-mountain-200">
                    <div className="flex flex-col text-right w-full">
                      <span className="font-medium text-mountain-900">
                        Medication Duration:
                      </span>
                      <span className={courseStatusClass}>
                        {courseStatusLabel}
                      </span>
                      <span className="text-[11px] text-mountain-500">
                        Ends on{" "}
                        {medicationCourseInfo.endDate.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="text-mountain-900">
                    NPR {Math.round(purchase.total).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between flex-row">
                  <span>Discount:</span>
                  <span className="text-red-500">
                    - NPR {Math.round(purchase.discount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({purchase.taxPercentage}%):</span>
                  <span className="text-mountain-900">
                    NPR {Math.round(purchase.taxAmount).toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-mountain-200 my-2" />
                <div className="flex justify-between font-bold text-mountain-900 text-[14px]">
                  <span>Net Total:</span>
                  <span>NPR {Math.round(purchase.netAmount).toLocaleString()}</span>
                </div>
                {totalReturnedAmount > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-saffron-600">Total Returned:</span>
                    <span className="text-saffron-600">
                      NPR {totalReturnedAmount.toLocaleString()}
                    </span>
                  </div>
                )}
                {totalReturnedAmount > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-purple-600">Net After Returns:</span>
                    <span className="text-purple-600">
                      NPR {netAfterReturns.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment History */}
          {/* Payment History */}
          <div className="clarity-card bg-white border border-mountain-200 rounded overflow-hidden lg:col-span-1">
            <div className="px-4 py-3 bg-mountain-50 border-b border-mountain-100 flex items-center gap-2">
              <IoCashOutline className="w-4 h-4 text-teal-700" />
              <h3 className="text-[13.5px] font-semibold text-mountain-900">
                Payment History
              </h3>
            </div>
            <div>
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-mountain-300 mb-4">
                    <IoCashOutline className="w-12 h-12 mx-auto opacity-50" />
                  </div>
                  <p className="text-[12.5px] text-mountain-500">
                    No payments recorded yet
                  </p>
                  {dueAmount > 0 && (
                    <Button
                      className="mt-4"
                      color="primary"
                      variant="flat"
                      onClick={handleOpenPaymentModal}
                    >
                      Record First Payment
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="clarity-table w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-mountain-50 border-b border-mountain-200">
                        <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider text-right">
                          Amount
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                          Method
                        </th>
                        <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mountain-100 bg-white">
                      {payments.map((payment) => (
                        <tr
                          key={payment.id}
                          className="hover:bg-mountain-25 transition-colors"
                        >
                          <td className="px-3 py-2.5 text-[12.5px] text-mountain-800">
                            {payment.paymentDate.toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-purple-600 font-medium text-right">
                            NPR {payment.amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-mountain-800 capitalize">
                            {payment.paymentMethod.replace("_", " ")}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-mountain-800">
                            {payment.reference || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Return history */}
        {purchase.returns && purchase.returns.length > 0 && (
          <div className="clarity-card bg-white border border-mountain-200 rounded overflow-hidden">
            <div className="px-4 py-3 bg-mountain-50 border-b border-mountain-100 flex items-center gap-2">
              <IoReceiptOutline className="w-4 h-4 text-teal-700" />
              <h3 className="text-[13.5px] font-semibold text-mountain-900">
                Return History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="clarity-table w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-mountain-50 border-b border-mountain-200">
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider text-right">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-3 py-2 text-[11px] font-semibold text-mountain-500 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mountain-100 bg-white">
                  {purchase.returns.map((ret) => (
                    <tr
                      key={ret.id}
                      className="hover:bg-mountain-25 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-[12.5px] text-mountain-800">
                        {ret.createdAt instanceof Date
                          ? ret.createdAt.toLocaleDateString()
                          : new Date(ret.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-saffron-600 font-medium text-right">
                        NPR {Math.abs(ret.totalAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-mountain-800 capitalize">
                        {ret.refundMethod || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-mountain-800">
                        {ret.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .print-only { display: none !important; }
          @media print {
            .no-print { display: none !important; }
            .print-only { 
              display: block !important; 
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body { 
              margin: 0 !important; 
              padding: 0 !important;
              background: #fff !important;
            }
            @page {
              size: auto;
              margin: 0;
            }
            /* Ensure text is black and high contrast */
            * {
              color: #000 !important;
              -webkit-print-color-adjust: exact;
            }
            .receipt-container p, .receipt-container h1, .receipt-container h2, .receipt-container h3 {
              margin-block-start: 0;
              margin-block-end: 1px;
            }
            .receipt-container table {
              margin-bottom: 2px !important;
              line-height: 1;
            }
            .receipt-container th, .receipt-container td {
              padding: 1px 3px !important;
            }
          }
        `,
        }}
      />

      {/* ── Print-only receipt (rendered in DOM, visible only via window.print / ?print=true) ── */}
      <div
        className="print-only"
        style={{
          fontFamily: layoutConfig?.fontFamily || "'Inter', sans-serif",
          fontSize: layoutConfig?.contentFontSize || 11,
          color: layoutConfig?.textColor || "#000",
          lineHeight: 1.1,
        }}
      >
        <div
          className={`print-only receipt-container ${receiptFormat === "Thermal" ? "thermal-receipt" : "a4-receipt"}`}
          style={{
            width: "100%",
            maxWidth: receiptFormat === "Thermal" ? "80mm" : "100%",
            margin: "0 auto",
            padding: receiptFormat === "Thermal" ? "1mm" : "0",
            boxSizing: "border-box"
          }}
        >
          {/* Header Area: Using Assigned Branding for A4, Fallback for Thermal */}
          {receiptFormat === "A4" && layoutConfig ? (
            <div dangerouslySetInnerHTML={{ __html: getPrintHeaderHTML(layoutConfig, clinic) }} />
          ) : (
            <div
              style={{
                borderBottom: "1px solid #000",
                paddingBottom: 5,
                marginBottom: 5,
              }}
            >
              <h1 style={{ fontSize: 16, fontWeight: "bold", margin: 0 }}>
                {layoutConfig?.clinicName || clinic?.name || "Clinic Name"}
              </h1>
              {layoutConfig?.tagline && (
                <p style={{ fontSize: 11, margin: "2px 0" }}>
                  {layoutConfig.tagline}
                </p>
              )}
              <div style={{ fontSize: 10, marginTop: 3 }}>
                <p style={{ margin: "1px 0" }}>
                  {layoutConfig?.address || clinic?.address || ""}
                </p>
                <p style={{ margin: "1px 0" }}>
                  {layoutConfig?.city || clinic?.city || ""}
                  {layoutConfig?.state ? `, ${layoutConfig.state}` : ""}{" "}
                  {layoutConfig?.zipCode || ""}
                </p>
                {(layoutConfig?.phone || clinic?.phone) && (
                  <p style={{ margin: "1px 0" }}>
                    Phone: {layoutConfig?.phone || clinic?.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Title Area */}
          <div style={{ textAlign: "center", margin: "2px 0" }}>
            <h2
              style={{
                fontSize: 12,
                fontWeight: "bold",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Purchase Receipt
            </h2>
            <p style={{ fontSize: 9, margin: 0 }}>
              Medicine &amp; Items Purchase Record
            </p>
            <div style={{ fontSize: 9, marginTop: 2 }}>
              <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                <span>No: {purchase.purchaseNo}</span>
                <span>Date: {purchase.purchaseDate.toLocaleDateString()}</span>
                {purchase.patientName && (
                  <span style={{ fontWeight: "bold" }}>Patient: {purchase.patientName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Unified Receipt Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: 4,
              fontSize: 10,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f9f9f9" }}>
                <th style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center", width: "30px" }}>S.N.</th>
                <th style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "left" }}>Medicine</th>
                <th style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center", width: "40px" }}>Qty</th>
                <th style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right", width: "70px" }}>Price</th>
                <th style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right", width: "80px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {getDisplayItems(purchase.items).map((item, idx) => {
                const price = item.salePrice;
                const formattedPrice = price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                return (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "1px 3px" }}>
                      <strong>{item.medicineName}</strong>
                      {(item.batchNumber || item.expiryDate) && (
                        <div style={{ fontSize: "8.5px", color: "#666", marginTop: "1px" }}>
                          {item.expiryDate && <span>Exp: {item.expiryDate}</span>}
                          {item.batchNumber && <span>{item.expiryDate ? " | " : ""}Batch: {item.batchNumber}</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center" }}>{item.quantity}</td>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>NPR {formattedPrice}</td>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>NPR {item.amount.toLocaleString()}</td>
                  </tr>
                );
              })}

              {/* Summary Rows */}
              <tr>
                <td colSpan={4} style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>Subtotal</td>
                <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>NPR {Math.round(purchase.total).toLocaleString()}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>Discount</td>
                <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>- NPR {Math.round(purchase.discount).toLocaleString()}</td>
              </tr>
              {purchase.taxAmount > 0 && (
                <tr>
                  <td colSpan={4} style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>Tax ({purchase.taxPercentage}%)</td>
                  <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>NPR {Math.round(purchase.taxAmount).toLocaleString()}</td>
                </tr>
              )}
              <tr style={{ fontWeight: "bold", backgroundColor: "#f9f9f9" }}>
                <td colSpan={4} style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>Net Total</td>
                <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>NPR {Math.round(purchase.netAmount).toLocaleString()}</td>
              </tr>

              {/* Payment Section (Inline Header) */}
              {payments.length > 0 && (
                <>
                  <tr style={{ backgroundColor: "#eee", fontWeight: "bold" }}>
                    <td colSpan={5} style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center", fontSize: 9 }}>PAYMENT SUMMARY</td>
                  </tr>
                  <tr style={{ fontSize: 9, backgroundColor: "#f9f9f9" }}>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center" }} colSpan={2}>Date</td>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center" }}>Method</td>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center" }} colSpan={2}>Amount/Ref</td>
                  </tr>
                  {payments.map((p) => (
                    <tr key={p.id} style={{ fontSize: 9 }}>
                      <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center" }} colSpan={2}>{p.paymentDate.toLocaleDateString()}</td>
                      <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "center" }}>{p.paymentMethod.toUpperCase()}</td>
                      <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }} colSpan={2}>NPR {p.amount.toLocaleString()} {p.reference ? `(${p.reference})` : ""}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: "bold" }}>
                    <td colSpan={4} style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>Total Paid</td>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>NPR {paidAmount.toLocaleString()}</td>
                  </tr>
                  <tr style={{ fontWeight: "bold" }}>
                    <td colSpan={4} style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>Due Amount</td>
                    <td style={{ border: "1px solid #000", padding: "1px 3px", textAlign: "right" }}>NPR {dueAmount.toLocaleString()}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {/* Footer Area: Using Assigned Branding for A4, Fallback for Thermal */}
          {receiptFormat === "A4" && layoutConfig ? (
            <div dangerouslySetInnerHTML={{ __html: getPrintFooterHTML(layoutConfig) }} />
          ) : (
            <div
              style={{
                borderTop: "1px solid #000",
                paddingTop: 2,
                marginTop: 4,
                textAlign: "center",
                fontSize: 9,
              }}
            >
              <p style={{ margin: 0 }}>Thank you for choosing us</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      {isPaymentModalOpen && (
        <ModalShell
          disabled={isSubmitting}
          footer={
            <>
              <Button
                color="default"
                isDisabled={isSubmitting}
                variant="bordered"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                isDisabled={
                  isSubmitting ||
                  paymentForm.amount <= 0 ||
                  getAvailablePaymentMethods().length === 0 ||
                  (selectedPaymentMethodRequiresReference() &&
                    !paymentForm.reference.trim())
                }
                isLoading={isSubmitting}
                onClick={handleAddPayment}
              >
                {isSubmitting ? "Recording..." : "Record Payment"}
              </Button>
            </>
          }
          size="md"
          subtitle={
            <span className="text-[11.5px] text-mountain-500 font-normal">
              Due Amount: NPR {dueAmount.toLocaleString()}
            </span>
          }
          title="Record Payment"
          onClose={() => setIsPaymentModalOpen(false)}
        >
          <div className="space-y-4 text-left">
            <FlatInput
              required
              label="Payment Amount"
              max={dueAmount}
              placeholder="0"
              prefixText="NPR"
              type="number"
              value={paymentForm.amount.toString()}
              onChange={(v) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  amount: parseFloat(v) || 0,
                }))
              }
            />

            {getAvailablePaymentMethods().length > 0 ? (
              <SearchSelect
                required
                items={getAvailablePaymentMethods().map((m) => ({
                  id: m.key,
                  primary: m.name,
                  icon: m.icon ? <span>{m.icon}</span> : undefined,
                }))}
                label="Payment Method"
                placeholder="Search and select payment method"
                value={paymentForm.paymentMethod || ""}
                onChange={(id) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentMethod: id ? id : prev.paymentMethod,
                  }))
                }
              />
            ) : (
              <div className="p-3 bg-saffron-50 border border-saffron-200 rounded text-saffron-700 text-[12.5px]">
                No payment methods are configured. Please contact your
                administrator to set up payment methods in pharmacy settings.
              </div>
            )}

            <FlatInput
              hint={
                selectedPaymentMethodRequiresReference()
                  ? "Reference number is required for this payment method"
                  : "Optional reference number"
              }
              label="Reference Number"
              placeholder="Check number, transaction ID, etc."
              required={selectedPaymentMethodRequiresReference()}
              value={paymentForm.reference}
              onChange={(v) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  reference: v,
                }))
              }
            />

            <FlatInput
              label="Notes"
              placeholder="Additional notes about this payment"
              value={paymentForm.notes}
              onChange={(v) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  notes: v,
                }))
              }
            />
          </div>
        </ModalShell>
      )}
    </>

  );
}

