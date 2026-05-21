import { useState, useEffect, useCallback } from "react";
import {
  IoMedicalOutline,
  IoWarningOutline,
  IoAlertCircleOutline,
  IoMedkitOutline,
  IoFlaskOutline,
  IoBusinessOutline,
  IoSettingsOutline,
  IoArchiveOutline,
  IoPeopleOutline,
  IoReceiptOutline,
} from "react-icons/io5";

import MedicinesTab from "./tabs/MedicinesTab";

import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui";
import { useAuthContext } from "@/context/AuthContext";
import { medicineService } from "@/services/medicineService";
import { clinicSettingsService } from "@/services/clinicSettingsService";
import { ClinicSettings, Branch } from "@/types/models";
import { branchService } from "@/services/branchService";

// Import sub-components
import BrandsTab from "@/pages/dashboard/medicine-management/tabs/BrandsTab";
import CategoriesTab from "@/pages/dashboard/medicine-management/tabs/CategoriesTab";
import StockTab from "@/pages/dashboard/medicine-management/tabs/StockTab";
import SuppliersTab from "@/pages/dashboard/medicine-management/tabs/SuppliersTab";
import PurchaseRecordsTab from "@/pages/dashboard/medicine-management/tabs/PurchaseRecordsTab";
import SettingsTab from "@/pages/dashboard/medicine-management/tabs/SettingsTab";

