import type { QueryDocumentSnapshot } from "firebase/firestore";

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

// Auth & context
import {
  IoPersonAddOutline,
  IoSearchOutline,
  IoFilterOutline,
  IoChevronForwardOutline,
  IoChevronBackOutline,
  IoDownloadOutline,
  IoPrintOutline,
  IoEllipsisVerticalOutline,
  IoCloseOutline,
  IoPersonOutline,
  IoAlertCircleOutline,
} from "react-icons/io5";

import { useAuth } from "@/hooks/useAuth";
// Services
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { branchService } from "@/services/branchService";
// Types
import { Patient, Branch } from "@/types/models";
// Custom UI
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown";
import { addToast } from "@/components/ui/toast";
// Icons

// ── Small inline helper components ────────────────────────────────────────────

/** Clinic Clarity status badge — no HeroUI Chip */
function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "critical" | "normal" | "primary" | "default";
}) {
  const cls = {
    critical: "bg-error/10 text-error border border-error/20",
    normal: "bg-success/10 text-success border border-success/20",
    primary: "bg-primary/10 text-primary border border-primary/20",
    default: "bg-surface-2 text-text-muted border border-border-base",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}
    >
      {children}
    </span>
  );
}

/** Inline filter chip */
function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
      {label}
      <button
        className="hover:text-error ml-0.5"
        type="button"
        onClick={onRemove}
      >
        <IoCloseOutline className="w-3 h-3" />
      </button>
    </span>
  );
}

