/**
 * New Patient — Clinic Clarity Design
 * Zero HeroUI. Two-step wizard: Patient Profile → Schedule Appointment.
 * All custom UI: inputs, selects, autocomplete, spinner, card sections.
 */
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

// Auth & services
import {
  IoCheckmarkCircleOutline,
  IoChevronBackOutline,
  IoPersonOutline,
  IoCalendarOutline,
  IoArrowBackOutline,
  IoSaveOutline,
  IoRefreshOutline,
  IoSearchOutline,
  IoCloseOutline,
} from "react-icons/io5";
import { Check as CheckIcon } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { appointmentService } from "@/services/appointmentService";
import { branchService } from "@/services/branchService";
import { referralPartnerService } from "@/services/referralPartnerService";
import {
  scheduleAppointmentReminder,
  scheduleDoctorAppointmentReminder,
} from "@/services/sendMessageService";
import { expertService } from "@/services/expertService";
import { referralCommissionService } from "@/services/referralCommissionService";
import { doctorCommissionService } from "@/services/doctorCommissionService";

// Types
import {
  Doctor,
  AppointmentType,
  Appointment,
  Patient,
  ReferralPartner,
  Expert,
} from "@/types/models";

// Custom UI
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Divider } from "@/components/ui/divider";
import { addToast } from "@/components/ui/toast";
import { title } from "@/components/primitives";

// Date utils
import {
  adToBSApi,
  bsToADApi,
  formatDateWithoutTimezone,
  validateBSDateFormat,
  validateADDate,
  debounce,
} from "@/utils/dateConverterApi";

// Icons

// ── Shared field wrapper ─────────────────────────────────────────────────────
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-text-main">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10.5px] text-text-muted">{hint}</p>}
    </div>
  );
}

/** Flat text input for native HTML inputs (date, time, number, text) */
function FlatInput({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  className = "",
  endContent,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  endContent?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        className={`w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main
          placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20
          disabled:bg-surface-2 disabled:text-text-muted ${endContent ? "pr-20" : ""} ${className}`}
        disabled={disabled}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {endContent && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          {endContent}
        </div>
      )}
    </div>
  );
}

