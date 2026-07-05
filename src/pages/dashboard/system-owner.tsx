import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoStorefrontOutline,
  IoBusinessOutline,
  IoPeopleOutline,
  IoCalendarOutline,
  IoPersonOutline,
  IoTrendingUpOutline,
  IoAddOutline,
  IoEyeOutline,
  IoStatsChartOutline,
  IoLocationOutline,
  IoCheckmarkCircleOutline,
} from "react-icons/io5";

import { Skeleton } from "@/components/ui";
import { useAuthContext } from "@/context/AuthContext";
import { branchService } from "@/services/branchService";
import { clinicService } from "@/services/clinicService";
import { Branch, Clinic } from "@/types/models";

interface BranchStats {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isMainBranch: boolean;
  totalPatients: number;
  totalDoctors: number;
  todayAppointments: number;
  thisMonthAppointments: number;
}

export default function SystemOwnerDashboard() {
  const navigate = useNavigate();
  const { clinicId, userData } = useAuthContext();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState({
    totalPatients: 0,
    totalDoctors: 0,
    totalAppointments: 0,
    activeBranches: 0,
  });

  const isSystemOwner =
    userData?.role === "system-owner" || userData?.role === "clinic-admin";

  useEffect(() => {
    if (clinicId && isSystemOwner) {
      loadDashboardData();
    }
  }, [clinicId, isSystemOwner]);

  const loadDashboardData = async () => {
    if (!clinicId) return;

    try {
      setLoading(true);

      const [clinicData, branchesData] = await Promise.all([
        clinicService.getClinicById(clinicId),
        branchService.getClinicBranches(clinicId),
      ]);

      setClinic(clinicData);
      setBranches(branchesData);

      const mockStats: BranchStats[] = branchesData.map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        isActive: branch.isActive,
        isMainBranch: branch.isMainBranch,
        totalPatients: Math.floor(Math.random() * 200) + 50,
        totalDoctors: Math.floor(Math.random() * 20) + 5,
        todayAppointments: Math.floor(Math.random() * 15) + 2,
        thisMonthAppointments: Math.floor(Math.random() * 150) + 30,
      }));

      setBranchStats(mockStats);

      const overall = mockStats.reduce(
        (acc, stat) => ({
          totalPatients: acc.totalPatients + stat.totalPatients,
          totalDoctors: acc.totalDoctors + stat.totalDoctors,
          totalAppointments: acc.totalAppointments + stat.thisMonthAppointments,
          activeBranches: acc.activeBranches + (stat.isActive ? 1 : 0),
        }),
        {
          totalPatients: 0,
          totalDoctors: 0,
          totalAppointments: 0,
          activeBranches: 0,
        },
      );

      setOverallStats(overall);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isSystemOwner) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="clarity-card p-3 border-saffron-200 bg-saffron-50">
          <div className="flex items-center gap-3">
            <IoBusinessOutline
              aria-hidden
              className="text-saffron-600 text-2xl shrink-0"
            />
            <div>
              <h3 className="text-base font-semibold text-saffron-800">
                Access Restricted
              </h3>
              <p className="text-sm text-saffron-700">
                This dashboard is only available for system owners.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-3 space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const canCreateMoreBranches =
    clinic && clinic.maxBranches && branches.length < clinic.maxBranches;
  const branchCapacityPercent = clinic?.maxBranches
    ? (branches.length / clinic.maxBranches) * 100
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 space-y-6">
      <div className="clarity-page-header">
        <div>
          <h1 className="clarity-page-title">System Owner Dashboard</h1>
          <p className="clarity-page-subtitle">
            Multi-branch overview and management
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="clarity-btn clarity-btn-ghost"
            type="button"
            onClick={() => navigate("/dashboard/branches")}
          >
            <IoEyeOutline aria-hidden className="w-4 h-4" />
            Manage Branches
          </button>
          {canCreateMoreBranches && (
            <button
              className="clarity-btn clarity-btn-primary"
              type="button"
              onClick={() => navigate("/dashboard/branches/new")}
            >
              <IoAddOutline aria-hidden className="w-4 h-4" />
              Add Branch
            </button>
          )}
        </div>
      </div>

      {clinic && (
        <div className="clarity-card overflow-hidden">
          <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
            <div className="flex items-center gap-3">
              <IoBusinessOutline
                aria-hidden
                className="w-5 h-5 text-teal-700 shrink-0"
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <IoStorefrontOutline
                  aria-hidden
                  className="w-8 h-8 text-teal-700 mx-auto mb-2"
                />
                <p className="clarity-stat-value">{branches.length}</p>
                <p className="clarity-stat-label">Total Branches</p>
              </div>
              <div className="text-center">
                <IoCheckmarkCircleOutline
                  aria-hidden
                  className="w-8 h-8 text-health-600 mx-auto mb-2"
                />
                <p className="clarity-stat-value">
                  {overallStats.activeBranches}
                </p>
                <p className="clarity-stat-label">Active Branches</p>
              </div>
              <div className="text-center">
                <IoPeopleOutline
                  aria-hidden
                  className="w-8 h-8 text-saffron-600 mx-auto mb-2"
                />
                <p className="clarity-stat-value">
                  {overallStats.totalPatients}
                </p>
                <p className="clarity-stat-label">Total Patients</p>
              </div>
              <div className="text-center">
                <IoPersonOutline
                  aria-hidden
                  className="w-8 h-8 text-health-600 mx-auto mb-2"
                />
                <p className="clarity-stat-value">
                  {overallStats.totalDoctors}
                </p>
                <p className="clarity-stat-label">Total Doctors</p>
              </div>
            </div>

            {clinic.maxBranches != null && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-xs font-medium text-[rgb(var(--color-text-muted))]">
                    Branch Capacity
                  </p>
                  <p className="text-xs text-mountain-500">
                    {branches.length} / {clinic.maxBranches}
                  </p>
                </div>
                <div className="h-2 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] ease-out"
                    style={{
                      width: `${Math.min(100, branchCapacityPercent)}%`,
                      backgroundColor:
                        branches.length >= clinic.maxBranches
                          ? "rgb(var(--color-danger))"
                          : "rgb(var(--color-primary))",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="clarity-card overflow-hidden">
        <div className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))] px-4 py-3">
          <div className="flex items-center gap-3">
            <IoStatsChartOutline
              aria-hidden
              className="w-5 h-5 text-teal-700 shrink-0"
            />
            <h2 className="text-base font-semibold text-[rgb(var(--color-text))]">
              Branch Performance
            </h2>
          </div>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {branchStats.map((stat) => (
              <div
                key={stat.id}
                className="clarity-card p-3 bg-[rgb(var(--color-surface-2))]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <IoLocationOutline
                      aria-hidden
                      className="text-mountain-500 shrink-0"
                    />
                    <div>
                      <h3 className="font-semibold text-[rgb(var(--color-text))] flex items-center gap-2">
                        {stat.name}
                        {stat.isMainBranch && (
                          <span className="clarity-badge bg-saffron-100 text-saffron-700">
                            Main
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-mountain-500">
                        Code: {stat.code}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`clarity-badge ${stat.isActive ? "bg-health-100 text-health-700" : "bg-red-100 text-red-700"}`}
                  >
                    {stat.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="clarity-divider" />

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <IoPeopleOutline
                        aria-hidden
                        className="text-teal-700 text-sm shrink-0"
                      />
                      <span className="text-sm text-mountain-600">
                        Patients
                      </span>
                    </div>
                    <span className="font-semibold text-[rgb(var(--color-text))]">
                      {stat.totalPatients}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <IoPersonOutline
                        aria-hidden
                        className="text-health-600 text-sm shrink-0"
                      />
                      <span className="text-sm text-mountain-600">Doctors</span>
                    </div>
                    <span className="font-semibold text-[rgb(var(--color-text))]">
                      {stat.totalDoctors}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <IoCalendarOutline
                        aria-hidden
                        className="text-health-600 text-sm shrink-0"
                      />
                      <span className="text-sm text-mountain-600">Today</span>
                    </div>
                    <span className="font-semibold text-[rgb(var(--color-text))]">
                      {stat.todayAppointments}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <IoTrendingUpOutline
                        aria-hidden
                        className="text-saffron-600 text-sm shrink-0"
                      />
                      <span className="text-sm text-mountain-600">
                        This Month
                      </span>
                    </div>
                    <span className="font-semibold text-[rgb(var(--color-text))]">
                      {stat.thisMonthAppointments}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {branchStats.length === 0 && (
            <div className="text-center py-8">
              <IoStorefrontOutline
                aria-hidden
                className="w-12 h-12 text-mountain-300 mx-auto mb-3"
              />
              <h3 className="text-base font-semibold text-[rgb(var(--color-text))] mb-2">
                No Branches Found
              </h3>
              <p className="text-sm text-mountain-500 mb-4">
                {canCreateMoreBranches
                  ? "Create your first branch to get started with multi-branch management."
                  : "Contact support to enable multi-branch functionality."}
              </p>
              {canCreateMoreBranches && (
                <button
                  className="clarity-btn clarity-btn-primary"
                  type="button"
                  onClick={() => navigate("/dashboard/branches/new")}
                >
                  <IoAddOutline aria-hidden className="w-4 h-4" />
                  Create First Branch
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