/** Inline custom select — replaces HeroUI Select for simple filter dropdowns */
function NativeSelect({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      className={`h-8 px-2.5 py-0 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

/** Custom inline modal — replaces HeroUI Modal */
function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="relative bg-surface border border-border-base rounded-md shadow-none w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border-base">
          <div>
            <h3 className="text-[14px] font-semibold text-text-main">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[12px] text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            className="p-1 text-text-muted hover:text-text-main rounded"
            type="button"
            onClick={onClose}
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="px-4 py-3 overflow-y-auto flex-1 text-text-main">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-base">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Custom pagination — replaces HeroUI Pagination */
function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= 1) return null;
  const pages = Array.from({ length: Math.min(total, 7) }, (_, i) => {
    if (total <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= total - 3) return total - 6 + i;

    return page - 3 + i;
  });

  return (
    <div className="flex items-center gap-1.5">
      <button
        aria-label="Previous page"
        className="w-8 h-8 flex items-center justify-center rounded border border-border-base text-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary hover:text-primary hover:bg-surface-2 transition-all"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        <IoChevronBackOutline className="w-4 h-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={`w-8 h-8 text-[12px] font-medium rounded border transition-all ${p === page
            ? "bg-primary text-white border-primary shadow-sm"
            : "border-border-base text-text-muted hover:border-primary hover:text-primary hover:bg-surface-2"
            }`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        aria-label="Next page"
        className="w-8 h-8 flex items-center justify-center rounded border border-border-base text-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary hover:text-primary hover:bg-surface-2 transition-all"
        disabled={page === total}
        onClick={() => onChange(page + 1)}
      >
        <IoChevronForwardOutline className="w-4 h-4" />
      </button>
    </div>
  );
}

const isDev = import.meta.env.DEV;
const debug = (msg: string, data?: object) => {
  if (isDev)
    console.log(
      `%c[PatientsSearch] ${msg}`,
      "color: #0d9488; font-weight: bold",
      data ?? "",
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PatientsPage() {
  const { clinicId, userData, isSystemOwner: checkOwner, isClinicAdmin: checkAdmin } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchMap, setBranchMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // ── Filters
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [criticalFilter, setCriticalFilter] = useState("all");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [regStart, setRegStart] = useState("");
  const [regEnd, setRegEnd] = useState("");

  // ── Pagination
  const PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [cursorByPage, setCursorByPage] = useState<
    Record<number, QueryDocumentSnapshot | null>
  >({});

  // ── Modals
  const [criticalModal, setCriticalModal] = useState(false);
  const [filtersModal, setFiltersModal] = useState(false);
  const [selectedForCritical, setSelectedForCritical] =
    useState<Patient | null>(null);
  const [criticalReason, setCriticalReason] = useState("");
  const [savingCritical, setSavingCritical] = useState(false);

  // ── Doctor view
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);

  // Branch context
  const branchId = userData?.branchId ?? null;
  const isSystemOwner = checkOwner() || checkAdmin();
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const mainBranchId = branches.find((b) => b.isMainBranch)?.id ?? null;
  const effectiveBranchId =
    branchId ??
    (mainBranchId && branchFilter === mainBranchId
      ? undefined
      : (branchFilter ?? undefined));

  const useServerPagination =
    !search.trim() && !ageMin && !ageMax && !regStart && !regEnd;

  const fetchPatientsPaginated = useCallback(
    async (
      targetPage: number,
      cursor?: QueryDocumentSnapshot | null,
      doctorIdOverride?: string | null,
    ): Promise<
      | {
        patients: Patient[];
        lastDoc: QueryDocumentSnapshot | null;
        totalCount?: number;
      }
      | undefined
    > => {
      const searchPrefix = search.trim() || undefined;

      debug("fetchPatientsPaginated called", {
        targetPage,
        searchPrefix,
        searchRaw: search,
        genderFilter,
        criticalFilter,
      });
      if (!clinicId) {
        debug("fetchPatientsPaginated skipped (no clinicId)");

        return undefined;
      }
      try {
        const isCriticalOpt =
          criticalFilter === "critical"
            ? true
            : criticalFilter === "non-critical"
              ? false
              : undefined;
        const effectiveDoctorId = doctorIdOverride ?? currentDoctorId;
        const { patients: pagePatients, lastDoc: nextLastDoc } =
          await patientService.getPatientsByClinicPaginated(undefined, {
            pageSize: PER_PAGE,
            lastDoc: targetPage === 1 ? undefined : (cursor ?? undefined),
            doctorId: effectiveDoctorId ?? undefined,
            searchPrefix,
            gender: genderFilter === "all" ? undefined : genderFilter,
            isCritical: isCriticalOpt,
            branchId: effectiveBranchId,
          });
        let totalCount: number | undefined;

        if (targetPage === 1) {
          totalCount = await patientService.getPatientsCountByClinic(undefined, {
            doctorId: effectiveDoctorId ?? undefined,
            searchPrefix,
            gender: genderFilter === "all" ? undefined : genderFilter,
            isCritical: isCriticalOpt,
            branchId: effectiveBranchId,
          });
        }
        debug("fetchPatientsPaginated resolved", {
          searchPrefix,
          returned: pagePatients.length,
          totalCount,
        });

        return { patients: pagePatients, lastDoc: nextLastDoc, totalCount };
      } catch (err) {
        debug("fetchPatientsPaginated failed", { searchPrefix, err });
        addToast({
          title: "Error",
          description: "Failed to load patients.",
          color: "danger",
        });

        return undefined;
      }
    },
    [
      clinicId,
      currentDoctorId,
      search,
      genderFilter,
      criticalFilter,
      PER_PAGE,
      effectiveBranchId,
    ],
  );

  // ── Data load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clinicId || !isSystemOwner) return;
    branchService
      .getClinicBranches(undefined, false)
      .then((data) => {
        setBranches(data);
        const map: Record<string, string> = {};

        data.forEach((b) => {
          map[b.id] = b.name;
        });
        setBranchMap(map);
        if (!branchId && data.length > 0) {
          // Default admin view to main branch (isMainBranch comes first from service)
          setBranchFilter((prev) => prev ?? data[0].id);
        }
      })
      .catch(console.error);
  }, [clinicId, isSystemOwner, branchId]);

  // Resolve the logged-in user's doctorId once
  useEffect(() => {
    if (!clinicId || !userData?.email) return;
    (async () => {
      try {
        const doc = await doctorService.getDoctorByEmail(
          userData.email!,
        );

        if (doc) setCurrentDoctorId(doc.id);
      } catch {
        /* non-critical */
      }
    })();
  }, [clinicId, userData?.email]);

  // Client-side path: fetch ALL patients once, let `filtered` handle search/filters in render
  useEffect(() => {
    if (useServerPagination) return;
    let cancelled = false;

    if (!clinicId || !userData) return;
    debug("client-side effect: loading all patients");
    setLoading(true);
    setPage(1);

    (async () => {
      try {
        const data = currentDoctorId
          ? await patientService.getPatientsByDoctor(
            currentDoctorId,
          )
          : await patientService.getPatients();

        if (!cancelled) {
          setPatients(data);
          debug("client-side effect: loaded", { count: data.length });
        }
      } catch {
        addToast({
          title: "Error",
          description: "Failed to load patients.",
          color: "danger",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clinicId,
    userData?.email,
    useServerPagination,
    currentDoctorId,
    effectiveBranchId,
  ]);

  // Server-side paginated path: re-fetch on filter/search changes
  useEffect(() => {
    if (!useServerPagination) return;
    let cancelled = false;

    if (!clinicId || !userData) return;
    debug("server effect run", { search, genderFilter, criticalFilter });
    setLoading(true);
    setPage(1);
    setCursorByPage({});

    (async () => {
      try {
        const result = await fetchPatientsPaginated(
          1,
          undefined,
          currentDoctorId,
        );

        debug("server effect got result", {
          cancelled,
          hasResult: !!result,
          resultLen: result?.patients?.length,
        });
        if (!cancelled && result) {
          setPatients(result.patients);
          setLastDoc(result.lastDoc);
          if (result.totalCount !== undefined) setTotalCount(result.totalCount);
          setCursorByPage((prev) => ({ ...prev, [2]: result.lastDoc }));
          debug("server effect applied result", {
            count: result.patients.length,
            totalCount: result.totalCount,
          });
        }
      } catch {
        addToast({
          title: "Error",
          description: "Failed to load patients.",
          color: "danger",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clinicId,
    userData?.email,
    useServerPagination,
    genderFilter,
    criticalFilter,
    fetchPatientsPaginated,
    currentDoctorId,
  ]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getAge = (p: Patient): number => {
    if (typeof (p as any).age === "number" && (p as any).age > 0)
      return (p as any).age;
    if (typeof (p as any).age === "string") {
      const n = parseInt((p as any).age, 10);

      if (!isNaN(n) && n > 0) return n;
    }
    if ((p as any).dob) {
      const d = new Date((p as any).dob);
      const t = new Date();
      let a = t.getFullYear() - d.getFullYear();

      if (
        t.getMonth() < d.getMonth() ||
        (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())
      )
        a--;

      return a;
    }

    return 0;
  };

  const fmt = (d: Date) => {
    const dt = new Date(d);

    return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`;
  };

  // ── Filtering & sorting ─────────────────────────────────────────────────────
  const filtered = patients
    .filter((p) => {
      const q = search.toLowerCase();

      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.email?.toLowerCase().includes(q) &&
        !p.mobile.includes(q) &&
        !p.phone?.includes(q)
      )
        return false;
      if (genderFilter !== "all" && p.gender?.toLowerCase() !== genderFilter)
        return false;
      if (criticalFilter === "critical" && !p.isCritical) return false;
      if (criticalFilter === "non-critical" && p.isCritical) return false;
      const age = getAge(p);

      if (ageMin && age < parseInt(ageMin)) return false;
      if (ageMax && age > parseInt(ageMax)) return false;
      const reg = new Date(p.createdAt);

      if (regStart && reg < new Date(regStart)) return false;
      if (regEnd && reg > new Date(regEnd)) return false;

      return true;
    })
    .sort((a, b) =>
      a.isCritical === b.isCritical ? 0 : a.isCritical ? -1 : 1,
    );

  const totalPages = useServerPagination
    ? Math.ceil((totalCount ?? 0) / PER_PAGE)
    : Math.ceil(filtered.length / PER_PAGE);
  const pagePatients = useServerPagination
    ? patients
    : filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const activeFilters = [
    genderFilter !== "all",
    criticalFilter !== "all",
    !!(ageMin || ageMax),
    !!(regStart || regEnd),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setGenderFilter("all");
    setCriticalFilter("all");
    setAgeMin("");
    setAgeMax("");
    setRegStart("");
    setRegEnd("");
    setPage(1);
  };

  // ── Critical patient handlers ───────────────────────────────────────────────
  const openMarkCritical = (p: Patient) => {
    setSelectedForCritical(p);
    setCriticalReason("");
    setCriticalModal(true);
  };

  const saveCritical = async () => {
    if (!selectedForCritical || !criticalReason.trim()) {
      addToast({
        title: "Required",
        description: "Please enter a reason.",
        color: "warning",
      });

      return;
    }
    setSavingCritical(true);
    try {
      await patientService.updatePatient(selectedForCritical.id, {
        isCritical: true,
        criticalReason: criticalReason.trim(),
        criticalDate: new Date(),
      });
      if (useServerPagination) {
        const result = await fetchPatientsPaginated(
          page,
          page === 1 ? undefined : (cursorByPage[page] ?? null),
        );

        if (result) {
          setPatients(result.patients);
          setLastDoc(result.lastDoc);
          if (result.totalCount !== undefined) setTotalCount(result.totalCount);
          setCursorByPage((prev) => ({ ...prev, [page + 1]: result.lastDoc }));
        }
      } else {
        setPatients((prev) =>
          prev.map((p) =>
            p.id === selectedForCritical.id
              ? {
                ...p,
                isCritical: true,
                criticalReason: criticalReason.trim(),
              }
              : p,
          ),
        );
      }
      addToast({ title: "Marked critical", color: "success" });
      setCriticalModal(false);
    } catch {
      addToast({
        title: "Error",
        description: "Failed to update patient.",
        color: "danger",
      });
    } finally {
      setSavingCritical(false);
    }
  };

  const removeCritical = async (p: Patient) => {
    try {
      const { deleteField } = await import("firebase/firestore");

      await patientService.updatePatient(p.id, {
        isCritical: false,
        criticalReason: deleteField(),
        criticalDate: deleteField(),
      });
      if (useServerPagination) {
        const result = await fetchPatientsPaginated(
          page,
          page === 1 ? undefined : (cursorByPage[page] ?? null),
        );

        if (result) {
          setPatients(result.patients);
          setLastDoc(result.lastDoc);
          if (result.totalCount !== undefined) setTotalCount(result.totalCount);
          setCursorByPage((prev) => ({ ...prev, [page + 1]: result.lastDoc }));
        }
      } else {
        setPatients((prev) =>
          prev.map((pt) => {
            if (pt.id !== p.id) return pt;
            const updated = { ...pt, isCritical: false };

            delete (updated as any).criticalReason;
            delete (updated as any).criticalDate;

            return updated;
          }),
        );
      }
      addToast({ title: "Critical status removed", color: "success" });
    } catch {
      addToast({
        title: "Error",
        description: "Failed to remove critical status.",
        color: "danger",
      });
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportXLSX = () => {
    try {
      const data = filtered.map((p) => ({
        "Patient Name": p.name,
        "Reg#": p.regNumber || "",
        Email: p.email || "",
        Mobile: p.mobile,
        Gender: p.gender,
        Age: getAge(p),
        Status: p.isCritical ? "Critical" : "Normal",
        "Critical Reason": p.criticalReason || "",
        "Reg Date": fmt(p.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Patients");
      XLSX.writeFile(
        wb,
        `patients_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      addToast({ title: "Exported", color: "success" });
    } catch {
      addToast({ title: "Export failed", color: "danger" });
    }
  };

  const exportCSV = () => {
    try {
      const data = filtered.map((p) => ({
        "Patient Name": p.name,
        "Reg#": p.regNumber || "",
        Email: p.email || "",
        Mobile: p.mobile,
        Gender: p.gender,
        Age: getAge(p),
        Status: p.isCritical ? "Critical" : "Normal",
        "Reg Date": fmt(p.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Patients");
      XLSX.writeFile(
        wb,
        `patients_${new Date().toISOString().split("T")[0]}.csv`,
        { bookType: "csv" },
      );
      addToast({ title: "Exported as CSV", color: "success" });
    } catch {
      addToast({ title: "Export failed", color: "danger" });
    }
  };

  const printList = () => {
    const w = window.open("", "_blank");

    if (!w) {
      addToast({ title: "Allow pop-ups to print", color: "warning" });

      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Patients</title>
      <style>body{font-family:Arial,sans-serif;margin:20px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:12px}
      th{background:#f5f5f5;font-weight:600}.crit{background:#fff0f0;color:#b91c1c}</style>
      </head><body><h2>Patients — ${new Date().toLocaleDateString()}</h2>
      <p>Total: ${filtered.length} | Critical: ${filtered.filter((p) => p.isCritical).length}</p>
      <table><thead><tr><th>Name</th><th>Reg#</th><th>Mobile</th><th>Gender</th><th>Age</th><th>Status</th><th>Reg Date</th></tr></thead>
      <tbody>${filtered
        .map(
          (p) => `<tr class="${p.isCritical ? "crit" : ""}">
        <td>${p.name}</td><td>${p.regNumber || ""}</td><td>${p.mobile}</td>
        <td>${p.gender}</td><td>${getAge(p)}</td>
        <td>${p.isCritical ? "Critical" : "Normal"}</td><td>${fmt(p.createdAt)}</td></tr>`,
        )
        .join("")}
      </tbody></table></body></html>`);
    w.document.close();
    w.print();
    w.close();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Critical blink animation */}
      <style>{`
        @keyframes crit-blink { 0%,49%{background:rgba(239,68,68,.07)} 50%,100%{background:transparent} }
        .crit-row { animation: crit-blink 2.5s infinite; border-left: 3px solid #ef4444; }
        .crit-avatar { box-shadow: 0 0 0 2px #ef4444; animation: crit-pulse 2s infinite; }
        @keyframes crit-pulse { 0%{box-shadow:0 0 0 0 rgba(239,68,68,.7)} 70%{box-shadow:0 0 0 4px transparent} 100%{box-shadow:0 0 0 0 transparent} }
      `}</style>

      <div className="flex flex-col gap-4">
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-page-title text-text-main leading-tight flex items-center gap-2">
              Patients
              {currentDoctorId && <Badge variant="primary">Doctor View</Badge>}
            </h1>
            <p className="text-[13px] text-text-muted mt-0.5">
              {currentDoctorId
                ? "Your assigned patient records"
                : branchId
                  ? "Patients for your branch"
                  : isSystemOwner && branchFilter
                    ? "Clinic patients for selected branch"
                    : "All registered clinic patients"}
            </p>
          </div>

          <Link className="no-underline" to="/dashboard/patients/new">
            <Button
              color="primary"
              size="sm"
              startContent={<IoPersonAddOutline className="w-3.5 h-3.5" />}
            >
              Add Patient
            </Button>
          </Link>
        </div>

        {/* ── Table card ───────────────────────────────────────────────────── */}
        <div className="bg-surface border border-border-base rounded overflow-hidden">
          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border-base">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <IoSearchOutline className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted/50 pointer-events-none" />
              <input
                className="w-full h-8 pl-8 pr-3 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                placeholder="Search by name, email, phone…"
                type="text"
                value={search}
                onChange={(e) => {
                  const v = e.target.value;

                  debug("search input change", { value: v });
                  setSearch(v);
                  setPage(1);
                }}
              />
            </div>

            {/* Gender filter */}
            <NativeSelect
              value={genderFilter}
              onChange={(v) => {
                setGenderFilter(v);
                setPage(1);
              }}
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </NativeSelect>

            {/* Status filter */}
            <NativeSelect
              value={criticalFilter}
              onChange={(v) => {
                setCriticalFilter(v);
                setPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="critical">Critical</option>
              <option value="non-critical">Non-Critical</option>
            </NativeSelect>

            {/* Branch filter for clinic-wide admins (branch staff are locked to their own branch) */}
            {isSystemOwner && !branchId && branches.length > 0 && (
              <NativeSelect
                value={branchFilter ?? ""}
                onChange={(v) => {
                  setBranchFilter(v || null);
                  setPage(1);
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.isMainBranch ? " (all branches)" : ""}
                  </option>
                ))}
              </NativeSelect>
            )}

            {/* Advanced filters */}
            <Button
              color={activeFilters > 0 ? "primary" : "default"}
              size="sm"
              startContent={<IoFilterOutline className="w-3.5 h-3.5" />}
              variant={activeFilters > 0 ? "solid" : "bordered"}
              onClick={() => setFiltersModal(true)}
            >
              Filters
              {activeFilters > 0 && (
                <span className="ml-1 bg-white/30 text-white text-[10px] font-bold px-1 rounded">
                  {activeFilters}
                </span>
              )}
            </Button>

            {/* Export dropdown */}
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  color="default"
                  size="sm"
                  startContent={<IoDownloadOutline className="w-3.5 h-3.5" />}
                  variant="bordered"
                >
                  Export
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Export options">
                <DropdownItem key="xlsx" onClick={exportXLSX}>
                  Export as Excel (.xlsx)
                </DropdownItem>
                <DropdownItem key="csv" onClick={exportCSV}>
                  Export as CSV
                </DropdownItem>
                <DropdownItem
                  key="print"
                  startContent={<IoPrintOutline className="w-3.5 h-3.5" />}
                  onClick={printList}
                >
                  Print
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          {/* ── Active filter chips ──────────────────────────────────────── */}
          {(search ||
            genderFilter !== "all" ||
            criticalFilter !== "all" ||
            ageMin ||
            ageMax ||
            regStart ||
            regEnd) && (
              <div className="flex flex-wrap gap-1.5 px-3 py-1.5 border-b border-border-base bg-surface-2">
                {search && (
                  <FilterChip
                    label={`Search: "${search}"`}
                    onRemove={() => setSearch("")}
                  />
                )}
                {genderFilter !== "all" && (
                  <FilterChip
                    label={`Gender: ${genderFilter}`}
                    onRemove={() => setGenderFilter("all")}
                  />
                )}
                {criticalFilter !== "all" && (
                  <FilterChip
                    label={`Status: ${criticalFilter}`}
                    onRemove={() => setCriticalFilter("all")}
                  />
                )}
                {(ageMin || ageMax) && (
                  <FilterChip
                    label={`Age: ${ageMin || "0"}–${ageMax || "∞"}`}
                    onRemove={() => {
                      setAgeMin("");
                      setAgeMax("");
                    }}
                  />
                )}
                {(regStart || regEnd) && (
                  <FilterChip
                    label={`Reg: ${regStart || "…"} – ${regEnd || "…"}`}
                    onRemove={() => {
                      setRegStart("");
                      setRegEnd("");
                    }}
                  />
                )}
                <button
                  className="text-[11px] text-text-muted hover:text-red-500 ml-1"
                  type="button"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              </div>
            )}

          {/* ── Table ───────────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label="Loading patients…" size="md" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-surface-2 border-b border-border-base">
                    {["Patient", "Contact", "Status", "Reg Date", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className={`py-2 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted ${h === "" ? "text-right" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base">
                  {pagePatients.length === 0 ? (
                    <tr>
                      <td className="py-16 text-center" colSpan={5}>
                        <IoPersonOutline className="w-8 h-8 mx-auto mb-2 text-text-muted/30" />
                        <p className="text-[13px] text-text-muted">
                          No patients found
                        </p>
                        {filtered.length === 0 && patients.length > 0 && (
                          <button
                            className="mt-1 text-[12px] text-primary hover:underline"
                            type="button"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    pagePatients.map((patient) => (
                      <tr
                        key={patient.id}
                        className={`hover:bg-surface-2 transition-colors ${patient.isCritical ? "crit-row" : ""}`}
                      >
                        {/* Patient column */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              className={
                                patient.isCritical ? "crit-avatar" : ""
                              }
                              color={
                                patient.gender === "male"
                                  ? "primary"
                                  : "default"
                              }
                              name={patient.name}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isSystemOwner && patient.branchId && (
                                  <Badge variant="primary">
                                    {branchMap[patient.branchId] || "Branch"}
                                  </Badge>
                                )}
                                <Link
                                  className="text-[12.5px] font-medium text-text-main hover:text-primary no-underline"
                                  to={`/dashboard/patients/${patient.id}`}
                                >
                                  {patient.name}
                                </Link>
                                {patient.isCritical && (
                                  <Badge variant="critical">⚠ CRITICAL</Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-text-muted">
                                Reg# {patient.regNumber}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact column */}
                        <td className="py-2.5 px-3">
                          <p className="text-[12px] text-text-main">
                            {patient.mobile}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            {patient.email || "—"}
                          </p>
                        </td>

                        {/* Status column */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {patient.isCritical ? (
                            <div>
                              <Badge variant="critical">Critical</Badge>
                              {patient.criticalReason && (
                                <p
                                  className="text-[10px] text-text-muted mt-0.5 max-w-[120px] truncate"
                                  title={patient.criticalReason}
                                >
                                  {patient.criticalReason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="normal">Normal</Badge>
                          )}
                        </td>

                        {/* Reg date column */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-[12px] text-text-muted">
                          {fmt(patient.createdAt)}
                        </td>

                        {/* Actions column */}
                        <td className="py-2.5 px-3 text-right">
                          <Dropdown placement="bottom-end">
                            <DropdownTrigger>
                              <button
                                aria-label="Actions"
                                className="p-1.5 rounded hover:bg-surface-2 text-text-muted transition-colors"
                              >
                                <IoEllipsisVerticalOutline className="w-4 h-4" />
                              </button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Patient actions">
                              <DropdownItem key="view">
                                <Link
                                  className="no-underline text-text-main block w-full"
                                  to={`/dashboard/patients/${patient.id}`}
                                >
                                  View Details
                                </Link>
                              </DropdownItem>
                              <DropdownItem key="edit">
                                <Link
                                  className="no-underline text-text-main block w-full"
                                  to={`/dashboard/patients/${patient.id}/edit`}
                                >
                                  Edit
                                </Link>
                              </DropdownItem>
                              <DropdownItem key="appointment">
                                <Link
                                  className="no-underline text-text-main block w-full"
                                  to={`/dashboard/appointments/new?patientId=${patient.id}`}
                                >
                                  New Appointment
                                </Link>
                              </DropdownItem>
                                {patient.isCritical ? (
                                  <DropdownItem
                                    key="remove-critical"
                                    className="text-success"
                                    onClick={() => removeCritical(patient)}
                                  >
                                    ✓ Remove Critical Status
                                  </DropdownItem>
                                ) : (
                                  <DropdownItem
                                    key="mark-critical"
                                    className="text-error"
                                    onClick={() => openMarkCritical(patient)}
                                  >
                                    ⚠ Mark as Critical
                                  </DropdownItem>
                                )}
                            </DropdownMenu>
                          </Dropdown>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Footer: count + pagination ───────────────────────────────── */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 border-t border-border-base bg-surface-2">
              <p className="text-[11px] text-text-muted">
                Showing <strong>{(page - 1) * PER_PAGE + 1}</strong>–
                <strong>
                  {Math.min(
                    page * PER_PAGE,
                    useServerPagination ? (totalCount ?? 0) : filtered.length,
                  )}
                </strong>{" "}
                of{" "}
                <strong>
                  {useServerPagination ? (totalCount ?? 0) : filtered.length}
                </strong>{" "}
                patients
                {!useServerPagination &&
                  filtered.length !== patients.length &&
                  ` (${patients.length} total)`}
              </p>
              <Pagination
                page={page}
                total={totalPages}
                onChange={async (p) => {
                  setPage(p);
                  if (useServerPagination) {
                    setLoading(true);
                    try {
                      const result = await fetchPatientsPaginated(
                        p,
                        p === 1 ? undefined : (cursorByPage[p] ?? null),
                      );

                      if (result) {
                        setPatients(result.patients);
                        setLastDoc(result.lastDoc);
                        setCursorByPage((prev) => ({
                          ...prev,
                          [p + 1]: result.lastDoc,
                        }));
                      }
                    } finally {
                      setLoading(false);
                    }
                  }
                  window.scrollTo(0, 0);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Mark Critical Modal ───────────────────────────────────────────── */}
      <Modal
        footer={
          <>
            <Button
              color="default"
              size="sm"
              variant="bordered"
              onClick={() => setCriticalModal(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              disabled={!criticalReason.trim()}
              isLoading={savingCritical}
              size="sm"
              onClick={saveCritical}
            >
              Mark as Critical
            </Button>
          </>
        }
        open={criticalModal}
        subtitle={selectedForCritical?.name}
        title="Mark Patient as Critical"
        onClose={() => setCriticalModal(false)}
      >
        <div className="space-y-3">
          <div className="flex gap-2.5 p-3 bg-error/10 border border-error/20 rounded">
            <IoAlertCircleOutline className="w-4 h-4 text-error shrink-0 mt-0.5" />
            <p className="text-[12px] text-error/90">
              This patient will be highlighted in the patient list and flagged
              for priority attention. The reason will be visible to all staff.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-main mb-1">
              Reason <span className="text-error">*</span>
            </label>
            <textarea
              className="w-full px-2.5 py-2 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none placeholder:text-text-muted/60"
              placeholder="Enter the reason for marking as critical…"
              rows={3}
              value={criticalReason}
              onChange={(e) => setCriticalReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Advanced Filters Modal ────────────────────────────────────────── */}
      <Modal
        footer={
          <>
            <Button
              color="default"
              size="sm"
              variant="bordered"
              onClick={clearFilters}
            >
              Clear All
            </Button>
            <Button
              color="primary"
              size="sm"
              onClick={() => setFiltersModal(false)}
            >
              Apply
            </Button>
          </>
        }
        open={filtersModal}
        subtitle="Refine patient search with additional criteria"
        title="Advanced Filters"
        onClose={() => setFiltersModal(false)}
      >
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-surface-2 border border-border-base rounded">
            {[
              {
                label: "Total",
                value: patients.length,
                cls: "text-text-main",
              },
              {
                label: "Filtered",
                value: filtered.length,
                cls: "text-primary",
              },
              {
                label: "Critical",
                value: patients.filter((p) => p.isCritical).length,
                cls: "text-error",
              },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-stat-sm leading-none ${s.cls}`}>
                  {s.value}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Age range */}
          <div>
            <label className="block text-[12px] font-medium text-text-main mb-1.5">
              Age Range
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 h-8 px-2.5 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary"
                placeholder="Min"
                type="number"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
              />
              <span className="text-text-muted self-center text-[12px]">
                –
              </span>
              <input
                className="flex-1 h-8 px-2.5 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary"
                placeholder="Max"
                type="number"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
              />
            </div>
          </div>

          {/* Registration date range */}
          <div>
            <label className="block text-[12px] font-medium text-text-main mb-1.5">
              Registration Date
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 h-8 px-2.5 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary"
                type="date"
                value={regStart}
                onChange={(e) => setRegStart(e.target.value)}
              />
              <span className="text-text-muted self-center text-[12px]">
                –
              </span>
              <input
                className="flex-1 h-8 px-2.5 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary"
                type="date"
                value={regEnd}
                onChange={(e) => setRegEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
