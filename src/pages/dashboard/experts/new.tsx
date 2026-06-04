/**
 * New Expert Page
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBackOutline, IoSaveOutline, IoAddOutline, IoRefreshOutline } from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { expertService } from "@/services/expertService";
import { specialityService } from "@/services/specialityService";
import { branchService } from "@/services/branchService";
import { addToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

// ── Main Component ──────────────────────────────────────────────────────────
export default function NewExpertPage() {
  const navigate = useNavigate();
  const { clinicId, currentUser, userData, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [specialities, setSpecialities] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);
  const [isAddingNewSpeciality, setIsAddingNewSpeciality] = useState(false);

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
      let finalSpecialityKey = expertProfile.speciality;

      if (isAddingNewSpeciality && expertProfile.speciality) {
        // Generate a URL-friendly key from the speciality name
        const generatedKey = expertProfile.speciality
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");

        // Check if this speciality already exists by key
        const exists = await specialityService.isKeyExists(generatedKey);

        if (!exists) {
          // Create the new speciality in Firestore
          await specialityService.createSpeciality({
            name: expertProfile.speciality,
            key: generatedKey,
            isActive: true,
            clinicId,
            branchId: defaultBranchId || clinicId,
            createdBy: currentUser?.uid || "system",
          });
        }
        finalSpecialityKey = generatedKey;
      }

      const expertData = {
        name: expertProfile.name,
        expertType: expertProfile.expertType as "regular" | "visiting",
        defaultCommission: parseFloat(expertProfile.defaultCommission) || 0,
        speciality: finalSpecialityKey,
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
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Add New Expert
          </h1>
          <p className="text-[14px] text-text-muted mt-1">
            Enter expert information below
          </p>
        </div>
      </div>

      <form className="w-full flex flex-col gap-6" onSubmit={handleSubmit}>
        <Card isBlurred className="w-full shadow-sm">
          <CardHeader>
            <h4 className="font-semibold text-[15px] text-text-main leading-none">
              Expert Profile
            </h4>
          </CardHeader>
          <CardBody className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Input
                isRequired
                label="Name"
                name="name"
                placeholder="Enter full name"
                value={expertProfile.name}
                variant="bordered"
                onChange={handleExpertProfileChange}
              />
              <Select
                isRequired
                label="Expert Type"
                name="expertType"
                placeholder="Select type"
                value={expertProfile.expertType}
                variant="bordered"
                onChange={handleExpertProfileChange}
              >
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="visiting">Visiting</SelectItem>
              </Select>
              <Input
                label="Default Commission (%)"
                max="100"
                min="0"
                name="defaultCommission"
                placeholder="Enter %"
                step="0.01"
                type="number"
                value={expertProfile.defaultCommission}
                variant="bordered"
                onChange={handleExpertProfileChange}
              />
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex justify-between items-center px-0.5">
                  <label className="text-[13px] font-medium text-text-main">
                    Speciality<span className="text-danger ml-0.5">*</span>
                  </label>
                  <button
                    className="text-[12px] text-primary hover:text-primary-hover font-medium flex items-center gap-1 hover:underline transition-all"
                    type="button"
                    onClick={() => {
                      setIsAddingNewSpeciality(!isAddingNewSpeciality);
                      setExpertProfile({ ...expertProfile, speciality: "" });
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
                      required
                      className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/60"
                      name="speciality"
                      placeholder="Enter new speciality name"
                      value={expertProfile.speciality}
                      onChange={handleExpertProfileChange}
                    />
                  </div>
                ) : (
                  <select
                    required
                    className="w-full min-h-[38px] bg-surface border border-border-base text-text-main text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-shadow"
                    name="speciality"
                    value={expertProfile.speciality}
                    onChange={handleExpertProfileChange}
                  >
                    <option disabled hidden value="">
                      Select speciality
                    </option>
                    {specialities.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <Input
                isRequired
                label="Phone Number"
                name="phone"
                placeholder="Enter phone number"
                value={expertProfile.phone}
                variant="bordered"
                onChange={handleExpertProfileChange}
              />
              <Input
                label="Email"
                name="email"
                placeholder="Enter email address"
                type="email"
                value={expertProfile.email}
                variant="bordered"
                onChange={handleExpertProfileChange}
              />
              <Input
                isRequired
                label="License Number"
                name="licenseNumber"
                placeholder="Enter license #"
                value={expertProfile.licenseNumber}
                variant="bordered"
                onChange={handleExpertProfileChange}
              />
            </div>
          </CardBody>
        </Card>

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
