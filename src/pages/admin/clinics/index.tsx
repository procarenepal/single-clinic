import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import {
  IoSearch,
  IoFilter,
  IoBusinessOutline,
  IoCheckmarkCircleOutline,
  IoStatsChartOutline,
  IoAlertCircleOutline,
  IoAddOutline,
  IoTrashOutline,
  IoRefreshOutline,
} from "react-icons/io5";

import { useTheme } from "@/context/ThemeContext";
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Input,
  Button,
  Spinner,
  Select,
  SelectItem,
  Pagination,
  Progress,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
} from "@/components/ui";
import { title } from "@/components/primitives";
import { clinicService } from "@/services/clinicService";
import { clinicTypeService } from "@/services/clinicTypeService";
import { Clinic, ClinicType } from "@/types/models";
import { useDeletionProgress } from "@/context/DeletionProgressContext";

export default function ClinicListPage() {
  const navigate = useNavigate();
  const { themeConfig, isDark } = useTheme();
  const {
    deletionState,
    startDeletion,
    updateProgress,
    setDeletionResults: setGlobalDeletionResults,
    completeDeletion,
    cancelDeletion,
  } = useDeletionProgress();

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicTypes, setClinicTypes] = useState<ClinicType[]>([]);
  const [clinicTypeMap, setClinicTypeMap] = useState<Record<string, string>>(
    {},
  );
  const [filteredClinics, setFilteredClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const clinicsPerPage = 10;

  // Load clinics and clinic types data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clinicsData, clinicTypesData] = await Promise.all([
          clinicService.getAllClinics(),
          clinicTypeService.getAllClinicTypes(),
        ]);

        setClinics(clinicsData);
        setClinicTypes(clinicTypesData);

        // Create a mapping of clinic type ID to clinic type name
        const typeMap: Record<string, string> = {};

        clinicTypesData.forEach((type) => {
          typeMap[type.id] = type.name;
        });
        setClinicTypeMap(typeMap);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load clinics");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter and search clinics
  useEffect(() => {
    let result = [...clinics];

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter(
        (clinic) => clinic.subscriptionStatus === statusFilter,
      );
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();

      result = result.filter(
        (clinic) =>
          clinic.name.toLowerCase().includes(query) ||
          clinic.email.toLowerCase().includes(query),
      );
    }

    setFilteredClinics(result);
  }, [clinics, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredClinics.length / clinicsPerPage);
  const startIndex = (page - 1) * clinicsPerPage;
  const endIndex = startIndex + clinicsPerPage;
  const currentClinics = filteredClinics.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleDeleteClick = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedClinic) return;

    // Start the global deletion process
    startDeletion(selectedClinic.name);

    // Close the modal immediately since progress will be shown via toasts
    setDeleteModalVisible(false);
    setSelectedClinic(null);

    try {
      // Create a timeout to show progress messages
      const progressMessages = [
        "Verifying permissions...",
        "Deleting user role assignments...",
        "Deleting roles and permissions...",
        "Deleting medical records and notes...",
        "Deleting medicine inventory and stock...",
        "Deleting appointments and schedules...",
        "Deleting patients, doctors, and contacts...",
        "Deleting operational data...",
        "Deleting branches and settings...",
        "Deleting users and access...",
        "Finalizing clinic deletion...",
      ];

      let messageIndex = 0;
      const progressInterval = setInterval(() => {
        if (messageIndex < progressMessages.length) {
          updateProgress(progressMessages[messageIndex]);
          messageIndex++;
        }
      }, 3000);

      await clinicService.deleteClinic(
        selectedClinic.id,
      );

      clearInterval(progressInterval);
      updateProgress("Deletion completed successfully!");
      setGlobalDeletionResults({});

      // Remove clinic from local state
      setClinics(clinics.filter((c) => c.id !== selectedClinic.id));

      // Complete the deletion process
      completeDeletion();
    } catch (err: any) {
      console.error("Deletion error:", err);
      cancelDeletion();
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Spinner label="Loading clinics data..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border border-red-200 bg-red-50">
        <CardBody>
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <IoAlertCircleOutline className="w-12 h-12 text-red-600" />
            <div className="text-center">
              <p className="text-xl font-semibold text-red-600">{error}</p>
              <p className="text-sm text-red-600/80 mt-1">
                Please try again or contact support if the issue persists.
              </p>
            </div>
            <Button
              className="mt-2"
              color="warning"
              variant="flat"
              onClick={() => window.location.reload()}
            >
              Retry Loading
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Page header with search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className={title({ size: "sm" })}>Manage Clinics</h1>
            <p className="text-foreground-600 mt-2">
              View and manage all registered clinics on the platform
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Link to="/admin/clinics/new">
              <Button
                color="primary"
                startContent={<IoAddOutline />}
                variant="solid"
              >
                Register New Clinic
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card
            className={clsx(
              "border border-mountain-200",
              isDark ? "bg-mountain-800/30" : "bg-teal-50/50",
            )}
          >
            <CardBody>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-foreground-600">
                    Total Clinics
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-bold text-foreground">
                      {filteredClinics.length}
                    </p>
                  </div>
                </div>
                <div
                  className={clsx(
                    "p-3 rounded-lg",
                    isDark ? "bg-teal-500/20" : "bg-teal-100",
                  )}
                >
                  <IoBusinessOutline className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card
            className={clsx(
              "border border-mountain-200",
              isDark ? "bg-mountain-800/30" : "bg-health-50/50",
            )}
          >
            <CardBody>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-foreground-600">
                    Active Clinics
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-bold text-foreground">
                      {
                        filteredClinics.filter(
                          (c) => c.subscriptionStatus === "active",
                        ).length
                      }
                    </p>
                  </div>
                </div>
                <div
                  className={clsx(
                    "p-3 rounded-lg",
                    isDark ? "bg-health-500/20" : "bg-health-100",
                  )}
                >
                  <IoCheckmarkCircleOutline className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card
            className={clsx(
              "border border-mountain-200",
              isDark ? "bg-mountain-800/30" : "bg-saffron-50/50",
            )}
          >
            <CardBody>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-foreground-600">
                    Subscription Rate
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-bold text-foreground">
                      {filteredClinics.length > 0
                        ? Math.round(
                          (filteredClinics.filter(
                            (c) => c.subscriptionStatus === "active",
                          ).length /
                            filteredClinics.length) *
                          100,
                        )
                        : 0}
                      %
                    </p>
                  </div>
                </div>
                <div
                  className={clsx(
                    "p-3 rounded-lg",
                    isDark ? "bg-saffron-500/20" : "bg-saffron-100",
                  )}
                >
                  <IoStatsChartOutline className="w-6 h-6 text-warning" />
                </div>
              </div>
              <Progress
                className="mt-4"
                color="warning"
                value={
                  filteredClinics.length > 0
                    ? Math.round(
                      (filteredClinics.filter(
                        (c) => c.subscriptionStatus === "active",
                      ).length /
                        filteredClinics.length) *
                      100,
                    )
                    : 0
                }
              />
            </CardBody>
          </Card>
        </div>

        {/* Filters */}
        <Card
          className={clsx(
            "border border-mountain-200",
            isDark ? "bg-mountain-800/20" : "bg-white",
          )}
        >
          <CardHeader>
            <h2 className="text-md font-semibold flex items-center gap-2 text-foreground">
              <IoFilter className="text-foreground-600" />
              Filter & Search
            </h2>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  className="w-full"
                  placeholder="Search by name, email or ID..."
                  size="sm"
                  startContent={<IoSearch className="text-foreground-400" />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="w-full md:w-48">
                <Select
                  className={clsx(
                    "w-full",
                    isDark ? "bg-mountain-800/30" : "bg-white",
                  )}
                  placeholder="Status"
                  selectedKeys={[statusFilter]}
                  size="sm"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <SelectItem key="all">All Status</SelectItem>
                  <SelectItem key="active">Active</SelectItem>
                  <SelectItem key="suspended">Suspended</SelectItem>
                  <SelectItem key="expired">Expired</SelectItem>
                </Select>
              </div>
              <Button
                color="primary"
                size="sm"
                startContent={<IoRefreshOutline />}
                variant="flat"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Reset Filters
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Clinics list */}
        <Card className="border border-mountain-200">
          <CardHeader
            className={clsx(
              "flex justify-between items-center border-b border-mountain-200",
              isDark ? "bg-mountain-800/20" : "bg-mountain-50",
            )}
          >
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Clinics Directory
              </h2>
              <p className="text-sm text-foreground-500">
                Showing {currentClinics.length} of {filteredClinics.length}{" "}
                clinics
              </p>
            </div>
            <Chip color="primary" size="sm" variant="flat">
              Page {page} of {totalPages || 1}
            </Chip>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr
                  className={clsx(
                    "text-left",
                    isDark ? "bg-mountain-800/20" : "bg-mountain-50",
                  )}
                >
                  <th className="py-3 px-4 text-xs font-medium text-foreground-600">
                    Clinic Name
                  </th>
                  <th className="py-3 px-4 text-xs font-medium text-foreground-600">
                    Contact
                  </th>
                  <th className="py-3 px-4 text-xs font-medium text-foreground-600">
                    Status
                  </th>
                  <th className="py-3 px-4 text-xs font-medium text-foreground-600">
                    Registration Date
                  </th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-foreground-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {currentClinics.map((clinic) => (
                  <tr
                    key={clinic.id}
                    className={clsx(
                      "group transition-colors",
                      isDark ? "hover:bg-mountain-800/30" : "hover:bg-slate-50",
                    )}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                          {clinic.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {clinic.name}
                          </div>
                          <div className="text-xs text-foreground-500">
                            {clinicTypeMap[clinic.clinicType] || "Unknown Type"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-foreground">{clinic.email}</div>
                      <div className="text-xs text-foreground-500">
                        {clinic.phone}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Chip
                        color={
                          clinic.subscriptionStatus === "active"
                            ? "success"
                            : clinic.subscriptionStatus === "suspended"
                              ? "warning"
                              : "danger"
                        }
                        size="sm"
                        variant="flat"
                      >
                        {clinic.subscriptionStatus.charAt(0).toUpperCase() +
                          clinic.subscriptionStatus.slice(1)}
                      </Chip>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-foreground">
                        {clinic.createdAt instanceof Date
                          ? clinic.createdAt.toLocaleDateString()
                          : new Date(
                            String(clinic.createdAt),
                          ).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-foreground-500">
                        {clinic.createdAt instanceof Date
                          ? clinic.createdAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                          : new Date(
                            String(clinic.createdAt),
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to={`/admin/clinics/${clinic.id}`}>
                          <Button color="primary" size="sm" variant="flat">
                            View
                          </Button>
                        </Link>
                        <Link to={`/admin/clinics/${clinic.id}/edit`}>
                          <Button color="secondary" size="sm" variant="flat">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          color="danger"
                          size="sm"
                          variant="flat"
                          onClick={() => handleDeleteClick(clinic)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {currentClinics.length === 0 && (
                  <tr>
                    <td className="py-16" colSpan={5}>
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div
                          className={clsx(
                            "w-16 h-16 rounded-full flex items-center justify-center",
                            isDark ? "bg-mountain-800/30" : "bg-mountain-100",
                          )}
                        >
                          <IoBusinessOutline className="w-8 h-8 text-foreground-400" />
                        </div>
                        <p className="text-foreground-500 mt-2">
                          No clinics found matching your filters
                        </p>
                        {(searchQuery || statusFilter !== "all") && (
                          <Button
                            color="primary"
                            size="sm"
                            variant="flat"
                            onClick={() => {
                              setSearchQuery("");
                              setStatusFilter("all");
                            }}
                          >
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardBody>
          <CardFooter
            className={clsx(
              "flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-mountain-200",
              isDark ? "bg-mountain-800/20" : "bg-mountain-50",
            )}
          >
            <p className="text-sm text-mountain-500 mb-4 sm:mb-0">
              Total {filteredClinics.length} clinics found
            </p>
            <Pagination
              className="rounded-lg"
              page={page}
              total={totalPages || 1}
              onChange={handlePageChange}
            />
          </CardFooter>
        </Card>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-danger">
            <IoTrashOutline className="text-danger" />
            Confirm Delete
          </ModalHeader>
          <Divider />
          <ModalBody>
            <div className="py-4">
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4">
                  <IoAlertCircleOutline className="w-8 h-8 text-danger" />
                </div>
                <p className="text-center text-lg font-medium text-foreground">
                  Are you sure you want to delete this clinic?
                </p>
              </div>

              {selectedClinic && (
                <Card
                  className={clsx(
                    "mt-4 border border-mountain-200",
                    isDark ? "bg-mountain-800/30" : "bg-mountain-50",
                  )}
                >
                  <CardBody className="py-2">
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-foreground">
                        {selectedClinic.name}
                      </div>
                      <div className="text-sm text-foreground-500">
                        {selectedClinic.email}
                      </div>
                      <div className="text-sm text-foreground-600">
                        Type:{" "}
                        {clinicTypeMap[selectedClinic.clinicType] ||
                          "Unknown Type"}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Chip
                          color={
                            selectedClinic.subscriptionStatus === "active"
                              ? "success"
                              : selectedClinic.subscriptionStatus ===
                                "suspended"
                                ? "warning"
                                : "danger"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {selectedClinic.subscriptionStatus
                            .charAt(0)
                            .toUpperCase() +
                            selectedClinic.subscriptionStatus.slice(1)}
                        </Chip>
                        <span className="text-xs text-foreground-500">
                          Since{" "}
                          {selectedClinic.createdAt instanceof Date
                            ? selectedClinic.createdAt.toLocaleDateString()
                            : new Date(
                              String(selectedClinic.createdAt),
                            ).toLocaleDateString()}{" "}
                          at{" "}
                          {selectedClinic.createdAt instanceof Date
                            ? selectedClinic.createdAt.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                            : new Date(
                              String(selectedClinic.createdAt),
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                        </span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              <Card className="mt-4 bg-red-50 border border-red-200">
                <CardBody className="py-3">
                  <p className="text-sm text-danger font-medium mb-2">
                    ⚠️ This action cannot be undone
                  </p>
                  <p className="text-xs text-danger/80">
                    This will permanently delete ALL data associated with this
                    clinic including:
                  </p>
                  <ul className="text-xs text-danger/80 mt-2 ml-4 space-y-1">
                    <li>• All user accounts and permissions</li>
                    <li>• All patient records and medical data</li>
                    <li>• All appointments and history</li>
                    <li>• All medicine inventory and stock data</li>
                    <li>• All branches and settings</li>
                  </ul>
                  <div className="mt-3 pt-3 border-t border-danger/20">
                    <p className="text-xs font-medium text-warning">
                      🚨 IMPORTANT: Do not close your browser tab during the
                      deletion process!
                    </p>
                  </div>
                </CardBody>
              </Card>

              {deletionState.isDeleting && (
                <Card className="mt-4 bg-primary/5 border-primary/20">
                  <CardBody className="py-3">
                    <p className="text-sm text-primary font-medium mb-2">
                      🔄 Deletion in Progress
                    </p>
                    <p className="text-xs text-primary/80">
                      Deletion progress is being tracked via persistent toast
                      notifications. You can navigate to other pages while the
                      deletion is in progress.
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          </ModalBody>
          <Divider />
          <ModalFooter>
            <Button
              className="font-medium"
              color="default"
              variant="light"
              onClick={() => setDeleteModalVisible(false)}
            >
              Cancel
            </Button>
            <Button
              className="font-medium"
              color="danger"
              isDisabled={deletionState.isDeleting}
              startContent={<IoTrashOutline />}
              onClick={handleConfirmDelete}
            >
              {deletionState.isDeleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
