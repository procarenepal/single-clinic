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
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Select, SelectItem } from "@/components/ui/select";


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
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage external referral sources and commission rates
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {!branchId && isClinicAdmin && branches.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[11px] text-mountain-500">Branch</span>
              <select
                className="h-8 px-2.5 py-0 text-[12px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
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

      <div className="bg-surface border border-border-base rounded shadow-none flex flex-col">
        <div className="p-5 border-b border-border-base flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-col md:flex-row gap-3 flex-1">
              <Input
                className="w-full md:max-w-[320px]"
                placeholder="Search partners..."
                startContent={<IoSearchOutline className="text-text-muted" />}
                value={searchQuery}
                variant="bordered"
                onChange={(e: any) => setSearchQuery(e.target.value)}
              />
              <Select
                className="w-full md:w-40"
                value={selectedStatus}
                variant="bordered"
                onChange={(e: any) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </Select>
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
              <h3 className="text-[14px] font-semibold text-text-main">
                No referral partners found
              </h3>
              <p className="text-[13px] text-text-muted max-w-sm">
                Start by adding a referral partner to your clinic.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-2/30 border-b border-border-base">
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Partner
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/50">
                {currentPartners.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-surface-2/50 transition-colors group"
                  >
                    <td className="px-5 py-4 font-semibold text-[13.5px] text-text-main">
                      {p.name}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-[13px] text-text-main">
                        {p.phone}
                      </div>
                      {p.email && (
                        <div className="text-[12px] text-text-muted">
                          {p.email}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-[13px] text-primary">
                      {p.defaultCommission}%
                    </td>
                    <td className="px-5 py-4">
                      <Chip
                        color={p.isActive ? "success" : "danger"}
                        size="sm"
                        variant="flat"
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </Chip>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size="sm" variant="bordered">
                            {actionLoading === p.id ? (
                              <Spinner size="sm" />
                            ) : (
                              <IoEllipsisVerticalOutline className="w-4 h-4 text-text-muted group-hover:text-text-main transition-colors" />
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
