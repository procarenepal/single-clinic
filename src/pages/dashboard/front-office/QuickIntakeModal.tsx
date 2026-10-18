import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline, IoSearchOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

import { Spinner } from "@/components/ui";
import { Autocomplete, AutocompleteItem } from "@/components/ui/autocomplete";
import { withDoctorPrefix } from "@/utils/clinicianName";
import {
  previewLineCharge,
  refusalMessage,
  type ChargeClinician,
} from "@/services/core/visitChargeCore";
import type { FrontOfficeSettings } from "@/types/models";

/**
 * The service a newly-added (or retyped) clinician row starts with: the
 * clinic's default consultation for a doctor, its default expert service
 * for an expert — both set under Settings › Front Office. Nothing is
 * matched by name any more; an unconfigured default leaves the row blank
 * so staff pick a service deliberately.
 */
export const getClinicianTypeDefaults = (
  type: "doctor" | "expert",
  frontOffice: Partial<FrontOfficeSettings> | null | undefined,
) => ({
  appointmentTypeId:
    (type === "doctor"
      ? frontOffice?.defaultConsultationTypeId
      : frontOffice?.defaultExpertTypeId) || "",
});

export interface RowFee {
  status:
    | "charge"
    | "free"
    | "refused"
    | "package"
    | "session"
    | "deferred"
    | "none";
  label: string;
  /** VAT-inclusive amount this row collects at check-in, when it does. */
  collectNow: number;
}

const money = (n: number) => `NPR ${n.toLocaleString()}`;

/**
 * The read-only fee line under a clinician row: what the charge core will
 * put on the visit for this service and performer, or why it refuses.
 * Nothing here is editable — price, VAT, commission and collect-at-check-in
 * are the catalogue's answers, not the desk's.
 */
export const describeRowFee = (
  row: {
    clinicianType: "doctor" | "expert";
    clinicianId: string;
    appointmentTypeId: string;
  },
  lists: {
    appointmentTypes: any[];
    packages: any[];
    doctors: any[];
    experts: any[];
  },
  pricing: { taxPercentage?: number; isTaxEnabled?: boolean },
  /** Where the row sits, because submit treats the first row specially. */
  position: {
    index: number;
    firstRowIsPackage: boolean;
    startSessionInstantly: boolean;
  } = { index: 0, firstRowIsPackage: false, startSessionInstantly: false },
): RowFee => {
  // Nothing to say until both halves of the row are chosen; a row without a
  // clinician is ignored at submit anyway.
  if (
    !row.appointmentTypeId ||
    !row.clinicianId ||
    row.clinicianId === "unassigned"
  ) {
    return { status: "none", label: "", collectNow: 0 };
  }
  if (row.appointmentTypeId.startsWith("consume_pkg_")) {
    return {
      status: "session",
      label: "Package session — prepaid, nothing to collect",
      collectNow: 0,
    };
  }
  if (row.appointmentTypeId.startsWith("pkg_")) {
    // Submit only sells the package on the first row.
    if (position.index > 0) {
      return {
        status: "refused",
        label:
          "A package is sold from the first clinician row (or from Sell Package).",
        collectNow: 0,
      };
    }
    const pkg = lists.packages.find(
      (p) => `pkg_${p.id}` === row.appointmentTypeId,
    );
    const price = Number(pkg?.price) || 0;
    const taxed = pkg?.isTaxable === true && pricing.isTaxEnabled;
    const total = taxed
      ? Math.round(price * (1 + (pricing.taxPercentage || 0) / 100) * 100) /
        100
      : price;

    return {
      status: "package",
      label: `Package sale — ${money(total)} collected now${taxed ? " (incl. VAT)" : ""}`,
      collectNow: total,
    };
  }
  // Behind a package sale, the other rows are charged on the first session
  // visit — which only exists when that session starts now.
  if (
    position.index > 0 &&
    position.firstRowIsPackage &&
    !position.startSessionInstantly
  ) {
    return {
      status: "deferred",
      label:
        "Charged when the package's first session is started (tick \"Start first session now\" to charge it today).",
      collectNow: 0,
    };
  }
  const type = lists.appointmentTypes.find(
    (t) => t.id === row.appointmentTypeId,
  );

  if (!type) {
    return {
      status: "refused",
      label: "This service is no longer in the catalogue.",
      collectNow: 0,
    };
  }
  const person =
    row.clinicianType === "doctor"
      ? lists.doctors.find((d) => d.id === row.clinicianId)
      : lists.experts.find((e) => e.id === row.clinicianId);
  const clinician: ChargeClinician | null = person
    ? {
        id: person.id,
        name: person.name,
        kind: row.clinicianType,
        consultationCharge: person.consultationCharge,
        defaultCommission: person.defaultCommission,
      }
    : null;
  const preview = previewLineCharge(type, clinician, pricing);

  if (preview.ok === false) {
    return { status: "refused", label: refusalMessage(preview), collectNow: 0 };
  }
  if (preview.isFree) {
    return { status: "free", label: "Free — nothing to collect", collectNow: 0 };
  }
  const breakdown =
    preview.vat > 0
      ? ` (${money(preview.price)} + VAT ${money(preview.vat)})`
      : "";

  return {
    status: "charge",
    label: `${money(preview.total)}${breakdown} · ${preview.collectAtCheckIn ? "collected at check-in" : "collected at settle"}`,
    collectNow: preview.collectAtCheckIn ? preview.total : 0,
  };
};

