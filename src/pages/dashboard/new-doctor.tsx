/**
 * New Doctor Page — Clinic Clarity without HeroUI
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { IoArrowBackOutline, IoSaveOutline, IoAddOutline, IoRefreshOutline } from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { doctorService } from "@/services/doctorService";
import { specialityService } from "@/services/specialityService";
import { branchService } from "@/services/branchService";
import { addToast } from "@/components/ui/toast";
import { db } from "@/config/firebase";

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
  isInvalid,
  errorMessage,
  min,
  max,
  step,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full`}>
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border rounded min-h-[38px] bg-surface transition-colors ${isInvalid
          ? "border-error focus-within:ring-error/20"
          : "border-border-base focus-within:border-primary focus-within:ring-primary/20"
          } focus-within:ring-1 ${disabled ? "bg-surface-2" : ""}`}
      >
        <input
          className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/60 disabled:text-text-muted"
          disabled={disabled}
          max={max}
          min={min}
          name={name}
          placeholder={placeholder}
          required={required}
          step={step}
          type={type}
          value={value}
          onChange={onChange}
        />
      </div>
      {(description || errorMessage) && (
        <p
          className={`text-[11.5px] ${isInvalid ? "text-error" : "text-text-muted"}`}
        >
          {errorMessage || description}
        </p>
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
  placeholder,
  required,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full`}>
      {label && (
        <label className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
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
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function NewDoctorPage() {
  const navigate = useNavigate();
  const { clinicId, currentUser, userData, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [specialities, setSpecialities] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [emailError, setEmailError] = useState<string>("");
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);

  const [isAddingNewSpeciality, setIsAddingNewSpeciality] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState({
    name: "",
    doctorType: "",
    defaultCommission: "",
    speciality: "",
    phone: "",
    email: "",
    nmcNumber: "",
  });

  useEffect(() => {
    if (!clinicId) return;
    loadSpecialities();
    loadAdminEmails();
  }, [clinicId, defaultBranchId]);

  const loadSpecialities = async () => {
    try {
      const specialitiesData =
        await specialityService.getActiveSpecialitiesForDropdown();

      setSpecialities(
        specialitiesData.map((s: { key: string; label: string }) => ({
          value: s.key,
          label: s.label,
        })),
      );
    } catch (error) {
      console.error("Error loading specialities:", error);
      addToast({
        title: "Error",
        description: "Failed to load specialities.",
        color: "danger",
      });
    }
  };

  // Determine default branch for the new doctor (user branch, main branch, or clinic fallback)
  useEffect(() => {
    if (!clinicId || authLoading) return;
    if (userData?.branchId) {
      setDefaultBranchId(userData.branchId);

      return;
    }
    branchService
      .isMultiBranchEnabled(clinicId)
      .then((multi) =>
        multi
          ? branchService
            .getMainBranch(clinicId)
            .then((b) => b && setDefaultBranchId(b.id))
          : setDefaultBranchId(clinicId),
      )
      .catch(() => setDefaultBranchId(clinicId));
  }, [clinicId, authLoading, userData?.branchId]);

  const loadAdminEmails = async () => {
    if (!clinicId) return;
    try {
      const usersRef = collection(db, "users");
      const emails: string[] = [];
      const clinicAdminQuery = query(
        usersRef,
        where("clinicId", "==", clinicId),
        where("role", "==", "clinic-admin"),
      );
      const clinicAdminSnapshot = await getDocs(clinicAdminQuery);

      clinicAdminSnapshot.docs.forEach((doc) => {
        const userData = doc.data();

        if (userData.email) emails.push(userData.email.toLowerCase());
      });
      setAdminEmails(emails);
    } catch (error) { }
  };

  const validateEmail = (email: string): string => {
    if (!email.trim()) return "";
    const emailLower = email.toLowerCase().trim();

    if (adminEmails.includes(emailLower)) {
      return "This email is already used by a clinic or branch admin.";
    }

    return "";
  };

  const handleDoctorProfileChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setDoctorProfile({ ...doctorProfile, [name]: value });
    if (name === "email") setEmailError(validateEmail(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) {
      addToast({
        title: "Error",
        description: "No clinic information available.",
        color: "danger",
      });

      return;
    }
    if (
      !doctorProfile.name ||
      !doctorProfile.doctorType ||
      !doctorProfile.speciality ||
      !doctorProfile.phone ||
      !doctorProfile.nmcNumber
    ) {
      addToast({
        title: "Error",
        description: "Please fill in all required fields.",
        color: "danger",
      });

      return;
    }
    if (doctorProfile.email) {
      const err = validateEmail(doctorProfile.email);

      if (err) {
        setEmailError(err);

        return;
      }
    }

    setLoading(true);
    try {
      let finalSpecialityKey = doctorProfile.speciality;

      if (isAddingNewSpeciality && doctorProfile.speciality) {
        // Generate a URL-friendly key from the speciality name
        const generatedKey = doctorProfile.speciality
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");

        // Check if this speciality already exists by key
        const exists = await specialityService.isKeyExists(generatedKey);

        if (!exists) {
          // Create the new speciality in Firestore
          await specialityService.createSpeciality({
            name: doctorProfile.speciality,
            key: generatedKey,
            isActive: true,
            clinicId,
            branchId: defaultBranchId || clinicId,
            createdBy: currentUser?.uid || "system",
          });
        }
        finalSpecialityKey = generatedKey;
      }

      const doctorData = {
        name: doctorProfile.name,
        doctorType: doctorProfile.doctorType as "regular" | "visiting",
        defaultCommission: parseFloat(doctorProfile.defaultCommission) || 0,
        speciality: finalSpecialityKey,
        phone: doctorProfile.phone,
        email: doctorProfile.email || "",
        nmcNumber: doctorProfile.nmcNumber,
        clinicId,
        branchId: defaultBranchId ?? clinicId ?? "",
        createdBy: currentUser?.uid || "",
      };

      await doctorService.createDoctor(doctorData);
      addToast({
        title: "Success",
        description: "Doctor registered successfully.",
        color: "success",
      });
      navigate("/dashboard/doctors");
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to create doctor.",
        color: "danger",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12 max-w-full">
      <div className="flex items-center gap-4">
        <Button
          isIconOnly
          variant="bordered"
          onClick={() => navigate("/dashboard/doctors")}
        >
          <IoArrowBackOutline className="w-5 h-5" />
        </Button>
        <div>
          <h1 className={title({ size: "lg" })}>Add New Doctor</h1>
          <p className="text-[14px] text-text-muted mt-1">
            Enter the doctor information below
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-6"
        id="doctor-form"
        onSubmit={handleSubmit}
      >
        <div className="bg-surface border border-border-base rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border-base bg-surface-2/30">
            <h4 className="font-semibold text-[15px] text-text-main leading-none">
              Doctor Profile
            </h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CustomInput
                required
                label="Name"
                name="name"
                placeholder="Enter full name"
                value={doctorProfile.name}
                onChange={handleDoctorProfileChange}
              />
              <CustomSelect
                required
                label="Doctor Type"
                name="doctorType"
                options={[
                  { value: "regular", label: "Regular" },
                  { value: "visiting", label: "Visiting" },
                ]}
                placeholder="Select type"
                value={doctorProfile.doctorType}
                onChange={handleDoctorProfileChange}
              />
              <CustomInput
                label="Default Commission (%)"
                max="100"
                min="0"
                name="defaultCommission"
                placeholder="Enter %"
                step="0.01"
                type="number"
                value={doctorProfile.defaultCommission}
                onChange={handleDoctorProfileChange}
              />
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex justify-between items-center px-0.5">
                  <label className="text-[13px] font-medium text-text-main">
                    Speciality<span className="text-error ml-0.5">*</span>
                  </label>
                  <button
                    className="text-[12px] text-primary hover:text-primary-hover font-medium flex items-center gap-1 hover:underline transition-all"
                    type="button"
                    onClick={() => {
                      setIsAddingNewSpeciality(!isAddingNewSpeciality);
                      setDoctorProfile({ ...doctorProfile, speciality: "" });
                    }}
                  >
                    {isAddingNewSpeciality ? (
                      <>
                        <IoRefreshOutline className="w-3.5 h-3.5" />
                        Select Existing
                      </>
                    ) : (
                      <>
                        <IoAddOutline className="w-3.5 h-3.5" />
                        Add New
                      </>
                    )}
                  </button>
                </div>
                {isAddingNewSpeciality ? (
                  <div className="flex items-center border border-border-base rounded min-h-[38px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-colors">
                    <input
                      className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/60"
                      name="speciality"
                      placeholder="Enter new speciality name"
                      required
                      value={doctorProfile.speciality}
                      onChange={handleDoctorProfileChange}
                    />
                  </div>
                ) : (
                  <select
                    className="w-full min-h-[38px] bg-surface border border-border-base text-text-main text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-shadow"
                    name="speciality"
                    required
                    value={doctorProfile.speciality}
                    onChange={handleDoctorProfileChange}
                  >
                    <option disabled hidden value="">
                      Select speciality
                    </option>
                    {specialities.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <CustomInput
                required
                label="Phone Number"
                name="phone"
                placeholder="Enter phone number"
                value={doctorProfile.phone}
                onChange={handleDoctorProfileChange}
              />
              <CustomInput
                errorMessage={emailError}
                isInvalid={!!emailError}
                label="Email"
                name="email"
                placeholder="Enter email address"
                type="email"
                value={doctorProfile.email}
                onChange={handleDoctorProfileChange}
              />
              <CustomInput
                required
                label="NMC Number (License)"
                name="nmcNumber"
                placeholder="Enter NMC license #"
                value={doctorProfile.nmcNumber}
                onChange={handleDoctorProfileChange}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <Button
            type="button"
            variant="bordered"
            onClick={() => navigate("/dashboard/doctors")}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={loading}
            startContent={!loading && <IoSaveOutline />}
            type="submit"
          >
            {loading ? "Saving..." : "Save Doctor"}
          </Button>
        </div>
      </form>
    </div>
  );
}
