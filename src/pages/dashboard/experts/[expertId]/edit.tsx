/**
 * Edit Expert Page
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { IoArrowBackOutline } from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { expertService } from "@/services/expertService";
import { specialityService } from "@/services/specialityService";
import { addToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Expert } from "@/types/models";


export default function EditExpertPage() {
  const { expertId } = useParams<{ expertId: string }>();
  const navigate = useNavigate();
  const { clinicId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [specialities, setSpecialities] = useState<any[]>([]);
  const [expertProfile, setExpertProfile] = useState<Partial<Expert>>({});

  useEffect(() => {
    if (expertId && clinicId) loadData();
  }, [expertId, clinicId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, specs] = await Promise.all([
        expertService.getExpertById(expertId!),
        specialityService.getActiveSpecialitiesForDropdown(clinicId!),
      ]);

      if (!data) return navigate("/dashboard/experts");
      setExpertProfile(data);
      setSpecialities(
        specs.map((s: any) => ({ value: s.key, label: s.label })),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await expertService.updateExpert(expertId!, expertProfile);
      addToast({
        title: "Success",
        description: "Expert updated.",
        color: "success",
      });
      navigate(`/dashboard/experts/${expertId}`);
    } catch {
      addToast({
        title: "Error",
        description: "Update failed.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-12 flex justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="bordered" onClick={() => navigate(-1)}>
          <IoArrowBackOutline />
        </Button>
        <h1 className={title({ size: "sm" })}>Edit Expert</h1>
      </div>
      <form
        className="bg-surface border border-border-base rounded p-6 shadow-none grid grid-cols-2 gap-6"
        onSubmit={handleUpdate}
      >
        <Input
          isRequired
          label="Name"
          name="name"
          value={expertProfile.name}
          variant="bordered"
          onChange={(e: any) =>
            setExpertProfile({ ...expertProfile, name: e.target.value })
          }
        />
        <Select
          label="Speciality"
          name="speciality"
          value={expertProfile.speciality}
          variant="bordered"
          onChange={(e: any) =>
            setExpertProfile({ ...expertProfile, speciality: e.target.value })
          }
        >
          {specialities.map((s: any) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </Select>
        <Input
          isRequired
          label="Phone"
          name="phone"
          value={expertProfile.phone}
          variant="bordered"
          onChange={(e: any) =>
            setExpertProfile({ ...expertProfile, phone: e.target.value })
          }
        />
        <Input
          label="Email"
          name="email"
          value={expertProfile.email}
          variant="bordered"
          onChange={(e: any) =>
            setExpertProfile({ ...expertProfile, email: e.target.value })
          }
        />
        <Input
          isRequired
          label="License Number"
          name="licenseNumber"
          value={expertProfile.licenseNumber}
          variant="bordered"
          onChange={(e: any) =>
            setExpertProfile({
              ...expertProfile,
              licenseNumber: e.target.value,
            })
          }
        />
        <Select
          isRequired
          label="Expert Type"
          name="expertType"
          value={expertProfile.expertType}
          variant="bordered"
          onChange={(e: any) =>
            setExpertProfile({ ...expertProfile, expertType: e.target.value })
          }
        >
          <SelectItem key="regular" value="regular">
            Regular
          </SelectItem>
          <SelectItem key="visiting" value="visiting">
            Visiting
          </SelectItem>
        </Select>
        <Input
          label="Default Commission (%)"
          name="defaultCommission"
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={expertProfile.defaultCommission !== undefined ? expertProfile.defaultCommission.toString() : ""}
          variant="bordered"
          onChange={(e: any) =>
            setExpertProfile({
              ...expertProfile,
              defaultCommission: parseFloat(e.target.value) || 0,
            })
          }
        />
        <div className="col-span-2 flex justify-end gap-3">
          <Button variant="bordered" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button color="primary" isLoading={saving} type="submit">
            Update Expert
          </Button>
        </div>
      </form>
    </div>
  );
}
