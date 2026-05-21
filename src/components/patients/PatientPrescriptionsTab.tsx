/**
 * PatientPrescriptionsTab — Clinic Clarity, zero HeroUI
 * Replaces: Card, Button, Input, Table, Chip, Pagination, Dropdown,
 *           Modal, Select, Autocomplete, Textarea, Spinner, Link, Divider.
 * All business logic preserved.
 */
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IoEyeOutline,
  IoCreateOutline,
  IoDownloadOutline,
  IoEllipsisVerticalOutline,
  IoTrashOutline,
  IoSearchOutline,
  IoReceiptOutline,
  IoAddOutline,
  IoSaveOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown";
import { prescriptionService } from "@/services/prescriptionService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { medicineService } from "@/services/medicineService";
import { appointmentService } from "@/services/appointmentService";
import { Prescription } from "@/types/medical-records";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExtendedPrescription extends Prescription {
  patientName: string;
  doctorName: string;
  itemsCount: number;
}

interface PatientPrescriptionsTabProps {
  patientId: string;
}

interface PrescriptionItem {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  duration: string;
  time: string;
  interval: string;
}

interface PrescriptionFormData {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentId: string;
  items: PrescriptionItem[];
  diagnosis: string;
  notes: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  active:
    "bg-health-500/10 text-health-600 dark:text-health-400 border-health-500/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    STATUS_STYLE[status] ||
    "bg-mountain-100 text-text-muted border-border-base";

  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${cls}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Inline flat input ─────────────────────────────────────────────────────────
function FlatInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-text-muted">{label}</label>
      <input
        className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main
          placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10
          disabled:bg-surface-2 disabled:text-text-muted/60"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── Simple searchable autocomplete ───────────────────────────────────────────
function SearchSelect({
  label,
  items,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  items: { id: string; primary: string; secondary?: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = q
    ? items.filter((i) => i.primary.toLowerCase().includes(q.toLowerCase()))
    : items;
  const selected = items.find((i) => i.id === value);

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-[12px] font-medium text-text-muted">{label}</label>
      <div
        className={`flex items-center h-9 border border-border-base rounded bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10 ${disabled ? "bg-surface-2" : "cursor-text"}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <IoSearchOutline className="ml-2.5 w-3.5 h-3.5 text-text-muted/50 shrink-0" />
        <input
          className="flex-1 text-[12.5px] px-2 bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/40"
          disabled={disabled}
          placeholder={`Search ${label.toLowerCase()}…`}
          value={selected && !open ? selected.primary : q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && !disabled && (
          <button
            className="mr-2 text-text-muted/60 hover:text-text-muted"
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
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-border-base rounded max-h-44 overflow-y-auto shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-text-muted/60">
                No results
              </p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  className={`w-full text-left px-3 py-2 hover:bg-teal-50 ${i.id === value ? "bg-teal-50" : ""}`}
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
      {hint && <p className="text-[10.5px] text-text-muted/60">{hint}</p>}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className={`rounded border p-3 text-center ${color}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11.5px] mt-0.5">{label}</p>
    </div>
  );
}

// ── Action dropdown ───────────────────────────────────────────────────────────
function ActionsMenu({
  onView,
  onEdit,
  onPrint,
}: {
  onView: () => void;
  onEdit: () => void;
  onPrint: () => void;
}) {
  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button
          className="p-1.5 rounded border border-border-base text-text-muted hover:text-text-main hover:border-primary transition-colors"
          type="button"
        >
          <IoEllipsisVerticalOutline className="w-3.5 h-3.5" />
        </button>
      </DropdownTrigger>
      <DropdownMenu>
        <DropdownItem
          key="view"
          startContent={<IoEyeOutline className="text-text-muted/60" />}
          onClick={onView}
        >
          View Details
        </DropdownItem>
        <DropdownItem
          key="edit"
          startContent={<IoCreateOutline className="text-text-muted/60" />}
          onClick={onEdit}
        >
          Edit
        </DropdownItem>
        <DropdownItem
          key="print"
          startContent={<IoDownloadOutline className="text-text-muted/60" />}
          onClick={onPrint}
        >
          Download PDF
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
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

  return (
    <div className="flex items-center justify-center gap-1 py-3 border-t border-border-base/50">
      <button
        className="px-2.5 py-1 text-[12px] border border-border-base rounded disabled:opacity-40 hover:border-teal-400 hover:text-primary/80 transition-colors"
        disabled={page === 1}
        type="button"
        onClick={() => onChange(page - 1)}
      >
        ‹
      </button>
      {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          className={`w-7 h-7 text-[12px] rounded border transition-colors
            ${p === page ? "bg-teal-700 text-white border-teal-700" : "border-border-base text-text-muted hover:border-teal-400 hover:text-primary/80"}`}
          type="button"
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        className="px-2.5 py-1 text-[12px] border border-border-base rounded disabled:opacity-40 hover:border-teal-400 hover:text-primary/80 transition-colors"
        disabled={page === total}
        type="button"
        onClick={() => onChange(page + 1)}
      >
        ›
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════
export default function PatientPrescriptionsTab({
  patientId,
}: PatientPrescriptionsTabProps) {
  const navigate = useNavigate();
  const { clinicId, branchId, userData } = useAuthContext();
  const newPrescriptionModal = useModalState(false);

  // Data
  const [prescriptions, setPrescriptions] = useState<ExtendedPrescription[]>(
    [],
  );
  const [patient, setPatient] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDoctor, setSelectedDoctor] = useState("all");

  // Form
  const [formData, setFormData] = useState<PrescriptionFormData>({
    patientId: "",
    patientName: "",
    doctorId: "",
    doctorName: "",
    appointmentId: "",
    items: [],
    diagnosis: "",
    notes: "",
  });
  const [medicineId, setMedicineId] = useState("");
  const [dosage, setDosage] = useState("");
  const [duration, setDuration] = useState("");
  const [time, setTime] = useState("");
  const [intervalValue, setIntervalValue] = useState("");

  // Presets
  const frequencyPresets = ["OD", "BD", "TDS", "QID", "SOS"];
  const timePresets = [
    "Before Meal",
    "After Meal",
    "Empty Stomach",
    "At Bedtime",
  ];

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadData = async () => {
    if (!clinicId || !patientId) return;
    setLoading(true);
    setError(null);
    try {
      const [allRx, patientData, doctorsData, medsData, allApts] =
        await Promise.all([
          prescriptionService.getPrescriptionsByClinic(clinicId),
          patientService.getPatientById(patientId),
          doctorService.getDoctorsByClinic(clinicId),
          medicineService.getMedicinesByClinic(clinicId),
          appointmentService.getAppointmentsByClinic(clinicId),
        ]);

      const mine = allRx.filter(
        (rx: Prescription) => rx.patientId === patientId,
      );
      const extended = await Promise.all(
        mine.map(async (rx) => {
          const [pt, doc] = await Promise.all([
            patientService.getPatientById(rx.patientId),
            doctorService.getDoctorById(rx.doctorId),
          ]);
          let itemsCount = 0;

          try {
            itemsCount = (await prescriptionService.getPrescriptionItems(rx.id))
              .length;
          } catch {}

          return {
            ...rx,
            patientName: pt?.name || "Unknown",
            doctorName: doc ? `Dr. ${doc.name}` : "Unknown",
            itemsCount,
          } as ExtendedPrescription;
        }),
      );

      setPrescriptions(extended);
      setPatient(patientData);
      setDoctors(doctorsData);
      setMedicines(medsData);
      setAppointments(
        allApts.filter(
          (a: any) =>
            a.patientId === patientId &&
            ["completed", "in-progress"].includes(a.status),
        ),
      );
      setFormData((p) => ({
        ...p,
        patientId: patientData?.id || "",
        patientName: patientData?.name || "",
      }));
    } catch {
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

  useEffect(() => {
    loadData();
  }, [clinicId, patientId]);

  // Auto-populate doctor from appointment
  useEffect(() => {
    if (!formData.appointmentId) return;
    const apt = appointments.find((a) => a.id === formData.appointmentId);

    if (apt) {
      const doc = doctors.find((d) => d.id === apt.doctorId);

      setFormData((p) => ({
        ...p,
        doctorId: apt.doctorId,
        doctorName: doc?.name || "",
      }));
    }
  }, [formData.appointmentId, appointments, doctors]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmtDate = (d: Date) => {
    const dt = new Date(d);

    return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`;
  };

  const getAptDateStr = (apt: any): string => {
    try {
      const d = apt.appointmentDate?.seconds
        ? new Date(apt.appointmentDate.seconds * 1000)
        : apt.appointmentDate?.toDate?.()
          ? apt.appointmentDate.toDate()
          : new Date(apt.appointmentDate);

      if (!isNaN(d.getTime()))
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    } catch {}

    return "Unknown Date";
  };

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filtered = prescriptions.filter((rx) => {
    const q = searchTerm.toLowerCase();
    const matchQ =
      rx.patientName.toLowerCase().includes(q) ||
      rx.doctorName.toLowerCase().includes(q) ||
      rx.prescriptionNo.toLowerCase().includes(q);
    const matchSt = selectedStatus === "all" || rx.status === selectedStatus;
    const matchDoc = selectedDoctor === "all" || rx.doctorId === selectedDoctor;

    return matchQ && matchSt && matchDoc;
  });

  const uniqueDoctors = Array.from(
    new Map(
      prescriptions.map((p) => [
        p.doctorId,
        { id: p.doctorId, name: p.doctorName },
      ]),
    ).values(),
  );
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const hasFilters = () => selectedStatus !== "all" || selectedDoctor !== "all";
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("all");
    setSelectedDoctor("all");
    setCurrentPage(1);
  };

  const stats = {
    total: prescriptions.length,
    active: prescriptions.filter((p) => p.status === "active").length,
    completed: prescriptions.filter((p) => p.status === "completed").length,
    medicines: prescriptions.reduce((s, p) => s + p.itemsCount, 0),
  };

  // ── Form ─────────────────────────────────────────────────────────────────────
  const addMedicine = () => {
    if (!medicineId) {
      addToast({ title: "Select a medicine", color: "warning" });

      return;
    }
    if (formData.items.find((i) => i.medicineId === medicineId)) {
      addToast({ title: "Already added", color: "warning" });

      return;
    }
    const med = medicines.find((m) => m.id === medicineId);

    setFormData((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: crypto.randomUUID(),
          medicineId,
          medicineName: med?.name || "",
          dosage,
          duration,
          time,
          interval: intervalValue,
        },
      ],
    }));
    setMedicineId("");
    setDosage("");
    setDuration("");
    setTime("");
    setIntervalValue("");
    addToast({ title: "Medicine added", color: "success" });
  };

  const removeMedicine = (id: string) =>
    setFormData((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));

  const handleSubmit = async () => {
    if (!formData.doctorId) {
      addToast({ title: "Select a doctor", color: "warning" });

      return;
    }
    if (!formData.items.length) {
      addToast({ title: "Add at least one medicine", color: "warning" });

      return;
    }
    setSaving(true);
    try {
      await prescriptionService.createPrescription({
        patientId: formData.patientId,
        clinicId: clinicId!,
        branchId: branchId || "main-branch",
        appointmentId: formData.appointmentId || undefined,
        doctorId: formData.doctorId,
        items: formData.items.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          dosage: item.dosage,
          frequency: item.interval,
          duration: item.duration,
          time: item.time,
          instructions:
            formData.notes ||
            `Take ${item.dosage} ${item.interval} ${item.time} for ${item.duration}`,
          quantity: 1,
          sendToPharmacy: true,
        })),
        diagnosis: formData.diagnosis,
        notes: formData.notes,
        prescribedBy: userData?.id || "unknown",
        sendToPharmacy: true,
      });
      addToast({ title: "Prescription created", color: "success" });
      setFormData({
        patientId: patient?.id || "",
        patientName: patient?.name || "",
        doctorId: "",
        doctorName: "",
        appointmentId: "",
        items: [],
        diagnosis: "",
        notes: "",
      });
      setShowModal(false);
      await loadData();
    } catch {
      addToast({ title: "Failed to save prescription", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading prescriptions…" size="lg" />
      </div>
    );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-section-title text-text-main">
            Prescriptions & Medications
          </h2>
          <p className="text-[12.5px] text-text-muted">
            Manage patient prescriptions and medication history
          </p>
        </div>
        <Button
          color="primary"
          size="sm"
          startContent={<IoAddOutline className="w-3.5 h-3.5" />}
          onClick={() => setShowModal(true)}
        >
          New Prescription
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          color="bg-primary/10 text-primary border-primary/20"
          label="Total"
          value={stats.total}
        />
        <StatCard
          color="bg-health-500/10 text-health-600 dark:text-health-400 border-health-500/20"
          label="Active"
          value={stats.active}
        />
        <StatCard
          color="bg-surface-2 text-text-muted border-border-base"
          label="Completed"
          value={stats.completed}
        />
        <StatCard
          color="bg-saffron-500/10 text-saffron-600 dark:text-saffron-400 border-saffron-500/20"
          label="Medicines"
          value={stats.medicines}
        />
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border-base rounded p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-text-main">
            Search & Filter
          </span>
          {hasFilters() && (
            <button
              className="text-[11.5px] text-red-500 hover:text-red-700 flex items-center gap-1"
              type="button"
              onClick={clearFilters}
            >
              <IoTrashOutline className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-[2] min-w-[180px]">
            <IoSearchOutline className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted/40" />
            <input
              className="w-full h-9 pl-8 pr-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary"
              placeholder="Search prescriptions…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <select
            className="h-9 px-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="h-9 px-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary"
            value={selectedDoctor}
            onChange={(e) => {
              setSelectedDoctor(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Doctors</option>
            {uniqueDoctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {/* Active filter chips */}
        {hasFilters() && (
          <div className="flex flex-wrap gap-1.5">
            {selectedStatus !== "all" && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-teal-100 text-primary/80 border border-teal-200 px-2 py-0.5 rounded">
                Status: {selectedStatus}
                <button type="button" onClick={() => setSelectedStatus("all")}>
                  <IoCloseOutline className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedDoctor !== "all" && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-mountain-100 text-text-muted border border-border-base px-2 py-0.5 rounded">
                Dr: {uniqueDoctors.find((d) => d.id === selectedDoctor)?.name}
                <button type="button" onClick={() => setSelectedDoctor("all")}>
                  <IoCloseOutline className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border-base rounded overflow-visible">
        <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border-b border-border-base/50 rounded-t">
          <IoReceiptOutline className="w-4 h-4 text-primary" />
          <div>
            <h4 className="text-[13px] font-semibold text-text-main">
              Prescription History
            </h4>
            <p className="text-[11px] text-text-muted">
              Showing {paginated.length} of {filtered.length}
            </p>
          </div>
        </div>

        {error ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-red-600 mb-3">{error}</p>
            <Button color="primary" size="sm" onClick={loadData}>
              Try Again
            </Button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-12 text-center">
            <IoReceiptOutline className="mx-auto w-10 h-10 text-text-muted/30 mb-2" />
            <p className="text-[13px] font-medium text-text-main mb-1">
              {searchTerm || hasFilters()
                ? "No prescriptions found"
                : "No prescriptions yet"}
            </p>
            <p className="text-[12px] text-text-muted mb-4">
              {searchTerm || hasFilters()
                ? "Try adjusting your search or filters"
                : "Create the first prescription"}
            </p>
            {!searchTerm && !hasFilters() && (
              <Button
                color="primary"
                size="sm"
                startContent={<IoAddOutline className="w-3.5 h-3.5" />}
                onClick={() => setShowModal(true)}
              >
                Create First Prescription
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-visible">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border-base/50">
                    {[
                      "Prescription No.",
                      "Doctor",
                      "Date",
                      "Diagnosis",
                      "Medicines",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="py-2 px-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-muted/60 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-mountain-100">
                  {paginated.map((rx) => (
                    <tr
                      key={rx.id}
                      className="hover:bg-surface-2 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <Link
                          className="text-[12.5px] font-medium text-primary/80 hover:text-teal-900 hover:underline underline-offset-2"
                          to={`/dashboard/prescriptions/${rx.id}`}
                        >
                          {rx.prescriptionNo}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-[12.5px] text-text-muted">
                        {rx.doctorName}
                      </td>
                      <td className="py-2.5 px-3 text-[12px] text-text-muted">
                        {fmtDate(rx.prescriptionDate)}
                      </td>
                      <td className="py-2.5 px-3">
                        <p
                          className="text-[12.5px] text-text-muted truncate max-w-[150px]"
                          title={rx.diagnosis}
                        >
                          {rx.diagnosis || "—"}
                        </p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[12.5px] font-medium text-text-muted">
                          {rx.itemsCount}
                        </span>
                        <span className="text-[11.5px] text-text-muted/60 ml-1">
                          medicine{rx.itemsCount !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={rx.status} />
                      </td>
                      <td className="py-2.5 px-3">
                        <ActionsMenu
                          onEdit={() =>
                            navigate(`/dashboard/prescriptions/${rx.id}/edit`)
                          }
                          onPrint={() =>
                            navigate(
                              `/dashboard/prescriptions/${rx.id}?print=true`,
                            )
                          }
                          onView={() =>
                            navigate(`/dashboard/prescriptions/${rx.id}`)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={currentPage}
              total={totalPages}
              onChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* ── New Prescription Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/30 px-4 pb-8 overflow-y-auto">
          <div className="bg-surface dark:bg-surface-2 border border-border-base rounded w-full max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-base/50">
              <div>
                <h3 className="text-[14px] font-semibold text-text-main">
                  New Prescription
                </h3>
                <p className="text-[11.5px] text-text-muted/60">
                  For {patient?.name} ({patient?.regNumber})
                </p>
              </div>
              {!saving && (
                <button
                  className="p-1 rounded text-text-muted/60 hover:text-text-muted"
                  type="button"
                  onClick={() => setShowModal(false)}
                >
                  <IoCloseOutline className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Appointment + Doctor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SearchSelect
                  items={appointments.map((a) => {
                    const doc = doctors.find((d) => d.id === a.doctorId);

                    return {
                      id: a.id,
                      primary: `${doc?.name || "Dr."} — ${getAptDateStr(a)}`,
                    };
                  })}
                  label="Related Appointment (optional)"
                  value={formData.appointmentId}
                  onChange={(id) =>
                    setFormData((p) => ({ ...p, appointmentId: id }))
                  }
                />
                <SearchSelect
                  disabled={!!formData.appointmentId}
                  hint={
                    formData.appointmentId
                      ? "Auto-selected from appointment"
                      : ""
                  }
                  items={doctors.map((d) => ({
                    id: d.id,
                    primary: d.name,
                    secondary: d.speciality,
                  }))}
                  label="Doctor *"
                  value={formData.doctorId}
                  onChange={(id) => {
                    const d = doctors.find((x) => x.id === id);

                    setFormData((p) => ({
                      ...p,
                      doctorId: id,
                      doctorName: d?.name || "",
                    }));
                  }}
                />
              </div>

              {/* Diagnosis Section */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-text-muted">
                  Diagnosis / Complaints *
                </label>
                <textarea
                  className="w-full px-2.5 py-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main
                    placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 resize-none h-16"
                  placeholder="Enter patient diagnosis, complaints, or findings…"
                  value={formData.diagnosis}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, diagnosis: e.target.value }))
                  }
                />
              </div>

              <div className="border-t border-border-base/50" />

              {/* Medicine row */}
              <div>
                <h4 className="text-[13px] font-semibold text-text-main mb-2">
                  Add Medicines
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <SearchSelect
                    items={medicines.map((m) => ({
                      id: m.id,
                      primary: m.name,
                      secondary: m.genericName
                        ? `${m.genericName} (${m.manufacturer || "Unknown"})`
                        : m.manufacturer,
                    }))}
                    label="Medicine"
                    value={medicineId}
                    onChange={(id) => setMedicineId(id)}
                  />
                  <FlatInput
                    label="Dosage"
                    placeholder="e.g. 500mg"
                    value={dosage}
                    onChange={setDosage}
                  />
                  <FlatInput
                    label="Duration"
                    placeholder="e.g. 7 days"
                    value={duration}
                    onChange={setDuration}
                  />
                  <div className="flex flex-col gap-1.5">
                    <FlatInput
                      label="Time"
                      placeholder="e.g. After Meal"
                      value={time}
                      onChange={setTime}
                    />
                    <div className="flex flex-wrap gap-1">
                      {timePresets.map((p) => (
                        <button
                          key={p}
                          className={`px-2 py-0.5 text-[10px] font-semibold border rounded transition-colors ${time === p ? "bg-primary text-white border-primary" : "bg-surface-2 text-text-muted border-border-base hover:border-primary hover:text-primary"}`}
                          type="button"
                          onClick={() => setTime(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FlatInput
                      label="Frequency"
                      placeholder="e.g. 1-0-1"
                      value={intervalValue}
                      onChange={setIntervalValue}
                    />
                    <div className="flex flex-wrap gap-1">
                      {frequencyPresets.map((p) => (
                        <button
                          key={p}
                          className={`px-2 py-0.5 text-[10px] font-semibold border rounded transition-colors ${intervalValue === p ? "bg-primary text-white border-primary" : "bg-surface-2 text-text-muted border-border-base hover:border-primary hover:text-primary"}`}
                          type="button"
                          onClick={() => setIntervalValue(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      color="primary"
                      size="sm"
                      startContent={<IoAddOutline className="w-3.5 h-3.5" />}
                      type="button"
                      onClick={addMedicine}
                    >
                      Add Medicine
                    </Button>
                  </div>
                </div>
              </div>

              {/* Summary */}
              {formData.items.length > 0 && (
                <>
                  <div className="border-t border-border-base/50" />
                  <div>
                    <h4 className="text-[13px] font-semibold text-text-main mb-2">
                      Prescription Summary ({formData.items.length} medicine
                      {formData.items.length !== 1 ? "s" : ""})
                    </h4>
                    <div className="space-y-2">
                      {formData.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 border border-border-base rounded px-3 py-2"
                        >
                          <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {[
                              ["Medicine", item.medicineName],
                              ["Dosage", item.dosage],
                              ["Duration", item.duration],
                              ["Time", item.time],
                              ["Frequency", item.interval],
                            ].map(([l, v]) => (
                              <div key={l}>
                                <p className="text-[10px] text-text-muted/60 uppercase tracking-wider">
                                  {l}
                                </p>
                                <p className="text-[12px] text-text-muted">
                                  {v || "—"}
                                </p>
                              </div>
                            ))}
                          </div>
                          <button
                            className="p-1.5 rounded text-red-400 hover:text-red-700 hover:bg-red-500/10 transition-colors transition-colors shrink-0"
                            type="button"
                            onClick={() => removeMedicine(item.id)}
                          >
                            <IoTrashOutline className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-text-muted">
                  Notes & Instructions
                </label>
                <textarea
                  className="w-full px-2.5 py-2 text-[12.5px] border border-border-base rounded bg-surface text-text-main
                    placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 resize-y"
                  placeholder="Add special instructions, warnings, or notes…"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 pb-4">
              <Button
                color="default"
                disabled={saving}
                size="sm"
                variant="bordered"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                disabled={!formData.doctorId || formData.items.length === 0}
                isLoading={saving}
                size="sm"
                startContent={
                  !saving ? (
                    <IoSaveOutline className="w-3.5 h-3.5" />
                  ) : undefined
                }
                onClick={handleSubmit}
              >
                {saving ? "Saving…" : "Create Prescription"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