export default function MedicineManagementPage() {
  const { userData, clinicId, branchId } = useAuthContext();
  const isClinicAdmin =
    userData?.role === "system-owner" || userData?.role === "clinic-admin";
  const [selectedTab, setSelectedTab] = useState("medicines");
  const [isLoading, setIsLoading] = useState(true);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings | null>(
    null,
  );
  const [filterType, setFilterType] = useState<
    "lowStock" | "expiring" | "medicines" | "brands" | "categories" | null
  >(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalMedicines: 0,
    lowStockItems: 0,
    expiringItems: 0,
    totalBrands: 0,
    totalCategories: 0,
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isMultiBranch, setIsMultiBranch] = useState(false);

  const mainBranchId = branches.find((b) => b.isMainBranch)?.id ?? null;
  const effectiveBranchId =
    !isMultiBranch ||
    (isClinicAdmin &&
      (selectedBranchId === null ||
        (mainBranchId && selectedBranchId === mainBranchId)))
      ? undefined
      : (userData?.branchId ?? (selectedBranchId || undefined));

  // Only require branch selector for multi-branch clinics; individual clinics use clinic-wide scope
  const requiresBranchSelection = !branchId && isClinicAdmin && isMultiBranch;
  const hasBranchScope =
    !!branchId || selectedBranchId !== null || !isMultiBranch;

  // Load branches for clinic-wide admins (no fixed branchId); detect multi-branch for individual clinics
  useEffect(() => {
    if (!clinicId) return;
    if (branchId) {
      setIsMultiBranch(true);

      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const multi = await branchService.isMultiBranchEnabled(clinicId);

        if (cancelled) return;
        setIsMultiBranch(multi);

        if (!isClinicAdmin || branchId) return;

        const data = await branchService.getClinicBranches(clinicId, true);

        if (cancelled) return;
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId((prev) => prev ?? data[0].id);
        } else {
          setSelectedBranchId(null);
        }
      } catch (error) {
        console.error("Medicine management branches fetch error:", error);
        if (!cancelled) {
          setIsMultiBranch(false);
          setBranches([]);
          setSelectedBranchId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicId, isClinicAdmin, branchId]);

  const loadDashboardStats = useCallback(
    async (settingsOverride?: ClinicSettings | null) => {
      if (!clinicId) return;

      // For clinic admins without a fixed branch, require an explicit branch selection (including "Main branch" for collective data)
      if (!branchId && isClinicAdmin && selectedBranchId === null) {
        return;
      }

      try {
        setIsLoadingStats(true);
        const [medicines, brands, categories] = await Promise.all([
          medicineService.getMedicinesByClinic(
            clinicId,
            undefined,
            effectiveBranchId || undefined,
          ),
          medicineService.getMedicineBrandsByClinic(
            clinicId,
            effectiveBranchId || undefined,
          ),
          medicineService.getMedicineCategoriesByClinic(
            clinicId,
            effectiveBranchId || undefined,
          ),
        ]);

        const stockData = await medicineService.getStockByClinic(
          clinicId,
          effectiveBranchId || undefined,
        );
        const medicineStocks: Record<string, number> = {};
        const aggregatedStocks: Record<
          string,
          { currentStock: number; schemeStock: number; reorderLevel: number }
        > = {};

        stockData.forEach((stock) => {
          medicineStocks[stock.medicineId] =
            (medicineStocks[stock.medicineId] || 0) + stock.currentStock;
          if (!aggregatedStocks[stock.medicineId]) {
            aggregatedStocks[stock.medicineId] = {
              currentStock: 0,
              schemeStock: 0,
              reorderLevel: stock.reorderLevel || 10,
            };
          }
          aggregatedStocks[stock.medicineId].currentStock += stock.currentStock;
          aggregatedStocks[stock.medicineId].schemeStock +=
            stock.schemeStock || 0;
        });

        const settings = settingsOverride ?? clinicSettings;
        const lowStockThreshold = settings?.lowStockThreshold || 10;
        const expiryAlertDays = settings?.expiryAlertDays || 30;

        const lowStockItems = Object.values(aggregatedStocks).filter((s) => {
          const totalStock = s.currentStock + s.schemeStock;

          return totalStock <= s.reorderLevel;
        });

        const alertDate = new Date();

        alertDate.setDate(alertDate.getDate() + expiryAlertDays);
        const expiringItems = medicines.filter(
          (medicine) => medicine.expiryDate && medicine.expiryDate <= alertDate,
        );

        setDashboardStats({
          totalMedicines: medicines.length,
          lowStockItems: lowStockItems.length,
          expiringItems: expiringItems.length,
          totalBrands: brands.length,
          totalCategories: categories.length,
        });
      } catch (error) {
        console.error("Error loading dashboard stats:", error);
        addToast({
          title: "Warning",
          description: "Failed to load some dashboard statistics",
        });
      } finally {
        setIsLoadingStats(false);
      }
    },
    [
      clinicId,
      branchId,
      isClinicAdmin,
      selectedBranchId,
      effectiveBranchId,
      clinicSettings,
      isMultiBranch,
    ],
  );

  // Check permissions and load clinic settings (do not depend on loadDashboardStats to avoid re-run when clinicSettings updates)
  useEffect(() => {
    let cancelled = false;

    const initializePage = async () => {
      if (!clinicId || !userData) {
        setIsLoading(false);

        return;
      }

      try {
        setIsLoading(true);

        const settings =
          await clinicSettingsService.getClinicSettings(clinicId);

        if (cancelled) return;
        setClinicSettings(settings);

        // Load stats using the freshly fetched settings so we don't depend on clinicSettings state
        const [medicines, brands, categories] = await Promise.all([
          medicineService.getMedicinesByClinic(
            clinicId,
            undefined,
            effectiveBranchId || undefined,
          ),
          medicineService.getMedicineBrandsByClinic(
            clinicId,
            effectiveBranchId || undefined,
          ),
          medicineService.getMedicineCategoriesByClinic(
            clinicId,
            effectiveBranchId || undefined,
          ),
        ]);

        const stockData = await medicineService.getStockByClinic(
          clinicId,
          effectiveBranchId || undefined,
        );

        const medicineStocks: Record<string, number> = {};
        const aggregatedStocks: Record<
          string,
          { currentStock: number; schemeStock: number; reorderLevel: number }
        > = {};

        stockData.forEach((stock) => {
          medicineStocks[stock.medicineId] =
            (medicineStocks[stock.medicineId] || 0) + stock.currentStock;
          if (!aggregatedStocks[stock.medicineId]) {
            aggregatedStocks[stock.medicineId] = {
              currentStock: 0,
              schemeStock: 0,
              reorderLevel: stock.reorderLevel || 10,
            };
          }
          aggregatedStocks[stock.medicineId].currentStock += stock.currentStock;
          aggregatedStocks[stock.medicineId].schemeStock +=
            stock.schemeStock || 0;
        });

        const lowStockThreshold = settings?.lowStockThreshold || 10;
        const expiryAlertDays = settings?.expiryAlertDays || 30;
        const lowStockItems = Object.values(aggregatedStocks).filter((s) => {
          const totalStock = s.currentStock + s.schemeStock;

          return totalStock <= s.reorderLevel;
        });
        const alertDate = new Date();

        alertDate.setDate(alertDate.getDate() + expiryAlertDays);
        const expiringItems = medicines.filter(
          (medicine) => medicine.expiryDate && medicine.expiryDate <= alertDate,
        );

        if (cancelled) return;
        setDashboardStats({
          totalMedicines: medicines.length,
          lowStockItems: lowStockItems.length,
          expiringItems: expiringItems.length,
          totalBrands: brands.length,
          totalCategories: categories.length,
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Error initializing medicine management page:", error);
          addToast({
            title: "Error",
            description: "Failed to load medicine management data",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initializePage();

    return () => {
      cancelled = true;
    };
  }, [
    clinicId,
    userData,
    effectiveBranchId,
    selectedBranchId,
    isMultiBranch,
    mainBranchId,
    branches.length,
  ]);

  const refreshStats = useCallback(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  // Handle settings changes and refresh stats
  const handleSettingsChange = useCallback(
    (newSettings: any) => {
      setClinicSettings(newSettings);
      // Refresh stats immediately to reflect new thresholds
      setTimeout(() => {
        loadDashboardStats();
      }, 100); // Small delay to ensure state has updated
    },
    [loadDashboardStats],
  );

  // Handler for clicking on dashboard stat cards
  const handleStatCardClick = useCallback((cardType: string) => {
    switch (cardType) {
      case "lowStock":
        setSelectedTab("medicines");
        setFilterType("lowStock");
        break;
      case "expiring":
        setSelectedTab("medicines");
        setFilterType("expiring");
        break;
      case "medicines":
        setSelectedTab("medicines");
        setFilterType(null);
        break;
      case "brands":
        setSelectedTab("brands");
        setFilterType(null);
        break;
      case "categories":
        setSelectedTab("categories");
        setFilterType(null);
        break;
      default:
        break;
    }
  }, []);

  // Clear filter when tab changes manually
  const handleTabChange = useCallback((key: React.Key) => {
    setSelectedTab(key as string);
    if (key !== "medicines") {
      setFilterType(null);
    }
  }, []);

  // Main Loading State
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!clinicId) {
    return (
      <>
        <div className="max-w-7xl mx-auto">
          <div className="clarity-card bg-danger-50 border-danger-200">
            <div className="text-center py-8">
              <IoAlertCircleOutline className="mx-auto mb-4 text-4xl text-danger" />
              <h2 className="text-stat-sm font-semibold text-danger mb-2">
                Access Denied
              </h2>
              <p className="text-danger-600">
                You need to be associated with a clinic to access medicine
                management.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto">
        {/* Header section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className={title({ size: "lg", color: "primary" })}>
                Medicine Management
              </h1>
              <p className="text-[13.5px] text-text-muted mt-1">
                Manage medicines, inventory, brands, and supplier information
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {!branchId && isClinicAdmin && branches.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[rgb(var(--color-text-muted))]">
                    Branch
                  </span>
                  <select
                    className="h-8 px-2.5 py-0 text-[12px] border border-[rgb(var(--color-border))] rounded bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] focus:outline-none focus:border-[rgb(var(--color-primary))] focus:ring-1 focus:ring-[rgb(var(--color-primary)/0.2)]"
                    value={selectedBranchId ?? ""}
                    onChange={(e) =>
                      setSelectedBranchId(e.target.value || null)
                    }
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
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-sm border ${
                  clinicSettings?.sellsMedicines
                    ? "bg-health-100 text-health-700 border-health-200"
                    : "text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface-3))]"
                } flex items-center gap-1.5`}
              >
                <IoMedicalOutline />
                {clinicSettings?.sellsMedicines
                  ? "Medicine Selling Enabled"
                  : "Prescription Only"}
              </span>
            </div>
          </div>
        </div>

        {/* Medicine selling status info */}
        {!clinicSettings?.sellsMedicines && (
          <div className="mb-6">
            <div className="clarity-card bg-saffron-500/10 border-saffron-500/20 p-4">
              <div className="flex items-start gap-3">
                <IoWarningOutline className="text-saffron-500 text-stat-sm mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-saffron-500 mb-1">
                    Prescription Only Mode
                  </h3>
                  <p className="text-sm text-saffron-500/80">
                    Your clinic is currently configured for prescription only.
                    Medicine prices won't be included in invoices. To enable
                    medicine selling, go to the Settings tab and configure your
                    medicine selling options.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Require branch selection for clinic admins without fixed branch */}
        {requiresBranchSelection && !hasBranchScope && (
          <div className="mb-6">
            <div className="clarity-card bg-mountain-50 border-mountain-200 p-4">
              <div className="flex items-start gap-3">
                <IoWarningOutline className="text-mountain-600 text-stat-sm mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-mountain-800 mb-1">
                    Select a branch to manage medicines
                  </h3>
                  <p className="text-sm text-mountain-600">
                    Choose a branch from the selector above to view and manage
                    medicines, stock, brands, and suppliers for that branch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Stats Cards */}
        {(!requiresBranchSelection || hasBranchScope) && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 relative">
            {isLoadingStats && (
              <div className="absolute inset-0 bg-surface/40 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-32 h-1 bg-border-base overflow-hidden rounded-full">
                    <div className="h-full bg-primary animate-[shimmer_1.5s_infinite] w-1/2" />
                  </div>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    Updating Stats
                  </span>
                </div>
              </div>
            )}

            <div
              className="clarity-card cursor-pointer hover:border-teal-300 transition-colors px-3 py-2 flex flex-col justify-center h-[76px] block"
              role="button"
              onClick={() => handleStatCardClick("medicines")}
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="p-1 bg-primary/10 rounded">
                    <IoMedkitOutline className="text-primary" size={14} />
                  </div>
                  <span className="text-[11.5px] font-semibold text-text-muted">
                    Total Medicines
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[rgb(var(--color-text))] leading-none">
                  {dashboardStats.totalMedicines}
                </p>
              </div>
            </div>

            <div
              className={`clarity-card transition-colors px-3 py-2 flex flex-col justify-center h-[76px] ${
                dashboardStats.lowStockItems > 0
                  ? "cursor-pointer hover:border-saffron-300"
                  : ""
              }`}
              role="button"
              onClick={() =>
                dashboardStats.lowStockItems > 0 &&
                handleStatCardClick("lowStock")
              }
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="p-1 bg-warning/10 rounded">
                    <IoWarningOutline className="text-warning" size={14} />
                  </div>
                  <span className="text-[11.5px] font-semibold text-text-muted">
                    Low Stock
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[rgb(var(--color-text))] leading-none">
                  {dashboardStats.lowStockItems}
                </p>
                {clinicSettings && (
                  <p className="text-[10px] text-warning font-semibold mt-1 leading-none">
                    Threshold: ≤{clinicSettings.lowStockThreshold || 10}
                  </p>
                )}
              </div>
            </div>

            <div
              className={`clarity-card transition-colors px-3 py-2 flex flex-col justify-center h-[76px] ${
                dashboardStats.expiringItems > 0
                  ? "cursor-pointer hover:border-rose-300"
                  : ""
              }`}
              role="button"
              onClick={() =>
                dashboardStats.expiringItems > 0 &&
                handleStatCardClick("expiring")
              }
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="p-1 bg-danger/10 rounded">
                    <IoAlertCircleOutline className="text-danger" size={14} />
                  </div>
                  <span className="text-[11.5px] font-semibold text-text-muted">
                    Expiring Soon
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[rgb(var(--color-text))] leading-none">
                  {dashboardStats.expiringItems}
                </p>
                {clinicSettings && (
                  <p className="text-[10px] text-danger/80 font-medium mt-1 leading-none">
                    Within {clinicSettings.expiryAlertDays || 30} days
                  </p>
                )}
              </div>
            </div>

            <div
              className="clarity-card cursor-pointer hover:border-teal-300 transition-colors px-3 py-2 flex flex-col justify-center h-[76px]"
              role="button"
              onClick={() => handleStatCardClick("brands")}
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="p-1 bg-primary/10 rounded">
                    <IoBusinessOutline className="text-primary" size={14} />
                  </div>
                  <span className="text-[11.5px] font-semibold text-text-muted">
                    Brands
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[rgb(var(--color-text))] leading-none">
                  {dashboardStats.totalBrands}
                </p>
              </div>
            </div>

            <div
              className="clarity-card cursor-pointer hover:border-teal-300 transition-colors px-3 py-2 flex flex-col justify-center h-[76px]"
              role="button"
              onClick={() => handleStatCardClick("categories")}
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="p-1 bg-primary/10 rounded">
                    <IoFlaskOutline className="text-primary" size={14} />
                  </div>
                  <span className="text-[11.5px] font-semibold text-text-muted">
                    Categories
                  </span>
                </div>
                <p className="text-[18px] font-bold text-[rgb(var(--color-text))] leading-none">
                  {dashboardStats.totalCategories}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Medicine Management Tabs */}
        {(!requiresBranchSelection || hasBranchScope) && (
          <div className="clarity-card pb-0 rounded-b-none">
            <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3 rounded-t-lg">
              <div className="flex items-center gap-2">
                <IoMedicalOutline className="w-5 h-5 text-primary" />
                <h2 className="text-[15px] font-semibold text-primary">
                  Medicine Management
                </h2>
              </div>
            </div>
            <div>
              <div className="flex overflow-x-auto w-full border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))]">
                {[
                  {
                    key: "medicines",
                    icon: <IoMedkitOutline />,
                    title: "Medicines",
                    count: dashboardStats.totalMedicines,
                  },
                  {
                    key: "stock",
                    icon: <IoArchiveOutline />,
                    title: "Stock",
                    count: dashboardStats.lowStockItems,
                    countStyle: "bg-saffron-100 text-saffron-700",
                  },
                  {
                    key: "brands",
                    icon: <IoBusinessOutline />,
                    title: "Brands",
                    count: dashboardStats.totalBrands,
                  },
                  {
                    key: "categories",
                    icon: <IoFlaskOutline />,
                    title: "Categories",
                    count: dashboardStats.totalCategories,
                  },
                  {
                    key: "suppliers",
                    icon: <IoPeopleOutline />,
                    title: "Suppliers",
                  },
                  {
                    key: "purchase-records",
                    icon: <IoReceiptOutline />,
                    title: "Purchase Records",
                  },
                  {
                    key: "settings",
                    icon: <IoSettingsOutline />,
                    title: "Settings",
                  },
                ]
                  .filter(Boolean)
                  .map(
                    (tab) =>
                      tab && (
                        <button
                          key={tab.key}
                          className={`flex items-center gap-2 px-4 h-11 text-[13px] font-semibold transition-colors whitespace-nowrap ${
                            selectedTab === tab.key
                              ? "text-primary border-b-2 border-primary bg-primary/5 relative top-[1px]"
                              : "text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface-3))]"
                          }`}
                          onClick={() => handleTabChange(tab.key)}
                        >
                          {tab.icon}
                          <span>{tab.title}</span>
                          {tab.count !== undefined && tab.count > 0 && (
                            <span
                              className={`ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${tab.countStyle || "bg-primary/20 text-primary border border-primary/20"}`}
                            >
                              {tab.count}
                            </span>
                          )}
                        </button>
                      ),
                  )}
              </div>

              <div className="bg-[rgb(var(--color-surface))] rounded-b-lg border border-t-0 border-[rgb(var(--color-border))]">
                {selectedTab === "medicines" && (
                  <div className="p-4">
                    <MedicinesTab
                      clinicSettings={clinicSettings}
                      effectiveBranchId={effectiveBranchId}
                      filterType={filterType}
                      onStatsChange={refreshStats}
                    />
                  </div>
                )}

                {selectedTab === "stock" && (
                  <div className="p-4">
                    <StockTab
                      clinicSettings={clinicSettings}
                      effectiveBranchId={effectiveBranchId}
                      onStatsChange={refreshStats}
                    />
                  </div>
                )}

                {selectedTab === "brands" && (
                  <div className="p-4">
                    <BrandsTab
                      effectiveBranchId={effectiveBranchId}
                      onStatsChange={refreshStats}
                    />
                  </div>
                )}

                {selectedTab === "categories" && (
                  <div className="p-4">
                    <CategoriesTab
                      effectiveBranchId={effectiveBranchId}
                      onStatsChange={refreshStats}
                    />
                  </div>
                )}

                {selectedTab === "suppliers" && (
                  <div className="p-4">
                    <SuppliersTab effectiveBranchId={effectiveBranchId} />
                  </div>
                )}

                {selectedTab === "purchase-records" && (
                  <div className="p-4">
                    <PurchaseRecordsTab
                      effectiveBranchId={effectiveBranchId}
                      onStatsChange={refreshStats}
                    />
                  </div>
                )}

                {selectedTab === "settings" && (
                  <div className="p-4">
                    <SettingsTab
                      clinicSettings={clinicSettings}
                      onSettingsChange={handleSettingsChange}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