/**
 * Rows after the first that share the exact same resolved appointment
 * type with an earlier clinician row — a joint consultation. The backend
 * (appendBookedLines) bills a shared service once, on the first such row,
 * and gives every other clinician on it a commission-only line instead:
 * nothing added to what the patient owes. Without this, each row's own
 * preview (describeRowFee has no idea its siblings exist) shows the full
 * price on every one of them, so a receptionist reading the "Collected at
 * check-in" total — or any one row's own label — sees double what will
 * actually be charged. Returns the set of row indices (into the original
 * `clinicians` array) that are these "additional" rows.
 */
export const sharedTypeAdditionalRowIndices = (
  rows: { index: number; appointmentTypeId: string }[],
): Set<number> => {
  const seen = new Set<string>();
  const additional = new Set<number>();
  for (const { index, appointmentTypeId } of rows) {
    // Only plain booked services are ever billed-once-shared this way —
    // a package sale and a prepaid session consumption aren't catalogue
    // charges in the first place, so grouping them would be meaningless.
    if (
      !appointmentTypeId ||
      appointmentTypeId.startsWith("pkg_") ||
      appointmentTypeId.startsWith("consume_pkg_")
    ) {
      continue;
    }
    if (seen.has(appointmentTypeId)) {
      additional.add(index);
    } else {
      seen.add(appointmentTypeId);
    }
  }
  return additional;
};

export interface QuickIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickIntakeSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  intakeMode: "new" | "existing";
  setIntakeMode: (mode: "new" | "existing") => void;
  selectedExistingPatient: any;
  setSelectedExistingPatient: (patient: any) => void;
  patientSearchQuery: string;
  setPatientSearchQuery: (query: string) => void;
  quickIntakeForm: any;
  setQuickIntakeForm: React.Dispatch<React.SetStateAction<any>>;
  mobileStatus: "idle" | "checking" | "duplicate" | "clear";
  appointmentTypes: any[];
  packages: any[];
  isSearchDropdownOpen: boolean;
  setIsSearchDropdownOpen: (isOpen: boolean) => void;
  patients: any[];
  doctors: any[];
  experts: any[];
  staff: any[];
  referralPartners: any[];
  activePatientPackages: any[];
  addReferrerRow: () => void;
  updateReferrerRow: (index: number, key: string, value: any) => void;
  removeReferrerRow: (index: number) => void;
  /** Clinic default VAT %, so each row's fee line previews the same VAT
   * the charge core will put on the visit. */
  defaultTaxPercentage?: number;
  /** The clinic-wide tax master switch, same reason. */
  enableTax?: boolean;
  /** Front-office defaults: the service a doctor or expert row starts with. */
  frontOffice?: Partial<FrontOfficeSettings> | null;
}

