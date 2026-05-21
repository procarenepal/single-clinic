import React, { useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoSaveOutline,
  IoPersonOutline,
  IoMedicalOutline,
  IoAddOutline,
  IoWarningOutline,
  IoCloseOutline,
} from "react-icons/io5";
import { useCallback } from "react";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { referralPartnerService } from "@/services/referralPartnerService";
import { expertService } from "@/services/expertService";
import { Patient, Doctor, ReferralPartner, Expert } from "@/types/models";
import { addToast } from "@/components/ui/toast";
import {
  adToBSApi,
  bsToADApi,
  validateADDate,
  validateBSDateFormat,
  debounce,
} from "@/utils/dateConverterApi";

// ── Custom UI Helpers ────────────────────────────────────────────────────────
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
  readOnly,
  className,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full relative ${className || ""}`}>
      {label && (
        <label className="text-[13px] font-medium text-foreground-700">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border border-default-200 rounded min-h-[38px] bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 ${disabled || readOnly ? "bg-default-50" : ""}`}
      >
        {type === "textarea" ? (
          <textarea
            className="flex-1 w-full text-[13.5px] px-3 py-2 bg-transparent outline-none text-foreground placeholder:text-foreground-400 disabled:text-foreground-500 min-h-[80px]"
            disabled={disabled}
            name={name}
            placeholder={placeholder}
            readOnly={readOnly}
            required={required}
            value={value}
            onChange={onChange}
          />
        ) : (
          <input
            className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-foreground placeholder:text-foreground-400 disabled:text-foreground-500"
            disabled={disabled}
            name={name}
            placeholder={placeholder}
            readOnly={readOnly}
            required={required}
            type={type}
            value={value}
            onChange={onChange}
          />
        )}
      </div>
      {description && (
        <p className="text-[11.5px] text-foreground-500">{description}</p>
      )}
    </div>
  );
}

