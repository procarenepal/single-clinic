import { useState, useEffect, useMemo } from "react";
import clsx from "clsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  differenceInCalendarDays,
  isToday,
  isSameDay,
  format,
  subDays,
} from "date-fns";
import {
  IoAddOutline,
  IoDownloadOutline,
  IoEyeOutline,
  IoCreateOutline,
  IoPrintOutline,
  IoSettingsOutline,
  IoSaveOutline,
  IoTrashOutline,
  IoStorefrontOutline,
  IoMedicalOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoSearchOutline,
  IoPeopleOutline,
  IoWalletOutline,
  IoTimeOutline,
  IoArrowBackOutline,
  IoReceiptOutline,
  IoReloadOutline,
  IoBookOutline,
  IoDocumentTextOutline,
  IoCloseOutline,
  IoWarningOutline,
} from "react-icons/io5";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { title } from "@/components/primitives";
const Divider = () => <hr className="border-border-base my-2" />;

function CustomSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required,
  description,
  className,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className || ""}`}>
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        className={`w-full min-h-[38px] bg-surface border border-border-base text-text-main text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-shadow`}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
      >
        {placeholder && (
          <option disabled hidden value="">
            {placeholder}
          </option>
        )}
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {description && (
        <p className="text-[11.5px] text-text-main/60">{description}</p>
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
  isInvalid,
  errorMessage,
  min,
  max,
  step,
  startContent,
  classNames,
  readOnly,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${classNames?.base || ""}`}>
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border rounded min-h-[38px] bg-surface transition-colors ${
          isInvalid
            ? "border-red-300 focus-within:ring-red-100"
            : "border-border-base focus-within:border-primary focus-within:ring-primary/20"
        } focus-within:ring-1 ${disabled || readOnly ? "bg-surface-2" : ""} ${classNames?.inputWrapper || ""}`}
      >
        {startContent && (
          <div className="pl-3 pr-1 text-text-main flex items-center justify-center shrink-0">
            {startContent}
          </div>
        )}
        <input
          className={`flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-main/40 disabled:text-text-main/60 ${classNames?.input || ""}`}
          disabled={disabled}
          max={max}
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
      </div>
      {(description || errorMessage) && (
        <p
          className={`text-[11.5px] ${isInvalid ? "text-red-500" : "text-text-main/60"}`}
        >
          {errorMessage || description}
        </p>
      )}
    </div>
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
    <div className="flex flex-col gap-1 relative w-full">
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center h-[38px] border border-border-base rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-surface ${disabled ? "bg-surface-2" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-2.5 w-4 h-4 text-text-main shrink-0" />
        <input
          className="flex-1 text-[13.5px] px-2 bg-transparent focus:outline-none text-text-main placeholder:text-text-main/40 w-full outline-none"
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
            className="mr-2 text-text-main hover:text-text-main"
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
      {hint && <p className="text-[11.5px] text-text-main/60">{hint}</p>}
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border-base rounded max-h-48 overflow-y-auto shadow-xl">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-text-main/50">
                No results
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`w-full text-left px-3 py-2 hover:bg-surface-2 ${i.id === value ? "bg-surface-2" : ""}`}
                  type="button"
                  onClick={() => {
                    onChange(i.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <p className="text-[13.5px] text-text-main">{i.primary}</p>
                  {i.secondary && (
                    <p className="text-[11.5px] text-text-main/60">
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
import { Switch } from "@/components/ui/switch";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { medicineService } from "@/services/medicineService";
import { pharmacyService } from "@/services/pharmacyService";
import { prescriptionService } from "@/services/prescriptionService";
import { itemService } from "@/services/itemService";
import { patientService } from "@/services/patientService";
import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";
import { PrintLayoutConfig } from "@/types/printLayout";
import { branchService } from "@/services/branchService";
import { clinicService } from "@/services/clinicService";
import { addToast } from "@/components/ui/toast";
import {
  Supplier,
  SupplierLedgerEntry,
  SupplierPayment,
  SupplierPurchaseRecord,
  StockTransaction,
  Patient,
  Clinic,
  Medicine,
  Item,
  MedicineStock,
} from "@/types/models";

import type { Branch } from "@/types/models";

const calculateFEFOAmount = (item: any, batches: MedicineStock[]): number => {
  const stockType = item.stockType || "regular";
  const defaultPrice =
    (stockType === "scheme" ? item.schemeSalePrice : item.regularSalePrice) ||
    item.salePrice ||
    0;

  if (item.isPriceOverridden) {
    return (item.quantity || 0) * defaultPrice;
  }

  if (!batches || batches.length === 0) {
    return (item.quantity || 0) * defaultPrice;
  }

  const now = new Date();

  // Filter out expired batches (expiryDate < now)
  const activeNonExpired = batches.filter((s) => {
    if (!s.expiryDate) return true;

    return new Date(s.expiryDate) >= now;
  });

  // Sort by expiry date, then createdAt
  activeNonExpired.sort((a, b) => {
    const expA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
    const expB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;

    if (expA !== expB) return expA - expB;
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    return createdA - createdB;
  });

  let remaining = item.quantity || 0;
  let totalAmount = 0;

  for (const batch of activeNonExpired) {
    if (remaining <= 0) break;
    const available =
      stockType === "scheme"
        ? (batch.schemeStock ?? 0)
        : (batch.currentStock ?? 0);

    if (available <= 0) continue;

    const qtyToUse = Math.min(remaining, available);
    const batchPrice =
      stockType === "scheme"
        ? (batch.schemePrice ?? batch.salePrice ?? defaultPrice)
        : (batch.salePrice ?? defaultPrice);

    totalAmount += qtyToUse * batchPrice;
    remaining -= qtyToUse;
  }

  // If there's still remaining quantity (not enough stock in active batches),
  // value the remaining quantity at the default price
  if (remaining > 0) {
    totalAmount += remaining * defaultPrice;
  }

  // Dynamically update the regularSalePrice/schemeSalePrice on the item to reflect the batch-specific price (or average)
  if (item.quantity > 0) {
    const avgPrice = Number((totalAmount / item.quantity).toFixed(2));

    if (stockType === "scheme") {
      item.schemeSalePrice = avgPrice;
    } else {
      item.regularSalePrice = avgPrice;
    }
    item.salePrice = avgPrice;
  }

  return totalAmount;
};

interface MedicinePurchaseItem {
  id: string;
  medicineId: string;
  medicineName: string;
  expiryDate: string;
  salePrice: number;
  quantity: number;
  amount: number;
  type?: "medicine" | "item";
}

interface ItemPurchaseItem {
  id: string;
  itemId: string;
  itemName: string;
  salePrice: number;
  quantity: number;
  amount: number;
}

interface PurchaseItem {
  id: string;
  type: "medicine" | "item";
  productId: string;
  productName: string;
  expiryDate?: string;
  salePrice: number; // Legacy field, kept for backward compatibility
  regularSalePrice?: number; // Sale price for regular stock
  schemeSalePrice?: number; // Sale price for scheme stock
  quantity: number;
  amount: number;
  stockType?: "regular" | "scheme"; // Stock type preference for medicine items
  isPriceOverridden?: boolean;
}

interface MedicinePurchaseReturnItem {
  id: string;
  purchaseItemId: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  amount: number;
  reason?: string;
}

interface MedicinePurchaseReturn {
  id: string;
  clinicId: string;
  branchId: string;
  purchaseId: string;
  totalAmount: number;
  refundMethod?: string;
  notes?: string;
  items: MedicinePurchaseReturnItem[];
  createdAt: Date;
  createdBy: string;
}

interface MedicinePurchase {
  id: string;
  purchaseNo: string;
  items: MedicinePurchaseItem[];
  total: number;
  discount: number;
  taxPercentage: number;
  taxAmount: number;
  netAmount: number;
  paymentType: string;
  paymentStatus: "paid" | "pending" | "partial" | "unpaid";
  paymentNote: string;
  patientName?: string;
  medicationDurationDays?: number;
  purchaseDate: Date;
  clinicId: string;
  branchId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  returns?: MedicinePurchaseReturn[];
  totalReturnedAmount?: number;
}

interface MedicineUsage {
  id: string;
  medicineName: string;
  quantityUsed: number;
  usageDate: Date;
  reason?: string;
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

interface SupplierLedgerSummary {
  supplier: Supplier;
  totalAmount: number;
  systemPaid: number;
  systemDue: number;
  ledgerPaid: number;
  ledgerRefund: number;
  ledgerNet: number;
  remaining: number;
  recordCount: number;
  lastPurchaseDate?: Date;
}

function StatusBadge({
  status,
  type = "status",
}: {
  status: string;
  type?: "status" | "payment";
}) {
  const S_COLORS: Record<string, string> = {
    paid: "bg-green-500/10 text-green-600 border-green-500/20",
    finalized: "bg-primary/10 text-primary border-primary/20",
    partial: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    unpaid: "bg-red-500/10 text-red-600 border-red-500/20",
    cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
    pending: "bg-surface-2 text-text-muted border-border-base",
    default: "bg-surface-2/50 text-text-muted/60 border-border-base",
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

const toISODateString = (date: any): string => {
  if (!date) return "";

  // Handle Firestore Timestamp
  if (typeof date.toDate === "function") {
    date = date.toDate();
  }

  // Handle other types
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) return "";

  return d.toISOString().split("T")[0];
};

export default function PharmacyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clinicId, currentUser, userData } = useAuthContext();
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

  const [activeTab, setActiveTab] = useState(
    () => searchParams.get("tab") || "purchased",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tab = searchParams.get("tab");

    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Medicine data
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineStocks, setMedicineStocks] = useState<Record<string, number>>(
    {},
  );
  const [purchases, setPurchases] = useState<MedicinePurchase[]>([]);
  const [usedMedicines, setUsedMedicines] = useState<MedicineUsage[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPurchaseRecords, setSupplierPurchaseRecords] = useState<
    SupplierPurchaseRecord[]
  >([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(
    [],
  );
  const [supplierLedgerBalances, setSupplierLedgerBalances] = useState<
    Record<string, number>
  >({});
  const [supplierLedgerEntries, setSupplierLedgerEntries] = useState<
    SupplierLedgerEntry[]
  >([]);
  const [selectedSupplierForTransactions, setSelectedSupplierForTransactions] =
    useState<Supplier | null>(null);

  // Daily sales statistics
  const [dailySalesTotal, setDailySalesTotal] = useState<number>(0);
  const [paidPaymentsCount, setPaidPaymentsCount] = useState<number>(0);
  const [unpaidPaymentsCount, setUnpaidPaymentsCount] = useState<number>(0);

  // Filter state for stat cards
  const [activeFilter, setActiveFilter] = useState<
    "daily" | "paid" | "unpaid" | null
  >(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination state for Sold Items/Med tab
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [purchasesRowsPerPage] = useState(10);

  // Stock Book state
  const [selectedMedicineForStockBook, setSelectedMedicineForStockBook] =
    useState<Medicine | null>(null);
  const [stockBookSearchQuery, setStockBookSearchQuery] = useState<string>("");
  const [stockTransactions, setStockTransactions] = useState<
    StockTransaction[]
  >([]);
  const [isLoadingStockTransactions, setIsLoadingStockTransactions] =
    useState(false);

  // Daily Report state
  const [dailyReportDate, setDailyReportDate] = useState<string>(() => {
    const today = new Date();

    return today.toISOString().split("T")[0];
  });
  const [isExportingDailyReport, setIsExportingDailyReport] = useState(false);

  // Daily Purchases Report state
  const [dailyPurchasesReportDate, setDailyPurchasesReportDate] =
    useState<string>(() => {
      const today = new Date();

      return today.toISOString().split("T")[0];
    });
  const [isExportingDailyPurchasesReport, setIsExportingDailyPurchasesReport] =
    useState(false);
  const [refillTransactions, setRefillTransactions] = useState<
    StockTransaction[]
  >([]);
  const [isLoadingRefillTransactions, setIsLoadingRefillTransactions] =
    useState(false);

  // Stock Summary state
  const [totalStock, setTotalStock] = useState<number | null>(null);
  const [isLoadingStockSummary, setIsLoadingStockSummary] = useState(false);

  // Items data
  const [items, setItems] = useState<Item[]>([]);

  // Clinic data
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );

  // Patients data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isLoadingPrescriptions, setIsLoadingPrescriptions] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    purchasePrice: 0,
    salePrice: 0,
    category: "",
  });

  // Pharmacy settings
  const [pharmacySettings, setPharmacySettings] =
    useState<PharmacySettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<Partial<PharmacySettings>>(
    {},
  );
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  // Purchase form state - now handles both medicines and items
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([
    {
      id: crypto.randomUUID(),
      type: "medicine",
      productId: "",
      productName: "",
      expiryDate: "",
      salePrice: 0,
      regularSalePrice: 0,
      schemeSalePrice: 0,
      quantity: 1,
      amount: 0,
      stockType: "regular", // Default to regular stock
    },
  ]);

  // State to track stock for each purchase item
  const [purchaseItemStocks, setPurchaseItemStocks] = useState<
    Record<string, number | null>
  >({});
  const [purchaseItemSchemeStocks, setPurchaseItemSchemeStocks] = useState<
    Record<string, number | null>
  >({});
  const [purchaseItemBatches, setPurchaseItemBatches] = useState<
    Record<string, MedicineStock[]>
  >({});

  const [purchaseForm, setPurchaseForm] = useState({
    total: 0,
    discount: 0,
    discountType: "flat" as "flat" | "percent",
    discountPercentage: 0,
    taxPercentage: 0,
    taxAmount: 0,
    handlingAmount: 0,
    taxableAmount: 0,
    netAmount: 0,
    paymentType: "cash" as string,
    paymentNote: "",
    patientName: "",
    patientPhone: "",
    patientAddress: "",
    medicationDurationDays: 0,
    customerType: "walk-in" as "walk-in" | "patient",
    patientId: "",
    prescriptionId: "",
  });

  const [rawStocks, setRawStocks] = useState<any[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStockFilter, setInventoryStockFilter] = useState<
    "all" | "out" | "low" | "good"
  >("all");
  const [inventoryExpiryFilter, setInventoryExpiryFilter] = useState<
    "all" | "expired" | "soon" | "valid"
  >("all");

  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false);
  const [selectedMedicineForAdjust, setSelectedMedicineForAdjust] =
    useState<Medicine | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    regularStock: 0,
    schemeStock: 0,
    reason: "",
  });
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state management using useModalState
  const purchaseModalState = useModalState(false);
  const addPaymentMethodModalState = useModalState(false);
  const editPaymentMethodModalState = useModalState(false);
  const addItemModalState = useModalState(false);
  const addSupplierPaymentModalState = useModalState(false);
  const supplierHistoryModalState = useModalState(false);

  const [editingPaymentMethod, setEditingPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: "",
    description: "",
    icon: "",
    requiresReference: false,
  });

  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] =
    useState<Supplier | null>(null);
  const [isSavingSupplierPayment, setIsSavingSupplierPayment] = useState(false);
  const [supplierPaymentForm, setSupplierPaymentForm] = useState({
    supplierId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: "payment" as "payment" | "refund",
    referenceNumber: "",
    note: "",
  });
  const [purchaseEntryForm, setPurchaseEntryForm] = useState({
    billNumber: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    debitAmount: "",
    notes: "",
  });
  const [isSavingPurchaseEntry, setIsSavingPurchaseEntry] = useState(false);

  const handleSavePurchaseEntry = async () => {
    if (!clinicId || !currentUser || !selectedSupplierForTransactions) {
      addToast({
        title: "Error",
        description: "Missing clinic or supplier context.",
        color: "danger",
      });

      return;
    }

    const debitAmountValue = parseFloat(purchaseEntryForm.debitAmount);

    if (!debitAmountValue || debitAmountValue <= 0) {
      addToast({
        title: "Validation Error",
        description: "Enter a valid debit amount greater than zero.",
        color: "warning",
      });

      return;
    }

    if (!purchaseEntryForm.billNumber.trim()) {
      addToast({
        title: "Validation Error",
        description: "Bill number is required.",
        color: "warning",
      });

      return;
    }

    if (!purchaseEntryForm.purchaseDate) {
      addToast({
        title: "Validation Error",
        description: "Select a purchase date.",
        color: "warning",
      });

      return;
    }

    try {
      setIsSavingPurchaseEntry(true);
      await medicineService.createSupplierLedgerEntry({
        supplierId: selectedSupplierForTransactions.id,
        supplierName: selectedSupplierForTransactions.name,
        billNumber: purchaseEntryForm.billNumber.trim(),
        transactionDate: new Date(purchaseEntryForm.purchaseDate),
        debitAmount: debitAmountValue,
        creditAmount: 0,
        type: "purchase",
        notes: purchaseEntryForm.notes?.trim() || undefined,
        clinicId,
        branchId: effectiveBranchId || userData?.branchId || "",
        createdBy: currentUser.uid,
      });

      await refreshSupplierPayments();
      if (selectedSupplierForTransactions) {
        await loadSupplierLedgerEntries(selectedSupplierForTransactions.id);
      }
      await loadSupplierLedgerBalances(effectiveBranchId);
      setPurchaseEntryForm({
        billNumber: "",
        purchaseDate: new Date().toISOString().split("T")[0],
        debitAmount: "",
        notes: "",
      });
      addPurchaseEntryModalState.forceClose();

      addToast({
        title: "Ledger Updated",
        description: "Purchase entry recorded in supplier ledger.",
        color: "success",
      });
    } catch (error: any) {
      console.error("Error saving purchase entry:", error);
      addToast({
        title: "Error",
        description: error.message || "Failed to save purchase entry.",
        color: "danger",
      });
    } finally {
      setIsSavingPurchaseEntry(false);
    }
  };

  const handleSaveSupplierPayment = async () => {
    if (!clinicId || !currentUser || !selectedSupplierForLedger) {
      addToast({
        title: "Error",
        description: "Missing clinic or supplier context.",
        color: "danger",
      });

      return;
    }

    const amountValue = parseFloat(supplierPaymentForm.amount);

    if (isNaN(amountValue) || amountValue <= 0) {
      addToast({
        title: "Validation Error",
        description: "Enter a valid amount greater than zero.",
        color: "warning",
      });

      return;
    }

    try {
      setIsSavingSupplierPayment(true);
      const effectiveBranchId =
        userData?.role === "clinic-admin"
          ? supplierPaymentForm.supplierId
            ? suppliers.find((s) => s.id === supplierPaymentForm.supplierId)
                ?.branchId || ""
            : ""
          : userData?.branchId || "";

      if (editingSupplierPayment) {
        await medicineService.updateSupplierPayment(editingSupplierPayment.id, {
          amount: amountValue,
          type: supplierPaymentForm.type,
          date: new Date(supplierPaymentForm.date),
          referenceNumber:
            supplierPaymentForm.referenceNumber?.trim() || undefined,
          notes: supplierPaymentForm.note?.trim() || undefined,
        });
      } else {
        await medicineService.createSupplierPayment({
          supplierId: selectedSupplierForLedger.id,
          supplierName: selectedSupplierForLedger.name,
          clinicId,
          branchId: effectiveBranchId || userData?.branchId || "",
          amount: amountValue,
          type: supplierPaymentForm.type,
          date: new Date(supplierPaymentForm.date),
          referenceNumber:
            supplierPaymentForm.referenceNumber?.trim() || undefined,
          notes: supplierPaymentForm.note?.trim() || undefined,
          recordedBy: currentUser.uid,
        });
      }

      await refreshSupplierPayments();
      // Reload ledger entries if viewing a supplier's ledger
      if (selectedSupplierForTransactions) {
        await loadSupplierLedgerEntries(selectedSupplierForTransactions.id);
      }
      await loadSupplierLedgerBalances(effectiveBranchId);
      resetSupplierPaymentFormState();
      addSupplierPaymentModalState.forceClose();

      addToast({
        title: editingSupplierPayment
          ? "Ledger Entry Updated"
          : "Ledger Updated",
        description: editingSupplierPayment
          ? "Entry updated successfully."
          : `${supplierPaymentForm.type === "payment" ? "Payment" : "Refund"} recorded for ${selectedSupplierForLedger.name}.`,
        color: "success",
      });
    } catch (error: any) {
      console.error("Error saving supplier payment:", error);
      addToast({
        title: "Error",
        description: error.message || "Failed to save supplier payment.",
        color: "danger",
      });
    } finally {
      setIsSavingSupplierPayment(false);
    }
  };

  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);
  const [editingSupplierPayment, setEditingSupplierPayment] =
    useState<SupplierPayment | null>(null);
  const addPurchaseEntryModalState = useModalState(false);

  // Edit ledger entry state
  const [editingLedgerEntry, setEditingLedgerEntry] =
    useState<SupplierLedgerEntry | null>(null);
  const [editLedgerEntryForm, setEditLedgerEntryForm] = useState({
    billNumber: "",
    transactionDate: new Date().toISOString().split("T")[0],
    debitAmount: "",
    creditAmount: "",
    notes: "",
    referenceNumber: "",
  });
  const [isSavingLedgerEntry, setIsSavingLedgerEntry] = useState(false);
  const editLedgerEntryModalState = useModalState(false);

  const handleSaveStockAdjustment = async () => {
    if (!selectedMedicineForAdjust || !clinicId) return;
    setIsAdjustingStock(true);
    try {
      const stockDoc = rawStocks.find(
        (s) => s.medicineId === selectedMedicineForAdjust.id,
      );

      if (stockDoc && stockDoc.id) {
        await medicineService.updateMedicineStock(stockDoc.id, {
          currentStock: adjustForm.regularStock,
          schemeStock: adjustForm.schemeStock,
        });

        const oldTotal =
          (stockDoc.currentStock || 0) + (stockDoc.schemeStock || 0);
        const newTotal = adjustForm.regularStock + adjustForm.schemeStock;
        const diff = newTotal - oldTotal;

        if (diff !== 0) {
          await medicineService.createStockTransaction({
            medicineId: selectedMedicineForAdjust.id,
            type: "adjustment",
            quantity: Math.abs(diff),
            previousStock: oldTotal,
            newStock: newTotal,
            unitPrice: selectedMedicineForAdjust.price || 0,
            totalAmount:
              Math.abs(diff) * (selectedMedicineForAdjust.price || 0),
            referenceId: "MANUAL-ADJUST",
            reason: adjustForm.reason || "Manual Inventory Reconciliation",
            clinicId,
            branchId: effectiveBranchId || "",
            createdBy: currentUser?.uid || "",
          });
        }

        addToast({
          title: "Stock Adjusted",
          description: `Successfully adjusted ${selectedMedicineForAdjust.name} stock level.`,
          color: "success",
        });

        setAdjustStockModalOpen(false);
        const sData = await medicineService.getStockByMedicineIds(
          clinicId,
          medicines.map((m) => m.id),
          effectiveBranchId || undefined,
        );
        const sMap: Record<string, number> = {};

        sData.forEach((s) => {
          sMap[s.medicineId] = (s.currentStock || 0) + (s.schemeStock || 0);
        });
        setMedicineStocks(sMap);
        setRawStocks(sData);
      } else {
        const stockId = await medicineService.createMedicineStock({
          medicineId: selectedMedicineForAdjust.id,
          currentStock: adjustForm.regularStock,
          schemeStock: adjustForm.schemeStock,
          minimumStock: 10,
          reorderLevel: 20,
          clinicId,
          branchId: effectiveBranchId || "",
          updatedBy: currentUser?.uid || "",
        });

        await medicineService.createStockTransaction({
          medicineId: selectedMedicineForAdjust.id,
          type: "adjustment",
          quantity: adjustForm.regularStock + adjustForm.schemeStock,
          previousStock: 0,
          newStock: adjustForm.regularStock + adjustForm.schemeStock,
          unitPrice: selectedMedicineForAdjust.price || 0,
          totalAmount:
            (adjustForm.regularStock + adjustForm.schemeStock) *
            (selectedMedicineForAdjust.price || 0),
          referenceId: "MANUAL-ADJUST",
          reason: adjustForm.reason || "Initial Inventory Reconciliation",
          clinicId,
          branchId: effectiveBranchId || "",
          createdBy: currentUser?.uid || "",
        });

        addToast({
          title: "Stock Initialized",
          description: `Successfully created stock level for ${selectedMedicineForAdjust.name}.`,
          color: "success",
        });

        setAdjustStockModalOpen(false);
        const sData = await medicineService.getStockByMedicineIds(
          clinicId,
          medicines.map((m) => m.id),
          effectiveBranchId || undefined,
        );
        const sMap: Record<string, number> = {};

        sData.forEach((s) => {
          sMap[s.medicineId] = (s.currentStock || 0) + (s.schemeStock || 0);
        });
        setMedicineStocks(sMap);
        setRawStocks(sData);
      }
    } catch (err) {
      console.error(err);
      addToast({
        title: "Adjustment Failed",
        description: "Failed to record manual stock adjustment.",
        color: "danger",
      });
    } finally {
      setIsAdjustingStock(false);
    }
  };

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

  // Load medicines, items and pharmacy settings on component mount
  useEffect(() => {
    const loadData = async () => {
      if (!clinicId || !currentUser || !userData) return;

      try {
        setLoading(true);
        const [
          medicinesData,
          itemsData,
          purchasesData,
          usageData,
          settingsData,
          suppliersData,
          supplierPurchaseRecordsData,
          supplierPaymentsData,
          clinicData,
          layoutConfigData,
          prescriptionsData,
        ] = await Promise.all([
          medicineService.getMedicinesByClinic(
            clinicId,
            undefined,
            effectiveBranchId,
          ),
          itemService.getItemsByClinic(clinicId, effectiveBranchId),
          pharmacyService.getMedicinePurchasesByClinic(
            clinicId,
            effectiveBranchId,
          ),
          pharmacyService.getMedicineUsageByClinic(clinicId, effectiveBranchId),
          pharmacyService.getPharmacySettings(clinicId, effectiveBranchId),
          medicineService.getSuppliersByClinic(clinicId, effectiveBranchId),
          medicineService.getSupplierPurchaseRecords(
            clinicId,
            effectiveBranchId,
          ),
          medicineService.getSupplierPayments(clinicId, effectiveBranchId),
          clinicService.getClinicById(clinicId),
          clinicService.getPrintLayoutConfig(clinicId),
          prescriptionService.getPrescriptionsByClinic(clinicId),
        ]);

        setMedicines(medicinesData as Medicine[]);

        // Fetch and map stock data for medicines
        const mIds = (medicinesData as Medicine[]).map((m) => m.id);
        const sData = await medicineService.getStockByMedicineIds(
          clinicId,
          mIds,
          effectiveBranchId,
        );
        const sMap: Record<string, number> = {};

        sData.forEach((s) => {
          sMap[s.medicineId] = (s.currentStock || 0) + (s.schemeStock || 0);
        });
        setMedicineStocks(sMap);
        setRawStocks(sData);

        setItems(itemsData);
        setPurchases(purchasesData as MedicinePurchase[]);
        setUsedMedicines(usageData as MedicineUsage[]);
        setSuppliers((suppliersData as Supplier[]) || []);
        setSupplierPurchaseRecords(
          (supplierPurchaseRecordsData as SupplierPurchaseRecord[]) || [],
        );
        setSupplierPayments((supplierPaymentsData as SupplierPayment[]) || []);
        setClinic(clinicData);
        setLayoutConfig(layoutConfigData);
        if (prescriptionsData) {
          setPrescriptions(
            (prescriptionsData as any[])?.filter((rx) => rx.sendToPharmacy) ||
              [],
          );
        }
        await loadSupplierLedgerBalances(effectiveBranchId);

        if (settingsData) {
          setPharmacySettings(settingsData as PharmacySettings);
          setSettingsForm(settingsData as Partial<PharmacySettings>);
          setPurchaseForm((prev) => ({
            ...prev,
            paymentType: settingsData.defaultPaymentMethod || prev.paymentType,
            taxPercentage: settingsData.defaultTaxPercentage,
          }));
        } else {
          const defaultSettings = pharmacyService.getDefaultPharmacySettings();

          setSettingsForm({
            ...defaultSettings,
            clinicId,
            branchId: effectiveBranchId || userData?.branchId || "",
          } as Partial<PharmacySettings>);
          setPurchaseForm((prev) => ({
            ...prev,
            paymentType:
              defaultSettings.defaultPaymentMethod || prev.paymentType,
            taxPercentage: defaultSettings.defaultTaxPercentage,
          }));
        }
      } catch (error) {
        console.error("Error loading pharmacy data:", error);
        addToast({
          title: "Error",
          description: "Failed to load pharmacy data. Please try again.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clinicId, effectiveBranchId, currentUser, userData]);

  // Fetch patients when purchase modal opens and customerType is patient
  useEffect(() => {
    const fetchPatients = async () => {
      if (!clinicId) return;

      // Fetch patients if purchase modal is open and customer type is patient,
      // OR if the prescriptions tab is active (needed to show patient names)
      const needsPatients =
        (purchaseModalState.isOpen &&
          purchaseForm.customerType === "patient") ||
        activeTab === "prescriptions";

      if (needsPatients && patients.length === 0) {
        setIsLoadingPatients(true);
        try {
          const patientsData = await patientService.getPatientsByClinic(
            clinicId,
            effectiveBranchId,
          );

          setPatients(patientsData);
        } catch (error) {
          console.error("Error fetching patients:", error);
          addToast({
            title: "Error",
            description: "Failed to load patients. Please try again.",
            color: "danger",
          });
        } finally {
          setIsLoadingPatients(false);
        }
      }
    };

    fetchPatients();
  }, [
    clinicId,
    purchaseModalState.isOpen,
    purchaseForm.customerType,
    activeTab,
    patients.length,
  ]);

  // Automatically load prescriptions when the tab is switched
  useEffect(() => {
    if (activeTab === "prescriptions" && clinicId) {
      const loadRx = async () => {
        setIsLoadingPrescriptions(true);
        try {
          const data =
            await prescriptionService.getPrescriptionsByClinic(clinicId);

          setPrescriptions(
            data.filter((rx) => rx.sendToPharmacy && rx.status !== "completed"),
          );
        } catch (error) {
          console.error("Error loading prescriptions:", error);
        } finally {
          setIsLoadingPrescriptions(false);
        }
      };

      loadRx();
    }
  }, [activeTab, clinicId]);

  // Calculate amounts when items change
  useEffect(() => {
    const total = purchaseItems.reduce((sum, item) => sum + item.amount, 0);

    // Calculate discount based on type
    let discountAmount = 0;

    if (purchaseForm.discountType === "flat") {
      discountAmount = purchaseForm.discount;
    } else if (purchaseForm.discountType === "percent") {
      discountAmount = (total * purchaseForm.discountPercentage) / 100;
    }

    const taxableAmount = Math.round(Math.max(0, total - discountAmount));
    const taxAmount = Math.round(
      (taxableAmount * purchaseForm.taxPercentage) / 100,
    );
    const netAmount = Math.round(
      taxableAmount + taxAmount + (purchaseForm.handlingAmount || 0),
    );

    setPurchaseForm((prev) => ({
      ...prev,
      total,
      taxableAmount,
      taxAmount,
      netAmount: Math.max(0, netAmount),
    }));
  }, [
    purchaseItems,
    purchaseForm.discount,
    purchaseForm.discountType,
    purchaseForm.discountPercentage,
    purchaseForm.taxPercentage,
    purchaseForm.handlingAmount,
  ]);

  // Calculate daily sales from purchases
  useEffect(() => {
    // Calculate daily sales (today only)
    const todayPurchases = purchases.filter((purchase) => {
      if (!purchase.purchaseDate) return false;
      const purchaseDate =
        purchase.purchaseDate instanceof Date
          ? purchase.purchaseDate
          : new Date(purchase.purchaseDate);

      return isToday(purchaseDate);
    });

    const total = todayPurchases.reduce(
      (sum, purchase) => sum + (purchase.netAmount || 0),
      0,
    );

    setDailySalesTotal(total);

    // Count paid and unpaid payments (all time)
    const paidCount = purchases.filter(
      (purchase) => purchase.paymentStatus === "paid",
    ).length;
    const unpaidCount = purchases.filter(
      (purchase) =>
        purchase.paymentStatus === "unpaid" ||
        purchase.paymentStatus === "pending",
    ).length;

    setPaidPaymentsCount(paidCount);
    setUnpaidPaymentsCount(unpaidCount);
  }, [purchases]);

  // Filter purchases based on active filter and search query
  const getFilteredPurchases = () => {
    let filtered = purchases;

    // Apply active filter
    if (activeFilter) {
      switch (activeFilter) {
        case "daily":
          filtered = filtered.filter((purchase) => {
            if (!purchase.purchaseDate) return false;
            const purchaseDate =
              purchase.purchaseDate instanceof Date
                ? purchase.purchaseDate
                : new Date(purchase.purchaseDate);

            return isToday(purchaseDate);
          });
          break;
        case "paid":
          filtered = filtered.filter(
            (purchase) => purchase.paymentStatus === "paid",
          );
          break;
        case "unpaid":
          filtered = filtered.filter(
            (purchase) =>
              purchase.paymentStatus === "unpaid" ||
              purchase.paymentStatus === "pending",
          );
          break;
      }
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();

      filtered = filtered.filter((purchase) => {
        const purchaseNo = purchase.purchaseNo?.toLowerCase() || "";
        const patientName = purchase.patientName?.toLowerCase() || "";

        return purchaseNo.includes(query) || patientName.includes(query);
      });
    }

    return filtered;
  };

  const filteredPurchases = getFilteredPurchases();

  // Pagination for Sold Items/Med tab
  const purchasesTotalPages = Math.ceil(
    filteredPurchases.length / purchasesRowsPerPage,
  );
  const purchasesStartIndex = (purchasesPage - 1) * purchasesRowsPerPage;
  const purchasesEndIndex = purchasesStartIndex + purchasesRowsPerPage;
  const paginatedPurchases = filteredPurchases.slice(
    purchasesStartIndex,
    purchasesEndIndex,
  );

  // Reset to page 1 when search query or filter changes
  useEffect(() => {
    setPurchasesPage(1);
  }, [searchQuery, activeFilter]);

  // Filter medicines for Stock Book tab
  const getFilteredMedicines = () => {
    if (!stockBookSearchQuery.trim()) {
      return medicines;
    }
    const query = stockBookSearchQuery.trim().toLowerCase();

    return medicines.filter(
      (medicine) =>
        medicine.name?.toLowerCase().includes(query) ||
        medicine.genericName?.toLowerCase().includes(query),
    );
  };

  // Filter purchases for Daily Report tab
  const getDailyReportPurchases = () => {
    if (!dailyReportDate) return [];

    const selectedDate = new Date(dailyReportDate);

    selectedDate.setHours(0, 0, 0, 0);

    return purchases.filter((purchase) => {
      if (!purchase.purchaseDate) return false;
      const purchaseDate =
        purchase.purchaseDate instanceof Date
          ? purchase.purchaseDate
          : new Date(purchase.purchaseDate);
      // Create a copy for comparison to avoid mutating the original date
      const purchaseDateForComparison = new Date(purchaseDate);

      purchaseDateForComparison.setHours(0, 0, 0, 0);

      return isSameDay(purchaseDateForComparison, selectedDate);
    });
  };

  // Get total items sold (patient purchases) for a specific date
  const getSalesQuantityForDate = (date: Date): number => {
    const selectedDate = new Date(date);

    selectedDate.setHours(0, 0, 0, 0);

    return purchases
      .filter((purchase) => {
        if (!purchase.purchaseDate) return false;
        const purchaseDate =
          purchase.purchaseDate instanceof Date
            ? purchase.purchaseDate
            : new Date(purchase.purchaseDate);
        const purchaseDateForComparison = new Date(purchaseDate);

        purchaseDateForComparison.setHours(0, 0, 0, 0);

        return isSameDay(purchaseDateForComparison, selectedDate);
      })
      .reduce(
        (sum, purchase) =>
          sum +
          (purchase.items?.reduce(
            (itemSum: number, item: { quantity: number }) =>
              itemSum + (item.quantity || 0),
            0,
          ) || 0),
        0,
      );
  };

  // Calculate total stock for a specific date - computed end-of-day: opening + refills - sales
  const calculateTotalStockForDate = async (date: Date) => {
    if (!clinicId || !date) {
      setTotalStock(null);

      return;
    }

    setIsLoadingStockSummary(true);
    try {
      const selectedDateStr = date.toISOString().split("T")[0];
      const todayStr = new Date().toISOString().split("T")[0];

      // For today: use current stock (live) and save snapshot for future computations
      if (selectedDateStr === todayStr) {
        const allStock = await medicineService.getStockByClinic(clinicId);
        const total = allStock.reduce((sum, stock) => {
          const regularStock = stock.currentStock || 0;
          const schemeStock = stock.schemeStock || 0;

          return sum + regularStock + schemeStock;
        }, 0);

        setTotalStock(total);
        await medicineService.saveDailyStockSnapshot(
          clinicId,
          effectiveBranchId,
          date,
          total,
        );

        return;
      }

      // For past dates: compute end-of-day = opening (prev day) + refills - sales
      const prevDate = subDays(date, 1);
      const openingSnapshot = await medicineService.getDailyStockSnapshot(
        clinicId,
        effectiveBranchId,
        prevDate,
      );

      if (openingSnapshot === null) {
        setTotalStock(null);

        return;
      }

      const startOfDay = new Date(date);

      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);

      endOfDay.setHours(23, 59, 59, 999);

      const refillTransactions =
        await medicineService.getStockTransactionsByClinic(
          clinicId,
          effectiveBranchId,
          "purchase",
          startOfDay,
          endOfDay,
        );
      const refillQuantity = refillTransactions.reduce(
        (sum, t) => sum + (t.quantity || 0),
        0,
      );
      const salesQuantity = getSalesQuantityForDate(date);
      const total = openingSnapshot + refillQuantity - salesQuantity;
      const computedTotal = Math.max(0, total);

      await medicineService.saveDailyStockSnapshot(
        clinicId,
        effectiveBranchId,
        date,
        computedTotal,
      );
      setTotalStock(computedTotal);
    } catch (error) {
      console.error("Error calculating total stock for date:", error);
      setTotalStock(null);
    } finally {
      setIsLoadingStockSummary(false);
    }
  };

  // Fetch total stock when daily report date changes
  useEffect(() => {
    if (clinicId && dailyReportDate) {
      const selectedDate = new Date(dailyReportDate);

      calculateTotalStockForDate(selectedDate);
    } else {
      setTotalStock(null);
    }
  }, [clinicId, dailyReportDate, effectiveBranchId, purchases]);

  // Fetch refill transactions for Daily Purchases Report
  useEffect(() => {
    const loadRefillTransactions = async () => {
      if (!clinicId || !dailyPurchasesReportDate) {
        setRefillTransactions([]);

        return;
      }

      setIsLoadingRefillTransactions(true);
      try {
        const selectedDate = new Date(dailyPurchasesReportDate);
        const startOfDay = new Date(selectedDate);

        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);

        endOfDay.setHours(23, 59, 59, 999);

        const transactions = await medicineService.getStockTransactionsByClinic(
          clinicId,
          effectiveBranchId,
          "purchase",
          startOfDay,
          endOfDay,
        );

        setRefillTransactions(transactions);
      } catch (error) {
        console.error("Error loading refill transactions:", error);
        addToast({
          title: "Error",
          description: "Failed to load refill transactions.",
          color: "danger",
        });
      } finally {
        setIsLoadingRefillTransactions(false);
      }
    };

    loadRefillTransactions();
  }, [clinicId, effectiveBranchId, dailyPurchasesReportDate]);

  // Calculate daily report summary
  const getDailyReportSummary = () => {
    const dailyPurchases = getDailyReportPurchases();
    const totalSales = dailyPurchases.reduce(
      (sum, purchase) => sum + (purchase.netAmount || 0),
      0,
    );
    const totalItems = dailyPurchases.reduce(
      (sum, purchase) =>
        sum +
        purchase.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const paidCount = dailyPurchases.filter(
      (p) => p.paymentStatus === "paid",
    ).length;
    const unpaidCount = dailyPurchases.filter(
      (p) => p.paymentStatus === "unpaid" || p.paymentStatus === "pending",
    ).length;
    const partialCount = dailyPurchases.filter(
      (p) => p.paymentStatus === "partial",
    ).length;

    return {
      totalSales,
      totalItems,
      totalPurchases: dailyPurchases.length,
      paidCount,
      unpaidCount,
      partialCount,
    };
  };

  // Helper function to get medicine cost price
  const getMedicineCostPrice = (medicineId: string): number => {
    const medicine = medicines.find((m) => m.id === medicineId);

    return medicine?.costPrice || 0;
  };

  // Filter purchases for Daily Purchases Report tab
  const getDailyPurchasesReport = () => {
    if (!dailyPurchasesReportDate) return [];

    const selectedDate = new Date(dailyPurchasesReportDate);

    selectedDate.setHours(0, 0, 0, 0);

    return purchases.filter((purchase) => {
      if (!purchase.purchaseDate) return false;
      const purchaseDate =
        purchase.purchaseDate instanceof Date
          ? purchase.purchaseDate
          : new Date(purchase.purchaseDate);
      const purchaseDateForComparison = new Date(purchaseDate);

      purchaseDateForComparison.setHours(0, 0, 0, 0);

      return isSameDay(purchaseDateForComparison, selectedDate);
    });
  };

  // Calculate daily purchases report summary (clinic purchases from suppliers / refills only)
  const getDailyPurchasesReportSummary = () => {
    let totalPurchaseCost = 0;
    let totalQuantity = 0;
    const uniqueMedicines = new Set<string>();

    refillTransactions.forEach((transaction) => {
      // Use costPrice from transaction if available, otherwise get from medicine
      const costPrice =
        transaction.costPrice || getMedicineCostPrice(transaction.medicineId);
      const itemCost = transaction.quantity * costPrice;

      totalPurchaseCost += itemCost;
      totalQuantity += transaction.quantity;
      uniqueMedicines.add(transaction.medicineId);
    });

    const averageCostPerMedicine =
      uniqueMedicines.size > 0 ? totalPurchaseCost / uniqueMedicines.size : 0;

    return {
      totalPurchaseCost,
      totalMedicines: uniqueMedicines.size,
      totalQuantity,
      averageCostPerMedicine,
    };
  };

  // Get purchase details for selected medicine
  const getPurchaseDetailsForMedicine = (medicineId: string) => {
    const purchaseDetails: Array<{
      purchaseDate: Date;
      customerName: string;
      quantity: number;
      purchaseNo: string;
    }> = [];

    purchases.forEach((purchase) => {
      const item = purchase.items.find(
        (item) => item.medicineId === medicineId,
      );

      if (item) {
        const pDate = purchase.purchaseDate as any;
        const purchaseDate =
          pDate && typeof pDate.toDate === "function"
            ? pDate.toDate()
            : purchase.purchaseDate instanceof Date
              ? purchase.purchaseDate
              : new Date(purchase.purchaseDate as string | number | Date);

        const validatedDate = isNaN(purchaseDate.getTime())
          ? new Date()
          : purchaseDate;

        purchaseDetails.push({
          purchaseDate: validatedDate,
          customerName: purchase.patientName || "Walk-in Customer",
          quantity: item.quantity,
          purchaseNo: purchase.purchaseNo,
        });
      }
    });

    // Sort by purchase date (newest first)
    return purchaseDetails.sort(
      (a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime(),
    );
  };

  const filteredMedicines = getFilteredMedicines();
  const selectedMedicinePurchaseDetails = selectedMedicineForStockBook
    ? getPurchaseDetailsForMedicine(selectedMedicineForStockBook.id)
    : [];

  // Load transactions when medicine is selected
  useEffect(() => {
    if (!selectedMedicineForStockBook || !clinicId) {
      setStockTransactions([]);

      return;
    }

    const loadStockTransactionsForMedicine = async (medicineId: string) => {
      setIsLoadingStockTransactions(true);
      try {
        const transactions =
          await medicineService.getStockTransactions(medicineId);

        setStockTransactions(transactions);
      } catch (error) {
        console.error("Error loading stock transactions:", error);
        addToast({
          title: "Error",
          description: "Failed to load stock transactions",
          color: "danger",
        });
      } finally {
        setIsLoadingStockTransactions(false);
      }
    };

    loadStockTransactionsForMedicine(selectedMedicineForStockBook.id);
  }, [selectedMedicineForStockBook, clinicId]);

  // Helper to get supplier name
  const getSupplierName = (supplierId?: string): string | undefined => {
    if (!supplierId) return undefined;

    return suppliers.find((s) => s.id === supplierId)?.name;
  };

  // Get unified medicine transactions
  const getMedicineTransactions = () => {
    if (!selectedMedicineForStockBook) return [];

    const safeDate = (d: any): Date => {
      if (d instanceof Date && !isNaN(d.getTime())) return d;
      try {
        const parsed =
          d && typeof d.toDate === "function" ? d.toDate() : new Date(d);

        return isNaN(parsed.getTime()) ? new Date() : parsed;
      } catch {
        return new Date();
      }
    };

    const customerReturns = purchases.flatMap((p) =>
      (p.returns || []).flatMap((r) =>
        r.items
          .filter((item) => item.medicineId === selectedMedicineForStockBook.id)
          .map((item) => ({
            id: `return-${r.id}-${item.id}`,
            date: safeDate(r.createdAt),
            type: "return" as const,
            party: p.patientName || "Walk-in Customer",
            quantity: item.quantity,
            reference: p.purchaseNo,
            amount: item.amount,
            batchNumber: undefined as string | undefined,
            manufacturer: undefined as string | undefined,
            expiryDate: undefined as Date | undefined,
          })),
      ),
    );

    const customerPurchases = getPurchaseDetailsForMedicine(
      selectedMedicineForStockBook.id,
    ).map((detail) => {
      const fullPurchase = purchases.find(
        (p) => p.purchaseNo === detail.purchaseNo,
      );
      const item = fullPurchase?.items.find(
        (item) => item.medicineId === selectedMedicineForStockBook.id,
      );

      return {
        id: `purchase-${detail.purchaseNo}`,
        date: safeDate(detail.purchaseDate),
        type: "sale" as const,
        party: detail.customerName,
        quantity: -detail.quantity,
        reference: detail.purchaseNo,
        amount: item?.amount || 0,
        batchNumber: undefined as string | undefined,
        manufacturer: undefined as string | undefined,
        expiryDate: undefined as Date | undefined,
      };
    });

    const supplierPurchases = stockTransactions
      .filter((t) => t.type === "purchase")
      .map((t) => ({
        id: t.id,
        date: safeDate(t.createdAt),
        type: "purchase" as const,
        party: getSupplierName(t.supplierId) || "Unknown Supplier",
        quantity: t.quantity,
        reference: t.invoiceNumber || "N/A",
        amount: t.totalAmount || (t.unitPrice || 0) * t.quantity,
        batchNumber: t.batchNumber,
        manufacturer: t.manufacturer,
        expiryDate: t.expiryDate,
      }));

    const adjustments = stockTransactions
      .filter((t) => t.type === "adjustment")
      .map((t) => ({
        id: t.id,
        date: safeDate(t.createdAt),
        type: "adjustment" as const,
        party: t.reason || "Stock Adjustment",
        quantity: t.quantity,
        reference: t.reason || "Adjustment",
        amount: 0,
        batchNumber: t.batchNumber,
        manufacturer: t.manufacturer,
        expiryDate: t.expiryDate,
      }));

    return [
      ...customerPurchases,
      ...supplierPurchases,
      ...adjustments,
      ...customerReturns,
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const medicineTransactions = getMedicineTransactions();

  // Handle stat card click
  const handleStatCardClick = (filter: "daily" | "paid" | "unpaid" | null) => {
    setActiveFilter(activeFilter === filter ? null : filter);
  };

  // Add new purchase item row
  const addPurchaseItem = () => {
    setPurchaseItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "medicine",
        productId: "",
        productName: "",
        expiryDate: "",
        salePrice: 0,
        regularSalePrice: 0,
        schemeSalePrice: 0,
        quantity: 1,
        amount: 0,
        stockType: "regular", // Default to regular stock
      },
    ]);
  };

  // Remove purchase item row
  const removePurchaseItem = (id: string) => {
    if (purchaseItems.length > 1) {
      setPurchaseItems((prev) => prev.filter((item) => item.id !== id));
      // Clear stock for removed item
      setPurchaseItemStocks((prev) => {
        const updated = { ...prev };

        delete updated[id];

        return updated;
      });
    }
  };

  // Update purchase item
  const updatePurchaseItem = (
    id: string,
    field: keyof PurchaseItem,
    value: any,
  ) => {
    setPurchaseItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          // Auto-select product details when product is selected
          if (field === "productId") {
            if (updatedItem.type === "medicine") {
              const selectedMedicine = medicines.find((m) => m.id === value);

              if (selectedMedicine) {
                updatedItem.productName = selectedMedicine.name;
                const defaultPrice = selectedMedicine.price || 0;

                updatedItem.salePrice = defaultPrice; // Keep for backward compatibility
                updatedItem.regularSalePrice = defaultPrice; // Default regular price
                updatedItem.schemeSalePrice = defaultPrice; // Default scheme price (can be updated)
                updatedItem.expiryDate = toISODateString(
                  selectedMedicine.expiryDate,
                );
                updatedItem.isPriceOverridden = false; // Reset override on selection
                // Calculate amount after setting the price
                updatedItem.amount =
                  updatedItem.quantity * updatedItem.salePrice;

                // Fetch stock for the selected medicine (both regular and scheme) in parallel
                if (clinicId && value) {
                  Promise.all([
                    medicineService.getMedicineStocks(value, clinicId),
                    medicineService.getMedicineStock(value, clinicId),
                    medicineService.getStockTransactions(value, 50),
                  ])
                    .then(([stocks, stock, transactions]) => {
                      // Save batches in state
                      setPurchaseItemBatches((prev) => ({
                        ...prev,
                        [id]: stocks,
                      }));

                      // Save stocks in state
                      setPurchaseItemStocks((prev) => ({
                        ...prev,
                        [id]: stock?.currentStock ?? null,
                      }));
                      setPurchaseItemSchemeStocks((prev) => ({
                        ...prev,
                        [id]: stock?.schemeStock ?? null,
                      }));

                      // Get latest regular stock transaction (purchase type, not scheme)
                      const latestRegularTransaction = transactions
                        .filter(
                          (t) => t.type === "purchase" && !t.isSchemeStock,
                        )
                        .sort(
                          (a, b) =>
                            (b.createdAt?.getTime() || 0) -
                            (a.createdAt?.getTime() || 0),
                        )[0];

                      // Get latest scheme stock transaction (purchase type, is scheme)
                      const latestSchemeTransaction = transactions
                        .filter((t) => t.type === "purchase" && t.isSchemeStock)
                        .sort(
                          (a, b) =>
                            (b.createdAt?.getTime() || 0) -
                            (a.createdAt?.getTime() || 0),
                        )[0];

                      setPurchaseItems((prevItems) =>
                        prevItems.map((item) => {
                          if (item.id === id) {
                            const regularPrice =
                              latestRegularTransaction?.salePrice ||
                              defaultPrice;
                            const schemePrice =
                              latestSchemeTransaction?.schemePrice ||
                              latestSchemeTransaction?.salePrice ||
                              defaultPrice;

                            // Get expiry date based on stock type
                            let expiryDate = item.expiryDate;
                            const currentStockType =
                              item.stockType || "regular";

                            if (
                              currentStockType === "regular" &&
                              latestRegularTransaction?.expiryDate
                            ) {
                              expiryDate = toISODateString(
                                latestRegularTransaction.expiryDate,
                              );
                            } else if (
                              currentStockType === "scheme" &&
                              latestSchemeTransaction?.expiryDate
                            ) {
                              expiryDate = toISODateString(
                                latestSchemeTransaction.expiryDate,
                              );
                            } else if (!expiryDate) {
                              const anyExpiry =
                                latestRegularTransaction?.expiryDate ||
                                latestSchemeTransaction?.expiryDate;

                              if (anyExpiry) {
                                expiryDate = toISODateString(anyExpiry);
                              }
                            }

                            // Build a temporary item with updated prices to run through FEFO calculation
                            const tempItem = {
                              ...item,
                              regularSalePrice: regularPrice,
                              schemeSalePrice: schemePrice,
                              salePrice:
                                currentStockType === "scheme"
                                  ? schemePrice
                                  : regularPrice,
                            };

                            const newAmount = calculateFEFOAmount(
                              tempItem,
                              stocks,
                            );

                            return {
                              ...item,
                              regularSalePrice: regularPrice,
                              schemeSalePrice: schemePrice,
                              salePrice:
                                currentStockType === "scheme"
                                  ? schemePrice
                                  : regularPrice,
                              expiryDate: expiryDate,
                              amount: newAmount,
                            };
                          }

                          return item;
                        }),
                      );
                    })
                    .catch((error) => {
                      console.warn(
                        "Could not fetch stock or transactions for medicine:",
                        value,
                        error,
                      );
                      setPurchaseItemStocks((prev) => ({
                        ...prev,
                        [id]: null,
                      }));
                      setPurchaseItemSchemeStocks((prev) => ({
                        ...prev,
                        [id]: null,
                      }));
                    });
                }
              }
            } else if (updatedItem.type === "item") {
              const selectedItem = items.find((i) => i.id === value);

              if (selectedItem) {
                updatedItem.productName = selectedItem.name;
                updatedItem.salePrice = selectedItem.salePrice || 0;
                updatedItem.expiryDate = ""; // Items don't have expiry dates
                // Calculate amount after setting the price
                updatedItem.amount =
                  updatedItem.quantity * updatedItem.salePrice;
              }
            }
          }

          // When type changes, reset the item
          if (field === "type") {
            updatedItem.productId = "";
            updatedItem.productName = "";
            updatedItem.salePrice = 0;
            updatedItem.regularSalePrice = undefined;
            updatedItem.schemeSalePrice = undefined;
            updatedItem.expiryDate = "";
            updatedItem.amount = 0;
            updatedItem.stockType = undefined; // Reset stock type when type changes
            updatedItem.isPriceOverridden = false;
            // Clear stock when type changes
            setPurchaseItemStocks((prev) => ({
              ...prev,
              [id]: null,
            }));
            setPurchaseItemSchemeStocks((prev) => ({
              ...prev,
              [id]: null,
            }));
          }

          // Mark price as manually overridden if price fields are edited
          if (
            field === "regularSalePrice" ||
            field === "schemeSalePrice" ||
            field === "salePrice"
          ) {
            updatedItem.isPriceOverridden = true;
          }

          // Auto-calculate amount when quantity or price changes
          if (
            field === "quantity" ||
            field === "salePrice" ||
            field === "regularSalePrice" ||
            field === "schemeSalePrice" ||
            field === "stockType"
          ) {
            // Calculate amount based on stock type and prices
            if (
              updatedItem.type === "medicine" &&
              updatedItem.stockType &&
              updatedItem.productId
            ) {
              const itemBatches = purchaseItemBatches[id] || [];

              updatedItem.amount = calculateFEFOAmount(
                updatedItem,
                itemBatches,
              );
            } else {
              // For items or when stock type not set, use salePrice
              updatedItem.amount = updatedItem.quantity * updatedItem.salePrice;
            }
          }

          return updatedItem;
        }

        return item;
      }),
    );
  };

  // Add new item function
  const handleAddItem = async () => {
    if (
      !clinicId ||
      !currentUser ||
      !itemForm.name.trim() ||
      !itemForm.salePrice
    )
      return;

    try {
      setIsSettingsLoading(true);

      await itemService.createItem({
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        purchasePrice: itemForm.purchasePrice,
        salePrice: itemForm.salePrice,
        category: itemForm.category.trim() || "General",
        quantity: 0, // Initialize with 0 quantity
        clinicId,
        branchId: effectiveBranchId || userData?.branchId || "",
        createdBy: currentUser.uid,
        isActive: true,
      });

      // Reload items
      const updatedItems = await itemService.getItemsByClinic(
        clinicId,
        effectiveBranchId,
      );

      setItems(updatedItems);

      addToast({
        title: "Success",
        description: "Item added successfully!",
        color: "success",
      });

      addItemModalState.forceClose();
      setItemForm({
        name: "",
        description: "",
        purchasePrice: 0,
        salePrice: 0,
        category: "",
      });
    } catch (error: any) {
      console.error("Error adding item:", error);
      addToast({
        title: "Error",
        description: error.message || "Failed to add item. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSettingsLoading(false);
    }
  };

  // Validate stock availability for purchase items
  const validateStockAvailability = async (): Promise<boolean> => {
    for (const item of purchaseItems) {
      if (item.type !== "medicine" || !item.productId || item.quantity <= 0)
        continue;

      const regularStock = purchaseItemStocks[item.id] ?? 0;
      const schemeStock = purchaseItemSchemeStocks[item.id] ?? 0;
      const stockType = item.stockType || "regular";

      // Skip validation if stock info is not available
      if (regularStock === null && schemeStock === null) continue;

      // Validate based on selected stock type
      if (stockType === "regular") {
        const totalAvailable = (regularStock ?? 0) + (schemeStock ?? 0);

        if (totalAvailable < item.quantity) {
          addToast({
            title: "Insufficient Stock",
            description: `${item.productName}: Requested ${item.quantity}, but only ${totalAvailable} available (Regular: ${regularStock ?? 0}, Scheme: ${schemeStock ?? 0})`,
            color: "danger",
          });

          return false;
        }
        // If regular stock is insufficient, auto-fallback to scheme is allowed (handled in service)
        if ((regularStock ?? 0) < item.quantity) {
          addToast({
            title: "Stock Notice",
            description: `${item.productName}: Regular stock insufficient (${regularStock ?? 0} available). Will use scheme stock for remaining quantity.`,
            color: "warning",
          });
        }
      } else if (stockType === "scheme") {
        const totalAvailable = (regularStock ?? 0) + (schemeStock ?? 0);

        if (totalAvailable < item.quantity) {
          addToast({
            title: "Insufficient Stock",
            description: `${item.productName}: Requested ${item.quantity}, but only ${totalAvailable} available (Regular: ${regularStock ?? 0}, Scheme: ${schemeStock ?? 0})`,
            color: "danger",
          });

          return false;
        }
        // If scheme stock is insufficient, auto-fallback to regular is allowed (handled in service)
        if ((schemeStock ?? 0) < item.quantity) {
          addToast({
            title: "Stock Notice",
            description: `${item.productName}: Scheme stock insufficient (${schemeStock ?? 0} available). Will use regular stock for remaining quantity.`,
            color: "warning",
          });
        }
      } else {
        // Default to regular - check total availability
        const totalAvailable = (regularStock ?? 0) + (schemeStock ?? 0);

        if (totalAvailable < item.quantity) {
          addToast({
            title: "Insufficient Stock",
            description: `${item.productName}: Requested ${item.quantity}, but only ${totalAvailable} available (Regular: ${regularStock ?? 0}, Scheme: ${schemeStock ?? 0})`,
            color: "danger",
          });

          return false;
        }
      }
    }

    return true;
  };

  // Handle purchase form submission
  const handlePurchaseSubmit = async () => {
    if (!clinicId || !currentUser) return;

    // Validate customer type and patient selection
    if (purchaseForm.customerType === "patient" && !purchaseForm.patientId) {
      addToast({
        title: "Validation Error",
        description: "Please select a patient.",
        color: "warning",
      });

      return;
    }

    // Validate form
    const hasValidItems = purchaseItems.some(
      (item) => item.productId && item.quantity > 0 && item.salePrice > 0,
    );

    if (!hasValidItems) {
      addToast({
        title: "Validation Error",
        description: "Please add at least one valid item.",
        color: "warning",
      });

      return;
    }

    // Validate stock availability
    const stockValid = await validateStockAvailability();

    if (!stockValid) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Generate purchase number
      const purchaseNo = `PUR-${Date.now()}`;

      // Convert PurchaseItem to MedicinePurchaseItem format for backward compatibility
      const purchaseItems_formatted = purchaseItems
        .filter((item) => item.productId && item.quantity > 0)
        .map((item) => ({
          id: item.id,
          medicineId: item.productId, // Use productId as medicineId for compatibility
          medicineName: item.productName,
          expiryDate: item.expiryDate || "",
          salePrice: item.salePrice, // Legacy field for backward compatibility
          regularSalePrice: item.regularSalePrice || item.salePrice,
          schemeSalePrice: item.schemeSalePrice || item.salePrice,
          quantity: item.quantity,
          amount: item.amount,
          type: item.type, // Add type info for future use
          stockType: item.stockType || "regular", // Stock type preference
        }));

      // Calculate discount amount based on type
      let discountAmount = 0;

      if (purchaseForm.discountType === "flat") {
        discountAmount = purchaseForm.discount;
      } else if (purchaseForm.discountType === "percent") {
        discountAmount =
          (purchaseForm.total * purchaseForm.discountPercentage) / 100;
      }

      const purchaseData: any = {
        purchaseNo,
        items: purchaseItems_formatted,
        total: purchaseForm.total,
        discount: discountAmount,
        taxPercentage: purchaseForm.taxPercentage,
        taxAmount: purchaseForm.taxAmount,
        netAmount: purchaseForm.netAmount,
        paymentType: purchaseForm.paymentType,
        paymentStatus: "unpaid" as const,
        paymentNote: purchaseForm.paymentNote,
        purchaseDate: new Date(),
        clinicId,
        branchId: effectiveBranchId || userData?.branchId || "",
        createdBy: currentUser.uid,
      };

      // Add customer type and patient information
      purchaseData.customerType = purchaseForm.customerType;
      if (purchaseForm.patientId) {
        purchaseData.patientId = purchaseForm.patientId;
      }

      // Only add optional fields if they have values (avoid undefined for Firebase)
      if (purchaseForm.patientName && purchaseForm.patientName.trim()) {
        purchaseData.patientName = purchaseForm.patientName.trim();
      }
      if (purchaseForm.patientPhone && purchaseForm.patientPhone.trim()) {
        purchaseData.patientPhone = purchaseForm.patientPhone.trim();
      }
      if (purchaseForm.patientAddress && purchaseForm.patientAddress.trim()) {
        purchaseData.patientAddress = purchaseForm.patientAddress.trim();
      }
      if (
        purchaseForm.medicationDurationDays &&
        purchaseForm.medicationDurationDays > 0
      ) {
        purchaseData.medicationDurationDays =
          purchaseForm.medicationDurationDays;
      }

      // Save purchase record
      const createdPurchaseId =
        await pharmacyService.createMedicinePurchase(purchaseData);

      // If this was fulfilled from a prescription, mark it as completed
      if (purchaseForm.prescriptionId) {
        try {
          await prescriptionService.updatePrescription(
            purchaseForm.prescriptionId,
            {
              status: "completed",
              notes:
                (purchaseForm.paymentNote
                  ? purchaseForm.paymentNote + "\n"
                  : "") +
                "Fulfilled by pharmacy on " +
                new Date().toLocaleDateString(),
            },
          );

          // Refresh prescriptions list to remove the completed one
          const data = await prescriptionService.getPrescriptionsByClinic(
            clinicId!,
          );

          setPrescriptions(
            data.filter((rx) => rx.sendToPharmacy && rx.status !== "completed"),
          );
        } catch (error) {
          console.error("Error updating prescription status:", error);
          // Don't fail the whole purchase if just status update fails
        }
      }

      addToast({
        title: "Success",
        description:
          "Purchase recorded successfully! Redirecting to purchase details...",
        color: "success",
      });

      // Reset form
      setPurchaseItems([
        {
          id: crypto.randomUUID(),
          type: "medicine",
          productId: "",
          productName: "",
          expiryDate: "",
          salePrice: 0,
          regularSalePrice: 0,
          schemeSalePrice: 0,
          quantity: 1,
          amount: 0,
          stockType: "regular", // Default to regular stock
        },
      ]);
      setPurchaseForm({
        total: 0,
        discount: 0,
        discountType: "flat",
        discountPercentage: 0,
        taxPercentage: pharmacySettings?.defaultTaxPercentage || 0,
        taxAmount: 0,
        handlingAmount: 0,
        taxableAmount: 0,
        netAmount: 0,
        paymentType: pharmacySettings?.defaultPaymentMethod || "cash",
        paymentNote: "",
        patientName: "",
        patientPhone: "",
        patientAddress: "",
        medicationDurationDays: 0,
        customerType: "walk-in",
        patientId: "",
        prescriptionId: "",
      });

      // Add small delay to ensure any dropdown interactions are complete before closing
      setTimeout(() => {
        purchaseModalState.forceClose();
        // Navigate to purchase detail page
        navigate(`/dashboard/pharmacy/purchase/${createdPurchaseId}`);
      }, 100);
    } catch (error) {
      console.error("Error saving purchase:", error);
      addToast({
        title: "Error",
        description: "Failed to record purchase. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get payment status color
  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "success";
      case "unpaid":
        return "danger";
      case "partial":
        return "warning";
      default:
        return "default";
    }
  };

  const getMedicationCourseMeta = (purchase: MedicinePurchase) => {
    if (!purchase.medicationDurationDays || !purchase.purchaseDate) {
      return {
        hasDuration: false,
        totalDuration: null as number | null,
        daysRemaining: null as number | null,
        isEndingSoon: false,
        isExpired: false,
      };
    }

    const purchaseDate =
      purchase.purchaseDate instanceof Date
        ? purchase.purchaseDate
        : new Date(purchase.purchaseDate);

    const daysElapsed = differenceInCalendarDays(new Date(), purchaseDate);
    const daysRemaining = purchase.medicationDurationDays - daysElapsed;

    return {
      hasDuration: true,
      totalDuration: purchase.medicationDurationDays,
      daysRemaining,
      isEndingSoon: daysRemaining <= 7 && daysRemaining >= 0,
      isExpired: daysRemaining < 0,
    };
  };

  const getMedicationStatusLabel = (
    meta: ReturnType<typeof getMedicationCourseMeta>,
  ) => {
    if (!meta.hasDuration || meta.daysRemaining === null) {
      return "";
    }

    if (meta.isExpired) {
      return meta.daysRemaining === 0
        ? "Course ended today"
        : `Course ended ${Math.abs(meta.daysRemaining)} day${Math.abs(meta.daysRemaining) === 1 ? "" : "s"} ago`;
    }

    if (meta.daysRemaining === 0) {
      return "Ends today";
    }

    return `${meta.daysRemaining} day${meta.daysRemaining === 1 ? "" : "s"} left`;
  };

  // Save pharmacy settings
  const handleSaveSettings = async () => {
    if (!clinicId || !currentUser || !settingsForm.clinicId) {
      addToast({
        title: "Error",
        description:
          "Missing required authentication data. Please refresh the page and try again.",
        color: "danger",
      });

      return;
    }

    // ----- Validation ----------------------------------------------------
    // 1. Require at least one enabled payment method.
    if (!settingsForm.enabledPaymentMethods?.some((pm) => pm.isEnabled)) {
      addToast({
        title: "Validation Error",
        description:
          "Please enable at least one payment method before saving settings.",
        color: "warning",
      });

      return;
    }

    // 2. Ensure the selected default payment method is enabled.
    const defaultMethod = settingsForm.enabledPaymentMethods.find(
      (pm) => pm.key === settingsForm.defaultPaymentMethod,
    );

    if (!defaultMethod || !defaultMethod.isEnabled) {
      addToast({
        title: "Validation Error",
        description:
          "The default payment method must be one of the enabled methods.",
        color: "warning",
      });

      return;
    }

    try {
      setIsSettingsLoading(true);

      const settingsData = {
        ...settingsForm,
        clinicId,
        branchId: effectiveBranchId || userData?.branchId || "",
        updatedBy: currentUser.uid,
      } as Omit<PharmacySettings, "id" | "createdAt" | "updatedAt">;

      await pharmacyService.savePharmacySettings(settingsData);

      // Reload settings
      const updatedSettings = await pharmacyService.getPharmacySettings(
        clinicId,
        effectiveBranchId,
      );

      if (updatedSettings) {
        setPharmacySettings(updatedSettings as PharmacySettings);
      }

      addToast({
        title: "Success",
        description: "Pharmacy settings saved successfully!",
        color: "success",
      });
    } catch (error) {
      console.error("Error saving pharmacy settings:", error);

      let errorMessage = "Failed to save pharmacy settings. Please try again.";

      if (error.message?.includes("Missing or insufficient permissions")) {
        errorMessage =
          "You don't have permission to save pharmacy settings. Please contact your administrator.";
      } else if (error.message?.includes("clinicId")) {
        errorMessage =
          "Invalid clinic ID. Please refresh the page and try again.";
      }

      addToast({
        title: "Error",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setIsSettingsLoading(false);
    }
  };

  // Update payment method enabled status
  const updatePaymentMethodStatus = (methodKey: string, isEnabled: boolean) => {
    setSettingsForm((prev) => {
      const updatedMethods =
        prev.enabledPaymentMethods?.map((method) =>
          method.key === methodKey ? { ...method, isEnabled } : method,
        ) || [];

      // If the default payment method was disabled, automatically pick another enabled one.
      let defaultKey = prev.defaultPaymentMethod;

      if (!updatedMethods.some((pm) => pm.key === defaultKey && pm.isEnabled)) {
        const firstEnabled = updatedMethods.find((pm) => pm.isEnabled);

        defaultKey = firstEnabled ? firstEnabled.key : "";
      }

      return {
        ...prev,
        enabledPaymentMethods: updatedMethods,
        defaultPaymentMethod: defaultKey,
      } as Partial<PharmacySettings>;
    });
  };

  // Get available payment methods for the payment dropdown
  const getAvailablePaymentMethods = () => {
    if (!settingsForm.enabledPaymentMethods) return [];

    return settingsForm.enabledPaymentMethods.filter(
      (method) => method.isEnabled,
    );
  };

  const refreshSupplierPayments = async () => {
    if (!clinicId) return;
    try {
      const payments = await medicineService.getSupplierPayments(
        clinicId,
        effectiveBranchId,
      );

      setSupplierPayments(payments);
    } catch (error) {
      console.error("Error refreshing supplier payments:", error);
      addToast({
        title: "Error",
        description: "Failed to refresh supplier ledger entries.",
        color: "danger",
      });
    }
  };

  const loadSupplierLedgerBalances = async (branchIdParam?: string) => {
    if (!clinicId) return;
    try {
      const balances = await medicineService.getSupplierLedgerBalances(
        clinicId,
        branchIdParam,
      );

      setSupplierLedgerBalances(balances);
    } catch (error) {
      console.error("Error refreshing supplier ledger balances:", error);
      addToast({
        title: "Error",
        description: "Failed to refresh supplier balances.",
        color: "danger",
      });
    }
  };

  const loadSupplierLedgerEntries = async (supplierId: string) => {
    if (!clinicId) return;
    try {
      const entries = await medicineService.getSupplierLedgerEntries(
        supplierId,
        clinicId,
        effectiveBranchId,
      );

      setSupplierLedgerEntries(entries);
    } catch (error) {
      console.error("Error loading supplier ledger entries:", error);
      addToast({
        title: "Error",
        description: "Failed to load supplier ledger entries.",
        color: "danger",
      });
    }
  };

  const handleSelectSupplierForLedger = async (supplier: Supplier) => {
    setSelectedSupplierForTransactions(supplier);
    await loadSupplierLedgerEntries(supplier.id);
  };

  const supplierLedgerSummaries = useMemo<SupplierLedgerSummary[]>(() => {
    if (!clinicId) return [];

    const summaryMap = new Map<string, SupplierLedgerSummary>();

    const ensureSummary = (
      supplierId: string,
      fallback?: { name?: string; contactPerson?: string; phone?: string },
    ) => {
      if (summaryMap.has(supplierId)) {
        return summaryMap.get(supplierId)!;
      }

      const supplier =
        suppliers.find((sup) => sup.id === supplierId) ||
        ({
          id: supplierId,
          name: fallback?.name || "Unknown Supplier",
          contactPerson: fallback?.contactPerson,
          phone: fallback?.phone || "",
          email: undefined,
          address: undefined,
          licenseNumber: undefined,
          isActive: true,
          clinicId: clinicId ?? "",
          branchId: effectiveBranchId || "",
          createdAt: new Date(0),
          updatedAt: new Date(0),
          createdBy: "",
        } as Supplier);

      const summary: SupplierLedgerSummary = {
        supplier,
        totalAmount: 0,
        systemPaid: 0,
        systemDue: 0,
        ledgerPaid: 0,
        ledgerRefund: 0,
        ledgerNet: 0,
        remaining: 0,
        recordCount: 0,
      };

      summaryMap.set(supplierId, summary);

      return summary;
    };

    supplierPurchaseRecords.forEach((record) => {
      const summary = ensureSummary(record.supplierId, {
        name: record.supplierName,
      });

      summary.totalAmount += record.totalAmount || 0;
      summary.systemPaid += record.paidAmount || 0;
      const calculatedDue =
        typeof record.dueAmount === "number"
          ? record.dueAmount
          : Math.max((record.totalAmount || 0) - (record.paidAmount || 0), 0);

      summary.systemDue += calculatedDue;
      summary.recordCount += 1;
      if (
        !summary.lastPurchaseDate ||
        summary.lastPurchaseDate < record.purchaseDate
      ) {
        summary.lastPurchaseDate = record.purchaseDate;
      }
    });

    supplierPayments.forEach((payment) => {
      const summary = ensureSummary(payment.supplierId, {
        name: payment.supplierName,
      });

      if (payment.type === "payment") {
        summary.ledgerPaid += payment.amount;
      } else {
        summary.ledgerRefund += payment.amount;
      }
    });

    summaryMap.forEach((summary) => {
      summary.ledgerNet = summary.ledgerPaid - summary.ledgerRefund;
      if (typeof supplierLedgerBalances[summary.supplier.id] === "number") {
        summary.remaining = supplierLedgerBalances[summary.supplier.id]!;
      } else {
        summary.remaining = Math.max(summary.systemDue - summary.ledgerNet, 0);
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) =>
      a.supplier.name.localeCompare(b.supplier.name),
    );
  }, [
    suppliers,
    supplierPurchaseRecords,
    supplierPayments,
    supplierLedgerBalances,
    clinicId,
    effectiveBranchId,
  ]);

  const supplierLedgerStats = useMemo(() => {
    return supplierLedgerSummaries.reduce(
      (acc, summary) => {
        acc.totalPurchase += summary.totalAmount;
        acc.totalPaid +=
          summary.systemPaid + summary.ledgerPaid - summary.ledgerRefund;
        acc.remaining += summary.remaining;
        if (summary.remaining > 0.5) {
          acc.pendingSuppliers += 1;
        }

        return acc;
      },
      {
        totalPurchase: 0,
        totalPaid: 0,
        remaining: 0,
        pendingSuppliers: 0,
      },
    );
  }, [supplierLedgerSummaries]);

  const filteredSupplierSummaries = useMemo(() => {
    if (!supplierSearchQuery.trim()) return supplierLedgerSummaries;
    const query = supplierSearchQuery.trim().toLowerCase();

    return supplierLedgerSummaries.filter((summary) => {
      const supplier = summary.supplier;

      return (
        supplier.name.toLowerCase().includes(query) ||
        supplier.contactPerson?.toLowerCase().includes(query) ||
        supplier.phone?.toLowerCase().includes(query)
      );
    });
  }, [supplierLedgerSummaries, supplierSearchQuery]);

  const getExpiryStatus = (expiryDate: Date | undefined) => {
    if (!expiryDate)
      return {
        label: "N/A",
        color: "text-default-400 bg-default-100/50",
        status: "valid",
      };
    const diffDays = differenceInCalendarDays(expiryDate, new Date());

    if (diffDays < 0) {
      return {
        label: "Expired",
        color: "text-red-600 bg-red-50 border border-red-200",
        status: "expired",
      };
    } else if (diffDays <= 90) {
      return {
        label: `Expiring Soon (${diffDays}d)`,
        color: "text-amber-600 bg-amber-50 border border-amber-200",
        status: "soon",
      };
    } else {
      return {
        label: `Valid (${expiryDate.toLocaleDateString()})`,
        color: "text-green-600 bg-green-50 border border-green-200",
        status: "valid",
      };
    }
  };

  const filteredInventoryMedicines = useMemo(() => {
    return medicines.filter((m) => {
      const nameMatch =
        m.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        (m.genericName || "")
          .toLowerCase()
          .includes(inventorySearch.toLowerCase());

      if (!nameMatch) return false;

      const stock = medicineStocks[m.id] || 0;

      if (inventoryStockFilter === "out" && stock > 0) return false;
      if (inventoryStockFilter === "low" && (stock === 0 || stock > 10))
        return false;
      if (inventoryStockFilter === "good" && stock <= 10) return false;

      if (inventoryExpiryFilter !== "all") {
        const statusObj = getExpiryStatus(m.expiryDate);

        if (inventoryExpiryFilter !== statusObj.status) return false;
      }

      return true;
    });
  }, [
    medicines,
    medicineStocks,
    inventorySearch,
    inventoryStockFilter,
    inventoryExpiryFilter,
  ]);

  const getSupplierPaymentsForSupplier = (supplierId: string) =>
    supplierPayments
      .filter((payment) => payment.supplierId === supplierId)
      .sort((a, b) => {
        const aDate = a.date ? new Date(a.date).getTime() : 0;
        const bDate = b.date ? new Date(b.date).getTime() : 0;

        return bDate - aDate;
      });

  const resetSupplierPaymentFormState = () => {
    setSupplierPaymentForm({
      supplierId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      type: "payment",
      referenceNumber: "",
      note: "",
    });
    setSelectedSupplierForLedger(null);
    setEditingSupplierPayment(null);
  };

  const handleOpenSupplierPaymentModal = (
    supplier: Supplier,
    payment?: SupplierPayment,
  ) => {
    setSelectedSupplierForLedger(supplier);
    if (payment) {
      setEditingSupplierPayment(payment);
      setSupplierPaymentForm({
        supplierId: supplier.id,
        amount: payment.amount.toString(),
        date: toISODateString(payment.date || new Date()),
        type: payment.type,
        referenceNumber: payment.referenceNumber || "",
        note: payment.notes || "",
      });
    } else {
      setEditingSupplierPayment(null);
      setSupplierPaymentForm({
        supplierId: supplier.id,
        amount: "",
        date: new Date().toISOString().split("T")[0],
        type: "payment",
        referenceNumber: "",
        note: "",
      });
    }
    addSupplierPaymentModalState.open();
  };

  const handleOpenSupplierHistoryModal = async (supplier: Supplier) => {
    setHistorySupplier(supplier);
    await loadSupplierLedgerEntries(supplier.id);
    supplierHistoryModalState.open();
  };

  const handleCloseSupplierHistoryModal = () => {
    supplierHistoryModalState.forceClose();
    setHistorySupplier(null);
  };

  const handleEditLedgerEntry = async () => {
    if (
      !clinicId ||
      !currentUser ||
      !editingLedgerEntry ||
      !selectedSupplierForTransactions
    ) {
      addToast({
        title: "Error",
        description: "Missing required context.",
        color: "danger",
      });

      return;
    }

    // Validate that either debit or credit amount is provided, but not both
    const debitAmountValue = editLedgerEntryForm.debitAmount
      ? parseFloat(editLedgerEntryForm.debitAmount)
      : 0;
    const creditAmountValue = editLedgerEntryForm.creditAmount
      ? parseFloat(editLedgerEntryForm.creditAmount)
      : 0;

    if (debitAmountValue <= 0 && creditAmountValue <= 0) {
      addToast({
        title: "Validation Error",
        description:
          "Either debit amount or credit amount must be greater than zero.",
        color: "warning",
      });

      return;
    }

    if (debitAmountValue > 0 && creditAmountValue > 0) {
      addToast({
        title: "Validation Error",
        description:
          "Cannot have both debit and credit amounts. Please provide only one.",
        color: "warning",
      });

      return;
    }

    if (!editLedgerEntryForm.transactionDate) {
      addToast({
        title: "Validation Error",
        description: "Transaction date is required.",
        color: "warning",
      });

      return;
    }

    try {
      setIsSavingLedgerEntry(true);

      const updateData: Partial<SupplierLedgerEntry> = {
        transactionDate: new Date(editLedgerEntryForm.transactionDate),
        debitAmount: debitAmountValue,
        creditAmount: creditAmountValue,
      };

      // Only include optional fields if they have values
      if (editLedgerEntryForm.billNumber.trim()) {
        updateData.billNumber = editLedgerEntryForm.billNumber.trim();
      }
      if (editLedgerEntryForm.notes.trim()) {
        updateData.notes = editLedgerEntryForm.notes.trim();
      }
      if (editLedgerEntryForm.referenceNumber.trim()) {
        updateData.referenceNumber = editLedgerEntryForm.referenceNumber.trim();
      }

      await medicineService.updateSupplierLedgerEntry(
        editingLedgerEntry.id,
        updateData,
      );

      // Reload ledger entries to show updated balances
      await loadSupplierLedgerEntries(selectedSupplierForTransactions.id);
      await loadSupplierLedgerBalances(effectiveBranchId);

      // Reset form and close modal
      setEditingLedgerEntry(null);
      setEditLedgerEntryForm({
        billNumber: "",
        transactionDate: new Date().toISOString().split("T")[0],
        debitAmount: "",
        creditAmount: "",
        notes: "",
        referenceNumber: "",
      });
      editLedgerEntryModalState.forceClose();

      addToast({
        title: "Success",
        description: "Ledger entry updated successfully.",
        color: "success",
      });
    } catch (error: any) {
      console.error("Error updating ledger entry:", error);
      addToast({
        title: "Error",
        description: error.message || "Failed to update ledger entry.",
        color: "danger",
      });
    } finally {
      setIsSavingLedgerEntry(false);
    }
  };

  const handlePrintLedger = () => {
    if (
      !selectedSupplierForTransactions ||
      supplierLedgerEntries.length === 0
    ) {
      addToast({
        title: "Error",
        description: "No ledger entries to print.",
        color: "warning",
      });

      return;
    }

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

    // Calculate summary
    const totalDebits = supplierLedgerEntries.reduce(
      (sum, entry) => sum + entry.debitAmount,
      0,
    );
    const totalCredits = supplierLedgerEntries.reduce(
      (sum, entry) => sum + entry.creditAmount,
      0,
    );
    const currentBalance =
      supplierLedgerEntries.length > 0
        ? supplierLedgerEntries[supplierLedgerEntries.length - 1].balanceAmount
        : 0;

    // Build transaction rows HTML
    const transactionsHtml = supplierLedgerEntries
      .map(
        (entry) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${entry.billNumber || '<span style="color: #999; font-style: italic;">Payment</span>'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${entry.transactionDate.toLocaleDateString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: ${entry.debitAmount > 0 ? "#e53e3e" : "#999"};">${entry.debitAmount > 0 ? `NPR ${entry.debitAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: ${entry.creditAmount > 0 ? "#38a169" : "#999"};">${entry.creditAmount > 0 ? `NPR ${entry.creditAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; color: ${entry.balanceAmount > 0 ? "#e53e3e" : entry.balanceAmount < 0 ? "#38a169" : "#666"};">NPR ${entry.balanceAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${entry.type === "purchase" ? "Purchase" : "Payment"}</td>
      </tr>
    `,
      )
      .join("");

    // Global Branding Utility
    const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig) : "";
    const headerHtml = layoutConfig
      ? getPrintHeaderHTML(layoutConfig, clinic)
      : "";
    const footerHtml = layoutConfig ? getPrintFooterHTML(layoutConfig) : "";

    const printContent = `<!DOCTYPE html>
<html>
<head>
  <title>Supplier Ledger - ${selectedSupplierForTransactions.name}</title>
  <style>
    ${brandingCSS}

    .content { flex: 1; padding: 15mm; min-height: 0; }
    
    .document-title { text-align: center; margin: 10px 0 25px 0; }
    .document-title h2 { font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; }
    .document-subtitle { font-size: 13px; color: #64748b; margin: 5px 0; font-weight: 500; }
    
    .supplier-info { margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; }
    .supplier-info h3 { margin: 0 0 5px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .supplier-info p { margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; }

    .summary-section { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #475569; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .summary-item { display: flex; flex-direction: column; gap: 4px; padding: 5px 0; font-size: 13px; }
    .summary-item span:first-child { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .summary-item span:last-child { font-weight: 800; font-size: 16px; color: #1e293b; }

    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f8fafc; padding: 12px 10px; text-align: left; font-weight: 700; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase; }
    td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; }

    @media print { body { padding: 0; margin: 0; } .print-container { height: 100vh; padding: 0; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="print-container">
    ${headerHtml}

    <div class="content">
      <div class="document-title">
        <h2>Supplier Transaction Ledger</h2>
        <p class="document-subtitle">Account Statement</p>
      </div>

      <div class="supplier-info">
        <h3>Supplier Details</h3>
        <p>${selectedSupplierForTransactions.name}</p>
        <p style="font-size: 12px; font-weight: 400; color: #64748b; margin-top: 4px;">${selectedSupplierForTransactions.email || ""} | ${selectedSupplierForTransactions.phone || ""}</p>
      </div>

      <div class="summary-section">
        <div class="summary-grid">
          <div class="summary-item"><span>Total Debits</span><span>NPR ${totalDebits.toLocaleString()}</span></div>
          <div class="summary-item"><span>Total Credits</span><span>NPR ${totalCredits.toLocaleString()}</span></div>
          <div class="summary-item"><span>Current Balance</span><span style="color: ${currentBalance > 0 ? "#e53e3e" : "#38a169"}">NPR ${currentBalance.toLocaleString()}</span></div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Bill/Ref No.</th>
            <th>Date</th>
            <th style="text-align: right;">Debit (Dr)</th>
            <th style="text-align: right;">Credit (Cr)</th>
            <th style="text-align: right;">Balance</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>${transactionsHtml}</tbody>
      </table>
    </div>

    ${footerHtml}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 500);
    };
  </script>
</body>
</html>`;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handleDeleteSupplierPayment = async (paymentId: string) => {
    if (!paymentId) return;
    if (!confirm("Delete this ledger entry? This action cannot be undone.")) {
      return;
    }

    try {
      await medicineService.deleteSupplierPayment(paymentId);
      await refreshSupplierPayments();
      addToast({
        title: "Deleted",
        description: "Ledger entry deleted successfully.",
        color: "success",
      });
    } catch (error: any) {
      console.error("Error deleting supplier payment:", error);
      addToast({
        title: "Error",
        description: error.message || "Failed to delete ledger entry.",
        color: "danger",
      });
    }
  };

  const handleCloseSupplierPaymentModal = () => {
    addSupplierPaymentModalState.forceClose();
    resetSupplierPaymentFormState();
  };

  // Reset payment method form
  const resetPaymentMethodForm = () => {
    setPaymentMethodForm({
      name: "",
      description: "",
      icon: "",
      requiresReference: false,
    });
    setEditingPaymentMethod(null);
  };

  // Handle add payment method
  const handleAddPaymentMethod = async () => {
    if (!clinicId || !currentUser || !paymentMethodForm.name.trim()) {
      addToast({
        title: "Error",
        description:
          "Missing required authentication data. Please refresh the page and try again.",
        color: "danger",
      });

      return;
    }

    // Client-side duplicate check to prevent unnecessary round-trip.
    const duplicate = settingsForm.enabledPaymentMethods?.some(
      (pm) =>
        pm.name.trim().toLowerCase() ===
        paymentMethodForm.name.trim().toLowerCase(),
    );

    if (duplicate) {
      addToast({
        title: "Validation Error",
        description: "A payment method with the same name already exists.",
        color: "warning",
      });

      return;
    }

    try {
      setIsSettingsLoading(true);

      await pharmacyService.addPaymentMethod(
        clinicId,
        {
          name: paymentMethodForm.name.trim(),
          description: paymentMethodForm.description.trim(),
          icon: paymentMethodForm.icon.trim() || "💳",
          requiresReference: paymentMethodForm.requiresReference,
          isEnabled: true,
        },
        effectiveBranchId,
      );

      // Reload settings to get updated payment methods
      const updatedSettings = await pharmacyService.getPharmacySettings(
        clinicId,
        effectiveBranchId,
      );

      if (updatedSettings) {
        setPharmacySettings(updatedSettings as PharmacySettings);
        setSettingsForm(updatedSettings as Partial<PharmacySettings>);
      }

      addToast({
        title: "Success",
        description: "Payment method added successfully!",
        color: "success",
      });

      addPaymentMethodModalState.close();
      resetPaymentMethodForm();
    } catch (error: any) {
      console.error("Error adding payment method:", error);

      let errorMessage = "Failed to add payment method. Please try again.";

      if (error.message?.includes("Missing or insufficient permissions")) {
        errorMessage =
          "You don't have permission to add payment methods. Please contact your administrator.";
      } else if (error.message?.includes("clinicId")) {
        errorMessage =
          "Invalid clinic ID. Please refresh the page and try again.";
      }

      addToast({
        title: "Error",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setIsSettingsLoading(false);
    }
  };

  // Handle edit payment method
  const handleEditPaymentMethod = async () => {
    if (
      !clinicId ||
      !currentUser ||
      !editingPaymentMethod ||
      !paymentMethodForm.name.trim()
    )
      return;

    // Prevent renaming to an existing name.
    const duplicateEdit = settingsForm.enabledPaymentMethods?.some(
      (pm) =>
        pm.id !== editingPaymentMethod.id &&
        pm.name.trim().toLowerCase() ===
          paymentMethodForm.name.trim().toLowerCase(),
    );

    if (duplicateEdit) {
      addToast({
        title: "Validation Error",
        description: "Another payment method with this name already exists.",
        color: "warning",
      });

      return;
    }

    try {
      setIsSettingsLoading(true);

      await pharmacyService.updatePaymentMethod(
        clinicId,
        editingPaymentMethod.id,
        {
          name: paymentMethodForm.name.trim(),
          description: paymentMethodForm.description.trim(),
          icon: paymentMethodForm.icon.trim() || editingPaymentMethod.icon,
          requiresReference: paymentMethodForm.requiresReference,
        },
        effectiveBranchId,
      );

      // Reload settings to get updated payment methods
      const updatedSettings = await pharmacyService.getPharmacySettings(
        clinicId,
        effectiveBranchId,
      );

      if (updatedSettings) {
        setPharmacySettings(updatedSettings as PharmacySettings);
        setSettingsForm(updatedSettings as Partial<PharmacySettings>);
      }

      addToast({
        title: "Success",
        description: "Payment method updated successfully!",
        color: "success",
      });

      editPaymentMethodModalState.close();
      resetPaymentMethodForm();
    } catch (error: any) {
      console.error("Error updating payment method:", error);
      addToast({
        title: "Error",
        description:
          error.message || "Failed to update payment method. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSettingsLoading(false);
    }
  };

  // Handle delete payment method
  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!clinicId || !currentUser) return;

    const paymentMethod = settingsForm.enabledPaymentMethods?.find(
      (pm) => pm.id === paymentMethodId,
    );

    if (!paymentMethod) return;

    if (!paymentMethod.isCustom) {
      addToast({
        title: "Error",
        description: "Cannot delete default payment methods.",
        color: "warning",
      });

      return;
    }

    if (!confirm(`Are you sure you want to delete "${paymentMethod.name}"?`)) {
      return;
    }

    try {
      setIsSettingsLoading(true);

      await pharmacyService.deletePaymentMethod(
        clinicId,
        paymentMethodId,
        effectiveBranchId,
      );

      // Reload settings to get updated payment methods
      const updatedSettings = await pharmacyService.getPharmacySettings(
        clinicId,
        effectiveBranchId,
      );

      if (updatedSettings) {
        setPharmacySettings(updatedSettings as PharmacySettings);
        setSettingsForm(updatedSettings as Partial<PharmacySettings>);
      }

      addToast({
        title: "Success",
        description: "Payment method deleted successfully!",
        color: "success",
      });
    } catch (error: any) {
      console.error("Error deleting payment method:", error);
      addToast({
        title: "Error",
        description:
          error.message || "Failed to delete payment method. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSettingsLoading(false);
    }
  };

  // Handle opening edit modal
  const handleOpenEditModal = (method: PaymentMethod) => {
    setEditingPaymentMethod(method);
    setPaymentMethodForm({
      name: method.name,
      description: method.description || "",
      icon: method.icon || "",
      requiresReference: method.requiresReference,
    });
    editPaymentMethodModalState.open();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5 px-4 pb-12">
        <div className="flex flex-col">
          <h1 className={`${title({ size: "lg" })} text-primary`}>Pharmacy</h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage medicine purchases and usage
          </p>
        </div>
        <div className="bg-surface border border-border-base rounded flex items-center justify-center py-12 text-[13px] text-text-muted">
          Loading pharmacy data...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5 px-4 pb-12">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col">
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Pharmacy
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              Manage medicine & item purchases and usage
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
            {activeTab === "purchased" && (
              <Button color="primary" onClick={purchaseModalState.open}>
                <IoAddOutline className="w-4 h-4 mr-1" />
                New Record
              </Button>
            )}

            {activeTab === "items" && (
              <Button color="primary" onClick={addItemModalState.open}>
                <IoAddOutline className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Daily Sales Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={`bg-surface border transition-all rounded p-4 cursor-pointer flex flex-col items-center ${
              activeFilter === "daily"
                ? "border-primary shadow-sm ring-1 ring-primary/20"
                : "border-border-base hover:border-border-strong hover:bg-surface-2"
            }`}
            onClick={() => handleStatCardClick("daily")}
          >
            <IoStorefrontOutline className="text-primary w-6 h-6 mb-2" />
            <p className="text-stat-sm font-bold text-text-main">
              NPR {dailySalesTotal.toLocaleString()}
            </p>
            <p className="text-[12px] text-text-muted mt-0.5">Daily Sales</p>
          </div>

          <div
            className={`bg-surface border transition-all rounded p-4 cursor-pointer flex flex-col items-center ${
              activeFilter === "paid"
                ? "border-primary shadow-sm ring-1 ring-primary/20"
                : "border-border-base hover:border-border-strong hover:bg-surface-2"
            }`}
            onClick={() => handleStatCardClick("paid")}
          >
            <IoCheckmarkCircleOutline className="text-primary w-6 h-6 mb-2" />
            <p className="text-stat-sm font-bold text-text-main">
              {paidPaymentsCount}
            </p>
            <p className="text-[12px] text-text-muted mt-0.5">
              Total Paid Payments
            </p>
          </div>

          <div
            className={`bg-surface border transition-all rounded p-4 cursor-pointer flex flex-col items-center ${
              activeFilter === "unpaid"
                ? "border-red-500 shadow-sm ring-1 ring-red-500/20"
                : "border-border-base hover:border-red-500/40 hover:bg-surface-2"
            }`}
            onClick={() => handleStatCardClick("unpaid")}
          >
            <IoCloseCircleOutline className="text-red-500 w-6 h-6 mb-2" />
            <p className="text-stat-sm font-bold text-text-main">
              {unpaidPaymentsCount}
            </p>
            <p className="text-[12px] text-red-500 mt-0.5">
              Total Unpaid Payments
            </p>
          </div>
        </div>

        {/* Main content with tabs */}
        <div className="bg-surface border border-border-base rounded overflow-hidden shadow-sm">
          {/* Tab Strip */}
          <div className="flex flex-wrap border-b border-border-base bg-surface-2/50">
            {[
              {
                id: "purchased",
                label: "Sold Items/Med",
                icon: <IoMedicalOutline className="w-4 h-4" />,
              },
              {
                id: "supplier_ledger",
                label: "Supplier Ledger",
                icon: <IoBookOutline className="w-4 h-4" />,
              },
              {
                id: "stock_book",
                label: "Stock Book",
                icon: <IoDocumentTextOutline className="w-4 h-4" />,
              },
              {
                id: "inventory",
                label: "Inventory",
                icon: <IoMedicalOutline className="w-4 h-4" />,
              },
              {
                id: "items",
                label: "Items",
                icon: <IoTimeOutline className="w-4 h-4" />,
              },
              {
                id: "daily_sales_report",
                label: "Daily Sales Report",
                icon: <IoReceiptOutline className="w-4 h-4" />,
              },
              {
                id: "daily_purchases_report",
                label: "Daily Purchases Report",
                icon: <IoReceiptOutline className="w-4 h-4" />,
              },
              {
                id: "prescriptions",
                label: "Prescriptions",
                icon: <IoReceiptOutline className="w-4 h-4" />,
              },
              {
                id: "settings",
                label: "Settings",
                icon: <IoSettingsOutline className="w-4 h-4" />,
              },
            ].map((t) => (
              <button
                key={t.id}
                className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium border-b-2 transition-colors
                  ${activeTab === t.id ? "border-primary text-primary bg-surface" : "border-transparent text-text-muted hover:text-primary hover:bg-surface"}`}
                type="button"
                onClick={() => setActiveTab(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === "purchased" && (
              <div className="flex flex-col">
                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 w-full sm:max-w-md relative">
                    <div
                      className={`flex items-center h-[38px] border border-border-base rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-surface`}
                    >
                      <IoSearchOutline className="ml-2.5 w-4 h-4 text-text-muted shrink-0" />
                      <input
                        className="flex-1 text-[13.5px] px-2 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/40 w-full"
                        placeholder="Search by purchase no or patient name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button
                          className="mr-2 text-text-muted hover:text-text-main"
                          type="button"
                          onClick={() => setSearchQuery("")}
                        >
                          <IoCloseOutline className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {activeFilter && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[12px] font-medium">
                        {activeFilter === "daily" && "Filtered: Daily Sales"}
                        {activeFilter === "paid" && "Filtered: Paid Payments"}
                        {activeFilter === "unpaid" &&
                          "Filtered: Unpaid Payments"}
                        <button
                          className="hover:text-primary focus:outline-none"
                          onClick={() => setActiveFilter(null)}
                        >
                          <IoCloseOutline className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </div>
                  )}
                </div>
                {purchases.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-default-400 mb-4">
                      <IoDownloadOutline
                        className="mx-auto opacity-50"
                        size={48}
                      />
                    </div>
                    <h3 className="text-stat-sm font-medium text-default-700 mb-2">
                      No purchases recorded
                    </h3>
                    <p className="text-default-500 mb-4">
                      Start by recording your first medicine purchase.
                    </p>
                    <Button color="primary" onPress={purchaseModalState.open}>
                      Record Purchase
                    </Button>
                  </div>
                ) : paginatedPurchases.length === 0 &&
                  filteredPurchases.length > 0 ? (
                  <div className="text-center py-12">
                    <div className="text-default-400 mb-4">
                      <IoSearchOutline
                        className="mx-auto opacity-50"
                        size={48}
                      />
                    </div>
                    <h3 className="text-stat-sm font-medium text-default-700 mb-2">
                      No purchases on this page
                    </h3>
                    <p className="text-default-500 mb-4">
                      Try navigating to a different page.
                    </p>
                  </div>
                ) : filteredPurchases.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-default-400 mb-4">
                      <IoDownloadOutline
                        className="mx-auto opacity-50"
                        size={48}
                      />
                    </div>
                    <h3 className="text-stat-sm font-medium text-default-700 mb-2">
                      No purchases found
                    </h3>
                    <p className="text-default-500 mb-4">
                      {searchQuery || activeFilter
                        ? "Try adjusting your search or filter criteria."
                        : "No purchases match the selected criteria."}
                    </p>
                    {(searchQuery || activeFilter) && (
                      <div className="flex gap-2 justify-center">
                        {searchQuery && (
                          <Button
                            color="default"
                            variant="flat"
                            onPress={() => setSearchQuery("")}
                          >
                            Clear Search
                          </Button>
                        )}
                        {activeFilter && (
                          <Button
                            color="default"
                            variant="flat"
                            onPress={() => setActiveFilter(null)}
                          >
                            Clear Filter
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto border border-border-base rounded">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-surface-2 border-b border-border-base">
                            {[
                              "PURCHASE NO",
                              "NAME",
                              "COURSE",
                              "DATE",
                              "TOTAL",
                              "PAYMENT STATUS",
                              "NET AMOUNT",
                              "ACTION",
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
                        <tbody className="divide-y divide-border-base bg-surface">
                          {paginatedPurchases.map((purchase) => {
                            const courseMeta =
                              getMedicationCourseMeta(purchase);
                            const statusLabel =
                              getMedicationStatusLabel(courseMeta);
                            const rowClassName = courseMeta.isExpired
                              ? "bg-red-500/5 hover:bg-red-500/10 transition-colors"
                              : courseMeta.isEndingSoon
                                ? "bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors"
                                : "hover:bg-surface-2 transition-colors";
                            const statusColorClass = courseMeta.isExpired
                              ? "text-red-500"
                              : courseMeta.isEndingSoon
                                ? "text-yellow-600"
                                : "text-text-muted";

                            const totalReturnedAmount =
                              typeof purchase.totalReturnedAmount ===
                                "number" && purchase.totalReturnedAmount > 0
                                ? purchase.totalReturnedAmount
                                : (purchase.returns ?? []).reduce(
                                    (sum, r) =>
                                      sum + Math.abs(r.totalAmount || 0),
                                    0,
                                  );
                            const netAfterReturns = Math.max(
                              0,
                              (purchase.netAmount || 0) - totalReturnedAmount,
                            );

                            return (
                              <tr key={purchase.id} className={rowClassName}>
                                <td className="px-3 py-2.5 text-[12.5px] font-mono text-text-main">
                                  {purchase.purchaseNo}
                                </td>
                                <td className="px-3 py-2.5 text-[12.5px] text-text-main">
                                  {purchase.patientName || "-"}
                                </td>
                                <td className="px-3 py-2.5 text-[12.5px]">
                                  {courseMeta.hasDuration ? (
                                    <div className="flex flex-col leading-tight">
                                      <span className="font-medium text-text-main">
                                        {courseMeta.totalDuration} day
                                        {courseMeta.totalDuration === 1
                                          ? ""
                                          : "s"}
                                      </span>
                                      <span
                                        className={`text-[10px] ${statusColorClass}`}
                                      >
                                        {statusLabel || "Tracking"}
                                      </span>
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-[12.5px] text-text-muted">
                                  {purchase.purchaseDate
                                    ? purchase.purchaseDate.toLocaleDateString()
                                    : "-"}
                                </td>
                                <td className="px-3 py-2.5 text-[12.5px] font-semibold text-text-main">
                                  {purchase.total
                                    ? `NPR ${purchase.total.toLocaleString()}`
                                    : "NPR 0"}
                                </td>
                                <td className="px-3 py-2.5">
                                  <StatusBadge
                                    status={purchase.paymentStatus}
                                    type="payment"
                                  />
                                </td>
                                <td className="px-3 py-2.5 text-[12.5px]">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-text-main">
                                      {purchase.netAmount
                                        ? `NPR ${purchase.netAmount.toLocaleString()}`
                                        : "NPR 0"}
                                    </span>
                                    {totalReturnedAmount > 0 && (
                                      <span className="text-[10.5px] text-yellow-600">
                                        Ret: NPR{" "}
                                        {totalReturnedAmount.toLocaleString()}
                                      </span>
                                    )}
                                    {totalReturnedAmount > 0 && (
                                      <span className="text-[10.5px] text-primary">
                                        Net: NPR{" "}
                                        {netAfterReturns.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded"
                                      title="View"
                                      onClick={() =>
                                        navigate(
                                          `/dashboard/pharmacy/purchase/${purchase.id}`,
                                        )
                                      }
                                    >
                                      <IoEyeOutline />
                                    </button>
                                    <button
                                      className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded"
                                      title="Edit"
                                      onClick={() =>
                                        navigate(
                                          `/dashboard/pharmacy/purchase-edit/${purchase.id}`,
                                        )
                                      }
                                    >
                                      <IoCreateOutline />
                                    </button>
                                    <button
                                      className="p-1.5 text-text-muted hover:text-yellow-600 hover:bg-yellow-500/10 rounded disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-muted"
                                      disabled={netAfterReturns <= 0}
                                      title="Record Return"
                                      onClick={() =>
                                        navigate(
                                          `/dashboard/pharmacy/purchase/${purchase.id}/return`,
                                        )
                                      }
                                    >
                                      <IoReloadOutline />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {purchasesTotalPages > 1 && (
                      <div className="flex items-center justify-between text-[12.5px] text-text-muted mt-3">
                        <span>
                          Showing{" "}
                          {(purchasesPage - 1) * purchasesRowsPerPage + 1} to{" "}
                          {Math.min(
                            purchasesPage * purchasesRowsPerPage,
                            filteredPurchases.length,
                          )}{" "}
                          of {filteredPurchases.length}
                        </span>
                        <div className="flex gap-1">
                          <button
                            className="px-2 py-1 border border-border-base rounded hover:bg-surface-2 disabled:opacity-50 text-text-main"
                            disabled={purchasesPage === 1}
                            onClick={() => setPurchasesPage((p) => p - 1)}
                          >
                            Prev
                          </button>
                          <button
                            className="px-2 py-1 border border-border-base rounded hover:bg-surface-2 disabled:opacity-50 text-text-main"
                            disabled={purchasesPage === purchasesTotalPages}
                            onClick={() => setPurchasesPage((p) => p + 1)}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Items Tab */}
            {activeTab === "items" && (
              <div className="py-6">
                {items.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-default-400 mb-4">
                      <IoStorefrontOutline
                        className="mx-auto opacity-50"
                        size={48}
                      />
                    </div>
                    <h3 className="text-stat-sm font-medium text-default-700 mb-2">
                      No items added
                    </h3>
                    <p className="text-default-500 mb-4">
                      Add items to your inventory to include them in purchases.
                    </p>
                    <Button
                      color="primary"
                      startContent={<IoAddOutline />}
                      onPress={addItemModalState.open}
                    >
                      Add Your First Item
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border-base rounded">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-surface-2 border-b border-border-base">
                          {[
                            "ITEM NAME",
                            "DESCRIPTION",
                            "CATEGORY",
                            "PURCHASE PRICE",
                            "SALE PRICE",
                            "ACTION",
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
                      <tbody className="divide-y divide-border-base bg-surface">
                        {items.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-surface-2 transition-colors"
                          >
                            <td className="px-3 py-2.5 text-[12.5px] font-medium text-text-main">
                              {item.name}
                            </td>
                            <td className="px-3 py-2.5 text-[12.5px] text-text-main">
                              {item.description || "-"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-primary/10 text-primary border border-primary/20">
                                {item.category}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[12.5px] text-text-main">
                              {item.purchasePrice
                                ? `NPR ${item.purchasePrice.toLocaleString()}`
                                : "-"}
                            </td>
                            <td className="px-3 py-2.5 text-[12.5px] font-semibold text-text-main">
                              {item.salePrice
                                ? `NPR ${item.salePrice.toLocaleString()}`
                                : "-"}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <button
                                  className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded"
                                  title="Edit"
                                >
                                  <IoCreateOutline />
                                </button>
                                <button
                                  className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-500/10 rounded"
                                  title="Delete"
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
                )}
              </div>
            )}

            {/* Supplier Ledger Tab */}
            {activeTab === "supplier_ledger" && (
              <div className="py-6 space-y-6">
                {!selectedSupplierForTransactions && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-surface border border-border-base rounded p-4 flex flex-col items-center">
                      <IoStorefrontOutline className="text-primary w-5 h-5 mb-2" />
                      <p className="text-stat-sm font-bold text-text-main">
                        NPR{" "}
                        {supplierLedgerStats.totalPurchase.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Total Purchase Amount
                      </p>
                    </div>

                    <div className="bg-surface border border-border-base rounded p-4 flex flex-col items-center">
                      <IoCheckmarkCircleOutline className="text-primary w-5 h-5 mb-2" />
                      <p className="text-stat-sm font-bold text-text-main">
                        NPR{" "}
                        {supplierLedgerStats.totalPaid.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Total Paid Amount
                      </p>
                    </div>

                    <div className="bg-surface border border-red-500/20 rounded p-4 flex flex-col items-center">
                      <IoCloseCircleOutline className="text-red-500 w-5 h-5 mb-2" />
                      <p className="text-stat-sm font-bold text-red-600">
                        NPR{" "}
                        {supplierLedgerStats.remaining.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )}
                      </p>
                      <p className="text-[11px] text-red-500 mt-0.5">
                        Remaining Amount
                      </p>
                    </div>
                  </div>
                )}
                {!selectedSupplierForTransactions ? (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1 max-w-sm">
                        <div
                          className={`flex items-center h-[38px] border border-border-base rounded focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-surface`}
                        >
                          <IoSearchOutline className="ml-2.5 w-4 h-4 text-text-muted shrink-0" />
                          <input
                            className="flex-1 text-[13.5px] px-2 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/40 w-full"
                            placeholder="Search suppliers..."
                            value={supplierSearchQuery}
                            onChange={(e) =>
                              setSupplierSearchQuery(e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <p className="text-[12.5px] text-text-muted pt-2">
                        Select a supplier to view their transaction ledger.
                      </p>
                    </div>

                    <div className="border border-border-base rounded overflow-hidden">
                      {filteredSupplierSummaries.length === 0 ? (
                        <div className="text-center py-12 px-4 bg-surface">
                          <IoPeopleOutline
                            className="mx-auto text-text-muted/40 mb-4"
                            size={48}
                          />
                          <h3 className="text-[14px] font-semibold text-text-main mb-1">
                            No supplier data found
                          </h3>
                          <p className="text-[12.5px] text-text-muted/60">
                            Add suppliers and purchase records to start tracking
                            ledger balances.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                              <tr className="bg-surface-2 border-b border-border-base">
                                {["SUPPLIER", "CURRENT BALANCE", "ACTIONS"].map(
                                  (h) => (
                                    <th
                                      key={h}
                                      className="px-3 py-2 text-[10.5px] font-semibold text-text-muted uppercase tracking-wider"
                                    >
                                      {h}
                                    </th>
                                  ),
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-base bg-surface">
                              {filteredSupplierSummaries.map((summary) => {
                                const currentBalance = summary.remaining;

                                return (
                                  <tr
                                    key={summary.supplier.id}
                                    className="hover:bg-surface-2 transition-colors"
                                  >
                                    <td className="px-3 py-2.5">
                                      <div className="flex flex-col">
                                        <span className="text-[12.5px] font-medium text-text-main">
                                          {summary.supplier.name}
                                        </span>
                                        {summary.supplier.contactPerson && (
                                          <span className="text-[10.5px] text-text-muted">
                                            {summary.supplier.contactPerson}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span
                                        className={`text-[12.5px] ${currentBalance > 0 ? "text-red-600 font-semibold" : currentBalance < 0 ? "text-primary font-semibold" : "text-text-muted font-medium"}`}
                                      >
                                        NPR{" "}
                                        {currentBalance.toLocaleString(
                                          undefined,
                                          { maximumFractionDigits: 2 },
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <button
                                        className="text-[12px] font-medium px-3 py-1 bg-surface border border-border-base text-text-main rounded hover:bg-surface-2 hover:text-text-main transition-colors"
                                        type="button"
                                        onClick={() =>
                                          handleSelectSupplierForLedger(
                                            summary.supplier,
                                          )
                                        }
                                      >
                                        View Ledger
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-border-base pb-4">
                      <div className="flex items-center gap-4">
                        <button
                          className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-2 rounded transition-colors"
                          type="button"
                          onClick={() => {
                            setSelectedSupplierForTransactions(null);
                            setSupplierLedgerEntries([]);
                          }}
                        >
                          <IoArrowBackOutline className="w-5 h-5" />
                        </button>
                        <div>
                          <h3 className="text-[18px] font-semibold text-text-main">
                            {selectedSupplierForTransactions.name}
                          </h3>
                          {selectedSupplierForTransactions.contactPerson && (
                            <p className="text-sm text-text-muted">
                              {selectedSupplierForTransactions.contactPerson}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          color="default"
                          startContent={<IoReceiptOutline />}
                          variant="flat"
                          onPress={() => {
                            setPurchaseEntryForm({
                              billNumber: "",
                              purchaseDate: new Date()
                                .toISOString()
                                .split("T")[0],
                              debitAmount: "",
                              notes: "",
                            });
                            addPurchaseEntryModalState.open();
                          }}
                        >
                          Add Purchase
                        </Button>
                        <Button
                          color="primary"
                          startContent={<IoWalletOutline />}
                          onPress={() =>
                            handleOpenSupplierPaymentModal(
                              selectedSupplierForTransactions,
                            )
                          }
                        >
                          Add Payment
                        </Button>
                        {supplierLedgerEntries.length > 0 && (
                          <Button
                            color="default"
                            startContent={<IoPrintOutline />}
                            variant="flat"
                            onPress={() => handlePrintLedger()}
                          >
                            Print Ledger
                          </Button>
                        )}
                      </div>
                    </div>

                    {supplierLedgerEntries.length > 0 && (
                      <Card className="border border-border-base bg-surface shadow-none">
                        <CardBody>
                          <div className="mb-4">
                            <p className="text-sm text-text-muted">
                              Current Balance
                            </p>
                            <p
                              className={`text-stat-sm font-semibold mt-1 ${
                                supplierLedgerEntries[
                                  supplierLedgerEntries.length - 1
                                ].balanceAmount > 0
                                  ? "text-red-500"
                                  : supplierLedgerEntries[
                                        supplierLedgerEntries.length - 1
                                      ].balanceAmount < 0
                                    ? "text-primary"
                                    : "text-text-main"
                              }`}
                            >
                              NPR{" "}
                              {supplierLedgerEntries[
                                supplierLedgerEntries.length - 1
                              ].balanceAmount.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </CardBody>
                      </Card>
                    )}

                    <Card className="border border-border-base bg-surface shadow-none">
                      <CardBody className="p-0">
                        {supplierLedgerEntries.length === 0 ? (
                          <div className="text-center py-12 px-4">
                            <IoReceiptOutline
                              className="mx-auto text-text-muted/40 mb-4"
                              size={48}
                            />
                            <h3 className="text-stat-sm font-medium text-text-main mb-1">
                              No ledger entries
                            </h3>
                            <p className="text-text-muted">
                              No transactions recorded for this supplier yet.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                              <thead>
                                <tr className="bg-surface-2 border-b border-border-base">
                                  {[
                                    "BILL NUMBER",
                                    "DATE",
                                    "DEBIT AMOUNT",
                                    "CREDIT AMOUNT",
                                    "BALANCE",
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
                              <tbody className="divide-y divide-border-base bg-surface">
                                {supplierLedgerEntries.map((entry) => (
                                  <tr
                                    key={entry.id}
                                    className="hover:bg-surface-2 transition-colors"
                                  >
                                    <td className="px-3 py-2.5">
                                      <div className="text-[12.5px] text-text-main">
                                        {entry.billNumber || (
                                          <span className="text-text-muted/40 italic">
                                            Payment
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-[12.5px] text-text-main">
                                      {entry.transactionDate.toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2.5 text-[12.5px]">
                                      {entry.debitAmount > 0 ? (
                                        <span className="text-red-500 font-medium">
                                          NPR{" "}
                                          {entry.debitAmount.toLocaleString(
                                            undefined,
                                            { maximumFractionDigits: 2 },
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-text-muted/40">
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-[12.5px]">
                                      {entry.creditAmount > 0 ? (
                                        <span className="text-primary font-medium">
                                          NPR{" "}
                                          {entry.creditAmount.toLocaleString(
                                            undefined,
                                            { maximumFractionDigits: 2 },
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-text-muted/40">
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-[12.5px]">
                                      <span
                                        className={`font-semibold ${
                                          entry.balanceAmount > 0
                                            ? "text-red-500"
                                            : entry.balanceAmount < 0
                                              ? "text-primary"
                                              : "text-text-muted"
                                        }`}
                                      >
                                        NPR{" "}
                                        {entry.balanceAmount.toLocaleString(
                                          undefined,
                                          { maximumFractionDigits: 2 },
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <button
                                        className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded"
                                        title="Edit Entry"
                                        type="button"
                                        onClick={() => {
                                          setEditingLedgerEntry(entry);
                                          setEditLedgerEntryForm({
                                            billNumber: entry.billNumber || "",
                                            transactionDate: toISODateString(
                                              entry.transactionDate,
                                            ),
                                            debitAmount:
                                              entry.debitAmount > 0
                                                ? entry.debitAmount.toString()
                                                : "",
                                            creditAmount:
                                              entry.creditAmount > 0
                                                ? entry.creditAmount.toString()
                                                : "",
                                            notes: entry.notes || "",
                                            referenceNumber:
                                              entry.referenceNumber || "",
                                          });
                                          editLedgerEntryModalState.open();
                                        }}
                                      >
                                        <IoCreateOutline size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Prescriptions Tab */}
            {activeTab === "prescriptions" && (
              <div className="py-2">
                <div className="flex justify-between items-center mb-6 bg-primary/[0.03] p-4 rounded-lg border border-primary/10">
                  <div>
                    <h3 className="text-[15px] font-bold text-primary">
                      Prescriptions from Doctors
                    </h3>
                    <p className="text-[12px] text-text-muted">
                      Review and fulfill prescriptions sent directly from
                      clinical consultations.
                    </p>
                  </div>
                  <Button
                    color="primary"
                    size="sm"
                    variant="flat"
                    onClick={() => {
                      const loadRx = async () => {
                        setIsLoadingPrescriptions(true);
                        try {
                          const data =
                            await prescriptionService.getPrescriptionsByClinic(
                              clinicId!,
                            );

                          setPrescriptions(
                            data.filter(
                              (rx) =>
                                rx.sendToPharmacy && rx.status !== "completed",
                            ),
                          );
                        } finally {
                          setIsLoadingPrescriptions(false);
                        }
                      };

                      loadRx();
                    }}
                  >
                    <IoReloadOutline className="mr-2" /> Refresh
                  </Button>
                </div>

                <div className="border border-border-base rounded-xl overflow-hidden bg-surface">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2/80 border-b border-border-base">
                        <th className="px-4 py-3 text-[11px] font-bold text-primary tracking-wider">
                          Patient
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-primary tracking-wider">
                          Prescription #
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-primary tracking-wider">
                          Diagnosis
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-primary tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-primary tracking-wider text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base">
                      {isLoadingPrescriptions ? (
                        <tr>
                          <td className="px-4 py-12 text-center" colSpan={5}>
                            <Spinner
                              label="Loading prescriptions..."
                              size="sm"
                            />
                          </td>
                        </tr>
                      ) : prescriptions.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-12 text-center text-text-muted italic text-[13px]"
                            colSpan={5}
                          >
                            No pending prescriptions from doctors.
                          </td>
                        </tr>
                      ) : (
                        prescriptions.map((rx) => (
                          <tr
                            key={rx.id}
                            className="hover:bg-primary/[0.02] transition-colors group"
                          >
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-[13.5px] text-text-main group-hover:text-primary transition-colors">
                                {patients.find((p) => p.id === rx.patientId)
                                  ?.name ||
                                  "Patient " +
                                    (rx.patientId?.substring(0, 5) ||
                                      "Unknown")}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-[12px] text-primary font-bold">
                                #{rx.prescriptionNo}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {rx.diagnosis ? (
                                <span
                                  className="inline-flex items-center px-2 py-1 rounded-md text-[11.5px] font-medium bg-primary/10 text-primary border border-primary/20 max-w-[200px] truncate"
                                  title={rx.diagnosis}
                                >
                                  {rx.diagnosis}
                                </span>
                              ) : (
                                <span className="text-[12px] text-text-muted italic opacity-60">
                                  None
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-[12px] text-text-muted">
                              {rx.createdAt
                                ? format(
                                    new Date(rx.createdAt),
                                    "MMM d, yyyy h:mm a",
                                  )
                                : "N/A"}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <Button
                                className="h-8 text-[11.5px] font-bold shadow-sm shadow-primary/20"
                                color="primary"
                                size="sm"
                                variant="solid"
                                onPress={async () => {
                                  // Fetch items before fulfilling
                                  setIsLoadingPrescriptions(true);
                                  try {
                                    const itemsData =
                                      await prescriptionService.getPrescriptionItems(
                                        rx.id,
                                      );

                                    if (!itemsData || itemsData.length === 0) {
                                      addToast({
                                        title: "No Items",
                                        description:
                                          "This prescription has no items to fulfill.",
                                        color: "warning",
                                      });

                                      return;
                                    }

                                    const patientObj = patients.find(
                                      (p) => p.id === rx.patientId,
                                    );

                                    const mappedItems: PurchaseItem[] =
                                      itemsData.map((item: any) => {
                                        const med = medicines.find(
                                          (m) => m.id === item.medicineId,
                                        );

                                        // Smart default suggested quantity calculation
                                        const freqVal = item.frequency || "";
                                        const durationVal = item.duration || "";

                                        const multiplier = ((): number => {
                                          const f = freqVal
                                            .toLowerCase()
                                            .trim();

                                          if (
                                            f.includes("once daily") ||
                                            f === "od" ||
                                            f === "qd" ||
                                            f === "q.d." ||
                                            f === "1-0-0" ||
                                            f === "0-1-0" ||
                                            f === "0-0-1"
                                          )
                                            return 1;
                                          if (
                                            f.includes("twice daily") ||
                                            f === "bd" ||
                                            f === "bid" ||
                                            f === "b.i.d." ||
                                            f === "1-0-1" ||
                                            f === "2-0-2"
                                          )
                                            return 2;
                                          if (
                                            f.includes("three times daily") ||
                                            f === "tds" ||
                                            f === "tid" ||
                                            f === "t.i.d." ||
                                            f === "1-1-1"
                                          )
                                            return 3;
                                          if (
                                            f.includes("four times daily") ||
                                            f === "qid" ||
                                            f === "q.i.d."
                                          )
                                            return 4;
                                          if (
                                            f.includes("as needed") ||
                                            f === "sos" ||
                                            f === "prn"
                                          )
                                            return 1;

                                          const numMatch = f.match(
                                            /(\d+)\s*(times|tabs|caps|doses|day)/,
                                          );

                                          if (numMatch)
                                            return parseInt(numMatch[1], 10);

                                          return 1;
                                        })();

                                        const days = ((): number => {
                                          const d = durationVal
                                            .toLowerCase()
                                            .trim();
                                          const match = d.match(/(\d+)/);

                                          if (!match) return 1;
                                          let val = parseInt(match[1], 10);

                                          if (d.includes("week")) val *= 7;
                                          else if (d.includes("month"))
                                            val *= 30;

                                          return val;
                                        })();

                                        const calculatedQty = days * multiplier;

                                        return {
                                          id: crypto.randomUUID(),
                                          type: "medicine" as const,
                                          productId: item.medicineId,
                                          productName: item.medicineName,
                                          expiryDate:
                                            item.expiryDate ||
                                            (med
                                              ? toISODateString(med.expiryDate)
                                              : ""),
                                          salePrice: med?.price || 0,
                                          regularSalePrice: med?.price || 0,
                                          schemeSalePrice: med?.price || 0,
                                          quantity: calculatedQty,
                                          amount:
                                            calculatedQty * (med?.price || 0),
                                          stockType: "regular" as const,
                                        };
                                      });

                                    // Extract max duration from items for the overall course duration
                                    const maxDurationDays = itemsData.reduce(
                                      (max, item) => {
                                        const durationStr = item.duration || "";
                                        const match =
                                          durationStr.match(/(\d+)/);

                                        if (!match) return max;

                                        let days = parseInt(match[1], 10);

                                        if (
                                          durationStr
                                            .toLowerCase()
                                            .includes("week")
                                        )
                                          days *= 7;
                                        else if (
                                          durationStr
                                            .toLowerCase()
                                            .includes("month")
                                        )
                                          days *= 30;

                                        return Math.max(max, days);
                                      },
                                      0,
                                    );

                                    // Fetch stock for all mapped items to pass validation
                                    const newStocks: Record<
                                      string,
                                      number | null
                                    > = {};
                                    const newSchemeStocks: Record<
                                      string,
                                      number | null
                                    > = {};
                                    const newBatches: Record<
                                      string,
                                      MedicineStock[]
                                    > = {};

                                    if (clinicId) {
                                      await Promise.all(
                                        mappedItems.map(async (item) => {
                                          if (item.productId) {
                                            const stock =
                                              await medicineService.getMedicineStock(
                                                item.productId,
                                                clinicId,
                                              );

                                            newStocks[item.id] =
                                              stock?.currentStock ?? null;
                                            newSchemeStocks[item.id] =
                                              stock?.schemeStock ?? null;
                                            const stocks =
                                              await medicineService.getMedicineStocks(
                                                item.productId,
                                                clinicId,
                                              );

                                            newBatches[item.id] = stocks;
                                            item.amount = calculateFEFOAmount(
                                              item,
                                              stocks,
                                            );
                                          }
                                        }),
                                      );
                                    }

                                    setPurchaseItemStocks((prev) => ({
                                      ...prev,
                                      ...newStocks,
                                    }));
                                    setPurchaseItemSchemeStocks((prev) => ({
                                      ...prev,
                                      ...newSchemeStocks,
                                    }));
                                    setPurchaseItemBatches((prev) => ({
                                      ...prev,
                                      ...newBatches,
                                    }));

                                    setPurchaseItems(mappedItems);
                                    setPurchaseForm((prev) => ({
                                      ...prev,
                                      patientId: rx.patientId,
                                      customerType: "patient",
                                      patientName: patientObj?.name || "",
                                      prescriptionId: rx.id,
                                      medicationDurationDays: maxDurationDays,
                                      total: mappedItems.reduce(
                                        (sum: number, i: any) => sum + i.amount,
                                        0,
                                      ),
                                      netAmount: mappedItems.reduce(
                                        (sum: number, i: any) => sum + i.amount,
                                        0,
                                      ),
                                    }));
                                    purchaseModalState.open();
                                  } catch (error) {
                                    console.error(
                                      "Error fetching items:",
                                      error,
                                    );
                                    addToast({
                                      title: "Error",
                                      description:
                                        "Failed to load prescription items.",
                                      color: "danger",
                                    });
                                  } finally {
                                    setIsLoadingPrescriptions(false);
                                  }
                                }}
                              >
                                <IoReceiptOutline className="mr-1.5" /> Fulfill
                                Sale
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === "inventory" && (
              <div className="py-6 space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border border-default-200">
                    <CardBody className="p-4 flex flex-row items-center gap-4">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary">
                        <IoMedicalOutline size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-default-400 font-medium uppercase tracking-wider">
                          Total SKU Medicines
                        </p>
                        <h4 className="text-xl font-bold mt-0.5">
                          {medicines.length}
                        </h4>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="border border-default-200">
                    <CardBody className="p-4 flex flex-row items-center gap-4 border-l-4 border-l-amber-500">
                      <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                        <IoWarningOutline size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-default-400 font-medium uppercase tracking-wider">
                          Low Stock Medicines
                        </p>
                        <h4 className="text-xl font-bold mt-0.5 text-amber-500">
                          {
                            medicines.filter((m) => {
                              const stock = medicineStocks[m.id] || 0;

                              return stock > 0 && stock <= 10;
                            }).length
                          }
                        </h4>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="border border-default-200">
                    <CardBody className="p-4 flex flex-row items-center gap-4 border-l-4 border-l-red-500">
                      <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                        <IoCloseCircleOutline size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-default-400 font-medium uppercase tracking-wider">
                          Out of Stock
                        </p>
                        <h4 className="text-xl font-bold mt-0.5 text-red-500">
                          {
                            medicines.filter(
                              (m) => (medicineStocks[m.id] || 0) === 0,
                            ).length
                          }
                        </h4>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="border border-default-200">
                    <CardBody className="p-4 flex flex-row items-center gap-4 border-l-4 border-l-rose-600">
                      <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600">
                        <IoTimeOutline size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-default-400 font-medium uppercase tracking-wider">
                          Expired / Near Expiry
                        </p>
                        <h4 className="text-xl font-bold mt-0.5 text-rose-600">
                          {
                            medicines.filter((m) => {
                              if (!m.expiryDate) return false;
                              const d = differenceInCalendarDays(
                                m.expiryDate,
                                new Date(),
                              );

                              return d <= 90;
                            }).length
                          }
                        </h4>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-default-50/50 p-4 border border-default-200 rounded-xl">
                  <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
                    <Input
                      className="w-full sm:max-w-xs"
                      placeholder="Search name or generic..."
                      startContent={
                        <IoSearchOutline className="text-default-400" />
                      }
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                    />

                    <select
                      className="h-10 px-3 border border-default-200 rounded-xl text-xs bg-surface text-default-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      value={inventoryStockFilter}
                      onChange={(e: any) =>
                        setInventoryStockFilter(e.target.value)
                      }
                    >
                      <option value="all">All Stocks Status</option>
                      <option value="out">Out of Stock</option>
                      <option value="low">Low Stock (≤10)</option>
                      <option value="good">Good Stock (&gt;10)</option>
                    </select>

                    <select
                      className="h-10 px-3 border border-default-200 rounded-xl text-xs bg-surface text-default-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      value={inventoryExpiryFilter}
                      onChange={(e: any) =>
                        setInventoryExpiryFilter(e.target.value)
                      }
                    >
                      <option value="all">All Expiries</option>
                      <option value="expired">Expired Only</option>
                      <option value="soon">Expiring Soon (≤90d)</option>
                      <option value="valid">Valid Stocks</option>
                    </select>
                  </div>

                  <p className="text-xs text-default-400 font-medium">
                    Found {filteredInventoryMedicines.length} medicines
                  </p>
                </div>

                {/* Grid Table */}
                <Card className="border border-default-200 shadow-none">
                  <CardBody className="p-0">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full border-collapse text-left text-xs text-default-700">
                        <thead className="bg-default-50 border-b border-default-200">
                          <tr>
                            <th className="px-5 py-4 font-semibold text-default-600">
                              Medicine Name & Compound
                            </th>
                            <th className="px-5 py-4 font-semibold text-default-600">
                              Category
                            </th>
                            <th className="px-5 py-4 font-semibold text-default-600 text-center">
                              Regular Pool
                            </th>
                            <th className="px-5 py-4 font-semibold text-default-600 text-center">
                              Scheme Pool
                            </th>
                            <th className="px-5 py-4 font-semibold text-default-600 text-center">
                              Total Stock
                            </th>
                            <th className="px-5 py-4 font-semibold text-default-600">
                              Expiry Status
                            </th>
                            <th className="px-5 py-4 font-semibold text-default-600">
                              Unit Price
                            </th>
                            <th className="px-5 py-4 font-semibold text-default-600 text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-default-200">
                          {filteredInventoryMedicines.length === 0 ? (
                            <tr>
                              <td
                                className="text-center py-12 px-4"
                                colSpan={8}
                              >
                                <IoMedicalOutline
                                  className="mx-auto text-default-300 mb-4"
                                  size={48}
                                />
                                <h3 className="text-stat-sm font-medium text-default-700 mb-1">
                                  No matches found
                                </h3>
                                <p className="text-default-500">
                                  Try adjusting your filters or search query.
                                </p>
                              </td>
                            </tr>
                          ) : (
                            filteredInventoryMedicines.map((m) => {
                              const stockObj = rawStocks.find(
                                (s) => s.medicineId === m.id,
                              );
                              const regular = stockObj?.currentStock ?? 0;
                              const scheme = stockObj?.schemeStock ?? 0;
                              const total = medicineStocks[m.id] || 0;
                              const exp = getExpiryStatus(m.expiryDate);

                              return (
                                <tr
                                  key={m.id}
                                  className="hover:bg-default-50/50 transition-colors"
                                >
                                  <td className="px-5 py-4">
                                    <div>
                                      <p className="font-semibold text-sm text-default-800">
                                        {m.name}
                                      </p>
                                      {m.genericName && (
                                        <p className="text-xs text-default-400 font-medium mt-0.5 italic">
                                          {m.genericName}
                                        </p>
                                      )}
                                      {m.manufacturer && (
                                        <span className="text-[10px] bg-default-100 text-default-600 font-semibold px-1.5 py-0.5 rounded mt-1 inline-block">
                                          {m.manufacturer}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4">
                                    <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-1 rounded-xl capitalize">
                                      {m.type || "General"}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 text-center font-semibold">
                                    <span
                                      className={`${
                                        regular === 0
                                          ? "text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-xl text-[10px]"
                                          : regular <= 10
                                            ? "text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-xl text-[10px]"
                                            : "text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-xl text-[10px]"
                                      }`}
                                    >
                                      {regular}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 text-center font-semibold">
                                    <span
                                      className={`${
                                        scheme === 0
                                          ? "text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-xl text-[10px]"
                                          : scheme <= 10
                                            ? "text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-xl text-[10px]"
                                            : "text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-xl text-[10px]"
                                      }`}
                                    >
                                      {scheme}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 text-center font-bold">
                                    <span
                                      className={`${
                                        total === 0
                                          ? "text-red-600 text-sm"
                                          : total <= 10
                                            ? "text-amber-600 text-sm"
                                            : "text-default-800 text-sm"
                                      }`}
                                    >
                                      {total}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4">
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-1 rounded-xl border ${exp.color}`}
                                    >
                                      {exp.label}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 font-semibold text-default-800">
                                    NPR {m.price?.toFixed(2) || "0.00"}
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        className="h-7 min-w-[70px] rounded-xl text-[10.5px] font-semibold"
                                        color="warning"
                                        size="sm"
                                        variant="flat"
                                        onPress={() => {
                                          const stockObj = rawStocks.find(
                                            (s) => s.medicineId === m.id,
                                          );

                                          setAdjustForm({
                                            regularStock:
                                              stockObj?.currentStock ?? 0,
                                            schemeStock:
                                              stockObj?.schemeStock ?? 0,
                                            reason: "",
                                          });
                                          setSelectedMedicineForAdjust(m);
                                          setAdjustStockModalOpen(true);
                                        }}
                                      >
                                        <IoCreateOutline className="mr-1" />{" "}
                                        Adjust
                                      </Button>
                                      <Button
                                        className="h-7 min-w-[70px] rounded-xl text-[10.5px] font-semibold"
                                        color="primary"
                                        size="sm"
                                        variant="flat"
                                        onPress={() => {
                                          setSelectedMedicineForStockBook(m);
                                          setActiveTab("stock_book");
                                        }}
                                      >
                                        <IoBookOutline className="mr-1" />{" "}
                                        History
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="py-6">
                <div className="w-full space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-stat-sm font-semibold text-primary">
                        Pharmacy Settings
                      </h3>
                      <p className="text-default-500 mt-1">
                        Configure tax percentage and payment methods
                      </p>
                    </div>
                    <Button
                      color="primary"
                      isDisabled={isSettingsLoading}
                      isLoading={isSettingsLoading}
                      startContent={<IoSaveOutline />}
                      onPress={handleSaveSettings}
                    >
                      {isSettingsLoading ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>

                  {/* Tax Configuration */}
                  <Card>
                    <CardHeader className="bg-default-50 border-b border-default-200">
                      <h4 className="text-stat-sm font-semibold text-primary">
                        Tax Configuration
                      </h4>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Enable Tax</p>
                          <p className="text-sm text-default-500">
                            Apply tax to medicine purchases
                          </p>
                        </div>
                        <Switch
                          isSelected={settingsForm.enableTax}
                          onValueChange={(value) =>
                            setSettingsForm((prev) => ({
                              ...prev,
                              enableTax: value,
                            }))
                          }
                        />
                      </div>

                      {settingsForm.enableTax && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input
                            description="Default tax percentage for new purchases"
                            endContent="%"
                            label="Default Tax Percentage"
                            placeholder="13"
                            type="number"
                            value={
                              settingsForm.defaultTaxPercentage?.toString() ||
                              "0"
                            }
                            onChange={(e) =>
                              setSettingsForm((prev) => ({
                                ...prev,
                                defaultTaxPercentage:
                                  parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                          <Input
                            description="Display label for tax (e.g., VAT, GST, Tax)"
                            label="Tax Label"
                            placeholder="VAT"
                            value={settingsForm.taxLabel || ""}
                            onChange={(e) =>
                              setSettingsForm((prev) => ({
                                ...prev,
                                taxLabel: e.target.value,
                              }))
                            }
                          />
                        </div>
                      )}
                    </CardBody>
                  </Card>

                  {/* Payment Methods Configuration */}
                  <Card>
                    <CardHeader className="bg-default-50 border-b border-default-200">
                      <div className="flex justify-between items-center w-full">
                        <div>
                          <h4 className="text-stat-sm font-semibold text-primary">
                            Payment Methods
                          </h4>
                          <p className="text-sm text-default-500">
                            Manage available payment methods for purchases
                          </p>
                        </div>
                        <Button
                          color="primary"
                          startContent={<IoAddOutline />}
                          variant="flat"
                          onPress={addPaymentMethodModalState.open}
                        >
                          Add Payment Method
                        </Button>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      {settingsForm.enabledPaymentMethods?.map((method) => (
                        <Card
                          key={method.id}
                          className="border border-default-200"
                        >
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="text-stat">{method.icon}</div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-medium text-default-900">
                                      {method.name}
                                    </span>
                                    {method.isCustom && (
                                      <Chip
                                        color="primary"
                                        size="sm"
                                        variant="flat"
                                      >
                                        Custom
                                      </Chip>
                                    )}
                                    {method.requiresReference && (
                                      <Chip
                                        color="warning"
                                        size="sm"
                                        variant="flat"
                                      >
                                        Requires Reference
                                      </Chip>
                                    )}
                                  </div>
                                  {method.description && (
                                    <p className="text-sm text-default-500">
                                      {method.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    isSelected={method.isEnabled}
                                    onValueChange={(isEnabled) => {
                                      const updatedMethods =
                                        settingsForm.enabledPaymentMethods?.map(
                                          (pm) =>
                                            pm.id === method.id
                                              ? { ...pm, isEnabled }
                                              : pm,
                                        ) || [];

                                      setSettingsForm((prev) => ({
                                        ...prev,
                                        enabledPaymentMethods: updatedMethods,
                                      }));
                                    }}
                                  />
                                  <span className="text-sm text-default-700">
                                    Enabled
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <input
                                    checked={
                                      settingsForm.defaultPaymentMethod ===
                                      method.key
                                    }
                                    className="h-4 w-4 text-primary focus:ring-primary border-default-300"
                                    disabled={!method.isEnabled}
                                    name="defaultPaymentMethod"
                                    type="radio"
                                    value={method.key}
                                    onChange={(e) =>
                                      setSettingsForm((prev) => ({
                                        ...prev,
                                        defaultPaymentMethod: e.target.value,
                                      }))
                                    }
                                  />
                                  <span className="text-sm text-default-700">
                                    Default
                                  </span>
                                </div>

                                <div className="flex space-x-1">
                                  <Button
                                    isIconOnly
                                    color="default"
                                    size="sm"
                                    variant="light"
                                    onPress={() => handleOpenEditModal(method)}
                                  >
                                    <IoCreateOutline size={16} />
                                  </Button>

                                  {method.isCustom && (
                                    <Button
                                      isIconOnly
                                      color="danger"
                                      size="sm"
                                      variant="light"
                                      onPress={() =>
                                        handleDeletePaymentMethod(method.id)
                                      }
                                    >
                                      <IoTrashOutline size={16} />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      ))}

                      {(!settingsForm.enabledPaymentMethods ||
                        settingsForm.enabledPaymentMethods.length === 0) && (
                        <div className="text-center py-8">
                          <div className="text-default-400 mb-4">
                            <svg
                              className="mx-auto opacity-50"
                              fill="none"
                              height="48"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              width="48"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <rect
                                height="16"
                                rx="2"
                                ry="2"
                                width="22"
                                x="1"
                                y="4"
                              />
                              <line x1="1" x2="23" y1="10" y2="10" />
                            </svg>
                          </div>
                          <h3 className="text-stat-sm font-medium text-default-700 mb-2">
                            No payment methods configured
                          </h3>
                          <p className="text-default-500 mb-4">
                            Add payment methods to enable different payment
                            options for purchases.
                          </p>
                          <Button
                            color="primary"
                            startContent={<IoAddOutline />}
                            onPress={addPaymentMethodModalState.open}
                          >
                            Add Your First Payment Method
                          </Button>
                        </div>
                      )}
                    </CardBody>
                  </Card>

                  {/* Other Settings */}
                  <Card>
                    <CardHeader className="bg-default-50 border-b border-default-200">
                      <h4 className="text-stat-sm font-semibold text-primary">
                        Other Settings
                      </h4>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Enable Discount</p>
                          <p className="text-sm text-default-500">
                            Allow discounts on purchases
                          </p>
                        </div>
                        <Switch
                          isSelected={settingsForm.enableDiscount}
                          onValueChange={(value) =>
                            setSettingsForm((prev) => ({
                              ...prev,
                              enableDiscount: value,
                            }))
                          }
                        />
                      </div>

                      {settingsForm.enableDiscount && (
                        <Input
                          description="Default discount percentage for new purchases"
                          endContent="%"
                          label="Default Discount Percentage"
                          placeholder="0"
                          type="number"
                          value={
                            settingsForm.defaultDiscountPercentage?.toString() ||
                            "0"
                          }
                          onChange={(e) =>
                            setSettingsForm((prev) => ({
                              ...prev,
                              defaultDiscountPercentage:
                                parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          description="Prefix for purchase numbers"
                          label="Invoice Prefix"
                          placeholder="PUR"
                          value={settingsForm.invoicePrefix || ""}
                          onChange={(e) =>
                            setSettingsForm((prev) => ({
                              ...prev,
                              invoicePrefix: e.target.value,
                            }))
                          }
                        />
                        <Input
                          description="Next invoice number in sequence"
                          label="Next Invoice Number"
                          placeholder="1001"
                          type="number"
                          value={
                            settingsForm.nextInvoiceNumber?.toString() || "1001"
                          }
                          onChange={(e) =>
                            setSettingsForm((prev) => ({
                              ...prev,
                              nextInvoiceNumber:
                                parseInt(e.target.value) || 1001,
                            }))
                          }
                        />
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            )}

            {/* Stock Book Tab */}
            {activeTab === "stock_book" && (
              <div className="py-6 space-y-6">
                {!selectedMedicineForStockBook ? (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <Input
                        className="w-full sm:max-w-xs"
                        placeholder="Search medicines..."
                        startContent={
                          <IoSearchOutline className="text-default-400" />
                        }
                        value={stockBookSearchQuery}
                        onChange={(e) =>
                          setStockBookSearchQuery(e.target.value)
                        }
                      />
                      <p className="text-xs text-default-400">
                        Select a medicine to view its transaction history.
                      </p>
                    </div>

                    <Card className="border border-default-200">
                      <CardBody className="p-0">
                        {filteredMedicines.length === 0 ? (
                          <div className="text-center py-12 px-4">
                            <IoMedicalOutline
                              className="mx-auto text-default-300 mb-4"
                              size={48}
                            />
                            <h3 className="text-stat-sm font-medium text-default-700 mb-1">
                              {stockBookSearchQuery
                                ? "No medicines found"
                                : "No medicines available"}
                            </h3>
                            <p className="text-default-500">
                              {stockBookSearchQuery
                                ? "Try adjusting your search criteria."
                                : "Medicines will appear here once added to the system."}
                            </p>
                          </div>
                        ) : (
                          <Table aria-label="Medicines list">
                            <TableHeader>
                              <TableRow>
                                <TableColumn>MEDICINE NAME</TableColumn>
                                <TableColumn>GENERIC NAME</TableColumn>
                                <TableColumn>PRICE</TableColumn>
                                <TableColumn>ACTIONS</TableColumn>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredMedicines.map((medicine) => (
                                <TableRow key={medicine.id}>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {medicine.name}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-default-500">
                                      {medicine.genericName || "N/A"}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm">
                                      NPR{" "}
                                      {medicine.price?.toLocaleString() || "0"}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      color="primary"
                                      size="sm"
                                      variant="flat"
                                      onPress={() =>
                                        setSelectedMedicineForStockBook(
                                          medicine,
                                        )
                                      }
                                    >
                                      View Transactions
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardBody>
                    </Card>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Button
                          startContent={<IoArrowBackOutline />}
                          variant="light"
                          onPress={() => {
                            setSelectedMedicineForStockBook(null);
                            setStockTransactions([]);
                          }}
                        >
                          Back to Medicines
                        </Button>
                        <div>
                          <h3 className="text-stat-sm font-semibold">
                            {selectedMedicineForStockBook.name}
                          </h3>
                          {selectedMedicineForStockBook.genericName && (
                            <p className="text-sm text-default-500">
                              {selectedMedicineForStockBook.genericName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    {(() => {
                      const totalSold = selectedMedicinePurchaseDetails.reduce(
                        (sum, d) => sum + d.quantity,
                        0,
                      );
                      const totalPurchased = stockTransactions
                        .filter(
                          (t) =>
                            t.type === "purchase" || t.type === "adjustment",
                        )
                        .reduce((sum, t) => sum + t.quantity, 0);

                      const totalReturned = purchases.reduce((sum, p) => {
                        const returnQty = (p.returns || []).reduce(
                          (pSum, r) => {
                            return (
                              pSum +
                              r.items
                                .filter(
                                  (item) =>
                                    item.medicineId ===
                                    selectedMedicineForStockBook.id,
                                )
                                .reduce((iSum, item) => iSum + item.quantity, 0)
                            );
                          },
                          0,
                        );

                        return sum + returnQty;
                      }, 0);

                      const netQuantity =
                        totalPurchased - totalSold + totalReturned;

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card className="border border-default-200">
                            <CardBody>
                              <div className="mb-4">
                                <p className="text-sm text-default-500">
                                  Total Sold
                                </p>
                                <p className="text-stat-sm font-semibold text-danger mt-1">
                                  {totalSold}
                                </p>
                              </div>
                            </CardBody>
                          </Card>
                          <Card className="border border-default-200">
                            <CardBody>
                              <div className="mb-4">
                                <p className="text-sm text-default-500">
                                  Total Returned
                                </p>
                                <p className="text-stat-sm font-semibold text-teal-600 mt-1">
                                  {totalReturned}
                                </p>
                              </div>
                            </CardBody>
                          </Card>
                          <Card className="border border-default-200">
                            <CardBody>
                              <div className="mb-4">
                                <p className="text-sm text-default-500">
                                  Total Purchased
                                </p>
                                <p className="text-stat-sm font-semibold text-success mt-1">
                                  {totalPurchased}
                                </p>
                              </div>
                            </CardBody>
                          </Card>
                          <Card className="border border-default-200">
                            <CardBody>
                              <div className="mb-4">
                                <p className="text-sm text-default-500">
                                  Net Quantity
                                </p>
                                <p
                                  className={`text-stat-sm font-semibold mt-1 ${
                                    netQuantity > 0
                                      ? "text-success"
                                      : netQuantity < 0
                                        ? "text-danger"
                                        : "text-default-600"
                                  }`}
                                >
                                  {netQuantity}
                                </p>
                              </div>
                            </CardBody>
                          </Card>
                        </div>
                      );
                    })()}

                    <Card className="border border-default-200">
                      <CardBody className="p-0">
                        {isLoadingStockTransactions ? (
                          <div className="flex justify-center items-center py-12">
                            <Spinner size="lg" />
                          </div>
                        ) : medicineTransactions.length === 0 ? (
                          <div className="text-center py-12 px-4">
                            <IoReceiptOutline
                              className="mx-auto text-default-300 mb-4"
                              size={48}
                            />
                            <h3 className="text-stat-sm font-medium text-default-700 mb-1">
                              No transactions
                            </h3>
                            <p className="text-default-500">
                              No transactions recorded for this medicine yet.
                            </p>
                          </div>
                        ) : (
                          <Table aria-label="Medicine transactions">
                            <TableHeader>
                              <TableRow>
                                <TableColumn>DATE</TableColumn>
                                <TableColumn>TYPE</TableColumn>
                                <TableColumn>PARTY</TableColumn>
                                <TableColumn>QUANTITY</TableColumn>
                                <TableColumn>BATCH</TableColumn>
                                <TableColumn>MANUFACTURER</TableColumn>
                                <TableColumn>EXPIRY</TableColumn>
                                <TableColumn>REFERENCE</TableColumn>
                                <TableColumn>AMOUNT</TableColumn>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {medicineTransactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                  <TableCell>
                                    <div className="text-sm">
                                      {transaction.date instanceof Date &&
                                      !isNaN(transaction.date.getTime())
                                        ? format(
                                            transaction.date,
                                            "MMM dd, yyyy",
                                          )
                                        : "N/A"}
                                    </div>
                                    <div className="text-xs text-default-500">
                                      {transaction.date instanceof Date &&
                                      !isNaN(transaction.date.getTime())
                                        ? format(transaction.date, "hh:mm a")
                                        : "N/A"}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      color={
                                        transaction.type === "sale"
                                          ? "danger"
                                          : transaction.type === "adjustment"
                                            ? "warning"
                                            : transaction.type === "return"
                                              ? "secondary"
                                              : "success"
                                      }
                                      size="sm"
                                      variant="flat"
                                    >
                                      {transaction.type === "sale"
                                        ? "Sale"
                                        : transaction.type === "adjustment"
                                          ? "Adjustment"
                                          : transaction.type === "return"
                                            ? "Return"
                                            : "Purchase"}
                                    </Chip>
                                  </TableCell>
                                  <TableCell>{transaction.party}</TableCell>
                                  <TableCell>
                                    <span
                                      className={`font-medium ${
                                        transaction.quantity < 0
                                          ? "text-danger"
                                          : "text-success"
                                      }`}
                                    >
                                      {transaction.quantity > 0 ? "+" : ""}
                                      {transaction.quantity}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {transaction.batchNumber ? (
                                      <span className="text-sm text-default-600">
                                        {transaction.batchNumber}
                                      </span>
                                    ) : (
                                      <span className="text-default-400">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {transaction.manufacturer ? (
                                      <span className="text-sm text-default-600">
                                        {transaction.manufacturer}
                                      </span>
                                    ) : (
                                      <span className="text-default-400">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {transaction.expiryDate ? (
                                      <div className="text-sm">
                                        {format(
                                          transaction.expiryDate,
                                          "MMM dd, yyyy",
                                        )}
                                        {transaction.expiryDate <
                                          new Date() && (
                                          <Chip
                                            className="ml-1"
                                            color="danger"
                                            size="sm"
                                            variant="flat"
                                          >
                                            Expired
                                          </Chip>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-default-400">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-default-500">
                                      {transaction.reference}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {transaction.amount > 0 ? (
                                      <span className="text-sm">
                                        NPR{" "}
                                        {transaction.amount.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          },
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-default-400">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardBody>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Daily Report Tab */}
            {activeTab === "daily_sales_report" && (
              <div className="py-6">
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Input
                      className="w-48"
                      label="Select Date"
                      type="date"
                      value={dailyReportDate}
                      variant="bordered"
                      onChange={(e) => setDailyReportDate(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      color="success"
                      isDisabled={isExportingDailyReport}
                      isLoading={isExportingDailyReport}
                      startContent={<IoDownloadOutline size={20} />}
                      variant="flat"
                      onPress={async () => {
                        setIsExportingDailyReport(true);
                        try {
                          const { exportPharmacyDailyReportToExcel } =
                            await import("@/utils/reportExports");
                          const dailyPurchases = getDailyReportPurchases();
                          const selectedDate = new Date(dailyReportDate);

                          exportPharmacyDailyReportToExcel(
                            dailyPurchases,
                            selectedDate,
                            clinic?.name,
                          );
                        } catch (error) {
                          console.error("Error exporting to Excel:", error);
                          addToast({
                            title: "Export Failed",
                            description:
                              "Failed to export daily report. Please try again.",
                            color: "danger",
                          });
                        } finally {
                          setIsExportingDailyReport(false);
                        }
                      }}
                    >
                      Export Excel
                    </Button>
                    <Button
                      color="danger"
                      isDisabled={isExportingDailyReport}
                      isLoading={isExportingDailyReport}
                      startContent={<IoDocumentTextOutline size={20} />}
                      variant="flat"
                      onPress={async () => {
                        setIsExportingDailyReport(true);
                        try {
                          const { exportPharmacyDailyReportToPDF } =
                            await import("@/utils/reportExports");
                          const dailyPurchases = getDailyReportPurchases();
                          const selectedDate = new Date(dailyReportDate);

                          exportPharmacyDailyReportToPDF(
                            dailyPurchases,
                            selectedDate,
                            clinic?.name,
                          );
                        } catch (error) {
                          console.error("Error exporting to PDF:", error);
                          addToast({
                            title: "Export Failed",
                            description:
                              "Failed to export daily report. Please try again.",
                            color: "danger",
                          });
                        } finally {
                          setIsExportingDailyReport(false);
                        }
                      }}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>

                {(() => {
                  const summary = getDailyReportSummary();
                  const dailyPurchases = getDailyReportPurchases();

                  return (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-default-500">
                                  Total Sales
                                </p>
                                <p className="text-stat-sm font-semibold text-default-900 mt-1">
                                  NPR{" "}
                                  {summary.totalSales.toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )}
                                </p>
                              </div>
                              <IoWalletOutline
                                className="text-primary"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-default-500">
                                  Total Items
                                </p>
                                <p className="text-stat-sm font-semibold text-default-900 mt-1">
                                  {summary.totalItems}
                                </p>
                              </div>
                              <IoMedicalOutline
                                className="text-primary"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-default-500">
                                  Total No. of Sales
                                </p>
                                <p className="text-stat-sm font-semibold text-default-900 mt-1">
                                  {summary.totalPurchases}
                                </p>
                              </div>
                              <IoReceiptOutline
                                className="text-primary"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-default-500">
                                  No of sales (Paid)
                                </p>
                                <p className="text-stat-sm font-semibold text-success mt-1">
                                  {summary.paidCount}
                                </p>
                              </div>
                              <IoCheckmarkCircleOutline
                                className="text-success"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm text-default-500">
                                  Total Stock
                                </p>
                                {isLoadingStockSummary ? (
                                  <Spinner className="mt-1" size="sm" />
                                ) : totalStock === null ? (
                                  <p className="text-stat-sm font-semibold text-default-400 mt-1">
                                    Data not available
                                  </p>
                                ) : (
                                  <p className="text-stat-sm font-semibold text-default-900 mt-1">
                                    {totalStock.toLocaleString()}
                                  </p>
                                )}
                                <p className="text-xs text-default-400 mt-1">
                                  {totalStock !== null
                                    ? `End of day ${format(new Date(dailyReportDate), "MMM dd, yyyy")}`
                                    : `Sold Today: ${summary.totalItems}`}
                                </p>
                              </div>
                              <IoStorefrontOutline
                                className="text-primary"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                      </div>

                      {/* Daily Purchases Table */}
                      {dailyPurchases.length === 0 ? (
                        <Card>
                          <CardBody>
                            <div className="text-center py-12">
                              <div className="text-default-400 mb-4">
                                <IoReceiptOutline
                                  className="mx-auto opacity-50"
                                  size={48}
                                />
                              </div>
                              <h3 className="text-stat-sm font-medium text-default-700 mb-2">
                                No sales recorded
                              </h3>
                              <p className="text-default-500">
                                No purchases found for{" "}
                                {format(
                                  new Date(dailyReportDate),
                                  "MMMM dd, yyyy",
                                )}
                                .
                              </p>
                            </div>
                          </CardBody>
                        </Card>
                      ) : (
                        <Card>
                          <CardBody className="p-0">
                            <Table aria-label="Daily sales table">
                              <TableHeader>
                                <TableRow>
                                  <TableColumn>PURCHASE NO</TableColumn>
                                  <TableColumn>DATE</TableColumn>
                                  <TableColumn>PATIENT NAME</TableColumn>
                                  <TableColumn>ITEMS</TableColumn>
                                  <TableColumn>TOTAL</TableColumn>
                                  <TableColumn>DISCOUNT</TableColumn>
                                  <TableColumn>TAX</TableColumn>
                                  <TableColumn>NET AMOUNT</TableColumn>
                                  <TableColumn>PAYMENT STATUS</TableColumn>
                                  <TableColumn>PAYMENT TYPE</TableColumn>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {dailyPurchases.map((purchase) => {
                                  const purchaseDate =
                                    purchase.purchaseDate instanceof Date
                                      ? purchase.purchaseDate
                                      : new Date(purchase.purchaseDate);

                                  return (
                                    <TableRow key={purchase.id}>
                                      <TableCell>
                                        <div className="font-medium">
                                          {purchase.purchaseNo}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-sm">
                                          {format(purchaseDate, "MMM dd, yyyy")}
                                        </div>
                                        <div className="text-xs text-default-500">
                                          {format(purchaseDate, "hh:mm a")}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {purchase.patientName || (
                                          <span className="text-default-400 italic">
                                            Walk-in Customer
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-sm">
                                          {purchase.items.length} item
                                          {purchase.items.length !== 1
                                            ? "s"
                                            : ""}
                                        </div>
                                        <div className="text-xs text-default-500">
                                          Qty:{" "}
                                          {purchase.items.reduce(
                                            (sum, item) => sum + item.quantity,
                                            0,
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        NPR{" "}
                                        {purchase.total.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          },
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {purchase.discount > 0 ? (
                                          <span className="text-default-600">
                                            NPR{" "}
                                            {purchase.discount.toLocaleString(
                                              undefined,
                                              {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              },
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-default-400">
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {purchase.taxAmount > 0 ? (
                                          <span className="text-default-600">
                                            NPR{" "}
                                            {purchase.taxAmount.toLocaleString(
                                              undefined,
                                              {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              },
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-default-400">
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <span className="font-semibold text-default-900">
                                          NPR{" "}
                                          {purchase.netAmount.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            },
                                          )}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <Chip
                                          color={
                                            purchase.paymentStatus === "paid"
                                              ? "success"
                                              : purchase.paymentStatus ===
                                                    "unpaid" ||
                                                  purchase.paymentStatus ===
                                                    "pending"
                                                ? "danger"
                                                : purchase.paymentStatus ===
                                                    "partial"
                                                  ? "warning"
                                                  : "default"
                                          }
                                          size="sm"
                                          variant="flat"
                                        >
                                          {purchase.paymentStatus
                                            .charAt(0)
                                            .toUpperCase() +
                                            purchase.paymentStatus.slice(1)}
                                        </Chip>
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-sm text-default-600">
                                          {purchase.paymentType || "N/A"}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardBody>
                        </Card>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Daily Purchases Report Tab */}
            {activeTab === "daily_purchases_report" && (
              <div className="py-6">
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Input
                      className="w-48"
                      label="Select Date"
                      type="date"
                      value={dailyPurchasesReportDate}
                      variant="bordered"
                      onChange={(e) =>
                        setDailyPurchasesReportDate(e.target.value)
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      color="success"
                      isDisabled={isExportingDailyPurchasesReport}
                      isLoading={isExportingDailyPurchasesReport}
                      startContent={<IoDownloadOutline size={20} />}
                      variant="flat"
                      onPress={async () => {
                        setIsExportingDailyPurchasesReport(true);
                        try {
                          const { exportDailyPurchasesReportToExcel } =
                            await import("@/utils/reportExports");
                          const selectedDate = new Date(
                            dailyPurchasesReportDate,
                          );

                          exportDailyPurchasesReportToExcel(
                            [],
                            selectedDate,
                            clinic?.name,
                            medicines,
                            refillTransactions,
                          );
                        } catch (error) {
                          console.error("Error exporting to Excel:", error);
                          addToast({
                            title: "Export Failed",
                            description:
                              "Failed to export daily purchases report. Please try again.",
                            color: "danger",
                          });
                        } finally {
                          setIsExportingDailyPurchasesReport(false);
                        }
                      }}
                    >
                      Export Excel
                    </Button>
                    <Button
                      color="danger"
                      isDisabled={isExportingDailyPurchasesReport}
                      isLoading={isExportingDailyPurchasesReport}
                      startContent={<IoDocumentTextOutline size={20} />}
                      variant="flat"
                      onPress={async () => {
                        setIsExportingDailyPurchasesReport(true);
                        try {
                          const { exportDailyPurchasesReportToPDF } =
                            await import("@/utils/reportExports");
                          const selectedDate = new Date(
                            dailyPurchasesReportDate,
                          );

                          exportDailyPurchasesReportToPDF(
                            [],
                            selectedDate,
                            clinic?.name,
                            medicines,
                            refillTransactions,
                          );
                        } catch (error) {
                          console.error("Error exporting to PDF:", error);
                          addToast({
                            title: "Export Failed",
                            description:
                              "Failed to export daily purchases report. Please try again.",
                            color: "danger",
                          });
                        } finally {
                          setIsExportingDailyPurchasesReport(false);
                        }
                      }}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>

                {(() => {
                  const summary = getDailyPurchasesReportSummary();

                  return (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-default-500">
                                  Total Purchase Cost
                                </p>
                                <p className="text-stat font-semibold text-default-900 mt-1">
                                  NPR{" "}
                                  {summary.totalPurchaseCost.toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )}
                                </p>
                              </div>
                              <IoWalletOutline
                                className="text-primary"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-default-500">
                                  Total Medicines
                                </p>
                                <p className="text-stat font-semibold text-default-900 mt-1">
                                  {summary.totalMedicines}
                                </p>
                              </div>
                              <IoMedicalOutline
                                className="text-primary"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-default-500">
                                  Total Quantity
                                </p>
                                <p className="text-stat font-semibold text-default-900 mt-1">
                                  {summary.totalQuantity}
                                </p>
                              </div>
                              <IoStorefrontOutline
                                className="text-primary"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                        <Card>
                          <CardBody className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-default-500">
                                  Avg Cost/Medicine
                                </p>
                                <p className="text-stat font-semibold text-default-900 mt-1">
                                  NPR{" "}
                                  {summary.averageCostPerMedicine.toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )}
                                </p>
                              </div>
                              <IoReceiptOutline
                                className="text-primary"
                                size={24}
                              />
                            </div>
                          </CardBody>
                        </Card>
                      </div>

                      {/* Daily Purchases Report Table */}
                      {refillTransactions.length === 0 &&
                      !isLoadingRefillTransactions ? (
                        <Card>
                          <CardBody>
                            <div className="text-center py-12">
                              <div className="text-default-400 mb-4">
                                <IoReceiptOutline
                                  className="mx-auto opacity-50"
                                  size={48}
                                />
                              </div>
                              <h3 className="text-stat-sm font-medium text-default-700 mb-2">
                                No purchases recorded
                              </h3>
                              <p className="text-default-500">
                                No purchases found for{" "}
                                {format(
                                  new Date(dailyPurchasesReportDate),
                                  "MMMM dd, yyyy",
                                )}
                                .
                              </p>
                            </div>
                          </CardBody>
                        </Card>
                      ) : (
                        <Card>
                          <CardBody className="p-0">
                            <Table aria-label="Daily purchases report table">
                              <TableHeader>
                                <TableRow>
                                  <TableColumn>REF/INVOICE NO</TableColumn>
                                  <TableColumn>DATE</TableColumn>
                                  <TableColumn>TYPE</TableColumn>
                                  <TableColumn>SUPPLIER</TableColumn>
                                  <TableColumn>MEDICINE NAME</TableColumn>
                                  <TableColumn>QUANTITY</TableColumn>
                                  <TableColumn>COST PRICE</TableColumn>
                                  <TableColumn>TOTAL COST</TableColumn>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {refillTransactions.map((transaction) => {
                                  const medicine = medicines.find(
                                    (m) => m.id === transaction.medicineId,
                                  );
                                  const medicineName =
                                    medicine?.name || "Unknown Medicine";
                                  const costPrice =
                                    transaction.costPrice ||
                                    getMedicineCostPrice(
                                      transaction.medicineId,
                                    );
                                  const totalCost =
                                    transaction.quantity * costPrice;
                                  const transactionDate =
                                    transaction.createdAt instanceof Date
                                      ? transaction.createdAt
                                      : new Date(transaction.createdAt);

                                  return (
                                    <TableRow key={`refill-${transaction.id}`}>
                                      <TableCell>
                                        <div className="font-medium">
                                          {transaction.invoiceNumber || "N/A"}
                                        </div>
                                        {transaction.batchNumber && (
                                          <div className="text-xs text-default-500">
                                            Batch: {transaction.batchNumber}
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-sm">
                                          {format(
                                            transactionDate,
                                            "MMM dd, yyyy",
                                          )}
                                        </div>
                                        <div className="text-xs text-default-500">
                                          {format(transactionDate, "hh:mm a")}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Chip
                                          color="success"
                                          size="sm"
                                          variant="flat"
                                        >
                                          Refill
                                        </Chip>
                                      </TableCell>
                                      <TableCell>
                                        {transaction.supplierId ? (
                                          <span className="text-default-900">
                                            {getSupplierName(
                                              transaction.supplierId,
                                            ) || "Unknown Supplier"}
                                          </span>
                                        ) : (
                                          <span className="text-default-400 italic">
                                            No Supplier
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-sm font-medium">
                                          {medicineName}
                                        </div>
                                        {transaction.isSchemeStock && (
                                          <div className="text-xs text-default-500">
                                            Scheme Stock
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-default-900">
                                          {transaction.quantity}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        {costPrice > 0 ? (
                                          <span className="text-default-600">
                                            NPR{" "}
                                            {costPrice.toLocaleString(
                                              undefined,
                                              {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              },
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-default-400">
                                            N/A
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {costPrice > 0 ? (
                                          <span className="font-medium text-default-900">
                                            NPR{" "}
                                            {totalCost.toLocaleString(
                                              undefined,
                                              {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              },
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-default-400">
                                            N/A
                                          </span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}

                                {isLoadingRefillTransactions && (
                                  <TableRow>
                                    <TableCell
                                      className="text-center py-8"
                                      colSpan={8}
                                    >
                                      <Spinner
                                        label="Loading refill transactions..."
                                        size="sm"
                                      />
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </CardBody>
                        </Card>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Medicine/Items Modal */}
      <Modal
        hideCloseButton={isSubmitting}
        isDismissable={!isSubmitting}
        isOpen={purchaseModalState.isOpen}
        scrollBehavior="inside"
        size="full"
        onClose={purchaseModalState.close}
      >
        <ModalContent>
          <ModalHeader>
            <span className="text-[13px] font-semibold text-[rgb(var(--color-text))] tracking-[-0.01em]">
              New Record
            </span>
            <span className="text-[11px] font-normal text-[rgb(var(--color-text-muted))]">
              Record a medicine / item purchase
            </span>
          </ModalHeader>

          <ModalBody className="p-0 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 h-full w-full">
              {/* Left Column: Customer Details & Cart Items (Takes 7/12 cols) */}
              <div className="lg:col-span-7 p-4 overflow-y-auto flex flex-col gap-4 border-r border-[rgb(var(--color-border))]">
                {/* ── Section: Customer ─────────────────────────────── */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[rgb(var(--color-text-muted)/0.7)]">
                      Customer
                    </span>
                    <div className="flex-1 h-px bg-[rgb(var(--color-border))]" />
                  </div>
                  <div
                    className={clsx(
                      "grid gap-3",
                      purchaseForm.customerType === "patient"
                        ? "grid-cols-1 md:grid-cols-3"
                        : "grid-cols-1 md:grid-cols-2",
                    )}
                  >
                    <CustomSelect
                      required
                      label="Customer Type"
                      options={[
                        { value: "walk-in", label: "Walk-in" },
                        { value: "patient", label: "Patient" },
                      ]}
                      value={purchaseForm.customerType}
                      onChange={(e: any) => {
                        const selectedType = e.target.value as
                          | "walk-in"
                          | "patient";

                        setPurchaseForm((prev) => ({
                          ...prev,
                          customerType: selectedType,
                          patientId:
                            selectedType === "walk-in" ? "" : prev.patientId,
                          patientName:
                            selectedType === "walk-in" ? "" : prev.patientName,
                        }));
                      }}
                    />

                    {purchaseForm.customerType === "patient" && (
                      <div className="relative">
                        {isLoadingPatients && (
                          <div className="absolute right-2 top-8 z-10">
                            <Spinner size="sm" />
                          </div>
                        )}
                        <SearchSelect
                          required
                          items={patients.map((p) => ({
                            id: p.id,
                            primary: `${p.name} ${p.regNumber || ""}`.trim(),
                            secondary: p.regNumber
                              ? `Reg: ${p.regNumber}`
                              : undefined,
                          }))}
                          label="Select Patient"
                          placeholder="Search by name or reg. number…"
                          value={purchaseForm.patientId || ""}
                          onChange={(key) => {
                            const selectedPatient = patients.find(
                              (p) => p.id === key,
                            );

                            setPurchaseForm((prev) => ({
                              ...prev,
                              patientId: key || "",
                              patientName: selectedPatient
                                ? `${selectedPatient.name}${selectedPatient.regNumber ? ` (${selectedPatient.regNumber})` : ""}`
                                : "",
                              patientPhone:
                                selectedPatient?.mobile ||
                                selectedPatient?.phone ||
                                "",
                              patientAddress: selectedPatient?.address || "",
                            }));
                          }}
                        />
                      </div>
                    )}

                    {purchaseForm.customerType === "walk-in" && (
                      <>
                        <CustomInput
                          label="Customer Name (optional)"
                          placeholder="Enter customer name"
                          value={purchaseForm.patientName}
                          onChange={(e: any) =>
                            setPurchaseForm((prev) => ({
                              ...prev,
                              patientName: e.target.value,
                            }))
                          }
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <CustomInput
                            label="Phone (optional)"
                            placeholder="Enter phone number"
                            value={purchaseForm.patientPhone}
                            onChange={(e: any) =>
                              setPurchaseForm((prev) => ({
                                ...prev,
                                patientPhone: e.target.value,
                              }))
                            }
                          />
                          <CustomInput
                            label="Address (optional)"
                            placeholder="Enter address"
                            value={purchaseForm.patientAddress}
                            onChange={(e: any) =>
                              setPurchaseForm((prev) => ({
                                ...prev,
                                patientAddress: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </>
                    )}

                    <CustomInput
                      label="Medication Duration (days)"
                      min="0"
                      placeholder="e.g. 30 (leave blank if N/A)"
                      type="number"
                      value={
                        purchaseForm.medicationDurationDays
                          ? purchaseForm.medicationDurationDays.toString()
                          : ""
                      }
                      onChange={(e: any) =>
                        setPurchaseForm((prev) => ({
                          ...prev,
                          medicationDurationDays: Math.max(
                            0,
                            parseInt(e.target.value, 10) || 0,
                          ),
                        }))
                      }
                    />
                  </div>
                </section>

                {/* ── Section: Items ────────────────────────────────── */}
                <section>
                  <div className="flex items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[rgb(var(--color-text-muted)/0.7)]">
                        Purchase Items
                      </span>
                      <div className="h-px w-24 bg-[rgb(var(--color-border))]" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {purchaseItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="border border-border-base rounded bg-surface-2"
                      >
                        {/* item header row */}
                        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-[rgb(var(--color-border))]">
                          <span className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-[0.05em]">
                            Item #{index + 1}
                          </span>
                          {purchaseItems.length > 1 && (
                            <button
                              className="text-rose-400 hover:text-rose-600 transition-colors"
                              title="Remove item"
                              type="button"
                              onClick={() => removePurchaseItem(item.id)}
                            >
                              <IoTrashOutline className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* item body */}
                        <div className="p-3 flex flex-col gap-3">
                          {/* Row 1: Type + Product + Stock Type + Expiry */}
                          <div className="grid grid-cols-12 gap-3 items-start">
                            <div className="col-span-12 sm:col-span-2">
                              <CustomSelect
                                required
                                label="Type"
                                options={[
                                  { value: "medicine", label: "Medicine" },
                                  { value: "item", label: "Item" },
                                ]}
                                value={item.type}
                                onChange={(e: any) => {
                                  const selectedType = e.target.value as
                                    | "medicine"
                                    | "item";

                                  updatePurchaseItem(
                                    item.id,
                                    "type",
                                    selectedType,
                                  );
                                }}
                              />
                            </div>

                            <div
                              className={clsx(
                                "col-span-12",
                                item.type === "medicine"
                                  ? item.productId
                                    ? "sm:col-span-4"
                                    : "sm:col-span-7"
                                  : "sm:col-span-10",
                              )}
                            >
                              <SearchSelect
                                required
                                items={
                                  item.type === "medicine"
                                    ? medicines
                                        .filter(
                                          (m) =>
                                            (medicineStocks[m.id] || 0) > 0,
                                        )
                                        .map((m) => ({
                                          id: m.id,
                                          primary: `${m.name} • NPR ${(m.price || 0).toLocaleString()}`,
                                        }))
                                    : items.map((i) => ({
                                        id: i.id,
                                        primary: i.name,
                                      }))
                                }
                                label={`${item.type === "medicine" ? "Medicine" : "Item"}`}
                                placeholder={`Search ${item.type}…`}
                                value={item.productId || ""}
                                onChange={(key) =>
                                  updatePurchaseItem(item.id, "productId", key)
                                }
                              />
                            </div>

                            {item.type === "medicine" && item.productId && (
                              <div className="col-span-12 sm:col-span-3">
                                <CustomSelect
                                  required
                                  description={`Reg: ${purchaseItemStocks[item.id] ?? 0} | Sch: ${purchaseItemSchemeStocks[item.id] ?? 0}`}
                                  label="Stock Type"
                                  options={[
                                    { value: "regular", label: "Regular" },
                                    { value: "scheme", label: "Scheme" },
                                  ]}
                                  value={item.stockType || "regular"}
                                  onChange={(e: any) => {
                                    const selectedStockType = e.target.value as
                                      | "regular"
                                      | "scheme";

                                    updatePurchaseItem(
                                      item.id,
                                      "stockType",
                                      selectedStockType,
                                    );
                                  }}
                                />
                              </div>
                            )}

                            {item.type === "medicine" && (
                              <div
                                className={clsx(
                                  "col-span-12",
                                  item.productId
                                    ? "sm:col-span-3"
                                    : "sm:col-span-3",
                                )}
                              >
                                <CustomInput
                                  required
                                  label="Expiry Date"
                                  type="date"
                                  value={item.expiryDate || ""}
                                  onChange={(e: any) =>
                                    updatePurchaseItem(
                                      item.id,
                                      "expiryDate",
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>

                          {/* Stock info pill */}
                          {item.type === "medicine" &&
                            item.productId &&
                            purchaseItemStocks[item.id] !== undefined && (
                              <div className="flex items-center gap-1.5 self-start px-2.5 py-1 bg-teal-50 border border-teal-100 rounded text-[11px] text-teal-700">
                                <span className="font-medium">Stock:</span>
                                <span>
                                  {(() => {
                                    const r = purchaseItemStocks[item.id] ?? 0;
                                    const s =
                                      purchaseItemSchemeStocks[item.id] ?? 0;

                                    if (r === null && s === null) return "N/A";
                                    if (s > 0)
                                      return `Regular: ${r ?? 0} | Scheme: ${s}`;

                                    return r ?? "N/A";
                                  })()}
                                </span>
                              </div>
                            )}

                          {/* Row 2: Price + Qty + Amount */}
                          <div className="grid grid-cols-12 gap-3 items-start">
                            <div className="col-span-12 sm:col-span-4">
                              {item.type === "medicine" && item.productId ? (
                                (() => {
                                  const stockType = item.stockType || "regular";

                                  if (stockType === "regular") {
                                    return (
                                      <CustomInput
                                        required
                                        label="Regular Sale Price (NPR)"
                                        startContent={
                                          <span className="text-[11px] text-text-muted/40">
                                            NPR
                                          </span>
                                        }
                                        step="any"
                                        type="number"
                                        value={(
                                          item.regularSalePrice ||
                                          item.salePrice ||
                                          0
                                        ).toString()}
                                        onChange={(e: any) =>
                                          updatePurchaseItem(
                                            item.id,
                                            "regularSalePrice",
                                            parseFloat(e.target.value) || 0,
                                          )
                                        }
                                      />
                                    );
                                  } else {
                                    return (
                                      <CustomInput
                                        required
                                        label="Scheme Sale Price (NPR)"
                                        startContent={
                                          <span className="text-[11px] text-text-muted/40">
                                            NPR
                                          </span>
                                        }
                                        step="any"
                                        type="number"
                                        value={(
                                          item.schemeSalePrice ||
                                          item.salePrice ||
                                          0
                                        ).toString()}
                                        onChange={(e: any) =>
                                          updatePurchaseItem(
                                            item.id,
                                            "schemeSalePrice",
                                            parseFloat(e.target.value) || 0,
                                          )
                                        }
                                      />
                                    );
                                  }
                                })()
                              ) : (
                                <CustomInput
                                  required
                                  label="Sale Price"
                                  startContent={
                                    <span className="text-[11px] text-text-muted/40">
                                      NPR
                                    </span>
                                  }
                                  step="any"
                                  type="number"
                                  value={(item.salePrice || 0).toString()}
                                  onChange={(e: any) =>
                                    updatePurchaseItem(
                                      item.id,
                                      "salePrice",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              )}
                            </div>

                            <div className="col-span-12 sm:col-span-4">
                              <CustomInput
                                required
                                label="Qty"
                                type="number"
                                value={(item.quantity || 0).toString()}
                                onChange={(e: any) =>
                                  updatePurchaseItem(
                                    item.id,
                                    "quantity",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>

                            <div className="col-span-12 sm:col-span-4">
                              <CustomInput
                                readOnly
                                classNames={{
                                  input: "font-semibold text-teal-700",
                                }}
                                label="Amount"
                                startContent={
                                  <span className="text-[11px] text-text-muted/40">
                                    NPR
                                  </span>
                                }
                                type="number"
                                value={(item.amount || 0).toString()}
                              />
                            </div>

                            {/* Batch utilization preview */}
                            {item.type === "medicine" &&
                              item.productId &&
                              item.quantity > 0 &&
                              purchaseItemBatches[item.id] && (
                                <div className="col-span-12 mt-1 p-2 rounded-lg border border-primary/20 bg-primary/5 flex flex-col gap-1.5 animate-fadeIn">
                                  <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                                    Batch Allocation (FEFO)
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {(() => {
                                      const stocks =
                                        purchaseItemBatches[item.id] || [];
                                      const stockType =
                                        item.stockType || "regular";
                                      const now = new Date();

                                      // Filter out expired batches (expiryDate < now)
                                      const activeNonExpired = stocks.filter(
                                        (s) => {
                                          if (!s.expiryDate) return true;

                                          return new Date(s.expiryDate) >= now;
                                        },
                                      );

                                      // Sort by expiry date, then createdAt
                                      activeNonExpired.sort((a, b) => {
                                        const expA = a.expiryDate
                                          ? new Date(a.expiryDate).getTime()
                                          : Infinity;
                                        const expB = b.expiryDate
                                          ? new Date(b.expiryDate).getTime()
                                          : Infinity;

                                        if (expA !== expB) return expA - expB;
                                        const createdA = a.createdAt
                                          ? new Date(a.createdAt).getTime()
                                          : 0;
                                        const createdB = b.createdAt
                                          ? new Date(b.createdAt).getTime()
                                          : 0;

                                        return createdA - createdB;
                                      });

                                      let remaining = item.quantity;
                                      const allocated: {
                                        batchNumber: string;
                                        qty: number;
                                        price: number;
                                        expiryDate?: Date;
                                      }[] = [];

                                      for (const batch of activeNonExpired) {
                                        if (remaining <= 0) break;
                                        const available =
                                          stockType === "scheme"
                                            ? (batch.schemeStock ?? 0)
                                            : (batch.currentStock ?? 0);

                                        if (available <= 0) continue;

                                        const qtyToUse = Math.min(
                                          remaining,
                                          available,
                                        );
                                        const defaultPrice =
                                          (stockType === "scheme"
                                            ? item.schemeSalePrice
                                            : item.regularSalePrice) ||
                                          item.salePrice ||
                                          0;
                                        const batchPrice =
                                          stockType === "scheme"
                                            ? (batch.schemePrice ??
                                              batch.salePrice ??
                                              defaultPrice)
                                            : (batch.salePrice ?? defaultPrice);

                                        allocated.push({
                                          batchNumber:
                                            batch.batchNumber || "DEFAULT",
                                          qty: qtyToUse,
                                          price: batchPrice,
                                          expiryDate: batch.expiryDate,
                                        });
                                        remaining -= qtyToUse;
                                      }

                                      if (allocated.length === 0) {
                                        return (
                                          <span className="text-[11px] text-rose-500 font-medium">
                                            No stock available
                                          </span>
                                        );
                                      }

                                      return (
                                        <>
                                          {allocated.map((alloc, idx) => (
                                            <div
                                              key={idx}
                                              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm text-[11px] font-medium text-neutral-700 dark:text-neutral-300"
                                            >
                                              <span className="text-primary font-bold">
                                                {alloc.batchNumber}
                                              </span>
                                              <span className="text-neutral-400">
                                                |
                                              </span>
                                              <span>
                                                Qty:{" "}
                                                <strong className="text-neutral-955 dark:text-white">
                                                  {alloc.qty}
                                                </strong>
                                              </span>
                                              <span className="text-neutral-400">
                                                |
                                              </span>
                                              <span>
                                                Price:{" "}
                                                <strong className="text-emerald-600 dark:text-emerald-400">
                                                  NPR {alloc.price}
                                                </strong>
                                              </span>
                                              {alloc.expiryDate && (
                                                <>
                                                  <span className="text-neutral-400">
                                                    |
                                                  </span>
                                                  <span className="text-neutral-500 text-[10.5px]">
                                                    Exp:{" "}
                                                    {new Date(
                                                      alloc.expiryDate,
                                                    ).toLocaleDateString()}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                          ))}
                                          {remaining > 0 && (
                                            <div className="w-full text-[11px] text-rose-500 font-semibold mt-1">
                                              ⚠️ Insufficient stock! {remaining}{" "}
                                              quantity unallocated.
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex justify-end">
                    <Button
                      color="primary"
                      size="sm"
                      startContent={<IoAddOutline />}
                      variant="flat"
                      onPress={addPurchaseItem}
                    >
                      New item
                    </Button>
                  </div>
                </section>
              </div>

              {/* Right Column: Pinned Summary & Payment options (Takes 5/12 cols) */}
              <div className="lg:col-span-5 p-4 bg-[rgb(var(--color-surface-2))/0.3] overflow-y-auto flex flex-col gap-4">
                {/* ── Section: Summary ──────────────────────────────── */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-text-main/80">
                      Summary & Payment
                    </span>
                    <div className="flex-1 h-px bg-[rgb(var(--color-border))]" />
                  </div>

                  {/* Totals strip */}
                  <div className="flex items-stretch gap-0 rounded border border-border-base overflow-hidden mb-3 bg-surface-2/30">
                    {[
                      {
                        label: "Subtotal",
                        value: `NPR ${(purchaseForm.total || 0).toLocaleString()}`,
                      },
                      {
                        label: "Taxable",
                        value: `NPR ${(purchaseForm.taxableAmount || 0).toLocaleString()}`,
                      },
                      {
                        label: "Tax",
                        value: `NPR ${(purchaseForm.taxAmount || 0).toLocaleString()}`,
                      },
                      {
                        label: "Handling",
                        value: `NPR ${(purchaseForm.handlingAmount || 0).toLocaleString()}`,
                      },
                    ].map((col, i) => (
                      <div
                        key={i}
                        className={`flex-1 px-3 py-2 text-center ${i < 3 ? "border-r border-[rgb(var(--color-border))]" : ""}`}
                      >
                        <p className="text-[10.5px] text-[rgb(var(--color-text-muted)/0.7)] uppercase tracking-[0.06em]">
                          {col.label}
                        </p>
                        <p className="text-[12.5px] font-semibold text-[rgb(var(--color-text))] mt-0.5">
                          {col.value}
                        </p>
                      </div>
                    ))}
                    <div className="flex-1 px-3 py-2 text-center bg-[rgb(var(--color-primary)/0.1)] border-l border-[rgb(var(--color-primary)/0.2)]">
                      <p className="text-[10.5px] text-[rgb(var(--color-primary))] uppercase tracking-[0.06em] font-semibold">
                        Total
                      </p>
                      <p className="text-[15px] font-bold text-[rgb(var(--color-primary))] mt-0.5">
                        NPR {(purchaseForm.netAmount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CustomSelect
                      label="Discount Type"
                      options={[
                        { value: "flat", label: "Flat Amount (NPR)" },
                        { value: "percent", label: "Percentage (%)" },
                      ]}
                      value={purchaseForm.discountType}
                      onChange={(e: any) => {
                        const selectedType = e.target.value as
                          | "flat"
                          | "percent";

                        setPurchaseForm((prev) => ({
                          ...prev,
                          discountType: selectedType,
                          discount: selectedType === "flat" ? prev.discount : 0,
                          discountPercentage:
                            selectedType === "percent"
                              ? prev.discountPercentage
                              : 0,
                        }));
                      }}
                    />

                    {purchaseForm.discountType === "flat" ? (
                      <CustomInput
                        label="Discount (NPR)"
                        min="0"
                        startContent={
                          <span className="text-[11px] text-text-muted/40">
                            NPR
                          </span>
                        }
                        step="any"
                        type="number"
                        value={(purchaseForm.discount || 0).toString()}
                        onChange={(e: any) =>
                          setPurchaseForm((prev) => ({
                            ...prev,
                            discount: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    ) : (
                      <CustomInput
                        label="Discount (%)"
                        max="100"
                        min="0"
                        startContent={
                          <span className="text-[11px] text-text-muted/40">
                            %
                          </span>
                        }
                        step="any"
                        type="number"
                        value={(
                          purchaseForm.discountPercentage || 0
                        ).toString()}
                        onChange={(e: any) =>
                          setPurchaseForm((prev) => ({
                            ...prev,
                            discountPercentage: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    )}

                    <CustomInput
                      label={`${settingsForm.taxLabel || "Tax"} % (default: ${settingsForm.defaultTaxPercentage || 0})`}
                      startContent={
                        <span className="text-[11px] text-text-muted/40">
                          %
                        </span>
                      }
                      type="number"
                      value={(purchaseForm.taxPercentage || 0).toString()}
                      onChange={(e: any) =>
                        setPurchaseForm((prev) => ({
                          ...prev,
                          taxPercentage: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />

                    <CustomInput
                      label="Handling Charge (NPR)"
                      min="0"
                      placeholder="0.00"
                      startContent={
                        <span className="text-[11px] text-text-muted/40">
                          NPR
                        </span>
                      }
                      step="any"
                      type="number"
                      value={(purchaseForm.handlingAmount || 0).toString()}
                      onChange={(e: any) =>
                        setPurchaseForm((prev) => ({
                          ...prev,
                          handlingAmount: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />

                    <CustomSelect
                      required
                      label="Payment Method"
                      options={getAvailablePaymentMethods().map((m) => ({
                        value: m.key,
                        label: m.name,
                      }))}
                      value={purchaseForm.paymentType}
                      onChange={(e: any) => {
                        const selectedKey = e.target.value;

                        setPurchaseForm((prev) => ({
                          ...prev,
                          paymentType: selectedKey,
                        }));
                      }}
                    />

                    <div className="sm:col-span-2">
                      <CustomInput
                        label="Payment Note (optional)"
                        placeholder="Add any notes…"
                        value={purchaseForm.paymentNote}
                        onChange={(e: any) =>
                          setPurchaseForm((prev) => ({
                            ...prev,
                            paymentNote: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button
              color="default"
              isDisabled={isSubmitting}
              variant="bordered"
              onPress={purchaseModalState.forceClose}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={isSubmitting}
              isLoading={isSubmitting}
              startContent={!isSubmitting && <IoSaveOutline />}
              onPress={handlePurchaseSubmit}
            >
              {isSubmitting ? "Recording…" : "Record Purchase"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Supplier Payment Modal */}
      <Modal
        hideCloseButton={isSavingSupplierPayment}
        isDismissable={!isSavingSupplierPayment}
        isOpen={addSupplierPaymentModalState.isOpen}
        size="lg"
        onClose={handleCloseSupplierPaymentModal}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <IoWalletOutline className="text-primary" />
              <span>
                {editingSupplierPayment
                  ? "Edit Supplier Payment"
                  : "Record Supplier Payment"}
              </span>
            </div>
            {selectedSupplierForLedger && (
              <p className="text-sm text-default-500">
                {selectedSupplierForLedger.name}
              </p>
            )}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                isRequired
                label="Amount *"
                min={0}
                placeholder="0.00"
                startContent="NPR"
                type="number"
                value={supplierPaymentForm.amount}
                onChange={(e) =>
                  setSupplierPaymentForm((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
              />
              <Input
                label="Payment Date"
                type="date"
                value={supplierPaymentForm.date}
                onChange={(e) =>
                  setSupplierPaymentForm((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))
                }
              />
              <CustomSelect
                className="md:col-span-2"
                label="Entry Type"
                options={[
                  { value: "payment", label: "Payment to Supplier" },
                  { value: "refund", label: "Refund / Credit from Supplier" },
                ]}
                value={supplierPaymentForm.type}
                onChange={(e: any) => {
                  const value = e.target.value as "payment" | "refund";

                  setSupplierPaymentForm((prev) => ({ ...prev, type: value }));
                }}
              />
            </div>
            <Input
              label="Reference #"
              placeholder="Optional reference or voucher number"
              value={supplierPaymentForm.referenceNumber}
              onChange={(e) =>
                setSupplierPaymentForm((prev) => ({
                  ...prev,
                  referenceNumber: e.target.value,
                }))
              }
            />
            <Input
              label="Notes"
              placeholder="Optional notes"
              value={supplierPaymentForm.note}
              onChange={(e) =>
                setSupplierPaymentForm((prev) => ({
                  ...prev,
                  note: e.target.value,
                }))
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              isDisabled={isSavingSupplierPayment}
              variant="light"
              onPress={handleCloseSupplierPaymentModal}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isSavingSupplierPayment}
              onPress={handleSaveSupplierPayment}
            >
              {editingSupplierPayment ? "Update Entry" : "Save Entry"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Supplier Ledger History Modal */}
      <Modal
        isOpen={supplierHistoryModalState.isOpen}
        scrollBehavior="inside"
        size="xl"
        onClose={handleCloseSupplierHistoryModal}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <IoTimeOutline className="text-primary" />
              <span>Ledger History</span>
            </div>
            {historySupplier && (
              <p className="text-sm text-default-500">{historySupplier.name}</p>
            )}
          </ModalHeader>
          <ModalBody>
            {historySupplier ? (
              (() => {
                const entries = supplierLedgerEntries.filter(
                  (e) => e.supplierId === historySupplier.id,
                );

                if (entries.length === 0) {
                  return (
                    <div className="text-center py-6 text-default-500">
                      No ledger entries recorded for this supplier yet.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <Table aria-label="Supplier ledger history">
                      <TableHeader>
                        <TableRow>
                          <TableColumn>BILL NUMBER</TableColumn>
                          <TableColumn>DATE</TableColumn>
                          <TableColumn>DEBIT</TableColumn>
                          <TableColumn>CREDIT</TableColumn>
                          <TableColumn>BALANCE</TableColumn>
                          <TableColumn>TYPE</TableColumn>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {entry.billNumber || (
                                <span className="text-default-400 italic">
                                  Payment
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {entry.transactionDate.toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {entry.debitAmount > 0 ? (
                                <span className="text-danger font-medium">
                                  NPR{" "}
                                  {entry.debitAmount.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              ) : (
                                <span className="text-default-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {entry.creditAmount > 0 ? (
                                <span className="text-success font-medium">
                                  NPR{" "}
                                  {entry.creditAmount.toLocaleString(
                                    undefined,
                                    { maximumFractionDigits: 2 },
                                  )}
                                </span>
                              ) : (
                                <span className="text-default-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`font-semibold ${
                                  entry.balanceAmount > 0
                                    ? "text-danger"
                                    : entry.balanceAmount < 0
                                      ? "text-success"
                                      : "text-default-600"
                                }`}
                              >
                                NPR{" "}
                                {entry.balanceAmount.toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Chip
                                color={
                                  entry.type === "purchase"
                                    ? "primary"
                                    : "success"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {entry.type === "purchase"
                                  ? "Purchase"
                                  : "Payment"}
                              </Chip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-6 text-default-500">
                Select a supplier to view ledger history.
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              variant="flat"
              onPress={handleCloseSupplierHistoryModal}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Purchase Entry Modal */}
      <Modal
        hideCloseButton={isSavingPurchaseEntry}
        isDismissable={!isSavingPurchaseEntry}
        isOpen={addPurchaseEntryModalState.isOpen}
        size="md"
        onClose={() => {
          addPurchaseEntryModalState.forceClose();
          setPurchaseEntryForm({
            billNumber: "",
            purchaseDate: new Date().toISOString().split("T")[0],
            debitAmount: "",
            notes: "",
          });
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <IoReceiptOutline className="text-primary" />
              <span>Add Purchase Entry</span>
            </div>
            {selectedSupplierForTransactions && (
              <p className="text-sm text-default-500">
                {selectedSupplierForTransactions.name}
              </p>
            )}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                label="Bill Number *"
                placeholder="Enter bill number"
                value={purchaseEntryForm.billNumber}
                onChange={(e) =>
                  setPurchaseEntryForm((prev) => ({
                    ...prev,
                    billNumber: e.target.value,
                  }))
                }
              />
              <Input
                isRequired
                label="Purchase Date *"
                type="date"
                value={purchaseEntryForm.purchaseDate}
                onChange={(e) =>
                  setPurchaseEntryForm((prev) => ({
                    ...prev,
                    purchaseDate: e.target.value,
                  }))
                }
              />
              <Input
                isRequired
                label="Debit Amount *"
                min={0}
                placeholder="0.00"
                startContent="NPR"
                step="0.01"
                type="number"
                value={purchaseEntryForm.debitAmount}
                onChange={(e) =>
                  setPurchaseEntryForm((prev) => ({
                    ...prev,
                    debitAmount: e.target.value,
                  }))
                }
              />
              <Input
                label="Notes"
                placeholder="Optional notes"
                value={purchaseEntryForm.notes}
                onChange={(e) =>
                  setPurchaseEntryForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              isDisabled={isSavingPurchaseEntry}
              variant="light"
              onPress={() => {
                addPurchaseEntryModalState.forceClose();
                setPurchaseEntryForm({
                  billNumber: "",
                  purchaseDate: new Date().toISOString().split("T")[0],
                  debitAmount: "",
                  notes: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isSavingPurchaseEntry}
              onPress={handleSavePurchaseEntry}
            >
              Save Entry
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Ledger Entry Modal */}
      <Modal
        hideCloseButton={isSavingLedgerEntry}
        isDismissable={!isSavingLedgerEntry}
        isOpen={editLedgerEntryModalState.isOpen}
        size="md"
        onClose={() => {
          editLedgerEntryModalState.forceClose();
          setEditingLedgerEntry(null);
          setEditLedgerEntryForm({
            billNumber: "",
            transactionDate: new Date().toISOString().split("T")[0],
            debitAmount: "",
            creditAmount: "",
            notes: "",
            referenceNumber: "",
          });
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <IoCreateOutline className="text-primary" />
              <span>Edit Ledger Entry</span>
            </div>
            {selectedSupplierForTransactions && (
              <p className="text-sm text-default-500">
                {selectedSupplierForTransactions.name}
              </p>
            )}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                description={
                  editingLedgerEntry?.type === "payment"
                    ? "Leave empty for payment entries"
                    : "Required for purchase entries"
                }
                label="Bill Number"
                placeholder="Enter bill number (for purchases)"
                value={editLedgerEntryForm.billNumber}
                onChange={(e) =>
                  setEditLedgerEntryForm((prev) => ({
                    ...prev,
                    billNumber: e.target.value,
                  }))
                }
              />
              <Input
                isRequired
                label="Transaction Date *"
                type="date"
                value={editLedgerEntryForm.transactionDate}
                onChange={(e) =>
                  setEditLedgerEntryForm((prev) => ({
                    ...prev,
                    transactionDate: e.target.value,
                  }))
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  description={
                    editingLedgerEntry?.type === "purchase"
                      ? "For purchases"
                      : "Leave empty for payments"
                  }
                  isDisabled={!!editLedgerEntryForm.creditAmount}
                  label="Debit Amount"
                  min={0}
                  placeholder="0.00"
                  startContent="NPR"
                  step="0.01"
                  type="number"
                  value={editLedgerEntryForm.debitAmount}
                  onChange={(e) => {
                    const value = e.target.value;

                    setEditLedgerEntryForm((prev) => ({
                      ...prev,
                      debitAmount: value,
                      creditAmount: value ? "" : prev.creditAmount, // Clear credit if debit is entered
                    }));
                  }}
                />
                <Input
                  description={
                    editingLedgerEntry?.type === "payment"
                      ? "For payments"
                      : "Leave empty for purchases"
                  }
                  isDisabled={!!editLedgerEntryForm.debitAmount}
                  label="Credit Amount"
                  min={0}
                  placeholder="0.00"
                  startContent="NPR"
                  step="0.01"
                  type="number"
                  value={editLedgerEntryForm.creditAmount}
                  onChange={(e) => {
                    const value = e.target.value;

                    setEditLedgerEntryForm((prev) => ({
                      ...prev,
                      creditAmount: value,
                      debitAmount: value ? "" : prev.debitAmount, // Clear debit if credit is entered
                    }));
                  }}
                />
              </div>
              <Input
                label="Reference Number"
                placeholder="Optional reference or voucher number"
                value={editLedgerEntryForm.referenceNumber}
                onChange={(e) =>
                  setEditLedgerEntryForm((prev) => ({
                    ...prev,
                    referenceNumber: e.target.value,
                  }))
                }
              />
              <Input
                label="Notes"
                placeholder="Optional notes"
                value={editLedgerEntryForm.notes}
                onChange={(e) =>
                  setEditLedgerEntryForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              isDisabled={isSavingLedgerEntry}
              variant="light"
              onPress={() => {
                editLedgerEntryModalState.forceClose();
                setEditingLedgerEntry(null);
                setEditLedgerEntryForm({
                  billNumber: "",
                  transactionDate: new Date().toISOString().split("T")[0],
                  debitAmount: "",
                  creditAmount: "",
                  notes: "",
                  referenceNumber: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isSavingLedgerEntry}
              onPress={handleEditLedgerEntry}
            >
              Update Entry
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Payment Method Modal */}
      <Modal
        hideCloseButton={isSettingsLoading}
        isDismissable={!isSettingsLoading}
        isOpen={addPaymentMethodModalState.isOpen}
        size="2xl"
        onClose={() => {
          addPaymentMethodModalState.forceClose();
          resetPaymentMethodForm();
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Add Payment Method
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                label="Payment Method Name"
                placeholder="e.g., PayPal, Stripe, etc."
                value={paymentMethodForm.name}
                variant="bordered"
                onChange={(e) =>
                  setPaymentMethodForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />

              <Input
                description="Optional icon to display with the payment method"
                label="Icon (emoji or text)"
                placeholder="💳 or any emoji/text"
                value={paymentMethodForm.icon}
                variant="bordered"
                onChange={(e) =>
                  setPaymentMethodForm((prev) => ({
                    ...prev,
                    icon: e.target.value,
                  }))
                }
              />

              <Input
                label="Description"
                placeholder="Optional description of this payment method"
                value={paymentMethodForm.description}
                variant="bordered"
                onChange={(e) =>
                  setPaymentMethodForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />

              <div className="flex items-center space-x-2">
                <Switch
                  isSelected={paymentMethodForm.requiresReference}
                  onValueChange={(value) =>
                    setPaymentMethodForm((prev) => ({
                      ...prev,
                      requiresReference: value,
                    }))
                  }
                />
                <div>
                  <p className="text-sm font-medium text-default-900">
                    Requires reference number
                  </p>
                  <p className="text-xs text-default-500">
                    Transaction ID, check number, etc.
                  </p>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              isDisabled={isSettingsLoading}
              variant="light"
              onPress={() => {
                addPaymentMethodModalState.forceClose();
                resetPaymentMethodForm();
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={isSettingsLoading || !paymentMethodForm.name.trim()}
              isLoading={isSettingsLoading}
              onPress={handleAddPaymentMethod}
            >
              {isSettingsLoading ? "Adding..." : "Add Payment Method"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Payment Method Modal */}
      <Modal
        hideCloseButton={isSettingsLoading}
        isDismissable={!isSettingsLoading}
        isOpen={editPaymentMethodModalState.isOpen}
        size="2xl"
        onClose={() => {
          editPaymentMethodModalState.forceClose();
          resetPaymentMethodForm();
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Edit Payment Method
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                label="Payment Method Name"
                placeholder="e.g., PayPal, Stripe, etc."
                value={paymentMethodForm.name}
                variant="bordered"
                onChange={(e) =>
                  setPaymentMethodForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />

              <Input
                description="Optional icon to display with the payment method"
                label="Icon (emoji or text)"
                placeholder="💳 or any emoji/text"
                value={paymentMethodForm.icon}
                variant="bordered"
                onChange={(e) =>
                  setPaymentMethodForm((prev) => ({
                    ...prev,
                    icon: e.target.value,
                  }))
                }
              />

              <Input
                label="Description"
                placeholder="Optional description of this payment method"
                value={paymentMethodForm.description}
                variant="bordered"
                onChange={(e) =>
                  setPaymentMethodForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />

              <div className="flex items-center space-x-2">
                <Switch
                  isSelected={paymentMethodForm.requiresReference}
                  onValueChange={(value) =>
                    setPaymentMethodForm((prev) => ({
                      ...prev,
                      requiresReference: value,
                    }))
                  }
                />
                <div>
                  <p className="text-sm font-medium text-default-900">
                    Requires reference number
                  </p>
                  <p className="text-xs text-default-500">
                    Transaction ID, check number, etc.
                  </p>
                </div>
              </div>

              {editingPaymentMethod && !editingPaymentMethod.isCustom && (
                <Card className="bg-warning-50 border-warning-200">
                  <CardBody className="p-3">
                    <p className="text-sm text-warning-800">
                      <strong>Note:</strong> This is a default payment method.
                      You can modify its settings, but cannot delete it.
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              isDisabled={isSettingsLoading}
              variant="light"
              onPress={() => {
                editPaymentMethodModalState.forceClose();
                resetPaymentMethodForm();
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={isSettingsLoading || !paymentMethodForm.name.trim()}
              isLoading={isSettingsLoading}
              onPress={handleEditPaymentMethod}
            >
              {isSettingsLoading ? "Updating..." : "Update Payment Method"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        hideCloseButton={isSettingsLoading}
        isDismissable={!isSettingsLoading}
        isOpen={addItemModalState.isOpen}
        size="2xl"
        onClose={() => {
          addItemModalState.forceClose();
          setItemForm({
            name: "",
            description: "",
            purchasePrice: 0,
            salePrice: 0,
            category: "",
          });
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Add New Item
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                label="Item Name"
                placeholder="Enter item name"
                value={itemForm.name}
                variant="bordered"
                onChange={(e) =>
                  setItemForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />

              <Input
                label="Description"
                placeholder="Optional description"
                value={itemForm.description}
                variant="bordered"
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />

              <Input
                label="Category"
                placeholder="e.g., Medical Supplies, Equipment, etc."
                value={itemForm.category}
                variant="bordered"
                onChange={(e) =>
                  setItemForm((prev) => ({ ...prev, category: e.target.value }))
                }
              />

              <Input
                description="Optional - cost price of the item"
                label="Purchase Price"
                placeholder="0"
                startContent="NPR"
                type="number"
                value={itemForm.purchasePrice.toString()}
                variant="bordered"
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    purchasePrice: parseFloat(e.target.value) || 0,
                  }))
                }
              />

              <Input
                isRequired
                description="Required - selling price of the item"
                label="Sale Price *"
                placeholder="0"
                startContent="NPR"
                type="number"
                value={itemForm.salePrice.toString()}
                variant="bordered"
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    salePrice: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              isDisabled={isSettingsLoading}
              variant="light"
              onPress={() => {
                addItemModalState.forceClose();
                setItemForm({
                  name: "",
                  description: "",
                  purchasePrice: 0,
                  salePrice: 0,
                  category: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={
                isSettingsLoading ||
                !itemForm.name.trim() ||
                !itemForm.salePrice
              }
              isLoading={isSettingsLoading}
              onPress={handleAddItem}
            >
              {isSettingsLoading ? "Adding..." : "Add Item"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Manual Stock Adjustment Modal */}
      <Modal
        isOpen={adjustStockModalOpen}
        size="lg"
        onClose={() => setAdjustStockModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Manual Stock Adjustment: {selectedMedicineForAdjust?.name}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {selectedMedicineForAdjust?.genericName && (
                <p className="text-xs text-default-400 -mt-2 italic">
                  {selectedMedicineForAdjust.genericName}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Regular Stock Pool *"
                  type="number"
                  value={adjustForm.regularStock.toString()}
                  variant="bordered"
                  onChange={(e) =>
                    setAdjustForm((prev) => ({
                      ...prev,
                      regularStock: parseInt(e.target.value) || 0,
                    }))
                  }
                />
                <Input
                  label="Scheme Stock Pool *"
                  type="number"
                  value={adjustForm.schemeStock.toString()}
                  variant="bordered"
                  onChange={(e) =>
                    setAdjustForm((prev) => ({
                      ...prev,
                      schemeStock: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <Input
                label="Adjustment Reason *"
                placeholder="e.g. Audit reconciliation, damage write-off, initial count"
                value={adjustForm.reason}
                variant="bordered"
                onChange={(e) =>
                  setAdjustForm((prev) => ({ ...prev, reason: e.target.value }))
                }
              />

              <p className="text-[11px] text-default-400">
                Adjusting stock levels manually creates an audit trail entry in
                the medicine's transaction history (Stock Book) and updates the
                active dispensing levels.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              variant="light"
              onPress={() => setAdjustStockModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!adjustForm.reason.trim()}
              isLoading={isAdjustingStock}
              onPress={handleSaveStockAdjustment}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
