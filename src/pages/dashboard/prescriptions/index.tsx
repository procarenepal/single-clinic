/**
 * Prescriptions List Page — Clinic Clarity without HeroUI
 */
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IoAddOutline,
  IoEyeOutline,
  IoCloseOutline,
  IoCreateOutline,
  IoDownloadOutline,
  IoFilterOutline,
  IoTrashOutline,
  IoSearchOutline,
  IoReceiptOutline,
  IoPrintOutline,
  IoChevronBack,
  IoChevronForward,
  IoChevronDown,
} from "react-icons/io5";
import * as XLSX from "xlsx";

import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";
import { clinicService } from "@/services/clinicService";
import { PrintLayoutConfig } from "@/types/printLayout";
import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";
import { prescriptionService } from "@/services/prescriptionService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { branchService } from "@/services/branchService";
import { Prescription } from "@/types/medical-records";
import { Branch, Doctor } from "@/types/models";

// ── Types ───────────────────────────────────────────────────────────────────
interface ExtendedPrescription extends Prescription {
  patientName: string;
  doctorName: string;
  itemsCount: number;
}

// ── Custom UI Helpers ────────────────────────────────────────────────────────
function CustomInput({
  value,
  onChange,
  placeholder,
  startContent,
  className,
  type = "text",
}: any) {
  return (
    <div
      className={`flex items-center border border-border-base rounded-[10px] min-h-[36px] bg-surface-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all ${className || ""}`}
    >
      {startContent && (
        <div className="pl-3 pr-2 text-text-muted flex items-center">
          {startContent}
        </div>
      )}
      <input
        className="flex-1 w-full text-[13px] px-2 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/50 font-medium"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function CustomSelect({ value, onChange, options, className, label }: any) {
  const selectedOption = options.find((o: any) => o.value === value);

  return (
    <div className={`flex flex-col gap-1.5 ${className || ""}`}>
      {label && (
        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <Dropdown className="w-full" placement="bottom-start">
        <DropdownTrigger className="w-full">
          <div className="w-full h-[36px] bg-surface-2 border border-border-base rounded-[10px] px-3 flex items-center justify-between text-[13px] font-medium text-text-main hover:bg-surface-3 transition-all cursor-pointer">
            <span className="truncate">
              {selectedOption?.label || "Select..."}
            </span>
            <IoChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0 ml-2" />
          </div>
        </DropdownTrigger>
        <DropdownMenu matchTriggerWidth className="w-full">
          {options.map((option: any) => (
            <DropdownItem
              key={option.value}
              className={
                value === option.value
                  ? "bg-primary/10 text-primary font-bold"
                  : ""
              }
              onClick={() =>
                onChange({ target: { value: option.value } } as any)
              }
            >
              {option.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}

function ModalShell({ isOpen, onClose, title, children, size = "md" }: any) {
  if (!isOpen) return null;
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };
  const maxWidth = sizeClasses[size as keyof typeof sizeClasses] || "max-w-md";

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-surface/40 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`bg-surface border border-border-base rounded-[10px] shadow-2xl w-full ${maxWidth} pointer-events-auto flex flex-col max-h-[90vh] overflow-hidden`}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-border-base bg-surface-2/50">
            <h3 className="text-lg font-bold text-text-main">{title}</h3>
            <button
              className="text-text-muted hover:text-text-main transition-colors"
              onClick={onClose}
            >
              <IoCloseOutline className="w-6 h-6" />
            </button>
          </div>
          <div className="px-6 py-6 overflow-y-auto">{children}</div>
        </div>
      </div>
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function PrescriptionsPage() {
  const navigate = useNavigate();
  const { clinicId, userData, branchId: contextBranchId } = useAuthContext();

  const branchId = userData?.branchId ?? contextBranchId ?? null;
  const isClinicAdmin =
    userData?.role === "clinic-admin" || userData?.role === "system-owner";

  const [prescriptions, setPrescriptions] = useState<ExtendedPrescription[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [branchMap, setBranchMap] = useState<Record<string, string>>({});
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig | null>(
    null,
  );
  const [clinic, setClinic] = useState<any>(null);

  const effectiveBranchId = branchId ?? selectedBranchId ?? undefined;

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Load branches for clinic admins (no fixed branchId)
  useEffect(() => {
    if (!clinicId || !isClinicAdmin || branchId) return;
    let cancelled = false;

    (async () => {
      try {
        const [branchesData, clinicData, layoutData] = await Promise.all([
          branchService.getClinicBranches(clinicId, true),
          clinicService.getClinicById(clinicId),
          clinicService.getPrintLayoutConfig(clinicId),
        ]);

        if (cancelled) return;
        setBranches(branchesData);
        if (clinicData) setClinic(clinicData);
        if (layoutData) setLayoutConfig(layoutData);

        const map: Record<string, string> = {};

        branchesData.forEach((b) => {
          map[b.id] = b.name;
        });
        setBranchMap(map);
        if (branchesData.length > 0) {
          const mainOrFirst =
            branchesData.find((b) => b.isMainBranch)?.id ?? branchesData[0].id;

          setSelectedBranchId((prev) => prev ?? mainOrFirst);
        } else {
          setSelectedBranchId(null);
        }
      } catch (err) {
        console.error("Prescriptions branches fetch error:", err);
        if (!cancelled) {
          setBranches([]);
          setBranchMap({});
          setSelectedBranchId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicId, isClinicAdmin, branchId]);

  // Load layout for non-admin or if admin but skipped above
  useEffect(() => {
    if (!clinicId || (isClinicAdmin && !branchId)) return;
    (async () => {
      try {
        const [clinicData, layoutData] = await Promise.all([
          clinicService.getClinicById(clinicId),
          clinicService.getPrintLayoutConfig(clinicId),
        ]);

        if (clinicData) setClinic(clinicData);
        if (layoutData) setLayoutConfig(layoutData);
      } catch (err) {
        console.error("Error loading print layout:", err);
      }
    })();
  }, [clinicId, isClinicAdmin, branchId]);

  useEffect(() => {
    if (branchId) setSelectedBranchId(null);
  }, [branchId]);

  // Load all doctors for the filter and determine current doctor if any
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        const [doctorsData, expertsData] = await Promise.all([
          doctorService.getDoctorsByClinic(clinicId),
          expertService.getExpertsByClinic(clinicId),
        ]);

        const formattedDoctors = (doctorsData || []).map((d: any) => ({
          ...d,
          name: `Dr. ${d.name}`,
        }));
        const formattedExperts = (expertsData || []).map((e: any) => ({
          ...e,
          name: `${e.name} (Expert)`,
        }));

        setAllDoctors([...formattedDoctors, ...formattedExperts]);

        if (!isClinicAdmin && userData?.email) {
          try {
            const [matchingDoctor, matchingExpert] = await Promise.all([
              doctorService.getDoctorByEmail(userData.email),
              expertService.getExpertByEmail(userData.email),
            ]);
            const matchingProvider = matchingDoctor || matchingExpert;

            if (matchingProvider) {
              setCurrentDoctorId(matchingProvider.id);
            }
          } catch (error) {
            console.error("Error checking provider linkage:", error);
          }
        }
      } catch (err) {
        console.error("Error fetching doctors:", err);
      }
    })();
  }, [clinicId, isClinicAdmin, userData]);

  useEffect(() => {
    const fetchPrescriptions = async () => {
      if (!clinicId) return;
      try {
        setLoading(true);
        setError(null);
        const prescriptionsData =
          await prescriptionService.getPrescriptionsByClinic(
            clinicId,
            effectiveBranchId,
          );

        let extendedPrescriptions = await Promise.all(
          prescriptionsData.map(async (prescription) => {
            const [patient, doctor, expert] = await Promise.all([
              patientService
                .getPatientById(prescription.patientId)
                .catch(() => null),
              doctorService
                .getDoctorById(prescription.doctorId)
                .catch(() => null),
              expertService
                .getExpertById(prescription.doctorId)
                .catch(() => null),
            ]);
            let itemsCount = 0;

            try {
              const items = await prescriptionService.getPrescriptionItems(
                prescription.id,
              );

              itemsCount = items.length;
            } catch (e) {}

            const resolvedDoctor = doctor || expert;

            return {
              ...prescription,
              patientName: patient ? patient.name : "Unknown Patient",
              doctorName: resolvedDoctor
                ? doctor
                  ? `Dr. ${resolvedDoctor.name}`
                  : `${resolvedDoctor.name} (Expert)`
                : "Unknown Doctor",
              itemsCount,
            } as ExtendedPrescription;
          }),
        );

        if (currentDoctorId) {
          extendedPrescriptions = extendedPrescriptions.filter(
            (p) => p.doctorId === currentDoctorId,
          );
        }

        extendedPrescriptions.sort(
          (a, b) =>
            new Date(b.prescriptionDate).getTime() -
            new Date(a.prescriptionDate).getTime(),
        );
        setPrescriptions(extendedPrescriptions);
      } catch (err) {
        console.error("Error fetching prescriptions:", err);
        setError("Failed to load prescriptions. Please try again.");
        addToast({
          title: "Error",
          description: "Failed to load prescriptions.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptions();
  }, [clinicId, effectiveBranchId, currentDoctorId]);

  const formatDate = (date: Date | string): string => {
    if (!date) return "N/A";
    const d = new Date(date);

    if (isNaN(d.getTime())) return "N/A";

    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const filteredPrescriptions = prescriptions.filter((p) => {
    const term = searchTerm.toLowerCase();
    const searchMatch =
      p.patientName.toLowerCase().includes(term) ||
      p.doctorName.toLowerCase().includes(term) ||
      p.prescriptionNo.toLowerCase().includes(term);
    const statusMatch = selectedStatus === "all" || p.status === selectedStatus;
    const doctorMatch =
      selectedDoctor === "all" || p.doctorId === selectedDoctor;

    const pDate = new Date(p.prescriptionDate);
    const dateMatch =
      (!dateRange.start || pDate >= new Date(dateRange.start)) &&
      (!dateRange.end || pDate <= new Date(dateRange.end));

    return searchMatch && statusMatch && doctorMatch && dateMatch;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPrescriptions.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPrescriptions = filteredPrescriptions.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedStatus("all");
    setSelectedDoctor("all");
    setDateRange({ start: "", end: "" });
    setCurrentPage(1);
    setIsFiltersOpen(false);
  };

  const hasAdvancedFilters =
    selectedStatus !== "all" ||
    selectedDoctor !== "all" ||
    dateRange.start ||
    dateRange.end;

  const exportPrescriptionsToXLSX = () => {
    try {
      const exportData = filteredPrescriptions.map((p) => ({
        "Prescription No.": p.prescriptionNo,
        "Patient Name": p.patientName,
        Doctor: p.doctorName,
        Diagnosis: p.diagnosis || "",
        "Prescription Date": formatDate(p.prescriptionDate),
        Status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
        "Medicines Count": p.itemsCount,
        Notes: p.notes || "",
        "Created Date": formatDate(p.createdAt),
        "Updated Date": formatDate(p.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);

      ws["!cols"] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
      ];
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Prescriptions");
      const filename = `prescriptions_export_${new Date().toISOString().split("T")[0]}.xlsx`;

      XLSX.writeFile(wb, filename);
      addToast({
        title: "Success",
        description: `Exported as ${filename}`,
        color: "success",
      });
    } catch (e) {
      addToast({
        title: "Error",
        description: "Failed to export Excel.",
        color: "danger",
      });
    }
  };

  const exportPrescriptionsToCSV = () => {
    try {
      const exportData = filteredPrescriptions.map((p) => ({
        "Prescription No.": p.prescriptionNo,
        "Patient Name": p.patientName,
        Doctor: p.doctorName,
        Diagnosis: p.diagnosis || "",
        "Prescription Date": formatDate(p.prescriptionDate),
        Status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
        "Medicines Count": p.itemsCount,
        Notes: p.notes || "",
        "Created Date": formatDate(p.createdAt),
        "Updated Date": formatDate(p.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Prescriptions");
      const filename = `prescriptions_export_${new Date().toISOString().split("T")[0]}.csv`;

      XLSX.writeFile(wb, filename, { bookType: "csv" });
      addToast({
        title: "Success",
        description: `Exported as ${filename}`,
        color: "success",
      });
    } catch (e) {
      addToast({
        title: "Error",
        description: "Failed to export CSV.",
        color: "danger",
      });
    }
  };

  const printPrescriptions = () => {
    try {
      const printWindow = window.open("", "_blank");

      if (!printWindow) throw new Error();

      const brandingCSS = layoutConfig ? getPrintBrandingCSS(layoutConfig) : "";
      const headerHTML = layoutConfig
        ? getPrintHeaderHTML(layoutConfig, clinic)
        : "";
      const footerHTML = layoutConfig ? getPrintFooterHTML(layoutConfig) : "";

      const printContent = `
        <!DOCTYPE html><html><head><title>Prescriptions Report</title>
        <style>
          ${brandingCSS}
          .print-container { width: 100%; display: flex; flex-direction: column; }
          .content { flex: 1; padding: 15mm; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; font-size: 20px; text-align: center; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .meta { color: #666; margin-bottom: 20px; font-size: 12px; }
          ${brandingCSS}
          @media print { body { padding: 0; } .print-container { min-height: auto; } }
        </style></head><body>
          <div class="print-container">
            ${headerHTML}
            <div class="content">
              <h1>Prescriptions Report</h1>
              <div class="meta"><p>Generated on: ${new Date().toLocaleString()}</p><p>Total Prescriptions: ${filteredPrescriptions.length}</p></div>
              <table>
                <thead><tr><th>No.</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Status</th><th>Items</th></tr></thead>
                <tbody>${filteredPrescriptions.map((p) => `<tr><td>${p.prescriptionNo}</td><td>${p.patientName}</td><td>${p.doctorName}</td><td>${formatDate(p.prescriptionDate)}</td><td>${p.status}</td><td>${p.itemsCount}</td></tr>`).join("")}</tbody>
              </table>
            </div>
            ${footerHTML}
          </div>
        </body></html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.addEventListener("onafterprint", () => printWindow.close());
    } catch (e) {
      addToast({
        title: "Error",
        description: "Failed to trigger print.",
        color: "danger",
      });
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-primary/10 text-primary border border-primary/20",
    completed: "bg-surface-2 text-text-muted border border-border-base",
    cancelled: "bg-red-500/10 text-red-500 border border-red-500/20",
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Prescriptions
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage patient prescriptions and medical records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!branchId && isClinicAdmin && branches.length > 0 && (
            <div className="flex items-center gap-1.5 bg-surface-2 border border-border-base px-2.5 py-1 rounded-[10px]">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Branch
              </span>
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <div className="h-6 flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity">
                    <span className="text-[12px] font-bold text-text-main">
                      {branches.find((b) => b.id === (selectedBranchId ?? ""))
                        ?.name || "All Branches"}
                    </span>
                    <IoChevronDown className="w-3 h-3 text-text-muted" />
                  </div>
                </DropdownTrigger>
                <DropdownMenu className="min-w-[150px]">
                  {branches.map((b) => (
                    <DropdownItem
                      key={b.id}
                      className={
                        selectedBranchId === b.id
                          ? "bg-primary/10 text-primary font-bold"
                          : ""
                      }
                      onClick={() => setSelectedBranchId(b.id)}
                    >
                      {b.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </div>
          )}
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button startContent={<IoDownloadOutline />} variant="bordered">
                Export
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Export options">
              <DropdownItem
                key="excel"
                startContent={<IoDownloadOutline />}
                onClick={exportPrescriptionsToXLSX}
              >
                Export to Excel
              </DropdownItem>
              <DropdownItem
                key="csv"
                startContent={<IoDownloadOutline />}
                onClick={exportPrescriptionsToCSV}
              >
                Export to CSV
              </DropdownItem>
              <DropdownItem
                key="print"
                startContent={<IoPrintOutline />}
                onClick={printPrescriptions}
              >
                Print Report
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button
            color="primary"
            startContent={<IoAddOutline />}
            onClick={() => navigate("/dashboard/prescriptions/new")}
          >
            New Prescription
          </Button>
        </div>
      </div>

      {/* Filter and Table Container */}
      <div className="bg-surface border border-border-base rounded-[10px] shadow-sm overflow-hidden">
        {/* Controls */}
        <div className="p-5 border-b border-border-base bg-surface-2/50 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-[11px] text-text-muted uppercase tracking-widest">
              Search & Filter
            </h4>
            <div className="flex gap-2">
              {hasAdvancedFilters && (
                <Button
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  size="sm"
                  startContent={<IoTrashOutline />}
                  variant="ghost"
                  onClick={clearAllFilters}
                >
                  Clear Filters
                </Button>
              )}
              <Button
                size="sm"
                startContent={<IoFilterOutline />}
                variant="flat"
                onClick={() => setIsFiltersOpen(true)}
              >
                Advanced Filters
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3 w-full">
            <CustomInput
              className="flex-1 w-full md:w-auto"
              placeholder="Search by patient, doctor, or Rx No..."
              startContent={<IoSearchOutline />}
              value={searchTerm}
              onChange={(e: any) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <CustomSelect
              className="w-full md:w-36"
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              value={selectedStatus}
              onChange={(e: any) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
            />
            <CustomSelect
              className="w-full md:w-48"
              options={[
                { value: "all", label: "All Doctors" },
                ...allDoctors.map((d) => ({
                  value: d.id,
                  label: `Dr. ${d.name}`,
                })),
              ]}
              value={selectedDoctor}
              onChange={(e: any) => {
                setSelectedDoctor(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {hasAdvancedFilters && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-mountain-100">
              {selectedStatus !== "all" && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-[10px] text-[12px] font-semibold text-primary">
                  Status: <span className="capitalize">{selectedStatus}</span>
                  <button
                    className="text-primary hover:text-primary-dark transition-colors"
                    onClick={() => setSelectedStatus("all")}
                  >
                    <IoAddOutline className="w-3.5 h-3.5 rotate-45" />
                  </button>
                </div>
              )}
              {selectedDoctor !== "all" && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 border border-border-base rounded-[10px] text-[12px] font-semibold text-text-main">
                  Doctor:{" "}
                  {allDoctors.find((d) => d.id === selectedDoctor)?.name}
                  <button
                    className="text-text-muted hover:text-text-main transition-colors"
                    onClick={() => setSelectedDoctor("all")}
                  >
                    <IoAddOutline className="w-3.5 h-3.5 rotate-45" />
                  </button>
                </div>
              )}
              {(dateRange.start || dateRange.end) && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-[10px] text-[12px] font-semibold text-primary">
                  Date: {dateRange.start || "Any"} - {dateRange.end || "Any"}
                  <button
                    className="text-primary hover:text-primary-dark transition-colors"
                    onClick={() => setDateRange({ start: "", end: "" })}
                  >
                    <IoAddOutline className="w-3.5 h-3.5 rotate-45" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters Modal */}
        <ModalShell
          isOpen={isFiltersOpen}
          size="md"
          title="Advanced Filters"
          onClose={() => setIsFiltersOpen(false)}
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                From Date
              </label>
              <input
                className="h-[36px] bg-surface-2 border border-border-base rounded-[10px] px-3 text-sm text-text-main focus:outline-none focus:border-primary transition-all font-medium"
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                To Date
              </label>
              <input
                className="h-[36px] bg-surface-2 border border-border-base rounded-[10px] px-3 text-sm text-text-main focus:outline-none focus:border-primary transition-all font-medium"
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="bordered"
              onClick={() => {
                setDateRange({ start: "", end: "" });
                setIsFiltersOpen(false);
              }}
            >
              Reset Range
            </Button>
            <Button color="primary" onClick={() => setIsFiltersOpen(false)}>
              Apply Filters
            </Button>
          </div>
        </ModalShell>

        {/* Table/Content Area */}
        <div className="p-0 overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="p-6">
              <TableSkeleton cols={6} rows={10} />
            </div>
          ) : error ? (
            <div className="flex flex-col justify-center items-center h-[400px] gap-4 text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main">
                  Error Loading Prescriptions
                </h3>
                <p className="text-sm font-medium text-text-muted mt-1 max-w-sm">
                  {error}
                </p>
              </div>
              <Button color="primary" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          ) : currentPrescriptions.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-[400px] gap-6 text-center p-6 bg-surface-2/30">
              <div className="w-20 h-20 rounded-[10px] bg-surface-2 flex items-center justify-center border border-border-base shadow-inner">
                <IoReceiptOutline className="w-10 h-10 text-text-muted/40" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main">
                  {searchTerm || hasAdvancedFilters
                    ? "No prescriptions found"
                    : "No prescriptions yet"}
                </h3>
                <p className="text-sm font-medium text-text-muted mt-1 max-w-sm">
                  {searchTerm || hasAdvancedFilters
                    ? "Try adjusting your filters or search term to find what you're looking for."
                    : "Start writing prescriptions for your patients to see them here."}
                </p>
              </div>
              {!searchTerm && !hasAdvancedFilters && (
                <Button
                  color="primary"
                  startContent={<IoAddOutline />}
                  onClick={() => navigate("/dashboard/prescriptions/new")}
                >
                  Create First Prescription
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-2/50 border-b border-border-base">
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    No.
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Doctor
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Diagnosis
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base">
                {currentPrescriptions.map((prescription) => (
                  <tr
                    key={prescription.id}
                    className="hover:bg-surface-2/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <Link
                        className="text-sm font-bold text-text-main group-hover:text-primary transition-colors"
                        to={`/dashboard/prescriptions/${prescription.id}`}
                      >
                        {prescription.prescriptionNo}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-text-main">
                        {prescription.patientName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-text-main">
                        {prescription.doctorName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-text-muted">
                        {formatDate(prescription.prescriptionDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className="text-sm text-text-muted truncate max-w-[150px]"
                        title={prescription.diagnosis}
                      >
                        {prescription.diagnosis || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${statusColors[prescription.status] || "bg-surface-2 text-text-muted border border-border-base"}`}
                      >
                        {prescription.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onClick={() =>
                            navigate(
                              `/dashboard/prescriptions/${prescription.id}`,
                            )
                          }
                        >
                          <IoEyeOutline className="w-4 h-4" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onClick={() =>
                            navigate(
                              `/dashboard/prescriptions/${prescription.id}/edit`,
                            )
                          }
                        >
                          <IoCreateOutline className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && currentPrescriptions.length > 0 && (
          <div className="px-6 py-4 border-t border-border-base bg-surface-2/30 flex items-center justify-between">
            <p className="text-xs font-medium text-text-muted">
              Showing{" "}
              <span className="font-bold text-text-main mx-1">
                {startIndex + 1}
              </span>{" "}
              to{" "}
              <span className="font-bold text-text-main mx-1">
                {Math.min(
                  startIndex + itemsPerPage,
                  filteredPrescriptions.length,
                )}
              </span>{" "}
              of{" "}
              <span className="font-bold text-text-main mx-1">
                {filteredPrescriptions.length}
              </span>
              prescriptions
            </p>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                className="w-8 h-8 rounded-[10px] border-border-base"
                disabled={currentPage === 1}
                size="sm"
                variant="bordered"
                onClick={() => handlePageChange(currentPage - 1)}
              >
                <IoChevronBack className="w-3.5 h-3.5" />
              </Button>
              <div className="px-4 py-1.5 bg-surface-2 border border-border-base rounded-[10px] text-xs font-bold text-text-main min-w-[60px] text-center">
                {currentPage} / {totalPages}
              </div>
              <Button
                isIconOnly
                className="w-8 h-8 rounded-[10px] border-border-base"
                disabled={currentPage === totalPages}
                size="sm"
                variant="bordered"
                onClick={() => handlePageChange(currentPage + 1)}
              >
                <IoChevronForward className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