export const QuickIntakeModal: React.FC<QuickIntakeModalProps> = ({
  isOpen,
  onClose,
  quickIntakeSaving,
  onSubmit,
  intakeMode,
  setIntakeMode,
  selectedExistingPatient,
  setSelectedExistingPatient,
  patientSearchQuery,
  setPatientSearchQuery,
  quickIntakeForm,
  setQuickIntakeForm,
  mobileStatus,
  appointmentTypes,
  packages,
  isSearchDropdownOpen,
  setIsSearchDropdownOpen,
  patients,
  doctors,
  experts,
  staff,
  referralPartners,
  activePatientPackages,
  addReferrerRow,
  updateReferrerRow,
  removeReferrerRow,
  defaultTaxPercentage = 0,
  enableTax = false,
  frontOffice,
}) => {
  // Escape-to-close and focus-on-open — matches the pattern already
  // established on the app's other modal shells (appointments-billing.tsx's
  // ModalShell, the shared src/components/ui/modal.tsx); this modal never
  // had it, so pressing Escape (an instinctive habit) did nothing and left
  // the backdrop intercepting every subsequent click until a page reload.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const setIsQuickIntakeOpen = (open: boolean) => {
    if (!open) onClose();
  };
  const handleQuickIntakeSubmit = onSubmit;
  const navigate = useNavigate();

  const modalRoot = document.body;

  return createPortal(
    <>
      {/* Fixed backdrop — covers full viewport independently */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
        onClick={() => setIsQuickIntakeOpen(false)}
      />

      {/* Scroll container — sits over backdrop */}
      <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4 pointer-events-none">
        <div
          ref={panelRef}
          className="bg-surface rounded border border-border-base shadow-2xl w-full max-w-6xl relative my-auto pointer-events-auto animate-in fade-in zoom-in-95 duration-200 outline-none"
          tabIndex={-1}
        >
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[14px] sm:text-[14.5px] text-text-main">
                📋 Quick Walk-In Registration
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Register & Check-in walk-in patient instantly.
              </p>
            </div>
            <button
              aria-label="Close"
              className="text-text-muted hover:text-text-main p-1"
              onClick={() => setIsQuickIntakeOpen(false)}
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleQuickIntakeSubmit}>
            <div className="p-4 sm:p-5 max-h-[calc(100vh-10rem)] overflow-y-auto">
              <div className="flex flex-col gap-4 sm:gap-6 max-w-4xl mx-auto">
                {/* Demographics & Intake Details */}
                <div className="space-y-4">
                  {/* Intake Mode Switcher */}
                  <div className="flex bg-surface-2 p-1 rounded-lg border border-border-base w-full mb-2">
                    <button
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        intakeMode === "new"
                          ? "bg-primary text-white shadow-sm"
                          : "text-text-muted hover:text-text-main"
                      }`}
                      type="button"
                      onClick={() => {
                        setIntakeMode("new");
                        setSelectedExistingPatient(null);
                        setPatientSearchQuery("");
                      }}
                    >
                      New Patient Walk-in
                    </button>
                    <button
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        intakeMode === "existing"
                          ? "bg-primary text-white shadow-sm"
                          : "text-text-muted hover:text-text-main"
                      }`}
                      type="button"
                      onClick={() => {
                        setIntakeMode("existing");
                      }}
                    >
                      Search Existing Patient
                    </button>
                  </div>

                  <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-border-base pb-1">
                    {intakeMode === "new"
                      ? "New Patient Profile & Consultation"
                      : "Select Patient & Consultation"}
                  </h4>

                  {intakeMode === "new" ? (
                    <>
                      {/* Full Name */}
                      <div>
                        <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                          Patient Full Name{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                          placeholder="e.g. John Doe"
                          type="text"
                          value={quickIntakeForm.name}
                          onChange={(e) =>
                            setQuickIntakeForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Mobile & Age */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Mobile Number{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              required
                              className={`w-full h-9 px-3 pr-8 text-[13px] border ${mobileStatus === "duplicate" ? "border-error focus:border-error focus:ring-1 focus:ring-error/20" : "border-border-base focus:border-primary focus:ring-1 focus:ring-primary/20"} rounded outline-none bg-surface text-text-main transition-colors`}
                              placeholder="e.g. 98XXXXXXXX"
                              type="tel"
                              value={quickIntakeForm.mobile}
                              onChange={(e) =>
                                setQuickIntakeForm((prev) => ({
                                  ...prev,
                                  mobile: e.target.value,
                                }))
                              }
                            />
                            {mobileStatus === "checking" && (
                              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                <Spinner size="xs" />
                              </div>
                            )}
                          </div>
                          {mobileStatus === "duplicate" && (
                            <p className="text-[10.5px] text-error font-medium mt-1">
                              ⚠️ Patient with this mobile exists.
                            </p>
                          )}
                          {mobileStatus === "clear" && (
                            <p className="text-[10.5px] text-health-600 font-medium mt-1">
                              ✓ Number available.
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Age <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                            placeholder="e.g. 28 or 10 Months"
                            type="text"
                            value={quickIntakeForm.age}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                age: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {/* Gender, Appointment Category & Date */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-1">
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Gender
                          </label>
                          <select
                            className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                            value={quickIntakeForm.gender}
                            onChange={(e) =>
                              setQuickIntakeForm((prev: any) => ({
                                ...prev,
                                gender: e.target.value,
                              }))
                            }
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Appointment Date
                          </label>
                          <input
                            required
                            className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                            type="date"
                            value={quickIntakeForm.appointmentDate}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                appointmentDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {/* PAN/VAT — optional, but needed for the printed
                          invoice's Purchaser's PAN field (Schedule 6) */}
                      <div>
                        <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                          PAN/VAT Number (Optional)
                        </label>
                        <input
                          className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                          inputMode="numeric"
                          maxLength={9}
                          placeholder="9-digit PAN/VAT, e.g. 123456789"
                          type="text"
                          value={quickIntakeForm.patientPanVat}
                          onChange={(e) =>
                            setQuickIntakeForm((prev) => ({
                              ...prev,
                              // Nepal PAN/VAT numbers are digits only, 9
                              // digits — this prints on the invoice's
                              // Purchaser's PAN field, so filter garbage
                              // input rather than letting it through.
                              patientPanVat: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 9),
                            }))
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Existing Patient Search Panel */}
                      <div className="space-y-4">
                        {!selectedExistingPatient ? (
                          <div className="relative">
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              🔍 Search Existing Patient
                            </label>
                            <div className="relative flex items-center border border-border-base rounded-[10px] min-h-[38px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
                              <IoSearchOutline className="ml-3 w-4 h-4 text-text-muted/70 shrink-0" />
                              <input
                                className="flex-1 w-full text-[13.5px] px-2 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/70"
                                placeholder="Search by name, Reg # or mobile number..."
                                type="text"
                                value={patientSearchQuery}
                                onChange={(e) => {
                                  setPatientSearchQuery(e.target.value);
                                  setIsSearchDropdownOpen(true);
                                }}
                                onFocus={() => setIsSearchDropdownOpen(true)}
                              />
                              {patientSearchQuery && (
                                <button
                                  className="mr-3 text-text-muted hover:text-text-main"
                                  type="button"
                                  onClick={() => setPatientSearchQuery("")}
                                >
                                  <IoCloseOutline className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Search Results Dropdown */}
                            {isSearchDropdownOpen &&
                              patientSearchQuery.trim().length > 0 && (
                                <>
                                  <div
                                    className="fixed inset-0 z-[10]"
                                    onClick={() =>
                                      setIsSearchDropdownOpen(false)
                                    }
                                  />
                                  <div className="absolute left-0 right-0 mt-1 bg-surface border border-border-base rounded-lg shadow-xl max-h-60 overflow-y-auto z-[20] pr-1">
                                    {(() => {
                                      const query =
                                        patientSearchQuery.toLowerCase();
                                      const filteredPatients = patients.filter(
                                        (p) =>
                                          (p.name && p.name.toLowerCase().includes(query)) ||
                                          (p.regNumber && p.regNumber.toLowerCase().includes(query)) ||
                                          (p.mobile && p.mobile.includes(query)),
                                      );

                                      if (filteredPatients.length === 0) {
                                        return (
                                          <div className="p-4 text-center text-xs text-text-muted">
                                            No matching patients found.
                                          </div>
                                        );
                                      }

                                      return filteredPatients.map((p) => (
                                        <button
                                          key={p.id}
                                          className="w-full text-left px-4 py-2.5 hover:bg-primary/5 border-b border-border-base/30 last:border-0 flex items-center justify-between transition-colors"
                                          type="button"
                                          onClick={() => {
                                            setSelectedExistingPatient(p);
                                            setIsSearchDropdownOpen(false);
                                            // Auto-fill physician or referrals if they exist on the patient
                                            setQuickIntakeForm((prev) => {
                                              const updated = { ...prev };

                                              if (
                                                p.doctorId &&
                                                p.doctorId !== "unassigned"
                                              ) {
                                                updated.doctorId = p.doctorId;
                                              }
                                              if (p.assignedExpertId) {
                                                updated.assignedExpertId =
                                                  p.assignedExpertId;
                                              }
                                              if (
                                                p.referrals &&
                                                p.referrals.length > 0
                                              ) {
                                                updated.referrals = p.referrals;
                                              }

                                              return updated;
                                            });
                                          }}
                                        >
                                          <div>
                                            <p className="text-[13px] font-bold text-text-main leading-tight font-sans">
                                              {p.name}
                                            </p>
                                            <p className="text-[11px] text-text-muted mt-0.5 leading-tight font-sans">
                                              Reg #: {p.regNumber || "N/A"} •
                                              Mob: {p.mobile}
                                            </p>
                                          </div>
                                          <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase">
                                            Select
                                          </span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                </>
                              )}
                          </div>
                        ) : (
                          /* Selected Patient Preview Card */
                          <div className="bg-surface-2/60 border border-border-base rounded-xl p-4 flex flex-col gap-3.5 relative shadow-sm animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-3.5">
                              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-base font-bold shrink-0 shadow-sm">
                                {selectedExistingPatient.name
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[14.5px] font-extrabold text-text-main leading-none">
                                    {selectedExistingPatient.name}
                                  </p>
                                  {selectedExistingPatient.isCritical && (
                                    <span className="text-[9px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 px-1 py-0.5 rounded leading-none">
                                      CRITICAL
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11.5px] text-text-muted mt-1.5 font-medium leading-none">
                                  Reg #:{" "}
                                  <span className="text-primary font-bold">
                                    {selectedExistingPatient.regNumber || "N/A"}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border-base/50 pt-3 text-[12px]">
                              <div>
                                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">
                                  Mobile Number
                                </span>
                                <span className="text-text-main font-semibold mt-0.5 block">
                                  {selectedExistingPatient.mobile}
                                </span>
                              </div>
                              <div>
                                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">
                                  Age / Gender
                                </span>
                                <span className="text-text-main font-semibold mt-0.5 block">
                                  {selectedExistingPatient.age || "—"} /{" "}
                                  {selectedExistingPatient.gender || "—"}
                                </span>
                              </div>
                            </div>

                            <button
                              className="w-full mt-1.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-[11.5px] font-bold transition-all shadow-none flex items-center justify-center gap-1"
                              type="button"
                              onClick={() => {
                                setSelectedExistingPatient(null);
                                setPatientSearchQuery("");
                              }}
                            >
                              <IoCloseOutline className="w-4 h-4" /> Reset &
                              Search Another Patient
                            </button>
                          </div>
                        )}

                        {/* Appointment Date & Category for Existing Patient */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Appointment Date
                            </label>
                            <input
                              required
                              className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                              type="date"
                              value={quickIntakeForm.appointmentDate}
                              onChange={(e) =>
                                setQuickIntakeForm((prev) => ({
                                  ...prev,
                                  appointmentDate: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Assigned Clinicians */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-border-base pb-1">
                      <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider">
                        Assigned Clinicians
                      </h4>
                      <button
                        type="button"
                        className="px-2 py-1 text-[11px] font-bold text-primary border border-primary/20 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded transition-colors"
                        onClick={() => {
                          setQuickIntakeForm((prev: any) => ({
                            ...prev,
                            clinicians: [
                              ...(prev.clinicians || []),
                              {
                                id: crypto.randomUUID(),
                                clinicianType: "doctor",
                                clinicianId: "",
                                ...getClinicianTypeDefaults(
                                  "doctor",
                                  frontOffice,
                                ),
                              },
                            ],
                          }));
                        }}
                      >
                        + Add Clinician
                      </button>
                    </div>

                    {(() => {
                      // Only rows with a clinician count — an unassigned row
                      // is skipped at submit, so it must not "claim" a service
                      // type first and make the real charge below it preview
                      // as nothing-added.
                      const sharedTypeAdditional = sharedTypeAdditionalRowIndices(
                        (quickIntakeForm.clinicians || [])
                          .map((c: any, index: number) => ({ c, index }))
                          .filter(
                            ({ c }) =>
                              c.clinicianId && c.clinicianId !== "unassigned",
                          )
                          .map(({ c, index }) => ({
                            index,
                            appointmentTypeId: String(
                              c.appointmentTypeId ||
                                quickIntakeForm.appointmentTypeId ||
                                "",
                            ),
                          })),
                      );

                      return (quickIntakeForm.clinicians || []).map(
                      (row: any, idx: number) => (
                        <div
                          key={row.id}
                          className="border border-border-base rounded p-2 bg-surface-2/30 relative mt-2"
                        >
                          {quickIntakeForm.clinicians.length > 1 && (
                            <button
                              type="button"
                              className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center border border-red-200 hover:bg-red-200"
                              onClick={() => {
                                setQuickIntakeForm((prev: any) => ({
                                  ...prev,
                                  clinicians: prev.clinicians.filter(
                                    (c: any) => c.id !== row.id,
                                  ),
                                }));
                              }}
                            >
                              <IoCloseOutline className="w-4 h-4" />
                            </button>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                                Clinician Type
                              </label>
                              <select
                                className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                value={row.clinicianType}
                                onChange={(e) => {
                                  const newType = e.target.value as
                                    | "doctor"
                                    | "expert";

                                  setQuickIntakeForm((prev: any) => ({
                                    ...prev,
                                    clinicians: prev.clinicians.map((c: any) => {
                                      if (c.id !== row.id) return c;
                                      return {
                                        ...c,
                                        clinicianType: newType,
                                        clinicianId: "",
                                        ...getClinicianTypeDefaults(
                                          newType,
                                          frontOffice,
                                        ),
                                      };
                                    }),
                                  }));
                                }}
                              >
                                <option value="doctor">Doctor</option>
                                <option value="expert">Expert</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                                Select Clinician
                              </label>
                              <select
                                className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                value={row.clinicianId}
                                onChange={(e) => {
                                  setQuickIntakeForm((prev: any) => ({
                                    ...prev,
                                    clinicians: prev.clinicians.map((c: any) => {
                                      if (c.id !== row.id) return c;
                                      return {
                                        ...c,
                                        clinicianId: e.target.value,
                                      };
                                    }),
                                  }));
                                }}
                              >
                                <option value="">None / Unassigned</option>
                                {row.clinicianType === "doctor"
                                  ? doctors
                                      .filter(
                                        (_d: any) => _d.isActive !== false,
                                      )
                                      .map((d) => (
                                        <option key={d.id} value={d.id}>
                                          {withDoctorPrefix(d.name)} (
                                          {d.speciality || "GP"})
                                        </option>
                                      ))
                                  : experts
                                      .filter(
                                        (_e: any) => _e.isActive !== false,
                                      )
                                      .map((exp) => (
                                        <option key={exp.id} value={exp.id}>
                                          {exp.name} (
                                          {exp.speciality || "Consultant"})
                                        </option>
                                      ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                                Appointment Category
                              </label>
                              <Autocomplete
                                className="w-full h-9"
                                placeholder="Search category..."
                                selectedKey={row.appointmentTypeId || ""}
                                onSelectionChange={(key) => {
                                  if (key) {
                                    setQuickIntakeForm((prev: any) => ({
                                      ...prev,
                                      clinicians: prev.clinicians.map(
                                        (c: any) =>
                                          c.id === row.id
                                            ? {
                                                ...c,
                                                appointmentTypeId: String(key),
                                              }
                                            : c,
                                      ),
                                    }));
                                  }
                                }}
                              >
                                {appointmentTypes.map((t) => (
                                  <AutocompleteItem key={t.id} textValue={t.name}>
                                    {t.name}
                                  </AutocompleteItem>
                                ))}
                                {activePatientPackages?.map((pkg) => (
                                  <AutocompleteItem
                                    key={`consume_pkg_${pkg.id}`}
                                    textValue={`⭐ Consume Session: ${pkg.packageName} (${pkg.usedSessions}/${pkg.totalSessions} used)`}
                                  >
                                    ⭐ Consume Session: {pkg.packageName} (
                                    {pkg.usedSessions}/{pkg.totalSessions} used)
                                  </AutocompleteItem>
                                ))}
                                {packages?.map((pkg) => (
                                  <AutocompleteItem
                                    key={`pkg_${pkg.id}`}
                                    textValue={`📦 ${pkg.name} (NPR ${pkg.price.toLocaleString()})`}
                                  >
                                    📦 {pkg.name} (NPR {pkg.price.toLocaleString()})
                                  </AutocompleteItem>
                                ))}
                              </Autocomplete>
                            </div>
                          </div>
                          {(() => {
                            let fee = describeRowFee(
                              {
                                ...row,
                                appointmentTypeId:
                                  row.appointmentTypeId ||
                                  quickIntakeForm.appointmentTypeId,
                              },
                              { appointmentTypes, packages, doctors, experts },
                              {
                                taxPercentage: defaultTaxPercentage,
                                isTaxEnabled: enableTax,
                              },
                              {
                                index: idx,
                                firstRowIsPackage: String(
                                  quickIntakeForm.clinicians?.[0]
                                    ?.appointmentTypeId || "",
                                ).startsWith("pkg_"),
                                startSessionInstantly: Boolean(
                                  quickIntakeForm.startSessionInstantly,
                                ),
                              },
                            );
                            if (
                              fee.status === "charge" &&
                              sharedTypeAdditional.has(idx)
                            ) {
                              fee = {
                                status: "charge",
                                label:
                                  "Shared with another clinician above — commission only, nothing added",
                                collectNow: 0,
                              };
                            }

                            if (fee.status === "none") return null;
                            const tone =
                              fee.status === "refused"
                                ? "text-danger"
                                : fee.status === "charge" ||
                                    fee.status === "package"
                                  ? "text-text-main"
                                  : "text-text-muted";

                            return (
                              <p
                                className={`mt-2 text-[11.5px] font-medium ${tone}`}
                                data-testid="row-fee"
                              >
                                {fee.status === "refused" ? "⚠ " : ""}
                                {fee.label}
                              </p>
                            );
                          })()}
                        </div>
                      ),
                    );
                    })()}
                  </div>

                  {/* What check-in collects: the sum of the rows' fee lines.
                      Tax and discount are not asked here — VAT comes from each
                      service's flag, and a discount is a permissioned decision
                      taken at Settle, where the whole visit is known. */}
                  {(() => {
                    const allRows: any[] = quickIntakeForm.clinicians || [];
                    const rows = allRows
                      .map((c: any, index: number) => ({ c, index }))
                      .filter(
                        ({ c }) => c.clinicianId && c.clinicianId !== "unassigned",
                      );
                    const firstRowIsPackage = String(
                      allRows[0]?.appointmentTypeId || "",
                    ).startsWith("pkg_");
                    // A service shared by two rows is collected once (see
                    // sharedTypeAdditionalRowIndices) — the same grouping
                    // appendBookedLines applies when it actually bills.
                    const sharedTypeAdditional = sharedTypeAdditionalRowIndices(
                      rows.map(({ c, index }) => ({
                        index,
                        appointmentTypeId: String(
                          c.appointmentTypeId ||
                            quickIntakeForm.appointmentTypeId ||
                            "",
                        ),
                      })),
                    );
                    const fees = rows.map(({ c, index }) => {
                      const fee = describeRowFee(
                        {
                          ...c,
                          appointmentTypeId:
                            c.appointmentTypeId ||
                            quickIntakeForm.appointmentTypeId,
                        },
                        { appointmentTypes, packages, doctors, experts },
                        {
                          taxPercentage: defaultTaxPercentage,
                          isTaxEnabled: enableTax,
                        },
                        {
                          index,
                          firstRowIsPackage,
                          startSessionInstantly: Boolean(
                            quickIntakeForm.startSessionInstantly,
                          ),
                        },
                      );

                      return fee.status === "charge" &&
                        sharedTypeAdditional.has(index)
                        ? { ...fee, collectNow: 0 }
                        : fee;
                    });

                    if (fees.length === 0) return null;
                    const collectNow = fees.reduce(
                      (sum: number, f: RowFee) => sum + f.collectNow,
                      0,
                    );
                    const refused = fees.filter(
                      (f: RowFee) => f.status === "refused",
                    );

                    return (
                      <div className="mt-1 p-2.5 rounded border border-border-base bg-surface-2/50 text-[12px] space-y-1">
                        <div className="flex justify-between font-bold text-text-main">
                          <span>Collected at check-in</span>
                          <span data-testid="intake-collect-now">
                            NPR {collectNow.toLocaleString()}
                          </span>
                        </div>
                        {refused.length > 0 && (
                          <p className="text-[11px] text-danger">
                            Check-in will not charge the flagged row
                            {refused.length > 1 ? "s" : ""} until it is fixed.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Payment details for Package Sales. Gated on the
                      FIRST CLINICIAN ROW's own appointmentTypeId — the
                      same field Submit treats as "is this a package sale"
                      (it copies row 0's value onto the form-level field,
                      but only inside the submit handler itself) — not the
                      form-level field, which is never actually a package
                      id while this form is still being filled in. */}
                  {String(
                    quickIntakeForm.clinicians?.[0]?.appointmentTypeId || "",
                  ).startsWith("pkg_") && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Payment Method
                          </label>
                          <select
                            className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                            value={quickIntakeForm.paymentMethod}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                paymentMethod: e.target.value,
                              }))
                            }
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="esewa">eSewa</option>
                            <option value="khalti">Khalti</option>
                            <option value="bank_transfer">Bank Transfer</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Payment Reference (Optional)
                          </label>
                          <input
                            className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                            placeholder="e.g. Trx ID"
                            type="text"
                            value={quickIntakeForm.paymentReference}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                paymentReference: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {/* Checkbox for package sale: start session instantly */}
                      <div className="mt-3 flex items-center gap-2 p-2 bg-primary/5 rounded border border-primary/10">
                        <input
                          checked={quickIntakeForm.startSessionInstantly}
                          className="w-4 h-4 rounded border-border-base text-primary focus:ring-primary cursor-pointer"
                          id="intakeStartSession"
                          type="checkbox"
                          onChange={(e) =>
                            setQuickIntakeForm((prev) => ({
                              ...prev,
                              startSessionInstantly: e.target.checked,
                            }))
                          }
                        />
                        <label
                          className="text-[12px] font-medium text-text-main cursor-pointer select-none"
                          htmlFor="intakeStartSession"
                        >
                          Start first session instantly (Add to Lobby Queue)
                        </label>
                      </div>
                    </>
                  )}

                  {/* Complaints / Reason */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                      Chief Complaints / Reason for Visit
                    </label>
                    <textarea
                      className="w-full min-h-16 px-3 py-2 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors resize-none"
                      placeholder="e.g. fever since yesterday, follow-up consult..."
                      value={quickIntakeForm.reason}
                      onChange={(e) =>
                        setQuickIntakeForm((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {/* Checkbox for bypass workflow — same fix as the
                      package-sale block above: gate on the first
                      clinician row's own appointmentTypeId, not the
                      form-level field (never actually "consume_pkg_"
                      until the submit handler mutates it). */}
                  {String(
                    quickIntakeForm.clinicians?.[0]?.appointmentTypeId || "",
                  ).startsWith("consume_pkg_") && (
                    <div className="mt-3 flex items-center gap-2 p-2 bg-indigo-500/10 rounded border border-indigo-500/20">
                      <input
                        checked={quickIntakeForm.sendDirectlyToCabin}
                        className="w-4 h-4 rounded border-border-base text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                        id="intakeSendDirect"
                        type="checkbox"
                        onChange={(e) =>
                          setQuickIntakeForm((prev) => ({
                            ...prev,
                            sendDirectlyToCabin: e.target.checked,
                          }))
                        }
                      />
                      <label
                        className="text-[12px] font-medium text-text-main cursor-pointer select-none"
                        htmlFor="intakeSendDirect"
                      >
                        Skip Lobby/Triage (Send directly to Doctor or Expert
                        Cabin)
                      </label>
                    </div>
                  )}
                </div>

                {/* Polymorphic Referrals Panel */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-border-base pb-1">
                      Referral Sources & Commissions
                    </h4>

                    <div className="border border-border-base rounded p-3 bg-surface-2/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-[11.5px] font-bold text-text-main">
                            Referral Sources & Commission Splits
                          </label>
                          <p className="text-[10px] text-text-muted">
                            Associate this patient check-in with one or more
                            referrers.
                          </p>
                        </div>
                        <button
                          className="px-2.5 py-1 text-[11px] font-bold text-primary border border-primary/20 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded transition-colors"
                          type="button"
                          onClick={addReferrerRow}
                        >
                          ➕ Add Referrer
                        </button>
                      </div>

                      {quickIntakeForm.referrals.length === 0 ? (
                        <div className="py-4 text-center text-[11.5px] text-text-muted bg-surface/50 border border-dashed border-border-base rounded">
                          No active referrals added (Patient is a Direct
                          Walk-in).
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const totalSplit = quickIntakeForm.referrals.reduce(
                              (sum: number, ref: any) =>
                                sum + (Number(ref.commissionPercentage) || 0),
                              0,
                            );
                            const overCommitted = totalSplit > 100;

                            return (
                              <div
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-semibold ${
                                  overCommitted
                                    ? "bg-red-500/10 text-red-600 border border-red-500/20"
                                    : "bg-surface text-text-muted border border-border-base"
                                }`}
                              >
                                <span>Total Split</span>
                                <span>
                                  {totalSplit}% of 100%
                                  {overCommitted && " — exceeds 100%"}
                                </span>
                              </div>
                            );
                          })()}
                          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                          {quickIntakeForm.referrals.map((ref, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col gap-2 bg-surface p-2 border border-border-base rounded shadow-none relative"
                            >
                              <div className="flex items-center gap-2">
                                <div className="grid grid-cols-12 gap-2 flex-1">
                                  {/* Referrer Type Dropdown */}
                                  <div className="col-span-4">
                                    <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                      Type
                                    </label>
                                    <select
                                      className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                      value={ref.type}
                                      onChange={(e) =>
                                        updateReferrerRow(
                                          idx,
                                          "type",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="referral-partner">
                                        External Partner
                                      </option>
                                      <option value="doctor">
                                        Internal Doctor
                                      </option>
                                      <option value="expert">
                                        External Expert
                                      </option>
                                      <option value="staff">
                                        Internal Staff
                                      </option>
                                    </select>
                                  </div>

                                  {/* Referrer Name Dropdown */}
                                  <div className="col-span-5">
                                    <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                      Name
                                    </label>
                                    <select
                                      className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                      value={ref.id}
                                      onChange={(e) =>
                                        updateReferrerRow(
                                          idx,
                                          "id",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      {ref.type === "referral-partner" && (
                                        <>
                                          <option value="">
                                            -- Choose Partner --
                                          </option>
                                          {referralPartners.map((rp) => (
                                            <option key={rp.id} value={rp.id}>
                                              {rp.name}
                                            </option>
                                          ))}
                                        </>
                                      )}
                                      {ref.type === "doctor" && (
                                        <>
                                          <option value="">
                                            -- Choose Doctor --
                                          </option>
                                          {doctors
                                            .filter(
                                              (_d: any) =>
                                                _d.isActive !== false,
                                            )
                                            .map((d) => (
                                              <option key={d.id} value={d.id}>
                                                {withDoctorPrefix(d.name)}
                                              </option>
                                            ))}
                                        </>
                                      )}
                                      {ref.type === "expert" && (
                                        <>
                                          <option value="">
                                            -- Choose Expert --
                                          </option>
                                          {experts
                                            .filter(
                                              (_e: any) =>
                                                _e.isActive !== false,
                                            )
                                            .map((exp) => (
                                              <option
                                                key={exp.id}
                                                value={exp.id}
                                              >
                                                {exp.name}
                                              </option>
                                            ))}
                                        </>
                                      )}
                                      {ref.type === "staff" && (
                                        <>
                                          <option value="">
                                            -- Choose Staff --
                                          </option>
                                          {staff.map((s) => (
                                            <option key={s.id} value={s.id}>
                                              {s.name}
                                            </option>
                                          ))}
                                        </>
                                      )}
                                    </select>
                                  </div>

                                  {/* Commission split percentage */}
                                  <div className="col-span-3">
                                    <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                      Split %
                                    </label>
                                    <input
                                      className="w-full h-8 px-1 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors text-right"
                                      max="100"
                                      min="0"
                                      type="number"
                                      value={ref.commissionPercentage}
                                      onChange={(e) =>
                                        updateReferrerRow(
                                          idx,
                                          "commissionPercentage",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                {/* Action delete button */}
                                <button
                                  className="h-8 w-8 rounded border border-border-base text-red-500 hover:bg-red-500/5 flex items-center justify-center transition-colors shrink-0 mt-3"
                                  title="Remove referrer"
                                  type="button"
                                  onClick={() => removeReferrerRow(idx)}
                                >
                                  &times;
                                </button>
                              </div>

                              {/* Partner sub-row: Specific referred by doctor/expert */}
                              {ref.type === "referral-partner" && (
                                <div className="border-t border-border-base/50 pt-2 mt-1 grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-5">
                                    <span className="text-[9.5px] font-bold text-text-muted">
                                      Referred By (Doc/Expert):
                                    </span>
                                  </div>
                                  <div className="col-span-7">
                                    <select
                                      className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                      value={ref.referredById || ""}
                                      onChange={(e) =>
                                        updateReferrerRow(
                                          idx,
                                          "referredById",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="">
                                        -- Optional Referring Person --
                                      </option>
                                      <optgroup label="Internal Doctors">
                                        {doctors
                                          .filter(
                                            (_d: any) => _d.isActive !== false,
                                          )
                                          .map((d) => (
                                            <option key={d.id} value={d.id}>
                                              {withDoctorPrefix(d.name)} (
                                              {d.speciality || "GP"})
                                            </option>
                                          ))}
                                      </optgroup>
                                      <optgroup label="External Experts">
                                        {experts
                                          .filter(
                                            (_e: any) => _e.isActive !== false,
                                          )
                                          .map((exp) => (
                                            <option key={exp.id} value={exp.id}>
                                              {exp.name}
                                            </option>
                                          ))}
                                      </optgroup>
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Smart CTA Redirect link */}
                  <div className="p-3 bg-primary/5 rounded border border-primary/10 text-center">
                    <p className="text-[11px] text-text-muted">
                      Need to record Insurance, full family history, or payment
                      details?
                    </p>
                    <button
                      className="text-[11px] font-semibold text-primary hover:underline mt-1"
                      type="button"
                      onClick={() => {
                        // Typed-in-progress demographics for a new walk-in
                        // would otherwise be silently discarded — confirm
                        // first rather than surprising whoever already
                        // filled in a name/mobile before realizing they
                        // need the full registration page.
                        const hasUnsavedInput =
                          intakeMode === "new" &&
                          (quickIntakeForm?.name?.trim() ||
                            quickIntakeForm?.mobile?.trim());

                        if (
                          hasUnsavedInput &&
                          !window.confirm(
                            "You've already entered patient details here. Leaving now will discard them. Continue to the full registration page?",
                          )
                        ) {
                          return;
                        }
                        setIsQuickIntakeOpen(false);
                        navigate("/dashboard/patients/new");
                      }}
                    >
                      Go to Full Patient Registration Page &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-border-base bg-surface-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 rounded-b-lg">
              <button
                className="h-9 px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors w-full sm:w-auto"
                type="button"
                onClick={() => setIsQuickIntakeOpen(false)}
              >
                Cancel
              </button>
              <button
                className="h-9 px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors w-full sm:w-auto"
                disabled={quickIntakeSaving}
                type="submit"
              >
                {quickIntakeSaving ? "Checking In..." : "Complete Check-In"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    modalRoot,
  );
};
