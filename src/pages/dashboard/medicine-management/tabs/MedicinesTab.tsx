import type { QueryDocumentSnapshot } from "firebase/firestore";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  IoAddOutline,
  IoListOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoMedkitOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoAddCircleOutline,
  IoCloseOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoAlertCircleOutline,
  IoCalendarOutline,
  IoLayersOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { medicineService } from "@/services/medicineService";
import {
  Medicine,
  MedicineBrand,
  MedicineCategory,
  ClinicSettings,
  Supplier,
} from "@/types/models";

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
  size?: "md" | "lg" | "xl" | "3xl" | "4xl" | "5xl";
  disabled?: boolean;
}) {
  const widthMap: Record<"md" | "lg" | "xl" | "3xl" | "4xl" | "5xl", string> = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "3xl": "max-w-5xl",
    "4xl": "max-w-6xl",
    "5xl": "max-w-7xl",
  };

  React.useEffect(() => {
    const el = (document.getElementById("dashboard-scroll-container") ??
      document.body) as HTMLElement;
    const prev = el.style.overflow;

    el.style.overflow = "hidden";

    return () => {
      el.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 overflow-hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose();
      }}
    >
      <div
        className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded w-full ${widthMap[size]} flex flex-col max-h-[90vh]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-[rgb(var(--color-border))/0.5] shrink-0 bg-[rgb(var(--color-surface-2))/0.3]">
          <div>
            <h3 className="text-[14px] font-semibold text-[rgb(var(--color-text))]">
              {title}
            </h3>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          {!disabled && (
            <button
              aria-label="Close modal"
              className="text-[rgb(var(--color-text-muted)/0.6)] hover:text-[rgb(var(--color-text))] mt-0.5 transition-colors"
              type="button"
              onClick={onClose}
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[rgb(var(--color-border))/0.5] shrink-0 bg-[rgb(var(--color-surface-2))/0.3]">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface MedicinesTabProps {
  clinicSettings: ClinicSettings | null;
  onStatsChange: () => void;
  filterType?:
    | "lowStock"
    | "expiring"
    | "medicines"
    | "brands"
    | "categories"
    | null;
  /**
   * Effective branch scope for this view.
   * For branch users this matches their fixed branchId.
   * For clinic admins this is the branch selected on the parent page.
   */
  effectiveBranchId?: string | null;
}

export default function MedicinesTab({
  clinicSettings,
  onStatsChange,
  filterType,
  effectiveBranchId,
}: MedicinesTabProps) {
  const { userData, clinicId } = useAuthContext();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [masterMedicines, setMasterMedicines] = useState<Medicine[]>([]);
  const [medicineStocks, setMedicineStocks] = useState<Record<string, number>>(
    {},
  );
  const [medicineSchemeStocks, setMedicineSchemeStocks] = useState<
    Record<string, number>
  >({});
  const [medicineExpiryDates, setMedicineExpiryDates] = useState<
    Record<string, Date>
  >({});
  const [brands, setBrands] = useState<MedicineBrand[]>([]);
  const [categories, setCategories] = useState<MedicineCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const modalState = useModalState(false);
  const refillModalState = useModalState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMedicine, setCurrentMedicine] = useState<Medicine | null>(null);
  const [medicineForRefill, setMedicineForRefill] = useState<Medicine | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [cursorByPage, setCursorByPage] = useState<
    Record<number, QueryDocumentSnapshot | null>
  >({});
  const [newSupplierName, setNewSupplierName] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<Medicine[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [newTypeName, setNewTypeName] = useState("");
  const [expiryStats, setExpiryStats] = useState({
    expired: 0,
    urgent: 0,
    warning: 0,
    lowStock: 0,
  });

  const [activeFilterType, setActiveFilterType] = useState<string | null>(
    filterType || null,
  );

  useEffect(() => {
    if (filterType) setActiveFilterType(filterType);
  }, [filterType]);

  const [formDataList, setFormDataList] = useState<any[]>([
    {
      name: "",
      genericName: "",
      brandId: "",
      categoryId: "",
      type: "tablet",
      strength: "",
      unit: "tablet",
      description: "",
      supplierId: "", // Will be deprecated in favor of global
      batchNumber: "",
      expiryDate: "",
      price: "",
      costPrice: "",
      barcode: "",
      currentStock: "",
      isAddingSupplier: false, // Will be deprecated
      newSupplierName: "", // Will be deprecated
      isAddingType: false,
      newTypeName: "",
      isAddingBrand: false,
      newBrandName: "",
      isAddingCategory: false,
      newCategoryName: "",
      isVatApplied: false,
      vatPercentage: 13,
    },
  ]);

  const [globalPurchaseDetails, setGlobalPurchaseDetails] = useState({
    supplierId: "",
    billNumber: "",
    isAddingSupplier: false,
    newSupplierName: "",
    paidAmount: "",
    paymentMethod: "cash",
  });

  const purchaseSummary = useMemo(() => {
    let subtotal = 0;
    let taxableAmount = 0;
    let nonTaxableAmount = 0;
    let totalVat = 0;

    formDataList.forEach((item) => {
      const qty = parseFloat(item.currentStock) || 0;
      const cost = parseFloat(item.costPrice) || 0;
      const itemTotal = qty * cost;

      if (item.isVatApplied) {
        taxableAmount += itemTotal;
        totalVat += itemTotal * (parseFloat(item.vatPercentage) / 100);
      } else {
        nonTaxableAmount += itemTotal;
      }
      subtotal += itemTotal;
    });

    return {
      subtotal,
      taxableAmount,
      nonTaxableAmount,
      totalVat,
      grandTotal: subtotal + totalVat,
    };
  }, [formDataList]);

  const generateBillNumber = () => {
    const now = new Date();
    const datePart = now.toISOString().split("T")[0].replace(/-/g, "");
    const randomPart = Math.floor(1000 + Math.random() * 9000);

    return `BILL-${datePart}-${randomPart}`;
  };

  const [refillFormData, setRefillFormData] = useState({
    regularQuantity: "",
    schemeQuantity: "",
    regularSalePrice: "",
    regularCostPrice: "",
    schemePrice: "",
    schemeCostPrice: "",
    expiryDate: "",
    batchNumber: "",
    unitPrice: "",
    invoiceNumber: "",
    supplierId: "",
    transactionType: "add" as "add" | "sub",
  });

  const useServerPagination =
    !activeFilterType &&
    filterType !== "lowStock" &&
    filterType !== "expiring" &&
    !searchQuery.trim();

  const branchScopeId = effectiveBranchId ?? userData?.branchId ?? null;

  const fetchMedicinesPaginated = useCallback(
    async (
      targetPage: number,
      cursor?: QueryDocumentSnapshot | null,
      searchPrefix?: string,
    ) => {
      if (!clinicId) return;
      setIsLoading(true);
      try {
        const prefix = searchPrefix ?? (searchQuery.trim() || undefined);
        const startAfterDoc =
          targetPage === 1 ? undefined : (cursor ?? undefined);
        const { medicines: pageMedicines, lastDoc: nextLastDoc } =
          await medicineService.getMedicinesByClinicPaginated(clinicId, {
            pageSize: rowsPerPage,
            lastDoc: startAfterDoc ?? undefined,
            searchPrefix: prefix,
            branchId: branchScopeId || undefined,
          });

        setMedicines(pageMedicines);
        setLastDoc(nextLastDoc);
        if (targetPage === 1) {
          const count = await medicineService.getMedicinesCountByClinic(
            clinicId,
            prefix,
            branchScopeId || undefined,
          );

          setTotalCount(count);
        }
        setCursorByPage((prev) => ({
          ...prev,
          [targetPage + 1]: nextLastDoc,
        }));
        const ids = pageMedicines.map((m) => m.id);
        const stockList = await medicineService.getStockByMedicineIds(
          clinicId,
          ids,
          branchScopeId || undefined,
        );
        const stockMap: Record<string, number> = {};
        const schemeStockMap: Record<string, number> = {};

        stockList.forEach((s) => {
          stockMap[s.medicineId] =
            (stockMap[s.medicineId] || 0) + s.currentStock;
          schemeStockMap[s.medicineId] =
            (schemeStockMap[s.medicineId] || 0) + s.schemeStock;
        });
        setMedicineStocks(stockMap);
        setMedicineSchemeStocks(schemeStockMap);
        const expiryMap =
          await medicineService.getExpiryDatesForMedicineIds(ids);

        setMedicineExpiryDates(expiryMap);
      } catch (error) {
        console.error("Error fetching medicines (paginated):", error);
        addToast({
          title: "Error",
          description: "Failed to load medicines",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [clinicId, searchQuery, rowsPerPage, branchScopeId],
  );

  useEffect(() => {
    if (!clinicId) return;
    setPage(1);
    setCursorByPage({});
    if (useServerPagination) {
      fetchMedicinesPaginated(1, undefined, searchQuery.trim() || undefined);
    } else {
      fetchMedicines();
    }
    fetchBrands();
    fetchCategories();
    fetchSuppliers();
    fetchMasterMedicines();
    fetchExpiryStats();
  }, [
    clinicId,
    activeFilterType,
    filterType,
    searchQuery,
    useServerPagination,
    fetchMedicinesPaginated,
    branchScopeId,
  ]);

  const fetchMasterMedicines = async () => {
    if (!clinicId) return;
    try {
      const data = await medicineService.getMedicinesByClinic(
        clinicId,
        undefined,
        branchScopeId || undefined,
      );

      setMasterMedicines(data);
    } catch (error) {
      console.error("Error fetching master medicines:", error);
    }
  };

  const fetchExpiryStats = async () => {
    if (!clinicId) return;
    try {
      // Fetch 90 days ahead to categorize
      const warnings = await medicineService.getExpiringMedicines(clinicId, 90);
      const lowStock = await medicineService.getLowStockItems(clinicId);

      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      let expired = 0;
      let urgent = 0;
      let warning = 0;

      warnings.forEach((m) => {
        const rawExp = medicineExpiryDates[m.id] || m.expiryDate;
        const expiryDate = rawExp
          ? rawExp instanceof Date
            ? rawExp
            : typeof (rawExp as any)?.toDate === "function"
              ? (rawExp as any).toDate()
              : new Date(rawExp)
          : null;

        if (expiryDate) {
          if (expiryDate < now) expired++;
          else if (expiryDate < thirtyDays) urgent++;
          else warning++;
        }
      });

      setExpiryStats({
        expired,
        urgent,
        warning,
        lowStock: lowStock.length,
      });
    } catch (error) {
      console.warn("Error fetching expiry stats:", error);
    }
  };

  const fetchSuppliers = async () => {
    if (!clinicId) return;

    try {
      const data = await medicineService.getSuppliersByClinic(
        clinicId,
        branchScopeId || undefined,
      );

      setSuppliers(data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const fetchMedicines = async () => {
    if (!clinicId) return;

    setIsLoading(true);
    try {
      const data = await medicineService.getMedicinesByClinic(
        clinicId,
        undefined,
        branchScopeId || undefined,
      );

      setMedicines(data);

      // Fetch stock information for each medicine - use batch approach for better performance
      const stockMap: Record<string, number> = {};
      const schemeStockMap: Record<string, number> = {};
      const expiryMap: Record<string, Date> = {};

      try {
        // Use the existing getStockByClinic method which handles permissions properly
        const stockData = await medicineService.getStockByClinic(
          clinicId,
          branchScopeId || undefined,
        );

        // Map medicine IDs to stock quantities (both regular and scheme)
        stockData.forEach((stock) => {
          stockMap[stock.medicineId] =
            (stockMap[stock.medicineId] || 0) + stock.currentStock;
          schemeStockMap[stock.medicineId] =
            (schemeStockMap[stock.medicineId] || 0) + (stock.schemeStock || 0);
        });
      } catch (stockError) {
        console.warn("Could not fetch stock data:", stockError);
        // Continue without stock data if there are permission issues
      }

      // Fetch expiry dates from stock transactions for each medicine
      try {
        await Promise.all(
          data.map(async (medicine) => {
            try {
              // Get the latest stock transaction with expiry date
              const transactions = await medicineService.getStockTransactions(
                medicine.id,
                50,
                branchScopeId || undefined,
              );
              // Find the most recent transaction with an expiry date
              const transactionWithExpiry = transactions
                .filter((t) => t.expiryDate)
                .sort((a, b) => {
                  // Sort by createdAt descending to get the most recent
                  const dateA = a.createdAt?.getTime() || 0;
                  const dateB = b.createdAt?.getTime() || 0;

                  return dateB - dateA;
                })[0];

              if (transactionWithExpiry?.expiryDate) {
                expiryMap[medicine.id] = transactionWithExpiry.expiryDate;
              }
            } catch (error) {
              console.warn(
                `Could not fetch transactions for medicine ${medicine.id}:`,
                error,
              );
              // Continue without expiry date for this medicine
            }
          }),
        );
      } catch (expiryError) {
        console.warn(
          "Could not fetch expiry dates from transactions:",
          expiryError,
        );
        // Continue without expiry dates if there are permission issues
      }

      setMedicineStocks(stockMap);
      setMedicineSchemeStocks(schemeStockMap);
      setMedicineExpiryDates(expiryMap);
    } catch (error) {
      console.error("Error fetching medicines:", error);
      addToast({
        title: "Error",
        description: "Failed to load medicines",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBrands = async () => {
    if (!clinicId) return;

    try {
      const data = await medicineService.getMedicineBrandsByClinic(clinicId);

      setBrands(data.filter((brand) => brand.isActive));
    } catch (error) {
      console.error("Error fetching brands:", error);
    }
  };

  const fetchCategories = async () => {
    if (!clinicId) return;

    try {
      const data =
        await medicineService.getMedicineCategoriesByClinic(clinicId);

      setCategories(data.filter((category) => category.isActive));
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const handleFocus = (index: number) => {
    const value = formDataList[index].name;

    if (value.trim().length >= 2) {
      const lowerValue = value.toLowerCase().trim();
      const filtered = masterMedicines.filter(
        (m) =>
          m.name.toLowerCase().includes(lowerValue) ||
          m.genericName?.toLowerCase().includes(lowerValue),
      );

      setNameSuggestions(filtered.slice(0, 5));
      setShowSuggestions(true);
      setFocusedRowIndex(index);
    }
  };

  const handleChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;

    setFormDataList((prev) => {
      const newList = [...prev];

      newList[index] = {
        ...newList[index],
        [name]:
          type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
      };

      // Handle medicine name suggestions for this specific row using master list
      if (name === "name") {
        if (value.trim().length >= 2) {
          const lowerValue = value.toLowerCase().trim();
          const filtered = masterMedicines.filter(
            (m) =>
              m.name.toLowerCase().includes(lowerValue) ||
              m.genericName?.toLowerCase().includes(lowerValue),
          );

          setNameSuggestions(filtered.slice(0, 5));
          setShowSuggestions(true);
          // Set current focused index so we know which row to update
          setFocusedRowIndex(index);
        } else {
          setNameSuggestions([]);
          setShowSuggestions(false);
        }
      }

      return newList;
    });
  };

  const handleSelectChangeRow = (
    index: number,
    name: string,
    value: string,
  ) => {
    modalState.handleDropdownInteraction();
    setTimeout(() => {
      setFormDataList((prev) => {
        const newList = [...prev];

        newList[index] = {
          ...newList[index],
          [name]: value,
        };

        return newList;
      });
    }, 0);
  };

  const handleBlur = () => {
    // Small delay to allow click on suggestion to register before closing
    setTimeout(() => {
      setShowSuggestions(false);
      setFocusedRowIndex(null);
    }, 150);
  };

  const addRow = () => {
    setFormDataList((prev) => [
      ...prev,
      {
        ...prev[0], // Copy defaults from first row
        name: "",
        genericName: "",
        batchNumber: "",
        barcode: "",
        currentStock: "",
        description: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (formDataList.length > 1) {
      setFormDataList((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSelectSuggestion = (index: number, medicine: Medicine) => {
    setFormDataList((prev) => {
      const newList = [...prev];

      newList[index] = {
        ...newList[index],
        name: medicine.name,
        genericName: medicine.genericName || "",
        brandId: medicine.brandId || "",
        categoryId: medicine.categoryId || "",
        type: medicine.type,
        strength: medicine.strength || "",
        unit: medicine.unit,
        description: medicine.description || "",
        supplierId: medicine.supplierId || "",
        price: medicine.price?.toString() || "",
        costPrice: medicine.costPrice?.toString() || "",
        isVatApplied: medicine.isVatApplied || false,
        vatPercentage: medicine.vatPercentage || 13,
      };

      return newList;
    });
    setNameSuggestions([]);
    setShowSuggestions(false);
    setFocusedRowIndex(null);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleSelectChange = (index: number, name: string, value: string) => {
    // Prevent modal from closing due to select events
    modalState.handleDropdownInteraction();
    setTimeout(() => {
      setFormDataList((prev) => {
        const newList = [...prev];

        newList[index] = {
          ...newList[index],
          [name]: value,
        };

        return newList;
      });
    }, 0);
  };

  const openAddModal = () => {
    setCurrentMedicine(null);
    setGlobalPurchaseDetails({
      supplierId: "",
      billNumber: generateBillNumber(),
      isAddingSupplier: false,
      newSupplierName: "",
      paidAmount: "",
      paymentMethod: "cash",
    });
    setFormDataList([
      {
        name: "",
        genericName: "",
        brandId: "",
        categoryId: "",
        type: "tablet",
        strength: "",
        unit: "tablet",
        description: "",
        supplierId: "",
        batchNumber: "",
        expiryDate: "",
        price: "",
        costPrice: "",
        barcode: "",
        currentStock: "",
        isAddingSupplier: false,
        newSupplierName: "",
        isAddingType: false,
        newTypeName: "",
        isAddingBrand: false,
        newBrandName: "",
        isAddingCategory: false,
        newCategoryName: "",
        isVatApplied: false,
        vatPercentage: 13,
      },
    ]);
    modalState.open();
  };

  const openEditModal = async (medicine: Medicine) => {
    setCurrentMedicine(medicine);

    // Get current stock from our existing state first, then try to fetch if not available
    let currentStockValue = "";
    const existingStock = medicineStocks[medicine.id];

    if (existingStock !== undefined) {
      currentStockValue = existingStock.toString();
    } else {
      // Try to fetch individual stock if not in our state
      try {
        const stock = await medicineService.getMedicineStock(
          medicine.id,
          clinicId,
        );

        currentStockValue = stock ? stock.currentStock.toString() : "";
      } catch (error) {
        console.warn("Could not fetch stock for medicine:", medicine.id, error);
        // Continue without stock value if there are permission issues
        currentStockValue = "";
      }
    }

    const formatDateSafe = (dateObj: any) => {
      if (!dateObj) return "";
      try {
        if (typeof dateObj.toDate === "function")
          return dateObj.toDate().toISOString().split("T")[0];
        if (dateObj instanceof Date) return dateObj.toISOString().split("T")[0];

        return new Date(dateObj).toISOString().split("T")[0];
      } catch (e) {
        return "";
      }
    };

    let resolvedBatchNumber = medicine.batchNumber || "";
    let resolvedExpiryDate =
      formatDateSafe(medicine.expiryDate) ||
      formatDateSafe(medicineExpiryDates[medicine.id]);

    if (!resolvedBatchNumber || !resolvedExpiryDate) {
      try {
        const txs = await medicineService.getStockTransactions(
          medicine.id,
          5,
          branchScopeId || undefined,
        );
        // Find the most recent transaction that has the missing data
        const txWithBatch = txs.find((t) => t.batchNumber);
        const txWithExpiry = txs.find((t) => t.expiryDate);

        if (!resolvedBatchNumber && txWithBatch?.batchNumber) {
          resolvedBatchNumber = txWithBatch.batchNumber;
        }
        if (!resolvedExpiryDate && txWithExpiry?.expiryDate) {
          resolvedExpiryDate = formatDateSafe(txWithExpiry.expiryDate);
        }
      } catch (e) {
        console.warn("Could not fetch latest transactions for edit modal", e);
      }
    }

    setGlobalPurchaseDetails({
      supplierId: medicine.supplierId || "",
      billNumber: "",
      isAddingSupplier: false,
      newSupplierName: "",
      paidAmount: "",
      paymentMethod: "cash",
    });

    setFormDataList([
      {
        name: medicine.name,
        genericName: medicine.genericName || "",
        brandId: medicine.brandId || "",
        categoryId: medicine.categoryId || "",
        type: medicine.type,
        strength: medicine.strength || "",
        unit: medicine.unit,
        description: medicine.description || "",
        supplierId: medicine.supplierId || "",
        batchNumber: resolvedBatchNumber,
        expiryDate: resolvedExpiryDate,
        price: medicine.price?.toString() || "",
        costPrice: medicine.costPrice?.toString() || "",
        barcode: medicine.barcode || "",
        currentStock: currentStockValue,
        isAddingSupplier: false,
        newSupplierName: "",
        isAddingType: false,
        newTypeName: "",
        isAddingBrand: false,
        newBrandName: "",
        isAddingCategory: false,
        newCategoryName: "",
        isVatApplied: medicine.isVatApplied || false,
        vatPercentage: medicine.vatPercentage || 13,
      },
    ]);
    modalState.open();
  };

  const handleSave = async () => {
    console.log("HandleSave triggered", {
      clinicId,
      userDataId: userData?.id,
      formDataList,
    });
    if (!clinicId || !userData?.id) {
      addToast({
        title: "Error",
        description: "Missing required information. Please try again.",
      });

      return;
    }

    // Validate all rows
    for (let i = 0; i < formDataList.length; i++) {
      const row = formDataList[i];
      const rowNum = formDataList.length > 1 ? ` (Row ${i + 1})` : "";

      if (!row.name.trim()) {
        addToast({
          title: "Validation Error",
          description: `Medicine name is required${rowNum}`,
          color: "danger",
        });

        return;
      }
      if (!row.type) {
        addToast({
          title: "Validation Error",
          description: `Medicine type is required${rowNum}`,
          color: "danger",
        });

        return;
      }

      if (!row.price.trim()) {
        addToast({
          title: "Validation Error",
          description: `MRP (Sale Price) is required${rowNum}`,
          color: "danger",
        });

        return;
      }

      // Removed validation that blocks adding same medicine name to allow updating existing stocks via Add modal
    }

    console.log("Validation passed, starting save loop...");

    setIsLoading(true);
    try {
      let finalSupplierId = globalPurchaseDetails.supplierId;
      let finalSupplierName =
        suppliers.find((s) => s.id === finalSupplierId)?.name || "";

      // Handle Quick Add Global Supplier
      if (
        globalPurchaseDetails.isAddingSupplier &&
        globalPurchaseDetails.newSupplierName.trim()
      ) {
        const supplierData = {
          name: globalPurchaseDetails.newSupplierName.trim(),
          clinicId,
          branchId: branchScopeId || "",
          isActive: true,
          createdBy: userData.id,
        };

        finalSupplierId = await medicineService.createSupplier(supplierData);
        finalSupplierName = supplierData.name;
        // We will fetchSuppliers later
      }

      for (const row of formDataList) {
        // Handle Quick Add Brand
        let rowBrandId = row.brandId;

        if (row.isAddingBrand && row.newBrandName.trim()) {
          const brandData = {
            name: row.newBrandName.trim(),
            clinicId,
            branchId: branchScopeId || "",
            isActive: true,
            createdBy: userData.id,
          };

          rowBrandId = await medicineService.createMedicineBrand(brandData);
        }

        // Handle Quick Add Category
        let rowCategoryId = row.categoryId;

        if (row.isAddingCategory && row.newCategoryName.trim()) {
          const categoryData = {
            name: row.newCategoryName.trim(),
            clinicId,
            branchId: branchScopeId || "",
            isActive: true,
            createdBy: userData.id,
          };

          rowCategoryId =
            await medicineService.createMedicineCategory(categoryData);
        }

        const medicineData: any = {
          name: row.name.trim(),
          type: row.type,
          unit: row.unit,
          isActive: true,
          clinicId,
          branchId: branchScopeId || "",
          createdBy: userData.id,
          supplierId: finalSupplierId,
          prescriptionRequired: false, // Default for now
        };

        if (row.genericName.trim())
          medicineData.genericName = row.genericName.trim();
        if (rowBrandId) medicineData.brandId = rowBrandId;
        if (rowCategoryId) medicineData.categoryId = rowCategoryId;
        if (row.strength.trim()) medicineData.strength = row.strength.trim();
        if (row.description.trim())
          medicineData.description = row.description.trim();
        if (row.batchNumber.trim())
          medicineData.batchNumber = row.batchNumber.trim();
        if (row.expiryDate) medicineData.expiryDate = new Date(row.expiryDate);
        if (row.price) medicineData.price = parseFloat(row.price);
        if (row.costPrice) medicineData.costPrice = parseFloat(row.costPrice);
        if (row.barcode.trim()) medicineData.barcode = row.barcode.trim();
        medicineData.isVatApplied = row.isVatApplied || false;
        medicineData.vatPercentage = parseFloat(row.vatPercentage) || 0;

        if (currentMedicine) {
          // Do not overwrite batch-specific pricing and inventory metadata on the medicine master document
          delete medicineData.price;
          delete medicineData.costPrice;
          delete medicineData.batchNumber;
          delete medicineData.expiryDate;

          await medicineService.updateMedicine(
            currentMedicine.id,
            medicineData,
          );
        } else {
          // Check if medicine with this name already exists using master list
          const existingMedicine = masterMedicines.find(
            (m) => m.name.toLowerCase() === row.name.trim().toLowerCase(),
          );

          let medicineId;

          if (existingMedicine) {
            medicineId = existingMedicine.id;
            await medicineService.updateMedicine(medicineId, medicineData);
          } else {
            medicineId = await medicineService.createMedicine(medicineData);
          }

          if (row.currentStock) {
            const addedStock = parseFloat(row.currentStock);
            const existingStock = await medicineService.getMedicineStock(
              medicineId,
              clinicId,
            );
            const previousStock = existingStock?.currentStock || 0;

            if (existingStock) {
              await medicineService.updateMedicineStock(existingStock.id, {
                currentStock: previousStock + addedStock,
                updatedBy: userData.id,
              });
            } else {
              await medicineService.createMedicineStock({
                medicineId,
                currentStock: addedStock,
                schemeStock: 0,
                minimumStock: 10,
                reorderLevel: 20,
                clinicId,
                branchId: branchScopeId || "",
                updatedBy: userData.id,
                batchNumber: row.batchNumber || "",
                expiryDate: row.expiryDate
                  ? new Date(row.expiryDate)
                  : undefined,
                costPrice: row.costPrice
                  ? parseFloat(row.costPrice)
                  : undefined,
                salePrice: row.price ? parseFloat(row.price) : undefined,
                supplierId: finalSupplierId || undefined,
                invoiceNumber: globalPurchaseDetails.billNumber || undefined,
              });
            }

            // Create stock transaction for audit
            if (addedStock !== 0) {
              await medicineService.createStockTransaction({
                medicineId: medicineId,
                type: "purchase",
                quantity: addedStock,
                previousStock: previousStock,
                newStock: previousStock + addedStock,
                batchNumber: row.batchNumber,
                expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
                supplierId: finalSupplierId,
                invoiceNumber: globalPurchaseDetails.billNumber,
                salePrice: row.price ? parseFloat(row.price) : null,
                costPrice: row.costPrice ? parseFloat(row.costPrice) : null,
                clinicId,
                branchId: branchScopeId || "",
                createdBy: userData.id,
              });
            }
          }
        }
        console.log(`Saved row: ${row.name}`);
      }

      // Create Supplier Purchase Record (Invoice) for new medicines
      if (!currentMedicine && finalSupplierId && formDataList.length > 0) {
        try {
          const paidAmt = parseFloat(globalPurchaseDetails.paidAmount) || 0;
          const totalAmt = purchaseSummary.grandTotal;
          const dueAmt = Math.max(0, totalAmt - paidAmt);

          let paymentStatus: "paid" | "partial" | "pending" = "pending";

          if (totalAmt > 0) {
            if (paidAmt >= totalAmt) paymentStatus = "paid";
            else if (paidAmt > 0) paymentStatus = "partial";
            else paymentStatus = "pending";
          }

          await medicineService.createSupplierPurchaseRecord({
            supplierId: finalSupplierId,
            supplierName: finalSupplierName || "Unknown Supplier",
            purchaseDate: new Date(),
            billNumber:
              globalPurchaseDetails.billNumber || `AUTO-${Date.now()}`,
            totalAmount: totalAmt,
            paidAmount: paidAmt,
            dueAmount: dueAmt,
            paymentStatus: paymentStatus,
            paymentDone: paidAmt >= totalAmt,
            paymentMethod: globalPurchaseDetails.paymentMethod,
            notes: `Purchase record for ${formDataList.length} medicines`,
            items: formDataList.map((row) => ({
              name: row.name,
              qty: parseFloat(row.currentStock) || 0,
              costPrice: parseFloat(row.costPrice) || 0,
              vatPercentage: row.isVatApplied
                ? parseFloat(row.vatPercentage)
                : 0,
              total:
                (parseFloat(row.costPrice) || 0) *
                (parseFloat(row.currentStock) || 0) *
                (1 +
                  (row.isVatApplied ? parseFloat(row.vatPercentage) : 0) / 100),
            })),
            clinicId,
            branchId: branchScopeId || "",
            createdBy: userData.id,
          });
          console.log("Purchase record created successfully");
        } catch (error) {
          console.error("Error creating purchase record:", error);
          // Don't fail the whole process if purchase record creation fails
        }
      }

      console.log(
        "All rows processed, fetching suppliers, brands and categories...",
      );
      await Promise.all([fetchSuppliers(), fetchBrands(), fetchCategories()]);

      addToast({
        title: "Success",
        description: currentMedicine
          ? "Medicine updated successfully"
          : `Successfully added ${formDataList.length} medicines and generated invoice`,
      });

      modalState.forceClose();
      fetchMedicines();
      if (onStatsChange) onStatsChange();
    } catch (error) {
      console.error("Error saving medicines:", error);
      addToast({
        title: "Error",
        description: "Failed to save medicines. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (medicine: Medicine) => {
    setIsLoading(true);
    try {
      await medicineService.updateMedicine(medicine.id, {
        isActive: !medicine.isActive,
      });
      addToast({
        title: "Success",
        description: `Medicine ${medicine.isActive ? "deactivated" : "activated"} successfully`,
      });
      if (useServerPagination) {
        fetchMedicinesPaginated(
          page,
          page === 1 ? undefined : (cursorByPage[page] ?? null),
        );
      } else {
        fetchMedicines();
      }
      onStatsChange();
    } catch (error) {
      console.error("Error toggling medicine status:", error);
      addToast({
        title: "Error",
        description: "Failed to update medicine status",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedMedicines = async () => {
    if (!clinicId || !userData?.id) return;
    setIsLoading(true);
    try {
      await medicineService.seedDefaultMedicines(
        clinicId,
        branchScopeId || undefined,
        userData.id,
      );
      addToast({
        title: "Success",
        description: "Default medicines seeded successfully",
      });
      if (useServerPagination) {
        fetchMedicinesPaginated(1);
      } else {
        fetchMedicines();
      }
      onStatsChange();
    } catch (error) {
      console.error("Error seeding medicines:", error);
      addToast({
        title: "Error",
        description: "Failed to seed medicines",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefillStock = async () => {
    // Validate that at least one quantity is provided
    const regularQty = parseInt(refillFormData.regularQuantity) || 0;
    const schemeQty = parseInt(refillFormData.schemeQuantity) || 0;

    if (!medicineForRefill || (regularQty === 0 && schemeQty === 0)) {
      addToast({
        title: "Validation Error",
        description: "Please fill in at least one quantity (regular or scheme)",
        color: "danger",
      });

      return;
    }

    if (!refillFormData.expiryDate) {
      addToast({
        title: "Validation Error",
        description: "Please fill in expiry date",
        color: "danger",
      });

      return;
    }

    if (!clinicId || !userData?.id) return;

    setIsLoading(true);
    try {
      // Get current stock for this specific batch
      const batchNum = refillFormData.batchNumber || "DEFAULT";
      const existingStock = await medicineService.getMedicineStockByBatch(
        medicineForRefill.id,
        batchNum,
        clinicId,
      );
      const currentRegularStock = existingStock?.currentStock || 0;
      const currentSchemeStock = existingStock?.schemeStock || 0;

      const isAdd = refillFormData.transactionType === "add";
      const newRegularStock = isAdd
        ? currentRegularStock + regularQty
        : currentRegularStock - regularQty;
      const newSchemeStock = isAdd
        ? currentSchemeStock + schemeQty
        : currentSchemeStock - schemeQty;

      // Create stock transaction for regular stock if quantity !== 0
      if (regularQty !== 0) {
        const regularTransactionData: any = {
          medicineId: medicineForRefill.id,
          type: isAdd ? ("purchase" as const) : ("adjustment" as const),
          quantity: isAdd ? regularQty : -regularQty,
          previousStock: currentRegularStock,
          newStock: newRegularStock,
          expiryDate: new Date(refillFormData.expiryDate),
          isSchemeStock: false,
          clinicId,
          branchId: branchScopeId || "",
          createdBy: userData.id,
        };

        // Add price fields if provided
        if (refillFormData.regularSalePrice) {
          regularTransactionData.salePrice = parseFloat(
            refillFormData.regularSalePrice,
          );
        }
        if (refillFormData.regularCostPrice) {
          regularTransactionData.costPrice = parseFloat(
            refillFormData.regularCostPrice,
          );
        }
        // Legacy unitPrice for backward compatibility
        if (refillFormData.unitPrice) {
          regularTransactionData.unitPrice = parseFloat(
            refillFormData.unitPrice,
          );
          regularTransactionData.totalAmount =
            parseFloat(refillFormData.unitPrice) * regularQty;
        } else if (refillFormData.regularSalePrice) {
          regularTransactionData.totalAmount =
            parseFloat(refillFormData.regularSalePrice) * regularQty;
        }

        if (refillFormData.batchNumber) {
          regularTransactionData.batchNumber = refillFormData.batchNumber;
        }
        if (refillFormData.invoiceNumber) {
          regularTransactionData.invoiceNumber = refillFormData.invoiceNumber;
        }
        if (refillFormData.supplierId) {
          regularTransactionData.supplierId = refillFormData.supplierId;
        }

        await medicineService.createStockTransaction(regularTransactionData);
      }

      // Create stock transaction for scheme stock if quantity !== 0
      if (schemeQty !== 0) {
        const schemeTransactionData: any = {
          medicineId: medicineForRefill.id,
          type: isAdd ? ("purchase" as const) : ("adjustment" as const),
          quantity: isAdd ? schemeQty : -schemeQty,
          previousStock: currentSchemeStock,
          newStock: newSchemeStock,
          expiryDate: new Date(refillFormData.expiryDate),
          isSchemeStock: true,
          clinicId,
          branchId: branchScopeId || "",
          createdBy: userData.id,
        };

        // Add scheme price if provided
        if (refillFormData.schemePrice) {
          schemeTransactionData.schemePrice = parseFloat(
            refillFormData.schemePrice,
          );
          schemeTransactionData.salePrice = parseFloat(
            refillFormData.schemePrice,
          );
          schemeTransactionData.totalAmount =
            parseFloat(refillFormData.schemePrice) * schemeQty;
        }

        // Add scheme cost price if provided
        if (refillFormData.schemeCostPrice) {
          schemeTransactionData.costPrice = parseFloat(
            refillFormData.schemeCostPrice,
          );
        }

        if (refillFormData.batchNumber) {
          schemeTransactionData.batchNumber = refillFormData.batchNumber;
        }
        if (refillFormData.invoiceNumber) {
          schemeTransactionData.invoiceNumber = refillFormData.invoiceNumber;
        }
        if (refillFormData.supplierId) {
          schemeTransactionData.supplierId = refillFormData.supplierId;
        }

        await medicineService.createStockTransaction(schemeTransactionData);
      }

      // Update or create stock record
      if (existingStock) {
        await medicineService.updateMedicineStock(existingStock.id, {
          currentStock: newRegularStock,
          schemeStock: newSchemeStock,
          lastRestocked: new Date(),
          updatedBy: userData.id,
          // Sync batch prices and expiry on existing batch refill
          expiryDate: refillFormData.expiryDate
            ? new Date(refillFormData.expiryDate)
            : existingStock.expiryDate,
          costPrice: refillFormData.regularCostPrice
            ? parseFloat(refillFormData.regularCostPrice)
            : existingStock.costPrice,
          salePrice: refillFormData.regularSalePrice
            ? parseFloat(refillFormData.regularSalePrice)
            : existingStock.salePrice,
          supplierId:
            refillFormData.supplierId || existingStock.supplierId || "",
        });
      } else {
        await medicineService.createMedicineStock({
          medicineId: medicineForRefill.id,
          currentStock: newRegularStock,
          schemeStock: newSchemeStock,
          minimumStock: 10,
          reorderLevel: 20,
          clinicId,
          branchId: branchScopeId || "",
          updatedBy: userData.id,
          batchNumber: batchNum,
          expiryDate: refillFormData.expiryDate
            ? new Date(refillFormData.expiryDate)
            : undefined,
          costPrice: refillFormData.regularCostPrice
            ? parseFloat(refillFormData.regularCostPrice)
            : undefined,
          salePrice: refillFormData.regularSalePrice
            ? parseFloat(refillFormData.regularSalePrice)
            : undefined,
          supplierId: refillFormData.supplierId || undefined,
        });
      }

      // Update core medicine details with latest batch info if it's a purchase/addition
      if (isAdd) {
        const medicineUpdateData: Partial<Medicine> = {};

        if (refillFormData.regularSalePrice) {
          medicineUpdateData.price = parseFloat(
            refillFormData.regularSalePrice,
          );
        }
        if (refillFormData.regularCostPrice) {
          medicineUpdateData.costPrice = parseFloat(
            refillFormData.regularCostPrice,
          );
        }
        if (refillFormData.batchNumber) {
          medicineUpdateData.batchNumber = refillFormData.batchNumber;
        }
        if (refillFormData.expiryDate) {
          medicineUpdateData.expiryDate = new Date(refillFormData.expiryDate);
        }
        if (refillFormData.supplierId) {
          medicineUpdateData.supplierId = refillFormData.supplierId;
        }

        if (Object.keys(medicineUpdateData).length > 0) {
          await medicineService.updateMedicine(
            medicineForRefill.id,
            medicineUpdateData,
          );
        }
      }

      // Create Supplier Purchase Record for refill if it's a purchase
      if (isAdd && refillFormData.supplierId) {
        try {
          const regularCost =
            (parseFloat(refillFormData.regularCostPrice) || 0) * regularQty;
          const schemeCost =
            (parseFloat(refillFormData.schemeCostPrice) || 0) * schemeQty;
          const totalCost = regularCost + schemeCost;

          if (totalCost > 0) {
            const supplier = suppliers.find(
              (s) => s.id === refillFormData.supplierId,
            );

            await medicineService.createSupplierPurchaseRecord({
              supplierId: refillFormData.supplierId,
              supplierName: supplier?.name || "Unknown Supplier",
              purchaseDate: new Date(),
              billNumber:
                refillFormData.invoiceNumber || `REFILL-${Date.now()}`,
              totalAmount: totalCost,
              paidAmount: totalCost,
              dueAmount: 0,
              paymentStatus: "paid",
              paymentDone: true,
              notes: `Stock refill for ${medicineForRefill.name}`,
              items: [
                {
                  name: medicineForRefill.name,
                  qty: regularQty + schemeQty,
                  costPrice:
                    (regularCost + schemeCost) / (regularQty + schemeQty || 1),
                  vatPercentage: 0, // Not tracked in refill modal yet
                  total: totalCost,
                },
              ],
              clinicId,
              branchId: branchScopeId || "",
              createdBy: userData.id,
            });
          }
        } catch (error) {
          console.error("Error creating purchase record for refill:", error);
        }
      }

      addToast({
        title: "Success",
        description: `Stock refilled successfully. Regular: ${newRegularStock}, Scheme: ${newSchemeStock}`,
        color: "success",
      });

      refillModalState.close();
      setMedicineForRefill(null);
      setRefillFormData({
        regularQuantity: "",
        schemeQuantity: "",
        regularSalePrice: "",
        regularCostPrice: "",
        schemePrice: "",
        schemeCostPrice: "",
        expiryDate: "",
        batchNumber: "",
        unitPrice: "",
        invoiceNumber: "",
        supplierId: "",
        transactionType: "add",
      });
      if (useServerPagination) {
        fetchMedicinesPaginated(
          page,
          page === 1 ? undefined : (cursorByPage[page] ?? null),
        );
      } else {
        fetchMedicines();
      }
      onStatsChange();
    } catch (error) {
      console.error("Error refilling stock:", error);
      addToast({
        title: "Error",
        description: "Failed to refill stock",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions for filtering
  const isLowStock = (medicine: Medicine) => {
    const hasStockData =
      medicineStocks[medicine.id] !== undefined ||
      medicineSchemeStocks[medicine.id] !== undefined;

    if (!hasStockData) return false;
    const totalStock =
      (medicineStocks[medicine.id] || 0) +
      (medicineSchemeStocks[medicine.id] || 0);
    const threshold = clinicSettings?.lowStockThreshold || 10;

    return totalStock > 0 && totalStock <= threshold;
  };

  const isExpiring = (medicine: Medicine) => {
    const rawExp = medicineExpiryDates[medicine.id] || medicine.expiryDate;

    if (!rawExp) return false;
    const expiryDate =
      rawExp instanceof Date
        ? rawExp
        : typeof (rawExp as any)?.toDate === "function"
          ? (rawExp as any).toDate()
          : new Date(rawExp);
    const ninetyDays = new Date(
      new Date().getTime() + 90 * 24 * 60 * 60 * 1000,
    );

    return expiryDate >= new Date() && expiryDate < ninetyDays;
  };

  const isExpired = (medicine: Medicine) => {
    const rawExp = medicineExpiryDates[medicine.id] || medicine.expiryDate;

    if (!rawExp) return false;
    const expiryDate =
      rawExp instanceof Date
        ? rawExp
        : typeof (rawExp as any)?.toDate === "function"
          ? (rawExp as any).toDate()
          : new Date(rawExp);

    return expiryDate < new Date();
  };

  const isUrgentExpiry = (medicine: Medicine) => {
    const rawExp = medicineExpiryDates[medicine.id] || medicine.expiryDate;

    if (!rawExp) return false;
    const expiryDate =
      rawExp instanceof Date
        ? rawExp
        : typeof (rawExp as any)?.toDate === "function"
          ? (rawExp as any).toDate()
          : new Date(rawExp);
    const thirtyDays = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    return expiryDate >= new Date() && expiryDate < thirtyDays;
  };

  const isWarningExpiry = (medicine: Medicine) => {
    const rawExp = medicineExpiryDates[medicine.id] || medicine.expiryDate;

    if (!rawExp) return false;
    const expiryDate =
      rawExp instanceof Date
        ? rawExp
        : typeof (rawExp as any)?.toDate === "function"
          ? (rawExp as any).toDate()
          : new Date(rawExp);
    const thirtyDays = new Date(
      new Date().getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const ninetyDays = new Date(
      new Date().getTime() + 90 * 24 * 60 * 60 * 1000,
    );

    return expiryDate >= thirtyDays && expiryDate < ninetyDays;
  };

  // Helper function to get supplier/manufacturer display text
  const getSupplierOrManufacturer = (
    medicine: Medicine,
  ): string | undefined => {
    if (medicine.supplierId) {
      const supplier = suppliers.find((s) => s.id === medicine.supplierId);

      return supplier?.name;
    }

    return medicine.manufacturer;
  };

  const filteredMedicines = useServerPagination
    ? medicines
    : medicines.filter((medicine) => {
        const supplierOrManufacturer = getSupplierOrManufacturer(medicine);
        const matchesSearch =
          medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          medicine.genericName
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          supplierOrManufacturer
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;
        if (!activeFilterType) return true;
        switch (activeFilterType) {
          case "lowStock":
            return isLowStock(medicine);
          case "expiring":
            return isExpiring(medicine);
          case "expired":
            return isExpired(medicine);
          case "urgent":
            return isUrgentExpiry(medicine);
          case "warning":
            return isWarningExpiry(medicine);
          default:
            return true;
        }
      });

  const totalPages = useServerPagination
    ? Math.ceil((totalCount ?? 0) / rowsPerPage)
    : Math.ceil(filteredMedicines.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentMedicines = useServerPagination
    ? medicines
    : filteredMedicines.slice(startIndex, endIndex);

  const getBrandName = (brandId?: string) => {
    if (!brandId) return "No Brand";
    const brand = brands.find((b) => b.id === brandId);

    return brand ? brand.name : "Unknown Brand";
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return "No Category";
    const category = categories.find((c) => c.id === categoryId);

    return category ? category.name : "Unknown Category";
  };

  const medicineTypes = [
    { key: "tablet", label: "Tablet" },
    { key: "capsule", label: "Capsule" },
    { key: "syrup", label: "Syrup" },
    { key: "injection", label: "Injection" },
    { key: "cream", label: "Cream" },
    { key: "drops", label: "Drops" },
    { key: "inhaler", label: "Inhaler" },
    { key: "other", label: "Other" },
  ];

  const medicineUnits = [
    { key: "tablet", label: "Tablet" },
    { key: "capsule", label: "Capsule" },
    { key: "ml", label: "ML" },
    { key: "bottle", label: "Bottle" },
    { key: "vial", label: "Vial" },
    { key: "tube", label: "Tube" },
    { key: "piece", label: "Piece" },
  ];

  if (isLoading && medicines.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-2 text-[rgb(var(--color-text-muted)/0.7)] text-[12.5px]">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading medicines...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Medicine Summary Radar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          className={`px-3 py-2 rounded-xl border transition-all text-left flex flex-col justify-center h-[68px] ${
            activeFilterType === "expired"
              ? "bg-rose-500/10 border-rose-500/50 shadow-md shadow-rose-500/5"
              : "bg-[rgb(var(--color-surface-2))/0.4] border-[rgb(var(--color-border))] hover:border-rose-500/30"
          }`}
          type="button"
          onClick={() =>
            setActiveFilterType(
              activeFilterType === "expired" ? null : "expired",
            )
          }
        >
          <div className="flex justify-between items-center w-full mb-1">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-rose-500/10 text-rose-500">
                <IoCloseCircleOutline size={14} />
              </div>
              <span className="text-[11.5px] font-semibold text-[rgb(var(--color-text))]">
                Expired
              </span>
            </div>
            <span
              className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${
                expiryStats.expired > 0
                  ? "bg-rose-500 text-white"
                  : "bg-[rgb(var(--color-surface-3))] text-[rgb(var(--color-text-muted))]"
              }`}
            >
              {expiryStats.expired} Items
            </span>
          </div>
          <p className="text-[10px] text-[rgb(var(--color-text-muted)/0.6)] ml-6 leading-none">
            Immediate action required
          </p>
        </button>

        <button
          className={`px-3 py-2 rounded-xl border transition-all text-left flex flex-col justify-center h-[68px] ${
            activeFilterType === "urgent"
              ? "bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5"
              : "bg-[rgb(var(--color-surface-2))/0.4] border-[rgb(var(--color-border))] hover:border-amber-500/30"
          }`}
          type="button"
          onClick={() =>
            setActiveFilterType(activeFilterType === "urgent" ? null : "urgent")
          }
        >
          <div className="flex justify-between items-center w-full mb-1">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-amber-500/10 text-amber-500">
                <IoAlertCircleOutline size={14} />
              </div>
              <span className="text-[11.5px] font-semibold text-[rgb(var(--color-text))]">
                Urgent Expiry
              </span>
            </div>
            <span
              className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${
                expiryStats.urgent > 0
                  ? "bg-amber-500 text-white"
                  : "bg-[rgb(var(--color-surface-3))] text-[rgb(var(--color-text-muted))]"
              }`}
            >
              {expiryStats.urgent} Items
            </span>
          </div>
          <p className="text-[10px] text-[rgb(var(--color-text-muted)/0.6)] ml-6 leading-none">
            Expiring within 30 days
          </p>
        </button>

        <button
          className={`px-3 py-2 rounded-xl border transition-all text-left flex flex-col justify-center h-[68px] ${
            activeFilterType === "warning"
              ? "bg-primary/10 border-primary/50 shadow-md shadow-primary/5"
              : "bg-[rgb(var(--color-surface-2))/0.4] border-[rgb(var(--color-border))] hover:border-primary/30"
          }`}
          type="button"
          onClick={() =>
            setActiveFilterType(
              activeFilterType === "warning" ? null : "warning",
            )
          }
        >
          <div className="flex justify-between items-center w-full mb-1">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-primary/10 text-primary">
                <IoCalendarOutline size={14} />
              </div>
              <span className="text-[11.5px] font-semibold text-[rgb(var(--color-text))]">
                Upcoming Expiry
              </span>
            </div>
            <span
              className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${
                activeFilterType === "warning"
                  ? "bg-primary text-white"
                  : "bg-[rgb(var(--color-surface-3))] text-[rgb(var(--color-text-muted))]"
              }`}
            >
              {expiryStats.warning} Items
            </span>
          </div>
          <p className="text-[10px] text-[rgb(var(--color-text-muted)/0.6)] ml-6 leading-none">
            Expiring within 90 days
          </p>
        </button>

        <button
          className={`px-3 py-2 rounded-xl border transition-all text-left flex flex-col justify-center h-[68px] ${
            activeFilterType === "lowStock"
              ? "bg-teal-500/10 border-teal-500/50 shadow-md shadow-teal-500/5"
              : "bg-[rgb(var(--color-surface-2))/0.4] border-[rgb(var(--color-border))] hover:border-teal-500/30"
          }`}
          type="button"
          onClick={() =>
            setActiveFilterType(
              activeFilterType === "lowStock" ? null : "lowStock",
            )
          }
        >
          <div className="flex justify-between items-center w-full mb-1">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-teal-500/10 text-teal-500">
                <IoLayersOutline size={14} />
              </div>
              <span className="text-[11.5px] font-semibold text-[rgb(var(--color-text))]">
                Low Stock
              </span>
            </div>
            <span
              className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${
                activeFilterType === "lowStock"
                  ? "bg-teal-500 text-white"
                  : "bg-[rgb(var(--color-surface-3))] text-[rgb(var(--color-text-muted))]"
              }`}
            >
              {expiryStats.lowStock} Items
            </span>
          </div>
          <p className="text-[10px] text-[rgb(var(--color-text-muted)/0.6)] ml-6 leading-none">
            Below reorder levels
          </p>
        </button>
      </div>

      {/* Header actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:max-w-md">
          <div className="relative flex items-center">
            <IoSearchOutline className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted)/0.4)] w-4 h-4" />
            <input
              className="clarity-input with-left-icon h-8 w-full pr-2 text-[13px]"
              placeholder="Search medicines..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
            />
          </div>
        </div>
        <button
          className="clarity-btn clarity-btn-primary inline-flex items-center gap-1.5"
          type="button"
          onClick={openAddModal}
        >
          <IoAddOutline className="w-4 h-4" />
          <span>Add Medicine</span>
        </button>
      </div>

      {/* Filter status */}
      {filterType && (
        <div className="flex items-center gap-2">
          <span
            className={`clarity-badge inline-flex items-center px-2 py-0.5 text-[11px] rounded ${
              filterType === "lowStock"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : filterType === "expiring"
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  : "bg-teal-50 text-teal-700 border border-teal-200"
            }`}
          >
            {filterType === "lowStock"
              ? "Low Stock Medicines"
              : filterType === "expiring"
                ? "Expiring Soon Medicines"
                : "All Medicines"}
          </span>
          <span className="text-sm text-[rgb(var(--color-text-muted))]">
            Showing{" "}
            {useServerPagination ? (totalCount ?? 0) : filteredMedicines.length}{" "}
            medicines
          </span>
        </div>
      )}

      {/* Medicines table */}
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded shadow-sm">
        {/* Table controls bar */}
        <div className="p-4 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] flex items-center justify-between gap-3">
          <span className="text-[13px] text-[rgb(var(--color-text-muted)/0.7)]">
            {useServerPagination ? (totalCount ?? 0) : filteredMedicines.length}{" "}
            medicine
            {(useServerPagination
              ? (totalCount ?? 0)
              : filteredMedicines.length) !== 1
              ? "s"
              : ""}
            {filterType && (
              <span
                className={`ml-2 inline-flex px-2 py-0.5 rounded text-[11.5px] font-medium ${
                  filterType === "lowStock"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : filterType === "expiring"
                      ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      : "bg-teal-50 text-teal-700 border border-teal-200"
                }`}
              >
                {filterType === "lowStock"
                  ? "Low Stock"
                  : filterType === "expiring"
                    ? "Expiring Soon"
                    : "All"}
              </span>
            )}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[200px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="flex flex-col items-center gap-2 text-[rgb(var(--color-text-muted)/0.7)] text-[12.5px]">
                <div className="h-5 w-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading medicines...</span>
              </div>
            </div>
          ) : currentMedicines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <IoMedkitOutline className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">
                  No medicines found
                </p>
                <p className="text-[13px] text-text-muted mt-1">
                  Add a medicine or adjust your search to see results.
                </p>
                {!searchQuery && (
                  <button
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded text-[13px] font-semibold bg-primary text-white hover:opacity-90 transition-all shadow-sm"
                    type="button"
                    onClick={handleSeedMedicines}
                  >
                    <IoAddCircleOutline className="w-4 h-4" />
                    Seed Default Medicines
                  </button>
                )}
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))]">
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-[rgb(var(--color-text-muted))]">
                    MEDICINE
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-[rgb(var(--color-text-muted))]">
                    BRAND / CATEGORY
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-[rgb(var(--color-text-muted))]">
                    TYPE & STRENGTH
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-[rgb(var(--color-text-muted))]">
                    STOCK
                  </th>
                  {clinicSettings?.sellsMedicines && (
                    <th className="px-5 py-3 text-[12.5px] font-semibold text-[rgb(var(--color-text-muted))]">
                      PRICE
                    </th>
                  )}
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-[rgb(var(--color-text-muted))]">
                    EXPIRY
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-[rgb(var(--color-text-muted))]">
                    STATUS
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-[rgb(var(--color-text-muted))] w-36">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--color-border))]">
                {currentMedicines.map((medicine) => {
                  const regularStock = medicineStocks[medicine.id] ?? 0;
                  const schemeStock = medicineSchemeStocks[medicine.id] ?? 0;
                  const totalStock = regularStock + schemeStock;
                  const hasStockData =
                    medicineStocks[medicine.id] !== undefined ||
                    medicineSchemeStocks[medicine.id] !== undefined;
                  const rawExpiry =
                    medicineExpiryDates[medicine.id] || medicine.expiryDate;
                  const expiryDate = rawExpiry
                    ? rawExpiry instanceof Date
                      ? rawExpiry
                      : typeof (rawExpiry as any)?.toDate === "function"
                        ? (rawExpiry as any).toDate()
                        : new Date(rawExpiry)
                    : null;
                  const isExpired = expiryDate && expiryDate < new Date();
                  const isLowStock =
                    hasStockData && totalStock > 0 && totalStock <= 10;
                  const supplierOrManufacturer =
                    getSupplierOrManufacturer(medicine);

                  return (
                    <tr
                      key={medicine.id}
                      className="hover:bg-[rgb(var(--color-surface-2))/0.5] transition-colors"
                    >
                      {/* Medicine */}
                      <td className="px-5 py-3">
                        <p className="text-[13.5px] font-semibold text-[rgb(var(--color-text))]">
                          {medicine.name}
                        </p>
                        {medicine.genericName && (
                          <p className="text-[12px] text-[rgb(var(--color-text-muted)/0.7)] mt-0.5">
                            {medicine.genericName}
                          </p>
                        )}
                        {supplierOrManufacturer && (
                          <p className="text-[11.5px] text-[rgb(var(--color-text-muted)/0.4)] mt-0.5">
                            by {supplierOrManufacturer}
                          </p>
                        )}
                      </td>

                      {/* Brand / Category */}
                      <td className="px-5 py-3">
                        <p className="text-[13px] text-[rgb(var(--color-text))]">
                          {getBrandName(medicine.brandId)}
                        </p>
                        <p className="text-[12px] text-[rgb(var(--color-text-muted)/0.7)] mt-0.5">
                          {getCategoryName(medicine.categoryId)}
                        </p>
                      </td>

                      {/* Type & Strength */}
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-[11.5px] font-medium bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] border border-[rgb(var(--color-border))] capitalize">
                          {medicine.type}
                        </span>
                        {medicine.strength && (
                          <p className="text-[12px] text-[rgb(var(--color-text-muted)/0.7)] mt-1">
                            {medicine.strength}
                          </p>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="px-5 py-3">
                        {!hasStockData ? (
                          <span className="text-[12.5px] text-[rgb(var(--color-text-muted)/0.4)]">
                            No tracking
                          </span>
                        ) : (
                          <div>
                            <p className="text-[13px] font-medium text-[rgb(var(--color-text))]">
                              {totalStock > 0 ? (
                                <>
                                  <span>
                                    {regularStock} {medicine.unit}
                                  </span>
                                  {schemeStock > 0 && (
                                    <span className="text-[rgb(var(--color-text-muted)/0.7)]">
                                      {" "}
                                      +{schemeStock} scheme
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-red-600 font-semibold">
                                  Out of stock
                                </span>
                              )}
                            </p>
                            {isLowStock && (
                              <span className="inline-flex mt-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                Low Stock
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Price (conditional) */}
                      {clinicSettings?.sellsMedicines && (
                        <td className="px-5 py-3">
                          {medicine.price ? (
                            <div>
                              <p className="text-[13px] font-semibold text-[rgb(var(--color-text))]">
                                NPR {medicine.price}
                              </p>
                              {medicine.costPrice && (
                                <p className="text-[12px] text-[rgb(var(--color-text-muted)/0.7)]">
                                  Cost: NPR {medicine.costPrice}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12.5px] text-[rgb(var(--color-text-muted)/0.4)]">
                              —
                            </span>
                          )}
                        </td>
                      )}

                      {/* Expiry */}
                      <td className="px-5 py-3">
                        {expiryDate ? (
                          <div>
                            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                              {expiryDate instanceof Date
                                ? expiryDate.toLocaleDateString()
                                : typeof (expiryDate as any)?.toDate ===
                                    "function"
                                  ? (expiryDate as any)
                                      .toDate()
                                      .toLocaleDateString()
                                  : new Date(expiryDate).toLocaleDateString()}
                            </p>
                            {isExpired && (
                              <span className="inline-flex mt-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Expired
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-[12.5px] text-[rgb(var(--color-text-muted)/0.4)]">
                              No expiry
                            </span>
                            {clinicSettings?.sellsMedicines && (
                              <span className="inline-flex ml-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Required
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            medicine.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {medicine.isActive ? (
                            <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                          ) : (
                            <IoCloseCircleOutline className="w-3.5 h-3.5" />
                          )}
                          {medicine.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            onClick={async () => {
                              setMedicineForRefill(medicine);
                              setIsLoading(true);

                              let resolvedBatchNumber =
                                medicine.batchNumber || "";
                              let resolvedExpiryDate = "";
                              let resolvedRegularSalePrice =
                                medicine.price?.toString() || "";
                              let resolvedRegularCostPrice =
                                medicine.costPrice?.toString() || "";
                              let resolvedSchemePrice = "";
                              let resolvedSchemeCostPrice = "";
                              let resolvedSupplierId =
                                medicine.supplierId || "";

                              try {
                                const txs =
                                  await medicineService.getStockTransactions(
                                    medicine.id,
                                    10,
                                    branchScopeId || undefined,
                                  );

                                // Find most recent regular stock transaction for prices
                                const regularTx = txs.find(
                                  (t) => !t.isSchemeStock && t.salePrice,
                                );

                                if (regularTx) {
                                  if (!resolvedRegularSalePrice)
                                    resolvedRegularSalePrice =
                                      regularTx.salePrice?.toString() || "";
                                  if (!resolvedRegularCostPrice)
                                    resolvedRegularCostPrice =
                                      regularTx.costPrice?.toString() || "";
                                }

                                // Find most recent scheme stock transaction for prices
                                const schemeTx = txs.find(
                                  (t) => t.isSchemeStock && t.salePrice,
                                );

                                if (schemeTx) {
                                  resolvedSchemePrice =
                                    schemeTx.salePrice?.toString() || "";
                                  resolvedSchemeCostPrice =
                                    schemeTx.costPrice?.toString() || "";
                                }

                                // Find most recent transaction with batch/expiry/supplier
                                const latestTx = txs[0];

                                if (latestTx) {
                                  if (!resolvedBatchNumber)
                                    resolvedBatchNumber =
                                      latestTx.batchNumber || "";
                                  if (!resolvedSupplierId)
                                    resolvedSupplierId =
                                      latestTx.supplierId || "";

                                  if (latestTx.expiryDate) {
                                    const date =
                                      latestTx.expiryDate instanceof Date
                                        ? latestTx.expiryDate
                                        : (
                                            latestTx.expiryDate as any
                                          ).toDate?.() ||
                                          new Date(latestTx.expiryDate);

                                    resolvedExpiryDate = date
                                      .toISOString()
                                      .split("T")[0];
                                  }
                                }

                                // Fallback: if no transactions were found or no batch number resolved, query active stock documents (batches)
                                if (!resolvedBatchNumber) {
                                  try {
                                    const stocks =
                                      await medicineService.getMedicineStocks(
                                        medicine.id,
                                        clinicId || undefined,
                                      );

                                    if (stocks && stocks.length > 0) {
                                      // Sort by updatedAt or createdAt descending to get the most recent batch
                                      stocks.sort((a, b) => {
                                        const timeA =
                                          a.updatedAt?.getTime() ||
                                          a.createdAt?.getTime() ||
                                          0;
                                        const timeB =
                                          b.updatedAt?.getTime() ||
                                          b.createdAt?.getTime() ||
                                          0;

                                        return timeB - timeA;
                                      });
                                      const latestStock = stocks[0];

                                      resolvedBatchNumber =
                                        latestStock.batchNumber || "";
                                      if (!resolvedSupplierId) {
                                        resolvedSupplierId =
                                          latestStock.supplierId || "";
                                      }
                                      if (
                                        !resolvedExpiryDate &&
                                        latestStock.expiryDate
                                      ) {
                                        const date =
                                          latestStock.expiryDate instanceof Date
                                            ? latestStock.expiryDate
                                            : new Date(latestStock.expiryDate);

                                        resolvedExpiryDate = date
                                          .toISOString()
                                          .split("T")[0];
                                      }
                                    }
                                  } catch (err) {
                                    console.warn(
                                      "Could not fetch active stock documents for refill fallback",
                                      err,
                                    );
                                  }
                                }

                                // Fallback for expiry if not in transactions
                                if (
                                  !resolvedExpiryDate &&
                                  (medicine.expiryDate ||
                                    medicineExpiryDates[medicine.id])
                                ) {
                                  const rawExp =
                                    medicine.expiryDate ||
                                    medicineExpiryDates[medicine.id];
                                  const date =
                                    rawExp instanceof Date
                                      ? rawExp
                                      : (rawExp as any).toDate?.() ||
                                        new Date(rawExp);

                                  resolvedExpiryDate = date
                                    .toISOString()
                                    .split("T")[0];
                                }
                              } catch (e) {
                                console.warn(
                                  "Could not fetch latest transactions for refill",
                                  e,
                                );
                              }

                              setRefillFormData({
                                regularQuantity: "",
                                schemeQuantity: "",
                                regularSalePrice: resolvedRegularSalePrice,
                                regularCostPrice: resolvedRegularCostPrice,
                                schemePrice: resolvedSchemePrice,
                                schemeCostPrice: resolvedSchemeCostPrice,
                                expiryDate: resolvedExpiryDate,
                                batchNumber: resolvedBatchNumber,
                                unitPrice: "",
                                invoiceNumber: generateBillNumber(),
                                supplierId: resolvedSupplierId,
                                transactionType: "add",
                              });
                              setIsLoading(false);
                              refillModalState.open();
                            }}
                          >
                            <IoAddCircleOutline className="w-3.5 h-3.5" />
                            <span>Refill</span>
                          </button>
                          <button
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                            title="Edit"
                            onClick={() => openEditModal(medicine)}
                          >
                            <IoCreateOutline className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-semibold transition-colors ${
                              medicine.isActive
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                            }`}
                            title={
                              medicine.isActive ? "Deactivate" : "Activate"
                            }
                            onClick={() => handleToggleStatus(medicine)}
                          >
                            {medicine.isActive ? (
                              <>
                                <IoCloseCircleOutline className="w-3.5 h-3.5" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] flex items-center justify-between">
            <p className="text-[12.5px] text-[rgb(var(--color-text-muted)/0.7)]">
              Showing{" "}
              <span className="font-medium text-[rgb(var(--color-text))]">
                {(page - 1) * rowsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-[rgb(var(--color-text))]">
                {Math.min(
                  page * rowsPerPage,
                  useServerPagination
                    ? (totalCount ?? 0)
                    : filteredMedicines.length,
                )}
              </span>{" "}
              of{" "}
              <span className="font-medium text-[rgb(var(--color-text))]">
                {useServerPagination
                  ? (totalCount ?? 0)
                  : filteredMedicines.length}
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                aria-label="Previous page"
                className="w-8 h-8 flex items-center justify-center rounded border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] disabled:opacity-30 disabled:cursor-not-allowed hover:border-teal-400 hover:text-teal-700 hover:bg-mountain-50 transition-all font-medium"
                disabled={page === 1}
                type="button"
                onClick={() => {
                  if (useServerPagination && page > 1) {
                    const prevPage = page - 1;

                    setPage(prevPage);
                    fetchMedicinesPaginated(
                      prevPage,
                      cursorByPage[prevPage] ?? null,
                    );
                  } else {
                    setPage((prev) => Math.max(1, prev - 1));
                  }
                }}
              >
                <IoChevronBackOutline className="w-4 h-4" />
              </button>
              <span className="text-[12.5px] text-[rgb(var(--color-text-muted))] px-2 min-w-[90px] text-center">
                Page{" "}
                <span className="font-semibold text-[rgb(var(--color-text))]">
                  {page}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[rgb(var(--color-text))]">
                  {totalPages}
                </span>
              </span>
              <button
                aria-label="Next page"
                className="w-8 h-8 flex items-center justify-center rounded border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] disabled:opacity-30 disabled:cursor-not-allowed hover:border-teal-400 hover:text-teal-700 hover:bg-mountain-50 transition-all font-medium"
                disabled={page === totalPages}
                type="button"
                onClick={() => {
                  if (useServerPagination && page < totalPages) {
                    const nextPage = page + 1;

                    setPage(nextPage);
                    fetchMedicinesPaginated(nextPage, lastDoc);
                  } else {
                    setPage((prev) => Math.min(totalPages, prev + 1));
                  }
                }}
              >
                <IoChevronForwardOutline className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalState.isOpen && (
        <ModalShell
          disabled={isLoading}
          footer={
            <>
              <button
                className="clarity-btn clarity-btn-ghost"
                disabled={isLoading}
                type="button"
                onClick={modalState.forceClose}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary"
                disabled={isLoading}
                type="button"
                onClick={handleSave}
              >
                {isLoading ? "Saving..." : "Save Medicine"}
              </button>
            </>
          }
          size={currentMedicine ? "4xl" : "5xl"}
          subtitle={
            <p className="text-[11.5px] text-[rgb(var(--color-text-muted)/0.4)]">
              Manage core details, pricing, and inventory metadata.
            </p>
          }
          title={currentMedicine ? "Edit Medicine" : "Add Medicine"}
          onClose={modalState.forceClose}
        >
          <div className="space-y-4">
            {!currentMedicine && (
              <div className="flex flex-wrap gap-4 p-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                <div className="w-full md:w-[300px]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-semibold text-[rgb(var(--color-text))]">
                      Supplier
                    </label>
                    <button
                      className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                      type="button"
                      onClick={() => {
                        setGlobalPurchaseDetails((prev) => ({
                          ...prev,
                          isAddingSupplier: !prev.isAddingSupplier,
                          newSupplierName: !prev.isAddingSupplier
                            ? prev.newSupplierName
                            : "",
                        }));
                      }}
                    >
                      {globalPurchaseDetails.isAddingSupplier
                        ? "Select Existing"
                        : "Add New"}
                    </button>
                  </div>
                  {globalPurchaseDetails.isAddingSupplier ? (
                    <input
                      className="clarity-input h-9 w-full text-[13px] px-3 rounded-md border-primary/30"
                      placeholder="New supplier name"
                      value={globalPurchaseDetails.newSupplierName}
                      onChange={(e) =>
                        setGlobalPurchaseDetails((prev) => ({
                          ...prev,
                          newSupplierName: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <select
                      className="clarity-input h-9 w-full text-[13px] px-3 rounded-md"
                      name="supplierId"
                      value={globalPurchaseDetails.supplierId}
                      onChange={(e) =>
                        setGlobalPurchaseDetails((prev) => ({
                          ...prev,
                          supplierId: e.target.value,
                        }))
                      }
                    >
                      <option value="">No Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="w-full md:w-[250px]">
                  <label className="text-[13px] font-semibold text-[rgb(var(--color-text))] mb-1.5 block">
                    Bill / Invoice Number
                  </label>
                  <div className="relative">
                    <input
                      className="clarity-input h-9 w-full text-[13px] px-3 pr-16 rounded-md"
                      placeholder="Enter bill or invoice number"
                      value={globalPurchaseDetails.billNumber}
                      onChange={(e) =>
                        setGlobalPurchaseDetails((prev) => ({
                          ...prev,
                          billNumber: e.target.value,
                        }))
                      }
                    />
                    <button
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-all"
                      type="button"
                      onClick={() => {
                        setGlobalPurchaseDetails((prev) => ({
                          ...prev,
                          billNumber: generateBillNumber(),
                        }));
                      }}
                    >
                      GENERATE
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Medicines Form or Table */}
            {currentMedicine ? (
              /* Single Edit Form Layout */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-1">
                {/* Basic Info Section */}
                <div className="md:col-span-2 space-y-4">
                  <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.1] space-y-4">
                    <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-[rgb(var(--color-border))] pb-2 mb-4">
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Medicine Name <span className="text-danger">*</span>
                        </label>
                        <input
                          required
                          className="clarity-input h-9 w-full text-[13px] px-3 rounded-md"
                          name="name"
                          placeholder="e.g. Amoxicillin"
                          value={formDataList[0].name}
                          onChange={(e) => handleChange(0, e)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Generic Name
                        </label>
                        <input
                          className="clarity-input h-9 w-full text-[13px] px-3 rounded-md"
                          name="genericName"
                          placeholder="Generic name"
                          value={formDataList[0].genericName}
                          onChange={(e) => handleChange(0, e)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Brand
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            {formDataList[0].isAddingBrand ? (
                              <input
                                className="clarity-input h-9 w-full text-[13px] px-3 rounded-md border-primary/30"
                                placeholder="New brand name"
                                value={formDataList[0].newBrandName}
                                onChange={(e) => {
                                  const newList = [...formDataList];

                                  newList[0].newBrandName = e.target.value;
                                  setFormDataList(newList);
                                }}
                              />
                            ) : (
                              <select
                                className="clarity-input h-9 w-full text-[13px] px-3 rounded-md"
                                value={formDataList[0].brandId}
                                onChange={(e) =>
                                  handleSelectChange(
                                    0,
                                    "brandId",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">No Brand</option>
                                {brands.map((brand) => (
                                  <option key={brand.id} value={brand.id}>
                                    {brand.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <button
                            className="w-9 h-9 flex items-center justify-center rounded-md border border-[rgb(var(--color-border))] text-primary hover:bg-primary/5 transition-colors"
                            type="button"
                            onClick={() => {
                              const newList = [...formDataList];

                              newList[0].isAddingBrand =
                                !newList[0].isAddingBrand;
                              if (!newList[0].isAddingBrand)
                                newList[0].newBrandName = "";
                              setFormDataList(newList);
                            }}
                          >
                            {formDataList[0].isAddingBrand ? (
                              <IoListOutline className="w-4 h-4" />
                            ) : (
                              <IoAddOutline className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Category
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            {formDataList[0].isAddingCategory ? (
                              <input
                                className="clarity-input h-9 w-full text-[13px] px-3 rounded-md border-primary/30"
                                placeholder="New category name"
                                value={formDataList[0].newCategoryName}
                                onChange={(e) => {
                                  const newList = [...formDataList];

                                  newList[0].newCategoryName = e.target.value;
                                  setFormDataList(newList);
                                }}
                              />
                            ) : (
                              <select
                                className="clarity-input h-9 w-full text-[13px] px-3 rounded-md"
                                value={formDataList[0].categoryId}
                                onChange={(e) =>
                                  handleSelectChange(
                                    0,
                                    "categoryId",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">No Category</option>
                                {categories.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <button
                            className="w-9 h-9 flex items-center justify-center rounded-md border border-[rgb(var(--color-border))] text-primary hover:bg-primary/5 transition-colors"
                            type="button"
                            onClick={() => {
                              const newList = [...formDataList];

                              newList[0].isAddingCategory =
                                !newList[0].isAddingCategory;
                              if (!newList[0].isAddingCategory)
                                newList[0].newCategoryName = "";
                              setFormDataList(newList);
                            }}
                          >
                            {formDataList[0].isAddingCategory ? (
                              <IoListOutline className="w-4 h-4" />
                            ) : (
                              <IoAddOutline className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Type
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            {formDataList[0].isAddingType ? (
                              <input
                                className="clarity-input h-9 w-full text-[13px] px-3 rounded-md border-primary/30"
                                placeholder="New type"
                                value={formDataList[0].newTypeName}
                                onChange={(e) => {
                                  const newList = [...formDataList];

                                  newList[0].newTypeName = e.target.value;
                                  newList[0].type = e.target.value;
                                  setFormDataList(newList);
                                }}
                              />
                            ) : (
                              <select
                                className="clarity-input h-9 w-full text-[13px] px-3 rounded-md"
                                value={formDataList[0].type}
                                onChange={(e) =>
                                  handleSelectChange(0, "type", e.target.value)
                                }
                              >
                                {medicineTypes.map((item) => (
                                  <option key={item.key} value={item.key}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <button
                            className="w-9 h-9 flex items-center justify-center rounded-md border border-[rgb(var(--color-border))] text-primary hover:bg-primary/5 transition-colors"
                            type="button"
                            onClick={() => {
                              const newList = [...formDataList];

                              newList[0].isAddingType =
                                !newList[0].isAddingType;
                              if (!newList[0].isAddingType)
                                newList[0].newTypeName = "";
                              setFormDataList(newList);
                            }}
                          >
                            {formDataList[0].isAddingType ? (
                              <IoListOutline className="w-4 h-4" />
                            ) : (
                              <IoAddOutline className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Strength
                        </label>
                        <input
                          className="clarity-input h-9 w-full text-[13px] px-3 rounded-md"
                          name="strength"
                          placeholder="e.g. 500mg"
                          value={formDataList[0].strength}
                          onChange={(e) => handleChange(0, e)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.1] space-y-4">
                    <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-[rgb(var(--color-border))] pb-2 mb-4">
                      Inventory Details
                    </h4>
                    {currentMedicine && (
                      <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 text-amber-800 text-[11.5px] leading-relaxed font-medium">
                        ℹ️ <strong>Multi-Batch Mode Enabled:</strong> Batch-wise
                        quantities and expiry dates are managed separately under
                        the <strong>Stock</strong> tab.
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Current Stock
                        </label>
                        <input
                          className={`clarity-input h-9 w-full text-[13px] px-3 rounded-md bg-white ${currentMedicine ? "opacity-60 cursor-not-allowed bg-mountain-50" : ""}`}
                          disabled={!!currentMedicine}
                          name="currentStock"
                          type="number"
                          value={formDataList[0].currentStock}
                          onChange={(e) => handleChange(0, e)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Batch No.
                        </label>
                        <input
                          className={`clarity-input h-9 w-full text-[13px] px-3 rounded-md ${currentMedicine ? "opacity-60 cursor-not-allowed bg-mountain-50" : ""}`}
                          disabled={!!currentMedicine}
                          name="batchNumber"
                          placeholder="Batch no."
                          value={formDataList[0].batchNumber}
                          onChange={(e) => handleChange(0, e)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                          Expiry Date
                        </label>
                        <input
                          className={`clarity-input h-9 w-full text-[13px] px-3 rounded-md ${currentMedicine ? "opacity-60 cursor-not-allowed bg-mountain-50" : ""}`}
                          disabled={!!currentMedicine}
                          name="expiryDate"
                          type="date"
                          value={formDataList[0].expiryDate}
                          onChange={(e) => handleChange(0, e)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing Sidebar */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4 h-full">
                    <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-primary/20 pb-2 mb-4">
                      Pricing & VAT
                    </h4>
                    {currentMedicine && (
                      <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200/60 text-indigo-800 text-[11.5px] leading-relaxed font-medium">
                        ℹ️ Purchase and selling prices are batch-specific. You
                        can edit them by clicking <strong>Edit</strong> on a
                        batch inside the <strong>Stock</strong> tab.
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                        MRP / Sale Price (NPR){" "}
                        <span className="text-danger">*</span>
                      </label>
                      <input
                        className={`clarity-input h-9 w-full text-[13px] px-3 rounded-md font-bold text-primary ${currentMedicine ? "opacity-60 cursor-not-allowed bg-mountain-50" : ""}`}
                        disabled={!!currentMedicine}
                        name="price"
                        placeholder="0.00"
                        type="number"
                        value={formDataList[0].price}
                        onChange={(e) => handleChange(0, e)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                        Cost Price (NPR)
                      </label>
                      <input
                        className={`clarity-input h-9 w-full text-[13px] px-3 rounded-md ${currentMedicine ? "opacity-60 cursor-not-allowed bg-mountain-50" : ""}`}
                        disabled={!!currentMedicine}
                        name="costPrice"
                        placeholder="0.00"
                        type="number"
                        value={formDataList[0].costPrice}
                        onChange={(e) => handleChange(0, e)}
                      />
                    </div>

                    <div className="pt-4 border-t border-primary/10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[13px] font-semibold text-[rgb(var(--color-text))]">
                          Apply VAT
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            checked={formDataList[0].isVatApplied}
                            className="sr-only peer"
                            type="checkbox"
                            onChange={(e) => {
                              const newList = [...formDataList];

                              newList[0].isVatApplied = e.target.checked;
                              setFormDataList(newList);
                            }}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                        </label>
                      </div>

                      {formDataList[0].isVatApplied && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                          <label className="text-[12px] font-semibold text-[rgb(var(--color-text-muted))]">
                            VAT Percentage (%)
                          </label>
                          <div className="relative">
                            <input
                              className="clarity-input h-9 w-full text-[13px] px-3 pr-8 rounded-md"
                              name="vatPercentage"
                              step="0.1"
                              type="number"
                              value={formDataList[0].vatPercentage}
                              onChange={(e) => handleChange(0, e)}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[rgb(var(--color-text-muted)/0.5)]">
                              %
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {formDataList[0].isVatApplied &&
                      formDataList[0].costPrice && (
                        <div className="mt-6 p-3 rounded-lg bg-white/50 border border-primary/10 text-center">
                          <p className="text-[10px] text-[rgb(var(--color-text-muted))] uppercase tracking-widest font-bold mb-1">
                            Total Cost Incl. VAT
                          </p>
                          <p className="text-[18px] font-bold text-primary">
                            NPR{" "}
                            {Math.round(
                              parseFloat(formDataList[0].costPrice) *
                                (1 +
                                  parseFloat(formDataList[0].vatPercentage) / 100)
                            ).toLocaleString()}
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ) : (
              /* Batch Table Layout (For New Entries) */
              <div className="overflow-x-auto border border-[rgb(var(--color-border))] rounded-lg min-h-[140px]">
                <table className="w-full text-left whitespace-nowrap min-w-[1200px]">
                  <thead className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))]">
                    <tr>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[180px]">
                        Medicine Name <span className="text-danger">*</span>
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[140px]">
                        Generic Name
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[120px]">
                        Type
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[100px]">
                        Strength
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[100px]">
                        Init. Stock
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[120px]">
                        Batch No.
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[130px]">
                        Expiry Date
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[120px]">
                        MRP / Sale Price <span className="text-danger">*</span>
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[120px]">
                        Cost Price
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[100px]">
                        VAT (%)
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[120px]">
                        Brand
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider min-w-[120px]">
                        Category
                      </th>
                      <th className="px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider text-center">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--color-border))]">
                    {formDataList.map((formData, index) => (
                      <tr
                        key={index}
                        className="hover:bg-[rgb(var(--color-surface-2))/0.3] transition-colors"
                      >
                        <td className="px-3 py-2 text-[12px] font-medium text-[rgb(var(--color-text-muted))]">
                          {index + 1}
                        </td>

                        <td className="px-2 py-2 relative">
                          <input
                            required
                            autoComplete="off"
                            className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                            name="name"
                            placeholder="Medicine name"
                            value={formData.name}
                            onBlur={handleBlur}
                            onChange={(e) => handleChange(index, e)}
                            onFocus={() => handleFocus(index)}
                            onKeyDown={handleKeyDown}
                          />
                          {/* Suggestions */}
                          {focusedRowIndex === index &&
                            showSuggestions &&
                            formDataList[index].name.trim().length >= 2 && (
                              <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-md shadow-xl overflow-hidden max-h-60 overflow-y-auto min-w-[250px]">
                                {nameSuggestions.length > 0 ? (
                                  nameSuggestions.map((suggestion) => (
                                    <button
                                      key={suggestion.id}
                                      className="w-full text-left px-3 py-2.5 hover:bg-[rgb(var(--color-primary)/0.05)] transition-colors border-b border-[rgb(var(--color-border))/0.5] last:border-0 group"
                                      type="button"
                                      onMouseDown={() =>
                                        handleSelectSuggestion(
                                          index,
                                          suggestion,
                                        )
                                      }
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1 overflow-hidden">
                                          <div className="text-[12.5px] font-bold text-[rgb(var(--color-text))] group-hover:text-primary transition-colors truncate">
                                            {suggestion.name}
                                          </div>
                                          {suggestion.genericName && (
                                            <div className="text-[10px] text-[rgb(var(--color-text-muted))] truncate mt-0.5">
                                              {suggestion.genericName}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 uppercase">
                                            {suggestion.type}
                                          </span>
                                          {suggestion.strength && (
                                            <span className="text-[9px] text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-surface-2))] px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))]">
                                              {suggestion.strength}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-center">
                                    <p className="text-[11px] text-[rgb(var(--color-text-muted))] italic">
                                      No matches found for "
                                      {formDataList[index].name}"
                                    </p>
                                    <p className="text-[9px] text-[rgb(var(--color-text-muted)/0.6)] mt-1">
                                      You can continue typing to add it as a new
                                      medicine.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                        </td>

                        <td className="px-2 py-2">
                          <input
                            className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                            name="genericName"
                            placeholder="Generic name"
                            value={formData.genericName}
                            onChange={(e) => handleChange(index, e)}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <div className="flex gap-1 items-center">
                            <div className="flex-1">
                              {formData.isAddingType ? (
                                <input
                                  className="clarity-input h-8 w-full text-[12px] px-2 rounded border-primary/30"
                                  placeholder="New type"
                                  value={formData.newTypeName}
                                  onChange={(e) => {
                                    const newList = [...formDataList];

                                    newList[index].newTypeName = e.target.value;
                                    newList[index].type = e.target.value;
                                    setFormDataList(newList);
                                  }}
                                />
                              ) : (
                                <select
                                  className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                                  name="type"
                                  value={formData.type}
                                  onChange={(e) =>
                                    handleSelectChange(
                                      index,
                                      "type",
                                      e.target.value,
                                    )
                                  }
                                >
                                  {medicineTypes.map((item) => (
                                    <option key={item.key} value={item.key}>
                                      {item.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <button
                              className="w-7 h-8 flex items-center justify-center rounded border border-[rgb(var(--color-border))] text-primary hover:bg-primary/5 transition-colors"
                              title={
                                formData.isAddingType
                                  ? "Select Existing Type"
                                  : "Add New Type"
                              }
                              type="button"
                              onClick={() => {
                                const newList = [...formDataList];

                                newList[index].isAddingType =
                                  !newList[index].isAddingType;
                                if (!newList[index].isAddingType)
                                  newList[index].newTypeName = "";
                                setFormDataList(newList);
                              }}
                            >
                              {formData.isAddingType ? (
                                <IoListOutline className="w-4 h-4" />
                              ) : (
                                <IoAddOutline className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="px-2 py-2">
                          <input
                            className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                            name="strength"
                            placeholder="e.g. 500mg"
                            value={formData.strength}
                            onChange={(e) => handleChange(index, e)}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                            name="currentStock"
                            placeholder="0"
                            type="number"
                            value={formData.currentStock}
                            onChange={(e) => handleChange(index, e)}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                            name="batchNumber"
                            placeholder="Batch no."
                            value={formData.batchNumber}
                            onChange={(e) => handleChange(index, e)}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                            name="expiryDate"
                            type="date"
                            value={formData.expiryDate}
                            onChange={(e) => handleChange(index, e)}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                            name="price"
                            placeholder="0.00"
                            type="number"
                            value={formData.price}
                            onChange={(e) => handleChange(index, e)}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                            name="costPrice"
                            placeholder="0.00"
                            type="number"
                            value={formData.costPrice}
                            onChange={(e) => handleChange(index, e)}
                          />
                          {formData.isVatApplied && formData.costPrice && (
                            <p className="text-[10px] text-primary font-medium mt-1">
                              Total:{" "}
                              {(
                                parseFloat(formData.costPrice) *
                                (1 + parseFloat(formData.vatPercentage) / 100)
                              ).toFixed(2)}
                            </p>
                          )}
                        </td>

                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                checked={formData.isVatApplied}
                                className="sr-only peer"
                                type="checkbox"
                                onChange={(e) => {
                                  const newList = [...formDataList];

                                  newList[index].isVatApplied =
                                    e.target.checked;
                                  setFormDataList(newList);
                                }}
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                            </label>
                            {formData.isVatApplied && (
                              <div className="relative w-16">
                                <input
                                  className="clarity-input h-8 w-full text-[12px] pl-2 pr-4 rounded"
                                  name="vatPercentage"
                                  step="0.1"
                                  type="number"
                                  value={formData.vatPercentage}
                                  onChange={(e) => handleChange(index, e)}
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[rgb(var(--color-text-muted)/0.5)]">
                                  %
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-2 py-2">
                          <div className="flex gap-1 items-center">
                            <div className="flex-1">
                              {formData.isAddingBrand ? (
                                <input
                                  className="clarity-input h-8 w-full text-[12px] px-2 rounded border-primary/30"
                                  placeholder="New brand"
                                  value={formData.newBrandName}
                                  onChange={(e) => {
                                    const newList = [...formDataList];

                                    newList[index].newBrandName =
                                      e.target.value;
                                    setFormDataList(newList);
                                  }}
                                />
                              ) : (
                                <select
                                  className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                                  value={formData.brandId}
                                  onChange={(e) =>
                                    handleSelectChange(
                                      index,
                                      "brandId",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">No Brand</option>
                                  {brands.map((brand) => (
                                    <option key={brand.id} value={brand.id}>
                                      {brand.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <button
                              className="w-7 h-8 flex items-center justify-center rounded border border-[rgb(var(--color-border))] text-primary hover:bg-primary/5 transition-colors"
                              title={
                                formData.isAddingBrand
                                  ? "Select Existing Brand"
                                  : "Add New Brand"
                              }
                              type="button"
                              onClick={() => {
                                const newList = [...formDataList];

                                newList[index].isAddingBrand =
                                  !newList[index].isAddingBrand;
                                if (!newList[index].isAddingBrand)
                                  newList[index].newBrandName = "";
                                setFormDataList(newList);
                              }}
                            >
                              {formData.isAddingBrand ? (
                                <IoListOutline className="w-4 h-4" />
                              ) : (
                                <IoAddOutline className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1 items-center">
                            <div className="flex-1">
                              {formData.isAddingCategory ? (
                                <input
                                  className="clarity-input h-8 w-full text-[12px] px-2 rounded border-primary/30"
                                  placeholder="New category"
                                  value={formData.newCategoryName}
                                  onChange={(e) => {
                                    const newList = [...formDataList];

                                    newList[index].newCategoryName =
                                      e.target.value;
                                    setFormDataList(newList);
                                  }}
                                />
                              ) : (
                                <select
                                  className="clarity-input h-8 w-full text-[12px] px-2 rounded"
                                  value={formData.categoryId}
                                  onChange={(e) =>
                                    handleSelectChange(
                                      index,
                                      "categoryId",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">No Category</option>
                                  {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <button
                              className="w-7 h-8 flex items-center justify-center rounded border border-[rgb(var(--color-border))] text-primary hover:bg-primary/5 transition-colors"
                              title={
                                formData.isAddingCategory
                                  ? "Select Existing Category"
                                  : "Add New Category"
                              }
                              type="button"
                              onClick={() => {
                                const newList = [...formDataList];

                                newList[index].isAddingCategory =
                                  !newList[index].isAddingCategory;
                                if (!newList[index].isAddingCategory)
                                  newList[index].newCategoryName = "";
                                setFormDataList(newList);
                              }}
                            >
                              {formData.isAddingCategory ? (
                                <IoListOutline className="w-4 h-4" />
                              ) : (
                                <IoAddOutline className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {formDataList.length > 1 && (
                            <button
                              className="w-7 h-7 mx-auto rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500/20 transition-colors shadow-sm"
                              title="Remove"
                              type="button"
                              onClick={() => removeRow(index)}
                            >
                              <IoCloseOutline className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[rgb(var(--color-surface-2))/0.5] border-t border-[rgb(var(--color-border))]">
                      <td
                        className="px-4 py-2.5"
                        colSpan={clinicSettings?.sellsMedicines ? 12 : 11}
                      >
                        <button
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-bold text-primary hover:bg-primary/10 transition-all group"
                          type="button"
                          onClick={addRow}
                        >
                          <IoAddCircleOutline className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span>Add Another Row</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {!currentMedicine && (
              <div className="mt-4 flex justify-end">
                <div className="w-full md:w-80 space-y-3 bg-[rgb(var(--color-surface-2))] p-4 rounded-lg border border-[rgb(var(--color-border))] shadow-sm">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-[rgb(var(--color-text-muted))]">
                      Subtotal
                    </span>
                    <span className="font-semibold">
                      NPR{" "}
                      {Math.round(purchaseSummary.subtotal).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-[rgb(var(--color-text-muted))]">
                      Taxable Amount
                    </span>
                    <span className="text-[rgb(var(--color-text))]">
                      NPR{" "}
                      {Math.round(purchaseSummary.taxableAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-[rgb(var(--color-text-muted))]">
                      Non-Taxable Amount
                    </span>
                    <span className="text-[rgb(var(--color-text))]">
                      NPR{" "}
                      {Math.round(purchaseSummary.nonTaxableAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] pb-3 border-b border-[rgb(var(--color-border))]">
                    <span className="text-[rgb(var(--color-text-muted))]">
                      Total VAT
                    </span>
                    <span className="text-primary font-medium">
                      + NPR{" "}
                      {Math.round(purchaseSummary.totalVat).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[14px] pt-3 border-t border-[rgb(var(--color-border))]">
                    <span className="font-bold text-[rgb(var(--color-text))]">
                      Grand Total
                    </span>
                    <span className="font-bold text-primary text-[16px]">
                      NPR{" "}
                      {Math.round(purchaseSummary.grandTotal).toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-3 space-y-3 border-t border-[rgb(var(--color-border))/0.5]">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-[rgb(var(--color-text))]">
                          Paid Amount
                        </span>
                        <button
                          className="text-[10px] text-primary hover:underline text-left"
                          type="button"
                          onClick={() =>
                            setGlobalPurchaseDetails((prev) => ({
                              ...prev,
                              paidAmount: purchaseSummary.grandTotal.toString(),
                            }))
                          }
                        >
                          Mark Full Paid
                        </button>
                      </div>
                      <div className="relative w-32">
                        <input
                          className="clarity-input h-9 w-full text-[13px] pl-8 pr-2 rounded font-bold text-primary border-primary/20 bg-white"
                          placeholder="0.00"
                          type="number"
                          value={globalPurchaseDetails.paidAmount}
                          onChange={(e) =>
                            setGlobalPurchaseDetails((prev) => ({
                              ...prev,
                              paidAmount: e.target.value,
                            }))
                          }
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/40">
                          NPR
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-[rgb(var(--color-text-muted))] font-medium">
                        Remaining Due
                      </span>
                      <span
                        className={`font-bold ${purchaseSummary.grandTotal - (parseFloat(globalPurchaseDetails.paidAmount) || 0) > 0 ? "text-rose-500" : "text-teal-600"}`}
                      >
                        NPR{" "}
                        {Math.round(
                          purchaseSummary.grandTotal -
                            (parseFloat(globalPurchaseDetails.paidAmount) || 0),
                        ).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[12px] font-semibold text-[rgb(var(--color-text))]">
                        Payment Method
                      </span>
                      <select
                        className="clarity-input h-9 w-32 text-[12px] px-2 rounded bg-white border-[rgb(var(--color-border))]"
                        value={globalPurchaseDetails.paymentMethod}
                        onChange={(e) =>
                          setGlobalPurchaseDetails((prev) => ({
                            ...prev,
                            paymentMethod: e.target.value,
                          }))
                        }
                      >
                        <option value="cash">Cash</option>
                        <option value="fonepay">Fonepay</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* Refill Stock Modal */}
      {refillModalState.isOpen && (
        <ModalShell
          disabled={isLoading}
          footer={
            <>
              <button
                className="clarity-btn clarity-btn-ghost"
                disabled={isLoading}
                type="button"
                onClick={refillModalState.close}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary"
                disabled={
                  isLoading ||
                  (!refillFormData.regularQuantity &&
                    !refillFormData.schemeQuantity) ||
                  !refillFormData.expiryDate
                }
                type="button"
                onClick={handleRefillStock}
              >
                {isLoading ? "Refilling..." : "Refill Stock"}
              </button>
            </>
          }
          size="xl"
          subtitle={
            <div className="text-[11.5px] text-[rgb(var(--color-text-muted)/0.7)]">
              <span className="font-medium text-[rgb(var(--color-text-muted))]">
                Medicine:
              </span>{" "}
              {medicineForRefill?.name}
            </div>
          }
          title="Refill Stock"
          onClose={refillModalState.close}
        >
          <div className="space-y-6">
            {/* Transaction Type Toggle */}
            <div className="flex bg-[rgb(var(--color-surface-2))] p-1 rounded-md w-full mb-4">
              <button
                className={`flex-1 py-1.5 text-xs rounded transition-all ${refillFormData.transactionType === "add" ? "bg-[rgb(var(--color-surface))] shadow text-teal-700 font-semibold" : "text-[rgb(var(--color-text-muted)/0.7)] hover:text-[rgb(var(--color-text))]"}`}
                type="button"
                onClick={() =>
                  setRefillFormData((prev) => ({
                    ...prev,
                    transactionType: "add",
                  }))
                }
              >
                <div className="flex items-center justify-center gap-1.5">
                  <IoAddCircleOutline className="w-4 h-4" />
                  Add to Stock
                </div>
              </button>
              <button
                className={`flex-1 py-1.5 text-xs rounded transition-all ${refillFormData.transactionType === "sub" ? "bg-[rgb(var(--color-surface))] shadow text-red-600 font-semibold" : "text-[rgb(var(--color-text-muted)/0.7)] hover:text-[rgb(var(--color-text))]"}`}
                type="button"
                onClick={() =>
                  setRefillFormData((prev) => ({
                    ...prev,
                    transactionType: "sub",
                  }))
                }
              >
                <div className="flex items-center justify-center gap-1.5">
                  <IoCloseCircleOutline className="w-4 h-4" />
                  Subtract from Stock
                </div>
              </button>
            </div>

            {/* Regular Stock Section */}
            <div>
              <h4 className="text-md font-semibold text-[rgb(var(--color-text))] mb-3">
                Regular Stock
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    Regular Quantity
                  </label>
                  <input
                    className="clarity-input h-8 w-full text-[13px] px-2"
                    min={0}
                    name="regularQuantity"
                    placeholder="Enter regular stock quantity"
                    type="number"
                    value={refillFormData.regularQuantity}
                    onChange={(e) =>
                      setRefillFormData((prev) => ({
                        ...prev,
                        regularQuantity: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Regular Sale Price (NPR)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted)/0.7)] text-[11px]">
                        NPR
                      </span>
                      <input
                        className="clarity-input with-prefix h-8 w-full text-[13px] pr-2"
                        min={0}
                        name="regularSalePrice"
                        placeholder="Enter sale price"
                        step="any"
                        type="number"
                        value={refillFormData.regularSalePrice}
                        onChange={(e) =>
                          setRefillFormData((prev) => ({
                            ...prev,
                            regularSalePrice: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Regular Cost Price (NPR)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted)/0.7)] text-[11px]">
                        NPR
                      </span>
                      <input
                        className="clarity-input with-prefix h-8 w-full text-[13px] pr-2"
                        min={0}
                        name="regularCostPrice"
                        placeholder="Enter cost price"
                        step="any"
                        type="number"
                        value={refillFormData.regularCostPrice}
                        onChange={(e) =>
                          setRefillFormData((prev) => ({
                            ...prev,
                            regularCostPrice: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scheme Stock Section */}
            <div className="pt-4 border-t border-default-200">
              <h4 className="text-md font-semibold text-[rgb(var(--color-text))] mb-3">
                Scheme Stock
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    Scheme Quantity
                  </label>
                  <input
                    className="clarity-input h-8 w-full text-[13px] px-2"
                    min={0}
                    name="schemeQuantity"
                    placeholder="Enter scheme stock quantity"
                    type="number"
                    value={refillFormData.schemeQuantity}
                    onChange={(e) =>
                      setRefillFormData((prev) => ({
                        ...prev,
                        schemeQuantity: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    Scheme Price (NPR)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted)/0.7)] text-[11px]">
                      NPR
                    </span>
                    <input
                      className="clarity-input with-prefix h-8 w-full text-[13px] pr-2"
                      min={0}
                      name="schemePrice"
                      placeholder="Enter scheme stock sale price"
                      step="any"
                      type="number"
                      value={refillFormData.schemePrice}
                      onChange={(e) =>
                        setRefillFormData((prev) => ({
                          ...prev,
                          schemePrice: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    Scheme Cost Price (NPR)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted)/0.7)] text-[11px]">
                      NPR
                    </span>
                    <input
                      className="clarity-input with-prefix h-8 w-full text-[13px] pr-2"
                      min={0}
                      name="schemeCostPrice"
                      placeholder="Enter cost price"
                      step="any"
                      type="number"
                      value={refillFormData.schemeCostPrice}
                      onChange={(e) =>
                        setRefillFormData((prev) => ({
                          ...prev,
                          schemeCostPrice: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Common Fields */}
            <div className="pt-4 border-t border-default-200">
              <h4 className="text-[12px] font-semibold text-[rgb(var(--color-text))] tracking-[0.08em] uppercase mb-3">
                Additional Information
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    Expiry Date <span className="text-danger">*</span>
                  </label>
                  <input
                    required
                    className="clarity-input h-8 w-full text-[13px] px-2"
                    name="expiryDate"
                    type="date"
                    value={refillFormData.expiryDate}
                    onChange={(e) =>
                      setRefillFormData((prev) => ({
                        ...prev,
                        expiryDate: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    Batch Number
                  </label>
                  <input
                    autoComplete="off"
                    className="clarity-input h-8 w-full text-[13px] px-2"
                    name="batchNumber"
                    placeholder="Enter batch number"
                    value={refillFormData.batchNumber}
                    onChange={(e) =>
                      setRefillFormData((prev) => ({
                        ...prev,
                        batchNumber: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                    Unit Price (NPR) - Legacy
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted)/0.7)] text-[11px]">
                      NPR
                    </span>
                    <input
                      className="clarity-input with-prefix h-8 w-full text-[13px] pr-2"
                      min={0}
                      name="unitPrice"
                      placeholder="Enter unit price (if sale price not provided)"
                      step="any"
                      type="number"
                      value={refillFormData.unitPrice}
                      onChange={(e) =>
                        setRefillFormData((prev) => ({
                          ...prev,
                          unitPrice: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Invoice Number
                    </label>
                    <div className="relative">
                      <input
                        className="clarity-input h-8 w-full text-[13px] px-2 pr-16"
                        name="invoiceNumber"
                        placeholder="Enter invoice number"
                        value={refillFormData.invoiceNumber}
                        onChange={(e) =>
                          setRefillFormData((prev) => ({
                            ...prev,
                            invoiceNumber: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                          }
                        }}
                      />
                      <button
                        className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-all"
                        type="button"
                        onClick={() => {
                          setRefillFormData((prev) => ({
                            ...prev,
                            invoiceNumber: generateBillNumber(),
                          }));
                        }}
                      >
                        GENERATE
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[rgb(var(--color-text))] mb-1.5 block">
                      Supplier
                    </label>
                    <select
                      className="clarity-input h-8 w-full text-[13px] px-2"
                      name="refillSupplierId"
                      value={refillFormData.supplierId}
                      onChange={(e) =>
                        setRefillFormData((prev) => ({
                          ...prev,
                          supplierId: e.target.value,
                        }))
                      }
                    >
                      <option value="">No Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                          {supplier.contactPerson
                            ? ` (${supplier.contactPerson})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
