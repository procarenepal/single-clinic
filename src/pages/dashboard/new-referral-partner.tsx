import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoArrowBackOutline, IoSaveOutline } from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { referralPartnerService } from "@/services/referralPartnerService";
import { branchService } from "@/services/branchService";
import { addToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Card, CardBody, CardHeader } from "@/components/ui/card";


// ── Main Component ──────────────────────────────────────────────────────────
export default function NewReferralPartnerPage() {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const isEdit = !!partnerId;
  const { clinicId, currentUser, userData, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);

  const [partnerProfile, setPartnerProfile] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    partnerType: "individual" as "individual" | "lab" | "clinic" | "other",
    defaultCommission: "0",
  });

  useEffect(() => {
    if (isEdit && partnerId) {
      loadPartner();
    }
  }, [isEdit, partnerId]);

  const loadPartner = async () => {
    try {
      const data = await referralPartnerService.getReferralPartnerById(
        partnerId!,
      );

      if (data) {
        setPartnerProfile({
          name: data.name,
          phone: data.phone,
          email: data.email || "",
          address: data.address || "",
          partnerType: data.partnerType || "individual",
          defaultCommission: data.defaultCommission.toString(),
        });
        setDefaultBranchId(data.branchId);
      }
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to load partner.",
        color: "danger",
      });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!clinicId || authLoading || isEdit) return;
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
  }, [clinicId, authLoading, userData?.branchId, isEdit]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setPartnerProfile({ ...partnerProfile, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;
    if (!partnerProfile.name || !partnerProfile.phone) {
      addToast({
        title: "Error",
        description: "Name and Phone are required.",
        color: "danger",
      });

      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...partnerProfile,
        defaultCommission: parseFloat(partnerProfile.defaultCommission) || 0,
        clinicId,
        branchId: defaultBranchId ?? clinicId ?? "",
        createdBy: currentUser?.uid || "",
      };

      if (isEdit && partnerId) {
        await referralPartnerService.updateReferralPartner(partnerId, payload);
        addToast({
          title: "Success",
          description: "Updated successfully.",
          color: "success",
        });
      } else {
        await referralPartnerService.createReferralPartner(payload);
        addToast({
          title: "Success",
          description: "Created successfully.",
          color: "success",
        });
      }
      navigate("/dashboard/settings/referral-partners");
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to save partner.",
        color: "danger",
      });
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 max-w-full">
      <div className="flex items-center gap-4">
        <Button
          isIconOnly
          variant="bordered"
          onClick={() => navigate("/dashboard/settings/referral-partners")}
        >
          <IoArrowBackOutline className="w-5 h-5" />
        </Button>
        <div>
          <h1 className={title({ size: "lg" })}>
            {isEdit ? "Edit Partner" : "Add Referral Partner"}
          </h1>
          <p className="text-[14px] text-text-muted mt-1">
            Manage external referral contact details
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <h4 className="font-semibold text-[15px] text-text-main leading-none">
              Partner Details
            </h4>
          </CardHeader>
          <CardBody className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Input
                isRequired
                label="Name"
                name="name"
                placeholder="Enter partner name"
                value={partnerProfile.name}
                variant="bordered"
                onChange={handleChange}
              />
              <Input
                isRequired
                label="Phone Number"
                name="phone"
                placeholder="Enter phone number"
                value={partnerProfile.phone}
                variant="bordered"
                onChange={handleChange}
              />
              <Input
                label="Default Commission (%)"
                max="100"
                min="0"
                name="defaultCommission"
                placeholder="Enter %"
                step="0.01"
                type="number"
                value={partnerProfile.defaultCommission}
                variant="bordered"
                onChange={handleChange}
              />
              <Input
                label="Email"
                name="email"
                placeholder="Enter email"
                type="email"
                value={partnerProfile.email}
                variant="bordered"
                onChange={handleChange}
              />
              <Input
                label="Address"
                name="address"
                placeholder="Enter address"
                value={partnerProfile.address}
                variant="bordered"
                onChange={handleChange}
              />
              <Select
                label="Partner Type"
                name="partnerType"
                placeholder="Select type"
                value={partnerProfile.partnerType}
                variant="bordered"
                onChange={handleChange}
              >
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="lab">Laboratory</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </Select>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3 mt-2">
          <Button
            type="button"
            variant="bordered"
            onClick={() => navigate("/dashboard/settings/referral-partners")}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={loading}
            startContent={!loading && <IoSaveOutline />}
            type="submit"
          >
            {loading ? "Saving..." : isEdit ? "Update Partner" : "Save Partner"}
          </Button>
        </div>
      </form>
    </div>
  );
}
