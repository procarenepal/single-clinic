import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoStorefrontOutline,
  IoAddOutline,
  IoSearchOutline,
  IoEllipsisVerticalOutline,
  IoCheckmarkCircleOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoStarOutline,
  IoBusinessOutline,
  IoLocationOutline,
  IoCallOutline,
  IoMailOutline,
  IoPersonOutline,
  IoPersonAddOutline,
  IoShieldOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { branchService } from "@/services/branchService";
import { clinicService } from "@/services/clinicService";
import { userService } from "@/services/userService";
import { impersonationService } from "@/services/impersonationService";
import { Branch, Clinic, User } from "@/types/models";

type BranchWithAdmin = Branch & { admin?: User | null };

export default function BranchManagementPage() {
  const navigate = useNavigate();
  const { clinicId, userData } = useAuth();
  const [branches, setBranches] = useState<BranchWithAdmin[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isCreateAdminOpen, setCreateAdminOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchWithAdmin | null>(
    null,
  );
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [adminFormData, setAdminFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [adminPassword, setAdminPassword] = useState("");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const isSystemOwner =
    userData?.role === "system-owner" || userData?.role === "clinic-admin";

  useEffect(() => {
    loadData();
  }, [clinicId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadData = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const [branchesData, clinicData] = await Promise.all([
        branchService.getBranchesWithAdmins(clinicId),
        clinicService.getClinicById(clinicId),
      ]);

      setBranches(branchesData);
      setClinic(clinicData);
    } catch (error) {
      console.error("Error loading data:", error);
      addToast({
        title: "Error",
        description: "Failed to load branch data",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetMainBranch = async (branchId: string) => {
    setOpenDropdownId(null);
    try {
      await branchService.setMainBranch(branchId);
      addToast({
        title: "Success",
        description: "Main branch updated successfully",
        color: "success",
      });
      loadData();
    } catch (error) {
      console.error("Error setting main branch:", error);
      addToast({
        title: "Error",
        description: "Failed to update main branch",
        color: "danger",
      });
    }
  };

  const handleDeactivateBranch = async () => {
    if (!selectedBranch) return;
    try {
      await branchService.deactivateBranch(selectedBranch.id);
      addToast({
        title: "Success",
        description: "Branch deactivated successfully",
        color: "success",
      });
      loadData();
      setDeleteOpen(false);
    } catch (error) {
      console.error("Error deactivating branch:", error);
      addToast({
        title: "Error",
        description: "Failed to deactivate branch",
        color: "danger",
      });
    }
  };

  const handleCreateBranchAdmin = async () => {
    if (!selectedBranch || !adminPassword) return;
    try {
      setIsCreatingAdmin(true);
      const adminId = await userService.createBranchAdmin(
        adminFormData.email,
        adminFormData.password,
        adminFormData.name,
        clinicId!,
        selectedBranch.id,
        adminPassword,
      );

      await impersonationService.storeCredentials(
        adminId,
        adminFormData.email,
        adminFormData.password,
      );
      addToast({
        title: "Success",
        description: "Branch admin created successfully",
        color: "success",
      });
      setAdminFormData({ name: "", email: "", password: "" });
      setAdminPassword("");
      setCreateAdminOpen(false);
      setSelectedBranch(null);
      loadData();
    } catch (error) {
      console.error("Error creating branch admin:", error);
      addToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create branch admin",
        color: "danger",
      });
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const openCreateAdminModal = (branch: BranchWithAdmin) => {
    setSelectedBranch(branch);
    setAdminFormData({ name: "", email: "", password: "" });
    setAdminPassword("");
    setOpenDropdownId(null);
    setCreateAdminOpen(true);
  };

  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.city.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const canCreateMoreBranches =
    clinic && clinic.maxBranches && branches.length < clinic.maxBranches;

  if (!isSystemOwner) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="clarity-card p-3 border-saffron-200 bg-saffron-50">
          <div className="flex items-center gap-3">
            <IoBusinessOutline className="text-saffron-600 text-2xl shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-saffron-800">
                Access Restricted
              </h3>
              <p className="text-sm text-saffron-700">
                Only clinic super administrators can access branch management.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="clarity-page-header">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Branch Management
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage your clinic branches and locations
          </p>
        </div>
        {canCreateMoreBranches && (
          <button
            className="clarity-btn clarity-btn-primary"
            type="button"
            onClick={() => navigate("/dashboard/branches/new")}
          >
            <IoAddOutline aria-hidden className="w-4 h-4" />
            Add New Branch
          </button>
        )}
      </div>

      {clinic && (
        <div className="clarity-card border-b border-[rgb(var(--color-border))]">
          <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
            <div className="flex items-center gap-3">
              <IoBusinessOutline
                aria-hidden
                className="w-5 h-5 text-teal-700"
              />
              <h2 className="text-base font-semibold text-[rgb(var(--color-text))]">
                {clinic.name}
              </h2>
              <span
                className={`clarity-badge ${clinic.isMultiBranchEnabled ? "bg-health-100 text-health-700" : "bg-mountain-100 text-mountain-700"}`}
              >
                {clinic.isMultiBranchEnabled
                  ? "Multi-Branch Enabled"
                  : "Single Branch"}
              </span>
            </div>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-3">
                <IoStorefrontOutline
                  aria-hidden
                  className="text-mountain-500 shrink-0"
                />
                <div>
                  <p className="text-xs text-mountain-500">Total Branches</p>
                  <p className="font-semibold text-[rgb(var(--color-text))]">
                    {branches.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <IoCheckmarkCircleOutline
                  aria-hidden
                  className="text-health-600 shrink-0"
                />
                <div>
                  <p className="text-xs text-mountain-500">Active Branches</p>
                  <p className="font-semibold text-[rgb(var(--color-text))]">
                    {branches.filter((b) => b.isActive).length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <IoBusinessOutline
                  aria-hidden
                  className="text-teal-700 shrink-0"
                />
                <div>
                  <p className="text-xs text-mountain-500">Max Branches</p>
                  <p className="font-semibold text-[rgb(var(--color-text))]">
                    {clinic.maxBranches || "Unlimited"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="clarity-card p-3">
        <div className="relative max-w-md">
          <IoSearchOutline
            aria-hidden
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
          />
          <input
            aria-label="Search branches"
            className="clarity-input with-left-icon w-full"
            placeholder="Search branches by name, code, or city..."
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="clarity-card overflow-hidden">
        <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
          <h3 className="text-base font-semibold text-[rgb(var(--color-text))]">
            Branches
          </h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table aria-label="Branches table" className="clarity-table w-full">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Code</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Branch Admin</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="text-center py-4 text-mountain-500"
                    colSpan={7}
                  >
                    Loading...
                  </td>
                </tr>
              ) : filteredBranches.length === 0 ? (
                <tr>
                  <td
                    className="text-center py-4 text-mountain-500"
                    colSpan={7}
                  >
                    No branches found
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => (
                  <tr key={branch.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <IoStorefrontOutline
                          aria-hidden
                          className="text-mountain-500 shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-[rgb(var(--color-text))]">
                            {branch.name}
                            {branch.isMainBranch && (
                              <IoStarOutline
                                aria-hidden
                                className="inline ml-2 text-saffron-500"
                              />
                            )}
                          </p>
                          {branch.isMainBranch && (
                            <p className="text-xs text-saffron-600">
                              Main Branch
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="clarity-badge bg-mountain-100 text-mountain-700">
                        {branch.code}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <IoLocationOutline
                          aria-hidden
                          className="text-mountain-400 shrink-0"
                        />
                        <div>
                          <p className="text-sm">{branch.address}</p>
                          <p className="text-xs text-mountain-500">
                            {branch.city}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <IoCallOutline
                            aria-hidden
                            className="text-mountain-400 text-xs shrink-0"
                          />
                          <p className="text-sm">{branch.phone}</p>
                        </div>
                        {branch.email && (
                          <div className="flex items-center gap-2">
                            <IoMailOutline
                              aria-hidden
                              className="text-mountain-400 text-xs shrink-0"
                            />
                            <p className="text-xs text-mountain-500">
                              {branch.email}
                            </p>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {branch.admin ? (
                        <div className="flex items-center gap-2">
                          <IoPersonOutline
                            aria-hidden
                            className="text-health-600 shrink-0"
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {branch.admin.displayName}
                            </p>
                            <p className="text-xs text-mountain-500">
                              {branch.admin.email}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="clarity-badge bg-saffron-100 text-saffron-700 inline-flex items-center gap-1">
                          <IoPersonOutline aria-hidden className="w-3 h-3" /> No
                          Admin
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`clarity-badge ${branch.isActive ? "bg-health-100 text-health-700" : "bg-red-100 text-red-700"}`}
                      >
                        {branch.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div
                        ref={
                          openDropdownId === branch.id ? dropdownRef : undefined
                        }
                        className="relative"
                      >
                        <button
                          aria-expanded={openDropdownId === branch.id}
                          aria-haspopup="true"
                          aria-label="Branch actions"
                          className="clarity-btn clarity-btn-ghost h-8 w-8 p-0 justify-center"
                          type="button"
                          onClick={() =>
                            setOpenDropdownId(
                              openDropdownId === branch.id ? null : branch.id,
                            )
                          }
                        >
                          <IoEllipsisVerticalOutline
                            aria-hidden
                            className="w-4 h-4"
                          />
                        </button>
                        {openDropdownId === branch.id && (
                          <div
                            className="absolute right-0 top-full mt-1 min-w-[180px] clarity-card py-1 z-10"
                            role="menu"
                          >
                            <button
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                setOpenDropdownId(null);
                                navigate(`/dashboard/branches/${branch.id}`);
                              }}
                            >
                              <IoPencilOutline
                                aria-hidden
                                className="w-4 h-4 shrink-0"
                              />{" "}
                              Edit Details
                            </button>
                            {!branch.admin && (
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                                role="menuitem"
                                type="button"
                                onClick={() => openCreateAdminModal(branch)}
                              >
                                <IoPersonAddOutline
                                  aria-hidden
                                  className="w-4 h-4 shrink-0"
                                />{" "}
                                Create Branch Admin
                              </button>
                            )}
                            {!branch.isMainBranch && (
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-surface-2))]"
                                role="menuitem"
                                type="button"
                                onClick={() => handleSetMainBranch(branch.id)}
                              >
                                <IoStarOutline
                                  aria-hidden
                                  className="w-4 h-4 shrink-0"
                                />{" "}
                                Set as Main Branch
                              </button>
                            )}
                            {!branch.isMainBranch && branch.isActive && (
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  setSelectedBranch(branch);
                                  setOpenDropdownId(null);
                                  setDeleteOpen(true);
                                }}
                              >
                                <IoTrashOutline
                                  aria-hidden
                                  className="w-4 h-4 shrink-0"
                                />{" "}
                                Deactivate Branch
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deactivate confirmation modal */}
      {isDeleteOpen && (
        <div
          aria-labelledby="delete-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/30"
            onClick={() => setDeleteOpen(false)}
          />
          <div className="clarity-panel w-full max-w-md p-4 relative z-10">
            <h3
              className="text-base font-semibold text-[rgb(var(--color-text))] mb-2"
              id="delete-modal-title"
            >
              Deactivate Branch
            </h3>
            <p className="text-sm text-[rgb(var(--color-text))] mb-3">
              Are you sure you want to deactivate{" "}
              <strong>{selectedBranch?.name}</strong>? This action will make the
              branch inactive but preserve all data.
            </p>
            <div className="bg-saffron-50 p-3 rounded-md border border-saffron-200 mb-4">
              <p className="text-xs text-saffron-800">
                <strong>Note:</strong> Staff and data associated with this
                branch will be preserved but the branch will not accept new
                appointments or operations.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="clarity-btn clarity-btn-ghost"
                type="button"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-danger"
                type="button"
                onClick={handleDeactivateBranch}
              >
                Deactivate Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Branch Admin modal */}
      {isCreateAdminOpen && (
        <div
          aria-labelledby="create-admin-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/30"
            onClick={() => setCreateAdminOpen(false)}
          />
          <div className="clarity-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 relative z-10">
            <div className="mb-4">
              <h3
                className="text-lg font-semibold text-[rgb(var(--color-text))]"
                id="create-admin-modal-title"
              >
                Create Branch Admin
              </h3>
              <p className="text-sm text-mountain-500 mt-0.5">
                Create an administrator for{" "}
                <strong>{selectedBranch?.name}</strong>
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-mountain-600 mb-1">
                  Admin Name
                </label>
                <div className="relative">
                  <IoPersonOutline
                    aria-hidden
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                  />
                  <input
                    aria-required
                    required
                    className="clarity-input with-left-icon w-full"
                    placeholder="Enter admin name"
                    type="text"
                    value={adminFormData.name}
                    onChange={(e) =>
                      setAdminFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-mountain-600 mb-1">
                  Admin Email
                </label>
                <div className="relative">
                  <IoMailOutline
                    aria-hidden
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                  />
                  <input
                    aria-required
                    required
                    className="clarity-input with-left-icon w-full"
                    placeholder="admin@example.com"
                    type="email"
                    value={adminFormData.email}
                    onChange={(e) =>
                      setAdminFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-mountain-600 mb-1">
                  Admin Password
                </label>
                <div className="relative">
                  <IoShieldOutline
                    aria-hidden
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                  />
                  <input
                    aria-required
                    required
                    className="clarity-input with-left-icon w-full"
                    placeholder="Set admin password"
                    type="password"
                    value={adminFormData.password}
                    onChange={(e) =>
                      setAdminFormData((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-mountain-600 mb-1">
                  Your Password
                </label>
                <div className="relative">
                  <IoShieldOutline
                    aria-hidden
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mountain-400 pointer-events-none"
                  />
                  <input
                    aria-required
                    required
                    className="clarity-input with-left-icon w-full"
                    placeholder="Enter your password to confirm"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </div>
                <p className="text-xs text-mountain-500 mt-0.5">
                  Required to maintain your session while creating the admin
                </p>
              </div>
              <div className="bg-teal-50 p-3 rounded-md border border-teal-200">
                <div className="flex gap-3">
                  <IoShieldOutline
                    aria-hidden
                    className="text-teal-700 mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-sm text-teal-800 font-medium">
                      Admin Access
                    </p>
                    <p className="text-xs text-teal-700 mt-1">
                      The new admin will have full access to manage this
                      branch's operations, staff, and data. Admin credentials
                      will be stored for impersonation purposes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="clarity-btn clarity-btn-ghost"
                type="button"
                onClick={() => setCreateAdminOpen(false)}
              >
                Cancel
              </button>
              <button
                className="clarity-btn clarity-btn-primary"
                disabled={
                  isCreatingAdmin ||
                  !adminFormData.name ||
                  !adminFormData.email ||
                  !adminFormData.password ||
                  !adminPassword
                }
                type="button"
                onClick={handleCreateBranchAdmin}
              >
                {isCreatingAdmin ? "Creating…" : "Create Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
