/**
 * New Expert Page
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBackOutline, IoSaveOutline } from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { expertService } from "@/services/expertService";
import { specialityService } from "@/services/specialityService";
import { branchService } from "@/services/branchService";
import { addToast } from "@/components/ui/toast";

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
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border rounded min-h-[38px] bg-white transition-colors ${isInvalid
            ? "border-red-300 focus-within:ring-red-100"
            : "border-mountain-200 focus-within:border-teal-500 focus-within:ring-teal-100"
          } focus-within:ring-1 ${disabled ? "bg-mountain-50" : ""}`}
      >
        <input
          className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-mountain-800 placeholder:text-mountain-400 disabled:text-mountain-500"
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
          className={`text-[11.5px] ${isInvalid ? "text-red-500" : "text-mountain-500"}`}
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
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        className={`w-full min-h-[38px] bg-white border border-mountain-200 text-mountain-800 text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100 transition-shadow`}
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
export default function NewExpertPage() {
  const navigate = useNavigate();
  const { clinicId, currentUser, userData, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [specialities, setSpecialities] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);

  const [expertProfile, setExpertProfile] = useState({
    name: "",
    expertType: "",
    defaultCommission: "",
    speciality: "",
    phone: "",
    email: "",
    licenseNumber: "",
  });

  useEffect(() => {
    if (!clinicId) return;
    loadSpecialities();
  }, [clinicId, defaultBranchId]);

  const loadSpecialities = async () => {
    if (!clinicId) return;
    try {
      const branchId = defaultBranchId ?? undefined;
      const specialitiesData =
        await specialityService.getActiveSpecialitiesForDropdown(
          clinicId,
          branchId,
        );

      setSpecialities(
        specialitiesData.map((s: { key: string; label: string }) => ({
          value: s.key,
          label: s.label,
        })),
      );
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to load specialities.",
        color: "danger",
      });
    }
  };

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

  const handleExpertProfileChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setExpertProfile({ ...expertProfile, [name]: value });
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
      !expertProfile.name ||
      !expertProfile.expertType ||
      !expertProfile.speciality ||
      !expertProfile.phone ||
      !expertProfile.licenseNumber
    ) {
      addToast({
        title: "Error",
        description: "Please fill in all required fields.",
        color: "danger",
      });

      return;
    }

    setLoading(true);
    try {
      const expertData = {
        name: expertProfile.name,
        expertType: expertProfile.expertType as "regular" | "visiting",
        defaultCommission: parseFloat(expertProfile.defaultCommission) || 0,
        speciality: expertProfile.speciality,
        phone: expertProfile.phone,
        email: expertProfile.email || "",
        licenseNumber: expertProfile.licenseNumber,
        clinicId,
        branchId: defaultBranchId ?? clinicId ?? "",
        createdBy: currentUser?.uid || "",
      };

      await expertService.createExpert(expertData);
      addToast({
        title: "Success",
        description: "Expert registered successfully.",
        color: "success",
      });
      navigate("/dashboard/experts");
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to create expert.",
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
          onClick={() => navigate("/dashboard/experts")}
        >
          <IoArrowBackOutline className="w-5 h-5" />
        </Button>
        <div>
          <h1 className={title({ size: "lg" })}>Add New Expert</h1>
          <p className="text-[14px] text-mountain-500 mt-1">
            Enter expert information below
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="bg-white border border-mountain-200 rounded shadow-sm">
          <div className="px-5 py-4 border-b border-mountain-100 bg-mountain-50/50">
            <h4 className="font-semibold text-[15px] text-mountain-900 leading-none">
              Expert Profile
            </h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CustomInput
                required
                label="Name"
                name="name"
                placeholder="Enter full name"
                value={expertProfile.name}
                onChange={handleExpertProfileChange}
              />
              <CustomSelect
                required
                label="Expert Type"
                name="expertType"
                options={[
                  { value: "regular", label: "Regular" },
                  { value: "visiting", label: "Visiting" },
                ]}
                placeholder="Select type"
                value={expertProfile.expertType}
                onChange={handleExpertProfileChange}
              />
              <CustomInput
                label="Default Commission (%)"
                max="100"
                min="0"
                name="defaultCommission"
                placeholder="Enter %"
                step="0.01"
                type="number"
                value={expertProfile.defaultCommission}
                onChange={handleExpertProfileChange}
              />
              <CustomSelect
                required
                label="Speciality"
                name="speciality"
                options={specialities}
                placeholder="Select speciality"
                value={expertProfile.speciality}
                onChange={handleExpertProfileChange}
              />
              <CustomInput
                required
                label="Phone Number"
                name="phone"
                placeholder="Enter phone number"
                value={expertProfile.phone}
                onChange={handleExpertProfileChange}
              />
              <CustomInput
                label="Email"
                name="email"
                placeholder="Enter email address"
                type="email"
                value={expertProfile.email}
                onChange={handleExpertProfileChange}
              />
              <CustomInput
                required
                label="License Number"
                name="licenseNumber"
                placeholder="Enter license #"
                value={expertProfile.licenseNumber}
                onChange={handleExpertProfileChange}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <Button
            type="button"
            variant="bordered"
            onClick={() => navigate("/dashboard/experts")}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={loading}
            startContent={!loading && <IoSaveOutline />}
            type="submit"
          >
            {loading ? "Saving..." : "Save Expert"}
          </Button>
        </div>
      </form>
    </div>
  );
}
