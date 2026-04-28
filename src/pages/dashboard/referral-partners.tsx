import React, { useState, useEffect } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoEllipsisVerticalOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown";
import { useAuth } from "@/hooks/useAuth";
import { referralPartnerService } from "@/services/referralPartnerService";
import { branchService } from "@/services/branchService";
import { Branch, ReferralPartner } from "@/types/models";
import { addToast } from "@/components/ui/toast";

// ── Custom UI Helpers ────────────────────────────────────────────────────────
function CustomInput({
  value,
  onChange,
  placeholder,
  startContent,
  className,
  type = "text",
}: any) {
  return (
    <div
      className={`flex items-center border border-mountain-200 rounded min-h-[36px] bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100 ${className || ""}`}
    >
      {startContent && (
        <div className="pl-3 pr-2 text-mountain-400 flex items-center">
          {startContent}
        </div>
      )}
      <input
        className="flex-1 w-full text-[13px] px-2 py-1.5 bg-transparent outline-none text-mountain-800 placeholder:text-mountain-400"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function CustomSelect({
  value,
  onChange,
  options,
  className,
  placeholder,
}: any) {
  return (
    <select
      className={`h-[36px] bg-white border border-mountain-200 text-mountain-800 text-[13px] rounded px-3 py-1 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100 transition-shadow ${className || ""}`}
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
  );
}

export default function ReferralPartnersPage() {
  const { clinicId, userData } = useAuth();
  const [partners, setPartners] = useState<ReferralPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchMap, setBranchMap] = useState<Record<string, string>>({});
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const itemsPerPage = 8;

  const branchId = userData?.branchId ?? null;
  const isClinicAdmin =
    userData?.role === "clinic-admin" ||
    userData?.role === "system-owner";
  const mainBranchId = branches.find((b) => b.isMainBranch)?.id ?? null;
  const effectiveBranchId =
    branchId ??
    (mainBranchId && selectedBranchId === mainBranchId
      ? undefined
      : (selectedBranchId ?? undefined));

  useEffect(() => {
    loadPartners();
  }, [clinicId, effectiveBranchId]);

  const loadPartners = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const data = await referralPartnerService.getReferralPartnersByClinic(
        clinicId,
        effectiveBranchId,
      );

      setPartners(data);
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to load referral partners.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load branches for clinic-wide admins
  useEffect(() => {
    if (!clinicId) return;
    if (!isClinicAdmin || branchId) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await branchService.getClinicBranches(clinicId, true);

        if (cancelled) return;
        setBranches(data);
        const map: Record<string, string> = {};

        data.forEach((b) => {
          map[b.id] = b.name;
        });
        setBranchMap(map);
        if (data.length > 0) {
          setSelectedBranchId((prev) => prev ?? data[0].id);
        } else {
          setSelectedBranchId(null);
        }
      } catch (err) {
        console.error("Referral branches fetch error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicId, isClinicAdmin, branchId]);

  const handleToggleStatus = async (
    partnerId: string,
    currentStatus: boolean,
  ) => {
    try {
      setActionLoading(partnerId);
      await referralPartnerService.toggleReferralPartnerStatus(
        partnerId,
        !currentStatus,
      );
      setPartners((prev) =>
        prev.map((p) =>
          p.id === partnerId ? { ...p, isActive: !currentStatus } : p,
        ),
      );
      addToast({
        title: "Success",
        description: "Status updated successfully.",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to update status.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePartner = async (partnerId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      setActionLoading(partnerId);
      await referralPartnerService.deleteReferralPartner(partnerId);
      setPartners((prev) => prev.filter((p) => p.id !== partnerId));
      addToast({
        title: "Success",
        description: `${name} has been deleted.`,
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to delete partner.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.phone.includes(searchQuery);

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "active" && p.isActive) ||
      (selectedStatus === "inactive" && !p.isActive);

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPartners.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPartners = filteredPartners.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={title({ size: "lg" })}>Referral Partners</h1>
          <p className="text-[13.5px] text-mountain-500 mt-1">
            Manage external referral sources and commission rates
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {!branchId && isClinicAdmin && branches.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[11px] text-mountain-500">Branch</span>
              <select
                className="h-8 px-2.5 py-0 text-[12px] border border-mountain-200 rounded bg-white text-mountain-700 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                value={selectedBranchId ?? ""}
                onChange={(e) => setSelectedBranchId(e.target.value || null)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.isMainBranch ? " (all branches)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button
            color="primary"
            startContent={<IoAddOutline className="w-4 h-4" />}
            onClick={() =>
              (window.location.href = "/dashboard/settings/referral-partners/new")
            }
          >
            Add Partner
          </Button>
        </div>
      </div>

      <div className="bg-white border border-mountain-200 rounded shadow-sm flex flex-col">
        <div className="p-5 border-b border-mountain-100 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-col md:flex-row gap-3 flex-1">
              <CustomInput
                className="w-full md:max-w-[320px]"
                placeholder="Search by name, email, phone..."
                startContent={<IoSearchOutline className="w-4 h-4" />}
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}
              />
              <CustomSelect
                className="w-full md:w-36"
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
                value={selectedStatus}
                onChange={(e: any) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <div className="p-0 overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex justify-center items-center h-[300px]">
              <Spinner size="md" />
            </div>
          ) : currentPartners.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-[300px] gap-3 text-center">
              <h3 className="text-[14px] font-semibold text-mountain-800">
                No referral partners found
              </h3>
              <p className="text-[13px] text-mountain-500 max-w-sm">
                Start by adding a referral partner to your clinic.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-mountain-50/50 border-b border-mountain-200">
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600">
                    Partner
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600">
                    Commission
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mountain-100">
                {currentPartners.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-mountain-50/30 transition-colors"
                  >
                    <td className="px-5 py-3 font-semibold text-[13.5px] text-mountain-900">
                      {p.name}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-[13px] text-mountain-800">
                        {p.phone}
                      </div>
                      {p.email && (
                        <div className="text-[11.5px] text-mountain-500">
                          {p.email}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-[13px] text-mountain-800">
                      {p.defaultCommission}%
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium border ${p.isActive ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size="sm" variant="bordered">
                            {actionLoading === p.id ? (
                              <Spinner size="sm" />
                            ) : (
                              <IoEllipsisVerticalOutline className="w-4 h-4 text-mountain-600" />
                            )}
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu>
                          <DropdownItem
                            onClick={() =>
                              (window.location.href = `/dashboard/settings/referral-partners/${p.id}`)
                            }
                          >
                            View Profile
                          </DropdownItem>
                          <DropdownItem
                            onClick={() =>
                              (window.location.href = `/dashboard/settings/referral-partners/${p.id}/edit`)
                            }
                          >
                            Edit
                          </DropdownItem>
                          <DropdownItem
                            onClick={() => handleToggleStatus(p.id, p.isActive)}
                          >
                            {p.isActive ? "Deactivate" : "Activate"}
                          </DropdownItem>
                          <DropdownItem
                            className="text-red-600"
                            onClick={() => handleDeletePartner(p.id, p.name)}
                          >
                            Delete
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