function CustomSelect({
  label,
  name,
  value,
  onChange,
  options,
  disabled,
  required,
  description,
}: any) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-[13px] font-medium text-foreground-700">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <select
        className="h-[38px] bg-background border border-default-200 text-foreground text-[13.5px] rounded px-3 py-1 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-shadow disabled:bg-default-50 disabled:text-foreground-500"
        disabled={disabled}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
      >
        <option disabled hidden value="">
          Select an option
        </option>
        {options.map((opt: any) => (
          <option
            key={opt.value}
            className="bg-content1 text-foreground"
            value={opt.value}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {description && (
        <p className="text-[11.5px] text-foreground-500">{description}</p>
      )}
    </div>
  );
}

/** Referral Source selection for Edit Page */
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
    rawType: "doctor" | "partner" | "expert";
  }[];
  value: string;
  onChange: (
    id: string,
    name: string,
    type: "doctor" | "partner" | "expert" | "",
  ) => void;
  loading?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
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
    <div className="flex flex-col gap-1.5 w-full relative">
      <label className="text-[13px] font-medium text-foreground-700">
        Referred By
      </label>
      <div
        ref={triggerRef}
        className="flex items-center border border-default-200 rounded h-[38px] bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 px-3 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <input
          autoComplete="off"
          className="flex-1 bg-transparent outline-none text-[13.5px] text-foreground placeholder:text-foreground-400"
          placeholder={loading ? "Loading sources..." : "Search source..."}
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
            className="text-foreground-400 hover:text-foreground-700 ml-1"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "", "");
              setQ("");
            }}
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
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
              className="z-[9999] bg-content1 border border-default-200 rounded shadow-lg max-h-48 overflow-y-auto min-w-[200px]"
              style={{
                position: "fixed",
                top: coords ? coords.top : -9999,
                left: coords ? coords.left : -9999,
                width: coords ? coords.width : undefined,
              }}
            >
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-[12.5px] text-foreground-400">
                  No sources found
                </p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    className={`w-full text-left px-3 py-2 hover:bg-primary/10 flex flex-col items-start ${p.id === value ? "bg-primary/10" : ""}`}
                    type="button"
                    onClick={() => {
                      onChange(p.id!, p.name, p.rawType);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="flex flex-col">
                        <span className="text-[13.5px] text-foreground font-medium">
                          {p.name}
                        </span>
                        <span className="text-[11px] text-foreground-400 capitalize">
                          {p.type}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          p.rawType === "doctor"
                            ? "bg-blue-50 text-blue-600 border border-blue-100"
                            : p.rawType === "expert"
                              ? "bg-purple-50 text-purple-600 border border-purple-100"
                              : "bg-orange-50 text-orange-600 border border-orange-100"
                        }`}
                      >
                        {p.rawType}
                      </span>
                    </div>
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

// ── Main Component ──────────────────────────────────────────────────────────
export default function PatientEditPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser, userData } = useAuthContext();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>(
    [],
  );
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [expertsLoading, setExpertsLoading] = useState(true);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertingDate, setConvertingDate] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
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
    referralType: "" as "doctor" | "partner" | "expert" | "",
    phone: "",
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
      ...experts
        .filter((e) => !e.isDeleted)
        .map((e) => ({
          id: e.id,
          name: e.name,
          type: e.expertType || "Expert",
          rawType: "expert" as const,
        })),
    ];
  }, [referralPartners, doctors, experts]);

  // State for medical conditions input
  const [medicalConditionInput, setMedicalConditionInput] = useState("");

  // Load patient data and doctors
  useEffect(() => {
    if (patientId && clinicId) {
      loadPatientData();
      loadDoctors();
      loadExperts();
      loadPartners();
    } else if (patientId && !clinicId) {
      addToast({
        title: "Error",
        description: "Clinic ID missing. Please log in again.",
        color: "danger",
      });
      navigate("/dashboard/patients");
    }
  }, [patientId, clinicId]);

  const loadPatientData = async () => {
    if (!patientId || !clinicId) return;
    try {
      setLoading(true);
      const patientData = await patientService.getPatientById(patientId);

      if (!patientData || patientData.clinicId !== clinicId) {
        addToast({
          title: "Error",
          description: "Patient not found.",
          color: "danger",
        });
        navigate("/dashboard/patients");

        return;
      }

      // Authorization Check: Doctors should only edit patients assigned to them
      const isAdmin =
        userData?.role === "clinic-admin" || userData?.role === "system-owner";

      if (!isAdmin && userData?.email) {
        try {
          const docInfo = await doctorService.getDoctorByEmail(userData.email);

          if (docInfo && patientData.doctorId !== docInfo.id) {
            addToast({
              title: "Access Denied",
              description:
                "You are only authorized to edit patients assigned to you.",
              color: "danger",
            });
            navigate("/dashboard/patients");

            return;
          }
        } catch (e) {
          console.error("Linkage check failed:", e);
        }
      }

      setPatient(patientData);

      const dobStr =
        patientData.dob instanceof Date && !isNaN(patientData.dob.getTime())
          ? patientData.dob.toISOString().split("T")[0]
          : "";

      let bsDateStr = "";

      if (patientData.bsDate) {
        if (typeof patientData.bsDate === "string") {
          bsDateStr = patientData.bsDate;
        } else if (
          patientData.bsDate instanceof Date &&
          !isNaN(patientData.bsDate.getTime())
        ) {
          bsDateStr = patientData.bsDate
            .toISOString()
            .split("T")[0]
            .replace(/-/g, "/");
        } else if (typeof (patientData.bsDate as any).toDate === "function") {
          // Handle Firestore Timestamp
          const d = (patientData.bsDate as any).toDate();

          if (!isNaN(d.getTime())) {
            bsDateStr = d.toISOString().split("T")[0].replace(/-/g, "/");
          }
        }
      }

      setFormData({
        regNumber: patientData.regNumber,
        name: patientData.name,
        address: patientData.address,
        mobile: patientData.mobile,
        email: patientData.email || "",
        gender: patientData.gender || "",
        dob: dobStr,
        bsDate: bsDateStr,
        bloodGroup: patientData.bloodGroup || "",
        age: patientData.dob
          ? calculateAge(dobStr)
          : patientData.age?.toString() || "",
        referralPartnerId: patientData.referralPartnerId || "",
        referredBy: patientData.referredBy || "",
        referralType: patientData.referralPartnerId
          ? "partner"
          : patientData.referredBy &&
              doctors.some((d) => d.name === patientData.referredBy)
            ? "doctor"
            : patientData.referredBy &&
                experts.some((e) => e.name === patientData.referredBy)
              ? "expert"
              : "",
        phone: patientData.phone || "",
        doctor: patientData.doctorId || "",
        expert: patientData.assignedExpertId || "",
        medicalConditions: patientData.medicalConditions || [],
      });

      // Trigger conversion if one is missing
      if (dobStr && !bsDateStr) {
        debouncedConvert(dobStr, "dob", "ad-to-bs");
      } else if (!dobStr && bsDateStr) {
        debouncedConvert(bsDateStr, "bsDate", "bs-to-ad");
      }
    } catch (error) {
      console.error("Error loading patient data:", error);
      addToast({
        title: "Error",
        description: "Failed to load patient data.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    if (!clinicId) return;
    try {
      setDoctorsLoading(true);
      const doctorsData = await doctorService.getDoctorsByClinic(clinicId);

      setDoctors(doctorsData.filter((doctor) => doctor.isActive));
    } catch (error) {
      console.error("Error loading doctors:", error);
      addToast({
        title: "Error",
        description: "Failed to load doctors.",
        color: "danger",
      });
    } finally {
      setDoctorsLoading(false);
    }
  };

  const loadExperts = async () => {
    if (!clinicId) return;
    try {
      setExpertsLoading(true);
      const expertsData = await expertService.getExpertsByClinic(clinicId);

      setExperts(expertsData.filter((e) => e.isActive));
    } catch (error) {
      console.error("Error loading experts:", error);
    } finally {
      setExpertsLoading(false);
    }
  };

  // Resolve referral type once sources are loaded
  useEffect(() => {
    if (patient && doctors.length > 0 && experts.length > 0) {
      setFormData((prev) => {
        if (prev.referralType) return prev; // Already resolved or changed by user

        let type: "doctor" | "partner" | "expert" | "" = "";

        if (patient.referralPartnerId) {
          type = "partner";
        } else if (patient.referredBy) {
          if (doctors.some((d) => d.name === patient.referredBy)) {
            type = "doctor";
          } else if (experts.some((e) => e.name === patient.referredBy)) {
            type = "expert";
          }
        }

        return { ...prev, referralType: type };
      });
    }
  }, [patient, doctors, experts]);

  const loadPartners = async () => {
    if (!clinicId) return;
    try {
      setPartnersLoading(true);
      const partnersData =
        await referralPartnerService.getReferralPartnersByClinic(clinicId);

      setReferralPartners(partnersData);
    } catch (error) {
      console.error("Error loading partners:", error);
    } finally {
      setPartnersLoading(false);
    }
  };

  const calculateAge = (dateOfBirth: string): string => {
    if (!dateOfBirth) return "";
    const b = new Date(dateOfBirth);
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

  const debouncedConvert = useCallback(
    debounce(
      async (
        value: string,
        field: "dob" | "bsDate",
        type: "ad-to-bs" | "bs-to-ad",
      ) => {
        if (!value.trim()) return;
        setConvertingDate(true);
        try {
          if (type === "ad-to-bs") {
            const d = new Date(value);
            const v = validateADDate(d);

            if (!v.isValid) return;
            const res = await adToBSApi(d);

            setFormData((prev) => ({ ...prev, bsDate: res.formatted }));
          } else {
            const v = validateBSDateFormat(value);

            if (!v.isValid) return;
            const res = await bsToADApi(value);
            const dobStr = res.toISOString().split("T")[0];

            setFormData((prev) => ({
              ...prev,
              dob: dobStr,
              age: calculateAge(dobStr),
            }));
          }
        } catch (error) {
          console.error("Error converting date:", error);
        } finally {
          setConvertingDate(false);
        }
      },
      500,
    ),
    [],
  );

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    let updatedFormData = { ...formData, [name]: value };

    if (name === "mobile" && value) {
      if (!value.startsWith("+977") && value.length === 1 && /^\d$/.test(value))
        updatedFormData.mobile = `+977${value}`;
      else if (value.startsWith("+977")) updatedFormData.mobile = value;
      else if (
        formData.mobile.startsWith("+977") &&
        value.length > formData.mobile.length
      )
        updatedFormData.mobile = value;
      else if (formData.mobile.startsWith("+977") && value.length < 4)
        updatedFormData.mobile = "+977";
      else updatedFormData.mobile = value;
    }

    if (name === "dob" && value) {
      const age = calculateAge(value);

      updatedFormData.age = age;
      debouncedConvert(value, "dob", "ad-to-bs");
    } else if (name === "bsDate" && value) {
      debouncedConvert(value, "bsDate", "bs-to-ad");
    }
    setFormData(updatedFormData);
  };

  const handleAddMedicalCondition = () => {
    const condition = medicalConditionInput.trim();

    if (condition && !formData.medicalConditions.includes(condition)) {
      setFormData((prev) => ({
        ...prev,
        medicalConditions: [...prev.medicalConditions, condition],
      }));
      setMedicalConditionInput("");
    }
  };

  const handleRemoveMedicalCondition = (conditionToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      medicalConditions: prev.medicalConditions.filter(
        (c) => c !== conditionToRemove,
      ),
    }));
  };

  const handleMedicalConditionKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMedicalCondition();
    }
  };

  const validateForm = (): boolean => {
    if (
      !formData.regNumber ||
      !formData.name ||
      !formData.address ||
      !formData.mobile
    ) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        color: "warning",
      });

      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (!patientId || !clinicId || !currentUser) {
        addToast({
          title: "Error",
          description: "Missing required information.",
          color: "danger",
        });

        return;
      }

      // ── Uniqueness Checks ──────────────────────────────────────────────────
      const [mobileExists, emailExists] = await Promise.all([
        patientService.checkMobileExists(formData.mobile, clinicId, patientId),
        formData.email
          ? patientService.checkEmailExists(formData.email, clinicId, patientId)
          : Promise.resolve(false),
      ]);

      if (mobileExists) {
        addToast({
          title: "Duplicate Mobile",
          description:
            "Another patient with this mobile number already exists.",
          color: "danger",
        });
        setSaving(false);

        return;
      }

      if (emailExists) {
        addToast({
          title: "Duplicate Email",
          description: "Another patient with this email already exists.",
          color: "danger",
        });
        setSaving(false);

        return;
      }

      const updatedPatientData: any = {
        regNumber: formData.regNumber,
        name: formData.name,
        address: formData.address,
        mobile: formData.mobile,
        email: formData.email || "",
        referredBy: formData.referredBy || "",
        phone: formData.phone || "",
        doctorId: formData.doctor || "",
        assignedExpertId: formData.expert || "",
        medicalConditions: formData.medicalConditions,
      };

      if (
        formData.referralPartnerId &&
        (formData.referralType === "partner" ||
          formData.referralType === "expert" ||
          formData.referralType === "doctor")
      ) {
        // If it's a doctor or expert from our system, we might still store their ID in referralPartnerId
        // but the current model seems to use referralPartnerId mostly for 'partner' type.
        // Let's check how it's handled in create.
        if (formData.referralType === "partner") {
          updatedPatientData.referralPartnerId = formData.referralPartnerId;
        } else {
          // For doctors/experts, we might just store the name in referredBy (which is already set above)
          // but if we want to track the ID, we might need a separate field or reuse referralPartnerId
          // The current creation logic in new-patient.tsx only sets referralPartnerId for 'partner' type.
          updatedPatientData.referralPartnerId = null;
        }
      } else {
        updatedPatientData.referralPartnerId = null;
      }

      if (formData.gender) updatedPatientData.gender = formData.gender;
      if (formData.bloodGroup)
        updatedPatientData.bloodGroup = formData.bloodGroup;
      if (formData.dob) updatedPatientData.dob = new Date(formData.dob);
      if (formData.bsDate) updatedPatientData.bsDate = formData.bsDate; // Store as string
      if (formData.dob && formData.age) updatedPatientData.age = formData.age;

      await patientService.updatePatient(patientId, updatedPatientData);
      addToast({
        title: "Success",
        description: "Patient information updated successfully.",
        color: "success",
      });
      navigate(`/dashboard/patients/${patientId}`);
    } catch (error) {
      console.error("Error updating patient:", error);
      addToast({
        title: "Error",
        description: "Failed to update patient.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Edit Patient
          </h1>
        </div>
        <div className="bg-content1 border border-default-200 rounded p-12 flex items-center justify-center shadow-sm">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="bg-content1 border border-default-200 rounded p-12 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center mx-auto mb-4 border border-danger-200">
          <IoWarningOutline className="w-6 h-6 text-danger" />
        </div>
        <h3 className="text-[15px] font-semibold text-foreground mb-1">
          Patient Not Found
        </h3>
        <p className="text-[13.5px] text-foreground-500 mb-6">
          The patient you're looking for could not be found or doesn't belong to
          this clinic.
        </p>
        <Button color="primary" onClick={() => navigate("/dashboard/patients")}>
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            startContent={<IoArrowBackOutline />}
            variant="bordered"
            onClick={() => navigate(`/dashboard/patients/${patientId}`)}
          >
            Back
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Edit Patient
            </h1>
            <p className="text-[13.5px] text-foreground-500 mt-1">
              Update patient information
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="bordered"
            onClick={() => navigate(`/dashboard/patients/${patientId}`)}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={saving}
            isLoading={saving}
            startContent={<IoSaveOutline />}
            onClick={handleSubmit}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Patient Profile Section */}
        <div className="bg-content1 border border-default-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-default-100 bg-default-50/50 flex items-center gap-3">
            <div className="p-1.5 bg-background rounded border border-default-200 shadow-sm">
              <IoPersonOutline className="text-primary text-lg" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-foreground leading-none mb-1">
                Patient Information
              </h3>
              <p className="text-[12.5px] text-foreground-500">
                Basic patient details and contact information
              </p>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CustomInput
                disabled
                readOnly
                required
                description="Registration number cannot be changed"
                label="Registration Number"
                name="regNumber"
                value={formData.regNumber}
                onChange={handleFormChange}
              />
              <CustomInput
                required
                label="Full Name"
                name="name"
                placeholder="Enter patient's full name"
                value={formData.name}
                onChange={handleFormChange}
              />
              <CustomInput
                required
                description="Include country code (e.g., +977)"
                label="Mobile Number"
                name="mobile"
                placeholder="Enter mobile number"
                value={formData.mobile}
                onChange={handleFormChange}
              />
              <CustomInput
                label="Email Address"
                name="email"
                placeholder="Enter email address"
                type="email"
                value={formData.email}
                onChange={handleFormChange}
              />
              <CustomInput
                label="Phone Number"
                name="phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={handleFormChange}
              />
              <CustomSelect
                label="Gender"
                name="gender"
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
                value={formData.gender}
                onChange={handleFormChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              <CustomInput
                disabled={convertingDate}
                label="Date of Birth (AD)"
                name="dob"
                type="date"
                value={formData.dob}
                onChange={handleFormChange}
              />
              <CustomInput
                description="Optional Bikram Sambat date"
                disabled={convertingDate}
                label="Date of Birth (BS)"
                name="bsDate"
                placeholder="YYYY/MM/DD"
                type="text"
                value={formData.bsDate}
                onChange={handleFormChange}
              />
              <CustomInput
                readOnly
                description="Auto-calculated from DOB"
                label="Age"
                name="age"
                type="text"
                value={formData.age}
                onChange={handleFormChange}
              />
              <CustomSelect
                label="Blood Group"
                name="bloodGroup"
                options={[
                  { value: "A+", label: "A+" },
                  { value: "A-", label: "A-" },
                  { value: "B+", label: "B+" },
                  { value: "B-", label: "B-" },
                  { value: "AB+", label: "AB+" },
                  { value: "AB-", label: "AB-" },
                  { value: "O+", label: "O+" },
                  { value: "O-", label: "O-" },
                ]}
                value={formData.bloodGroup}
                onChange={handleFormChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <CustomInput
                required
                label="Address"
                name="address"
                placeholder="Enter patient's address"
                type="textarea"
                value={formData.address}
                onChange={handleFormChange}
              />
              <div className="flex flex-col gap-6">
                <ReferralSourceSelect
                  loading={partnersLoading || doctorsLoading}
                  sources={referralSources}
                  value={formData.referralPartnerId}
                  onChange={(id, name, type) =>
                    setFormData((prev) => ({
                      ...prev,
                      referralPartnerId: id,
                      referredBy: name,
                      referralType: type,
                    }))
                  }
                />
                <CustomSelect
                  disabled={doctorsLoading}
                  label="Assigned Doctor"
                  name="doctor"
                  options={doctors.map((d) => ({
                    value: d.id,
                    label: `${d.name} - ${d.speciality}`,
                  }))}
                  value={formData.doctor}
                  onChange={handleFormChange}
                />
                <CustomSelect
                  disabled={expertsLoading}
                  label="Assigned Expert"
                  name="expert"
                  options={experts.map((e) => ({
                    value: e.id,
                    label: `${e.name} - ${e.speciality || "Expert"}`,
                  }))}
                  value={formData.expert}
                  onChange={handleFormChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Medical Information Section */}
        <div className="bg-content1 border border-default-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-default-100 bg-default-50/50 flex items-center gap-3">
            <div className="p-1.5 bg-background rounded border border-default-200 shadow-sm">
              <IoMedicalOutline className="text-primary text-lg" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-foreground leading-none mb-1">
                Medical & Referral Info
              </h3>
              <p className="text-[12.5px] text-foreground-500">
                Health history and tracking details
              </p>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Medical Conditions */}
              <div className="flex flex-col gap-4">
                <label className="text-[13px] font-medium text-foreground-700">
                  Medical Conditions
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center border border-default-200 rounded bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <input
                      className="flex-1 px-3 py-2 bg-transparent outline-none text-[13.5px] text-foreground placeholder:text-foreground-400"
                      placeholder="Add condition (e.g. Diabetes)"
                      type="text"
                      value={medicalConditionInput}
                      onChange={(e) => setMedicalConditionInput(e.target.value)}
                      onKeyPress={handleMedicalConditionKeyPress}
                    />
                  </div>
                  <Button
                    isIconOnly
                    color="primary"
                    variant="flat"
                    onClick={handleAddMedicalCondition}
                  >
                    <IoAddOutline className="text-xl" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mt-1">
                  {formData.medicalConditions.length === 0 ? (
                    <p className="text-[12.5px] text-foreground-400 italic py-2">
                      No medical conditions recorded
                    </p>
                  ) : (
                    formData.medicalConditions.map((condition) => (
                      <div
                        key={condition}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-50 border border-primary-100 rounded text-primary-700 text-[12.5px] font-medium animate-in fade-in zoom-in duration-200"
                      >
                        {condition}
                        <button
                          className="hover:text-primary-900 transition-colors"
                          type="button"
                          onClick={() =>
                            handleRemoveMedicalCondition(condition)
                          }
                        >
                          <IoCloseOutline className="text-base" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