/** Flat native <select> */
function FlatSelect({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      className="w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main
        focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20
        disabled:bg-surface-2 disabled:text-text-muted"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

/** Doctor autocomplete — searchable dropdown (portal so not clipped by overflow-hidden) */
function DoctorSelect({
  doctors,
  value,
  onChange,
  loading,
  locked,
  hint,
  title,
  placeholder,
}: {
  doctors: Doctor[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  locked?: boolean;
  hint?: string;
  title?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const filtered = q
    ? doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q.toLowerCase()) ||
        d.speciality?.toLowerCase().includes(q.toLowerCase()),
    )
    : doctors;
  const selected = doctors.find((d) => d.id === value);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 4;
    const listMaxHeight = 192; // max-h-48
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const showAbove = spaceBelow < Math.min(listMaxHeight, 200);
    const top = showAbove ? rect.top - listMaxHeight - gap : rect.bottom + gap;

    setCoords({ top, left: rect.left, width: rect.width });
  }, []);

  useLayoutEffect(() => {
    if (open && !locked) {
      updatePosition();
    } else {
      setCoords(null);
    }
  }, [open, locked, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updatePosition();

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        className={`flex items-center h-9 border border-border-base rounded bg-surface ${locked ? "bg-surface-2" : "cursor-text"} focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20`}
        onClick={() => !locked && setOpen(true)}
      >
        {loading ? (
          <div className="flex items-center gap-2 px-2.5">
            <Spinner size="xs" />
            <span className="text-[12px] text-text-muted">
              Loading {title ? title.toLowerCase() : "doctors"}…
            </span>
          </div>
        ) : locked && selected ? (
          <span className="px-2.5 text-[12.5px] text-text-main">
            {selected.name}
            {selected.speciality && ` — ${selected.speciality}`}
          </span>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 w-full">
            <IoSearchOutline className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input
              className="flex-1 text-[12.5px] bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/60"
              placeholder={placeholder || "Search doctor…"}
              type="text"
              value={selected && !open ? `${selected.name}` : q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            {value && !locked && (
              <button
                className="text-text-muted hover:text-text-main"
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
        )}
      </div>

      {open &&
        !locked &&
        createPortal(
          <>
            <div
              aria-hidden
              className="fixed inset-0 z-[9998]"
              onClick={() => setOpen(false)}
            />
            <div
              className="z-[9999] bg-surface border border-border-base rounded shadow-lg max-h-48 overflow-y-auto min-w-[200px]"
              style={{
                position: "fixed",
                top: coords ? coords.top : -9999,
                left: coords ? coords.left : -9999,
                width: coords ? coords.width : undefined,
              }}
            >
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-text-muted">
                  No {title ? title.toLowerCase() : "doctors"} found
                </p>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.id}
                    className={`w-full text-left px-3 py-2 hover:bg-primary/10 transition-colors ${d.id === value ? "bg-primary/10" : ""}`}
                    type="button"
                    onClick={() => {
                      onChange(d.id);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <p className="text-[12.5px] text-text-main font-medium">
                      {d.name}
                    </p>
                    {d.speciality && (
                      <p className="text-[11px] text-text-muted">
                        {d.speciality}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </>,
          document.body,
        )}
      {hint && <p className="text-[10.5px] text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

/** Appointment type autocomplete (portal so not clipped by overflow-hidden) */
function AppointmentTypeSelect({
  types,
  value,
  onChange,
  loading,
}: {
  types: AppointmentType[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const filtered = q
    ? types.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
    : types;
  const selected = types.find((t) => t.id === value);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 4;
    const listMaxHeight = 192; // max-h-48
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const showAbove = spaceBelow < Math.min(listMaxHeight, 200);
    const top = showAbove ? rect.top - listMaxHeight - gap : rect.bottom + gap;

    setCoords({ top, left: rect.left, width: rect.width });
  }, []);

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    } else {
      setCoords(null);
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updatePosition();

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        className="flex items-center h-9 border border-border-base rounded bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 cursor-text"
        onClick={() => setOpen(true)}
      >
        {loading ? (
          <div className="flex items-center gap-2 px-2.5">
            <Spinner size="xs" />
            <span className="text-[12px] text-text-muted">
              Loading types…
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 w-full">
            <IoSearchOutline className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input
              className="flex-1 text-[12.5px] bg-transparent focus:outline-none text-text-main placeholder:text-text-muted/60"
              placeholder="Search appointment type…"
              type="text"
              value={selected && !open ? selected.name : q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            {value && (
              <button
                className="text-text-muted hover:text-text-main"
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
        )}
      </div>

      {open &&
        createPortal(
          <>
            <div
              aria-hidden
              className="fixed inset-0 z-[9998]"
              onClick={() => setOpen(false)}
            />
            <div
              className="z-[9999] bg-surface border border-border-base rounded shadow-lg max-h-48 overflow-y-auto min-w-[200px]"
              style={{
                position: "fixed",
                top: coords ? coords.top : -9999,
                left: coords ? coords.left : -9999,
                width: coords ? coords.width : undefined,
              }}
            >
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-text-muted">
                  No types found
                </p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    className={`w-full text-left px-3 py-2 hover:bg-primary/10 text-[12.5px] text-text-main ${t.id === value ? "bg-primary/10 font-medium" : ""}`}
                    type="button"
                    onClick={() => {
                      onChange(t.id);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    {t.name}
                  </button>
                ))
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/** Referral Source selection (Partners & Doctors) */
function ReferralSourceSelect({
  sources,
  value,
  onChange,
  loading,
}: {
  sources: {
    id: string;
    name: string;
    type: string;
    rawType: "doctor" | "partner";
  }[];
  value: string;
  onChange: (id: string, name: string, type: "doctor" | "partner" | "") => void;
  loading?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const filtered = q
    ? sources.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
    : sources;
  const selected = sources.find((s) => s.id === value);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 4;
    const listMaxHeight = 192;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const showAbove = spaceBelow < Math.min(listMaxHeight, 200);
    const top = showAbove ? rect.top - listMaxHeight - gap : rect.bottom + gap;

    setCoords({ top, left: rect.left, width: rect.width });
  }, []);

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    } else {
      setCoords(null);
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updatePosition();

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  return (
    <div ref={triggerRef} className="relative w-full">
      <div
        className="flex items-center w-full h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main cursor-text"
        onClick={() => setOpen(true)}
      >
        <IoSearchOutline className="mr-2 text-text-muted w-3.5 h-3.5" />
        <input
          autoComplete="off"
          className="flex-1 bg-transparent outline-none placeholder:text-text-muted/60"
          placeholder={loading ? "Loading..." : "Search source..."}
          type="text"
          value={selected && !open ? selected.name : q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button
            className="text-text-muted hover:text-text-main"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "", "");
              setQ("");
            }}
          >
            <IoCloseOutline className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-[100]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-1 z-[101] bg-surface border border-border-base rounded shadow-lg max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-text-muted">
                {q ? "No partners found" : "No referral partners registered"}
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  className={`w-full text-left px-3 py-2 hover:bg-primary/10 transition-colors ${p.id === value ? "bg-primary/10" : ""}`}
                  type="button"
                  onClick={() => {
                    onChange(p.id!, p.name, p.rawType);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <p className="text-[12.5px] text-text-main font-medium">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-text-muted capitalize">
                    {p.type}
                  </p>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Date conversion progress indicator */
function ConversionIndicator({
  converting,
  progress,
  message,
}: {
  converting: boolean;
  progress: number;
  message: string;
}) {
  if (!converting) return null;

  return (
    <div className="mt-1 p-2 bg-primary/10 border border-primary/20 rounded">
      <div className="flex items-center gap-1.5 mb-1">
        <Spinner size="xs" />
        <span className="text-[11px] text-primary font-medium">
          {message || "Converting…"}
        </span>
        <span className="ml-auto text-[10px] text-text-muted">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/** Section header strip */
function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 border-b border-border-base/50">
      <span className="text-primary">{icon}</span>
      <div>
        <h3 className="text-[13px] font-semibold text-text-main">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-text-muted">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ── Appointment status badge ──────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-health-500/10 text-health-600 border-health-500/20",
  cancelled: "bg-error/10 text-error border-error/20",
  "no-show": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "in-progress": "bg-surface-2 text-text-main border-border-base",
};

// ── ConversionProgress type ───────────────────────────────────────────────────
interface ConversionProgress {
  isConverting: boolean;
  progress: number;
  message: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════
const NewPatientPage: React.FC = () => {
  const navigate = useNavigate();
  const { clinicId, currentUser, userData, isLoading: authLoading } = useAuth();

  // ── Loading states
  const [loading, setLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [expertsLoading, setExpertsLoading] = useState(true);
  const [apptTypesLoading, setApptTypesLoading] = useState(true);
  const [generatingReg, setGeneratingReg] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // ── Reference data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>(
    [],
  );
  const [existingAppointments, setExistingAppointments] = useState<
    Appointment[]
  >([]);

  // ── Identity resolution
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);

  // ── Date conversion state
  const [dateConv, setDateConv] = useState({
    isConverting: false,
    progress: 0,
    message: "",
    field: "" as "dob" | "bsDate" | "appointmentDate" | "appointmentBS" | "",
    lastConversion: { source: "" as "api" | "local" | "", timestamp: 0 },
  });

  // ── Step
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 2;
  const formattedToday = new Date().toISOString().split("T")[0];

  // ── Patient profile form
  const [profile, setProfile] = useState({
    regNumber: "",
    name: "",
    address: "",
    mobile: "",
    email: "",
    gender: "",
    dob: "",
    bsDate: "",
    bloodGroup: "",
    age: "",
    referralPartnerId: "",
    referredBy: "",
    referralType: "" as "doctor" | "partner" | "",
    phone: "",
    occupation: "",
    careOf: "",
    relation: "",
    picture: null as File | null,
    doctor: "",
    expert: "",
    medicalConditions: [] as string[],
  });

  const referralSources = React.useMemo(() => {
    return [
      ...referralPartners.map((p) => ({
        id: p.id!,
        name: p.name,
        type: p.partnerType || "Partner",
        rawType: "partner" as const,
      })),
      ...doctors
        .filter((d) => !d.isDeleted)
        .map((d) => ({
          id: d.id,
          name: d.name,
          type: d.doctorType || "Doctor",
          rawType: "doctor" as const,
        })),
    ];
  }, [referralPartners, doctors]);

  // ── Appointment form
  const [appt, setAppt] = useState({
    registrationDate: formattedToday,
    appointmentDate: "",
    appointmentBS: "",
    startTime: "",
    endTime: "",
    doctor: "",
    appointmentType: "",
    reason: "",
  });

  // ── Medical conditions input
  const [conditionInput, setConditionInput] = useState("");

  // ── Debounced date conversion ─────────────────────────────────────────────
  const debouncedConvert = useCallback(
    debounce(
      async (value: string, field: string, type: "ad-to-bs" | "bs-to-ad") => {
        if (!value.trim()) {
          setDateConv((p) => ({
            ...p,
            isConverting: false,
            field: "",
            progress: 0,
            message: "",
          }));

          return;
        }

        setDateConv((p) => ({
          ...p,
          isConverting: true,
          field: field as any,
          progress: 0,
          message: "Starting…",
        }));

        try {
          const onProgress = (prog: ConversionProgress) =>
            setDateConv((p) => ({
              ...p,
              progress: prog.progress,
              message: prog.message,
              isConverting: prog.isConverting,
            }));

          if (type === "ad-to-bs") {
            const d = new Date(value);
            const v = validateADDate(d);

            if (!v.isValid) {
              setDateConv((p) => ({
                ...p,
                isConverting: false,
                field: "",
                message: v.error || "Invalid date",
              }));

              return;
            }
            const res = await adToBSApi(d, onProgress);

            if (field === "dob")
              setProfile((p) => ({
                ...p,
                bsDate: res.formatted,
                age: calcAge(value),
              }));
            else if (field === "appointmentDate")
              setAppt((p) => ({ ...p, appointmentBS: res.formatted }));
            setDateConv((p) => ({
              ...p,
              isConverting: false,
              field: "",
              progress: 100,
              message: "Done",
              lastConversion: { source: res.source, timestamp: Date.now() },
            }));
          } else {
            const v = validateBSDateFormat(value);

            if (!v.isValid) {
              setDateConv((p) => ({
                ...p,
                isConverting: false,
                field: "",
                message: v.error || "Invalid BS format",
              }));

              return;
            }
            const ad = await bsToADApi(value, onProgress);
            const formatted = formatDateWithoutTimezone(ad);

            if (field === "bsDate")
              setProfile((p) => ({
                ...p,
                dob: formatted,
                age: calcAge(formatted),
              }));
            else if (field === "appointmentBS")
              setAppt((p) => ({ ...p, appointmentDate: formatted }));
            setDateConv((p) => ({
              ...p,
              isConverting: false,
              field: "",
              progress: 100,
              message: "Done",
              lastConversion: { source: "api", timestamp: Date.now() },
            }));
          }
        } catch (err) {
          setDateConv((p) => ({
            ...p,
            isConverting: false,
            field: "",
            progress: 0,
            message: err instanceof Error ? err.message : "Failed",
          }));
          addToast({
            title: "Date Conversion Error",
            description:
              err instanceof Error ? err.message : "Please check format.",
            color: "danger",
          });
        }
      },
      500,
    ),
    [],
  );

  // ── Data loading effects ──────────────────────────────────────────────────
  useEffect(() => {
    if (!clinicId || authLoading || !userData) return;

    // Load doctors
    doctorService
      .getDoctors()
      .then((data) => {
        const active = data.filter((d) => d.isActive);

        setDoctors(active);
        if (userData.email) {
          const matched = active.find(
            (d) => d.email?.toLowerCase() === userData.email?.toLowerCase(),
          );

          if (matched) {
            setCurrentDoctorId(matched.id);
            setProfile((p) => ({ ...p, doctor: matched.id }));
            setAppt((p) => ({ ...p, doctor: matched.id }));
          }
        }
      })
      .catch(console.error)
      .finally(() => setDoctorsLoading(false));

    // Load experts
    expertService
      .getExperts()
      .then((data) => {
        const active = data.filter((e) => e.isActive);

        setExperts(active);
      })
      .catch(console.error)
      .finally(() => setExpertsLoading(false));

    // Load patients for existing appointment lookup
    patientService
      .getPatients()
      .then(setPatients)
      .catch(console.error);

    // Load appointment types
    appointmentTypeService
      .getActiveAppointmentTypes()
      .then(setAppointmentTypes)
      .catch(console.error)
      .finally(() => setApptTypesLoading(false));

    // Load referral partners
    referralPartnerService
      .getAllReferralPartners()
      .then(setReferralPartners)
      .catch(console.error);
  }, [clinicId, authLoading, userData]);

  useEffect(() => {
    if (!clinicId || authLoading) return;
    if (userData?.branchId) {
      setDefaultBranchId(userData.branchId);

      return;
    }
    branchService
      .isMultiBranchEnabled()
      .then((multi) =>
        multi
          ? branchService
            .getMainBranch()
            .then((b) => b && setDefaultBranchId(b.id))
          : setDefaultBranchId(clinicId),
      )
      .catch(() => setDefaultBranchId(clinicId));
  }, [clinicId, authLoading, userData?.branchId]);

  // Auto-generate reg number
  useEffect(() => {
    if (!clinicId) return;
    setGeneratingReg(true);
    patientService
      .getNextRegistrationNumber()
      .then((n) => setProfile((p) => ({ ...p, regNumber: n })))
      .catch(console.error)
      .finally(() => setGeneratingReg(false));
  }, [clinicId]);

  // Load existing appointments for date
  useEffect(() => {
    if (!appt.appointmentDate || !clinicId) {
      setExistingAppointments([]);

      return;
    }
    setLoadingAppointments(true);
    appointmentService
      .getAppointmentsByDate(
        new Date(appt.appointmentDate),
        undefined, // clinicId
        defaultBranchId || userData?.branchId,
      )
      .then(setExistingAppointments)
      .catch(console.error)
      .finally(() => setLoadingAppointments(false));
  }, [appt.appointmentDate, clinicId]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const calcAge = (dob: string): string => {
    if (!dob) return "";
    const b = new Date(dob);
    const t = new Date();

    let years = t.getFullYear() - b.getFullYear();
    let months = t.getMonth() - b.getMonth();
    let days = t.getDate() - b.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(t.getFullYear(), t.getMonth(), 0).getDate();
      days += prevMonth;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years > 0) return `${years} Year${years > 1 ? "s" : ""}`;
    if (months > 0) return `${months} Month${months > 1 ? "s" : ""}`;
    if (days > 0) return `${days} Day${days > 1 ? "s" : ""}`;
    return "0 Days";
  };

  const fmtTime = (t: string) => {
    if (!t) return "";
    try {
      const [h, m] = t.split(":");
      const d = new Date();

      d.setHours(+h, +m);

      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return t;
    }
  };

  const getPatientName = (id: string) => {
    const p = patients.find((x) => x.id === id);

    return p ? `${p.name} (${p.regNumber})` : "Unknown";
  };
  const getDoctorName = (id: string) => {
    const d = doctors.find((x) => x.id === id);

    return d ? `${d.name} — ${d.speciality}` : "Unknown";
  };
  const getApptTypeName = (id: string) => {
    const t = appointmentTypes.find((x) => x.id === id);

    return t?.name || "Unknown";
  };

  const generateReg = async () => {
    if (!clinicId) return;
    setGeneratingReg(true);
    try {
      const n = await patientService.getNextRegistrationNumber();

      setProfile((p) => ({ ...p, regNumber: n }));
      addToast({ title: `Reg# ${n} generated`, color: "success" });
    } catch {
      addToast({ title: "Error generating reg#", color: "danger" });
    } finally {
      setGeneratingReg(false);
    }
  };

  // ── Profile change handlers ───────────────────────────────────────────────
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let v = value;

    if (
      name === "mobile" &&
      v &&
      !v.startsWith("+977") &&
      v.length === 1 &&
      /^\d$/.test(v)
    )
      v = "+977" + v;

    setProfile((p) => ({ ...p, [name]: v }));
    if (name === "dob" && v) debouncedConvert(v, "dob", "ad-to-bs");
    else if (name === "bsDate" && v) debouncedConvert(v, "bsDate", "bs-to-ad");
  };

  const handleApptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setAppt((p) => ({ ...p, [name]: value }));
    if (name === "appointmentDate" && value)
      debouncedConvert(value, "appointmentDate", "ad-to-bs");
    else if (name === "appointmentBS" && value)
      debouncedConvert(value, "appointmentBS", "bs-to-ad");
  };

  const addCondition = () => {
    const c = conditionInput.trim();

    if (c && !profile.medicalConditions.includes(c)) {
      setProfile((p) => ({
        ...p,
        medicalConditions: [...p.medicalConditions, c],
      }));
      setConditionInput("");
    }
  };

  const removeCondition = (c: string) =>
    setProfile((p) => ({
      ...p,
      medicalConditions: p.medicalConditions.filter((x) => x !== c),
    }));

  // ── Step validation ───────────────────────────────────────────────────────
  const validateStep = () => {
    if (step === 1) {
      if (
        !profile.regNumber ||
        !profile.name ||
        !profile.address ||
        !profile.mobile
      ) {
        addToast({
          title: "Required fields missing",
          description: "Fill in: Reg#, Name, Address, Mobile",
          color: "warning",
        });

        return false;
      }
    } else {
      if (!appt.appointmentDate || !appt.doctor || !appt.appointmentType) {
        addToast({
          title: "Required fields missing",
          description:
            "Fill in: Appointment date, Doctor, and Appointment type",
          color: "warning",
        });

        return false;
      }
    }

    return true;
  };

  // ── Build patient payload (shared) ────────────────────────────────────────
  const buildPatientData = useCallback((): any => {
    const patientData: any = {
      regNumber: profile.regNumber,
      name: profile.name,
      address: profile.address,
      mobile: profile.mobile,
      email: profile.email || "",
      referredBy: profile.referredBy || "",
      phone: profile.phone || "",
      picture: "",
      doctorId: profile.doctor || "",
      assignedExpertId: profile.expert || "",
      medicalConditions: profile.medicalConditions,
      clinicId,
      branchId: defaultBranchId || clinicId,
      createdBy: currentUser?.uid || "",
    };

    if (profile.referralPartnerId && profile.referralType === "partner") {
      patientData.referralPartnerId = profile.referralPartnerId;
    } else if (profile.referralPartnerId && profile.referralType === "doctor") {
      // If needed, we can store referringDoctorId, but we'll adapt models
      patientData.referredBy = profile.referredBy;
    }

    if (profile.occupation) patientData.occupation = profile.occupation;
    if (profile.careOf) patientData.careOf = profile.careOf;
    if (profile.relation) patientData.relation = profile.relation;
    if (profile.gender)
      patientData.gender = profile.gender as "male" | "female" | "other";
    if (profile.dob) patientData.dob = new Date(profile.dob);
    if (profile.bloodGroup) patientData.bloodGroup = profile.bloodGroup as any;
    if (profile.age) patientData.age = parseInt(profile.age, 10);

    return patientData;
  }, [profile, clinicId, defaultBranchId, currentUser?.uid]);

  // ── Save patient only (no appointment) ─────────────────────────────────────
  const savePatientOnly = async () => {
    if (!validateStep()) return;
    if (!clinicId) {
      addToast({ title: "No clinic data", color: "danger" });

      return;
    }
    setLoading(true);
    try {
      // ── Uniqueness Checks ──────────────────────────────────────────────────
      const [mobileExists, emailExists] = await Promise.all([
        patientService.checkMobileExists(profile.mobile, clinicId),
        profile.email ? patientService.checkEmailExists(profile.email, clinicId) : Promise.resolve(false),
      ]);

      if (mobileExists) {
        addToast({
          title: "Duplicate Mobile",
          description: "A patient with this mobile number already exists.",
          color: "danger",
        });
        setLoading(false);
        return;
      }

      if (emailExists) {
        addToast({
          title: "Duplicate Email",
          description: "A patient with this email already exists.",
          color: "danger",
        });
        setLoading(false);
        return;
      }

      const patientId = await patientService.createPatient(buildPatientData());

      addToast({
        title: `Patient ${profile.name} registered`,
        description: `Reg# ${profile.regNumber}`,
        color: "success",
      });
      navigate(`/dashboard/patients/${patientId}`);
    } catch {
      addToast({ title: "Failed to create patient", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // ── Submit (patient + optional appointment, used on step 2) ────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < TOTAL_STEPS) return; // Step 1 uses explicit buttons only
    if (!clinicId) {
      addToast({ title: "No clinic data", color: "danger" });

      return;
    }
    setLoading(true);

    try {
      // ── Uniqueness Checks ──────────────────────────────────────────────────
      const [mobileExists, emailExists] = await Promise.all([
        patientService.checkMobileExists(profile.mobile, clinicId),
        profile.email ? patientService.checkEmailExists(profile.email, clinicId) : Promise.resolve(false),
      ]);

      if (mobileExists) {
        addToast({
          title: "Duplicate Mobile",
          description: "A patient with this mobile number already exists.",
          color: "danger",
        });
        setLoading(false);
        return;
      }

      if (emailExists) {
        addToast({
          title: "Duplicate Email",
          description: "A patient with this email already exists.",
          color: "danger",
        });
        setLoading(false);
        return;
      }

      const patientId = await patientService.createPatient(buildPatientData());

      // Handle Referral Commission
      if (profile.referralPartnerId && appt.appointmentType) {
        try {
          const selectedType = appointmentTypes.find(t => t.id === appt.appointmentType);
          if (selectedType) {
            const price = selectedType.price || 0;
            if (profile.referralType === "partner") {
              const partner = await referralPartnerService.getReferralPartnerById(profile.referralPartnerId);
              if (partner && partner.defaultCommission > 0) {
                const commissionAmount = (price * partner.defaultCommission) / 100;
                await referralCommissionService.createRegistrationCommission(
                  partner,
                  clinicId,
                  defaultBranchId || clinicId,
                  patientId,
                  profile.name,
                  selectedType.name,
                  price,
                  commissionAmount,
                  currentUser?.uid || ""
                );
              }
            } else if (profile.referralType === "doctor") {
              const doctor = await doctorService.getDoctorById(profile.referralPartnerId);
              if (doctor && doctor.defaultCommission > 0) {
                const commissionAmount = (price * doctor.defaultCommission) / 100;
                await doctorCommissionService.createRegistrationCommission(
                  doctor.id,
                  doctor.name,
                  clinicId,
                  defaultBranchId || clinicId,
                  patientId,
                  profile.name,
                  selectedType.name,
                  price,
                  commissionAmount,
                  doctor.defaultCommission,
                  currentUser?.uid || ""
                );
              }
            }
          }
        } catch (commError) {
          console.error("Error creating referral commission:", commError);
          // Don't block patient creation for commission errors
        }
      }

      if (appt.appointmentDate && appt.doctor && appt.appointmentType) {
        try {
          const apptData = {
            patientId,
            doctorId: appt.doctor,
            appointmentTypeId: appt.appointmentType,
            appointmentDate: new Date(appt.appointmentDate),
            startTime: appt.startTime || undefined,
            endTime: appt.endTime || undefined,
            status: "scheduled" as const,
            reason: appt.reason || "",
            clinicId,
            branchId: defaultBranchId || clinicId,
            createdBy: currentUser?.uid || "",
          };
          const apptId = await appointmentService.createAppointment(apptData);

          if (appt.startTime) {
            const reminderPayload = {
              id: apptId,
              appointmentDate: new Date(appt.appointmentDate),
              patientId,
              doctorId: appt.doctor,
              clinicId,
              branchId: defaultBranchId || clinicId,
              appointmentTypeId: appt.appointmentType,
              startTime: appt.startTime,
            };

            await Promise.allSettled([
              scheduleAppointmentReminder(reminderPayload),
              scheduleDoctorAppointmentReminder(reminderPayload),
            ]);
          }
          addToast({
            title: "Patient registered with appointment",
            color: "success",
          });
        } catch {
          addToast({
            title: "Patient saved, appointment failed",
            description: "You can schedule from the patient profile.",
            color: "warning",
          });
        }
      } else {
        addToast({
          title: `Patient ${profile.name} registered`,
          description: `Reg# ${profile.regNumber}`,
          color: "success",
        });
      }

      navigate(`/dashboard/patients/${patientId}`);
    } catch {
      addToast({ title: "Failed to create patient", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          className="p-1.5 rounded border border-border-base text-text-muted hover:text-primary hover:border-primary transition-colors"
          type="button"
          onClick={() => navigate(-1)}
        >
          <IoArrowBackOutline className="w-4 h-4" />
        </button>
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Add New Patient
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Register a new patient and optionally schedule their first
            appointment
          </p>
        </div>
      </div>

      {/* ── Step tracker ────────────────────────────────────────────────── */}
      <div className="flex items-center bg-surface border border-border-base rounded px-4 py-3">
        {[
          {
            n: 1,
            label: "Patient Profile",
            sub: "Demographics & medical info",
          },
          {
            n: 2,
            label: "Schedule Appointment",
            sub: "Optional first appointment",
          },
        ].map(({ n, label, sub }, i) => {
          const done = n < step;
          const active = n === step;

          return (
            <React.Fragment key={n}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 border-2 transition-colors
                  ${done
                      ? "bg-primary border-primary text-white"
                      : active
                        ? "bg-surface border-primary text-primary"
                        : "bg-surface border-border-base text-text-muted"
                    }`}
                >
                  {done ? <IoCheckmarkCircleOutline className="w-4 h-4" /> : n}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={`text-[12px] font-semibold ${active ? "text-primary" : done ? "text-primary" : "text-text-muted"}`}
                  >
                    {label}
                  </p>
                  <p className="text-[10.5px] text-text-muted">{sub}</p>
                </div>
              </div>
              {i < 1 && (
                <div
                  className={`flex-1 h-px mx-4 ${done ? "bg-primary/40" : "bg-border-base"}`}
                />
              )}
            </React.Fragment>
          );
        })}
        <p className="ml-auto text-[11px] text-text-muted hidden sm:block">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {/* ═══ STEP 1: Patient Profile ═══ */}
        {step === 1 && (
          <>
            {/* Patient Info Card */}
            <div className="bg-surface border border-border-base rounded overflow-hidden">
              <SectionHeader
                icon={<IoPersonOutline className="w-4 h-4" />}
                subtitle="Basic demographics and contact info"
                title="Patient Profile"
              />
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Reg Number */}
                <Field
                  required
                  hint="Auto-generated — edit if needed"
                  label="Registration Number"
                >
                  <div className="flex gap-1.5">
                    <FlatInput
                      className="flex-1"
                      disabled={generatingReg}
                      placeholder={generatingReg ? "Generating…" : "e.g. P-001"}
                      value={profile.regNumber}
                      onChange={(v) =>
                        setProfile((p) => ({ ...p, regNumber: v }))
                      }
                    />
                    <Button
                      color="primary"
                      isLoading={generatingReg}
                      size="sm"
                      startContent={
                        !generatingReg ? (
                          <IoRefreshOutline className="w-3.5 h-3.5" />
                        ) : undefined
                      }
                      type="button"
                      variant="bordered"
                      onClick={generateReg}
                    >
                      {generatingReg ? "" : "Regen"}
                    </Button>
                  </div>
                </Field>

                {/* Name */}
                <Field required label="Full Name">
                  <FlatInput
                    placeholder="Patient's full name"
                    value={profile.name}
                    onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
                  />
                </Field>

                {/* Address */}
                <Field required label="Address">
                  <FlatInput
                    placeholder="Home address"
                    value={profile.address}
                    onChange={(v) => setProfile((p) => ({ ...p, address: v }))}
                  />
                </Field>

                {/* Mobile */}
                <Field required hint="Format: +977XXXXXXXXXX" label="Mobile">
                  <FlatInput
                    placeholder="+977 98XXXXXXXX"
                    value={profile.mobile}
                    onChange={(v) =>
                      handleProfileChange({
                        target: { name: "mobile", value: v },
                      } as any)
                    }
                  />
                </Field>

                {/* Gender */}
                <Field label="Gender">
                  <FlatSelect
                    value={profile.gender}
                    onChange={(v) => setProfile((p) => ({ ...p, gender: v }))}
                  >
                    <option value="">Select gender (optional)</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </FlatSelect>
                </Field>

                {/* Email - Moved here for better flow */}
                <Field label="Email">
                  <FlatInput
                    placeholder="email@example.com"
                    type="email"
                    value={profile.email}
                    onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
                  />
                </Field>

                {/* DOB (AD) */}
                <Field hint="Auto-converts to BS" label="Date of Birth (AD)">
                  <FlatInput
                    disabled={dateConv.isConverting && dateConv.field === "dob"}
                    endContent={
                      dateConv.isConverting && dateConv.field === "dob" ? (
                        <Spinner size="xs" />
                      ) : undefined
                    }
                    type="date"
                    value={profile.dob}
                    onChange={(v) =>
                      handleProfileChange({
                        target: { name: "dob", value: v },
                      } as any)
                    }
                  />
                  <ConversionIndicator
                    converting={
                      dateConv.isConverting && dateConv.field === "dob"
                    }
                    message={dateConv.message}
                    progress={dateConv.progress}
                  />
                </Field>

                {/* BS Date */}
                <Field
                  hint="YYYY/MM/DD — auto-converts to AD"
                  label="Date of Birth (BS)"
                >
                  <FlatInput
                    disabled={
                      dateConv.isConverting && dateConv.field === "bsDate"
                    }
                    endContent={
                      dateConv.isConverting && dateConv.field === "bsDate" ? (
                        <Spinner size="xs" />
                      ) : profile.bsDate &&
                        dateConv.lastConversion.timestamp > 0 ? (
                        <CheckIcon className="w-3.5 h-3.5 text-health-600" />
                      ) : undefined
                    }
                    placeholder="2080/06/15"
                    value={profile.bsDate}
                    onChange={(v) =>
                      handleProfileChange({
                        target: { name: "bsDate", value: v },
                      } as any)
                    }
                  />
                  <ConversionIndicator
                    converting={
                      dateConv.isConverting && dateConv.field === "bsDate"
                    }
                    message={dateConv.message}
                    progress={dateConv.progress}
                  />
                </Field>

                {/* Blood Group */}
                <Field label="Blood Group">
                  <FlatSelect
                    value={profile.bloodGroup}
                    onChange={(v) =>
                      setProfile((p) => ({ ...p, bloodGroup: v }))
                    }
                  >
                    <option value="">Select (optional)</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ),
                    )}
                  </FlatSelect>
                </Field>

                {/* Age */}
                <Field
                  hint="Auto-calculated from DOB or enter manually"
                  label="Age"
                >
                  <FlatInput
                    placeholder="e.g. 35 or 2 Months"
                    type="text"
                    value={profile.age}
                    onChange={(v) => setProfile((p) => ({ ...p, age: v }))}
                  />
                </Field>

                {/* Referred By */}
                <Field label="Referred By">
                  <ReferralSourceSelect
                    sources={referralSources}
                    value={profile.referralPartnerId}
                    onChange={(id, name, type) => {
                      setProfile((p) => ({
                        ...p,
                        referralPartnerId: id,
                        referredBy: name,
                        referralType: type,
                      }));
                    }}
                  />
                </Field>

                {/* Phone */}
                <Field label="Secondary Phone">
                  <FlatInput
                    placeholder="Landline or alt number"
                    value={profile.phone}
                    onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
                  />
                </Field>

                {/* Picture upload */}
                <Field label="Patient Picture">
                  <label className="relative flex items-center h-9 border border-border-base rounded bg-surface cursor-pointer hover:border-primary transition-colors px-2.5 gap-2">
                    <input
                      accept="image/*"
                      className="sr-only"
                      type="file"
                      onChange={(e) =>
                        setProfile((p) => ({
                          ...p,
                          picture: e.target.files?.[0] || null,
                        }))
                      }
                    />
                    <IoPersonOutline className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-[12px] text-text-muted flex-1 truncate">
                      {profile.picture
                        ? profile.picture.name
                        : "Choose image file"}
                    </span>
                    <span className="text-[10px] bg-surface-2 text-text-main px-1.5 py-0.5 rounded shrink-0">
                      Browse
                    </span>
                  </label>
                </Field>

                {/* Doctor */}
                <Field
                  hint={
                    currentDoctorId
                      ? "Auto-selected from your account"
                      : "Doctor responsible for this patient"
                  }
                  label="Assigned Doctor"
                >
                  <DoctorSelect
                    doctors={doctors}
                    loading={doctorsLoading}
                    locked={!!currentDoctorId}
                    placeholder="Search doctor..."
                    title="Doctors"
                    value={profile.doctor}
                    onChange={(v) => {
                      setProfile((p) => ({ ...p, doctor: v }));
                    }}
                  />
                </Field>

                {/* Assigned Expert */}
                <Field
                  hint="Expert responsible for this patient"
                  label="Assigned Expert"
                >
                  <DoctorSelect
                    doctors={experts as any}
                    loading={expertsLoading}
                    placeholder="Search expert..."
                    title="Experts"
                    value={profile.expert}
                    onChange={(v) => {
                      setProfile((p) => ({ ...p, expert: v }));
                    }}
                  />
                </Field>
              </div>
            </div>

            {/* Additional Info Card */}
            <div className="bg-surface border border-border-base rounded overflow-hidden">
              <SectionHeader
                icon={<IoPersonOutline className="w-4 h-4" />}
                subtitle="Optional demographic details"
                title="Additional Information"
              />
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Occupation">
                  <FlatInput
                    placeholder="e.g. Teacher"
                    value={profile.occupation}
                    onChange={(v) =>
                      setProfile((p) => ({ ...p, occupation: v }))
                    }
                  />
                </Field>
                <Field label="Care Of (C/O)">
                  <FlatInput
                    placeholder="Guardian/parent name"
                    value={profile.careOf}
                    onChange={(v) => setProfile((p) => ({ ...p, careOf: v }))}
                  />
                </Field>
                <Field label="Relation">
                  <FlatInput
                    placeholder="e.g. Father, Spouse"
                    value={profile.relation}
                    onChange={(v) => setProfile((p) => ({ ...p, relation: v }))}
                  />
                </Field>
              </div>
            </div>

            {/* Medical Conditions Card */}
            <div className="bg-surface border border-border-base rounded overflow-hidden">
              <SectionHeader
                icon={<IoPersonOutline className="w-4 h-4" />}
                subtitle="Pre-existing conditions and allergies"
                title="Medical Conditions"
              />
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    className="flex-1 h-8 px-2.5 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted/60"
                    placeholder="Type condition and press Enter or Add…"
                    type="text"
                    value={conditionInput}
                    onChange={(e) => setConditionInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addCondition())
                    }
                  />
                  <Button
                    color="primary"
                    disabled={!conditionInput.trim()}
                    size="sm"
                    type="button"
                    onClick={addCondition}
                  >
                    Add
                  </Button>
                </div>
                {profile.medicalConditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.medicalConditions.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 text-[11px] bg-surface-2 text-text-main border border-border-base px-2 py-0.5 rounded"
                      >
                        {c}
                        <button
                          className="hover:text-red-500 ml-0.5"
                          type="button"
                          onClick={() => removeCondition(c)}
                        >
                          <IoCloseOutline className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══ STEP 2: Schedule Appointment ═══ */}
        {step === 2 && (
          <>
            <div className="bg-surface border border-border-base rounded overflow-hidden">
              <SectionHeader
                icon={<IoCalendarOutline className="w-4 h-4" />}
                subtitle="Optional — can be added later from the patient's profile"
                title="Schedule Appointment"
              />
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Registration date (readonly) */}
                <Field label="Registration Date">
                  <FlatInput
                    disabled
                    type="date"
                    value={appt.registrationDate}
                    onChange={() => { }}
                  />
                </Field>

                {/* Appointment Date (AD) */}
                <Field
                  required
                  hint="Auto-converts to BS"
                  label="Appointment Date (AD)"
                >
                  <FlatInput
                    disabled={
                      dateConv.isConverting &&
                      dateConv.field === "appointmentDate"
                    }
                    endContent={
                      dateConv.isConverting &&
                        dateConv.field === "appointmentDate" ? (
                        <Spinner size="xs" />
                      ) : undefined
                    }
                    type="date"
                    value={appt.appointmentDate}
                    onChange={(v) =>
                      handleApptChange({
                        target: { name: "appointmentDate", value: v },
                      } as any)
                    }
                  />
                  <ConversionIndicator
                    converting={
                      dateConv.isConverting &&
                      dateConv.field === "appointmentDate"
                    }
                    message={dateConv.message}
                    progress={dateConv.progress}
                  />
                </Field>

                {/* Appointment BS */}
                <Field hint="YYYY/MM/DD" label="Appointment Date (BS)">
                  <FlatInput
                    disabled={
                      dateConv.isConverting &&
                      dateConv.field === "appointmentBS"
                    }
                    endContent={
                      dateConv.isConverting &&
                        dateConv.field === "appointmentBS" ? (
                        <Spinner size="xs" />
                      ) : appt.appointmentBS &&
                        dateConv.lastConversion.timestamp > 0 ? (
                        <CheckIcon className="w-3.5 h-3.5 text-health-600" />
                      ) : undefined
                    }
                    placeholder="2080/06/15"
                    value={appt.appointmentBS}
                    onChange={(v) =>
                      handleApptChange({
                        target: { name: "appointmentBS", value: v },
                      } as any)
                    }
                  />
                  <ConversionIndicator
                    converting={
                      dateConv.isConverting &&
                      dateConv.field === "appointmentBS"
                    }
                    message={dateConv.message}
                    progress={dateConv.progress}
                  />
                </Field>

                {/* Start time */}
                <Field label="Start Time">
                  <FlatInput
                    type="time"
                    value={appt.startTime}
                    onChange={(v) => setAppt((p) => ({ ...p, startTime: v }))}
                  />
                </Field>

                {/* End time */}
                <Field label="End Time">
                  <FlatInput
                    type="time"
                    value={appt.endTime}
                    onChange={(v) => setAppt((p) => ({ ...p, endTime: v }))}
                  />
                </Field>

                {/* Doctor */}
                <Field
                  required
                  hint={currentDoctorId ? "Auto-selected" : ""}
                  label="Doctor"
                >
                  <DoctorSelect
                    doctors={doctors}
                    loading={doctorsLoading}
                    locked={!!currentDoctorId}
                    value={appt.doctor}
                    onChange={(v) => {
                      setAppt((p) => ({ ...p, doctor: v }));
                      setProfile((p) => ({ ...p, doctor: v }));
                    }}
                  />
                </Field>

                {/* Appointment type */}
                <Field required label="Appointment Type">
                  <AppointmentTypeSelect
                    loading={apptTypesLoading}
                    types={appointmentTypes}
                    value={appt.appointmentType}
                    onChange={(v) =>
                      setAppt((p) => ({ ...p, appointmentType: v }))
                    }
                  />
                </Field>

                {/* Reason */}
                <Field hint="Brief description" label="Reason for Visit">
                  <FlatInput
                    className="sm:col-span-2"
                    placeholder="e.g. Follow-up, consultation…"
                    value={appt.reason}
                    onChange={(v) => setAppt((p) => ({ ...p, reason: v }))}
                  />
                </Field>
              </div>
            </div>

            {/* Existing appointments for selected date */}
            {appt.appointmentDate && (
              <div className="bg-surface border border-border-base rounded overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2 border-b border-border-base/50">
                  <div>
                    <h3 className="text-[13px] font-semibold text-text-main">
                      Existing Appointments
                    </h3>
                    <p className="text-[11px] text-text-muted">
                      {new Date(appt.appointmentDate).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </p>
                  </div>
                  {loadingAppointments && <Spinner size="xs" />}
                </div>

                {loadingAppointments ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner label="Loading…" size="sm" />
                  </div>
                ) : existingAppointments.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-text-muted">
                    No appointments on this date
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-surface-2 border-b border-border-base/50">
                          {[
                            "Patient",
                            "Doctor",
                            "Time",
                            "Type",
                            "Reason",
                            "Status",
                          ].map((h) => (
                            <th
                              key={h}
                              className="py-2 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-default-100">
                        {existingAppointments.map((a) => (
                          <tr key={a.id} className="hover:bg-surface-2/50">
                            <td className="py-2 px-3 text-[12px] text-text-main">
                              {getPatientName(a.patientId)}
                            </td>
                            <td className="py-2 px-3 text-[12px] text-text-muted">
                              {getDoctorName(a.doctorId)}
                            </td>
                            <td className="py-2 px-3 text-[12px] text-text-muted whitespace-nowrap">
                              {a.startTime && a.endTime
                                ? `${fmtTime(a.startTime)} – ${fmtTime(a.endTime)}`
                                : a.startTime
                                  ? fmtTime(a.startTime)
                                  : "—"}
                            </td>
                            <td className="py-2 px-3 text-[12px] text-text-muted">
                              {getApptTypeName(a.appointmentTypeId)}
                            </td>
                            <td className="py-2 px-3 text-[12px] text-text-muted max-w-[150px] truncate">
                              {a.reason || "—"}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_BADGE[a.status?.toLowerCase()] || "bg-surface-2 text-text-main border-border-base"}`}
                              >
                                {a.status || "unknown"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Nav buttons ──────────────────────────────────────────────── */}
        <Divider />
        <div className="flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button
                color="default"
                size="sm"
                startContent={<IoChevronBackOutline className="w-3.5 h-3.5" />}
                type="button"
                variant="bordered"
                onClick={() => setStep((s) => s - 1)}
              >
                Previous
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              color="danger"
              size="sm"
              type="button"
              variant="bordered"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>

            {step === 1 ? (
              <>
                <Button
                  color="primary"
                  isLoading={loading}
                  size="sm"
                  startContent={<IoSaveOutline className="w-3.5 h-3.5" />}
                  type="button"
                  onClick={savePatientOnly}
                >
                  Save Patient
                </Button>
                <Button
                  color="primary"
                  endContent={<IoCalendarOutline className="w-3.5 h-3.5" />}
                  size="sm"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (validateStep()) setStep(2);
                  }}
                >
                  Save Patient & Create Appointment
                </Button>
              </>
            ) : (
              <Button
                color="primary"
                isLoading={loading}
                size="sm"
                startContent={
                  !loading ? (
                    <IoSaveOutline className="w-3.5 h-3.5" />
                  ) : undefined
                }
                type="submit"
              >
                {loading ? "Saving…" : "Save Patient"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default NewPatientPage;
