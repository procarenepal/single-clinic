/**
 * Doctors List Page — Clinic Clarity without HeroUI
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IoAddOutline,
  IoSearchOutline,
  IoFilterOutline,
  IoEllipsisVerticalOutline,
  IoTrashOutline,
  IoEyeOutline,
  IoCreateOutline,
  IoCalendarOutline,
  IoListOutline,
  IoPowerOutline,
  IoShieldCheckmarkOutline,
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
import { doctorService } from "@/services/doctorService";
import { specialityService } from "@/services/specialityService";
import { branchService } from "@/services/branchService";
import { Branch, Doctor } from "@/types/models";
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

export default function DoctorsPage() {
  const { clinicId, userData, isClinicAdmin, isSystemOwner } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
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
  const itemsPerPage = 8; // Adjust to preferred page size

  const branchId = userData?.branchId ?? null;
  const isClinicWideAdmin = isClinicAdmin() || isSystemOwner();
  const mainBranchId = branches.find((b) => b.isMainBranch)?.id ?? null;
  const effectiveBranchId =
    branchId ??
    (mainBranchId && selectedBranchId === mainBranchId
      ? undefined
      : (selectedBranchId ?? undefined));

  useEffect(() => {
    loadDoctors();
    loadSpecialities();
  }, [clinicId, effectiveBranchId]);

  const loadSpecialities = async () => {
    try {
      const specialitiesData =
        await specialityService.getActiveSpecialitiesForDropdown();

      setSpecialities([
        { key: "all", label: "All Specialities" },
        ...specialitiesData ?? [],
      ]);
    } catch (error) {
      console.error("Error loading specialities:", error);
      setSpecialities([{ key: "all", label: "All Specialities" }]);
    }
  };

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const doctorsData = await doctorService.getDoctors();

      setDoctors(doctorsData);
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to load doctors. Please try again.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load branches for clinic-wide admins (no fixed branchId)
  useEffect(() => {
    if (!clinicId) return;
    if (!isClinicWideAdmin || branchId) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await branchService.getClinicBranches();

        if (cancelled) return;
        setBranches(data);
        const map: Record<string, string> = {};

        data.forEach((b) => {
          map[b.id] = b.name;
        });
        setBranchMap(map);
        if (data.length > 0) {
          // Ordered by isMainBranch desc in service; first entry is main branch
          setSelectedBranchId((prev) => prev ?? data[0].id);
        } else {
          setSelectedBranchId(null);
        }
      } catch (err) {
        console.error("Doctors branches fetch error:", err);
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

  // When branchId is hard-locked for staff, clear any admin filter state
  useEffect(() => {
    if (branchId) {
      setSelectedBranchId(null);
    }
  }, [branchId]);

  const handleToggleStatus = async (
    doctorId: string,
    currentStatus: boolean,
  ) => {
    try {
      setActionLoading(doctorId);
      await doctorService.toggleDoctorStatus(doctorId, !currentStatus);
      setDoctors((prev) =>
        prev.map((doctor) =>
          doctor.id === doctorId
            ? { ...doctor, isActive: !currentStatus }
            : doctor,
        ),
      );
      addToast({
        title: "Success",
        description: "Doctor status updated successfully.",
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to update doctor status.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDoctor = async (doctorId: string, doctorName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${doctorName}? This action cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      setActionLoading(doctorId);
      await doctorService.deleteDoctor(doctorId);
      setDoctors((prev) => prev.filter((doctor) => doctor.id !== doctorId));
      addToast({
        title: "Success",
        description: `Doctor ${doctorName} has been deleted.`,
        color: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to delete doctor.",
        color: "danger",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Filter logic
  const filteredDoctors = doctors.filter((doctor) => {
    const matchesSearch =
      doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doctor.email &&
        doctor.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      doctor.phone.includes(searchQuery) ||
      doctor.nmcNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSpeciality =
      selectedSpeciality === "all" ||
      doctor.speciality.toLowerCase().replace(/\s+/g, "-") ===
      selectedSpeciality;

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "active" && doctor.isActive) ||
      (selectedStatus === "inactive" && !doctor.isActive);

    return matchesSearch && matchesSpeciality && matchesStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDoctors.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredDoctors.length);
  const currentDoctors = filteredDoctors.slice(startIndex, endIndex);

  useEffect(
    () => setCurrentPage(1),
    [searchQuery, selectedSpeciality, selectedStatus],
  );

  const hasAdvancedFilters =
    selectedSpeciality !== "all" || selectedStatus !== "all";

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={title({ size: "lg" })}>Doctors</h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage and access doctor records
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
            startContent={
              <div className="p-0.5 rounded-full bg-primary/10 text-primary">
                <svg
                  fill="none"
                  height="14"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  width="14"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            }
            variant="bordered"
            onClick={() =>
              (window.location.href = "/dashboard/settings/doctor-speciality")
            }
          >
            Manage Specialities
          </Button>
          <Button
            color="primary"
            startContent={<IoAddOutline className="w-4 h-4" />}
            onClick={() => (window.location.href = "/dashboard/doctors/new")}
          >
            Add Doctor
          </Button>
        </div>
      </div>

      <div className="bg-surface border border-border-base rounded shadow-none flex flex-col">
        {/* Filters Top Bar */}
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

          {hasAdvancedFilters && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-border-base">
              {selectedSpeciality !== "all" && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded text-[12px] font-medium text-primary">
                  Speciality:{" "}
                  {
                    specialities.find((s) => s.key === selectedSpeciality)
                      ?.label
                  }
                  <button
                    className="text-primary hover:text-primary-600"
                    onClick={() => setSelectedSpeciality("all")}
                  >
                    <IoAddOutline className="w-3.5 h-3.5 rotate-45" />
                  </button>
                </div>
              )}
              {selectedStatus !== "all" && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 border border-border-base rounded text-[12px] font-medium text-text-main">
                  Status: <span className="capitalize">{selectedStatus}</span>
                  <button
                    className="text-text-muted hover:text-text-main"
                    onClick={() => setSelectedStatus("all")}
                  >
                    <IoAddOutline className="w-3.5 h-3.5 rotate-45" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-0 overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex justify-center items-center h-[300px]">
              <Spinner size="md" />
            </div>
          ) : currentDoctors.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-[300px] gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center border border-border-base">
                <IoSearchOutline className="w-6 h-6 text-text-muted/40" />
              </div>
              <h3 className="text-[14px] font-semibold text-text-main">
                {searchQuery || hasAdvancedFilters
                  ? "No doctors match your criteria"
                  : "No doctors added yet"}
              </h3>
              <p className="text-[13px] text-text-muted max-w-sm">
                {searchQuery || hasAdvancedFilters
                  ? "Try adjusting filters or search term."
                  : "Start by adding a doctor to your clinic."}
              </p>
              {!searchQuery && !hasAdvancedFilters && (
                <Button
                  color="primary"
                  startContent={<IoAddOutline />}
                  onClick={() =>
                    (window.location.href = "/dashboard/doctors/new")
                  }
                >
                  Add First Doctor
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-2 border-b border-border-base">
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                    Doctor
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                    Speciality
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                    Type
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                    Commission
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[12.5px] font-semibold text-mountain-600 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base">
                {currentDoctors.map((doctor) => (
                  <tr
                    key={doctor.id}
                    className="hover:bg-surface-2 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[13px] shrink-0 border border-primary/20">
                          {doctor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <Link
                            className="font-semibold text-[13.5px] text-text-main hover:text-primary hover:underline"
                            to={`/dashboard/doctors/${doctor.id}`}
                          >
                            {doctor.name}
                          </Link>
                          <div className="text-[11.5px] text-text-muted font-mono mt-0.5">
                            NMC: {doctor.nmcNumber}
                          </div>
                          {isClinicWideAdmin && doctor.branchId && (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-2 text-text-muted border border-border-base">
                                {branchMap[doctor.branchId]}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-[13px] text-text-main">
                        {doctor.phone}
                      </div>
                      {doctor.email && (
                        <div className="text-[11.5px] text-text-muted mt-0.5">
                          {doctor.email}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] text-text-main capitalize">
                        {doctor.speciality}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium capitalize border ${doctor.doctorType === "regular"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                          }`}
                      >
                        {doctor.doctorType}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[13px] text-text-main font-medium">
                        {doctor.defaultCommission}%
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-medium border ${doctor.isActive
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                          }`}
                      >
                        {doctor.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size="sm" variant="bordered">
                            {actionLoading === doctor.id ? (
                              <Spinner size="sm" />
                            ) : (
                              <IoEllipsisVerticalOutline className="w-4 h-4 text-text-muted" />
                            )}
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu>
                          <DropdownItem
                            startContent={<IoEyeOutline className="w-4 h-4" />}
                            onClick={() =>
                              (window.location.href = `/dashboard/doctors/${doctor.id}`)
                            }
                          >
                            View Profile
                          </DropdownItem>
                          <DropdownItem
                            startContent={<IoCreateOutline className="w-4 h-4" />}
                            onClick={() =>
                              (window.location.href = `/dashboard/doctors/${doctor.id}/edit`)
                            }
                          >
                            Edit
                          </DropdownItem>
                          <DropdownItem
                            startContent={<IoCalendarOutline className="w-4 h-4" />}
                            onClick={() =>
                              (window.location.href = `/dashboard/doctors/${doctor.id}/schedule`)
                            }
                          >
                            Schedule
                          </DropdownItem>
                          <DropdownItem
                            startContent={<IoListOutline className="w-4 h-4" />}
                            onClick={() =>
                              (window.location.href = `/dashboard/appointments?doctorId=${doctor.id}`)
                            }
                          >
                            Appointments
                          </DropdownItem>
                          <DropdownItem
                            className={
                              doctor.isActive
                                ? "text-amber-600"
                                : "text-teal-600"
                            }
                            startContent={
                              doctor.isActive ? (
                                <IoPowerOutline className="w-4 h-4" />
                              ) : (
                                <IoShieldCheckmarkOutline className="w-4 h-4" />
                              )
                            }
                            onClick={() =>
                              handleToggleStatus(doctor.id, doctor.isActive)
                            }
                          >
                            {doctor.isActive ? "Deactivate" : "Activate"}
                          </DropdownItem>
                          <DropdownItem
                            color="danger"
                            startContent={<IoTrashOutline className="w-4 h-4" />}
                            onClick={() =>
                              handleDeleteDoctor(doctor.id, doctor.name)
                            }
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

        {/* Pagination */}
        {filteredDoctors.length > 0 && (
          <div className="p-4 border-t border-border-base bg-surface-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-[12.5px] text-text-muted font-medium">
              Showing {startIndex + 1} to {endIndex} of {filteredDoctors.length}{" "}
              doctors
            </span>
            <div className="flex gap-1">
              <Button
                disabled={currentPage === 1}
                size="sm"
                variant="bordered"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 1,
                )
                .map((p, i, arr) => (
                  <React.Fragment key={p}>
                    {i > 0 && arr[i - 1] !== p - 1 && (
                      <span className="px-2 text-text-muted/50">...</span>
                    )}
                    <Button
                      className={
                        currentPage === p ? "" : "text-text-muted bg-surface"
                      }
                      color={currentPage === p ? "primary" : "default"}
                      size="sm"
                      variant={currentPage === p ? "solid" : "bordered"}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </Button>
                  </React.Fragment>
                ))}
              <Button
                disabled={currentPage === totalPages}
                size="sm"
                variant="bordered"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
