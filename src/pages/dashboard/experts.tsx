/**
 * Experts List Page
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IoAddOutline,
  IoSearchOutline,
  IoFilterOutline,
  IoEllipsisVerticalOutline,
  IoTrashOutline,
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
import { expertService } from "@/services/expertService";
import { specialityService } from "@/services/specialityService";
import { branchService } from "@/services/branchService";
import { Branch, Expert } from "@/types/models";
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
      className={`flex items-center border border-border-base rounded min-h-[36px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10 ${className || ""}`}
    >
      {startContent && (
        <div className="pl-3 pr-2 text-text-muted/50 flex items-center">
          {startContent}
        </div>
      )}
      <input
        className="flex-1 w-full text-[13px] px-2 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/50"
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
      className={`h-[36px] bg-surface border border-border-base text-text-main text-[13px] rounded px-3 py-1 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-shadow ${className || ""}`}
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

export default function ExpertsPage() {
  const { clinicId, userData, isClinicAdmin, isSystemOwner } = useAuth();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSpeciality, setSelectedSpeciality] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [specialities, setSpecialities] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchMap, setBranchMap] = useState<Record<string, string>>({});
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const itemsPerPage = 8;

  const branchId = userData?.branchId ?? null;
  const isClinicWideAdmin = isClinicAdmin() || isSystemOwner();
  const mainBranchId = branches.find((b) => b.isMainBranch)?.id ?? null;
  const effectiveBranchId =
    branchId ??
    (mainBranchId && selectedBranchId === mainBranchId
      ? undefined
      : (selectedBranchId ?? undefined));

  useEffect(() => {
    loadExperts();
    loadSpecialities();
  }, [clinicId, effectiveBranchId]);

  const loadSpecialities = async () => {
    if (!clinicId) return;
    try {
      const specialitiesData =
        await specialityService.getActiveSpecialitiesForDropdown(clinicId);

      setSpecialities([
        { key: "all", label: "All Specialities" },
        ...specialitiesData,
      ]);
    } catch (error) {
      console.error("Error loading specialities:", error);
      setSpecialities([{ key: "all", label: "All Specialities" }]);
    }
  };

  const loadExperts = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const expertsData = await expertService.getExpertsByClinic(
        clinicId,
        effectiveBranchId,
      );

      setExperts(expertsData);
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to load experts. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clinicId) return;
    if (!isClinicWideAdmin || branchId) return;

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
        console.error("Experts branches fetch error:", err);
        if (!cancelled) {
          setBranches([]);
          setBranchMap({});
          setSelectedBranchId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicId, isClinicAdmin, branchId]);

  const handleToggleStatus = async (
    expertId: string,
    currentStatus: boolean,
  ) => {
    try {
      setActionLoading(expertId);
      await expertService.toggleExpertStatus(expertId, !currentStatus);
      setExperts((prev) =>
        prev.map((expert) =>
          expert.id === expertId
            ? { ...expert, isActive: !currentStatus }
            : expert,
        ),
      );
      addToast({
        title: "Success",
        description: "Expert status updated successfully.",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to update expert status.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteExpert = async (expertId: string, expertName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${expertName}? This action cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      setActionLoading(expertId);
      await expertService.deleteExpert(expertId);
      setExperts((prev) => prev.filter((expert) => expert.id !== expertId));
      addToast({
        title: "Success",
        description: `Expert ${expertName} has been deleted.`,
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to delete expert.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredExperts = experts.filter((expert) => {
    const matchesSearch =
      expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (expert.email &&
        expert.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      expert.phone.includes(searchQuery) ||
      expert.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSpeciality =
      selectedSpeciality === "all" ||
      expert.speciality.toLowerCase().replace(/\s+/g, "-") ===
      selectedSpeciality;

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "active" && expert.isActive) ||
      (selectedStatus === "inactive" && !expert.isActive);

    return matchesSearch && matchesSpeciality && matchesStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredExperts.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredExperts.length);
  const currentExperts = filteredExperts.slice(startIndex, endIndex);

  useEffect(
    () => setCurrentPage(1),
    [searchQuery, selectedSpeciality, selectedStatus],
  );

  const hasAdvancedFilters =
    selectedSpeciality !== "all" || selectedStatus !== "all";

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={title({ size: "lg" })}>Experts</h1>
          <p className="text-[13.5px] text-mountain-500 mt-1">
            Manage and access expert records
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {!branchId && isClinicWideAdmin && branches.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[11px] text-text-muted">Branch</span>
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
            onClick={() => (window.location.href = "/dashboard/experts/new")}
          >
            Add Expert
          </Button>
        </div>
      </div>

      <div className="bg-surface border border-border-base rounded shadow-none flex flex-col">
        <div className="p-5 border-b border-border-base flex flex-col gap-4">
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
                className="w-full md:w-48"
                options={specialities.map((s) => ({
                  value: s.key,
                  label: s.label,
                }))}
                value={selectedSpeciality}
                onChange={(e: any) => {
                  setSelectedSpeciality(e.target.value);
                  setCurrentPage(1);
                }}
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

            <div className="flex gap-2">
              <Button
                startContent={<IoFilterOutline className="w-4 h-4" />}
                variant="bordered"
              >
                Filters
              </Button>
            </div>
          </div>
        </div>

        <div className="p-0 overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex justify-center items-center h-[300px]">
              <Spinner size="md" />
            </div>
          ) : currentExperts.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-[300px] gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-mountain-50 flex items-center justify-center border border-mountain-100">
                <IoSearchOutline className="w-6 h-6 text-mountain-400" />
              </div>
              <h3 className="text-[14px] font-semibold text-mountain-800">
                {searchQuery || hasAdvancedFilters
                  ? "No experts match your criteria"
                  : "No experts added yet"}
              </h3>
              {!searchQuery && !hasAdvancedFilters && (
                <Button
                  color="primary"
                  startContent={<IoAddOutline />}
                  onClick={() =>
                    (window.location.href = "/dashboard/experts/new")
                  }
                >
                  Add First Expert
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-mountain-50/50 border-b border-mountain-200">
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600">
                    Expert
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600">
                    Speciality
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600">
                    Type
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
                {currentExperts.map((expert) => (
                  <tr
                    key={expert.id}
                    className="hover:bg-mountain-50/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold text-[13px] shrink-0 border border-teal-200">
                          {expert.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <Link
                            className="font-semibold text-[13.5px] text-mountain-900 hover:text-teal-600 hover:underline"
                            to={`/dashboard/experts/${expert.id}`}
                          >
                            {expert.name}
                          </Link>
                          <div className="text-[11.5px] text-mountain-500 font-mono mt-0.5">
                            License: {expert.licenseNumber}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-[13px] text-mountain-800">
                        {expert.phone}
                      </div>
                      {expert.email && (
                        <div className="text-[11.5px] text-mountain-500 mt-0.5">
                          {expert.email}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] text-mountain-800 capitalize">
                        {expert.speciality}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium capitalize border ${expert.expertType === "regular"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}
                      >
                        {expert.expertType}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] text-mountain-800 font-medium">
                        {expert.defaultCommission}%
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium border ${expert.isActive
                          ? "bg-teal-50 text-teal-700 border-teal-200"
                          : "bg-red-50 text-red-700 border-red-200"
                          }`}
                      >
                        {expert.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size="sm" variant="bordered">
                            {actionLoading === expert.id ? (
                              <Spinner size="sm" />
                            ) : (
                              <IoEllipsisVerticalOutline className="w-4 h-4 text-text-muted" />
                            )}
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Expert actions">
                          <DropdownItem
                            key="view"
                            onClick={() =>
                              (window.location.href = `/dashboard/experts/${expert.id}`)
                            }
                          >
                            View Profile
                          </DropdownItem>
                          <DropdownItem
                            key="edit"
                            onClick={() =>
                              (window.location.href = `/dashboard/experts/${expert.id}/edit`)
                            }
                          >
                            Edit
                          </DropdownItem>
                          <DropdownItem
                            key="status"
                            className={
                              expert.isActive
                                ? "text-amber-600"
                                : "text-teal-600"
                            }
                            onClick={() =>
                              handleToggleStatus(expert.id, expert.isActive)
                            }
                          >
                            {expert.isActive ? "Deactivate" : "Activate"}
                          </DropdownItem>
                          <DropdownItem
                            key="delete"
                            className="text-red-600"
                            onClick={() =>
                              handleDeleteExpert(expert.id, expert.name)
                            }
                          >
                            <div className="flex items-center gap-1.5">
                              <IoTrashOutline /> Delete
                            </div>
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
